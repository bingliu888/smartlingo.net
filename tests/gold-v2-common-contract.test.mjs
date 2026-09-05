import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Gold v2 records reviewed common contracts and SmartLingo-only adapters", async () => {
  const migration = JSON.parse(await read("gold-v2-migration.json"));
  assert.equal(migration.target, "smartlingo.net");
  assert.equal(migration.reviewedSource.site, "smartmeeting.club");
  assert.equal(migration.reviewedAdaptation.site, "smartnct.com");
  assert.equal(migration.reviewedCanonical.site, "geniuswallet.pro");
  assert.ok(migration.commonContracts.some((item) => /silent viewers remain connected/i.test(item)));
  assert.ok(migration.commonContracts.some((item) => /shared payer-wallet attribution/i.test(item)));
  assert.ok(migration.targetAdapters.some((item) => /SmartLingo-owned Clerk, D1, R2, RealtimeKit, SmartPay5/i.test(item)));
});

test("identity and payment preserve account ownership while trusting verified SmartPay5 records", async () => {
  const [migration, identity, wallet, profile, walletRoute, checkout, route, claim, server] = await Promise.all([
    read("drizzle/0175_gold_v2_identity_commerce.sql"),
    read("lib/auth.ts"),
    read("lib/wallet-binding.ts"),
    read("app/api/profile/route.ts"),
    read("app/api/billing/crypto/wallet/route.ts"),
    read("components/CryptoCheckout.tsx"),
    read("app/api/billing/crypto/smartpay/claim/route.ts"),
    read("lib/smartlingo-smartpay-claim.ts"),
    read("lib/smartpay5-server.ts"),
  ]);
  assert.match(migration, /user_id TEXT PRIMARY KEY/);
  assert.match(migration, /smartpay_wallet_lookup_idx/);
  assert.doesNotMatch(migration, /wallet_address TEXT NOT NULL UNIQUE/);
  assert.match(identity, /resolveActiveClerkPrimaryEmail/);
  assert.match(identity, /synchronizeClerkIdentity/);
  assert.match(identity, /rekeyLinkedClerkUser/);
  assert.match(identity, /bindVerifiedLegacyClerkUser/);
  assert.match(identity, /const clerkUser = await currentUser\(\)\.catch\(\(\) => null\)/);
  assert.doesNotMatch(identity, /FROM sessions|INSERT INTO sessions/);
  assert.match(wallet, /ON CONFLICT\(user_id\)/);
  assert.doesNotMatch(wallet, /WALLET_ALREADY_IN_USE/);
  assert.match(profile, /bindSmartPayWallet\(user\.id, walletAddress\)/);
  assert.doesNotMatch(profile, /WALLET_BELONGS_TO_SUBSCRIBED_ACCOUNT|already belongs to another account/);
  assert.doesNotMatch(walletRoute, /WALLET_BELONGS_TO_SUBSCRIBED_ACCOUNT|already belongs to another account/);
  assert.doesNotMatch(checkout, /another account with subscription history|WALLET_ALREADY_IN_USE/);
  assert.match(route, /boundedJsonBody/);
  assert.match(route, /consumeAccountRequestLimit/);
  assert.match(claim, /smartPay5TransactionById/);
  assert.match(claim, /smartPayRecordTimestamp/);
  assert.doesNotMatch(claim, /PAYMENT_AMOUNT_MISMATCH|verifySmartPay5Receipt/);
  assert.match(claim, /'pending_sync'/);
  assert.match(claim, /ON CONFLICT\(contract_address,transaction_id\) DO NOTHING/);
  assert.match(claim, /confirmations < requiredConfirmations/);
  assert.match(server, /smartPay5ReceiptByTransactionId/);
  assert.match(server, /transactionById/);
});

test("generation-scoped tab sessions enforce room and publisher capacities", async () => {
  const [migration, sessions, join] = await Promise.all([
    read("drizzle/0176_gold_v2_realtime_lifecycle.sql"),
    read("lib/class-participant-session.ts"),
    read("app/api/classrooms/[code]/join/route.ts"),
  ]);
  assert.match(migration, /class_realtime_capacity_ledger/);
  assert.match(migration, /realtime_mode='group_call' THEN 100 ELSE 9/);
  assert.match(migration, /CREATE TRIGGER class_session_participant_limit_insert/);
  assert.match(migration, /CREATE TRIGGER class_session_publisher_limit_update/);
  assert.match(sessions, /PARTICIPANT_SESSION_PER_HUMAN_LIMIT = 4/);
  assert.match(sessions, /token_hash/);
  assert.match(sessions, /media_identity<>\? AND active=1/);
  assert.match(sessions, /class_participant_bans/);
  assert.match(join, /sessionToken: reserved\.token/);
  assert.match(join, /four active tabs/);
});

test("two-hour provider generations do not eject silent viewers on publisher Leave", async () => {
  const [policy, lifecycle, media] = await Promise.all([
    read("lib/class-session-policy.ts"),
    read("lib/class-provider-lifecycle.ts"),
    read("app/api/classrooms/[code]/media/route.ts"),
  ]);
  assert.match(policy, /MAX_PROVIDER_SESSION_SECONDS=120\*60/);
  assert.match(lifecycle, /queueExpiredClassProviderGenerations/);
  const leave = media.match(/if \(action === "leave"\) \{[\s\S]*?return Response\.json\(\{ ok: true \}\);\n  \}/)?.[0] || "";
  assert.match(leave, /revokeParticipantSession/);
  assert.match(leave, /Silent viewers and moderators keep the provider generation alive/);
  assert.doesNotMatch(leave, /queueClassProviderTeardown|stream_active=0|provider_meeting_id=NULL/);
});

test("private classroom files, recordings, and deletion use bounded durable storage", async () => {
  const [migration, materials, material, playlist, quota, recording, recordingLifecycle, deletion] = await Promise.all([
    read("drizzle/0177_gold_v2_private_storage.sql"),
    read("app/api/classrooms/[code]/materials/route.ts"),
    read("app/api/classrooms/[code]/materials/[id]/route.ts"),
    read("app/api/classrooms/[code]/playlist/route.ts"),
    read("lib/member-storage-quota.ts"),
    read("app/api/classrooms/[code]/recording/route.ts"),
    read("lib/class-recording.ts"),
    read("lib/class-deletion.ts"),
  ]);
  for (const table of [
    "member_storage_quota_reservations",
    "class_material_uploads",
    "class_playlist_uploads",
    "class_file_tombstones",
    "class_recording_quota_reservations",
  ]) assert.match(migration, new RegExp(table));
  assert.match(materials, /boundedRequestStream/);
  assert.match(materials, /commitMemberStorageReservation[\s\S]*INSERT INTO live_class_materials/);
  assert.match(material, /boundedByteRange/);
  assert.match(material, /private, no-store/);
  assert.match(playlist, /commitMemberStorageReservation[\s\S]*INSERT INTO class_playlist_items/);
  assert.match(quota, /state === "used"/);
  assert.match(recording, /requireParticipantSession/);
  assert.match(recordingLifecycle, /DELETED_RECORDING_R2_GRACE_SECONDS = 6 \* 60 \* 60/);
  assert.match(deletion, /deleteOneR2PrefixPage/);
});

test("Gold v2 requests and providers are bounded and maintenance runs every five minutes", async () => {
  const [bounded, external, rpc, realtime, stripe, source, sourceRoute, deploymentRoute, worker, config, assistant] = await Promise.all([
    read("lib/bounded-request-body.ts"),
    read("lib/external-request-timeout.ts"),
    read("lib/crypto-rpc.ts"),
    read("lib/realtimekit.ts"),
    read("lib/stripe-course-subscription.ts"),
    read("lib/smartpay-source-verification.ts"),
    read("app/api/contracts/smartpay5/route.ts"),
    read("app/api/admin/smartpay/deployment/route.ts"),
    read("worker/index.ts"),
    read("wrangler.cloudflare.jsonc"),
    read("app/api/assistant/route.ts"),
  ]);
  assert.match(bounded, /Request body is too large/);
  assert.match(external, /EXTERNAL_REQUEST_TIMEOUT/);
  assert.match(rpc, /withExternalRequestTimeout/);
  assert.match(rpc, /readBoundedExternalResponseText\(response, 512 \* 1024\)/);
  for (const provider of [realtime, stripe, source, sourceRoute, deploymentRoute]) {
    assert.match(provider, /withExternalRequestTimeout/);
    assert.match(provider, /readBoundedExternalResponseText/);
  }
  assert.match(deploymentRoute, /boundedJsonBody/);
  assert.match(worker, /scheduled/);
  assert.match(worker, /runClassMaintenance/);
  assert.match(config, /"\*\/5 \* \* \* \*"/);
  assert.match(config, /"cpu_ms": 1000/);
  assert.match(config, /"REALTIMEKIT_GUEST_PRESET": "group_call_guest"/);
  assert.match(config, /"REALTIMEKIT_HOST_PRESET": "group_call_host"/);
  assert.match(config, /"REALTIMEKIT_WEBINAR_VIEWER_PRESET": "webinar_viewer"/);
  assert.match(assistant, /readSmartAiJsonRequest/);
  assert.match(assistant, /consumeAiDailyQuota/);
});

test("class passwords upgrade to PBKDF2 while retaining legacy read compatibility", async () => {
  const password = await read("lib/class-password.ts");
  assert.match(password, /PBKDF2_ITERATIONS = 210_000/);
  assert.match(password, /pbkdf2-sha256/);
  assert.match(password, /\^\[a-f0-9\]\{64\}\$/);
  assert.match(password, /function equalBytes/);
  assert.match(password, /difference \|= left\[index\] \^ right\[index\]/);
});

test("SmartLingo provider participant identities never retain a copied site prefix", async () => {
  const [sessions, provider] = await Promise.all([
    read("lib/class-participant-session.ts"),
    read("lib/live-class-realtimekit.ts"),
  ]);
  assert.match(sessions, /`sl:\$\{session\.id\}:\$\{id\}`/);
  assert.match(provider, /\^sl:/);
  assert.doesNotMatch(`${sessions}\n${provider}`, /gw:/);
});
