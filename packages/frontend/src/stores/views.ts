import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { View, CreateViewInput, UpdateViewInput, DashboardFilters } from "@gha-dashboard/shared";
import { apiFetch } from "../composables/useApi.js";
import { useDashboardStore } from "./dashboard.js";

/** Canonical serialisation for dirty-checking (repos sorted for order-insensitivity). */
function snap(repos: string[], filters: DashboardFilters) {
  return JSON.stringify({ repos: [...repos].sort(), filters });
}

export type PendingAction =
  | { type: "activate"; id: string }
  | { type: "clear" }
  | null;

export const useViewsStore = defineStore(
  "views",
  () => {
    const views = ref<View[]>([]);
    const activeViewId = ref<string | null>(null);
    const loading = ref(false);

    /* ---- dirty-state tracking ---- */
    const _snapshot = ref<string | null>(null);
    const pendingAction = ref<PendingAction>(null);

    const isDirty = computed(() => {
      if (!activeViewId.value || !_snapshot.value) return false;
      const dashboard = useDashboardStore();
      return snap(dashboard.selectedRepos, dashboard.filters) !== _snapshot.value;
    });

    function _takeSnapshot(): void {
      const dashboard = useDashboardStore();
      _snapshot.value = snap(dashboard.selectedRepos, dashboard.filters);
    }

    function _clearSnapshot(): void {
      _snapshot.value = null;
    }

    /* ---- CRUD ---- */

    async function fetchViews(): Promise<void> {
      loading.value = true;
      try {
        views.value = await apiFetch<View[]>("/api/views");
      } finally {
        loading.value = false;
      }
    }

    async function createView(name: string): Promise<View> {
      const dashboard = useDashboardStore();
      const input: CreateViewInput = {
        name,
        repos: [...dashboard.selectedRepos],
        filters: { ...dashboard.filters },
      };
      const view = await apiFetch<View>("/api/views", {
        method: "POST",
        body: JSON.stringify(input),
      });
      views.value.push(view);
      return view;
    }

    async function updateView(id: string, input: UpdateViewInput): Promise<void> {
      const updated = await apiFetch<View>(`/api/views/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      });
      const idx = views.value.findIndex((v) => v.id === id);
      if (idx >= 0) views.value[idx] = updated;
    }

    async function deleteView(id: string): Promise<void> {
      await apiFetch<void>(`/api/views/${id}`, { method: "DELETE" });
      views.value = views.value.filter((v) => v.id !== id);
      if (activeViewId.value === id) {
        activeViewId.value = null;
        _clearSnapshot();
      }
    }

    /* ---- view activation (with dirty guard) ---- */

    function _doActivate(id: string): void {
      const view = views.value.find((v) => v.id === id);
      if (!view) return;
      activeViewId.value = id;
      const dashboard = useDashboardStore();
      dashboard.applyView(view.repos, view.filters);
      _takeSnapshot();
    }

    function _doClear(): void {
      activeViewId.value = null;
      _clearSnapshot();
      const dashboard = useDashboardStore();
      dashboard.clearSelection();
    }

    /** Public: attempt to activate a view. Shows dirty dialog if needed. */
    function activateView(id: string): void {
      if (isDirty.value) {
        pendingAction.value = { type: "activate", id };
        return;
      }
      _doActivate(id);
    }

    /** Public: attempt to switch to "All repos". Shows dirty dialog if needed. */
    function clearActiveView(): void {
      if (isDirty.value) {
        pendingAction.value = { type: "clear" };
        return;
      }
      _doClear();
    }

    /** Save current dashboard state back to the active view, then refresh snapshot. */
    async function saveActiveView(): Promise<void> {
      if (!activeViewId.value) return;
      const dashboard = useDashboardStore();
      await updateView(activeViewId.value, {
        repos: [...dashboard.selectedRepos],
        filters: { ...dashboard.filters },
      });
      _takeSnapshot();
    }

    /* ---- pending-action resolution (called from dialog) ---- */

    async function confirmPendingAction(): Promise<void> {
      await saveActiveView();
      _executePending();
    }

    function discardPendingAction(): void {
      _clearSnapshot(); // discard means we no longer care about snapshot
      _executePending();
    }

    function cancelPendingAction(): void {
      pendingAction.value = null;
    }

    function _executePending(): void {
      const action = pendingAction.value;
      pendingAction.value = null;
      if (!action) return;
      if (action.type === "activate") _doActivate(action.id);
      else _doClear();
    }

    return {
      views,
      activeViewId,
      loading,
      isDirty,
      pendingAction,
      fetchViews,
      createView,
      updateView,
      deleteView,
      activateView,
      clearActiveView,
      saveActiveView,
      confirmPendingAction,
      discardPendingAction,
      cancelPendingAction,
    };
  },
  {
    persist: {
      pick: ["activeViewId"],
    },
  }
);
