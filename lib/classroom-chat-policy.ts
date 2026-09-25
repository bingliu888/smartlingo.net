// SmartMeeting v2 private support chat contract, bound to SmartLingo class IDs.
export const CHAT_MESSAGE_RETENTION_SECONDS = 7 * 24 * 60 * 60;
export const MAX_PERSISTED_CHAT_MESSAGES = 2000;

export function canSeeClassroomChatMessage(message: {senderUserId:string|null;recipientUserId:string|null}, viewerUserId:string, supportAgent:boolean) {
  return supportAgent || message.senderUserId === viewerUserId || message.recipientUserId === viewerUserId;
}
export function validSupportReplyTarget(message: {senderUserId:string|null;recipientUserId:string|null;senderIsSupportAgent:boolean}|null) {
  return Boolean(message?.senderUserId && !message.senderIsSupportAgent && !message.recipientUserId);
}
export function canDeleteClassroomChatMessage(senderUserId:string|null,viewerUserId:string,supportAgent:boolean) {
  return supportAgent || senderUserId === viewerUserId;
}
