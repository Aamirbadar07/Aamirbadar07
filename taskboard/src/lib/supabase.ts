import { createClient } from '@supabase/supabase-js'

// The publishable key is safe to ship to the browser: every table is
// protected by Row Level Security, so the key alone grants nothing.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY,
)
