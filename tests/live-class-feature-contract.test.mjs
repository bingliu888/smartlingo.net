import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("SmartLingo classroom data and media are isolated", () => {
  const migration = read("drizzle/0099_live_class_rooms.sql");
  const config = read("wrangler.cloudflare.jsonc");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS live_class_rooms/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS live_class_media_presence/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS live_class_chat_messages/);
  assert.match(config, /816eb53a-1dc8-4939-9716-500747e385db/);
  assert.match(config, /smartlingo-net-class-files/);
  assert.doesNotMatch(config, /40e38988-f116-43bd-91eb-6e5def18cf0c/);
  assert.doesNotMatch(config, /6600026b-1e03-40e9-a8cf-49802ca50c2d/);
});

test("class creation and publishing honor the SmartLingo admin and eight-speaker rules", () => {
  const rooms = read("lib/live-classrooms.ts");
  const join = read("app/api/classrooms/[code]/join/route.ts");
  assert.match(rooms, /if \(!await isAdminUser\(user\)\) throw new Error\("ADMIN_REQUIRED"\)/);
  assert.match(join, /Number\(count\?\.count\|\|0\)>=8/);
  assert.match(join, /WAITING_FOR_MANAGER/);
  assert.match(join, /group_call|createClassParticipant/);
});

test("class entrances exist on home, dashboard, and community", () => {
  const home = read("app/[lang]/page.tsx");
  const dashboard = read("app/[lang]/dashboard/page.tsx") + read("app/[lang]/dashboard/page.tsx");
  const community = read("app/[lang]/community/page.tsx");
  assert.match(home, /classrooms/);
  assert.match(dashboard, /classrooms/);
  assert.match(dashboard, /isAdmin/);
  assert.match(dashboard, /classrooms/);
  assert.match(community, /classrooms/);
});

test("viewer join is permission-free and video tiles support fullscreen", () => {
  const room = read("components/live-class-room-client.tsx");
  const css = read("app/[lang]/classrooms/classrooms.css");
  assert.match(room, /state\.streamActive&&!joined&&!joining\.current\)void connect\(\)/);
  assert.match(room, /setInterval\(\(\)=>void check\(\),3000\)/);
  assert.match(room, /class-video-tile\$\{selected\?" selected":""\}/);
  assert.match(css, /class-video-tile\.selected/);
});
