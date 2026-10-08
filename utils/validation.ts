import type { ImageDimensions, ImageFormat } from '~/types/image'
import { ClearFrameError } from './errors'
import { getExtension } from './file'
import type { SniffResult } from './image'

export const MAX_FILE_SIZE = 50 * 1024 * 1024
export const MAX_PIXELS = 100_000_000
export const MAX_SIDE = 30_000

export const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'jpe', 'jfif', 'png', 'webp'] as const
export const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/pjpeg', 'image/png', 'image/webp'] as const
/** Value for `<input type="file" accept>`. */
export const ACCEPT_ATTRIBUTE = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'

const HEIC_EXTENSIONS = ['heic', 'heif']
const HEIC_MIME_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']
/** Some platforms report no type, or a generic one, for valid images. */
const GENERIC_MIME_TYPES = ['', 'application/octet-stream']

interface FileLike {
  name: string
  size: number
  type: string
}

/** Checks size, extension and declared MIME type before reading any bytes. */
export function validateFileBasics(file: FileLike): void {
  if (file.size === 0) throw new ClearFrameError('empty-file')
  if (file.size > MAX_FILE_SIZE) throw new ClearFrameError('too-large')

  const extension = getExtension(file.name)
  const mimeType = file.type.toLowerCase()
  if (HEIC_EXTENSIONS.includes(extension) || HEIC_MIME_TYPES.includes(mimeType)) {
    throw new ClearFrameError('heic-unsupported')
  }
  if (extension && !(ACCEPTED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new ClearFrameError('unsupported-type', `Extension .${extension} is not supported`)
  }
  if (!GENERIC_MIME_TYPES.includes(mimeType) && !(ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new ClearFrameError('unsupported-type', `MIME type ${mimeType} is not supported`)
  }
}

/** The file's actual bytes decide the format, whatever its name claims. */
export function validateSniffedFormat(sniff: SniffResult): ImageFormat {
  if (sniff.supported) return sniff.format
  throw new ClearFrameError(sniff.format === 'heic' ? 'heic-unsupported' : 'unsupported-type')
}

/** Rejects decompression bombs before the browser allocates pixel memory. Zero means unknown. */
export function validateDimensions({ width, height }: ImageDimensions): void {
  if (width > MAX_SIDE || height > MAX_SIDE || width * height > MAX_PIXELS) {
    throw new ClearFrameError('too-many-pixels')
  }
}
