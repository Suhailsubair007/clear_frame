<script setup lang="ts">
import type { ProvenanceFindings } from '~/types/metadata'
import { describeProvenance } from '~/utils/metadata'

const props = defineProps<{ provenance: ProvenanceFindings }>()
const findings = computed(() => describeProvenance(props.provenance))
</script>

<template>
  <aside class="rounded-xl border border-info/25 bg-info/5 p-4 text-sm" aria-labelledby="provenance-heading">
    <p id="provenance-heading" class="flex items-center gap-2 font-semibold text-highlighted">
      <UIcon name="i-lucide-sparkles" class="size-4 text-info" aria-hidden="true" />
      Creation or AI-related information found
    </p>
    <ul class="mt-2 list-disc space-y-1 pl-5 text-toned">
      <li v-for="finding in findings" :key="finding">{{ finding }}</li>
    </ul>
    <p class="mt-3 text-toned">
      Clear Frame can remove supported embedded metadata that may contain information about how an image was created or
      edited, including information associated with AI tools where technically supported.
    </p>
    <p class="mt-2 text-toned">
      Removing metadata does not guarantee that Instagram or other platforms will remove an AI-generated or AI-edited
      label. Platforms may use independent detection or provenance systems.
    </p>
  </aside>
</template>
