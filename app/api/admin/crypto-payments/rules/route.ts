import { NextResponse } from "next/server";
import { boundedJsonBody } from "../../../../../lib/bounded-request-body";
import { activeCryptoSettings } from "../../../../../lib/crypto-settings";
import { cryptoRpcUrl } from "../../../../../lib/crypto-rpc";
import { createId, database, nowSeconds } from "../../../../../lib/db";
import { requirePermanentAdmin } from "../../../../../lib/member";
import { smartPay5PresetFingerprint } from "../../../../../lib/smartpay5-confirmation-control";
import { smartPay5PaymentItemDatabaseState } from "../../../../../lib/smartpay5-confirmation-store";
import { smartPay5RulePresets, smartPay5RulePresetStatus } from "../../../../../lib/smartpay5-presets";
import { smartPay5PaymentRules } from "../../../../../lib/smartpay5-server";
export const dynamic = "force-dynamic";
const validChainId = (value: unknown) => Number.isInteger(Number(value)) && Number(value) > 0;

export async function GET(request: Request) {
  try {
    await requirePermanentAdmin();
    const chainId = Number(new URL(request.url).searchParams.get("chainId"));
    if (!validChainId(chainId)) return NextResponse.json({ error: "Choose a valid chain" }, { status: 400 });
    const presets = smartPay5RulePresets(await activeCryptoSettings(), chainId);
    const state = await smartPay5PaymentItemDatabaseState(chainId, presets);
    return NextResponse.json({ enabledPresetKeys: [...state.enabledPresetKeys], knownPresetKeys: [...state.knownPresetKeys], stalePresetKeys: [...state.stalePresetKeys] });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Unable to read SmartPay confirmation state" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requirePermanentAdmin();
    const input = await boundedJsonBody<{ chainId?: number; presetKey?: string; action?: string }>(request, 8 * 1024);
    const chainId = Number(input?.chainId);
    const presetKey = String(input?.presetKey || "").trim();
    const action = String(input?.action || "");
    if (!validChainId(chainId) || !presetKey || presetKey.length > 500 || !["stop", "confirm"].includes(action)) return NextResponse.json({ error: "Invalid SmartPay confirmation request" }, { status: 400 });
    const settings = await activeCryptoSettings();
    const preset = smartPay5RulePresets(settings, chainId).find(candidate => candidate.key === presetKey);
    if (!preset) return NextResponse.json({ error: "Payment item is unavailable" }, { status: 404 });
    const now = nowSeconds();
    const presetFingerprint = smartPay5PresetFingerprint(preset);
    if (action === "stop") {
      await database().batch([
        database().prepare(`INSERT INTO smartpay5_payment_item_states (chain_id,preset_key,preset_fingerprint,enabled,updated_by_admin_id,confirmed_at,created_at,updated_at) VALUES (?,?,?,0,?,NULL,?,?) ON CONFLICT(chain_id,preset_key) DO UPDATE SET preset_fingerprint=excluded.preset_fingerprint,enabled=0,updated_by_admin_id=excluded.updated_by_admin_id,confirmed_at=NULL,updated_at=excluded.updated_at`).bind(chainId, presetKey, presetFingerprint, admin.id, now, now),
        database().prepare(`INSERT INTO crypto_payment_admin_audit (id,admin_user_id,action,setting_id,created_at) VALUES (?,?,'stop_smartpay5_payment_item',?,?)`).bind(createId(), admin.id, `${chainId}:${presetKey}`, now)
      ]);
      return NextResponse.json({ stopped: true, selectable: false });
    }
    const contractAddress = settings.find(setting => setting.id === preset.primarySettingId)?.smartPay5Contract;
    const rpcUrl = await cryptoRpcUrl(chainId);
    if (!contractAddress || !rpcUrl) return NextResponse.json({ error: "SmartPay contract is unavailable" }, { status: 503 });
    const rules = await smartPay5PaymentRules(rpcUrl, contractAddress as `0x${string}`);
    if (smartPay5RulePresetStatus(preset, rules).state !== "configured") return NextResponse.json({ error: "Current on-chain rule does not match this payment item" }, { status: 409 });
    await database().batch([
      database().prepare(`INSERT INTO smartpay5_payment_item_states (chain_id,preset_key,preset_fingerprint,enabled,updated_by_admin_id,confirmed_at,created_at,updated_at) VALUES (?,?,?,1,?,?,?,?) ON CONFLICT(chain_id,preset_key) DO UPDATE SET preset_fingerprint=excluded.preset_fingerprint,enabled=1,updated_by_admin_id=excluded.updated_by_admin_id,confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at`).bind(chainId, presetKey, presetFingerprint, admin.id, now, now, now),
      database().prepare(`INSERT INTO crypto_payment_admin_audit (id,admin_user_id,action,setting_id,created_at) VALUES (?,?,'confirm_smartpay5_payment_item',?,?)`).bind(createId(), admin.id, `${chainId}:${presetKey}`, now)
    ]);
    return NextResponse.json({ confirmed: true, selectable: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.warn("SmartPay confirmation state update failed", error instanceof Error ? error.message.slice(0, 160) : "unknown");
    return NextResponse.json({ error: "Unable to update SmartPay confirmation state" }, { status: 500 });
  }
}
