import { getKioskConfig } from "@/lib/server/env";

const COOKIE_NAME = "frequency_kiosk";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface KioskSession {
  deviceId: string;
  expiresAt: number;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value: string) {
  const { sessionSecret } = await getKioskConfig();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function constantTimeEqual(left: string, right: string) {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export function validDeviceId(deviceId: string) {
  return UUID_PATTERN.test(deviceId);
}

export async function setupCodeMatches(candidate: string) {
  return constantTimeEqual(candidate, (await getKioskConfig()).setupCode);
}

export async function createKioskCookie(deviceId: string, secure: boolean) {
  const payload: KioskSession = {
    deviceId,
    expiresAt: Date.now() + SESSION_SECONDS * 1000,
  };
  const encodedPayload = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload);
  const securePart = secure ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodedPayload}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${securePart}`;
}

export function clearKioskCookie(secure: boolean) {
  const securePart = secure ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${securePart}`;
}

function readCookie(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  for (const cookie of cookieHeader.split(";")) {
    const [name, ...value] = cookie.trim().split("=");
    if (name === COOKIE_NAME) return value.join("=");
  }
  return null;
}

export async function getKioskSession(request: Request): Promise<KioskSession | null> {
  const cookie = readCookie(request);
  if (!cookie) return null;
  const [payload, signature] = cookie.split(".");
  if (!payload || !signature || !constantTimeEqual(await sign(payload), signature)) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as KioskSession;
    if (!validDeviceId(parsed.deviceId) || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
