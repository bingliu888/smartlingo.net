import assert from "node:assert/strict";
import test from "node:test";
import { classRoomWaitingCopy } from "../lib/class-room-waiting-copy.ts";

test("live course waiting states preserve Chinese through connect and Leave transitions", () => {
  assert.deepEqual(classRoomWaitingCopy("zh", true, true), {
    title: "正在连接…",
    description: "启动本站独立的实时媒体会话。只有在您选择后才会开启麦克风或摄像头。",
  });
  assert.deepEqual(classRoomWaitingCopy("zh", false, true), {
    title: "开启实时课程教室",
    description: "启动本站独立的实时媒体会话。只有在您选择后才会开启麦克风或摄像头。",
  });
  assert.deepEqual(classRoomWaitingCopy("zh", false, false), {
    title: "等待实时课程开始",
    description: "直播开始后，您会自动以观众身份加入，且不会请求设备权限。",
  });
});

test("live course waiting states retain the reviewed English behavior", () => {
  assert.deepEqual(classRoomWaitingCopy("en", true, false), {
    title: "Connecting…",
    description: "You join automatically as a viewer when streaming starts. No device permission is requested.",
  });
  assert.deepEqual(classRoomWaitingCopy("en", false, true), {
    title: "Start the live course room",
    description: "Start this site's independent live media session. Microphone and camera remain off until selected.",
  });
});
