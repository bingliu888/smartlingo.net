function hex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function validStripeSignature(body: string, header: string, secret: string, now = Date.now()) {
  const entries = header.split(",").map(value => {
    const separator = value.indexOf("=");
    return separator < 0 ? [value.trim(), ""] : [value.slice(0, separator).trim(), value.slice(separator + 1).trim()];
  });
  const timestamp = entries.find(([key]) => key === "t")?.[1] || "";
  const signatures = entries.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || !Number.isSafeInteger(Number(timestamp)) || Math.abs(now / 1_000 - Number(timestamp)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`))));
  return signatures.some(candidate => secureEqual(expected, candidate));
}
