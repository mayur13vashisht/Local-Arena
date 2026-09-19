import { createClient } from '@supabase/supabase-js'

// Support both the app's original VITE_ vars and the v0 Supabase integration's
// NEXT_PUBLIC_ vars, so the client works regardless of which are configured.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Warn instead of throwing at module load — a hard throw here blanks the
  // entire app before anything renders.
  console.warn(
    '[v0] Missing Supabase environment variables. Supabase features will not work until they are set.',
  )
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
)
