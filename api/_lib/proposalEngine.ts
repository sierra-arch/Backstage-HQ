// proposalEngine.ts
//
// Shared, framework-agnostic calculation logic for the proposal generator.
// Used by both the internal dashboard (client-side, for live previews) and
// the server-side submit-proposal-selections endpoint (source of truth for
// anything that touches money). Keep this file free of Supabase/Vercel
// imports so it can run identically in the browser and in serverless
// functions.

export interface LineItem {
  key: string;
  name: string;
  description: string;
  unit_price: number;
  default_quantity: number;
  is_optional: boolean;
  is_included: boolean;
}

export interface LineItemsSection {
  type: "line_items";
  key: string;
  name: string;
  description: string;
  items: LineItem[];
}

export interface DesignBriefField {
  key: string;
  label: string;
  kind: string;
}

export interface DesignBriefSection {
  type: "design_brief";
  title: string;
  fields: DesignBriefField[];
}

export interface PaymentRuleInstallment {
  label: string;
  percent: number;
  due_rule_type: "on_signing" | "days_before_event";
  due_rule_offset_days: number;
}

export interface PaymentRulesSection {
  type: "payment_rules";
  installments: PaymentRuleInstallment[];
}

export interface ContractSection {
  type: "contract";
  title: string;
  body: string;
}

export type TemplateSection =
  | DesignBriefSection
  | LineItemsSection
  | PaymentRulesSection
  | ContractSection;

// Client-submitted overrides, keyed by line-item key. `included` only ever
// matters for is_optional items (required items are always included).
// `quantity` can only ever move the item DOWN from its authored default —
// never up — so a client can never inflate their own bill.
export interface SelectionEntry {
  included?: boolean;
  quantity?: number;
}
export type Selections = Record<string, SelectionEntry>;

export interface ComputedLineItem extends LineItem {
  effective_quantity: number;
  effective_included: boolean;
  line_total: number;
}

export interface ComputedSection {
  key: string;
  name: string;
  description: string;
  items: ComputedLineItem[];
  subtotal: number;
}

export interface ComputedTotals {
  sections: ComputedSection[];
  grand_total: number;
}

// Clamps a raw client selection against the authored bounds for one item.
// This is the single choke point that guarantees a client can never pay
// more than what the team authored, and can never turn on a non-optional
// item's toggle (it's not a toggle at all for them).
export function clampSelection(
  item: LineItem,
  raw: SelectionEntry | undefined
): { included: boolean; quantity: number } {
  const included = item.is_optional ? Boolean(raw?.included ?? item.is_included) : true;

  let quantity = raw?.quantity;
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) {
    quantity = item.default_quantity;
  }
  // Never allow a client to request more than what was authored.
  quantity = Math.min(quantity, item.default_quantity);
  // Optional items can be reduced to zero (effectively same as excluding);
  // required items always keep at least 1.
  const floor = item.is_optional ? 0 : 1;
  quantity = Math.max(quantity, floor);
  quantity = Math.round(quantity);

  return { included, quantity };
}

export function findSection<T extends TemplateSection["type"]>(
  structure: TemplateSection[],
  type: T
): Extract<TemplateSection, { type: T }> | undefined {
  return structure.find((s): s is Extract<TemplateSection, { type: T }> => s.type === type);
}

export function getLineItemSections(structure: TemplateSection[]): LineItemsSection[] {
  return structure.filter((s): s is LineItemsSection => s.type === "line_items");
}

export function getDesignBriefSection(structure: TemplateSection[]): DesignBriefSection | undefined {
  return findSection(structure, "design_brief");
}

export function getPaymentRules(structure: TemplateSection[]): PaymentRuleInstallment[] {
  return findSection(structure, "payment_rules")?.installments ?? [];
}

export function getContractSection(structure: TemplateSection[]): ContractSection | undefined {
  return findSection(structure, "contract");
}

// Computes line totals, section subtotals, and the grand total for a
// template's line items given a set of (already-clamped-on-read) client
// selections. This is safe to call with an empty/partial `selections` —
// missing entries just fall back to the item's authored defaults.
export function computeDocumentTotals(
  structure: TemplateSection[],
  selections: Selections
): ComputedTotals {
  const sections: ComputedSection[] = [];
  let grand_total = 0;

  for (const section of getLineItemSections(structure)) {
    const items: ComputedLineItem[] = [];
    let subtotal = 0;

    for (const item of section.items) {
      const { included, quantity } = clampSelection(item, selections[item.key]);
      const line_total = included ? round2(item.unit_price * quantity) : 0;
      subtotal += line_total;
      items.push({ ...item, effective_quantity: quantity, effective_included: included, line_total });
    }

    subtotal = round2(subtotal);
    sections.push({ key: section.key, name: section.name, description: section.description, items, subtotal });
    grand_total += subtotal;
  }

  return { sections, grand_total: round2(grand_total) };
}

// Validates a raw (untrusted) selections payload against a template's
// authored bounds. Returns { ok: true, selections } with a fully clamped,
// safe-to-persist selections object, or { ok: false, error } if the
// payload references unknown items or is structurally invalid.
export function validateSelections(
  structure: TemplateSection[],
  rawSelections: unknown
): { ok: true; selections: Selections } | { ok: false; error: string } {
  if (rawSelections !== undefined && rawSelections !== null && typeof rawSelections !== "object") {
    return { ok: false, error: "selections must be an object" };
  }
  const raw = (rawSelections ?? {}) as Record<string, unknown>;

  const validKeys = new Set<string>();
  for (const section of getLineItemSections(structure)) {
    for (const item of section.items) validKeys.add(item.key);
  }

  for (const key of Object.keys(raw)) {
    if (!validKeys.has(key)) {
      return { ok: false, error: `Unknown line item in selections: ${key}` };
    }
    const entry = raw[key];
    if (entry !== null && typeof entry !== "object") {
      return { ok: false, error: `Invalid selection entry for ${key}` };
    }
  }

  const clamped: Selections = {};
  for (const section of getLineItemSections(structure)) {
    for (const item of section.items) {
      const rawEntry = raw[item.key] as SelectionEntry | undefined;
      if (rawEntry === undefined) continue;
      const { included, quantity } = clampSelection(item, rawEntry);
      clamped[item.key] = { included, quantity };
    }
  }

  return { ok: true, selections: clamped };
}

export interface BuiltInstallment {
  sequence_number: number;
  amount: number;
  due_rule_type: PaymentRuleInstallment["due_rule_type"];
  due_rule_offset_days: number;
  due_date: string; // YYYY-MM-DD
}

// Turns a template's payment_rules + a grand total + an event date into
// concrete dated installments. The last installment absorbs any rounding
// remainder so the installments always sum EXACTLY to grand_total (never
// leaves a client owing an extra $0.01 nobody can explain).
export function buildInstallments(
  rules: PaymentRuleInstallment[],
  grandTotal: number,
  eventDateISO: string | null,
  signingDateISO: string
): BuiltInstallment[] {
  if (rules.length === 0) return [];

  const amounts = rules.map((rule) => round2((grandTotal * rule.percent) / 100));
  const sumSoFar = amounts.reduce((a, b) => a + b, 0);
  const remainder = round2(grandTotal - sumSoFar);
  amounts[amounts.length - 1] = round2(amounts[amounts.length - 1] + remainder);

  return rules.map((rule, idx) => {
    let due_date = signingDateISO;
    if (rule.due_rule_type === "days_before_event" && eventDateISO) {
      const d = new Date(`${eventDateISO}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - (rule.due_rule_offset_days ?? 0));
      due_date = d.toISOString().slice(0, 10);
    }
    return {
      sequence_number: idx + 1,
      amount: amounts[idx],
      due_rule_type: rule.due_rule_type,
      due_rule_offset_days: rule.due_rule_offset_days ?? 0,
      due_date,
    };
  });
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Fills merge fields like {{client_full_name}} in a contract body. Any
// field with no provided value is left as a highlighted blank rather than
// silently vanishing, so a half-filled contract is obvious at a glance.
export function fillContractMergeFields(body: string, values: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = values[key];
    return value && value.trim() ? value : `[${key}]`;
  });
}
