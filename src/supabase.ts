import { createClient } from "@supabase/supabase-js";

// Direct access to window variables (set in index.html)
const SUPABASE_URL =
  (typeof window !== "undefined" && (window as any).VITE_SUPABASE_URL) || "";

const SUPABASE_ANON_KEY =
  (typeof window !== "undefined" && (window as any).VITE_SUPABASE_ANON_KEY) ||
  "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "❌ Supabase credentials missing! Check that index.html has the window.VITE_SUPABASE_* variables."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
