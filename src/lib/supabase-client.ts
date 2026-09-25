import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function isValidHttpUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

export const hasSupabaseConfig = Boolean(isValidHttpUrl(supabaseUrl) && supabasePublishableKey);

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  if (!hasSupabaseConfig || !supabaseUrl || !supabasePublishableKey) return null;
  if (!browserClient) {
    browserClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true
      }
    });
  }
  return browserClient;
}
