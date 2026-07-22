// projectAutomation.ts
//
// Shared, pure logic for the "proposal accepted" kickoff automation. This is
// the thing that finally closes the Client Journey stage-automation gap that
// was deferred back in Milestone 3 pending Milestone 5/6 trigger events --
// and it doubles as the real (not simulated) "quick win" step in the Getting
// Started wizard. Both the live client-portal accept flow
// (submit-proposal-selections.ts, via the admin/service-role client) and the
// wizard (DashboardApp/OnboardingWizard.tsx, via the browser client under a
// team member's own session + team_full_access RLS) build their task list
// from this one source of truth, so the wizard's demo is honestly the same
// automation a real client triggers -- not a fake animation.
//
// Deliberately framework/client-agnostic: it only describes *what* to
// create, never *how* to write it, since the two call sites use different
// Supabase client instances.

export interface KickoffTaskPlan {
  title: string;
  description: string;
  /**
   * If true, this task is created already completed -- this is the literal
   * "first thing forever checked off your to-do list" moment: Backstage did
   * it automatically the instant the proposal was accepted, so there is
   * nothing left for a human to do.
   */
  autoComplete: boolean;
}

/**
 * The starter task list created the moment a client accepts a proposal.
 * Keep this short and concrete -- these are meant to be genuinely useful
 * kickoff steps, not filler.
 */
export function buildKickoffTasks(clientName: string): KickoffTaskPlan[] {
  return [
    {
      title: `Set up payment schedule for ${clientName}`,
      description:
        "Backstage automatically built and attached this the moment the proposal was accepted \u2014 nothing left for you to do here.",
      autoComplete: true,
    },
    {
      title: `Send a welcome message to ${clientName}`,
      description: "A quick personal note goes a long way after someone books.",
      autoComplete: false,
    },
    {
      title: `Confirm project timeline & next steps with ${clientName}`,
      description: "Map out delivery milestones now while the details are fresh.",
      autoComplete: false,
    },
  ];
}

/** Standard metadata tag stamped on every task this automation creates. */
export const KICKOFF_TASK_METADATA = {
  auto_created: true,
  trigger: "proposal_accepted",
} as const;

export function kickoffProjectName(clientName: string): string {
  return `${clientName} \u2014 Project`;
}
