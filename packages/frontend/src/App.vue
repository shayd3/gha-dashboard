<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <div class="p-dark app-root">
    <RouterView />
  </div>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: "Onest", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--p-surface-950);
  color: var(--p-text-color);
  min-height: 100vh;
}

.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--p-surface-950);
}

.p-tooltip .p-tooltip-text {
  white-space: nowrap;
}
</style>
