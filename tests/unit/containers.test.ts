import { describe, expect, it } from 'vitest'
import { inspectContainer, stripMetadata } from '~/utils/containers'
import { ClearFrameError } from '~/utils/errors'
import { readTiffOrientation } from '~/utils/exif'
import {
  ascii,
  BASE_HEIGHT,
  BASE_WIDTH,
  buildJpeg,
  buildPng,
  buildWebp,
  concat,
  crc32,
  fromBase64,
  jpegScanData,
  sampleExif,
  sampleXmp,
} from '../helpers/fixtures'

const kinds = (blocks: { kind: string }[]) => blocks.map((block) => block.kind).sort()

function readPngChunks(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: { type: string; data: Uint8Array; crcValid: boolean }[] = []
  let offset = 8
  while (offset < bytes.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    const crc = view.getUint32(offset + 8 + length)
    chunks.push({ type, data, crcValid: crc === crc32(bytes.subarray(offset + 4, offset + 8 + length)) })
    offset += 12 + length
  }
  return chunks
}

function readWebpChunks(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const chunks: { fourCC: string; data: Uint8Array }[] = []
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const size = view.getUint32(offset + 4, true)
    chunks.push({
      fourCC: String.fromCharCode(...bytes.subarray(offset, offset + 4)),
      data: bytes.subarray(offset + 8, offset + 8 + size),
    })
    offset += 8 + size + (size % 2)
  }
  return chunks
}

describe('JPEG', () => {
  const photo = buildJpeg({
    exif: sampleExif(),
    xmp: sampleXmp(),
    iptc: true,
    icc: true,
    c2pa: true,
    comment: 'hello',
    trailer: ascii('MOTION-PHOTO-VIDEO-DATA'),
  })

  it('inventories every metadata segment and reads dimensions', () => {
    const inventory = inspectContainer(photo, 'jpeg')
    expect(inventory.width).toBe(BASE_WIDTH)
    expect(inventory.height).toBe(BASE_HEIGHT)
    expect(kinds(inventory.blocks)).toEqual(['c2pa', 'comment', 'exif', 'icc', 'iptc', 'trailer', 'xmp'])
    expect(inventory.blocks.find((block) => block.kind === 'icc')?.action).toBe('keep')
  })

  it('removes metadata and keeps the compressed image data byte-for-byte', () => {
    const result = stripMetadata(photo, 'jpeg')
    expect(kinds(result.removed)).toEqual(['c2pa', 'comment', 'exif', 'iptc', 'trailer', 'xmp'])
    expect(kinds(result.kept)).toEqual(['icc'])
    expect(result.orientationPreserved).toBe(false)

    expect(jpegScanData(result.bytes)).toEqual(jpegScanData(photo))
    const after = inspectContainer(result.bytes, 'jpeg')
    expect(kinds(after.blocks)).toEqual(['icc'])
    expect(result.bytes.at(-2)).toBe(0xff)
    expect(result.bytes.at(-1)).toBe(0xd9)
  })

  it('handles progressive JPEGs with multiple scans', () => {
    const progressive = buildJpeg({ progressive: true, exif: sampleExif(), comment: 'x' })
    const result = stripMetadata(progressive, 'jpeg')
    expect(inspectContainer(result.bytes, 'jpeg').blocks).toEqual([])
    expect(jpegScanData(result.bytes)).toEqual(jpegScanData(progressive))
  })

  it('keeps only an orientation tag when the photo is rotated', () => {
    const rotated = buildJpeg({ exif: sampleExif({ orientation: 6 }) })
    expect(inspectContainer(rotated, 'jpeg').orientation).toBe(6)

    const result = stripMetadata(rotated, 'jpeg')
    expect(result.orientationPreserved).toBe(true)
    const after = inspectContainer(result.bytes, 'jpeg')
    expect(after.orientation).toBe(6)
    const exifBlock = after.blocks.find((block) => block.kind === 'exif')
    expect(exifBlock?.length).toBeLessThan(40)
    const text = String.fromCharCode(...result.bytes)
    expect(text).not.toContain('ExampleCam')
  })

  it('is idempotent', () => {
    const once = stripMetadata(photo, 'jpeg').bytes
    expect(stripMetadata(once, 'jpeg').bytes).toEqual(once)
  })

  it('rejects data that is not a JPEG', () => {
    expect(() => inspectContainer(ascii('not a jpeg at all'), 'jpeg')).toThrow(ClearFrameError)
  })

  it('rejects segments with impossible lengths', () => {
    const broken = concat(photo.subarray(0, 20), [0xff, 0xe1, 0xff, 0xff, 0x00])
    expect(() => stripMetadata(broken, 'jpeg')).toThrow(ClearFrameError)
  })
})

describe('PNG', () => {
  const image = buildPng({
    exif: sampleExif(),
    xmp: sampleXmp(),
    text: { parameters: 'a prompt, steps: 20', Software: 'PhotoTool', Author: 'Test Author' },
    time: true,
    c2pa: true,
    trailer: ascii('extra'),
  })

  it('classifies text, XMP, EXIF, time and C2PA chunks', () => {
    const inventory = inspectContainer(image, 'png')
    expect(inventory.width).toBe(BASE_WIDTH)
    expect(inventory.height).toBe(BASE_HEIGHT)
    expect(kinds(inventory.blocks)).toEqual(['c2pa', 'exif', 'text', 'text', 'text', 'timestamp', 'trailer', 'xmp'])
    expect(inventory.blocks.filter((block) => block.kind === 'text').map((block) => block.keyword)).toEqual([
      'parameters',
      'Software',
      'Author',
    ])
  })

  it('keeps image chunks identical with valid CRCs', () => {
    const result = stripMetadata(image, 'png')
    const before = readPngChunks(buildPng())
    const after = readPngChunks(result.bytes)
    expect(after.map((chunk) => chunk.type)).toEqual(before.map((chunk) => chunk.type))
    expect(after.every((chunk) => chunk.crcValid)).toBe(true)
    expect(after.find((chunk) => chunk.type === 'IDAT')?.data).toEqual(
      before.find((chunk) => chunk.type === 'IDAT')?.data,
    )
    expect(inspectContainer(result.bytes, 'png').blocks).toEqual([])
  })

  it('writes an orientation-only eXIf chunk for rotated images', () => {
    const result = stripMetadata(buildPng({ exif: sampleExif({ orientation: 8 }) }), 'png')
    const exif = readPngChunks(result.bytes).find((chunk) => chunk.type === 'eXIf')
    expect(exif?.crcValid).toBe(true)
    expect(readTiffOrientation(exif?.data ?? new Uint8Array())).toBe(8)
  })

  it('rejects a bad signature', () => {
    expect(() => inspectContainer(ascii('PNG?'), 'png')).toThrow(ClearFrameError)
  })
})

describe('WebP', () => {
  it('reads dimensions from simple lossy and lossless files', () => {
    for (const lossless of [false, true]) {
      const inventory = inspectContainer(buildWebp({ lossless }), 'webp')
      expect([inventory.width, inventory.height]).toEqual([BASE_WIDTH, BASE_HEIGHT])
      expect(inventory.blocks).toEqual([])
    }
  })

  it('removes EXIF, XMP, C2PA and unknown chunks and clears VP8X flags', () => {
    const image = buildWebp({ exif: sampleExif(), xmp: sampleXmp(), icc: true, c2pa: true, unknownChunk: true })
    expect(kinds(inspectContainer(image, 'webp').blocks)).toEqual(['c2pa', 'exif', 'icc', 'other', 'xmp'])

    const result = stripMetadata(image, 'webp')
    const chunks = readWebpChunks(result.bytes)
    expect(chunks.map((chunk) => chunk.fourCC)).toEqual(['VP8X', 'ICCP', 'VP8 '])
    const flags = chunks[0]?.data[0] ?? 0
    expect(flags & 0x08).toBe(0)
    expect(flags & 0x04).toBe(0)
    expect(flags & 0x20).toBe(0x20)

    const riffSize = new DataView(result.bytes.buffer).getUint32(4, true)
    expect(riffSize).toBe(result.bytes.length - 8)
    expect(readWebpChunks(image).find((chunk) => chunk.fourCC === 'VP8 ')?.data).toEqual(chunks[2]?.data)
  })

  it('preserves orientation with the EXIF flag set', () => {
    const result = stripMetadata(buildWebp({ lossless: true, exif: sampleExif({ orientation: 3 }) }), 'webp')
    const chunks = readWebpChunks(result.bytes)
    expect((chunks[0]?.data[0] ?? 0) & 0x08).toBe(0x08)
    expect(readTiffOrientation(chunks.find((chunk) => chunk.fourCC === 'EXIF')?.data ?? new Uint8Array())).toBe(3)
  })

  it('drops data after the RIFF container', () => {
    const result = stripMetadata(buildWebp({ trailer: ascii('trailing') }), 'webp')
    expect(result.bytes).toEqual(buildWebp())
  })

  it('rejects truncated files', () => {
    const image = buildWebp({ exif: sampleExif() })
    expect(() => inspectContainer(image.subarray(0, 40), 'webp')).toThrow(ClearFrameError)
    expect(() => inspectContainer(fromBase64('UklGRgQAAABXRUJQ'), 'webp')).toThrow(ClearFrameError)
  })
})
