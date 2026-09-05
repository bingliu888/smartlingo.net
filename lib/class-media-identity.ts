export function participantIdentityTokenMatches(
  previousTokenHash: string | null,
  suppliedTokenHash: string | null,
) {
  return Boolean(
    previousTokenHash
      && suppliedTokenHash
      && previousTokenHash === suppliedTokenHash,
  );
}
