<script setup lang="ts">
import type { MetadataGroup } from '~/types/metadata'

defineProps<{ groups: MetadataGroup[] }>()
</script>

<template>
  <details class="group/details rounded-xl border border-default">
    <summary
      class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-highlighted select-none [&::-webkit-details-marker]:hidden"
    >
      View details
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4 text-muted transition-transform group-open/details:rotate-180"
        aria-hidden="true"
      />
    </summary>
    <div class="max-h-[28rem] space-y-5 overflow-y-auto border-t border-default px-4 py-4" tabindex="0">
      <p v-if="!groups.length" class="text-sm text-muted">No readable metadata fields were found in this file.</p>
      <section v-for="group in groups" :key="group.id" :aria-labelledby="`details-${group.id}`">
        <h3 :id="`details-${group.id}`" class="text-xs font-semibold tracking-wider text-muted uppercase">
          {{ group.label }}
        </h3>
        <dl class="mt-2 divide-y divide-default/60 text-sm">
          <div
            v-for="(field, index) in group.fields"
            :key="`${field.label}-${index}`"
            class="grid gap-x-4 gap-y-0.5 py-1.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
          >
            <dt class="break-words text-muted">{{ field.label }}</dt>
            <dd class="font-mono text-[13px] break-words text-highlighted">{{ field.value }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </details>
</template>
