<template>
  <footer class="mt-24 border-t border-default pb-[env(safe-area-inset-bottom)]">
    <div
      class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <div class="flex items-center gap-2.5">
        <AppLogo class="size-6" />
        <p>
          <span class="font-semibold text-highlighted">Clear Frame</span>
          <span aria-hidden="true"> · </span>
          Your photos. Your privacy.
        </p>
      </div>
      <nav aria-label="Footer" class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <NuxtLink to="/about" class="hover:text-highlighted">About</NuxtLink>
        <NuxtLink to="/privacy" class="hover:text-highlighted">Privacy</NuxtLink>
        <span class="flex items-center gap-1.5">
          <UIcon name="i-lucide-lock" class="size-3.5" />
          Processed locally. Your photos never leave your device.
        </span>
      </nav>
    </div>
  </footer>
</template>
