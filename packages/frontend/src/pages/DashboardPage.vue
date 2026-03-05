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
import Popover from "primevue/popover";

const dashboard = useDashboardStore();
const refreshInterval = ref(dashboard.refreshInterval);

watch(refreshInterval, (val) => {
  dashboard.refreshInterval = val;
});

const { isPolling, isPaused, sleepUntil, start, pause, resume, sleepFor, refreshNow } = usePolling(
  () => dashboard.fetchRuns(),
  refreshInterval
);

const sleepMenuRef = ref<InstanceType<typeof Popover> | null>(null);

function toggleSleepMenu(event: MouseEvent) {
  sleepMenuRef.value?.toggle(event);
}

function handleSleep(ms: number) {
  sleepFor(ms);
  sleepMenuRef.value?.hide();
}

function handlePause() {
  pause();
  sleepMenuRef.value?.hide();
}

function handleResume() {
  resume();
  sleepMenuRef.value?.hide();
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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

      <div v-if="isPolling" class="polling-controls">
        <!-- Sleeping state -->
        <button v-if="isPaused && sleepUntil" class="polling-btn sleep-btn" @click="resume" v-tooltip.top="'Click to resume'">
          <i class="pi pi-moon" />
          <span>Sleeping until {{ fmtTime(sleepUntil) }}</span>
        </button>
        <!-- Manually paused state -->
        <button v-else-if="isPaused" class="polling-btn paused-btn" @click="resume" v-tooltip.top="'Click to resume'">
          <i class="pi pi-pause-circle" />
          <span>Paused</span>
        </button>
        <!-- Active polling state -->
        <button v-else class="polling-btn active-btn" @click="pause" v-tooltip.top="'Click to pause'">
          <span class="pulse-dot" />
          <span>Auto-refreshing</span>
        </button>

        <!-- Moon / sleep menu -->
        <button class="sleep-menu-btn" @click="toggleSleepMenu" v-tooltip.top="'Sleep options'">
          <i class="pi pi-moon" />
        </button>

        <Popover ref="sleepMenuRef">
          <div class="sleep-menu">
            <p class="sleep-menu-title">Auto-refresh sleep</p>
            <button class="sleep-option" @click="handleSleep(15 * 60 * 1000)">
              <i class="pi pi-moon" /> 15 minutes
            </button>
            <button class="sleep-option" @click="handleSleep(30 * 60 * 1000)">
              <i class="pi pi-moon" /> 30 minutes
            </button>
            <button class="sleep-option" @click="handleSleep(60 * 60 * 1000)">
              <i class="pi pi-moon" /> 1 hour
            </button>
            <button class="sleep-option" @click="handleSleep(2 * 60 * 60 * 1000)">
              <i class="pi pi-moon" /> 2 hours
            </button>
            <div class="sleep-menu-divider" />
            <button class="sleep-option" @click="handlePause">
              <i class="pi pi-pause-circle" /> Disable until I resume
            </button>
            <template v-if="isPaused">
              <div class="sleep-menu-divider" />
              <button class="sleep-option resume-option" @click="handleResume">
                <i class="pi pi-play" /> Resume now
              </button>
            </template>
          </div>
        </Popover>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--p-surface-950);
}

.dashboard-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
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
  min-height: 0;
  padding: 1rem 1.25rem;
  overflow: hidden;
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

.polling-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
}

.polling-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.425rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  font-family: inherit;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  transition: background 0.15s;
  color: var(--p-text-muted-color);
}

.polling-btn:hover {
  background: var(--p-surface-700);
}

.active-btn {
  color: var(--p-text-muted-color);
}

.paused-btn {
  color: var(--p-orange-400);
}

.sleep-btn {
  color: var(--p-blue-300);
}

.sleep-menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--p-text-muted-color);
  padding: 0.2rem 0.35rem;
  border-radius: 4px;
  font-size: 0.75rem;
  transition: color 0.15s, background 0.15s;
}

.sleep-menu-btn:hover {
  color: var(--p-primary-400);
  background: var(--p-surface-700);
}

.pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--p-green-500);
  animation: pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
  50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
}

/* Sleep popover menu */
.sleep-menu {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 195px;
}

.sleep-menu-title {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--p-text-muted-color);
  padding: 0.125rem 0.5rem 0.375rem;
}

.sleep-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.625rem;
  font-size: 0.82rem;
  font-family: inherit;
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 6px;
  color: var(--p-text-color);
  width: 100%;
  text-align: left;
  transition: background 0.12s;
}

.sleep-option:hover {
  background: var(--p-surface-100);
}

.resume-option {
  color: var(--p-green-400);
}

.sleep-menu-divider {
  height: 1px;
  background: var(--p-surface-700);
  margin: 0.25rem 0;
}
</style>
