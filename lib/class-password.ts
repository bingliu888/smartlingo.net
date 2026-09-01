const PBKDF2_ITERATIONS = 210_000;

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2) return null;
  return new Uint8Array(value.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) || []);
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1)
    difference |= left[index] ^ right[index];
  return difference === 0;
}

async function derive(value: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  ));
}

export async function hashClassPassword(value: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derive(value, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${hex(salt)}$${hex(digest)}`;
}

export async function verifyStoredClassPassword(value: string, stored: string | null) {
  if (!stored) return true;
  const parts = stored.split("$");
  if (parts.length === 4 && parts[0] === "pbkdf2-sha256") {
    const iterations = Number(parts[1]);
    const salt = fromHex(parts[2]);
    const expected = fromHex(parts[3]);
    if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 500_000
      || !salt || salt.byteLength !== 16 || !expected || expected.byteLength !== 32)
      return false;
    return equalBytes(await derive(value, salt, iterations), expected);
  }
  // Read-only compatibility for rooms created before Gold v2. Any subsequent
  // password edit writes the PBKDF2 envelope above.
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    );
    return equalBytes(digest, fromHex(stored) || new Uint8Array());
  }
  return false;
}
