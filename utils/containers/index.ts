import type { ImageFormat } from '~/types/image'
import type { ContainerInventory, StripResult } from '~/types/metadata'
import { inspectJpeg, stripJpeg } from './jpeg'
import { inspectPng, stripPng } from './png'
import { inspectWebp, stripWebp } from './webp'

/** Lists every metadata structure in the file without decoding pixels. */
export function inspectContainer(bytes: Uint8Array, format: ImageFormat): ContainerInventory {
  switch (format) {
    case 'jpeg':
      return inspectJpeg(bytes)
    case 'png':
      return inspectPng(bytes)
    case 'webp':
      return inspectWebp(bytes)
  }
}

/** Losslessly removes supported metadata. Image data is copied byte-for-byte. */
export function stripMetadata(bytes: Uint8Array, format: ImageFormat): StripResult {
  switch (format) {
    case 'jpeg':
      return stripJpeg(bytes)
    case 'png':
      return stripPng(bytes)
    case 'webp':
      return stripWebp(bytes)
  }
}
