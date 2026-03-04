<script setup lang="ts">
import { useAuthStore } from "../stores/auth.js";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();

async function logout() {
  await auth.logout();
  router.push({ name: "login" });
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="logo">GHA Dashboard</h1>
    </div>
    <div class="header-right" v-if="auth.user">
      <img
        :src="auth.user.avatarUrl"
        :alt="auth.user.login"
        class="avatar"
      />
      <span class="username">{{ auth.user.login }}</span>
      <button class="logout-btn" @click="logout">
        <i class="pi pi-sign-out" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.25rem;
  background: #0d1117;
  color: #fff;
}

.logo {
  font-size: 1.125rem;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.username {
  font-size: 0.875rem;
}

.logout-btn {
  background: none;
  border: none;
  color: #8b949e;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1rem;
}

.logout-btn:hover {
  color: #fff;
}
</style>
