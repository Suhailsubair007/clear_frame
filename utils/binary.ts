/** Low-level helpers for reading and writing binary image data. */

export function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0)
}

export function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)
}

export function readUint24LE(bytes: Uint8Array, offset: number): number {
  return readUint16LE(bytes, offset) | ((bytes[offset + 2] ?? 0) << 16)
}

export function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  )
}

export function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
      ((bytes[offset + 1] ?? 0) << 8) |
      ((bytes[offset + 2] ?? 0) << 16) |
      ((bytes[offset + 3] ?? 0) << 24)) >>>
    0
  )
}

export function uint16BE(value: number): Uint8Array {
  return new Uint8Array([(value >>> 8) & 0xff, value & 0xff])
}

export function uint32BE(value: number): Uint8Array {
  return new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff])
}

export function uint32LE(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff])
}

/** Reads `length` bytes as Latin-1 text (safe for ASCII identifiers). */
export function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let text = ''
  const end = Math.min(bytes.length, offset + length)
  for (let index = offset; index < end; index++) {
    text += String.fromCharCode(bytes[index] ?? 0)
  }
  return text
}

export function hasAsciiAt(bytes: Uint8Array, offset: number, ascii: string): boolean {
  if (offset < 0 || offset + ascii.length > bytes.length) return false
  for (let index = 0; index < ascii.length; index++) {
    if (bytes[offset + index] !== ascii.charCodeAt(index)) return false
  }
  return true
}

export function asciiBytes(ascii: string): Uint8Array {
  const bytes = new Uint8Array(ascii.length)
  for (let index = 0; index < ascii.length; index++) bytes[index] = ascii.charCodeAt(index) & 0xff
  return bytes
}

/** Finds an ASCII needle inside a byte range. Returns -1 when absent. */
export function indexOfAscii(bytes: Uint8Array, needle: string, start = 0, end = bytes.length): number {
  const first = needle.charCodeAt(0)
  const limit = Math.min(end, bytes.length) - needle.length
  let index = bytes.indexOf(first, start)
  while (index !== -1 && index <= limit) {
    if (hasAsciiAt(bytes, index, needle)) return index
    index = bytes.indexOf(first, index + 1)
  }
  return -1
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const output = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

let crcTable: Uint32Array | undefined

function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable
  crcTable = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c >>> 0
  }
  return crcTable
}

/** CRC-32 as used by PNG chunks. */
export function crc32(bytes: Uint8Array): number {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index++) {
    crc = (table[(crc ^ (bytes[index] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}
