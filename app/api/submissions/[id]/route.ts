import { ConfigurationError } from "@/lib/server/env";
import { getAuthorizedKioskSession } from "@/lib/server/kiosk-authorization";
import { getSubmission, SupabaseRequestError } from "@/lib/server/supabase";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getAuthorizedKioskSession(request);
    if (!session) return json({ error: "Kiosk session required" }, 401);
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) return json({ error: "Invalid record ID" }, 400);
    const result = await getSubmission(id, session.deviceId);
    if (!result) return json({ error: "Not found" }, 404);
    return json(result);
  } catch (error) {
    if (error instanceof ConfigurationError) return json({ error: "Backend not configured" }, 503);
    if (error instanceof SupabaseRequestError) return json({ error: error.message }, error.status);
    return json({ error: "Lookup failed" }, 500);
  }
}
