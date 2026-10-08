<script setup lang="ts">
useSeoMeta({
  title: 'About',
  description:
    'ClearFrame was built to make image privacy simple: inspect and remove supported photo metadata before sharing.',
})
</script>

<template>
  <article class="article mx-auto max-w-2xl px-4 pt-14 sm:px-6 sm:pt-20">
    <p class="text-sm font-semibold tracking-wider text-primary uppercase">About</p>
    <h1 class="mt-3 font-display text-5xl leading-tight text-highlighted">
      ClearFrame was built to make image privacy simple.
    </h1>

    <p class="mt-6 text-lg">
      Modern photos can contain far more than the visible pixels. A single picture from a phone can record exactly where
      it was taken, which device took it, when, and which apps edited it afterwards.
    </p>

    <h2>What hides in a photo</h2>
    <ul>
      <li><strong>Location</strong> — GPS coordinates precise enough to identify a home or workplace.</li>
      <li><strong>Camera information</strong> — make, model, lens and sometimes serial numbers.</li>
      <li><strong>Timestamps</strong> — when the photo was taken and last modified.</li>
      <li><strong>Software information</strong> — the apps and tools used to edit or create it.</li>
      <li>
        <strong>Other metadata</strong> — authors, captions, embedded thumbnails, and provenance data such as Content
        Credentials.
      </li>
    </ul>

    <h2>What ClearFrame does</h2>
    <p>
      ClearFrame helps you inspect and remove supported metadata before you share. It shows what it found in plain
      language, removes it, then re-reads the cleaned file to verify the result — all inside your browser.
    </p>
    <p>
      By default ClearFrame doesn’t re-compress your photo. It removes the metadata sections and copies the image data
      exactly, so quality is unchanged. Re-encoding at a smaller size is optional.
    </p>

    <h2>What it doesn’t do</h2>
    <p>
      ClearFrame can remove supported embedded metadata that may contain information about how an image was created or
      edited, including information associated with AI tools where technically supported. It cannot remove invisible
      watermarks in the pixels or records kept on other services.
    </p>
    <p>
      Removing metadata does not guarantee that Instagram or other platforms will remove an AI-generated or AI-edited
      label. Platforms may use independent detection or provenance systems.
    </p>
    <p>See the <NuxtLink to="/privacy">privacy page</NuxtLink> for how your images are handled.</p>
  </article>
</template>
