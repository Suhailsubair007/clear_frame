import { concatBytes, hasAsciiAt, readUint16BE, readUint16LE, readUint32BE, readUint32LE } from './binary'

const ORIENTATION_TAG = 0x0112
const TYPE_SHORT = 3

/** "Exif\0\0" header that precedes TIFF data in JPEG APP1 (and some WebP files). */
export const EXIF_HEADER = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00])

export function hasExifHeader(bytes: Uint8Array, offset = 0): boolean {
  return hasAsciiAt(bytes, offset, 'Exif\0')
}

/** Returns TIFF data, skipping an optional "Exif\0\0" prefix. */
export function tiffFromExifPayload(payload: Uint8Array): Uint8Array {
  return hasExifHeader(payload) ? payload.subarray(6) : payload
}

/** Reads the Orientation tag (1–8) from IFD0 of a TIFF/EXIF block. */
export function readTiffOrientation(tiff: Uint8Array): number | undefined {
  if (tiff.length < 8) return undefined
  const littleEndian = tiff[0] === 0x49 && tiff[1] === 0x49
  const bigEndian = tiff[0] === 0x4d && tiff[1] === 0x4d
  if (!littleEndian && !bigEndian) return undefined

  const read16 = littleEndian ? readUint16LE : readUint16BE
  const read32 = littleEndian ? readUint32LE : readUint32BE
  if (read16(tiff, 2) !== 42) return undefined

  const ifdOffset = read32(tiff, 4)
  if (ifdOffset + 2 > tiff.length) return undefined
  const entryCount = read16(tiff, ifdOffset)

  for (let index = 0; index < entryCount; index++) {
    const entry = ifdOffset + 2 + index * 12
    if (entry + 12 > tiff.length) return undefined
    if (read16(tiff, entry) !== ORIENTATION_TAG) continue
    if (read16(tiff, entry + 2) !== TYPE_SHORT) return undefined
    const value = read16(tiff, entry + 8)
    return value >= 1 && value <= 8 ? value : undefined
  }
  return undefined
}

/**
 * Builds the smallest valid TIFF structure containing only an Orientation tag.
 * It holds no personal information and keeps rotated photos upright.
 */
export function buildOrientationTiff(orientation: number): Uint8Array {
  // prettier-ignore
  return new Uint8Array([
    0x4d, 0x4d, 0x00, 0x2a, // "MM" big-endian, magic 42
    0x00, 0x00, 0x00, 0x08, // IFD0 at offset 8
    0x00, 0x01, // one entry
    0x01, 0x12, 0x00, 0x03, // tag 0x0112 (Orientation), type SHORT
    0x00, 0x00, 0x00, 0x01, // count 1
    0x00, orientation & 0xff, 0x00, 0x00, // value, padded
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ])
}

export function buildOrientationExifPayload(orientation: number): Uint8Array {
  return concatBytes([EXIF_HEADER, buildOrientationTiff(orientation)])
}

/** True when orientation requires rotation or mirroring to display correctly. */
export function needsOrientation(orientation: number | undefined): orientation is number {
  return orientation !== undefined && orientation >= 2 && orientation <= 8
}
