export type ReferralMediaItem = {
  id: string;
  kind: "image" | "video";
  url: string;
  mimeType: string;
  name: string;
  createdAt: number;
};

async function json(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Referral media request failed");
  return body;
}

export async function listReferralMedia(): Promise<ReferralMediaItem[]> {
  const body = await json(await fetch("/api/referral-media", { cache: "no-store" }));
  return Array.isArray(body.items) ? body.items : [];
}

export async function saveReferralMedia(blob: Blob, kind: "image" | "video", name: string) {
  const form = new FormData();
  form.set("kind", kind);
  form.set("file", new File([blob], name, { type: blob.type }));
  const body = await json(await fetch("/api/referral-media", { method: "PUT", body: form }));
  return body.item as ReferralMediaItem;
}

export async function deleteReferralMedia(id: string) {
  await json(await fetch(`/api/referral-media?id=${encodeURIComponent(id)}`, { method: "DELETE" }));
}
