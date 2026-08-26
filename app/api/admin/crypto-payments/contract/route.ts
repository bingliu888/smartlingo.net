import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { cryptoRpcUrl } from "../../../../../lib/crypto-rpc";
import { cryptoSettingById } from "../../../../../lib/crypto-settings";
import { createId, database, nowSeconds } from "../../../../../lib/db";
import { requirePermanentAdmin } from "../../../../../lib/member";
import { verifySmartPay3Identity } from "../../../../../lib/smartpay3-server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const admin = await requirePermanentAdmin();
    const input = await request.json().catch(() => null) as {
      settingId?: string;
      contractAddress?: string;
      usdtPercent?: number;
    } | null;
    const settingId = String(input?.settingId || "");
    const contractAddress = String(input?.contractAddress || "").trim().toLowerCase();
    const setting = await cryptoSettingById(settingId);
    if (!setting) return NextResponse.json({ error: "Select an active payment rail" }, { status: 400 });
    if (input?.usdtPercent != null && !contractAddress) {
      const percent = Number(input.usdtPercent);
      if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
        return NextResponse.json({ error: "SmartPay3 USDT percentage must be an integer from 0 to 100" }, { status: 400 });
      }
      const now = nowSeconds();
      await database().batch([
        database().prepare("UPDATE crypto_payment_settings SET smartpay3_usdt_percent=?,updated_at=? WHERE deleted_at IS NULL")
          .bind(percent, now),
        database().prepare(`INSERT INTO crypto_payment_admin_audit
          (id,admin_user_id,action,setting_id,created_at)
          VALUES (?,?,'update_smartpay3_usdt_percent',?,?)`)
          .bind(createId(), admin.id, settingId, now)
      ]);
      return NextResponse.json({ updated: true, usdtPercent: percent, scope: "site" });
    }
    if (!isAddress(contractAddress)) {
      return NextResponse.json({ error: "Enter a valid SmartPay3 address" }, { status: 400 });
    }
    const rpcUrl = await cryptoRpcUrl(setting.chainId);
    if (!rpcUrl) return NextResponse.json({ error: "Blockchain RPC is not configured for this network" }, { status: 503 });
    const identity = await verifySmartPay3Identity(rpcUrl, contractAddress as Address);
    const now = nowSeconds();
    await database().batch([
      database().prepare("UPDATE crypto_payment_settings SET smartpay3_contract=?,updated_at=? WHERE chain_id=? AND deleted_at IS NULL")
        .bind(contractAddress, now, setting.chainId),
      database().prepare(`INSERT INTO crypto_payment_admin_audit
        (id,admin_user_id,action,setting_id,created_at)
        VALUES (?,?,?,?,?)`)
        .bind(createId(), admin.id, "update_smartpay3_contract", settingId, now)
    ]);
    return NextResponse.json({ updated: true, contractAddress, chainId: setting.chainId, scope: "site-chain", owner: identity.owner, mainIds: identity.mainIds });
  } catch (error) {
    if (error instanceof Response) return error;
    const reason = error instanceof Error ? error.message : "";
    const invalidContract = ["CONTRACT_CODE_NOT_FOUND", "CONTRACT_IDENTITY_MISMATCH"].includes(reason);
    console.warn("SmartPay contract address update failed", reason.slice(0, 160));
    return NextResponse.json({ error: invalidContract ? "The address does not match the selected SmartPay code and ABI on this network" : "Unable to verify and save the SmartPay contract" }, { status: invalidContract ? 422 : 502 });
  }
}
