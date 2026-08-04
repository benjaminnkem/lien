import {
  decryptPayload,
  encryptPayload,
  encryptRequestBody,
} from "./cleanverse.crypto";

const SAMPLE_KEY = Buffer.alloc(32, 7).toString("base64");

describe("cleanverse.crypto", () => {
  it("round-trips JSON payloads", () => {
    const plaintext = {
      chain: "base",
      address: "0xabc",
      nested: { n: 1 },
    };

    const cipher = encryptPayload(plaintext, SAMPLE_KEY);
    expect(typeof cipher).toBe("string");
    expect(cipher.length).toBeGreaterThan(0);

    const decoded = decryptPayload<typeof plaintext>(cipher, SAMPLE_KEY);
    expect(decoded).toEqual(plaintext);
  });

  it("wraps encrypted body as { data }", () => {
    const body = encryptRequestBody({ hello: "world" }, SAMPLE_KEY);
    expect(body).toHaveProperty("data");
    expect(decryptPayload(body.data, SAMPLE_KEY)).toEqual({ hello: "world" });
  });
});
