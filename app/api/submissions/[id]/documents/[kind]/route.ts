import { ConfigurationError } from "@/lib/server/env";
import { getKioskSession } from "@/lib/server/kiosk-session";
import {
  type SubmissionDocumentKind,
  SupabaseRequestError,
  uploadSubmissionDocument,
} from "@/lib/server/supabase";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isDocumentKind(value: string): value is SubmissionDocumentKind {
  return value === "haftung" || value === "einwilligung";
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; kind: string }> },
) {
  try {
    const session = await getKioskSession(request);
    if (!session) {
      console.warn("[submissions/documents] rejected: kiosk session missing");
      return json({ error: "Kiosk session required" }, 401);
    }
    const { id, kind } = await context.params;
    if (!UUID_PATTERN.test(id) || !isDocumentKind(kind)) {
      return json({ error: "Invalid document upload" }, 400);
    }
    const document = await request.blob();
    const path = await uploadSubmissionDocument(id, session.deviceId, kind, document);
    console.info("[submissions/documents] uploaded", { kind });
    return json({ path }, 201);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error("[submissions/documents] configuration failed", { message: error.message });
      return json({ error: "Backend not configured" }, 503);
    }
    if (error instanceof SupabaseRequestError) {
      console.error("[submissions/documents] Supabase failed", {
        status: error.status,
        message: error.message,
      });
      return json({ error: error.message }, error.status);
    }
    console.error("[submissions/documents] upload failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return json({ error: "Document upload failed" }, 500);
  }
}
