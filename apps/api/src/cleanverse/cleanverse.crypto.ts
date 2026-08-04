import { createCipheriv, createDecipheriv } from "node:crypto";

const ALGORITHM = "aes-256-cbc";
const IV = Buffer.alloc(16, 0);

export function decodeApiKey(apiKeyBase64: string): Buffer {
  const key = Buffer.from(apiKeyBase64, "base64");
  if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
    throw new Error(
      `Invalid Cleanverse api-key length after base64 decode: ${key.length} bytes (expected 16, 24, or 32)`,
    );
  }
  return key;
}

function resolveAlgorithm(key: Buffer): string {
  if (key.length === 16) return "aes-128-cbc";
  if (key.length === 24) return "aes-192-cbc";
  return ALGORITHM;
}

export function encryptPayload(plaintext: unknown, apiKeyBase64: string): string {
  const key = decodeApiKey(apiKeyBase64);
  const algorithm = resolveAlgorithm(key);
  const cipher = createCipheriv(algorithm, key, IV);
  const input = Buffer.from(JSON.stringify(plaintext), "utf8");
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  return encrypted.toString("base64");
}

export function decryptPayload<T = unknown>(
  ciphertextBase64: string,
  apiKeyBase64: string,
): T {
  const key = decodeApiKey(apiKeyBase64);
  const algorithm = resolveAlgorithm(key);
  const decipher = createDecipheriv(algorithm, key, IV);
  const input = Buffer.from(ciphertextBase64, "base64");
  const decrypted = Buffer.concat([decipher.update(input), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

export function encryptRequestBody(
  plaintext: unknown,
  apiKeyBase64: string,
): { data: string } {
  return { data: encryptPayload(plaintext, apiKeyBase64) };
}
