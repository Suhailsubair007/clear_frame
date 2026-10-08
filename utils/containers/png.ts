import type { ContainerBlock, ContainerInventory, StripResult } from '~/types/metadata'
import { asciiBytes, concatBytes, crc32, readAscii, readUint32BE, uint32BE } from '../binary'
import { ClearFrameError } from '../errors'
import { buildOrientationTiff, needsOrientation, readTiffOrientation, tiffFromExifPayload } from '../exif'

export const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** Ancillary chunks needed to render the image faithfully (colour, transparency, animation). */
const RENDERING_CHUNKS = new Set([
  'tRNS',
  'cHRM',
  'gAMA',
  'iCCP',
  'sBIT',
  'sRGB',
  'cICP',
  'mDCV',
  'mDCv',
  'cLLI',
  'cLLi',
  'bKGD',
  'hIST',
  'pHYs',
  'sPLT',
  'acTL',
  'fcTL',
  'fdAT',
])

/** PNG text keywords commonly written by AI image generators. */
export const AI_TEXT_KEYWORDS = new Set([
  'parameters',
  'prompt',
  'workflow',
  'negative_prompt',
  'sd-metadata',
  'invokeai_metadata',
  'invokeai_graph',
  'dream',
  'generation_data',
  'ai_metadata',
])

interface PngChunk {
  type: string
  start: number
  dataStart: number
  dataEnd: number
  end: number
}

interface PngAnalysis {
  chunks: PngChunk[]
  trailerStart?: number
  classified: Map<PngChunk, Omit<ContainerBlock, 'offset' | 'length'>>
  inventory: ContainerInventory
}

function parsePng(bytes: Uint8Array): { chunks: PngChunk[]; trailerStart?: number } {
  for (let index = 0; index < PNG_SIGNATURE.length; index++) {
    if (bytes[index] !== PNG_SIGNATURE[index]) throw new ClearFrameError('corrupted', 'Missing PNG signature')
  }

  const chunks: PngChunk[] = []
  let position = PNG_SIGNATURE.length
  while (position + 12 <= bytes.length) {
    const length = readUint32BE(bytes, position)
    const type = readAscii(bytes, position + 4, 4)
    const dataStart = position + 8
    const dataEnd = dataStart + length
    const end = dataEnd + 4
    if (!/^[A-Za-z]{4}$/.test(type) || end > bytes.length) {
      throw new ClearFrameError('corrupted', `Invalid PNG chunk at ${position}`)
    }
    chunks.push({ type, start: position, dataStart, dataEnd, end })
    position = end
    if (type === 'IEND') {
      return { chunks, trailerStart: position < bytes.length ? position : undefined }
    }
  }
  if (!chunks.some((chunk) => chunk.type === 'IDAT')) {
    throw new ClearFrameError('corrupted', 'PNG has no image data')
  }
  return { chunks }
}

function readKeyword(bytes: Uint8Array, chunk: PngChunk): string {
  const nul = bytes.indexOf(0, chunk.dataStart)
  const end = nul === -1 || nul > chunk.dataEnd ? chunk.dataEnd : nul
  return readAscii(bytes, chunk.dataStart, Math.min(79, end - chunk.dataStart))
}

function classifyChunk(bytes: Uint8Array, chunk: PngChunk): Omit<ContainerBlock, 'offset' | 'length'> | undefined {
  const isCritical = chunk.type.charCodeAt(0) < 0x61 // Uppercase first letter
  if (isCritical) return undefined
  if (chunk.type === 'iCCP') return { kind: 'icc', label: 'iCCP · ICC colour profile', action: 'keep' }
  if (RENDERING_CHUNKS.has(chunk.type)) return undefined

  switch (chunk.type) {
    case 'eXIf':
      return { kind: 'exif', label: 'eXIf · EXIF', action: 'remove' }
    case 'tIME':
      return { kind: 'timestamp', label: 'tIME · Last modified time', action: 'remove' }
    case 'caBX':
      return { kind: 'c2pa', label: 'caBX · Content Credentials (C2PA)', action: 'remove' }
    case 'tEXt':
    case 'zTXt':
    case 'iTXt': {
      const keyword = readKeyword(bytes, chunk)
      if (keyword === 'XML:com.adobe.xmp') {
        return { kind: 'xmp', label: `${chunk.type} · XMP`, action: 'remove', keyword }
      }
      return { kind: 'text', label: `${chunk.type} · ${keyword || 'Text'}`, action: 'remove', keyword }
    }
    default:
      return { kind: 'other', label: `${chunk.type} · Private data`, action: 'remove' }
  }
}

function analyzePng(bytes: Uint8Array): PngAnalysis {
  const { chunks, trailerStart } = parsePng(bytes)
  const header = chunks[0]
  if (!header || header.type !== 'IHDR') throw new ClearFrameError('corrupted', 'PNG header chunk missing')

  const classified = new Map<PngChunk, Omit<ContainerBlock, 'offset' | 'length'>>()
  const blocks: ContainerBlock[] = []
  let orientation: number | undefined

  for (const chunk of chunks) {
    const block = classifyChunk(bytes, chunk)
    if (!block) continue
    classified.set(chunk, block)
    blocks.push({ ...block, offset: chunk.start, length: chunk.end - chunk.start })
    if (block.kind === 'exif' && orientation === undefined) {
      orientation = readTiffOrientation(tiffFromExifPayload(bytes.subarray(chunk.dataStart, chunk.dataEnd)))
    }
  }
  if (trailerStart !== undefined) {
    blocks.push({
      kind: 'trailer',
      label: 'Data after end of image',
      action: 'remove',
      offset: trailerStart,
      length: bytes.length - trailerStart,
    })
  }

  return {
    chunks,
    trailerStart,
    classified,
    inventory: {
      format: 'png',
      width: readUint32BE(bytes, header.dataStart),
      height: readUint32BE(bytes, header.dataStart + 4),
      blocks,
      orientation,
    },
  }
}

export function inspectPng(bytes: Uint8Array): ContainerInventory {
  return analyzePng(bytes).inventory
}

export function buildPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeAndData = concatBytes([asciiBytes(type), data])
  return concatBytes([uint32BE(data.length), typeAndData, uint32BE(crc32(typeAndData))])
}

/** Drops text, EXIF, time, C2PA and private chunks; image chunks are copied verbatim. */
export function stripPng(bytes: Uint8Array): StripResult {
  const { chunks, classified, inventory } = analyzePng(bytes)
  const preserveOrientation = needsOrientation(inventory.orientation)
  const output: Uint8Array[] = [PNG_SIGNATURE]
  let orientationWritten = false

  for (const chunk of chunks) {
    const block = classified.get(chunk)
    if (block?.action === 'remove') {
      if (block.kind === 'exif' && preserveOrientation && !orientationWritten) {
        output.push(buildPngChunk('eXIf', buildOrientationTiff(inventory.orientation as number)))
        orientationWritten = true
      }
      continue
    }
    output.push(bytes.subarray(chunk.start, chunk.end))
  }

  if (chunks.at(-1)?.type !== 'IEND') output.push(buildPngChunk('IEND', new Uint8Array(0)))

  return {
    bytes: concatBytes(output),
    removed: inventory.blocks.filter((block) => block.action === 'remove'),
    kept: inventory.blocks.filter((block) => block.action === 'keep'),
    orientationPreserved: orientationWritten,
  }
}
