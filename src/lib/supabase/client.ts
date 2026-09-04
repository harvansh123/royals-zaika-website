import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        // Increase timeout from default 10s → 30s.
        // On slow 3G the WebSocket handshake takes longer, causing channels to
        // silently fail. 30s gives enough headroom without any UX change.
        timeout: 30_000,
      },
    }
  );

export const supabase = createClient();
