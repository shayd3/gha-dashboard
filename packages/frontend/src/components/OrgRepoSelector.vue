<script setup lang="ts">
import { ref } from "vue";
import { useDashboardStore } from "../stores/dashboard.js";

const dashboard = useDashboardStore();
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
</script>

<template>
  <div class="org-repo-selector">
    <h3 class="selector-title">Accounts</h3>
    <div v-if="!dashboard.orgs.length" class="empty-state">
      Loading accounts...
    </div>
    <ul class="org-list">
      <li v-for="org in dashboard.orgs" :key="org.id" class="org-item">
        <div class="org-header" @click="toggleOrg(org.login)">
          <i
            class="pi"
            :class="
              expandedOrgs.has(org.login) ? 'pi-chevron-down' : 'pi-chevron-right'
            "
          />
          <img :src="org.avatarUrl" :alt="org.login" class="org-avatar" />
          <span class="org-name">{{ org.login }}</span>
        </div>
        <div v-if="expandedOrgs.has(org.login)" class="repo-list-wrapper">
          <div class="select-all" @click="selectAllOrgRepos(org.login)">
            <i class="pi pi-check-square" />
            <span>Toggle all</span>
          </div>
          <ul v-if="dashboard.reposByOrg[org.login]" class="repo-list">
            <li
              v-for="repo in dashboard.reposByOrg[org.login]"
              :key="repo.id"
              class="repo-item"
              :class="{ selected: isRepoSelected(repo.fullName) }"
              @click="dashboard.toggleRepo(repo.fullName)"
            >
              <input
                type="checkbox"
                :checked="isRepoSelected(repo.fullName)"
                @click.stop
                @change="dashboard.toggleRepo(repo.fullName)"
              />
              <span class="repo-name">{{ repo.name }}</span>
              <i v-if="repo.private" class="pi pi-lock" style="font-size: 0.7rem; color: #9ca3af" />
            </li>
          </ul>
          <div v-else class="loading-repos">Loading repos...</div>
        </div>
      </li>
    </ul>
    <div v-if="dashboard.selectedRepos.length" class="selection-summary">
      {{ dashboard.selectedRepos.length }} repo(s) selected
    </div>
  </div>
</template>

<style scoped>
.org-repo-selector {
  font-size: 0.875rem;
}

.selector-title {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-bottom: 0.75rem;
}

.org-list {
  list-style: none;
}

.org-item {
  margin-bottom: 0.25rem;
}

.org-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.25rem;
  cursor: pointer;
  border-radius: 4px;
}

.org-header:hover {
  background: #f1f5f9;
}

.org-avatar {
  width: 20px;
  height: 20px;
  border-radius: 4px;
}

.org-name {
  font-weight: 500;
}

.repo-list-wrapper {
  margin-left: 1.5rem;
}

.select-all {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem;
  cursor: pointer;
  color: #3b82f6;
  font-size: 0.8rem;
}

.select-all:hover {
  text-decoration: underline;
}

.repo-list {
  list-style: none;
}

.repo-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem;
  cursor: pointer;
  border-radius: 4px;
}

.repo-item:hover {
  background: #f1f5f9;
}

.repo-item.selected {
  background: #eff6ff;
}

.repo-item input[type="checkbox"] {
  cursor: pointer;
}

.repo-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-repos {
  padding: 0.5rem;
  color: #94a3b8;
  font-size: 0.8rem;
}

.selection-summary {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e2e8f0;
  font-size: 0.8rem;
  color: #64748b;
}

.empty-state {
  color: #94a3b8;
  padding: 0.5rem 0;
}
</style>
