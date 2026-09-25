import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  ACTIVE_MEMBER_ROOM_TAB_SQL,CLAIM_MEMBER_ROOM_SQL,MEMBER_ROOM_LIVE_SECONDS,RELEASE_MEMBER_ROOM_SQL,
} from "../lib/class-member-room-lease-sql.ts";
import {
  canDeleteClassroomChatMessage,canSeeClassroomChatMessage,validSupportReplyTarget,
} from "../lib/classroom-chat-policy.ts";
import { audioNoteDurationAllowed, MAX_AUDIO_NOTE_BYTES } from "../lib/class-room-audio-note-policy.ts";
import { shouldReleaseIdleClassMedia, shouldReleaseLoneClassMedia } from "../lib/class-room-media-release.ts";

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
test("one authenticated member has exactly one live course-room tab, and a crashed tab expires",()=>{
  const db=new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE class_member_room_presence(room_id TEXT,user_id TEXT,tab_id TEXT,display_name TEXT,entered_at INTEGER,last_seen_at INTEGER,PRIMARY KEY(room_id,user_id))`);
  const claim=db.prepare(CLAIM_MEMBER_ROOM_SQL),active=db.prepare(ACTIVE_MEMBER_ROOM_TAB_SQL),release=db.prepare(RELEASE_MEMBER_ROOM_SQL);
  const first="11111111-1111-4111-8111-111111111111",second="22222222-2222-4222-8222-222222222222";
  assert.equal(claim.run("room","member",first,"Learner",100,100,100-MEMBER_ROOM_LIVE_SECONDS).changes,1);
  assert.equal(claim.run("room","member",second,"Learner",101,101,101-MEMBER_ROOM_LIVE_SECONDS).changes,0);
  assert.ok(active.get("room","member",first,101-MEMBER_ROOM_LIVE_SECONDS));
  assert.equal(claim.run("room","member",second,"Learner",120,120,120-MEMBER_ROOM_LIVE_SECONDS).changes,1);
  release.run("room","member",first);
  assert.ok(active.get("room","member",second,120-MEMBER_ROOM_LIVE_SECONDS));
  release.run("room","member",second);
  assert.equal(active.get("room","member",second,120-MEMBER_ROOM_LIVE_SECONDS),undefined);
  db.close();
});

test("private room messages remain visible only to sender, host team, and named reply recipient",()=>{
  const request={senderUserId:"member-a",recipientUserId:null};
  const reply={senderUserId:"host",recipientUserId:"member-a"};
  assert.equal(canSeeClassroomChatMessage(request,"member-a",false),true);
  assert.equal(canSeeClassroomChatMessage(request,"member-b",false),false);
  assert.equal(canSeeClassroomChatMessage(request,"host",true),true);
  assert.equal(canSeeClassroomChatMessage(reply,"member-a",false),true);
  assert.equal(canSeeClassroomChatMessage(reply,"member-b",false),false);
  assert.equal(validSupportReplyTarget({...request,senderIsSupportAgent:false}),true);
  assert.equal(validSupportReplyTarget({...reply,senderIsSupportAgent:true}),false);
  assert.equal(canDeleteClassroomChatMessage("member-a","member-b",false),false);
  assert.equal(canDeleteClassroomChatMessage("member-a","member-a",false),true);
});

test("the provider join and room UI retain SmartMeeting v2 member gates",()=>{
  const join=read("app/api/classrooms/[code]/join/route.ts");
  const room=read("components/live-class-room-client.tsx");
  const chat=read("app/api/classrooms/[code]/chat/route.ts");
  assert.match(join,/hasMemberRoomTab\(room\.id,user\.id,roomTabId\)/);
  assert.match(join,/onlineClassMembers\(room\.id\)\)\.length < 2/);
  assert.match(room,/setWaitingMedia\(nextMic\|\|nextCamera\?next:null\)/);
  assert.match(room,/onlineMembers\.length<2\|\|!waitingMedia\|\|joined\|\|joining\.current\|\|resourceBusy/);
  assert.match(chat,/chat\.sender_user_id=\? OR chat\.recipient_user_id=\?/);
  assert.match(chat,/Choose a member message to reply to/);
});

test("local audio notes use the same 15-minute capture and 30-minute file contract",()=>{
  assert.equal(audioNoteDurationAllowed("browser",900),true);
  assert.equal(audioNoteDurationAllowed("browser",901),false);
  assert.equal(audioNoteDurationAllowed("file",1800),true);
  assert.equal(audioNoteDurationAllowed("file",1801),false);
  assert.equal(audioNoteDurationAllowed("meeting",300),false);
  assert.equal(MAX_AUDIO_NOTE_BYTES,100*1024*1024);
});

test("an expired page lease cannot cut a live provider peer or publisher",()=>{
  // Presence may say one member while a background listener still has a
  // connected RealtimeKit session. An uncertain server answer must retry.
  assert.equal(shouldReleaseLoneClassMedia({hasOtherParticipants:true}),false);
  assert.equal(shouldReleaseLoneClassMedia({}),false);
  assert.equal(shouldReleaseLoneClassMedia({hasOtherParticipants:false}),true);
  assert.equal(shouldReleaseIdleClassMedia({users:[{micOn:1,cameraOn:0}]}),false);
  assert.equal(shouldReleaseIdleClassMedia({users:[{micOn:0,cameraOn:1}]}),false);
  assert.equal(shouldReleaseIdleClassMedia({users:[],screenShareActive:true}),false);
  assert.equal(shouldReleaseIdleClassMedia({users:[{micOn:0,cameraOn:0}]}),true);
});
