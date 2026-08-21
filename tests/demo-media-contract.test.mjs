import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("demo playlists use real credited open music and video", async () => {
  const [migration, attribution, music, video] = await Promise.all([
    read("drizzle/0113_clean_official_demo_classes.sql"),
    read("public/demo-media-attribution.txt"),
    readFile(new URL("../public/demo-music-canon-in-d.mp4", import.meta.url)),
    readFile(new URL("../public/demo-video-big-buck-bunny.mp4", import.meta.url)),
  ]);
  for (const code of ["889101", "889102", "889103"]) {
    assert.match(migration, new RegExp(code));
  }
  assert.match(migration, /Canon in D Major — Kevin MacLeod/);
  assert.match(migration, /Big Buck Bunny clip — © Blender Foundation/);
  assert.match(migration, /WHERE code IN \('889102','889103'\)/);
  const playlistQueries = migration.match(/FROM (?:live_)?class_rooms WHERE code IN \('889102','889103'\)/g) ?? [];
  assert.equal(playlistQueries.length, 3);
  assert.match(attribution, /Creative Commons Attribution 3\.0 Unported/);
  assert.match(attribution, /www\.bigbuckbunny\.org/);
  assert.ok(music.length > 1_000_000);
  assert.ok(video.length > 1_000_000);
  assert.equal(music.subarray(4, 8).toString(), "ftyp");
  assert.equal(video.subarray(4, 8).toString(), "ftyp");
});

test("permanent demo courses remain enterable", async () => {
  const schedule = await read("drizzle/0112_permanent_demo_schedule.sql");
  const normalize = await read("drizzle/0115_normalize_official_demo_classes.sql");
  assert.match(schedule, /starts_at = 4070908800/);
  assert.match(schedule, /duration_minutes = 480/);
  for (const code of ["889101", "889102", "889103"]) {
    assert.match(schedule, new RegExp(code));
    assert.match(normalize, new RegExp(code));
  }
  assert.match(normalize, /Group Call Demo Class/);
  assert.match(normalize, /Webinar Demo Class/);
  assert.match(normalize, /Livestream Demo Class/);
  assert.match(normalize, /WHERE code = '889101'/);
});
