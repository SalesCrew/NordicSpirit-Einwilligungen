import { ConfigurationError } from "@/lib/server/env";
import { getKioskSession } from "@/lib/server/kiosk-session";
import { prepareSubmission, SupabaseRequestError } from "@/lib/server/supabase";
import { parseSubmissionMetadata } from "@/lib/server/validation";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const session = await getKioskSession(request);
    if (!session) return json({ error: "Kiosk session required" }, 401);
    const metadata = await parseSubmissionMetadata(await request.json());
    if (metadata.deviceId !== session.deviceId) return json({ error: "Device mismatch" }, 403);
    return json(await prepareSubmission(metadata));
  } catch (error) {
    if (error instanceof ConfigurationError) return json({ error: "Backend not configured" }, 503);
    if (error instanceof SupabaseRequestError) return json({ error: error.message }, error.status);
    return json({ error: "Invalid submission" }, 400);
  }
}
