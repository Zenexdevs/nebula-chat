import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Thrown at build/runtime so misconfiguration fails loudly instead of
  // silently breaking realtime/storage calls later.
  console.warn(
    '[nebula-chat] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env.local and fill in your Supabase project values.'
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

export const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? 'nebula-files';
