import { ConfigurationError } from "@/lib/server/env";
import { checkSupabaseHealth, SupabaseRequestError } from "@/lib/server/supabase";

export async function GET() {
  try {
    await checkSupabaseHealth();
    return Response.json(
      { ready: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof ConfigurationError ? 503 : error instanceof SupabaseRequestError ? error.status : 500;
    return Response.json(
      { ready: false },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

