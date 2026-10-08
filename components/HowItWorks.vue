<script setup lang="ts">
const STEPS = [
  { icon: 'i-lucide-image-up', title: 'Add a photo', text: 'JPG, PNG or WebP. It stays on your device.' },
  { icon: 'i-lucide-scan-eye', title: 'Review', text: 'See the location, camera, dates and other hidden details.' },
  { icon: 'i-lucide-download', title: 'Download', text: 'Get a clean copy in original quality.' },
]
</script>

<template>
  <section aria-labelledby="how-heading" class="reveal">
    <h2 id="how-heading" class="font-display text-3xl text-highlighted sm:text-4xl">How it works</h2>
    <ol class="mt-8 grid gap-4 sm:grid-cols-3">
      <li v-for="(step, index) in STEPS" :key="step.title" class="card motion-lift p-6">
        <div class="flex items-center justify-between">
          <span class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UIcon :name="step.icon" class="size-5" aria-hidden="true" />
          </span>
          <span class="font-display text-2xl text-dimmed" aria-hidden="true">0{{ index + 1 }}</span>
        </div>
        <h3 class="mt-5 font-semibold text-highlighted">{{ step.title }}</h3>
        <p class="mt-1.5 text-sm leading-relaxed text-muted">{{ step.text }}</p>
      </li>
    </ol>
  </section>
</template>
