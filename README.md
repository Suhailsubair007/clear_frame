# ClearFrame

> Your photos. Your privacy.

ClearFrame is a privacy-first image metadata cleaner. It shows what is hidden inside a photo — location, camera, dates, software, AI/provenance data — removes it, verifies the result, and hands back a clean copy. Everything happens in your browser. **Your photos never leave your device.**

## Overview

- No uploads, no backend API, no database, no accounts, no analytics.
- Metadata is removed **losslessly** by default: the compressed image data is copied byte-for-byte, so quality is unchanged.
- Every cleaned file is re-read and decoded before it is offered for download, and the before/after comparison comes from that real re-analysis.

## Features

- Drag-and-drop (anywhere on the page) or file picker; keyboard and screen-reader accessible.
- Preview with file name, size, format and dimensions.
- Plain-language metadata summary plus an expandable **View details** panel.
- Detection of AI/provenance signals: C2PA / Content Credentials manifests, IPTC Digital Source Type, AI generation settings in PNG text chunks, and AI tool names.
- Optional re-encoding (**Balanced** / **Smaller file**) for JPEG and WebP when the browser can do it reliably.
- Before/after comparison, file sizes, removed and kept counts.
- Download, or **Share / Save to Photos** on touch devices that support the Web Share API.
- Light and dark themes, reduced-motion support, mobile-first layout with a sticky action bar.

## How it works

1. **Validate.** Size limit (50 MB), extension and MIME type checks, then the file's _magic bytes_ decide the real format. Dimensions are read from the header and capped (100 MP, 30,000 px per side) before anything is decoded.
2. **Inspect.** A small container parser walks the JPEG segments, PNG chunks or WebP RIFF chunks and lists every metadata block. [ExifReader](https://github.com/mattiasw/ExifReader), loaded on demand, reads the individual fields.
3. **Clean.** The parser rebuilds the file without the metadata blocks. Pixels are never decoded or re-compressed in _Original quality_ mode.
4. **Verify.** The output is parsed again and decoded by the browser; its displayed dimensions must match the original's.
5. **Download.** The cleaned `Blob` is saved through the browser as `name-clean.ext`.

## Privacy model

- All processing runs in the browser tab (`utils/`, `composables/`, `workers/`). There is no server-side image code.
- Production responses send a Content Security Policy with `connect-src 'self'` and `img-src 'self' blob: data:`, so the browser itself blocks requests to other origins.
- Fonts and icons are bundled at build time; no third-party font or icon services are contacted at runtime.
- No cookies, storage or history of images. Object URLs are revoked when they are no longer needed.
- An end-to-end test asserts that the cleaning flow makes only same-origin `GET` requests with no request body.

## Supported formats

| Format     | Lossless metadata removal | Optional re-encoding                                      |
| ---------- | ------------------------- | --------------------------------------------------------- |
| JPEG / JPG | ✓                         | ✓ (Balanced, Smaller file)                                |
| PNG        | ✓                         | — (PNG is lossless; re-encoding would only grow the file) |
| WebP       | ✓                         | ✓ where the browser can encode WebP (not Safari)          |

HEIC, AVIF, GIF, TIFF and BMP are recognised and rejected with a clear message.

## Metadata supported

| Metadata                                               | JPEG  | PNG                  | WebP           | Action                                                                  |
| ------------------------------------------------------ | ----- | -------------------- | -------------- | ----------------------------------------------------------------------- |
| EXIF (camera, dates, software, author, GPS, thumbnail) | APP1  | `eXIf`               | `EXIF`         | Removed                                                                 |
| XMP (incl. extended XMP)                               | APP1  | `iTXt`               | `XMP `         | Removed                                                                 |
| IPTC / Photoshop IRB                                   | APP13 | —                    | —              | Removed                                                                 |
| C2PA / Content Credentials (JUMBF)                     | APP11 | `caBX`               | `C2PA`         | Removed                                                                 |
| Comments and text                                      | COM   | `tEXt` `zTXt` `iTXt` | —              | Removed                                                                 |
| Modification time                                      | —     | `tIME`               | —              | Removed                                                                 |
| Multi-picture index, JFIF thumbnails, other APPn       | ✓     | private chunks       | unknown chunks | Removed                                                                 |
| Data after the end of the image                        | ✓     | ✓                    | ✓              | Removed                                                                 |
| ICC colour profile                                     | APP2  | `iCCP`               | `ICCP`         | **Kept** — needed for accurate colours, not personal                    |
| Orientation                                            | EXIF  | `eXIf`               | `EXIF`         | **Kept as a single tag** when the photo is rotated, so it stays upright |

In _Balanced_ / _Smaller file_ modes the rotation is applied to the pixels and the output carries no EXIF at all.

## Metadata limitations

- **AI labels.** ClearFrame can remove supported embedded metadata that may contain information about how an image was created or edited, including information associated with AI tools where technically supported. **Removing metadata does not guarantee that Instagram or other platforms will remove an AI-generated or AI-edited label.** Platforms may use independent detection or provenance systems.
- **Invisible watermarks** (for example SynthID, Digimarc, TrustMark) live in the pixels, and some Content Credentials are stored online and found by fingerprint. ClearFrame cannot detect or remove these, and says so in the app.
- C2PA manifests are detected and removed as blocks; ClearFrame does not validate their signatures.
- Data appended after the main image — Motion Photo video, HDR gain maps, MPF secondary images — is removed, so those extras are lost.
- Re-encoding converts to sRGB; wide-gamut (Display P3) colours may look slightly less vivid. _Original quality_ preserves them exactly.

## Tech stack

Nuxt 3 · Vue 3 (`<script setup lang="ts">`) · TypeScript (strict) · Nuxt UI 3 · Tailwind CSS 4 · ExifReader · Vitest · Playwright · ESLint · Prettier. Fonts: Plus Jakarta Sans (headings) and Geist (text), self-hosted via `@nuxt/fonts`.

Nuxt UI v4 requires Nuxt 4, so this project uses Nuxt UI 3.3 to stay on Nuxt 3. `types/nuxt-schema.d.ts` restores a route-rule type that the mixed `@nuxt/schema` versions hide.

## Project structure

```text
components/        UI components (dropzone, preview, summary, details, progress, result, sections)
composables/
  useImageCleaner.ts   State machine: select → analyse → clean → result
  useImageMetadata.ts  Container inventory + lazy ExifReader parsing
  useFileDownload.ts   Download, share, unique file names
utils/
  containers/      Lossless JPEG / PNG / WebP parsers and strippers
  cleaner.ts       Cleaning pipeline (strip → optional re-encode → verify)
  metadata.ts      Categories, AI/provenance detection, before/after comparison
  validation.ts    Size, type, magic-byte and dimension checks
  image.ts         Format sniffing, decoding, re-encoding
  exif.ts          Orientation read/write
  file.ts          File naming and size formatting
  errors.ts        User-facing error copy
workers/           Off-main-thread re-encoding (OffscreenCanvas)
pages/             /, /about, /privacy
assets/icons/      Logo sources for the favicon, Apple touch and maskable icons
tests/unit         Vitest
tests/e2e          Playwright
tests/helpers      Synthetic fixture builders (no real photos)
```

## Development setup

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev          # http://localhost:3000
```

No environment variables, API keys or credentials are needed.

Sample images with fictional metadata (GPS, camera, AI markers) can be written to `tests/fixtures/` with:

```bash
npm run fixtures
```

Favicons and app icons are generated from the SVG sources in `assets/icons/` (rendered with Playwright's Chromium):

```bash
npm run icons
```

## Production build

```bash
npm run build                    # SSR output in .output/
node .output/server/index.mjs    # serve it on port 3000

npm run generate                 # fully static output in .output/public
```

## Deployment

- **Vercel / Netlify:** import the repository; Nuxt is detected automatically. Security headers from `nuxt.config.ts` are applied by the Nitro preset.
- **Any static host:** run `npm run generate` and upload `.output/public`. Add the security headers from `nuxt.config.ts` in your host's configuration if it does not read Nitro's output.

## Testing

```bash
npm run typecheck
npm run lint
npm test                 # unit tests
npx playwright install   # first time only
npm run test:e2e         # end-to-end (Chromium, Firefox, WebKit, iPhone, Pixel)
```

Unit tests cover validation, file naming, the JPEG/PNG/WebP parsers (including byte-for-byte preservation of image data), metadata detection, the cleaning flow and download generation. The end-to-end test uploads a synthetic photo, checks preview and detection, cleans it, downloads it, re-parses the downloaded file, and asserts no image data was sent over the network.

## Limitations

- One image at a time.
- Re-encoding is limited to 50 MP (about 16.7 MP on iOS because of Safari's canvas limit); larger images can still be cleaned losslessly.
- Very old browsers without `Blob.arrayBuffer`, `createImageBitmap` or ES2022 are not supported. Tested targets: Chrome, Edge, Firefox, Safari, iOS Safari and Android Chrome.

## Contributing

Issues and pull requests are welcome. Run `npm run lint`, `npm run typecheck` and `npm test` before submitting, and never commit real personal photos — use the builders in `tests/helpers/fixtures.ts`.

## License

MIT
