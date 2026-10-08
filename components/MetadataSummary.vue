<script setup lang="ts">
import type { MetadataCategory, MetadataCategoryId } from '~/types/metadata'

const props = defineProps<{ categories: MetadataCategory[] }>()

/** Found, but intentionally kept because it contains nothing personal. */
const KEPT_ON_PURPOSE: Partial<Record<MetadataCategoryId, string>> = {
  icc: 'Kept so colours stay accurate',
  orientation: 'Kept so the photo stays upright',
}

const foundCount = computed(() => props.categories.filter((category) => category.status === 'found').length)
</script>

<template>
  <section aria-labelledby="summary-heading">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id="summary-heading" class="text-base font-semibold text-highlighted">Metadata detected</h2>
      <p class="text-sm text-muted">
        {{ foundCount ? `${foundCount} found` : 'Nothing found' }}
      </p>
    </div>
    <ul role="list" class="mt-3 divide-y divide-default overflow-hidden rounded-xl border border-default">
      <li
        v-for="(category, index) in categories"
        :key="category.id"
        class="motion-fade-up flex items-center justify-between gap-3 px-4 py-3"
        :style="{ '--delay': `${100 + index * 35}ms` }"
      >
        <div class="min-w-0">
          <p class="flex flex-wrap items-center gap-x-2 text-sm font-medium text-highlighted">
            {{ category.label }}
            <span
              v-if="category.sensitive && category.status === 'found'"
              class="text-[11px] font-semibold tracking-wide text-warning-700 uppercase dark:text-warning-300"
            >
              Personal
            </span>
          </p>
          <p
            v-if="category.status === 'found' && (category.hint || KEPT_ON_PURPOSE[category.id])"
            class="mt-0.5 truncate text-sm text-muted"
            :title="category.hint"
          >
            {{ KEPT_ON_PURPOSE[category.id] ?? category.hint }}
          </p>
        </div>
        <StatusBadge :status="category.status === 'found' && KEPT_ON_PURPOSE[category.id] ? 'kept' : category.status" />
      </li>
    </ul>
  </section>
</template>
