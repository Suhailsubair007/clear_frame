/**
 * Builds tiny synthetic test images with known metadata. No real photos are used:
 * the base images are 24×16 gradients and every metadata value is fictional.
 *
 * Deliberately self-contained (no imports from the app) so the fixtures
 * independently check the parsers under test.
 */

export const BASE_WIDTH = 24
export const BASE_HEIGHT = 16

const BASE64 = {
  jpeg: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAQABgDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAgE/8QAFxAAAwEAAAAAAAAAAAAAAAAAABdjof/EABYBAQEBAAAAAAAAAAAAAAAAAAACBv/EABcRAQADAAAAAAAAAAAAAAAAAAATFWH/2gAMAwEAAhEDEQA/ANawlgWEsK3WEsCwlhEDC1OJIWEsBW6wlgEBU4//2Q==',
  progressiveJpeg:
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wgARCAAQABgDAREAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAMH/8QAGAEBAAMBAAAAAAAAAAAAAAAAAAMEBQb/2gAMAwEAAhADEAAAAaw8qBrlnZA//8QAFRABAQAAAAAAAAAAAAAAAAAAABX/2gAIAQEAAQUCmJiYmJiY/8QAFREBAQAAAAAAAAAAAAAAAAAAABP/2gAIAQMBAT8Biiikkk//xAAVEQEBAAAAAAAAAAAAAAAAAAAAEv/aAAgBAgEBPwGUpSlL/8QAFRABAQAAAAAAAAAAAAAAAAAAADH/2gAIAQEABj8CiIiI/8QAFBABAAAAAAAAAAAAAAAAAAAAIP/aAAgBAQABPyFVVf/aAAwDAQACAAMAAAAQ/wCSf//EABYRAQEBAAAAAAAAAAAAAAAAAHEAIP/aAAgBAwEBPxAQhj//xAAUEQEAAAAAAAAAAAAAAAAAAAAg/9oACAECAQE/EEB//8QAFhAAAwAAAAAAAAAAAAAAAAAAABHw/9oACAEBAAE/ELRaLRaLRaP/2Q==',
  png: 'iVBORw0KGgoAAAANSUhEUgAAABgAAAAQEAYAAABctGPWAAAAUElEQVRIx2PU129tjYo6c5ZhiAIWnt/sC7i4BtoZFHmAbah7gH3h0PbAr9EkNNAeGI2BgfbAUM/EQz0JcQ+DJDTEPTAM6oHRTDzAHhjamRgAzUAeSxdNEusAAAAASUVORK5CYII=',
  webpLossy:
    'UklGRkwAAABXRUJQVlA4IEAAAAAQAwCdASoYABAAPm0skkWkIqGYBABABsSxAFh2EOtPOLAA/iaOXXa81dpc5Uq9oa/vS3zycLQMmM3S4WNXuMgA',
  webpLossless:
    'UklGRl4AAABXRUJQVlA4TFEAAAAvF8ADEH9AmG3kb3oK3fsgxIKJv2YM6z+8/TC3YZkoEXVEBxIBVWTbUEEFFVRQQQUVVFBBBRVUUEEFFfxthoj+5+fj5eHm4uRgZ2NlYWZiZCAA',
}

export const SAMPLE = {
  make: 'ExampleCam',
  model: 'ExampleCam X100',
  lens: 'Example 35mm F2',
  software: 'PhotoTool 2.1',
  dateTime: '2024:05:01 10:30:00',
  artist: 'Test Author',
  latitude: 37.7749,
  longitude: -122.4194,
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

export function concat(...parts: ArrayLike<number>[]): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0))
  let offset = 0
  for (const part of parts) {
    output.set(part, offset)
    offset += part.length
  }
  return output
}

export function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0) & 0xff)
}

const utf8 = (text: string) => new TextEncoder().encode(text)
const u16be = (value: number) => [(value >>> 8) & 0xff, value & 0xff]
const u32be = (value: number) => [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
const u32le = (value: number) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]
const u24le = (value: number) => [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff]

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) >>> 0
}

// ---------------------------------------------------------------------------
// TIFF / EXIF
// ---------------------------------------------------------------------------

type TiffValue =
  | { type: 'ascii'; value: string }
  | { type: 'short'; value: number }
  | { type: 'long'; value: number }
  | { type: 'rational'; value: Array<[number, number]> }
type TiffEntry = [tag: number, value: TiffValue]

const TIFF_TYPE_CODES = { ascii: 2, short: 3, long: 4, rational: 5 } as const

function encodeTiffValue(entry: TiffValue): { count: number; bytes: Uint8Array } {
  switch (entry.type) {
    case 'ascii':
      return { count: entry.value.length + 1, bytes: concat(ascii(entry.value), [0]) }
    case 'short':
      return { count: 1, bytes: Uint8Array.from(u16be(entry.value)) }
    case 'long':
      return { count: 1, bytes: Uint8Array.from(u32be(entry.value)) }
    case 'rational':
      return { count: entry.value.length, bytes: concat(...entry.value.flatMap(([n, d]) => [u32be(n), u32be(d)])) }
  }
}

function ifdSize(entries: TiffEntry[]): number {
  const data = entries.reduce((sum, [, value]) => {
    const { bytes } = encodeTiffValue(value)
    return sum + (bytes.length > 4 ? bytes.length + (bytes.length % 2) : 0)
  }, 0)
  return 2 + entries.length * 12 + 4 + data
}

function encodeIfd(entries: TiffEntry[], offset: number): Uint8Array {
  const sorted = [...entries].sort(([a], [b]) => a - b)
  const records: number[][] = []
  const data: Uint8Array[] = []
  let dataOffset = offset + 2 + sorted.length * 12 + 4

  for (const [tag, value] of sorted) {
    const { count, bytes } = encodeTiffValue(value)
    let field: number[]
    if (bytes.length <= 4) {
      field = [...bytes, 0, 0, 0, 0].slice(0, 4)
    } else {
      field = u32be(dataOffset)
      const padded = bytes.length % 2 ? concat(bytes, [0]) : bytes
      data.push(padded)
      dataOffset += padded.length
    }
    records.push([...u16be(tag), ...u16be(TIFF_TYPE_CODES[value.type]), ...u32be(count), ...field])
  }
  return concat(u16be(sorted.length), ...records, u32be(0), ...data)
}

/** Writes a big-endian TIFF structure with optional EXIF and GPS sub-IFDs. */
export function buildTiff(ifd0: TiffEntry[], exif?: TiffEntry[], gps?: TiffEntry[]): Uint8Array {
  const root: TiffEntry[] = [...ifd0]
  if (exif) root.push([0x8769, { type: 'long', value: 0 }])
  if (gps) root.push([0x8825, { type: 'long', value: 0 }])

  const exifOffset = 8 + ifdSize(root)
  const gpsOffset = exifOffset + (exif ? ifdSize(exif) : 0)
  for (const entry of root) {
    if (entry[0] === 0x8769) entry[1] = { type: 'long', value: exifOffset }
    if (entry[0] === 0x8825) entry[1] = { type: 'long', value: gpsOffset }
  }

  return concat(
    ascii('MM'),
    u16be(42),
    u32be(8),
    encodeIfd(root, 8),
    exif ? encodeIfd(exif, exifOffset) : [],
    gps ? encodeIfd(gps, gpsOffset) : [],
  )
}

function toDms(decimal: number): Array<[number, number]> {
  const absolute = Math.abs(decimal)
  const degrees = Math.floor(absolute)
  const minutesFloat = (absolute - degrees) * 60
  const minutes = Math.floor(minutesFloat)
  const seconds = Math.round((minutesFloat - minutes) * 60 * 100)
  return [
    [degrees, 1],
    [minutes, 1],
    [seconds, 100],
  ]
}

export interface ExifOptions {
  orientation?: number
  gps?: boolean
  software?: string
}

/** EXIF with camera, software, dates, author and (optionally) GPS. */
export function sampleExif({ orientation = 1, gps = true, software = SAMPLE.software }: ExifOptions = {}): Uint8Array {
  return buildTiff(
    [
      [0x010f, { type: 'ascii', value: SAMPLE.make }],
      [0x0110, { type: 'ascii', value: SAMPLE.model }],
      [0x0112, { type: 'short', value: orientation }],
      [0x0131, { type: 'ascii', value: software }],
      [0x0132, { type: 'ascii', value: SAMPLE.dateTime }],
      [0x013b, { type: 'ascii', value: SAMPLE.artist }],
    ],
    [
      [0x9003, { type: 'ascii', value: SAMPLE.dateTime }],
      [0xa434, { type: 'ascii', value: SAMPLE.lens }],
    ],
    gps
      ? [
          [0x0001, { type: 'ascii', value: SAMPLE.latitude >= 0 ? 'N' : 'S' }],
          [0x0002, { type: 'rational', value: toDms(SAMPLE.latitude) }],
          [0x0003, { type: 'ascii', value: SAMPLE.longitude >= 0 ? 'E' : 'W' }],
          [0x0004, { type: 'rational', value: toDms(SAMPLE.longitude) }],
        ]
      : undefined,
  )
}

export function sampleXmp({ ai = false }: { ai?: boolean } = {}): string {
  const sourceType = ai
    ? ' Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"'
    : ''
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
    xmp:CreatorTool="${ai ? 'Adobe Firefly' : SAMPLE.software}"
    xmp:CreateDate="2024-05-01T10:30:00"${sourceType}>
   <dc:creator><rdf:Seq><rdf:li>${SAMPLE.artist}</rdf:li></rdf:Seq></dc:creator>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`
}

function iptcDataset(dataset: number, value: string): Uint8Array {
  const bytes = utf8(value)
  return concat([0x1c, 0x02, dataset], u16be(bytes.length), bytes)
}

/** Photoshop IRB payload (APP13) holding IPTC by-line, caption and city. */
export function sampleIptcPayload(): Uint8Array {
  const iim = concat(
    iptcDataset(0x50, SAMPLE.artist),
    iptcDataset(0x78, 'A synthetic test caption'),
    iptcDataset(0x5a, 'Testville'),
  )
  const resource = concat(ascii('8BIM'), u16be(0x0404), [0, 0], u32be(iim.length), iim, iim.length % 2 ? [0] : [])
  return concat(ascii('Photoshop 3.0\0'), resource)
}

function box(type: string, content: Uint8Array): Uint8Array {
  return concat(u32be(8 + content.length), ascii(type), content)
}

/** A JUMBF superbox shaped like a C2PA manifest store (not cryptographically valid). */
export function sampleC2paJumbf(): Uint8Array {
  const c2paUuid = [0x63, 0x32, 0x70, 0x61, 0x00, 0x11, 0x00, 0x10, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71]
  const description = box('jumd', concat(c2paUuid, [0x03], ascii('c2pa\0')))
  const manifest = box(
    'json',
    utf8(
      '{"claim_generator":"ExampleAI/1.0","actions":[{"action":"c2pa.created","digitalSourceType":"http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"}]}',
    ),
  )
  return box('jumb', concat(description, manifest))
}

/** A minimal ICC v2 profile header with a single description tag. */
export function sampleIcc(): Uint8Array {
  const text = 'Test RGB'
  const desc = concat(
    ascii('desc'),
    u32be(0),
    u32be(text.length + 1),
    ascii(text),
    [0],
    new Uint8Array(4 + 4 + 2 + 1 + 67),
  )
  const tagTableSize = 4 + 12
  const total = 128 + tagTableSize + desc.length
  const header = concat(
    u32be(total),
    ascii('none'),
    u32be(0x02100000),
    ascii('mntr'),
    ascii('RGB '),
    ascii('XYZ '),
    new Uint8Array(12),
    ascii('acsp'),
    ascii('APPL'),
    new Uint8Array(4 + 4 + 4 + 8 + 4),
    u32be(0x0000f6d6),
    u32be(0x00010000),
    u32be(0x0000d32d),
    ascii('none'),
    new Uint8Array(16 + 28),
  )
  return concat(header, u32be(1), ascii('desc'), u32be(128 + tagTableSize), u32be(desc.length), desc)
}

// ---------------------------------------------------------------------------
// JPEG
// ---------------------------------------------------------------------------

export interface JpegOptions {
  progressive?: boolean
  exif?: Uint8Array
  xmp?: string
  iptc?: boolean
  icc?: boolean
  c2pa?: boolean
  comment?: string
  /** Bytes appended after the end-of-image marker. */
  trailer?: Uint8Array
}

function jpegSegment(marker: number, payload: Uint8Array): Uint8Array {
  return concat([0xff, marker], u16be(payload.length + 2), payload)
}

/** SOI + JFIF APP0 occupy the first 20 bytes of both base JPEGs. */
const JFIF_END = 20

export function buildJpeg(options: JpegOptions = {}): Uint8Array<ArrayBuffer> {
  const base = fromBase64(options.progressive ? BASE64.progressiveJpeg : BASE64.jpeg)
  const segments: Uint8Array[] = []
  if (options.exif) segments.push(jpegSegment(0xe1, concat(ascii('Exif\0\0'), options.exif)))
  if (options.xmp) segments.push(jpegSegment(0xe1, concat(ascii('http://ns.adobe.com/xap/1.0/\0'), utf8(options.xmp))))
  if (options.icc) segments.push(jpegSegment(0xe2, concat(ascii('ICC_PROFILE\0'), [1, 1], sampleIcc())))
  if (options.iptc) segments.push(jpegSegment(0xed, sampleIptcPayload()))
  if (options.c2pa) segments.push(jpegSegment(0xeb, concat(ascii('JP'), u16be(1), u32be(1), sampleC2paJumbf())))
  if (options.comment) segments.push(jpegSegment(0xfe, utf8(options.comment)))
  return concat(base.subarray(0, JFIF_END), ...segments, base.subarray(JFIF_END), options.trailer ?? [])
}

/** The JPEG's compressed scan data: everything from the first SOS onwards. */
export function jpegScanData(bytes: Uint8Array): Uint8Array {
  for (let index = 2; index < bytes.length - 1; index++) {
    if (bytes[index] === 0xff && bytes[index + 1] === 0xda) {
      const end = bytes.lastIndexOf(0xd9)
      return bytes.subarray(index, end + 1)
    }
  }
  throw new Error('No SOS marker')
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

export interface PngOptions {
  exif?: Uint8Array
  xmp?: string
  text?: Record<string, string>
  time?: boolean
  c2pa?: boolean
  trailer?: Uint8Array
}

export function pngChunk(type: string, data: ArrayLike<number>): Uint8Array {
  const body = concat(ascii(type), data)
  return concat(u32be(data.length), body, u32be(crc32(body)))
}

/** Signature (8) + IHDR chunk (25). */
const IHDR_END = 33

export function buildPng(options: PngOptions = {}): Uint8Array<ArrayBuffer> {
  const base = fromBase64(BASE64.png)
  const chunks: Uint8Array[] = []
  if (options.exif) chunks.push(pngChunk('eXIf', options.exif))
  for (const [keyword, value] of Object.entries(options.text ?? {})) {
    chunks.push(pngChunk('tEXt', concat(ascii(keyword), [0], ascii(value))))
  }
  if (options.xmp) {
    chunks.push(pngChunk('iTXt', concat(ascii('XML:com.adobe.xmp'), [0, 0, 0, 0, 0], utf8(options.xmp))))
  }
  if (options.time) chunks.push(pngChunk('tIME', [...u16be(2024), 5, 1, 10, 30, 0]))
  if (options.c2pa) chunks.push(pngChunk('caBX', sampleC2paJumbf()))
  return concat(base.subarray(0, IHDR_END), ...chunks, base.subarray(IHDR_END), options.trailer ?? [])
}

// ---------------------------------------------------------------------------
// WebP
// ---------------------------------------------------------------------------

export interface WebpOptions {
  lossless?: boolean
  exif?: Uint8Array
  xmp?: string
  icc?: boolean
  c2pa?: boolean
  unknownChunk?: boolean
  trailer?: Uint8Array
}

export function webpChunk(fourCC: string, data: ArrayLike<number>): Uint8Array {
  return concat(ascii(fourCC), u32le(data.length), data, data.length % 2 ? [0] : [])
}

export function buildWebp(options: WebpOptions = {}): Uint8Array<ArrayBuffer> {
  const base = fromBase64(options.lossless ? BASE64.webpLossless : BASE64.webpLossy)
  const imageChunk = base.subarray(12)
  const hasMetadata = Boolean(options.exif || options.xmp || options.icc || options.c2pa || options.unknownChunk)
  if (!hasMetadata) return concat(base, options.trailer ?? [])

  let flags = 0
  if (options.icc) flags |= 0x20
  if (options.lossless) flags |= 0x10
  if (options.exif) flags |= 0x08
  if (options.xmp) flags |= 0x04
  const chunks = [
    webpChunk('VP8X', concat([flags, 0, 0, 0], u24le(BASE_WIDTH - 1), u24le(BASE_HEIGHT - 1))),
    options.icc ? webpChunk('ICCP', sampleIcc()) : [],
    imageChunk,
    options.exif ? webpChunk('EXIF', options.exif) : [],
    options.xmp ? webpChunk('XMP ', utf8(options.xmp)) : [],
    options.c2pa ? webpChunk('C2PA', sampleC2paJumbf()) : [],
    options.unknownChunk ? webpChunk('TEST', ascii('private data')) : [],
  ]
  const body = concat(ascii('WEBP'), ...chunks)
  return concat(ascii('RIFF'), u32le(body.length), body, options.trailer ?? [])
}

/** A metadata-rich JPEG resembling a phone photo, used by e2e tests and the fixtures script. */
export function buildSamplePhoto(options: { orientation?: number } = {}): Uint8Array<ArrayBuffer> {
  return buildJpeg({
    exif: sampleExif({ orientation: options.orientation }),
    xmp: sampleXmp(),
    iptc: true,
    icc: true,
    comment: 'Synthetic test comment',
  })
}
