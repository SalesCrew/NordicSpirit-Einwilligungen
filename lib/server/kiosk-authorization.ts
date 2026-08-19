import { getKioskSession } from "@/lib/server/kiosk-session";
import { verifyRegisteredKioskDevice } from "@/lib/server/supabase";

export async function getAuthorizedKioskSession(request: Request) {
  const session = await getKioskSession(request);
  if (!session) return null;
  return await verifyRegisteredKioskDevice(session.deviceId) ? session : null;
}
