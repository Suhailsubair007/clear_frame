import type { ContainerBlock, ContainerInventory, StripResult } from '~/types/metadata'
import { concatBytes, hasAsciiAt, indexOfAscii, readUint16BE, uint16BE } from '../binary'
import { ClearFrameError } from '../errors'
import { buildOrientationExifPayload, needsOrientation, readTiffOrientation, tiffFromExifPayload } from '../exif'

const MARKER_SOI = 0xd8
const MARKER_EOI = 0xd9
const MARKER_SOS = 0xda
const MARKER_APP0 = 0xe0
const MARKER_APP1 = 0xe1
const MARKER_APP2 = 0xe2
const MARKER_APP11 = 0xeb
const MARKER_APP13 = 0xed
const MARKER_APP14 = 0xee
const MARKER_COM = 0xfe

/** SOFn markers carry the frame dimensions. */
const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

type JpegPart =
  | { type: 'segment'; marker: number; start: number; end: number }
  | { type: 'marker'; marker: number; start: number; end: number }
  | { type: 'scan'; start: number; end: number }
  | { type: 'trailer'; start: number; end: number }

interface ClassifiedSegment {
  block?: Omit<ContainerBlock, 'offset' | 'length'>
  /** Replacement bytes for a kept segment (e.g. JFIF without its thumbnail). */
  replacement?: Uint8Array
}

function isStandaloneMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)
}

/** Finds where entropy-coded scan data ends (the next real marker). */
function findScanEnd(bytes: Uint8Array, start: number): number {
  let position = start
  while (position < bytes.length) {
    const ff = bytes.indexOf(0xff, position)
    if (ff === -1 || ff + 1 >= bytes.length) return bytes.length
    const next = bytes[ff + 1] ?? 0
    if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
      position = ff + 2 // stuffed byte or restart marker: still scan data
    } else if (next === 0xff) {
      position = ff + 1 // fill byte
    } else {
      return ff
    }
  }
  return bytes.length
}

/** Splits a JPEG into segments, scan data and trailing bytes without decoding pixels. */
function parseJpeg(bytes: Uint8Array): JpegPart[] {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== MARKER_SOI) {
    throw new ClearFrameError('corrupted', 'Missing JPEG start-of-image marker')
  }

  const parts: JpegPart[] = [{ type: 'marker', marker: MARKER_SOI, start: 0, end: 2 }]
  let position = 2

  while (position < bytes.length) {
    if (bytes[position] !== 0xff) {
      // Tolerate stray bytes between segments, as decoders do.
      const next = bytes.indexOf(0xff, position)
      if (next === -1) break
      position = next
    }
    while (position < bytes.length && bytes[position] === 0xff) position++
    if (position >= bytes.length) break

    const marker = bytes[position] ?? 0
    const markerStart = position - 1
    position++

    if (marker === MARKER_EOI) {
      parts.push({ type: 'marker', marker, start: markerStart, end: position })
      if (position < bytes.length) parts.push({ type: 'trailer', start: position, end: bytes.length })
      return parts
    }
    if (isStandaloneMarker(marker)) {
      parts.push({ type: 'marker', marker, start: markerStart, end: position })
      continue
    }

    const segmentLength = readUint16BE(bytes, position)
    if (segmentLength < 2 || position + segmentLength > bytes.length) {
      throw new ClearFrameError('corrupted', 'JPEG segment length is invalid')
    }
    const end = position + segmentLength
    parts.push({ type: 'segment', marker, start: markerStart, end })
    position = end

    if (marker === MARKER_SOS) {
      const scanEnd = findScanEnd(bytes, position)
      parts.push({ type: 'scan', start: position, end: scanEnd })
      position = scanEnd
    }
  }
  return parts
}

/** JFIF APP0 may embed an uncompressed thumbnail; rebuild it without one. */
function stripJfifThumbnail(bytes: Uint8Array, start: number, end: number): Uint8Array | undefined {
  const payload = start + 4
  if (end - payload < 14) return undefined
  const thumbWidth = bytes[payload + 12] ?? 0
  const thumbHeight = bytes[payload + 13] ?? 0
  if (thumbWidth * thumbHeight === 0) return undefined
  const header = bytes.slice(payload, payload + 14)
  header[12] = 0
  header[13] = 0
  return concatBytes([new Uint8Array([0xff, MARKER_APP0]), uint16BE(header.length + 2), header])
}

function classifySegment(bytes: Uint8Array, marker: number, start: number, end: number): ClassifiedSegment {
  const payload = start + 4
  const appIndex = marker - MARKER_APP0
  const appLabel = `APP${appIndex}`

  if (marker === MARKER_APP0) {
    if (hasAsciiAt(bytes, payload, 'JFIF\0')) {
      const replacement = stripJfifThumbnail(bytes, start, end)
      return replacement
        ? { replacement, block: { kind: 'thumbnail', label: 'APP0 · JFIF thumbnail', action: 'remove' } }
        : {}
    }
    const label = hasAsciiAt(bytes, payload, 'JFXX\0')
      ? 'APP0 · JFIF extension thumbnail'
      : `${appLabel} · Application data`
    return { block: { kind: hasAsciiAt(bytes, payload, 'JFXX\0') ? 'thumbnail' : 'other', label, action: 'remove' } }
  }

  if (marker === MARKER_APP1) {
    if (hasAsciiAt(bytes, payload, 'Exif\0')) {
      return { block: { kind: 'exif', label: 'APP1 · EXIF', action: 'remove' } }
    }
    if (hasAsciiAt(bytes, payload, 'http://ns.adobe.com/xap/1.0/\0')) {
      return { block: { kind: 'xmp', label: 'APP1 · XMP', action: 'remove' } }
    }
    if (hasAsciiAt(bytes, payload, 'http://ns.adobe.com/xmp/extension/\0')) {
      return { block: { kind: 'xmp', label: 'APP1 · Extended XMP', action: 'remove' } }
    }
    return { block: { kind: 'other', label: 'APP1 · Application data', action: 'remove' } }
  }

  if (marker === MARKER_APP2) {
    if (hasAsciiAt(bytes, payload, 'ICC_PROFILE\0')) {
      return { block: { kind: 'icc', label: 'APP2 · ICC colour profile', action: 'keep' } }
    }
    if (hasAsciiAt(bytes, payload, 'MPF\0')) {
      return { block: { kind: 'multi-picture', label: 'APP2 · Multi-picture index', action: 'remove' } }
    }
    return { block: { kind: 'other', label: 'APP2 · Application data', action: 'remove' } }
  }

  if (marker === MARKER_APP11) {
    const isC2pa = indexOfAscii(bytes, 'c2pa', payload, end) !== -1
    return isC2pa
      ? { block: { kind: 'c2pa', label: 'APP11 · Content Credentials (C2PA)', action: 'remove' } }
      : { block: { kind: 'other', label: 'APP11 · JUMBF data', action: 'remove' } }
  }

  if (marker === MARKER_APP13) {
    return { block: { kind: 'iptc', label: 'APP13 · IPTC / Photoshop', action: 'remove' } }
  }

  if (marker === MARKER_APP14 && hasAsciiAt(bytes, payload, 'Adobe')) {
    return {} // Colour-transform flags required for correct decoding.
  }

  if (marker > MARKER_APP0 && marker <= 0xef) {
    return { block: { kind: 'other', label: `${appLabel} · Application data`, action: 'remove' } }
  }

  if (marker === MARKER_COM) {
    return { block: { kind: 'comment', label: 'COM · Comment', action: 'remove' } }
  }

  return {} // Structural segment (tables, frame header, scan header).
}

interface JpegAnalysis {
  parts: JpegPart[]
  classified: Map<JpegPart, ClassifiedSegment>
  inventory: ContainerInventory
}

function analyzeJpeg(bytes: Uint8Array): JpegAnalysis {
  const parts = parseJpeg(bytes)
  const classified = new Map<JpegPart, ClassifiedSegment>()
  const blocks: ContainerBlock[] = []
  let width = 0
  let height = 0
  let orientation: number | undefined

  for (const part of parts) {
    if (part.type === 'trailer') {
      blocks.push({
        kind: 'trailer',
        label: 'Data after end of image',
        action: 'remove',
        offset: part.start,
        length: part.end - part.start,
      })
      continue
    }
    if (part.type !== 'segment') continue

    if (SOF_MARKERS.has(part.marker) && width === 0) {
      height = readUint16BE(bytes, part.start + 5)
      width = readUint16BE(bytes, part.start + 7)
    }

    const classification = classifySegment(bytes, part.marker, part.start, part.end)
    classified.set(part, classification)
    if (!classification.block) continue
    blocks.push({ ...classification.block, offset: part.start, length: part.end - part.start })

    if (classification.block.kind === 'exif' && orientation === undefined) {
      orientation = readTiffOrientation(tiffFromExifPayload(bytes.subarray(part.start + 4, part.end)))
    }
  }

  return { parts, classified, inventory: { format: 'jpeg', width, height, blocks, orientation } }
}

export function inspectJpeg(bytes: Uint8Array): ContainerInventory {
  return analyzeJpeg(bytes).inventory
}

function buildApp1(payload: Uint8Array): Uint8Array {
  return concatBytes([new Uint8Array([0xff, MARKER_APP1]), uint16BE(payload.length + 2), payload])
}

/**
 * Removes metadata segments while copying image data byte-for-byte.
 * Pixels are never decoded or re-compressed.
 */
export function stripJpeg(bytes: Uint8Array): StripResult {
  const { parts, classified, inventory } = analyzeJpeg(bytes)
  const output: Uint8Array[] = []
  const preserveOrientation = needsOrientation(inventory.orientation)
  let orientationWritten = false
  let sawEoi = false

  for (const part of parts) {
    if (part.type === 'trailer') continue
    if (part.type === 'marker' && part.marker === MARKER_EOI) sawEoi = true

    const classification = part.type === 'segment' ? classified.get(part) : undefined
    if (classification?.replacement) {
      output.push(classification.replacement)
      continue
    }
    if (classification?.block?.action === 'remove') {
      if (classification.block.kind === 'exif' && preserveOrientation && !orientationWritten) {
        output.push(buildApp1(buildOrientationExifPayload(inventory.orientation as number)))
        orientationWritten = true
      }
      continue
    }
    output.push(bytes.subarray(part.start, part.end))
  }

  // Truncated files: close the image so the output is well-formed.
  if (!sawEoi) output.push(new Uint8Array([0xff, MARKER_EOI]))

  return {
    bytes: concatBytes(output),
    removed: inventory.blocks.filter((block) => block.action === 'remove'),
    kept: inventory.blocks.filter((block) => block.action === 'keep'),
    orientationPreserved: orientationWritten,
  }
}
