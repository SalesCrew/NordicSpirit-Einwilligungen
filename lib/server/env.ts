export class ConfigurationError extends Error {
  constructor(message = "Backend configuration is incomplete") {
    super(message);
    this.name = "ConfigurationError";
  }
}

function required(name: string) {
  const candidate = process.env[name];
  const value = typeof candidate === "string" ? candidate.trim() : "";
  if (!value) throw new ConfigurationError();
  return value;
}

export async function getSupabaseConfig() {
  const bucketValue = process.env.SUPABASE_BUCKET;
  return {
    url: required("SUPABASE_URL").replace(/\/$/, ""),
    secretKey: required("SUPABASE_SECRET_KEY"),
    publishableKey: required("SUPABASE_PUBLISHABLE_KEY"),
    bucket: typeof bucketValue === "string" && bucketValue.trim()
      ? bucketValue.trim()
      : "frequency-2026-consents",
  };
}

export async function getKioskConfig() {
  return {
    setupCode: required("KIOSK_SETUP_CODE"),
    sessionSecret: required("KIOSK_SESSION_SECRET"),
  };
}

export async function getServerEventId() {
  const candidate = process.env.EVENT_ID;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : "frequency-2026";
}
