<script setup lang="ts">
import Card from "primevue/card";
import Button from "primevue/button";

function login() {
  window.location.href = "/api/auth/login";
}
</script>

<template>
  <div class="login-page">
    <Card class="login-card">
      <template #header>
        <div class="card-header-graphic">
          <div class="logo-icon">
            <i class="pi pi-github" />
          </div>
        </div>
      </template>
      <template #title>
        <span class="card-title">GHA Dashboard</span>
      </template>
      <template #subtitle>
        <span class="card-subtitle">Monitor GitHub Actions workflow statuses across your organizations.</span>
      </template>
      <template #footer>
        <Button
          label="Sign in with GitHub"
          icon="pi pi-github"
          size="large"
          class="w-full login-btn"
          @click="login"
        />
      </template>
    </Card>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: radial-gradient(ellipse at 60% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 60%),
    var(--p-surface-950);
}

.login-card {
  width: 380px;
  text-align: center;
}

.card-header-graphic {
  display: flex;
  justify-content: center;
  padding: 2rem 2rem 0;
}

.logo-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--p-primary-500);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #fff;
}

.card-title {
  font-size: 1.5rem;
  font-weight: 700;
}

.card-subtitle {
  font-size: 0.9rem;
  line-height: 1.5;
}

.login-btn {
  width: 100%;
  justify-content: center;
}
</style>
