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
  assert.match(page, /<CommunityMeetings lang=\{lang\} signedIn=\{signedIn\}\/?>/);
  assert.match(page, /<CommunityClient lang=\{lang\} signedIn=\{signedIn\}\/?>/);
  assert.match(page, /<NearbyLearning lang=\{lang\} signedIn=\{signedIn\}\/?>/);
});

test("Community meetings and discussions are public to read while mutations remain authenticated", () => {
  const meetingsRoute = read("app/api/community/meetings/route.ts");
  const communityRoute = read("app/api/community/route.ts");
  const communityClient = read("components/CommunityClient.tsx");
  const meetingsClient = read("components/CommunityMeetings.tsx");
  const meetingsGet = meetingsRoute.slice(meetingsRoute.indexOf("export async function GET"), meetingsRoute.indexOf("export async function POST"));
  const communityGet = communityRoute.slice(communityRoute.indexOf("export async function GET"), communityRoute.indexOf("export async function POST"));
  assert.doesNotMatch(meetingsGet, /Unauthorized/);
  assert.doesNotMatch(communityGet, /Unauthorized/);
  assert.match(meetingsGet, /viewerAuthenticated: Boolean\(user\)/);
  assert.match(communityGet, /viewerAuthenticated: Boolean\(user\)/);
  assert.match(meetingsGet, /ownerUserId: ""/);
  assert.match(meetingsGet, /threadId: ""/);
  assert.match(meetingsGet, /activeCallId: null/);
  assert.match(communityGet, /const authorProjection = user \? "u\.id" : "''"/);
  assert.match(meetingsRoute, /if \(!user\) return NextResponse\.json\(\{ error: "Unauthorized" \}/);
  assert.match(communityRoute, /if \(!user\) return NextResponse\.json\(\{ error: "Unauthorized" \}/);
  assert.match(communityClient, /signedIn \? <form className="topic-compose"/);
  assert.match(communityClient, /Open for everyone to read/);
  assert.match(meetingsClient, /signedIn \? <button className="meeting-schedule"/);
  assert.match(meetingsClient, /Sign in to join/);
});

test("only the host can end a meeting and ending closes its active realtime call", () => {
  const route = read("app/api/community/meetings/route.ts");
  assert.match(route, /Only the host can end this meeting/);
  assert.match(route, /UPDATE community_meetings SET ended_at/);
  assert.match(route, /UPDATE message_calls SET status = 'ended'/);
});
