<script setup lang="ts">
useSeoMeta({
  title: 'Privacy',
  description: 'Clear Frame processes images locally in your browser. No uploads, no image storage, no accounts.',
})

const PROMISES = [
  { icon: 'i-lucide-cpu', title: 'Processed locally', text: 'Inspection and cleaning run in your browser.' },
  { icon: 'i-lucide-cloud-off', title: 'Never uploaded', text: 'Images aren’t sent anywhere.' },
  { icon: 'i-lucide-history', title: 'No storage or history', text: 'Close the tab and the image is gone.' },
  { icon: 'i-lucide-user-x', title: 'No account', text: 'Nothing to sign up for.' },
  { icon: 'i-lucide-eye-off', title: 'No tracking', text: 'No analytics or tracking scripts.' },
  { icon: 'i-lucide-download', title: 'You control downloads', text: 'Your original file is never changed.' },
]

const LIMITS = [
  'Works with JPG, PNG and WebP. HEIC isn’t supported yet.',
  'Colour profiles and photo orientation are kept — they contain nothing personal.',
  'Invisible watermarks and Content Credentials stored online can’t be removed.',
  'Removing metadata does not guarantee that Instagram or other platforms will remove an AI-generated or AI-edited label.',
]
</script>

<template>
  <article class="mx-auto max-w-3xl px-4 pt-14 sm:px-6 sm:pt-20">
    <p class="eyebrow motion-fade-up">Privacy</p>
    <h1
      class="motion-focus-in mt-3 font-display text-4xl leading-tight text-highlighted sm:text-5xl"
      style="--delay: 60ms"
    >
      Your photos never leave your device.
    </h1>
    <p class="motion-fade-up mt-5 text-lg leading-relaxed text-muted" style="--delay: 160ms">
      Everything happens in your browser. Clear Frame does not upload your images to any server.
    </p>

    <ul class="motion-fade-up mt-12 grid gap-3 sm:grid-cols-2" style="--delay: 240ms">
      <li v-for="item in PROMISES" :key="item.title" class="card motion-lift flex items-start gap-4 p-4">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <UIcon :name="item.icon" class="size-5" aria-hidden="true" />
        </span>
        <span>
          <span class="block font-semibold text-highlighted">{{ item.title }}</span>
          <span class="block text-sm text-muted">{{ item.text }}</span>
        </span>
      </li>
    </ul>

    <section class="reveal mt-12" aria-labelledby="limits-heading">
      <h2 id="limits-heading" class="text-sm font-semibold text-highlighted">Good to know</h2>
      <ul class="mt-4 space-y-2.5">
        <li v-for="limit in LIMITS" :key="limit" class="flex gap-3 text-sm leading-relaxed text-muted">
          <UIcon name="i-lucide-info" class="mt-0.5 size-4 shrink-0 text-dimmed" aria-hidden="true" />
          {{ limit }}
        </li>
      </ul>
    </section>

    <p class="reveal mt-10 border-t border-default pt-6 text-xs leading-relaxed text-dimmed">
      Like any website, our hosting provider may keep standard request logs (such as IP addresses). Those requests never
      include your images.
    </p>
  </article>
</template>
