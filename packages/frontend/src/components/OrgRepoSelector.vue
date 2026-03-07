<script setup lang="ts">
import { ref } from "vue";
import { useDashboardStore } from "../stores/dashboard.js";
import { useViewsStore } from "../stores/views.js";
import Checkbox from "primevue/checkbox";
import Badge from "primevue/badge";
import ViewSwitcher from "./ViewSwitcher.vue";

const dashboard = useDashboardStore();
const views = useViewsStore();
const expandedOrgs = ref<Set<string>>(new Set());

async function toggleOrg(orgLogin: string) {
  if (expandedOrgs.value.has(orgLogin)) {
    expandedOrgs.value.delete(orgLogin);
  } else {
    expandedOrgs.value.add(orgLogin);
    if (!dashboard.reposByOrg[orgLogin]) {
      await dashboard.fetchRepos(orgLogin);
    }
  }
}

function isRepoSelected(fullName: string) {
  return dashboard.selectedRepos.includes(fullName);
}

function selectAllOrgRepos(orgLogin: string) {
  const repos = dashboard.reposByOrg[orgLogin] || [];
  const allSelected = repos.every((r) =>
    dashboard.selectedRepos.includes(r.fullName)
  );

  if (allSelected) {
    repos.forEach((r) => {
      const idx = dashboard.selectedRepos.indexOf(r.fullName);
      if (idx >= 0) dashboard.selectedRepos.splice(idx, 1);
    });
  } else {
    repos.forEach((r) => {
      if (!dashboard.selectedRepos.includes(r.fullName)) {
        dashboard.selectedRepos.push(r.fullName);
      }
    });
  }
}

function isAllOrgSelected(orgLogin: string) {
  const repos = dashboard.reposByOrg[orgLogin] || [];
  return repos.length > 0 && repos.every((r) => dashboard.selectedRepos.includes(r.fullName));
}

function isSomeOrgSelected(orgLogin: string) {
  const repos = dashboard.reposByOrg[orgLogin] || [];
  return repos.some((r) => dashboard.selectedRepos.includes(r.fullName)) && !isAllOrgSelected(orgLogin);
}

function toggleRepoSelection(fullName: string) {
  dashboard.toggleRepo(fullName);
}
</script>

<template>
  <div class="org-repo-selector">
    <ViewSwitcher />

    <div class="selector-header">
      <span class="selector-title">ACCOUNTS</span>
      <Badge
        v-if="dashboard.selectedRepos.length"
        :value="dashboard.selectedRepos.length"
        severity="primary"
      />
      <button
        v-if="dashboard.selectedRepos.length"
        class="clear-selection-btn"
        title="Clear selection"
        @click="dashboard.clearSelection()"
      >
        <i class="pi pi-filter-slash" />
      </button>
    </div>

    <div v-if="!dashboard.orgs.length" class="loading-state">
      <i class="pi pi-spin pi-spinner" style="font-size: 1rem" />
      <span>Loading accounts...</span>
    </div>

    <ul class="org-list">
      <li v-for="org in dashboard.orgs" :key="org.id" class="org-item">
        <div
          class="org-header"
          @click="toggleOrg(org.login)"
          :class="{ expanded: expandedOrgs.has(org.login) }"
        >
          <i
            class="pi toggle-icon"
            :class="expandedOrgs.has(org.login) ? 'pi-chevron-down' : 'pi-chevron-right'"
          />
          <img :src="org.avatarUrl" :alt="org.login" class="org-avatar" />
          <span class="org-name">{{ org.login }}</span>
        </div>

        <div v-if="expandedOrgs.has(org.login)" class="repo-list-wrapper">
          <!-- Toggle All -->
          <div
            class="toggle-all-row"
            @click="selectAllOrgRepos(org.login)"
          >
            <Checkbox
              :modelValue="isAllOrgSelected(org.login)"
              :indeterminate="isSomeOrgSelected(org.login)"
              binary
              @click.stop
              @change="selectAllOrgRepos(org.login)"
            />
            <span class="toggle-all-label">Toggle all</span>
          </div>

          <div v-if="!dashboard.reposByOrg[org.login]" class="loading-repos">
            <i class="pi pi-spin pi-spinner" style="font-size: 0.75rem" />
            Loading...
          </div>
          <ul v-else class="repo-list">
            <li
              v-for="repo in dashboard.reposByOrg[org.login]"
              :key="repo.id"
              class="repo-item"
              :class="{ selected: isRepoSelected(repo.fullName) }"
              @click="toggleRepoSelection(repo.fullName)"
            >
              <Checkbox
                :modelValue="isRepoSelected(repo.fullName)"
                binary
                @click.stop
                @change="toggleRepoSelection(repo.fullName)"
              />
              <span class="repo-name">{{ repo.name }}</span>
              <i
                v-if="repo.private"
                class="pi pi-lock repo-lock"
              />
            </li>
          </ul>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.org-repo-selector {
  font-size: 0.85rem;
}

.selector-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.875rem;
  padding: 0 0.25rem;
}

.selector-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
  margin-right: auto;
}

.clear-selection-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--p-text-muted-color);
  cursor: pointer;
  padding: 0.15rem;
  border-radius: 4px;
  font-size: 0.7rem;
  transition: color 0.15s, background 0.15s;
}

.clear-selection-btn:hover {
  background: var(--p-surface-600);
  color: var(--p-text-color);
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.25rem;
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
}

.org-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.org-item {
  border-radius: 6px;
  overflow: hidden;
}

.org-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.425rem 0.5rem;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
  color: var(--p-text-color);
}

.org-header:hover {
  background: var(--p-surface-700);
}

.toggle-icon {
  font-size: 0.65rem;
  color: var(--p-text-muted-color);
  width: 10px;
  flex-shrink: 0;
}

.org-avatar {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  flex-shrink: 0;
}

.org-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.repo-list-wrapper {
  margin-left: 1.25rem;
  margin-top: 2px;
  margin-bottom: 4px;
  border-left: 1px solid var(--p-surface-700);
  padding-left: 0.625rem;
}

.toggle-all-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.25rem;
  cursor: pointer;
  border-radius: 4px;
}

.toggle-all-row:hover {
  background: var(--p-surface-700);
}

.toggle-all-label {
  font-size: 0.775rem;
  color: var(--p-primary-400);
  font-weight: 500;
}

.repo-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 2px;
}

.repo-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.25rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;
  color: var(--p-text-color);
}

.repo-item:hover {
  background: var(--p-surface-700);
}

.repo-item.selected {
  background: color-mix(in srgb, var(--p-primary-500) 12%, transparent);
}

.repo-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  font-size: 0.8rem;
}

.repo-lock {
  font-size: 0.65rem;
  color: var(--p-text-muted-color);
  flex-shrink: 0;
}

.loading-repos {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.25rem;
  color: var(--p-text-muted-color);
  font-size: 0.775rem;
}
</style>
