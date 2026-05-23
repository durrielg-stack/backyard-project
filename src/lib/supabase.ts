import { createBrowserClient } from '@supabase/ssr'

// Browser-side singleton.
// Generic type param omitted until we run `supabase gen types typescript`.
// All Supabase calls use explicit `.returns<T>()` or are cast at the call site.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

let _client: ReturnType<typeof createClient> | null = null
export function getClient() {
  if (!_client) _client = createClient()
  return _client
}
