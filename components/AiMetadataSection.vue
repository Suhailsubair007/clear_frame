<template>
  <section aria-labelledby="ai-heading" class="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
    <h2 id="ai-heading" class="font-display text-3xl text-highlighted sm:text-4xl">What about AI labels?</h2>
    <div class="space-y-4 leading-relaxed text-muted">
      <p>
        Some images carry embedded information about how they were made — for example Content Credentials (C2PA) or an
        IPTC “digital source type” written by AI tools.
      </p>
      <p>
        ClearFrame can remove supported embedded metadata that may contain information about how an image was created or
        edited, including information associated with AI tools where technically supported.
      </p>
      <p class="rounded-xl border border-default bg-(--cf-card) p-4 text-toned">
        <strong class="font-semibold text-highlighted">Please note:</strong> removing metadata does not guarantee that
        Instagram or other platforms will remove an AI-generated or AI-edited label. Platforms may use independent
        detection or provenance systems, such as invisible watermarks, which metadata removal does not affect.
      </p>
    </div>
  </section>
</template>
