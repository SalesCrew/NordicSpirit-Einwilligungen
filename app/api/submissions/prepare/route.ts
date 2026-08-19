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
    if (!session) {
      console.warn("[submissions/prepare] rejected: kiosk session missing");
      return json({ error: "Kiosk session required" }, 401);
    }
    const metadata = await parseSubmissionMetadata(await request.json());
    if (metadata.deviceId !== session.deviceId) {
      console.warn("[submissions/prepare] rejected: device mismatch");
      return json({ error: "Device mismatch" }, 403);
    }
    const result = await prepareSubmission(metadata);
    console.info("[submissions/prepare] ready", { status: result.status });
    return json(result);
  } catch (error) {
    if (error instanceof ConfigurationError) return json({ error: "Backend not configured" }, 503);
    if (error instanceof SupabaseRequestError) {
      console.error("[submissions/prepare] Supabase failed", { status: error.status, message: error.message });
      return json({ error: error.message }, error.status);
    }
    console.error("[submissions/prepare] invalid request", { error: error instanceof Error ? error.message : "unknown" });
    return json({ error: "Invalid submission" }, 400);
  }
}
