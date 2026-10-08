/** Image container formats ClearFrame can inspect and clean. */
export type ImageFormat = 'jpeg' | 'png' | 'webp'

/** Formats we can recognise but deliberately do not process. */
export type UnsupportedFormat = 'heic' | 'avif' | 'gif' | 'tiff' | 'bmp' | 'unknown'

export interface ImageDimensions {
  width: number
  height: number
}

/** An image the user selected, after validation. */
export interface SelectedImage {
  file: File
  name: string
  size: number
  format: ImageFormat
  mimeType: string
  /** Dimensions as displayed (EXIF orientation applied by the browser). */
  width: number
  height: number
  objectUrl: string
}

/**
 * `original` removes metadata losslessly (pixels untouched).
 * `balanced` / `smaller` re-encode the pixels at a chosen quality.
 */
export type QualityMode = 'original' | 'balanced' | 'smaller'

export interface QualityOption {
  mode: QualityMode
  label: string
  description: string
}
