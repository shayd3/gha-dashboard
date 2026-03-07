<script setup lang="ts">
import { ref, computed } from "vue";
import { useViewsStore } from "../stores/views.js";
import { useDashboardStore } from "../stores/dashboard.js";
import Dialog from "primevue/dialog";
import Button from "primevue/button";

const views = useViewsStore();
const dashboard = useDashboardStore();

/** "All repos" is active when no view is selected and every loaded repo is checked. */
const allLoadedRepos = computed(() => Object.values(dashboard.reposByOrg).flat());
const selectedReposSet = computed(() => new Set(dashboard.selectedRepos));

const allReposActive = computed(() => {
  if (views.activeViewId !== null) return false;
  const allLoaded = allLoadedRepos.value;
  if (allLoaded.length === 0) return false;
  const selectedSet = selectedReposSet.value;
  return allLoaded.every((r) => selectedSet.has(r.fullName));
});

const newViewName = ref("");
const showInput = ref(false);
const editingId = ref<string | null>(null);
const editingName = ref("");
const confirmDeleteId = ref<string | null>(null);
const saving = ref(false);
const savingView = ref(false);
const error = ref<string | null>(null);

const showDirtyDialog = computed(() => views.pendingAction !== null);

async function saveNewView() {
  const name = newViewName.value.trim();
  if (!name) return;
  saving.value = true;
  error.value = null;
  try {
    await views.createView(name);
    newViewName.value = "";
    showInput.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to save view";
  } finally {
    saving.value = false;
  }
}

function startEdit(id: string, currentName: string) {
  editingId.value = id;
  editingName.value = currentName;
}

async function commitRename(id: string) {
  const name = editingName.value.trim();
  if (!name) {
    editingId.value = null;
    return;
  }
  try {
    await views.updateView(id, { name });
  } catch {
    // ignore
  } finally {
    editingId.value = null;
  }
}

async function confirmDelete(id: string) {
  await views.deleteView(id);
  confirmDeleteId.value = null;
}

/** Save the active view's current repos + filters without switching. */
async function handleSaveView() {
  savingView.value = true;
  try {
    await views.saveActiveView();
  } finally {
    savingView.value = false;
  }
}

/** Handle dirty-dialog "Save & Switch" */
async function handleSaveAndSwitch() {
  savingView.value = true;
  try {
    await views.confirmPendingAction();
  } finally {
    savingView.value = false;
  }
}
</script>

<template>
  <div class="view-switcher">
    <div class="view-switcher-header">
      <span class="view-switcher-title">VIEWS</span>
    </div>

    <!-- All repos (default) -->
    <button
      class="view-item"
      :class="{ active: allReposActive }"
      @click="views.clearActiveView()"
    >
      <i class="pi pi-th-large view-icon" />
      <span class="view-name">All repos</span>
    </button>

    <!-- Saved views -->
    <div v-for="view in views.views" :key="view.id" class="view-item-wrapper">
      <div
        v-if="confirmDeleteId === view.id"
        class="delete-confirm"
      >
        <span>Delete "{{ view.name }}"?</span>
        <button class="icon-btn-confirm danger" @click="confirmDelete(view.id)" title="Confirm delete">
          <i class="pi pi-check" />
        </button>
        <button class="icon-btn-confirm" @click="confirmDeleteId = null" title="Cancel">
          <i class="pi pi-times" />
        </button>
      </div>

      <div
        v-else-if="editingId === view.id"
        class="rename-row"
      >
        <input
          v-model="editingName"
          class="rename-input"
          @keydown.enter="commitRename(view.id)"
          @keydown.escape="editingId = null"
          @blur="commitRename(view.id)"
          autofocus
        />
      </div>

      <template v-else>
        <div
          class="view-item"
          :class="{ active: views.activeViewId === view.id }"
          role="button"
          tabindex="0"
          @click="views.activateView(view.id)"
          @keydown.enter="views.activateView(view.id)"
          @keydown.space.prevent="views.activateView(view.id)"
        >
          <i class="pi pi-bookmark view-icon" />
          <span class="view-name">{{ view.name }}</span>

          <button
            v-if="views.activeViewId === view.id && views.isDirty"
            class="icon-btn save"
            v-tooltip.top="'Save changes'"
            :disabled="savingView"
            @click.stop="handleSaveView"
          >
            <i class="pi pi-check" />
          </button>
          <button
            class="icon-btn"
            v-tooltip.top="'Rename'"
            @click.stop="startEdit(view.id, view.name)"
          >
            <i class="pi pi-pencil" />
          </button>
          <button
            class="icon-btn danger"
            v-tooltip.top="'Delete'"
            @click.stop="confirmDeleteId = view.id"
          >
            <i class="pi pi-trash" />
          </button>
        </div>
      </template>
    </div>

    <!-- Save current as view -->
    <div v-if="showInput" class="save-view-row">
      <input
        v-model="newViewName"
        class="save-input"
        placeholder="View name…"
        @keydown.enter="saveNewView"
        @keydown.escape="showInput = false"
        autofocus
      />
      <button class="icon-btn-confirm save" :disabled="saving" @click="saveNewView" title="Save" aria-label="Save view">
        <i class="pi pi-save" />
      </button>
      <button class="icon-btn-confirm" @click="showInput = false" title="Cancel" aria-label="Cancel">
        <i class="pi pi-times" />
      </button>
    </div>
    <p v-if="error" class="save-error">{{ error }}</p>

    <button v-if="!showInput" class="save-view-btn" @click="showInput = true">
      <i class="pi pi-plus" />
      Save current as view
    </button>

    <div class="view-divider" />

    <!-- Unsaved-changes confirmation dialog -->
    <Dialog
      :visible="showDirtyDialog"
      modal
      header="Unsaved Changes"
      :closable="false"
      :style="{ width: '24rem' }"
    >
      <p class="dirty-dialog-body">
        You have unsaved changes to this view. Would you like to save them before switching?
      </p>
      <template #footer>
        <div class="dirty-dialog-footer">
          <Button label="Cancel" severity="secondary" text @click="views.cancelPendingAction()" />
          <Button label="Discard" severity="secondary" outlined @click="views.discardPendingAction()" />
          <Button :label="savingView ? 'Saving…' : 'Save & Switch'" severity="primary" :disabled="savingView" @click="handleSaveAndSwitch" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.view-switcher {
  margin-bottom: 0.75rem;
}

.view-switcher-header {
  padding: 0 0.25rem;
  margin-bottom: 0.375rem;
}

.view-switcher-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
}

.view-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--p-text-color);
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.82rem;
  text-align: left;
  transition: background 0.15s;
}

.view-item:hover {
  background: var(--p-surface-700);
}

.view-item.active {
  background: color-mix(in srgb, var(--p-primary-500) 18%, transparent);
  color: var(--p-primary-300);
  font-weight: 600;
}

.view-icon {
  font-size: 0.75rem;
  flex-shrink: 0;
  color: var(--p-text-muted-color);
}

.view-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-btn {
  border: none;
  background: transparent;
  color: var(--p-text-muted-color);
  cursor: pointer;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-size: 0.65rem;
  opacity: 0;
  transition: opacity 0.1s, color 0.1s;
}

.view-item:hover .icon-btn {
  opacity: 1;
}

.view-item.active .icon-btn {
  opacity: 1;
}

.icon-btn:hover {
  color: var(--p-text-color);
}

.icon-btn.danger:hover {
  color: var(--p-red-400);
}

.view-item-wrapper {
  position: relative;
}

.delete-confirm,
.rename-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3rem 0.5rem;
  font-size: 0.8rem;
  color: var(--p-text-color);
}

.icon-btn-confirm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--p-text-muted-color);
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 4px;
  font-size: 0.75rem;
  transition: color 0.15s, background 0.15s;
}

.icon-btn-confirm:hover {
  background: var(--p-surface-600);
  color: var(--p-text-color);
}

.icon-btn-confirm.save {
  color: var(--p-green-400);
}

.icon-btn-confirm.save:hover {
  color: var(--p-green-300);
  background: var(--p-surface-600);
}

.icon-btn-confirm.danger:hover {
  color: var(--p-red-400);
}

.rename-input,
.save-input {
  flex: 1;
  background: var(--p-surface-800);
  border: 1px solid var(--p-surface-600);
  border-radius: 4px;
  color: var(--p-text-color);
  font-size: 0.8rem;
  padding: 0.25rem 0.5rem;
  outline: none;
}

.rename-input:focus,
.save-input:focus {
  border-color: var(--p-primary-500);
}

.save-view-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3rem 0.25rem;
  margin-top: 0.25rem;
}

.save-view-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.35rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--p-text-muted-color);
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.78rem;
  text-align: left;
  margin-top: 0.125rem;
  transition: background 0.15s, color 0.15s;
}

.save-view-btn:hover {
  background: var(--p-surface-700);
  color: var(--p-text-color);
}

.btn-primary-sm,
.btn-ghost-sm,
.btn-danger-sm {
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
  white-space: nowrap;
}

.btn-primary-sm {
  background: var(--p-primary-600);
  color: #fff;
}

.btn-primary-sm:disabled {
  opacity: 0.5;
}

.btn-ghost-sm {
  background: var(--p-surface-600);
  color: var(--p-text-color);
}

.btn-danger-sm {
  background: var(--p-red-700);
  color: #fff;
}

.save-error {
  font-size: 0.75rem;
  color: var(--p-red-400);
  padding: 0 0.5rem;
  margin: 0.125rem 0 0;
}

.view-divider {
  height: 1px;
  background: var(--p-surface-700);
  margin: 0.75rem 0;
}

/* ---- dirty-state styles ---- */

.icon-btn.save {
  color: var(--p-green-400);
  opacity: 1;
}

.icon-btn.save:hover {
  color: var(--p-green-300);
}

.dirty-dialog-body {
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.5;
  color: var(--p-text-color);
}

.dirty-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
