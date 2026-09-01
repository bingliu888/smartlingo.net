/**
 * One permanent SmartLingo room can create many provider generations, but
 * each generation has a strict two-hour privacy and cost boundary. Ending a
 * generation never deletes or permanently ends the SmartLingo room.
 */
export const MAX_PROVIDER_SESSION_SECONDS=120*60;
// RealtimeKit documents roughly 300 MB/hour for a typical recording. One GiB
// leaves substantial codec/header variance above a two-hour session while
// preventing an absent or dishonest Content-Length from reserving 2 GiB.
export const MAX_PROVIDER_AUDIO_ARCHIVE_BYTES=1024*1024*1024;

export function providerSessionExpired(
  meeting:{providerMeetingId:string|null;liveStartedAt:number|null},
  nowSeconds:number,
){
  return Boolean(meeting.providerMeetingId&&meeting.liveStartedAt
    &&meeting.liveStartedAt<=nowSeconds-MAX_PROVIDER_SESSION_SECONDS);
}
