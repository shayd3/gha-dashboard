<script setup lang="ts">
import { computed } from "vue";
import type { WorkflowRunStatus, WorkflowRunConclusion } from "@gha-dashboard/shared";

const props = defineProps<{
  status: WorkflowRunStatus;
  conclusion: WorkflowRunConclusion;
}>();

const display = computed(() => {
  if (props.status === "completed" && props.conclusion) {
    return conclusionConfig[props.conclusion] ?? { label: props.conclusion, cls: "neutral" };
  }
  return statusConfig[props.status] ?? { label: props.status, cls: "neutral" };
});

const conclusionConfig: Record<string, { label: string; cls: string }> = {
  success: { label: "Success", cls: "success" },
  failure: { label: "Failure", cls: "failure" },
  cancelled: { label: "Cancelled", cls: "cancelled" },
  skipped: { label: "Skipped", cls: "skipped" },
  timed_out: { label: "Timed Out", cls: "failure" },
  action_required: { label: "Action Required", cls: "warning" },
  neutral: { label: "Neutral", cls: "neutral" },
  stale: { label: "Stale", cls: "neutral" },
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  queued: { label: "Queued", cls: "queued" },
  in_progress: { label: "In Progress", cls: "in-progress" },
  waiting: { label: "Waiting", cls: "queued" },
  pending: { label: "Pending", cls: "queued" },
  requested: { label: "Requested", cls: "queued" },
};
</script>

<template>
  <span class="badge" :class="display.cls">
    {{ display.label }}
  </span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 0.175rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.success {
  background: #dcfce7;
  color: #166534;
}

.failure {
  background: #fee2e2;
  color: #991b1b;
}

.cancelled {
  background: #f3f4f6;
  color: #4b5563;
}

.skipped {
  background: #f3f4f6;
  color: #6b7280;
}

.warning {
  background: #fef9c3;
  color: #854d0e;
}

.neutral {
  background: #e5e7eb;
  color: #374151;
}

.queued {
  background: #fef3c7;
  color: #92400e;
}

.in-progress {
  background: #dbeafe;
  color: #1e40af;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}
</style>
