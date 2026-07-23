// Client-side mirror of the department-clearance rules -- the real
// enforcement for edits is the `department_scoped_edit` RLS policy
// (migration 0028), this just decides what the UI shows/allows so a member
// never sees an edit affordance RLS would reject anyway. A founder's
// access can never be reduced by department scoping, on either check.
import type { Automation, CompanyMember } from "./types";

export function canViewAutomation(automation: Automation, isFounder: boolean, member: CompanyMember | null): boolean {
  if (isFounder) return true;
  // An unscoped node (the default for every seeded automation) has no
  // department restriction, so it stays visible to every company member --
  // "no blank canvas" would otherwise apply to founders only.
  if (automation.clearance_departments.length === 0) return true;
  if (!member) return false;
  return automation.clearance_departments.some((d) => member.departments.includes(d));
}

export function canEditAutomation(automation: Automation, isFounder: boolean, member: CompanyMember | null): boolean {
  if (isFounder) return true;
  // Unscoped nodes are founder-only to edit until a founder explicitly
  // tags them with a department -- matches the RLS policy exactly.
  if (automation.clearance_departments.length === 0) return false;
  if (!member) return false;
  return automation.clearance_departments.some((d) => member.departments.includes(d));
}
