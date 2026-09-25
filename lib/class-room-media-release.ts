type ProviderParticipant = { micOn: number; cameraOn: number };

export function shouldReleaseLoneClassMedia(state: { hasOtherParticipants?: boolean }): boolean {
  return state.hasOtherParticipants === false;
}

export function shouldReleaseIdleClassMedia(state: {
  users: ProviderParticipant[];
  screenShareActive?: boolean;
}): boolean {
  return !state.screenShareActive && !state.users.some((user) =>
    Boolean(user.micOn || user.cameraOn));
}
