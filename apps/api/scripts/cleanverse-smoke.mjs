import { createCipheriv, createDecipheriv, randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(__dirname, "../.env"));
loadEnvFile(resolve(__dirname, "../../../.env"));

const baseUrl = (process.env.CLEANVERSE_BASE_URL ?? "").replace(/\/$/, "");
const apiId = process.env.CLEANVERSE_API_ID ?? "";
const apiKey = process.env.CLEANVERSE_API_KEY ?? "";

if (!baseUrl || !apiId || !apiKey) {
  console.error("Missing CLEANVERSE_BASE_URL / CLEANVERSE_API_ID / CLEANVERSE_API_KEY");
  process.exit(1);
}

function encryptPayload(plaintext) {
  const key = Buffer.from(apiKey, "base64");
  const algorithm =
    key.length === 16
      ? "aes-128-cbc"
      : key.length === 24
        ? "aes-192-cbc"
        : "aes-256-cbc";
  const iv = Buffer.alloc(16, 0);
  const cipher = createCipheriv(algorithm, key, iv);
  const input = Buffer.from(JSON.stringify(plaintext), "utf8");
  return Buffer.concat([cipher.update(input), cipher.final()]).toString("base64");
}

async function call(method, path, body, encrypt = false) {
  const headers = {
    "api-id": apiId,
    "X-Request-ID": randomUUID(),
    Accept: "application/json",
  };
  let payload;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(encrypt ? { data: encryptPayload(body) } : body);
  }
  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

console.log("Cleanverse smoke test");
console.log("baseUrl:", baseUrl);
console.log("apiId:", apiId);
console.log("apiKey bytes:", Buffer.from(apiKey, "base64").length);

const list = await call("POST", "/query_deposit_atoken_list", { chain: "base" });
console.log("\nPOST /query_deposit_atoken_list { chain: base }");
console.log(JSON.stringify(list, null, 2));

const query = await call("POST", "/query_apass", {
  chain: "base",
  address: "0x0000000000000000000000000000000000000001",
});
console.log("\nPOST /query_apass (zero-ish address)");
console.log(JSON.stringify(query, null, 2));

if (list.status === 403 || query.status === 403) {
  console.error("\nGot 403 — check api-id / IP allowlist with Cleanverse.");
  process.exit(2);
}

console.log("\nSmoke finished.");
