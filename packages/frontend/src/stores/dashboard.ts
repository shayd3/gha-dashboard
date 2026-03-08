import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  Organization,
  Repository,
  WorkflowRun,
  DashboardFilters,
} from "@gha-dashboard/shared";
import { apiFetch } from "../composables/useApi.js";
import { useAuthStore } from "./auth.js";

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

    const defaultFilters = (): DashboardFilters => ({
      status: null,
      branch: null,
      workflow: null,
      event: null,
    });

    const filters = ref<DashboardFilters>(defaultFilters());

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
        let url = `/api/runs?repos=${encodeURIComponent(reposParam)}`;

        // Build upstream_repos param for fork repos
        const includeUpstream = filters.value.includeUpstreamRuns !== false; // default true
        if (includeUpstream) {
          const auth = useAuthStore();
          const actor = auth.user?.login;
          if (actor) {
            // Ensure repo metadata is loaded for all owners of the selected repos
            // (selectedRepos may be restored from persistence before fetchRepos is called)
            const selectedOwners = [
              ...new Set(
                selectedRepos.value.map((r) => r.split("/")[0]).filter(Boolean)
              ),
            ];
            const missingOwners = selectedOwners.filter(
              (owner) => !reposByOrg.value[owner]
            );
            if (missingOwners.length) {
              await Promise.all(missingOwners.map((owner) => fetchRepos(owner)));
            }

            const allRepos = Object.values(reposByOrg.value).flat();
            const selectedSet = new Set(selectedRepos.value);
            const upstreamEntries: string[] = [];
            for (const repoFullName of selectedRepos.value) {
              const repo = allRepos.find((r) => r.fullName === repoFullName);
              if (repo?.isFork && repo.parent) {
                // Skip if the upstream repo is already directly selected
                // (its runs are already being fetched, no need to duplicate)
                if (selectedSet.has(repo.parent.fullName)) continue;
                // Format: upstreamOwner/upstreamRepo:actor:forkOwner/forkRepo
                upstreamEntries.push(`${repo.parent.fullName}:${actor}:${repo.fullName}`);
              }
            }
            if (upstreamEntries.length) {
              url += `&upstream_repos=${encodeURIComponent(upstreamEntries.join(","))}`;
            }
          }
        }

        runs.value = await apiFetch<WorkflowRun[]>(url);
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
        filters.value = defaultFilters();
      }
    }

    async function selectAllRepos(): Promise<void> {
      // Ensure repos are loaded for every org
      await Promise.all(
        orgs.value
          .filter((o) => !reposByOrg.value[o.login])
          .map((o) => fetchRepos(o.login))
      );
      const all = Object.values(reposByOrg.value).flat().map((r) => r.fullName);
      selectedRepos.value = all;
      filters.value = defaultFilters();
    }

    function clearSelection(): void {
      selectedRepos.value = [];
      filters.value = defaultFilters();
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
      selectAllRepos,
      clearSelection,
    };
  },
  {
    persist: {
      pick: ["selectedRepos", "refreshInterval"],
    },
  }
);
