import { afterEach, describe, expect, it, vi } from 'vitest'
import { triggerDownload, useFileDownload } from '~/composables/useFileDownload'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('triggerDownload', () => {
  it('clicks a temporary link with the download attribute and removes it', () => {
    const clicks: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this)
    })

    triggerDownload('blob:http://localhost/abc', 'IMG_1234-clean.jpg')

    expect(clicks).toHaveLength(1)
    expect(clicks[0]?.getAttribute('download')).toBe('IMG_1234-clean.jpg')
    expect(clicks[0]?.getAttribute('href')).toBe('blob:http://localhost/abc')
    expect(document.querySelectorAll('a[download]')).toHaveLength(0)
  })
})

describe('useFileDownload', () => {
  it('creates an object URL for the blob and revokes it later', () => {
    vi.useFakeTimers()
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    useFileDownload().download(blob, 'scan-clean.png')

    expect(create).toHaveBeenCalledWith(blob)
    expect(revoke).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:test')
  })

  it('reports download failures without technical detail', () => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('internal failure')
    })
    expect(() => useFileDownload().download(new Blob([]), 'x.png')).toThrow(
      expect.objectContaining({ code: 'download-failed' }),
    )
  })

  it('reserves unique file names across the session', () => {
    const { reserveFileName } = useFileDownload()
    expect(reserveFileName('beach.jpg', 'jpeg')).toBe('beach-clean.jpg')
    expect(reserveFileName('beach.jpg', 'jpeg')).toBe('beach-clean-2.jpg')
    expect(useFileDownload().reserveFileName('beach.jpg', 'jpeg')).toBe('beach-clean-3.jpg')
  })
})
