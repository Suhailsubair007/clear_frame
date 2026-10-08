import type { ImageDimensions, ImageFormat, QualityMode, QualityOption, UnsupportedFormat } from '~/types/image'
import { hasAsciiAt } from './binary'
import { ClearFrameError } from './errors'

export const FORMAT_MIME_TYPES: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export const FORMAT_LABELS: Record<ImageFormat, string> = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
}

/** Bytes needed to recognise any supported or explicitly unsupported format. */
export const SNIFF_LENGTH = 32

export type SniffResult = { supported: true; format: ImageFormat } | { supported: false; format: UnsupportedFormat }

const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']
const AVIF_BRANDS = ['avif', 'avis']

/** Identifies a file from its magic bytes rather than trusting its name or MIME type. */
export function sniffImageFormat(header: Uint8Array): SniffResult {
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return { supported: true, format: 'jpeg' }
  if (hasAsciiAt(header, 1, 'PNG\r\n\x1a\n') && header[0] === 0x89) return { supported: true, format: 'png' }
  if (hasAsciiAt(header, 0, 'RIFF') && hasAsciiAt(header, 8, 'WEBP')) return { supported: true, format: 'webp' }

  if (hasAsciiAt(header, 4, 'ftyp')) {
    if (AVIF_BRANDS.some((brand) => hasAsciiAt(header, 8, brand))) return { supported: false, format: 'avif' }
    if (HEIC_BRANDS.some((brand) => hasAsciiAt(header, 8, brand))) return { supported: false, format: 'heic' }
  }
  if (hasAsciiAt(header, 0, 'GIF8')) return { supported: false, format: 'gif' }
  if (hasAsciiAt(header, 0, 'II*\0') || hasAsciiAt(header, 0, 'MM\0*')) return { supported: false, format: 'tiff' }
  if (hasAsciiAt(header, 0, 'BM')) return { supported: false, format: 'bmp' }
  return { supported: false, format: 'unknown' }
}

export const QUALITY_OPTIONS: readonly QualityOption[] = [
  {
    mode: 'original',
    label: 'Original quality',
    description: 'Pixels stay exactly as they are. Only metadata is removed.',
  },
  {
    mode: 'balanced',
    label: 'Balanced',
    description: 'Re-saved at high quality (90%). Rotation is applied to the pixels.',
  },
  {
    mode: 'smaller',
    label: 'Smaller file',
    description: 'Re-saved at 75% quality for a lighter file. Some detail may soften.',
  },
]

export const REENCODE_QUALITY: Record<Exclude<QualityMode, 'original'>, number> = {
  balanced: 0.9,
  smaller: 0.75,
}

/** Desktop browsers comfortably handle canvases up to this size. */
export const MAX_REENCODE_PIXELS = 50_000_000
/** iOS/iPadOS Safari caps canvas area at 16,777,216 pixels. */
export const MAX_REENCODE_PIXELS_IOS = 16_777_216

function isAppleTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))
  )
}

export function getReencodePixelLimit(): number {
  return isAppleTouchDevice() ? MAX_REENCODE_PIXELS_IOS : MAX_REENCODE_PIXELS
}

const encoderSupport = new Map<string, Promise<boolean>>()

/** Checks whether this browser's canvas can encode a MIME type (Safari cannot encode WebP). */
export function canEncode(mimeType: string): Promise<boolean> {
  const cached = encoderSupport.get(mimeType)
  if (cached) return cached
  const check = new Promise<boolean>((resolve) => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      canvas.toBlob((blob) => resolve(blob?.type === mimeType), mimeType)
    } catch {
      resolve(false)
    }
  })
  encoderSupport.set(mimeType, check)
  return check
}

/** Decodes an image with the browser to confirm it is valid and read its displayed size. */
export async function decodeImage(url: string): Promise<ImageDimensions> {
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  try {
    await image.decode()
  } catch {
    throw new ClearFrameError('decode-failed', 'The browser could not decode the image')
  }
  if (!image.naturalWidth || !image.naturalHeight) throw new ClearFrameError('decode-failed', 'Image has no pixels')
  return { width: image.naturalWidth, height: image.naturalHeight }
}

interface ReencodeResponse {
  ok: boolean
  blob?: Blob
}

function reencodeInWorker(blob: Blob, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/reencode.worker.ts', import.meta.url), { type: 'module' })
    const finish = (result?: Blob) => {
      worker.terminate()
      if (result) resolve(result)
      else reject(new ClearFrameError('reencode-failed', 'Worker could not re-encode'))
    }
    worker.onmessage = (event: MessageEvent<ReencodeResponse>) => finish(event.data.ok ? event.data.blob : undefined)
    worker.onerror = () => finish()
    worker.postMessage({ blob, mimeType, quality })
  })
}

async function reencodeOnMainThread(blob: Blob, mimeType: string, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  const canvas = document.createElement('canvas')
  try {
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new ClearFrameError('reencode-failed', 'Canvas unavailable')
    context.drawImage(bitmap, 0, 0)
    const output = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality))
    if (!output) throw new ClearFrameError('reencode-failed', 'Canvas returned no data')
    return output
  } finally {
    bitmap.close()
    canvas.width = 0
    canvas.height = 0
  }
}

function supportsWorkerReencode(): boolean {
  return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
}

/**
 * Re-encodes pixels with the browser's encoder, preferably in a Web Worker.
 * EXIF orientation is applied to the pixels, so the output needs no orientation tag.
 */
export async function reencodeImage(blob: Blob, mimeType: string, quality: number): Promise<Blob> {
  let output: Blob | undefined
  if (supportsWorkerReencode()) {
    output = await reencodeInWorker(blob, mimeType, quality).catch(() => undefined)
  }
  output ??= await reencodeOnMainThread(blob, mimeType, quality).catch((error: unknown) => {
    throw error instanceof ClearFrameError ? error : new ClearFrameError('reencode-failed', String(error))
  })
  if (output.type !== mimeType) throw new ClearFrameError('reencode-failed', `Encoder produced ${output.type}`)
  return output
}
