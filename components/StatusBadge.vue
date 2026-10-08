<script setup lang="ts">
export type StatusKind = 'found' | 'not-found' | 'unknown' | 'removed' | 'kept' | 'not-removed'

const props = defineProps<{ status: StatusKind }>()

const STATUS: Record<StatusKind, { label: string; icon: string; classes: string }> = {
  found: { label: 'Found', icon: 'i-lucide-scan-eye', classes: 'bg-warning/10 text-warning-700 dark:text-warning-300' },
  'not-found': { label: 'Not detected', icon: 'i-lucide-minus', classes: 'bg-elevated text-muted' },
  unknown: { label: 'Unknown', icon: 'i-lucide-circle-help', classes: 'bg-elevated text-muted' },
  removed: {
    label: 'Removed',
    icon: 'i-lucide-check',
    classes: 'bg-success/10 text-success-700 dark:text-success-300',
  },
  kept: { label: 'Kept', icon: 'i-lucide-shield-check', classes: 'bg-info/10 text-info-700 dark:text-info-300' },
  'not-removed': {
    label: 'Not removed',
    icon: 'i-lucide-triangle-alert',
    classes: 'bg-error/10 text-error-700 dark:text-error-300',
  },
}

const config = computed(() => STATUS[props.status])
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
    :class="config.classes"
  >
    <UIcon :name="config.icon" class="size-3.5" aria-hidden="true" />
    {{ config.label }}
  </span>
</template>
