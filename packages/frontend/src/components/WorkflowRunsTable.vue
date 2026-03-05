<script setup lang="ts">
import { computed } from "vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Tag from "primevue/tag";
import { useDashboardStore } from "../stores/dashboard.js";
import StatusBadge from "./StatusBadge.vue";
import type { WorkflowRun } from "@gha-dashboard/shared";

const dashboard = useDashboardStore();

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const rows = computed(() => dashboard.filteredRuns);
</script>

<template>
  <div class="runs-table-wrapper">
    <!-- Empty state: no repos selected -->
    <div v-if="!dashboard.selectedRepos.length" class="empty-state">
      <div class="empty-icon-wrap">
        <i class="pi pi-inbox" />
      </div>
      <p class="empty-title">No repositories selected</p>
      <p class="empty-sub">Pick repositories from the sidebar to start monitoring.</p>
    </div>

    <!-- Error state -->
    <div v-else-if="dashboard.error" class="error-state">
      <i class="pi pi-exclamation-circle" />
      <span>{{ dashboard.error }}</span>
    </div>

    <!-- Data Table -->
    <DataTable
      v-else
      :value="rows"
      :loading="dashboard.loading"
      :paginator="rows.length > 25"
      :rows="25"
      :rowsPerPageOptions="[10, 25, 50]"
      sortField="createdAt"
      :sortOrder="-1"
      size="small"
      scrollable
      scrollHeight="flex"
      tableStyle="min-width: 52rem"
      class="runs-datatable"
    >
      <template #empty>
        <div class="table-empty">
          <i class="pi pi-filter-slash" />
          <span>No runs match your current filters.</span>
        </div>
      </template>

      <Column field="repoFullName" header="Repository" sortable style="width: 14%">
        <template #body="{ data }">
          <a
            :href="`https://github.com/${(data as WorkflowRun).repoFullName}`"
            target="_blank"
            class="repo-link"
          >
            <i class="pi pi-github" style="font-size: 0.75rem; opacity: 0.6" />
            {{ (data as WorkflowRun).repoFullName.split("/")[1] }}
          </a>
        </template>
      </Column>

      <Column field="name" header="Workflow" sortable style="width: 22%" />

      <Column field="headBranch" header="Branch" sortable style="width: 12%">
        <template #body="{ data }">
          <span class="branch-chip">
            <i class="pi pi-code-branch" style="font-size: 0.65rem" />
            {{ (data as WorkflowRun).headBranch }}
          </span>
        </template>
      </Column>

      <Column field="status" header="Status" sortable style="width: 11%">
        <template #body="{ data }">
          <StatusBadge
            :status="(data as WorkflowRun).status"
            :conclusion="(data as WorkflowRun).conclusion"
          />
        </template>
      </Column>

      <Column field="duration" header="Duration" sortable style="width: 8%">
        <template #body="{ data }">
          <span class="mono">{{ formatDuration((data as WorkflowRun).duration) }}</span>
        </template>
      </Column>

      <Column field="event" header="Trigger" sortable style="width: 9%">
        <template #body="{ data }">
          <Tag :value="(data as WorkflowRun).event" severity="secondary" />
        </template>
      </Column>

      <Column field="actor.login" header="Actor" sortable style="width: 11%">
        <template #body="{ data }">
          <div class="actor-cell">
            <img
              :src="(data as WorkflowRun).actor.avatarUrl"
              class="actor-avatar"
            />
            <span>{{ (data as WorkflowRun).actor.login }}</span>
          </div>
        </template>
      </Column>

      <Column field="createdAt" header="Time" sortable style="width: 10%">
        <template #body="{ data }">
          <span :title="formatTime((data as WorkflowRun).createdAt)" class="time-cell">
            {{ timeAgo((data as WorkflowRun).createdAt) }}
          </span>
        </template>
      </Column>

      <Column style="width: 3%">
        <template #body="{ data }">
          <a
            :href="(data as WorkflowRun).url"
            target="_blank"
            class="run-link"
            v-tooltip="'Open in GitHub'"
          >
            <i class="pi pi-external-link" />
          </a>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.runs-table-wrapper {
  background: var(--p-surface-800);
  border-radius: 10px;
  border: 1px solid var(--p-surface-700);
  overflow: hidden;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Empty / error states */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 4rem 2rem;
  color: var(--p-text-muted-color);
  text-align: center;
}

.empty-icon-wrap {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--p-surface-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.empty-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--p-text-color);
}

.empty-sub {
  font-size: 0.85rem;
}

.error-state {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 1rem 1.25rem;
  color: var(--p-red-400);
  background: color-mix(in srgb, var(--p-red-500) 10%, transparent);
}

.table-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
  padding: 2rem;
  color: var(--p-text-muted-color);
}

/* Cell content */
.repo-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--p-primary-400);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.85rem;
}

.repo-link:hover {
  color: var(--p-primary-300);
  text-decoration: underline;
}

.branch-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  font-family: ui-monospace, monospace;
  background: var(--p-surface-700);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  color: var(--p-text-color);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mono {
  font-family: ui-monospace, monospace;
  font-size: 0.82rem;
}

.actor-cell {
  display: flex;
  align-items: center;
  gap: 0.425rem;
  font-size: 0.82rem;
}

.actor-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  flex-shrink: 0;
}

.time-cell {
  font-size: 0.82rem;
  color: var(--p-text-color);
}

.run-link {
  color: var(--p-text-muted-color);
  transition: color 0.15s;
  font-size: 0.85rem;
}

.run-link:hover {
  color: var(--p-primary-400);
}

/* Force dark background on DataTable */
:deep(.p-datatable-table-container) {
  background: var(--p-surface-800);
}

:deep(.p-datatable-header-cell) {
  background: var(--p-surface-900) !important;
  color: var(--p-text-muted-color);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--p-surface-700) !important;
}

:deep(.p-datatable-tbody > tr > td) {
  background: var(--p-surface-800);
  color: var(--p-text-color);
  border-bottom: 1px solid var(--p-surface-700) !important;
}

:deep(.p-datatable-tbody > tr:nth-child(even) > td) {
  background: var(--p-surface-850, color-mix(in srgb, var(--p-surface-800) 60%, var(--p-surface-900)));
}

:deep(.p-datatable-tbody > tr:hover > td) {
  background: var(--p-surface-700) !important;
  color: var(--p-text-color) !important;
}

:deep(.p-datatable-paginator-bottom) {
  background: var(--p-surface-900);
  border-top: 1px solid var(--p-surface-700);
}
</style>
