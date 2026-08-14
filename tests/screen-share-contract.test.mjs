import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),"utf8");
test("teachers and co-teachers can share screens in audio and video classrooms",async()=>{const[room,control,realtime]=await Promise.all([read("components/live-class-room-client.tsx"),read("components/class-screen-share.tsx"),read("lib/live-class-realtimekit.ts")]);assert.match(room,/manager=\{manager\}/);assert.match(room,/ClassScreenShareStage/);assert.match(room,/disableScreenShare/);assert.match(control,/setCountdown\(5\)/);assert.match(control,/enableScreenShare/);assert.match(control,/screenshareAudio/);assert.match(control,/screenshareVideo/);assert.match(realtime,/max_screenshare_count:1/);assert.match(realtime,/can_produce:"ALLOWED"/);});
