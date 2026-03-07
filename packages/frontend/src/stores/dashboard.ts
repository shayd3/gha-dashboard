import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  Organization,
  Repository,
  WorkflowRun,
  DashboardFilters,
} from "@gha-dashboard/shared";
import { apiFetch } from "../composables/useApi.js";

export const useDashboardStore = defineStore(
  "dashboard",
  () => {
    const orgs = ref<Organization[]>([]);
    const reposByOrg = ref<Record<string, Repository[]>>({});
    const selectedRepos = ref<string[]>([]);
    const runs = ref<WorkflowRun[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const lastUpdated = ref<string | null>(null);
    const refreshInterval = ref(30);

    const filters = ref<DashboardFilters>({
      status: null,
      branch: null,
      workflow: null,
      event: null,
    });

    const filteredRuns = computed(() => {
      let result = runs.value;

      if (filters.value.status?.length) {
        result = result.filter((r) =>
          filters.value.status!.includes(r.conclusion)
        );
      }
      if (filters.value.branch) {
        result = result.filter((r) =>
          r.headBranch
            .toLowerCase()
            .includes(filters.value.branch!.toLowerCase())
        );
      }
      if (filters.value.workflow) {
        result = result.filter((r) =>
          r.name
            .toLowerCase()
            .includes(filters.value.workflow!.toLowerCase())
        );
      }
      if (filters.value.event) {
        result = result.filter((r) => r.event === filters.value.event);
      }

      return result;
    });

    const uniqueBranches = computed(() => [
      ...new Set(runs.value.map((r) => r.headBranch)),
    ]);

    const uniqueWorkflows = computed(() => [
      ...new Set(runs.value.map((r) => r.name)),
    ]);

    const uniqueEvents = computed(() => [
      ...new Set(runs.value.map((r) => r.event)),
    ]);

    async function fetchOrgs() {
      orgs.value = await apiFetch<Organization[]>("/api/orgs");
    }

    async function fetchRepos(org: string) {
      const repos = await apiFetch<Repository[]>(
        `/api/orgs/${encodeURIComponent(org)}/repos`
      );
      reposByOrg.value = { ...reposByOrg.value, [org]: repos };
    }

    async function fetchRuns() {
      if (!selectedRepos.value.length) {
        runs.value = [];
        return;
      }

      loading.value = true;
      error.value = null;

      try {
        const reposParam = selectedRepos.value.join(",");
        runs.value = await apiFetch<WorkflowRun[]>(
          `/api/runs?repos=${encodeURIComponent(reposParam)}`
        );
        lastUpdated.value = new Date().toISOString();
      } catch (e) {
        error.value = e instanceof Error ? e.message : "Failed to fetch runs";
      } finally {
        loading.value = false;
      }
    }

    function toggleRepo(repoFullName: string) {
      const idx = selectedRepos.value.indexOf(repoFullName);
      if (idx >= 0) {
        selectedRepos.value.splice(idx, 1);
      } else {
        selectedRepos.value.push(repoFullName);
      }
    }

    function applyView(repos: string[], viewFilters: typeof filters.value | null): void {
      selectedRepos.value = [...repos];
      if (viewFilters) {
        filters.value = { ...viewFilters };
      } else {
        filters.value = { status: null, branch: null, workflow: null, event: null };
      }
    }

    function clearSelection(): void {
      selectedRepos.value = [];
      filters.value = { status: null, branch: null, workflow: null, event: null };
    }

    return {
      orgs,
      reposByOrg,
      selectedRepos,
      runs,
      loading,
      error,
      lastUpdated,
      refreshInterval,
      filters,
      filteredRuns,
      uniqueBranches,
      uniqueWorkflows,
      uniqueEvents,
      fetchOrgs,
      fetchRepos,
      fetchRuns,
      toggleRepo,
      applyView,
      clearSelection,
    };
  },
  {
    persist: {
      pick: ["selectedRepos", "refreshInterval"],
    },
  }
);
