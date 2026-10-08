<script setup lang="ts">
const DEFAULT_TITLE = 'Clear Frame — Private Image Metadata Cleaner'
const DESCRIPTION =
  'Remove supported image metadata privately in your browser. Clean EXIF, GPS, editing and other metadata before sharing your photos.'

useHead({
  titleTemplate: (title) => (title ? `${title} · Clear Frame` : DEFAULT_TITLE),
})

useSeoMeta({
  description: DESCRIPTION,
  ogTitle: 'Clear Frame — Your photos. Your privacy.',
  ogDescription: 'Clean your images privately before you share them.',
  ogType: 'website',
  ogSiteName: 'Clear Frame',
  twitterCard: 'summary',
  twitterTitle: 'Clear Frame — Your photos. Your privacy.',
  twitterDescription: 'Clean your images privately before you share them.',
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
