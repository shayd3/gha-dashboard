<script setup lang="ts">
import { computed } from "vue";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
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
    <div v-if="!dashboard.selectedRepos.length" class="empty-state">
      <i class="pi pi-inbox" style="font-size: 2rem; color: #cbd5e1" />
      <p>Select repositories from the sidebar to view workflow runs.</p>
    </div>
    <div v-else-if="dashboard.error" class="error-state">
      <i class="pi pi-exclamation-triangle" />
      {{ dashboard.error }}
    </div>
    <DataTable
      v-else
      :value="rows"
      :loading="dashboard.loading"
      :paginator="rows.length > 25"
      :rows="25"
      :rowsPerPageOptions="[10, 25, 50]"
      sortField="createdAt"
      :sortOrder="-1"
      stripedRows
      size="small"
      tableStyle="min-width: 50rem"
    >
      <Column field="repoFullName" header="Repository" sortable style="width: 15%">
        <template #body="{ data }">
          <a
            :href="`https://github.com/${(data as WorkflowRun).repoFullName}`"
            target="_blank"
            class="repo-link"
          >
            {{ (data as WorkflowRun).repoFullName.split("/")[1] }}
          </a>
        </template>
      </Column>
      <Column field="name" header="Workflow" sortable style="width: 18%" />
      <Column field="headBranch" header="Branch" sortable style="width: 12%">
        <template #body="{ data }">
          <code class="branch-name">{{ (data as WorkflowRun).headBranch }}</code>
        </template>
      </Column>
      <Column field="status" header="Status" sortable style="width: 10%">
        <template #body="{ data }">
          <StatusBadge
            :status="(data as WorkflowRun).status"
            :conclusion="(data as WorkflowRun).conclusion"
          />
        </template>
      </Column>
      <Column field="duration" header="Duration" sortable style="width: 8%">
        <template #body="{ data }">
          {{ formatDuration((data as WorkflowRun).duration) }}
        </template>
      </Column>
      <Column field="event" header="Trigger" sortable style="width: 8%" />
      <Column field="actor.login" header="Actor" sortable style="width: 10%">
        <template #body="{ data }">
          <div class="actor-cell">
            <img
              :src="(data as WorkflowRun).actor.avatarUrl"
              class="actor-avatar"
            />
            {{ (data as WorkflowRun).actor.login }}
          </div>
        </template>
      </Column>
      <Column field="createdAt" header="Time" sortable style="width: 12%">
        <template #body="{ data }">
          <span :title="formatTime((data as WorkflowRun).createdAt)">
            {{ timeAgo((data as WorkflowRun).createdAt) }}
          </span>
        </template>
      </Column>
      <Column style="width: 5%">
        <template #body="{ data }">
          <a :href="(data as WorkflowRun).url" target="_blank" class="run-link">
            <i class="pi pi-external-link" />
          </a>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.runs-table-wrapper {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem;
  color: #94a3b8;
  text-align: center;
}

.error-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  color: #dc2626;
  background: #fef2f2;
}

.repo-link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}

.repo-link:hover {
  text-decoration: underline;
}

.branch-name {
  font-size: 0.8rem;
  background: #f1f5f9;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.actor-cell {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.actor-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
}

.run-link {
  color: #64748b;
}

.run-link:hover {
  color: #3b82f6;
}
</style>
