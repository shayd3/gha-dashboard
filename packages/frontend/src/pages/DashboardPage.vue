<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useDashboardStore } from "../stores/dashboard.js";
import { usePolling } from "../composables/usePolling.js";
import AppHeader from "../components/AppHeader.vue";
import OrgRepoSelector from "../components/OrgRepoSelector.vue";
import WorkflowRunsTable from "../components/WorkflowRunsTable.vue";
import InputText from "primevue/inputtext";
import MultiSelect from "primevue/multiselect";
import Select from "primevue/select";
import Button from "primevue/button";

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

const statusOptions = [
  { label: "Success", value: "success" },
  { label: "Failure", value: "failure" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Skipped", value: "skipped" },
  { label: "Timed Out", value: "timed_out" },
];

const eventOptions = ref<{ label: string; value: string }[]>([]);
watch(
  () => dashboard.uniqueEvents,
  (events) => {
    eventOptions.value = events.map((e) => ({ label: e, value: e }));
  },
  { immediate: true }
);
</script>

<template>
  <div class="dashboard">
    <AppHeader />
    <div class="dashboard-body">
      <aside class="sidebar">
        <OrgRepoSelector />
      </aside>
      <main class="main-content">
        <!-- Toolbar -->
        <div class="toolbar-card">
          <div class="filters-row">
            <MultiSelect
              v-model="dashboard.filters.status"
              :options="statusOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="All statuses"
              :maxSelectedLabels="2"
              class="filter-multiselect"
              display="chip"
            />
            <InputText
              v-model="dashboard.filters.branch"
              placeholder="Filter branch..."
              class="filter-input"
              size="small"
            />
            <InputText
              v-model="dashboard.filters.workflow"
              placeholder="Filter workflow..."
              class="filter-input"
              size="small"
            />
            <Select
              v-model="dashboard.filters.event"
              :options="eventOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="All events"
              showClear
              class="filter-select"
            />
          </div>
          <div class="refresh-row">
            <Select
              v-model="refreshInterval"
              :options="refreshOptions"
              optionLabel="label"
              optionValue="value"
              class="refresh-select"
            />
            <Button
              :icon="`pi pi-refresh${dashboard.loading ? ' pi-spin' : ''}`"
              label="Refresh"
              severity="primary"
              :loading="dashboard.loading"
              @click="refreshNow"
            />
          </div>
        </div>

        <WorkflowRunsTable />
      </main>
    </div>

    <!-- Footer -->
    <footer class="dashboard-footer">
      <span v-if="dashboard.lastUpdated" class="footer-text">
        <i class="pi pi-clock" style="font-size: 0.75rem" />
        Updated {{ new Date(dashboard.lastUpdated).toLocaleTimeString() }}
      </span>
      <span v-if="isPolling" class="polling-indicator">
        <span class="pulse-dot" />
        Auto-refreshing
      </span>
    </footer>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--p-surface-950);
}

.dashboard-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  min-width: 260px;
  background: var(--p-surface-900);
  border-right: 1px solid var(--p-surface-700);
  padding: 1rem 0.75rem;
  overflow-y: auto;
  height: calc(100vh - 56px - 36px);
}

.main-content {
  flex: 1;
  padding: 1rem 1.25rem;
  overflow-x: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Toolbar */
.toolbar-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.625rem 1rem;
  background: var(--p-surface-800);
  border: 1px solid var(--p-surface-700);
  border-radius: 10px;
}

.filters-row {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.refresh-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.filter-input {
  width: 150px;
}

.filter-select {
  width: 145px;
}

.filter-multiselect {
  width: 175px;
}

.refresh-select {
  width: 110px;
}

/* Footer */
.dashboard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.25rem;
  height: 36px;
  background: var(--p-surface-900);
  border-top: 1px solid var(--p-surface-700);
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.footer-text {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.polling-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--p-green-500);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
}
</style>
