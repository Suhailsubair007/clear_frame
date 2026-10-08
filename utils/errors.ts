export type ClearFrameErrorCode =
  | 'empty-file'
  | 'too-large'
  | 'unsupported-type'
  | 'heic-unsupported'
  | 'too-many-pixels'
  | 'corrupted'
  | 'decode-failed'
  | 'read-failed'
  | 'out-of-memory'
  | 'clean-failed'
  | 'reencode-failed'
  | 'verification-failed'
  | 'download-failed'

export interface UserFacingError {
  code: ClearFrameErrorCode
  title: string
  description: string
}

/** An expected, user-explainable failure. Never shown with a stack trace. */
export class ClearFrameError extends Error {
  readonly code: ClearFrameErrorCode

  constructor(code: ClearFrameErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'ClearFrameError'
    this.code = code
  }
}

const GENERIC_IMAGE_PROBLEM = "The file may be corrupted or use a format that ClearFrame doesn't currently support."

const ERROR_COPY: Record<ClearFrameErrorCode, Omit<UserFacingError, 'code'>> = {
  'empty-file': {
    title: 'This file is empty.',
    description: 'Choose a JPG, PNG or WebP image that contains a picture.',
  },
  'too-large': {
    title: 'This image is too large.',
    description: 'ClearFrame accepts images up to 50 MB so your browser stays responsive.',
  },
  'unsupported-type': {
    title: "This file type isn't supported.",
    description: 'ClearFrame works with JPG, PNG and WebP images.',
  },
  'heic-unsupported': {
    title: "HEIC photos aren't supported yet.",
    description:
      'Export the photo as JPG first. On iPhone, picking the photo through your browser usually converts it to JPG automatically.',
  },
  'too-many-pixels': {
    title: 'This image has too many pixels.',
    description: 'Images larger than 100 megapixels (or 30,000 pixels on a side) could exhaust your browser’s memory.',
  },
  corrupted: {
    title: "We couldn't process this image.",
    description: GENERIC_IMAGE_PROBLEM,
  },
  'decode-failed': {
    title: "We couldn't process this image.",
    description: GENERIC_IMAGE_PROBLEM,
  },
  'read-failed': {
    title: "We couldn't read this file.",
    description: 'Your browser could not open the file. Try selecting it again.',
  },
  'out-of-memory': {
    title: 'Your browser ran out of memory.',
    description: 'Close other tabs or try a smaller image, then try again.',
  },
  'clean-failed': {
    title: "We couldn't clean this image.",
    description: GENERIC_IMAGE_PROBLEM,
  },
  'reencode-failed': {
    title: "We couldn't re-save this image at the selected quality.",
    description:
      'Your browser could not re-encode an image of this size. Choose “Original quality” to remove metadata without re-encoding.',
  },
  'verification-failed': {
    title: "We couldn't verify the cleaned image.",
    description:
      'The cleaned file did not open correctly, so ClearFrame did not offer it for download. Try again or try another image.',
  },
  'download-failed': {
    title: "The download didn't start.",
    description: 'Try again. If it keeps failing, check that your browser allows downloads from this site.',
  },
}

function isOutOfMemory(error: unknown): boolean {
  if (error instanceof RangeError) return true
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('out of memory') || message.includes('allocation failed')
}

/** Maps any thrown value to friendly copy. Unknown errors use `fallback`. */
export function toUserFacingError(error: unknown, fallback: ClearFrameErrorCode): UserFacingError {
  let code = fallback
  if (error instanceof ClearFrameError) code = error.code
  else if (isOutOfMemory(error)) code = 'out-of-memory'
  return { code, ...ERROR_COPY[code] }
}
