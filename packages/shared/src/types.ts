export interface User {
  id: number;
  login: string;
  avatarUrl: string;
  name: string | null;
}

export interface Organization {
  id: number;
  login: string;
  avatarUrl: string;
  description: string | null;
}

export interface Repository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  url: string;
}

export interface Workflow {
  id: number;
  name: string;
  path: string;
  state: "active" | "disabled_manually" | "disabled_inactivity";
  repoFullName: string;
}

export type WorkflowRunStatus =
  | "queued"
  | "in_progress"
  | "completed"
  | "waiting"
  | "requested"
  | "pending";

export type WorkflowRunConclusion =
  | "success"
  | "failure"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required"
  | "neutral"
  | "stale"
  | null;

export interface WorkflowRun {
  id: number;
  name: string;
  workflowId: number;
  repoFullName: string;
  headBranch: string;
  headSha: string;
  status: WorkflowRunStatus;
  conclusion: WorkflowRunConclusion;
  event: string;
  actor: {
    login: string;
    avatarUrl: string;
  };
  runNumber: number;
  runAttempt: number;
  createdAt: string;
  updatedAt: string;
  runStartedAt: string;
  url: string;
  duration: number | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  perPage: number;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

export interface AuthState {
  authenticated: boolean;
  user: User | null;
}

export interface DashboardFilters {
  status: WorkflowRunConclusion[] | null;
  branch: string | null;
  workflow: string | null;
  event: string | null;
}

export interface View {
  id: string;
  userId: number;
  name: string;
  repos: string[];
  filters: DashboardFilters | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateViewInput {
  name: string;
  repos: string[];
  filters?: DashboardFilters;
}

export interface UpdateViewInput {
  name?: string;
  repos?: string[];
  filters?: DashboardFilters;
  position?: number;
}
