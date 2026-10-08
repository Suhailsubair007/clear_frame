<script setup lang="ts">
import { CLEANING_STEPS } from '~/utils/cleaner'
import { toUserFacingError } from '~/utils/errors'

const {
  phase,
  image,
  analysis,
  result,
  error,
  currentStep,
  mode,
  availableModes,
  statusMessage,
  selectFile,
  clean,
  reset,
} = useImageCleaner()
const { download, share, canShareFile } = useFileDownload()
const toast = useToast()

const workspace = ref<HTMLElement | null>(null)
const dropzone = ref<{ focus: () => void } | null>(null)

const hasImage = computed(() => phase.value === 'ready' || phase.value === 'cleaning')
const compactHero = computed(() => hasImage.value || phase.value === 'done')
const aiFound = computed(() => analysis.value?.categories.some((c) => c.id === 'ai' && c.status === 'found') ?? false)
const canShare = computed(() => (result.value ? canShareFile(result.value.blob, result.value.fileName) : false))
const stepLabel = computed(() => CLEANING_STEPS.find((step) => step.id === currentStep.value)?.label ?? 'Cleaning…')

/** Move focus and scroll to the new state so keyboard and screen-reader users follow along. */
watch(phase, async (next, previous) => {
  await nextTick()
  if (next === 'ready' || next === 'done' || next === 'error') {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    workspace.value?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' })
    workspace.value?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
  } else if (next === 'idle' && previous !== 'loading') {
    dropzone.value?.focus()
  }
})

function notify(caught: unknown) {
  const friendly = toUserFacingError(caught, 'download-failed')
  toast.add({ title: friendly.title, description: friendly.description, color: 'error', icon: 'i-lucide-circle-x' })
}

function onDownload() {
  if (!result.value) return
  try {
    download(result.value.blob, result.value.fileName)
  } catch (caught) {
    notify(caught)
  }
}

async function onShare() {
  if (!result.value) return
  await share(result.value.blob, result.value.fileName).catch(notify)
}

/** Accept drops anywhere on the page, and stop the browser from navigating to the file. */
function onWindowDragOver(event: DragEvent) {
  if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
}

function onWindowDrop(event: DragEvent) {
  if (event.defaultPrevented || !event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  const file = event.dataTransfer.files[0]
  if (file && phase.value !== 'loading' && phase.value !== 'cleaning') selectFile(file)
}

onMounted(() => {
  window.addEventListener('dragover', onWindowDragOver)
  window.addEventListener('drop', onWindowDrop)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragover', onWindowDragOver)
  window.removeEventListener('drop', onWindowDrop)
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 sm:px-6" :class="{ 'pb-24 lg:pb-0': hasImage }">
    <p class="sr-only" role="status" aria-live="polite">{{ statusMessage }}</p>

    <section class="text-center" :class="compactHero ? 'pt-10 pb-8' : 'pt-12 pb-10 sm:pt-20 sm:pb-14'">
      <h1
        class="mx-auto max-w-3xl font-display leading-[1.05] text-highlighted transition-all"
        :class="compactHero ? 'text-4xl sm:text-5xl' : 'text-[2.5rem] sm:text-6xl lg:text-7xl'"
      >
        <span class="block">Your photos.</span>
        <span class="block text-primary-600 dark:text-primary-400">Your privacy.</span>
      </h1>
      <p v-if="!compactHero" class="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
        Clean unwanted image metadata before you share. Process your photos directly on your device with no uploads or
        cloud storage.
      </p>
    </section>

    <div ref="workspace" class="scroll-mt-24">
      <UploadDropzone
        v-if="phase === 'idle' || phase === 'loading'"
        ref="dropzone"
        :loading="phase === 'loading'"
        @select="selectFile"
      />

      <ErrorState v-else-if="phase === 'error' && error" :error="error" @retry="reset" />

      <LazyCleaningResult
        v-else-if="phase === 'done' && image && result"
        :image="image"
        :result="result"
        :can-share="canShare"
        @download="onDownload"
        @share="onShare"
        @reset="reset"
      />

      <div v-else-if="image && analysis" class="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div class="card space-y-6 p-4 sm:p-6 lg:sticky lg:top-24">
          <div class="flex items-center justify-between gap-3">
            <h2 class="text-lg font-semibold text-highlighted" tabindex="-1" data-autofocus>Review your image</h2>
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-x"
              label="Choose another"
              :disabled="phase === 'cleaning'"
              @click="reset"
            />
          </div>
          <ImagePreview :src="image.objectUrl" :alt="`Preview of ${image.name}`" />
          <ImageInfo :image="image" />
        </div>

        <div class="card space-y-5 p-4 sm:p-6">
          <MetadataSummary :categories="analysis.categories" />
          <ProvenanceNotice v-if="aiFound" :provenance="analysis.provenance" />
          <p v-if="analysis.parseFailed" class="text-sm text-muted">
            Some details couldn’t be read, but ClearFrame can still remove the metadata blocks it found.
          </p>
          <LazyMetadataDetails :groups="analysis.groups" />
          <QualitySelector v-model="mode" :available="availableModes" :disabled="phase === 'cleaning'" />
          <div class="hidden lg:block">
            <LazyCleaningProgress v-if="phase === 'cleaning'" :current="currentStep" />
            <UButton v-else size="xl" block icon="i-lucide-eraser" label="Clean image" @click="clean" />
          </div>
          <PrivacyNotice />
        </div>
      </div>
    </div>

    <div
      v-if="hasImage"
      class="fixed inset-x-0 bottom-0 z-20 border-t border-default bg-(--cf-page)/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
    >
      <UButton
        size="xl"
        block
        icon="i-lucide-eraser"
        :loading="phase === 'cleaning'"
        :label="phase === 'cleaning' ? stepLabel : 'Clean image'"
        @click="clean"
      />
    </div>

    <div class="mt-24 space-y-24">
      <LazyHowItWorks />
      <LazyPrivacySection />
      <LazyAiMetadataSection />
    </div>
  </div>
</template>
