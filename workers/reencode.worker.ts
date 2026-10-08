/**
 * Re-encodes an image off the main thread so large photos don't freeze the page.
 * Runs entirely inside the browser; nothing is sent over the network.
 */

interface ReencodeRequest {
  blob: Blob
  mimeType: string
  quality: number
}

interface ReencodeResponse {
  ok: boolean
  blob?: Blob
}

/** The subset of DedicatedWorkerGlobalScope used here (avoids mixing DOM and WebWorker libs). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<ReencodeRequest>) => void) | null
  postMessage(message: ReencodeResponse): void
}

const scope = self as unknown as WorkerScope

async function reencode({ blob, mimeType, quality }: ReencodeRequest): Promise<Blob> {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('2D context unavailable')
    context.drawImage(bitmap, 0, 0)
    return await canvas.convertToBlob({ type: mimeType, quality })
  } finally {
    bitmap.close()
  }
}

scope.onmessage = (event) => {
  reencode(event.data).then(
    (blob) => scope.postMessage({ ok: true, blob }),
    () => scope.postMessage({ ok: false }),
  )
}
