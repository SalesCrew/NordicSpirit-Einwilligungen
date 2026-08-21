import { ConfigurationError } from "@/lib/server/env";
import {
  clearKioskCookie,
  createKioskCookie,
  getKioskSession,
  kioskSessionExpiresAt,
  setupCodeMatches,
  validDeviceId,
} from "@/lib/server/kiosk-session";
import {
  registerKioskDevice,
  SupabaseRequestError,
  verifyRegisteredKioskDevice,
} from "@/lib/server/supabase";

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function GET(request: Request) {
  try {
    const session = await getKioskSession(request);
    if (!session) return json({ configured: false });
    const secure = new URL(request.url).protocol === "https:";
    if (!(await verifyRegisteredKioskDevice(session.deviceId))) {
      return json(
        { configured: false, reason: "device-not-registered" },
        200,
        { "Set-Cookie": clearKioskCookie(secure) },
      );
    }
    const expiresAt = kioskSessionExpiresAt();
    const cookie = await createKioskCookie(session.deviceId, secure, expiresAt);
    return json(
      { configured: true, deviceId: session.deviceId, expiresAt },
      200,
      { "Set-Cookie": cookie },
    );
  } catch (error) {
    if (error instanceof ConfigurationError) return json({ configured: false }, 503);
    if (error instanceof SupabaseRequestError) {
      return json({ error: "Gerätestatus konnte nicht in Supabase geprüft werden" }, error.status);
    }
    return json({ error: "Session check failed" }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { setupCode?: unknown; deviceId?: unknown };
    if (
      typeof body.setupCode !== "string" ||
      typeof body.deviceId !== "string" ||
      !validDeviceId(body.deviceId) ||
      !(await setupCodeMatches(body.setupCode))
    ) {
      return json({ error: "Ungültiger Setup-Code oder Geräte-ID" }, 401);
    }
    await registerKioskDevice(body.deviceId);
    const secure = new URL(request.url).protocol === "https:";
    const cookie = await createKioskCookie(body.deviceId, secure);
    return json(
      { configured: true, deviceId: body.deviceId },
      200,
      { "Set-Cookie": cookie },
    );
  } catch (error) {
    if (error instanceof ConfigurationError) return json({ error: "Backend noch nicht konfiguriert" }, 503);
    if (error instanceof SupabaseRequestError) {
      return json({ error: "Geräteregistrierung in Supabase fehlgeschlagen" }, error.status);
    }
    return json({ error: "Setup fehlgeschlagen" }, 400);
  }
}

export async function DELETE(request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  return json({ configured: false }, 200, { "Set-Cookie": clearKioskCookie(secure) });
}
