-- Phase 19 (Post-Expansion): company Stage system. NOT a rename of an old
-- floral-tier XP system -- that never existed in code (confirmed via grep;
-- only ever a "someday" idea in two spec docs, already flagged as unbuilt
-- in Phase 17's roadmap note). Stage is a genuinely new, separate concept
-- from profiles.xp/level (individual, task-completion-based, scoped to
-- Career Path/My Team) -- Stage describes a COMPANY's own business-
-- maturity journey. Deliberately no stage_level counter (the original
-- spec's rationale for one -- "replaces old floral-tier XP level" -- is
-- moot since there's no such XP to replace, and Level stays separate per
-- the founder's explicit choice); progress within a stage is computed from
-- system_unlocks completion instead (Phase 21), not tracked as a redundant
-- integer.
alter table public.companies add column current_stage text not null default 'one' check (current_stage in ('one', 'two', 'three'));

-- Seed each of the founder's 3 real businesses at its actual current stage,
-- per her explicit answer -- not a uniform reset, not "already unlocked."
update public.companies set current_stage = 'one' where slug = 'maire';
update public.companies set current_stage = 'two' where slug = 'prose-florals';
update public.companies set current_stage = 'one' where slug = 'backstage';
