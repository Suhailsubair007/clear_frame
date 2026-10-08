<script setup lang="ts">
useSeoMeta({
  title: 'About',
  description:
    'Clear Frame was built to make image privacy simple: inspect and remove supported photo metadata before sharing.',
})

const REVEALS = [
  { icon: 'i-lucide-map-pin', title: 'Location', text: 'Where the photo was taken' },
  { icon: 'i-lucide-camera', title: 'Camera', text: 'Make, model and lens' },
  { icon: 'i-lucide-clock', title: 'Date & time', text: 'When it was taken and edited' },
  { icon: 'i-lucide-app-window', title: 'Software', text: 'Apps used to edit or create it' },
]
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 pt-14 sm:px-6 sm:pt-20">
    <p class="eyebrow motion-fade-up">About</p>
    <h1
      class="motion-focus-in mt-3 font-display text-4xl leading-tight text-highlighted sm:text-5xl"
      style="--delay: 60ms"
    >
      Clear Frame was built to make image privacy simple.
    </h1>
    <p class="motion-fade-up mt-5 text-lg leading-relaxed text-muted" style="--delay: 160ms">
      Photos carry more than pixels. Clear Frame shows the hidden metadata and removes it before you share — right in
      your browser.
    </p>

    <section class="motion-fade-up mt-12" style="--delay: 240ms" aria-labelledby="reveals-heading">
      <h2 id="reveals-heading" class="text-sm font-semibold text-highlighted">What a photo can reveal</h2>
      <ul class="mt-4 grid gap-3 sm:grid-cols-2">
        <li v-for="item in REVEALS" :key="item.title" class="card motion-lift flex items-center gap-4 p-4">
          <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon :name="item.icon" class="size-5" aria-hidden="true" />
          </span>
          <span>
            <span class="block font-semibold text-highlighted">{{ item.title }}</span>
            <span class="block text-sm text-muted">{{ item.text }}</span>
          </span>
        </li>
      </ul>
    </section>

    <p class="reveal mt-10 text-sm leading-relaxed text-muted">
      Clear Frame keeps your photo in original quality by default. Removing metadata does not guarantee that Instagram
      or other platforms will remove an AI-generated or AI-edited label.
    </p>

    <UButton to="/" size="lg" class="reveal mt-8" trailing-icon="i-lucide-arrow-right" label="Clean a photo" />
  </article>
</template>
