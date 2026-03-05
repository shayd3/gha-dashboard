import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { User } from "@gha-dashboard/shared";
import { apiFetch } from "../composables/useApi.js";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const checked = ref(false);

  const authenticated = computed(() => !!user.value);

  async function checkAuth() {
    try {
      user.value = await apiFetch<User>("/api/auth/me");
    } catch {
      user.value = null;
    } finally {
      checked.value = true;
    }
  }

  async function logout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear local state regardless of API errors
    } finally {
      $reset();
    }
  }

  function $reset() {
    user.value = null;
    checked.value = false;
  }

  return { user, checked, authenticated, checkAuth, logout, $reset };
});
