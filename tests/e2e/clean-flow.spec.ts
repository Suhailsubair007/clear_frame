import { readFile } from 'node:fs/promises'
import { expect, test, type Request } from '@playwright/test'
import { inspectContainer } from '../../utils/containers'
import { BASE_HEIGHT, BASE_WIDTH, buildPng, buildSamplePhoto, jpegScanData } from '../helpers/fixtures'

function trackRequests(page: import('@playwright/test').Page) {
  const requests: Request[] = []
  page.on('request', (request) => requests.push(request))
  return requests
}

test('cleans a photo end to end without sending it anywhere', async ({ page, baseURL }) => {
  const requests = trackRequests(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your photos.')

  const photo = buildSamplePhoto({ orientation: 6 })
  await page.getByLabel('Choose an image to clean').setInputFiles({
    name: 'IMG_1234.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(photo),
  })

  // Preview and image information
  await expect(page.getByRole('heading', { name: 'Review your image' })).toBeVisible()
  await expect(page.getByAltText('Preview of IMG_1234.jpg')).toBeVisible()
  await expect(page.getByText('IMG_1234.jpg')).toBeVisible()
  // Orientation 6 rotates the 24×16 image to 16×24 on screen.
  await expect(page.getByText(`${BASE_HEIGHT} px`).first()).toBeVisible()

  // Metadata detection
  const summary = page.getByRole('region', { name: 'Metadata detected' })
  await expect(summary.getByText('37.7749° N, 122.4194° W')).toBeVisible()
  await expect(summary.getByText('ExampleCam X100')).toBeVisible()

  await page.getByText('View details').click()
  await expect(page.getByRole('heading', { name: 'EXIF', exact: true })).toBeVisible()

  // Clean
  const cleanButton = page.getByRole('button', { name: 'Clean image' }).locator('visible=true')
  await cleanButton.click()
  await expect(page.getByRole('heading', { name: 'Your image is clean and ready to share.' })).toBeVisible()
  await expect(page.getByRole('row', { name: /GPS location/ })).toContainText('Removed')
  await expect(page.getByRole('row', { name: /Colour profile/ })).toContainText('Kept')

  // Download
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download clean image' }).first().click(),
  ])
  expect(download.suggestedFilename()).toBe('IMG_1234-clean.jpg')
  const cleaned = new Uint8Array(await readFile((await download.path()) as string))
  const inventory = inspectContainer(cleaned, 'jpeg')
  expect(inventory.blocks.map((block) => block.kind).sort()).toEqual(['exif', 'icc'])
  expect(inventory.orientation).toBe(6)
  expect(Buffer.from(cleaned).includes('ExampleCam')).toBe(false)
  expect(jpegScanData(cleaned)).toEqual(jpegScanData(photo))

  // Privacy: only same-origin GET requests; nothing carries the image.
  const origin = new URL(baseURL as string).origin
  for (const request of requests) {
    const url = new URL(request.url())
    if (url.protocol === 'blob:' || url.protocol === 'data:') continue
    expect(url.origin).toBe(origin)
    expect(request.method()).toBe('GET')
    expect(request.postData()).toBeNull()
  }

  await page.getByRole('button', { name: 'Clean another image' }).click()
  await expect(page.getByLabel('Choose an image to clean')).toBeAttached()
})

test('flags AI generation settings in a PNG', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose an image to clean').setInputFiles({
    name: 'render.png',
    mimeType: 'image/png',
    buffer: Buffer.from(buildPng({ text: { parameters: 'a lighthouse at dusk' } })),
  })
  await expect(page.getByText('Creation or AI-related information found')).toBeVisible()
  await expect(page.getByText(/does not guarantee that Instagram/).first()).toBeVisible()
  await expect(page.getByText(`${BASE_WIDTH} px`)).toBeVisible()
})

test('rejects unsupported files with a friendly message', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose an image to clean').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  })
  await expect(page.getByRole('heading', { name: "This file type isn't supported." })).toBeVisible()
  await page.getByRole('button', { name: 'Try another image' }).click()
  await expect(page.getByLabel('Choose an image to clean')).toBeAttached()
})

test('rejects corrupted images', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose an image to clean').setInputFiles({
    name: 'broken.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(buildSamplePhoto().subarray(0, 120)),
  })
  await expect(page.getByRole('heading', { name: "We couldn't process this image." })).toBeVisible()
})
