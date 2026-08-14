import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("demo playlists use real credited open music and video", async () => {
  const [migration, attribution, music, video] = await Promise.all([
    read("drizzle/0111_real_demo_media.sql"),
    read("public/demo-media-attribution.txt"),
    readFile(new URL("../public/demo-music-canon-in-d.mp4", import.meta.url)),
    readFile(new URL("../public/demo-video-big-buck-bunny.mp4", import.meta.url)),
  ]);
  for (const code of ["889101", "889102", "889103"]) {
    assert.match(migration, new RegExp(code));
  }
  assert.match(migration, /Canon in D Major — Kevin MacLeod/);
  assert.match(migration, /Big Buck Bunny clip — © Blender Foundation/);
  assert.match(attribution, /Creative Commons Attribution 3\.0 Unported/);
  assert.match(attribution, /www\.bigbuckbunny\.org/);
  assert.ok(music.length > 1_000_000);
  assert.ok(video.length > 1_000_000);
  assert.equal(music.subarray(4, 8).toString(), "ftyp");
  assert.equal(video.subarray(4, 8).toString(), "ftyp");
});

