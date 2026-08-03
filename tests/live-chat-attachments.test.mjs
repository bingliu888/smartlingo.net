import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("Live Chat enforces the production-safe 900 KB attachment ceiling", async () => {
  const client = await readFile(
    new URL("../components/LiveChatRoom.tsx", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../app/api/message-media/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(client, /MAX_ATTACHMENT_BYTES = 900 \* 1024/);
  assert.match(client, /file\.size > MAX_ATTACHMENT_BYTES/);
  assert.match(route, /storeSmartLingoMedia/);
  assert.match(route, /kind: "chat_attachment"/);
  assert.match(client, /under 900 KB/);
  assert.doesNotMatch(client, /accept="(?:image|audio|video)\/\*/);
});

test("the scheduled Live Chat attachment fixture stays below the limit", async () => {
  const fixture = await stat(
    new URL("./fixtures/live-chat-qa.txt", import.meta.url),
  );

  assert.ok(fixture.size > 0);
  assert.ok(fixture.size < 900 * 1024);
});

test("chat files have explicit browser View and Download actions while URL messages are links", async () => {
  const client = await readFile(new URL("../components/LiveChatRoom.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/message-media/route.ts", import.meta.url), "utf8");
  const media = await readFile(new URL("../lib/smartlingo-media.ts", import.meta.url), "utf8");
  assert.match(client, /disposition=attachment/);
  assert.match(client, /target="_blank"/);
  assert.match(client, /URL_PATTERN/);
  assert.match(client, /chat-url-link/);
  assert.match(route, /searchParams\.get\("disposition"\)/);
  assert.match(media, /disposition \|\| "inline"/);
});
