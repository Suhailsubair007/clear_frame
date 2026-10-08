<script setup lang="ts">
useSeoMeta({
  title: 'Privacy',
  description: 'ClearFrame processes images locally in your browser. No uploads, no image storage, no accounts.',
})
</script>

<template>
  <article class="article mx-auto max-w-2xl px-4 pt-14 sm:px-6 sm:pt-20">
    <p class="text-sm font-semibold tracking-wider text-primary uppercase">Privacy</p>
    <h1 class="mt-3 font-display text-4xl leading-tight sm:text-5xl text-highlighted">
      Your photos never leave your device.
    </h1>

    <p class="mt-6 text-lg">
      ClearFrame is designed so that it never needs to see your images. Here is exactly what happens — and what doesn’t.
    </p>

    <h2>Images are processed locally</h2>
    <p>
      When you choose a photo, your browser reads it into memory on your device. Inspection, cleaning and verification
      all run in JavaScript inside that browser tab. ClearFrame has no server-side image processing.
    </p>

    <h2>ClearFrame does not upload your images</h2>
    <p>
      ClearFrame does not intentionally upload images anywhere. The site also sends a Content Security Policy that tells
      your browser to block network connections to other websites, as an extra safeguard.
    </p>

    <h2>No storage, accounts or history</h2>
    <ul>
      <li><strong>No image storage.</strong> Images live only in your browser’s memory while the tab is open.</li>
      <li><strong>No accounts.</strong> There is nothing to sign up for.</li>
      <li><strong>No image history.</strong> Closing or reloading the page forgets the image.</li>
      <li><strong>No analytics or tracking</strong> scripts are included in ClearFrame.</li>
    </ul>

    <h2>Your downloads stay under your control</h2>
    <p>
      The cleaned image is created on your device and saved through your browser’s normal download or share flow. Your
      original file is never modified.
    </p>

    <h2>Limitations of browser processing</h2>
    <ul>
      <li>
        ClearFrame removes supported metadata in JPEG, PNG and WebP files. Other formats, such as HEIC, aren’t supported
        yet.
      </li>
      <li>
        Colour profiles and, for rotated photos, a single orientation tag are kept on purpose. They contain no personal
        information and keep your photo looking right.
      </li>
      <li>Extra data stored after the main image — such as motion-photo video or HDR gain maps — is removed.</li>
      <li>
        Invisible watermarks embedded in the pixels and provenance records stored online cannot currently be removed by
        ClearFrame.
      </li>
      <li>
        Removing metadata does not guarantee that Instagram or other platforms will remove an AI-generated or AI-edited
        label. Platforms may use independent detection or provenance systems.
      </li>
    </ul>

    <h2>Hosting and content delivery</h2>
    <p>
      Like any website, ClearFrame’s pages and code are delivered by a hosting provider or CDN. That provider may keep
      standard server logs — such as IP addresses and the pages requested — under its own policies. Those requests never
      include your images. Fonts and icons are bundled with the site, so no third-party font or icon services are
      contacted.
    </p>
  </article>
</template>
