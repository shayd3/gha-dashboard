<script setup lang="ts">
function login() {
  window.location.href = "/api/auth/login";
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1>GHA Dashboard</h1>
      <p>Monitor GitHub Actions workflow statuses across your organizations.</p>
      <button class="login-btn" @click="login">
        <i class="pi pi-github" />
        Sign in with GitHub
      </button>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
}

.login-card {
  text-align: center;
  background: #fff;
  padding: 3rem;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  max-width: 420px;
}

.login-card h1 {
  font-size: 1.75rem;
  margin-bottom: 0.75rem;
  color: #1a1a2e;
}

.login-card p {
  color: #666;
  margin-bottom: 2rem;
  line-height: 1.5;
}

.login-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #24292e;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.login-btn:hover {
  background: #1a1e22;
}
</style>
