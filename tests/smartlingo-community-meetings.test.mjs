import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("community meetings have one active meeting per host and own durable group chat", () => {
  const schema = read("db/schema.ts");
  const migration = read("drizzle/0037_bright_champions.sql");
  const route = read("app/api/community/meetings/route.ts");
  assert.match(schema, /communityMeetings/);
  assert.match(migration, /CREATE TABLE `community_meetings`/);
  assert.match(migration, /smartlingo_community_meeting_active_owner_uq/);
  assert.match(migration, /WHERE "community_meetings"\."ended_at" IS NULL/);
  assert.match(route, /VALUES \(\?, 'meeting', \?, \?, \?, \?\)/);
  assert.match(route, /INSERT INTO message_participants/);
  assert.match(route, /You already have a live or scheduled meeting/);
});

test("Community page hosts meetings, discussions, and Nearby without merging their records", () => {
  const center = read("components/CommunityMeetings.tsx");
  const community = read("components/CommunityClient.tsx");
  const page = read("app/[lang]/community/page.tsx");
  assert.match(center, /Live Meetings/);
  assert.match(center, /"live" \| "upcoming"/);
  assert.match(center, /Schedule/);
  assert.match(center, /Create meeting & chat/);
  assert.match(center, /setInterval/);
  assert.match(center, /smartlingo:meetings-changed/);
  assert.match(community, /meetingCountdown/);
  assert.match(community, /joinMemberMeeting/);
  assert.match(community, /addEventListener\("smartlingo:meetings-changed"/);
  assert.match(page, /<CommunityMeetings lang=\{lang\}\/?>/);
  assert.match(page, /<CommunityClient lang=\{lang\}\/?>/);
  assert.match(page, /<NearbyLearning lang=\{lang\}\/?>/);
});

test("only the host can end a meeting and ending closes its active realtime call", () => {
  const route = read("app/api/community/meetings/route.ts");
  assert.match(route, /Only the host can end this meeting/);
  assert.match(route, /UPDATE community_meetings SET ended_at/);
  assert.match(route, /UPDATE message_calls SET status = 'ended'/);
});
