import type { ImageFormat } from '~/types/image'
import { ClearFrameError } from '~/utils/errors'
import { buildCleanFileName } from '~/utils/file'

/** Download names handed out during this visit, so repeated cleans don't collide. */
const issuedNames = new Set<string>()

/** How long a download URL stays valid after the click (some browsers read it lazily). */
const REVOKE_DELAY_MS = 30_000

export function triggerDownload(url: string, fileName: string, doc: Document = document): void {
  const link = doc.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.hidden = true
  doc.body.appendChild(link)
  link.click()
  link.remove()
}

export function useFileDownload() {
  function reserveFileName(originalName: string, format: ImageFormat): string {
    const name = buildCleanFileName(originalName, format, issuedNames)
    issuedNames.add(name.toLowerCase())
    return name
  }

  /** Saves a Blob through the browser's own download flow. Nothing is uploaded. */
  function download(blob: Blob, fileName: string): void {
    let url: string | undefined
    try {
      url = URL.createObjectURL(blob)
      triggerDownload(url, fileName)
    } catch {
      throw new ClearFrameError('download-failed')
    } finally {
      if (url) {
        const createdUrl = url
        setTimeout(() => URL.revokeObjectURL(createdUrl), REVOKE_DELAY_MS)
      }
    }
  }

  /** True on touch devices whose share sheet accepts files (e.g. "Save Image" on iPhone). */
  function canShareFile(blob: Blob, fileName: string): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false
    if (!window.matchMedia('(pointer: coarse)').matches) return false
    try {
      return navigator.canShare({ files: [new File([blob], fileName, { type: blob.type })] })
    } catch {
      return false
    }
  }

  /** Opens the device share sheet. Resolves false when the user cancels. */
  async function share(blob: Blob, fileName: string): Promise<boolean> {
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: blob.type })] })
      return true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false
      throw new ClearFrameError('download-failed')
    }
  }

  return { reserveFileName, download, canShareFile, share }
}
