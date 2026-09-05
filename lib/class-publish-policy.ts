export type ClassMediaKind = "audio" | "video";

export function baseClassPublishAllowed(manager: boolean, realtimeMode: string) {
  return manager || realtimeMode === "group_call";
}

export function classMediaIdentityProjection(identity: string, manager: boolean) {
  return manager ? { identity } : {};
}

export function livestreamPublisherIdentityAllowed(
  user: { id: string; emailVerified: number } | null,
  participantUserId?: string | null,
) {
  return Boolean(user?.emailVerified
    && (participantUserId === undefined || participantUserId === user.id));
}

export function approvedWebinarMediaAllowed(
  requested: { mic: boolean; camera: boolean },
  approvedKinds: readonly ClassMediaKind[],
) {
  const approved = new Set(approvedKinds);
  return (!requested.mic || approved.has("audio"))
    && (!requested.camera || approved.has("video"));
}

export function missingWebinarMediaApprovals(
  manager: boolean,
  realtimeMode: string,
  requested: { mic: boolean; camera: boolean },
  approvedKinds: readonly ClassMediaKind[],
) {
  if (manager || realtimeMode !== "webinar") return [];
  const approved = new Set(approvedKinds);
  const missing: ClassMediaKind[] = [];
  if (requested.mic && !approved.has("audio")) missing.push("audio");
  if (requested.camera && !approved.has("video")) missing.push("video");
  return missing;
}
