<template>
  <header
    class="sticky top-0 z-30 border-b border-default/70 bg-(--cf-page)/85 pt-[env(safe-area-inset-top)] backdrop-blur-md"
  >
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
      <NuxtLink to="/" class="flex items-center gap-2.5 rounded-lg" aria-label="ClearFrame home">
        <AppLogo class="size-8" />
        <span class="text-[15px] font-semibold tracking-tight text-highlighted">ClearFrame</span>
      </NuxtLink>
      <nav aria-label="Main" class="flex items-center gap-0.5">
        <UButton to="/about" variant="ghost" color="neutral" label="About" />
        <UButton to="/privacy" variant="ghost" color="neutral" label="Privacy" />
        <ColorModeToggle />
      </nav>
    </div>
  </header>
</template>
