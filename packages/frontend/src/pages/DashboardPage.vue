<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useDashboardStore } from "../stores/dashboard.js";
import { usePolling } from "../composables/usePolling.js";
import AppHeader from "../components/AppHeader.vue";
import OrgRepoSelector from "../components/OrgRepoSelector.vue";
import WorkflowRunsTable from "../components/WorkflowRunsTable.vue";

const dashboard = useDashboardStore();
const refreshInterval = ref(dashboard.refreshInterval);

watch(refreshInterval, (val) => {
  dashboard.refreshInterval = val;
});

const { isPolling, start, refreshNow } = usePolling(
  () => dashboard.fetchRuns(),
  refreshInterval
);

onMounted(async () => {
  await dashboard.fetchOrgs();
  if (dashboard.selectedRepos.length) {
    await dashboard.fetchRuns();
  }
  start();
});

watch(
  () => dashboard.selectedRepos,
  () => {
    dashboard.fetchRuns();
  },
  { deep: true }
);

const refreshOptions = [
  { label: "15s", value: 15 },
  { label: "30s", value: 30 },
  { label: "60s", value: 60 },
  { label: "5m", value: 300 },
];
</script>

<template>
  <div class="dashboard">
    <AppHeader />
    <div class="dashboard-body">
      <aside class="sidebar">
        <OrgRepoSelector />
      </aside>
      <main class="main-content">
        <div class="toolbar">
          <div class="filters">
            <select
              v-model="dashboard.filters.status"
              multiple
              class="filter-select"
            >
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="cancelled">Cancelled</option>
              <option :value="null">In Progress</option>
            </select>
            <input
              v-model="dashboard.filters.branch"
              type="text"
              placeholder="Filter branch..."
              class="filter-input"
            />
            <input
              v-model="dashboard.filters.workflow"
              type="text"
              placeholder="Filter workflow..."
              class="filter-input"
            />
            <select v-model="dashboard.filters.event" class="filter-select">
              <option :value="null">All events</option>
              <option
                v-for="event in dashboard.uniqueEvents"
                :key="event"
                :value="event"
              >
                {{ event }}
              </option>
            </select>
          </div>
          <div class="refresh-controls">
            <select v-model.number="refreshInterval" class="refresh-select">
              <option
                v-for="opt in refreshOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </option>
            </select>
            <button
              class="refresh-btn"
              :disabled="dashboard.loading"
              @click="refreshNow"
            >
              <i class="pi pi-refresh" :class="{ 'pi-spin': dashboard.loading }" />
              Refresh
            </button>
          </div>
        </div>
        <WorkflowRunsTable />
      </main>
    </div>
    <footer class="dashboard-footer">
      <span v-if="dashboard.lastUpdated">
        Last updated: {{ new Date(dashboard.lastUpdated).toLocaleTimeString() }}
      </span>
      <span v-if="isPolling" class="polling-indicator">
        <i class="pi pi-circle-fill" style="color: #22c55e; font-size: 0.5rem" />
        Auto-refresh active
      </span>
    </footer>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.dashboard-body {
  display: flex;
  flex: 1;
  gap: 0;
}

.sidebar {
  width: 280px;
  min-width: 280px;
  background: #fff;
  border-right: 1px solid #e2e8f0;
  padding: 1rem;
  overflow-y: auto;
  max-height: calc(100vh - 120px);
}

.main-content {
  flex: 1;
  padding: 1rem;
  overflow-x: auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.filter-input,
.filter-select {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
}

.filter-input {
  width: 160px;
}

.refresh-controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.refresh-select {
  padding: 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
}

.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  cursor: pointer;
}

.refresh-btn:hover {
  background: #2563eb;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dashboard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  font-size: 0.8rem;
  color: #64748b;
}

.polling-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}
</style>
