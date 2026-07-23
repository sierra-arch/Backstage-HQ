// Re-exports the data-layer types from useDatabase.ts (which owns every
// fetch/hook in this app -- see useAutomationWeb there) so components in
// this feature folder import from one place.
export type {
  Automation,
  AutomationEdge,
  AutomationTriggerType,
  AutomationActionType,
  AutomationStatus,
  CompanyMember,
} from "../../useDatabase";
export { DEPARTMENTS } from "../../useDatabase";

export const TRIGGER_LABELS: Record<string, string> = {
  proposal_accepted: "Proposal accepted",
  deliverable_approved: "Deliverable approved",
  project_completed: "Project completed",
};

export const ACTION_LABELS: Record<string, string> = {
  create_project_and_tasks: "Create project + tasks",
  notify_team: "Notify the team",
  request_testimonial: "Request testimonial",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  waiting: "Waiting",
  paused: "Paused",
};
