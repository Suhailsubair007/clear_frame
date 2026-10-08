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

describe('sharing', () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports no support when the browser cannot share files', () => {
    vi.stubGlobal('navigator', {})
    expect(useFileDownload().canShareFile(blob, 'a-clean.jpg')).toBe(false)
  })

  it('checks support with the real file', () => {
    const canShare = vi.fn(() => true)
    vi.stubGlobal('navigator', { canShare })
    expect(useFileDownload().canShareFile(blob, 'a-clean.jpg')).toBe(true)
    const [{ files }] = canShare.mock.calls[0] as unknown as [{ files: File[] }]
    expect(files[0]?.name).toBe('a-clean.jpg')
  })

  it('shares only the cleaned image file, with its name and type', async () => {
    const shareSpy = vi.fn(async (_data: ShareData) => {})
    vi.stubGlobal('navigator', { share: shareSpy })

    await expect(useFileDownload().share(blob, 'IMG_1234-clean.jpg')).resolves.toBe(true)
    const data = shareSpy.mock.calls[0]?.[0]
    expect(Object.keys(data ?? {})).toEqual(['files'])
    expect(data?.files?.[0]).toMatchObject({ name: 'IMG_1234-clean.jpg', type: 'image/jpeg', size: 3 })
  })

  it('treats a cancelled share sheet as a normal outcome', async () => {
    vi.stubGlobal('navigator', {
      share: async () => {
        throw new DOMException('Share canceled', 'AbortError')
      },
    })
    await expect(useFileDownload().share(blob, 'a-clean.jpg')).resolves.toBe(false)
  })

  it('reports real share failures without technical detail', async () => {
    vi.stubGlobal('navigator', {
      share: async () => {
        throw new DOMException('Permission denied', 'NotAllowedError')
      },
    })
    await expect(useFileDownload().share(blob, 'a-clean.jpg')).rejects.toMatchObject({ code: 'download-failed' })
  })
})
