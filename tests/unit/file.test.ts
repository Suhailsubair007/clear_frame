import { describe, expect, it } from 'vitest'
import { buildCleanFileName, formatBytes, sanitizeFileBase, splitFileName } from '~/utils/file'

describe('buildCleanFileName', () => {
  it('appends -clean and keeps the extension', () => {
    expect(buildCleanFileName('IMG_1234.jpg', 'jpeg')).toBe('IMG_1234-clean.jpg')
    expect(buildCleanFileName('vacation.webp', 'webp')).toBe('vacation-clean.webp')
    expect(buildCleanFileName('Scan.PNG', 'png')).toBe('Scan-clean.PNG')
    expect(buildCleanFileName('photo.jpeg', 'jpeg')).toBe('photo-clean.jpeg')
  })

  it('uses the real format when the extension is wrong or missing', () => {
    expect(buildCleanFileName('actually-a-png.jpg', 'png')).toBe('actually-a-png-clean.png')
    expect(buildCleanFileName('image', 'jpeg')).toBe('image-clean.jpg')
  })

  it('never reuses a name produced earlier in the session', () => {
    const taken = new Set(['img_1234-clean.jpg', 'img_1234-clean-2.jpg'])
    expect(buildCleanFileName('IMG_1234.jpg', 'jpeg', taken)).toBe('IMG_1234-clean-3.jpg')
  })

  it('never returns the original name for files that were already cleaned', () => {
    expect(buildCleanFileName('IMG_1234-clean.jpg', 'jpeg')).toBe('IMG_1234-clean-2.jpg')
    expect(buildCleanFileName('IMG_1234-clean-2.jpg', 'jpeg')).toBe('IMG_1234-clean-3.jpg')
  })

  it('removes unsafe characters', () => {
    expect(buildCleanFileName('../../etc/pa<ss>wd?.png', 'png')).toBe('passwd-clean.png')
    expect(buildCleanFileName('<>:"|?*.jpg', 'jpeg')).toBe('image-clean.jpg')
  })
})

describe('splitFileName', () => {
  it('splits base and extension', () => {
    expect(splitFileName('a.b.c.jpg')).toEqual({ base: 'a.b.c', extension: 'jpg' })
    expect(splitFileName('.hidden')).toEqual({ base: '.hidden', extension: '' })
    expect(splitFileName('noext')).toEqual({ base: 'noext', extension: '' })
  })
})

describe('sanitizeFileBase', () => {
  it('limits length and falls back to "image"', () => {
    expect(sanitizeFileBase('x'.repeat(300))).toHaveLength(100)
    expect(sanitizeFileBase('   ')).toBe('image')
    expect(sanitizeFileBase('tab\there')).toBe('tabhere')
  })
})

describe('formatBytes', () => {
  it('formats sizes for people', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(150 * 1024 * 1024)).toBe('150 MB')
  })
})
