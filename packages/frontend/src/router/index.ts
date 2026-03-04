import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.js";

const LoginPage = () => import("../pages/LoginPage.vue");
const DashboardPage = () => import("../pages/DashboardPage.vue");

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", name: "login", component: LoginPage },
    {
      path: "/",
      name: "dashboard",
      component: DashboardPage,
      meta: { requiresAuth: true },
    },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.checked) {
    await auth.checkAuth();
  }

  if (to.meta.requiresAuth && !auth.authenticated) {
    return { name: "login" };
  }

  if (to.name === "login" && auth.authenticated) {
    return { name: "dashboard" };
  }
});
