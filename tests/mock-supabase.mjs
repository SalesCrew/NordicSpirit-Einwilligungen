import http from "node:http";

const port = Number(process.env.MOCK_SUPABASE_PORT || 54321);
const expectedKey = process.env.MOCK_SUPABASE_KEY || "sb_secret_test";
const records = new Map();
const uploads = new Map();

function postgresTimestamp(value) {
  return new Date(value).toISOString().replace("T", " ").replace("Z", "+00");
}

function corsHeaders(request) {
  const origin = request.headers.origin;
  return {
    "access-control-allow-origin": origin || "*",
    "access-control-allow-headers": "apikey, authorization, cache-control, content-type, x-upsert",
    "access-control-allow-methods": "GET, POST, PUT, OPTIONS",
  };
}

function json(request, response, status, body) {
  response.writeHead(status, { "content-type": "application/json", ...corsHeaders(request) });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "OPTIONS") {
    response.writeHead(204, corsHeaders(request));
    return response.end();
  }

  if (url.pathname === "/__state") {
    return json(request, response, 200, {
      records: [...records.values()],
      uploads: [...uploads.entries()].map(([path, bytes]) => ({ path, size: bytes.length })),
    });
  }

  const signedPrefix = "/storage/v1/object/upload/sign/";
  if (
    request.method === "PUT" &&
    url.pathname.startsWith(signedPrefix) &&
    url.searchParams.get("token") === "test-signed-token"
  ) {
    const body = await readBody(request);
    uploads.set(decodeURIComponent(url.pathname.slice(signedPrefix.length)), body);
    return json(request, response, 200, { Key: url.pathname });
  }

  if (request.headers.apikey !== expectedKey) {
    return json(request, response, 401, { error: "invalid key" });
  }

  if (request.method === "POST" && url.pathname.startsWith(signedPrefix)) {
    const objectPath = decodeURIComponent(url.pathname.slice(signedPrefix.length));
    return json(request, response, 200, {
      url: `/object/upload/sign/${encodeURI(objectPath)}?token=test-signed-token`,
    });
  }

  const objectPrefix = "/storage/v1/object/";
  if (request.method === "POST" && url.pathname.startsWith(objectPrefix)) {
    const body = await readBody(request);
    const objectPath = decodeURIComponent(url.pathname.slice(objectPrefix.length));
    uploads.set(objectPath, body);
    return json(request, response, 200, { Key: objectPath });
  }

  if (request.method === "GET" && url.pathname.startsWith(objectPrefix)) {
    const objectPath = decodeURIComponent(url.pathname.slice(objectPrefix.length));
    const bytes = uploads.get(objectPath);
    if (!bytes) return json(request, response, 404, { error: "not found" });
    response.writeHead(200, { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    return response.end(bytes);
  }

  if (url.pathname === "/rest/v1/consent_records" && request.method === "POST") {
    const body = JSON.parse((await readBody(request)).toString("utf8"));
    records.set(body.id, body);
    response.writeHead(201);
    return response.end();
  }

  if (url.pathname === "/rest/v1/consent_records" && request.method === "GET") {
    const idFilter = url.searchParams.get("id");
    if (!idFilter) return json(request, response, 200, []);
    const id = idFilter.replace(/^eq\./, "");
    const record = records.get(id);
    return json(request, response, 200, record ? [{
      ...record,
      privacy_acknowledged_at_client: postgresTimestamp(record.privacy_acknowledged_at_client),
    }] : []);
  }

  return json(request, response, 404, { error: "not found" });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`mock-supabase:${port}\n`);
});
