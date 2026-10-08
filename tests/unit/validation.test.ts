import { describe, expect, it } from 'vitest'
import { ClearFrameError, toUserFacingError } from '~/utils/errors'
import { sniffImageFormat } from '~/utils/image'
import { MAX_FILE_SIZE, validateDimensions, validateFileBasics, validateSniffedFormat } from '~/utils/validation'
import { ascii, buildJpeg, buildPng, buildWebp, concat } from '../helpers/fixtures'

function errorCode(action: () => unknown): string | undefined {
  try {
    action()
  } catch (error) {
    return error instanceof ClearFrameError ? error.code : 'unexpected'
  }
  return undefined
}

describe('validateFileBasics', () => {
  it('accepts supported images', () => {
    for (const [name, type] of [
      ['IMG_1234.JPG', 'image/jpeg'],
      ['photo.jpeg', 'image/jpeg'],
      ['scan.png', 'image/png'],
      ['vacation.webp', 'image/webp'],
      ['camera-roll', ''],
      ['android.jpg', 'application/octet-stream'],
    ]) {
      expect(errorCode(() => validateFileBasics({ name: name as string, type: type as string, size: 1000 }))).toBe(
        undefined,
      )
    }
  })

  it('rejects empty and oversized files', () => {
    expect(errorCode(() => validateFileBasics({ name: 'a.jpg', type: 'image/jpeg', size: 0 }))).toBe('empty-file')
    expect(errorCode(() => validateFileBasics({ name: 'a.jpg', type: 'image/jpeg', size: MAX_FILE_SIZE + 1 }))).toBe(
      'too-large',
    )
  })

  it('rejects unsupported extensions and MIME types', () => {
    expect(errorCode(() => validateFileBasics({ name: 'doc.pdf', type: 'application/pdf', size: 10 }))).toBe(
      'unsupported-type',
    )
    expect(errorCode(() => validateFileBasics({ name: 'clip.gif', type: 'image/gif', size: 10 }))).toBe(
      'unsupported-type',
    )
    expect(errorCode(() => validateFileBasics({ name: 'image.jpg', type: 'text/html', size: 10 }))).toBe(
      'unsupported-type',
    )
  })

  it('explains HEIC separately', () => {
    expect(errorCode(() => validateFileBasics({ name: 'IMG_0001.HEIC', type: 'image/heic', size: 10 }))).toBe(
      'heic-unsupported',
    )
  })
})

describe('sniffImageFormat', () => {
  it('identifies formats by content, not by name', () => {
    expect(sniffImageFormat(buildJpeg())).toEqual({ supported: true, format: 'jpeg' })
    expect(sniffImageFormat(buildPng())).toEqual({ supported: true, format: 'png' })
    expect(sniffImageFormat(buildWebp())).toEqual({ supported: true, format: 'webp' })
  })

  it('recognises unsupported formats', () => {
    const heic = concat([0, 0, 0, 24], ascii('ftypheic'), new Uint8Array(12))
    expect(sniffImageFormat(heic)).toEqual({ supported: false, format: 'heic' })
    expect(sniffImageFormat(concat([0, 0, 0, 24], ascii('ftypavif')))).toEqual({ supported: false, format: 'avif' })
    expect(sniffImageFormat(ascii('GIF89a'))).toEqual({ supported: false, format: 'gif' })
    expect(sniffImageFormat(ascii('<script>alert(1)</script>'))).toEqual({ supported: false, format: 'unknown' })
  })

  it('maps unsupported content to friendly errors', () => {
    expect(errorCode(() => validateSniffedFormat({ supported: false, format: 'heic' }))).toBe('heic-unsupported')
    expect(errorCode(() => validateSniffedFormat({ supported: false, format: 'unknown' }))).toBe('unsupported-type')
    expect(validateSniffedFormat({ supported: true, format: 'png' })).toBe('png')
  })
})

describe('validateDimensions', () => {
  it('allows normal photos and unknown sizes', () => {
    expect(errorCode(() => validateDimensions({ width: 8064, height: 6048 }))).toBe(undefined)
    expect(errorCode(() => validateDimensions({ width: 0, height: 0 }))).toBe(undefined)
  })

  it('rejects decompression bombs', () => {
    expect(errorCode(() => validateDimensions({ width: 40_000, height: 10 }))).toBe('too-many-pixels')
    expect(errorCode(() => validateDimensions({ width: 12_000, height: 12_000 }))).toBe('too-many-pixels')
  })
})

describe('toUserFacingError', () => {
  it('returns friendly copy and never exposes the original message', () => {
    const friendly = toUserFacingError(new Error('TypeError at line 42: stack trace'), 'corrupted')
    expect(friendly.title).toBe("We couldn't process this image.")
    expect(JSON.stringify(friendly)).not.toContain('line 42')
  })

  it('recognises memory errors', () => {
    expect(toUserFacingError(new RangeError('Array buffer allocation failed'), 'corrupted').code).toBe('out-of-memory')
  })
})
