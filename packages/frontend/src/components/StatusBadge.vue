<script setup lang="ts">
import { computed } from "vue";
import Tag from "primevue/tag";
import type { WorkflowRunStatus, WorkflowRunConclusion } from "@gha-dashboard/shared";

const props = defineProps<{
  status: WorkflowRunStatus;
  conclusion: WorkflowRunConclusion;
}>();

type TagSeverity = "success" | "info" | "warn" | "danger" | "secondary" | "contrast";

const display = computed<{ label: string; severity: TagSeverity; icon: string }>(() => {
  if (props.status === "completed" && props.conclusion) {
    return conclusionConfig[props.conclusion] ?? { label: props.conclusion, severity: "secondary", icon: "pi-minus" };
  }
  return statusConfig[props.status] ?? { label: props.status, severity: "secondary", icon: "pi-minus" };
});

const conclusionConfig: Record<string, { label: string; severity: TagSeverity; icon: string }> = {
  success: { label: "Success", severity: "success", icon: "pi-check" },
  failure: { label: "Failure", severity: "danger", icon: "pi-times" },
  cancelled: { label: "Cancelled", severity: "secondary", icon: "pi-ban" },
  skipped: { label: "Skipped", severity: "secondary", icon: "pi-forward" },
  timed_out: { label: "Timed Out", severity: "danger", icon: "pi-clock" },
  action_required: { label: "Action Required", severity: "warn", icon: "pi-exclamation-triangle" },
  neutral: { label: "Neutral", severity: "secondary", icon: "pi-minus" },
  stale: { label: "Stale", severity: "secondary", icon: "pi-minus" },
};

const statusConfig: Record<string, { label: string; severity: TagSeverity; icon: string }> = {
  queued: { label: "Queued", severity: "warn", icon: "pi-clock" },
  in_progress: { label: "In Progress", severity: "info", icon: "pi-spin pi-spinner" },
  waiting: { label: "Waiting", severity: "warn", icon: "pi-hourglass" },
  pending: { label: "Pending", severity: "warn", icon: "pi-hourglass" },
  requested: { label: "Requested", severity: "warn", icon: "pi-hourglass" },
};
</script>

<template>
  <Tag :severity="display.severity" :value="display.label" :icon="`pi ${display.icon}`" />
</template>
