// OnboardingWizard.tsx
//
// The "Getting Started" ritual described in
// claude/backstage-os-philosophy.md (Onboarding Philosophy section):
//   - runs once on first entry, only re-takeable via Settings
//   - founder-heart questions (purpose, who, how, boundaries, vision)
//   - progressive reveal: background, then language, then tone, then color,
//     then logo
//   - real first client + the REAL kickoff automation firing live, with a
//     plain-language explanation of *why* it fired
//   - a generated, read-only Witness Statement
//   - a gentle celebration ("Your space is ready.")
//
// This is intentionally not a fake demo: the automation step calls the exact
// same shared logic (api/_lib/projectAutomation.ts) that fires for real when
// a client accepts a proposal, so what the founder sees here is honest.

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "./supabase";
import { saveBrandKit, type Company } from "./useDatabase";
import {
  buildKickoffTasks,
  kickoffProjectName,
  KICKOFF_TASK_METADATA,
} from "../api/_lib/projectAutomation";

type Step =
  | "welcome"
  | "purpose"
  | "who"
  | "how"
  | "boundaries"
  | "vision"
  | "brand"
  | "client"
  | "automation"
  | "witness"
  | "done";

const STEP_ORDER: Step[] = [
  "welcome",
  "purpose",
  "who",
  "how",
  "boundaries",
  "vision",
  "brand",
  "client",
  "automation",
  "witness",
  "done",
];

const DEFAULT_COLOR = "#0F766E"; // teal-700, matches the app's default accent

function WizardConfetti({ fire }: { fire: boolean }) {
  if (!fire) return null;
  return (
    <div style={{ pointerEvents: "none", position: "fixed", inset: 0, zIndex: 80 }}>
      {Array.from({ length: 140 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.2;
        const dur = 0.8 + Math.random() * 0.9;
        const size = 4 + Math.random() * 7;
        const rot = Math.random() * 360;
        const hue = 155 + Math.random() * 40;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "-6vh",
              left: `${left}%`,
              width: size,
              height: size * 0.35,
              background: `hsl(${hue} 70% 45%)`,
              transform: `rotate(${rot}deg)`,
              borderRadius: 2,
              opacity: 0.9,
              animation: `wizard-fall ${dur}s ${delay}s linear forwards`,
            }}
          />
        );
      })}
      <style>{`@keyframes wizard-fall{to{transform:translateY(110vh) rotate(720deg);opacity:1}}`}</style>
    </div>
  );
}

interface AutomationResult {
  clientId: string;
  clientName: string;
  projectId: string;
  tasks: { title: string; description: string; autoComplete: boolean }[];
}

export function OnboardingWizard({
  company,
  onSkip,
  onComplete,
}: {
  company: Company;
  /** Dismiss without marking onboarding complete — can reappear later. Pass null to hide the skip option entirely (e.g. mandatory first run). */
  onSkip: (() => void) | null;
  /** Called after the founder clicks through to the dashboard on the final screen. */
  onComplete: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEP_ORDER[stepIndex];

  // Founder-heart answers
  const [purpose, setPurpose] = useState(company.purpose || "");
  const [whoTheyServe, setWhoTheyServe] = useState(company.who_they_serve || "");
  const [howTheyServe, setHowTheyServe] = useState(company.how_they_serve || "");
  const [boundaries, setBoundaries] = useState(company.boundaries || "");
  const [vision, setVision] = useState(company.vision || "");

  // Brand basics
  const [toneWords, setToneWords] = useState("");
  const [colorPrimary, setColorPrimary] = useState(DEFAULT_COLOR);
  const [logoUrl, setLogoUrl] = useState("");

  // First client
  const [clientName, setClientName] = useState("");
  const [clientDetail, setClientDetail] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [automationResult, setAutomationResult] = useState<AutomationResult | null>(null);
  const [taskFlipped, setTaskFlipped] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const witnessStatement = useMemo(() => {
    if (!whoTheyServe && !boundaries && !vision) return "";
    return `This system was shaped around serving ${whoTheyServe || "the people you care about"}, in a way that honors ${boundaries || "what matters to you"}, with capacity for ${vision || "where you're headed"}.`;
  }, [whoTheyServe, boundaries, vision]);

  // Progressive reveal: background tint shifts from neutral to the chosen
  // brand color as the wizard advances, per the locked reveal order
  // (background -> language -> tone -> color -> logo).
  const revealProgress = stepIndex / (STEP_ORDER.length - 1);
  const backgroundStyle = useMemo(() => {
    const chosen = colorPrimary || DEFAULT_COLOR;
    const alpha = Math.min(0.06 + revealProgress * 0.1, 0.16);
    return {
      background: `linear-gradient(160deg, rgba(250,250,249,1) 0%, ${hexToRgba(chosen, alpha)} 100%)`,
    };
  }, [revealProgress, colorPrimary]);

  function goNext() {
    setError(null);
    setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  }
  function goBack() {
    setError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function saveFounderHeartAnswers() {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("companies")
      .update({
        purpose: purpose || null,
        who_they_serve: whoTheyServe || null,
        how_they_serve: howTheyServe || null,
        boundaries: boundaries || null,
        vision: vision || null,
      })
      .eq("id", company.id);
    setSaving(false);
    if (updateError) {
      setError("Couldn't save those answers — mind trying again?");
      return false;
    }
    return true;
  }

  async function saveBrandBasics() {
    setSaving(true);
    setError(null);
    const saved = await saveBrandKit(company.id, {
      tone_notes: toneWords || null,
      color_primary: colorPrimary,
      logo_variants: logoUrl ? { primary: logoUrl } : {},
    });
    setSaving(false);
    if (!saved) {
      setError("Couldn't save your brand basics — mind trying again?");
      return false;
    }
    return true;
  }

  async function createFirstClientAndRunAutomation() {
    if (!clientName.trim()) {
      setError("Give your first client a name to continue.");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        company_id: company.id,
        name: clientName.trim(),
        description: clientDetail || null,
      })
      .select("id, name")
      .single();

    if (clientError || !client) {
      setSaving(false);
      setError("Couldn't add that client — mind trying again?");
      return;
    }

    // This is the exact same shared logic that fires for real when a client
    // accepts a proposal (api/_lib/projectAutomation.ts + the identical
    // insert pattern used in api/submit-proposal-selections.ts). We're
    // running it live against this real client so the "quick win" is
    // genuine automation, not a staged animation.
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        client_id: client.id,
        company_id: company.id,
        name: kickoffProjectName(client.name),
        status: "active",
        start_date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();

    if (projectError || !project) {
      setSaving(false);
      setError("Client was added, but the automation step failed — mind trying again?");
      return;
    }

    const kickoffTasks = buildKickoffTasks(client.name);
    const { error: tasksError } = await supabase.from("tasks").insert(
      kickoffTasks.map((t) => ({
        title: t.title,
        description: t.description,
        company_id: company.id,
        client_id: client.id,
        project_id: project.id,
        status: t.autoComplete ? "completed" : "active",
        completed_at: t.autoComplete ? new Date().toISOString() : null,
        priority: "medium",
        metadata: KICKOFF_TASK_METADATA,
      }))
    );

    await supabase.from("clients").update({ stage: "active" }).eq("id", client.id);

    setSaving(false);
    if (tasksError) {
      setError("Client and project were created, but the task list failed — mind trying again?");
      return;
    }

    setAutomationResult({
      clientId: client.id,
      clientName: client.name,
      projectId: project.id,
      tasks: kickoffTasks,
    });
    goNext();
    // Let the automation step render first, then flip the checkbox live a
    // beat later so it visibly happens in front of the founder.
    window.setTimeout(() => setTaskFlipped(true), 900);
  }

  async function finish() {
    setSaving(true);
    await supabase
      .from("companies")
      .update({
        witness_statement: witnessStatement,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", company.id);
    setSaving(false);
    setConfetti(true);
    window.setTimeout(() => {
      onComplete();
    }, 1400);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-8" style={backgroundStyle}>
      <WizardConfetti fire={confetti} />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-xl bg-white/90 backdrop-blur rounded-3xl shadow-2xl border border-white p-8 md:p-10"
      >
        {onSkip && step !== "done" && (
          <button
            onClick={onSkip}
            className="absolute top-5 right-6 text-xs text-neutral-400 hover:text-neutral-600"
          >
            Skip for now
          </button>
        )}

        {/* Progress dots */}
        {step !== "welcome" && step !== "done" && (
          <div className="flex gap-1.5 mb-8">
            {STEP_ORDER.slice(1, -1).map((s, i) => (
              <div
                key={s}
                className="h-1.5 flex-1 rounded-full transition-colors"
                style={{
                  background: i <= stepIndex - 1 ? colorPrimary : "#E5E5E5",
                }}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
          >
            {step === "welcome" && (
              <div className="text-center space-y-4">
                <div className="text-4xl">👋</div>
                <h1 className="text-2xl font-semibold text-neutral-900">
                  Welcome to {company.name}'s space.
                </h1>
                <p className="text-neutral-600 leading-relaxed">
                  This is a one-time ritual, not a setup checklist. A few
                  questions about why this business exists, one real client,
                  and then we'll show you something Backstage can already do
                  for you — for real.
                </p>
                <button
                  onClick={goNext}
                  className="mt-4 rounded-full px-6 py-3 text-white font-medium"
                  style={{ background: colorPrimary }}
                >
                  Begin
                </button>
              </div>
            )}

            {step === "purpose" && (
              <QuestionStep
                eyebrow="Purpose"
                prompt="What is this business for?"
                helper="Not the elevator pitch — the real reason underneath it."
                value={purpose}
                onChange={setPurpose}
                color={colorPrimary}
                onBack={goBack}
                onNext={goNext}
              />
            )}

            {step === "who" && (
              <QuestionStep
                eyebrow="Who you serve"
                prompt="Who do you serve?"
                helper="Describe them the way you'd describe them to a friend."
                value={whoTheyServe}
                onChange={setWhoTheyServe}
                color={colorPrimary}
                onBack={goBack}
                onNext={goNext}
              />
            )}

            {step === "how" && (
              <QuestionStep
                eyebrow="How you serve"
                prompt="How do you serve them?"
                helper="What you actually do, in your own words."
                value={howTheyServe}
                onChange={setHowTheyServe}
                color={colorPrimary}
                onBack={goBack}
                onNext={goNext}
              />
            )}

            {step === "boundaries" && (
              <QuestionStep
                eyebrow="Boundaries"
                prompt="What's a boundary or non-negotiable you want this business to protect?"
                helper="Something you don't want to compromise as you grow."
                value={boundaries}
                onChange={setBoundaries}
                color={colorPrimary}
                onBack={goBack}
                onNext={goNext}
              />
            )}

            {step === "vision" && (
              <QuestionStep
                eyebrow="Vision"
                prompt="Where is this headed?"
                helper="Capacity you're building toward — no need to be precise."
                value={vision}
                onChange={setVision}
                color={colorPrimary}
                onBack={goBack}
                onNext={async () => {
                  const ok = await saveFounderHeartAnswers();
                  if (ok) goNext();
                }}
                saving={saving}
                error={error}
              />
            )}

            {step === "brand" && (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Brand basics
                  </div>
                  <h2 className="text-xl font-semibold text-neutral-900 mt-1">
                    How should {company.name} sound and look?
                  </h2>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">
                    A few words for your tone
                  </label>
                  <input
                    type="text"
                    value={toneWords}
                    onChange={(e) => setToneWords(e.target.value)}
                    placeholder="e.g. warm, direct, a little sassy"
                    className="w-full mt-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                    style={{ boxShadow: undefined }}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">
                    Primary color
                  </label>
                  <div className="flex items-center gap-3 mt-1">
                    <input
                      type="color"
                      value={colorPrimary}
                      onChange={(e) => setColorPrimary(e.target.value)}
                      className="h-10 w-14 rounded-lg border cursor-pointer"
                    />
                    <span className="text-sm text-neutral-500 font-mono">{colorPrimary}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">
                    Logo URL <span className="text-neutral-400 font-normal">(optional — skip for now)</span>
                  </label>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full mt-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  />
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="mt-3 h-12 object-contain"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                    />
                  )}
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <StepNav onBack={goBack} onNext={async () => {
                  const ok = await saveBrandBasics();
                  if (ok) goNext();
                }} color={colorPrimary} saving={saving} />
              </div>
            )}

            {step === "client" && (
              <div className="space-y-5">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Your first client
                  </div>
                  <h2 className="text-xl font-semibold text-neutral-900 mt-1">
                    Add someone real.
                  </h2>
                  <p className="text-sm text-neutral-500 mt-1">
                    This creates an actual client record — not a demo. Use a
                    real one if you've got one, or a placeholder you'll
                    rename later.
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">Client name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. Jamie Rivera"
                    className="w-full mt-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-700">
                    A quick detail <span className="text-neutral-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={clientDetail}
                    onChange={(e) => setClientDetail(e.target.value)}
                    placeholder="e.g. Spring wedding, 120 guests"
                    className="w-full mt-1 rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2"
                  />
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <StepNav
                  onBack={goBack}
                  onNext={createFirstClientAndRunAutomation}
                  color={colorPrimary}
                  saving={saving}
                  nextLabel="Add client & show me"
                />
              </div>
            )}

            {step === "automation" && automationResult && (
              <div className="space-y-5">
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                  This just happened, for real
                </div>
                <h2 className="text-xl font-semibold text-neutral-900">
                  Backstage built {automationResult.clientName}'s project.
                </h2>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Here's what fires automatically, every single time, the
                  moment a client accepts a proposal — we just ran it live
                  against {automationResult.clientName} so you could see it
                  happen instead of taking our word for it.
                </p>
                <div className="rounded-2xl border bg-neutral-50 p-4 space-y-2">
                  {automationResult.tasks.map((t, i) => {
                    const isAuto = t.autoComplete;
                    const checked = isAuto && taskFlipped;
                    return (
                      <motion.div
                        key={t.title}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="flex items-start gap-3 bg-white rounded-xl border px-3 py-2.5"
                      >
                        <motion.div
                          animate={{
                            backgroundColor: checked ? colorPrimary : "#ffffff",
                            borderColor: checked ? colorPrimary : "#D4D4D4",
                          }}
                          transition={{ duration: 0.4 }}
                          className="mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center flex-shrink-0"
                        >
                          {checked && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="text-white text-[10px]"
                            >
                              ✓
                            </motion.span>
                          )}
                        </motion.div>
                        <div className="min-w-0">
                          <div className={`text-sm font-medium ${checked ? "text-neutral-500 line-through" : "text-neutral-800"}`}>
                            {t.title}
                          </div>
                          {isAuto && (
                            <AnimatePresence>
                              {taskFlipped && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  className="text-xs mt-1"
                                  style={{ color: colorPrimary }}
                                >
                                  ⚡ Automated — {t.description}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <AnimatePresence>
                  {taskFlipped && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm font-medium text-center"
                      style={{ color: colorPrimary }}
                    >
                      This is automation. That task just checked itself off —
                      forever off your to-do list.
                    </motion.p>
                  )}
                </AnimatePresence>
                <div className="flex justify-end pt-2">
                  <button
                    disabled={!taskFlipped}
                    onClick={goNext}
                    className="rounded-full px-6 py-2.5 text-white font-medium disabled:opacity-40"
                    style={{ background: colorPrimary }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === "witness" && (
              <div className="space-y-5 text-center">
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Your witness statement
                </div>
                <p className="text-neutral-500 text-sm">
                  Built from what you just told us. It's yours, and it won't
                  change unless you redo this whole ritual from Settings.
                </p>
                <div
                  className="rounded-2xl p-6 text-lg leading-relaxed font-medium text-neutral-800"
                  style={{ background: hexToRgba(colorPrimary, 0.08), border: `1px solid ${hexToRgba(colorPrimary, 0.25)}` }}
                >
                  "{witnessStatement}"
                </div>
                <button
                  onClick={finish}
                  disabled={saving}
                  className="rounded-full px-6 py-3 text-white font-medium disabled:opacity-60"
                  style={{ background: colorPrimary }}
                >
                  {saving ? "Wrapping up…" : "This is right"}
                </button>
              </div>
            )}

            {step === "done" && (
              <div className="text-center space-y-4 py-6">
                <div className="text-4xl">✨</div>
                <h1 className="text-2xl font-semibold text-neutral-900">
                  Your space is ready.
                </h1>
                <p className="text-neutral-600">
                  {automationResult?.clientName} is already active, and one
                  task is already done. Everything else waits for you,
                  exactly where you left it.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function QuestionStep({
  eyebrow,
  prompt,
  helper,
  value,
  onChange,
  color,
  onBack,
  onNext,
  saving,
  error,
}: {
  eyebrow: string;
  prompt: string;
  helper: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
  onBack: () => void;
  onNext: () => void;
  saving?: boolean;
  error?: string | null;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-neutral-400">{eyebrow}</div>
        <h2 className="text-xl font-semibold text-neutral-900 mt-1">{prompt}</h2>
        <p className="text-sm text-neutral-500 mt-1">{helper}</p>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 resize-none"
        autoFocus
      />
      {error && <div className="text-sm text-red-600">{error}</div>}
      <StepNav onBack={onBack} onNext={onNext} color={color} saving={saving} />
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  color,
  saving,
  nextLabel = "Next",
}: {
  onBack: () => void;
  onNext: () => void;
  color: string;
  saving?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <button onClick={onBack} className="text-sm text-neutral-500 hover:text-neutral-700">
        Back
      </button>
      <button
        onClick={onNext}
        disabled={saving}
        className="rounded-full px-6 py-2.5 text-white font-medium disabled:opacity-60"
        style={{ background: color }}
      >
        {saving ? "Saving…" : nextLabel}
      </button>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3
    ? clean.split("").map((c) => c + c).join("")
    : clean, 16);
  if (isNaN(bigint)) return `rgba(15, 118, 110, ${alpha})`;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
