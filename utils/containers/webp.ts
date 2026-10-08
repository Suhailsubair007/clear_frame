import type { ContainerBlock, ContainerInventory, StripResult } from '~/types/metadata'
import {
  asciiBytes,
  concatBytes,
  hasAsciiAt,
  readAscii,
  readUint16LE,
  readUint24LE,
  readUint32LE,
  uint32LE,
} from '../binary'
import { ClearFrameError } from '../errors'
import { buildOrientationTiff, needsOrientation, readTiffOrientation, tiffFromExifPayload } from '../exif'

/** Chunks that make up the picture itself. Everything else is metadata or unknown. */
const IMAGE_CHUNKS = new Set(['VP8X', 'VP8 ', 'VP8L', 'ALPH', 'ANIM', 'ANMF'])

const VP8X_FLAG_EXIF = 0x08
const VP8X_FLAG_XMP = 0x04

interface WebpChunk {
  fourCC: string
  start: number
  dataStart: number
  dataEnd: number
  /** End including the padding byte for odd-sized chunks. */
  end: number
}

interface WebpAnalysis {
  chunks: WebpChunk[]
  classified: Map<WebpChunk, Omit<ContainerBlock, 'offset' | 'length'>>
  inventory: ContainerInventory
}

function parseWebp(bytes: Uint8Array): { chunks: WebpChunk[]; riffEnd: number } {
  if (!hasAsciiAt(bytes, 0, 'RIFF') || !hasAsciiAt(bytes, 8, 'WEBP')) {
    throw new ClearFrameError('corrupted', 'Missing RIFF/WEBP header')
  }
  const riffEnd = Math.min(bytes.length, 8 + readUint32LE(bytes, 4))
  const chunks: WebpChunk[] = []
  let position = 12

  while (position + 8 <= riffEnd) {
    const fourCC = readAscii(bytes, position, 4)
    const size = readUint32LE(bytes, position + 4)
    const dataStart = position + 8
    const dataEnd = dataStart + size
    if (dataEnd > riffEnd) throw new ClearFrameError('corrupted', `WebP chunk ${fourCC} is truncated`)
    const end = Math.min(riffEnd, dataEnd + (size % 2))
    chunks.push({ fourCC, start: position, dataStart, dataEnd, end })
    position = end
  }

  if (!chunks.some((chunk) => ['VP8 ', 'VP8L', 'ANMF'].includes(chunk.fourCC))) {
    throw new ClearFrameError('corrupted', 'WebP has no image data')
  }
  return { chunks, riffEnd }
}

function readDimensions(bytes: Uint8Array, chunks: WebpChunk[]): { width: number; height: number } {
  for (const chunk of chunks) {
    const data = chunk.dataStart
    if (chunk.fourCC === 'VP8X') {
      return { width: readUint24LE(bytes, data + 4) + 1, height: readUint24LE(bytes, data + 7) + 1 }
    }
    if (chunk.fourCC === 'VP8L' && bytes[data] === 0x2f) {
      const bits = readUint32LE(bytes, data + 1)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    if (chunk.fourCC === 'VP8 ') {
      return { width: readUint16LE(bytes, data + 6) & 0x3fff, height: readUint16LE(bytes, data + 8) & 0x3fff }
    }
  }
  return { width: 0, height: 0 }
}

function classifyChunk(chunk: WebpChunk): Omit<ContainerBlock, 'offset' | 'length'> | undefined {
  if (IMAGE_CHUNKS.has(chunk.fourCC)) return undefined
  switch (chunk.fourCC) {
    case 'ICCP':
      return { kind: 'icc', label: 'ICCP · ICC colour profile', action: 'keep' }
    case 'EXIF':
      return { kind: 'exif', label: 'EXIF chunk', action: 'remove' }
    case 'XMP ':
      return { kind: 'xmp', label: 'XMP chunk', action: 'remove' }
    case 'C2PA':
      return { kind: 'c2pa', label: 'C2PA · Content Credentials', action: 'remove' }
    default:
      return { kind: 'other', label: `${chunk.fourCC.trim() || 'Unknown'} · Unknown chunk`, action: 'remove' }
  }
}

function analyzeWebp(bytes: Uint8Array): WebpAnalysis {
  const { chunks, riffEnd } = parseWebp(bytes)
  const classified = new Map<WebpChunk, Omit<ContainerBlock, 'offset' | 'length'>>()
  const blocks: ContainerBlock[] = []
  let orientation: number | undefined

  for (const chunk of chunks) {
    const block = classifyChunk(chunk)
    if (!block) continue
    classified.set(chunk, block)
    blocks.push({ ...block, offset: chunk.start, length: chunk.end - chunk.start })
    if (block.kind === 'exif' && orientation === undefined) {
      orientation = readTiffOrientation(tiffFromExifPayload(bytes.subarray(chunk.dataStart, chunk.dataEnd)))
    }
  }
  if (riffEnd < bytes.length) {
    blocks.push({
      kind: 'trailer',
      label: 'Data after end of image',
      action: 'remove',
      offset: riffEnd,
      length: bytes.length - riffEnd,
    })
  }

  return {
    chunks,
    classified,
    inventory: { format: 'webp', ...readDimensions(bytes, chunks), blocks, orientation },
  }
}

export function inspectWebp(bytes: Uint8Array): ContainerInventory {
  return analyzeWebp(bytes).inventory
}

export function buildWebpChunk(fourCC: string, data: Uint8Array): Uint8Array {
  const parts = [asciiBytes(fourCC), uint32LE(data.length), data]
  if (data.length % 2 === 1) parts.push(new Uint8Array(1))
  return concatBytes(parts)
}

/** Removes EXIF, XMP, C2PA and unknown chunks and updates the VP8X feature flags. */
export function stripWebp(bytes: Uint8Array): StripResult {
  const { chunks, classified, inventory } = analyzeWebp(bytes)
  const preserveOrientation = needsOrientation(inventory.orientation)
  const body: Uint8Array[] = []
  let orientationWritten = false
  let vp8xHeader: Uint8Array | undefined

  for (const chunk of chunks) {
    const block = classified.get(chunk)
    if (block?.action === 'remove') {
      if (block.kind === 'exif' && preserveOrientation && !orientationWritten) {
        body.push(buildWebpChunk('EXIF', buildOrientationTiff(inventory.orientation as number)))
        orientationWritten = true
      }
      continue
    }
    if (chunk.fourCC === 'VP8X') {
      vp8xHeader = bytes.slice(chunk.start, chunk.end)
      body.push(vp8xHeader)
      continue
    }
    body.push(bytes.subarray(chunk.start, chunk.end))
    // A final odd-sized chunk may be missing its padding byte; restore it.
    if ((chunk.end - chunk.start) % 2 === 1) body.push(new Uint8Array(1))
  }

  if (vp8xHeader) {
    const flags = vp8xHeader[8] ?? 0
    const cleared = flags & ~(VP8X_FLAG_EXIF | VP8X_FLAG_XMP)
    vp8xHeader[8] = orientationWritten ? cleared | VP8X_FLAG_EXIF : cleared
  }

  const payload = concatBytes(body)
  const header = concatBytes([asciiBytes('RIFF'), uint32LE(payload.length + 4), asciiBytes('WEBP')])

  return {
    bytes: concatBytes([header, payload]),
    removed: inventory.blocks.filter((block) => block.action === 'remove'),
    kept: inventory.blocks.filter((block) => block.action === 'keep'),
    orientationPreserved: orientationWritten,
  }
}
