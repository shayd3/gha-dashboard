<script setup lang="ts">
import { useAuthStore } from "../stores/auth.js";
import { useRouter } from "vue-router";
import Avatar from "primevue/avatar";
import Button from "primevue/button";

const auth = useAuthStore();
const router = useRouter();

async function logout() {
  await auth.logout();
  router.push({ name: "login" });
}
</script>

<template>
  <header class="app-header">
    <div class="header-brand">
      <i class="pi pi-github" style="font-size: 1.35rem; color: var(--p-primary-400)" />
      <span class="brand-text">GHA Dashboard</span>
    </div>
    <div class="header-user" v-if="auth.user">
      <Avatar
        :image="auth.user.avatarUrl"
        shape="circle"
        size="normal"
      />
      <span class="username">{{ auth.user.login }}</span>
      <Button
        icon="pi pi-sign-out"
        severity="secondary"
        text
        rounded
        @click="logout"
        v-tooltip.bottom="'Sign out'"
      />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.5rem;
  height: 56px;
  background: var(--p-surface-800);
  border-bottom: 1px solid var(--p-surface-700);
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.brand-text {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--p-text-color);
}

.header-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.username {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
}
</style>
