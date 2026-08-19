import { ConfigurationError } from "@/lib/server/env";
import { getKioskSession } from "@/lib/server/kiosk-session";
import { completeSubmission, SupabaseRequestError } from "@/lib/server/supabase";
import { parseSubmissionMetadata } from "@/lib/server/validation";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const session = await getKioskSession(request);
    if (!session) {
      console.warn("[submissions/complete] rejected: kiosk session missing");
      return json({ error: "Kiosk session required" }, 401);
    }
    const metadata = await parseSubmissionMetadata(await request.json());
    if (metadata.deviceId !== session.deviceId) {
      console.warn("[submissions/complete] rejected: device mismatch");
      return json({ error: "Device mismatch" }, 403);
    }
    const result = await completeSubmission(metadata);
    console.info("[submissions/complete] synchronized");
    return json(result, 201);
  } catch (error) {
    if (error instanceof ConfigurationError) return json({ error: "Backend not configured" }, 503);
    if (error instanceof SupabaseRequestError) {
      console.error("[submissions/complete] Supabase failed", { status: error.status, message: error.message });
      return json({ error: error.message }, error.status);
    }
    console.error("[submissions/complete] invalid request", { error: error instanceof Error ? error.message : "unknown" });
    return json({ error: "Invalid submission" }, 400);
  }
}
