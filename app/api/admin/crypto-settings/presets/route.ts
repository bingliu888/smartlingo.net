import { getDatabase, getSessionUser } from "@/lib/auth";
import { isPermanentAdmin } from "@/lib/admin-access";

const stableAmounts = { basic: "30", intermediate: "60", advanced: "120" };
const glcAmounts = { basic: "30000000", intermediate: "60000000", advanced: "120000000" };

const rails = [
  ["Polygon USDT", "Polygon", 137, "USDT", "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", 6, stableAmounts],
  ["Polygon GLC", "Polygon", 137, "GLC", "0x6aa3a471765e8a9884e0e6edcb0f796bf9f0b325", 18, glcAmounts],
] as const;

export async function POST(request: Request) {
  try {
    const admin = await getSessionUser();
    if (!isPermanentAdmin(admin)) {
      return Response.json({ error: "Permanent administrator access required" }, { status: 403 });
    }
    const profile = await getDatabase().prepare("SELECT wallet_address AS wallet FROM users WHERE id=? LIMIT 1").bind(admin.id).first<{ wallet: string | null }>();
    const receiverWallet = String(profile?.wallet || "").trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(receiverWallet)) {
      return Response.json({ error: "Set a public EVM receiver wallet in the administrator profile first." }, { status: 409 });
    }
    const body = await request.json().catch(() => ({})) as { walletConnectProjectId?: string };
    const walletConnectProjectId = String(body.walletConnectProjectId || "").trim();
    if (walletConnectProjectId && !/^[a-fA-F0-9]{32}$/.test(walletConnectProjectId)) {
      return Response.json({ error: "Invalid WalletConnect Project ID" }, { status: 400 });
    }
    const database = getDatabase();
    let created = 0;
    let updated = 0;
    for (const [label, chainName, chainId, tokenSymbol, tokenContract, tokenDecimals, amounts] of rails) {
      const contract = tokenContract.toLowerCase();
      const existing = await database.prepare("SELECT id FROM crypto_payment_settings WHERE chain_id=? AND lower(token_contract)=? AND deleted_at IS NULL LIMIT 1").bind(chainId, contract).first<{ id: string }>();
      if (existing) {
        await database.prepare(`UPDATE crypto_payment_settings SET label=?,chain_type='evm',chain_name=?,chain_id=?,token_symbol=?,
          token_contract=?,token_decimals=?,receiver_wallet=?,basic_token_amount=?,intermediate_token_amount=?,advanced_token_amount=?,
          min_confirmations=12,walletconnect_project_id=COALESCE(?,walletconnect_project_id),enabled=1,updated_at=unixepoch()
          WHERE id=? AND deleted_at IS NULL`)
          .bind(label,chainName,chainId,tokenSymbol,contract,tokenDecimals,receiverWallet,amounts.basic,amounts.intermediate,
            amounts.advanced,walletConnectProjectId||null,existing.id).run();
        await database.prepare("INSERT INTO crypto_payment_admin_audit(id,admin_user_id,action,setting_id) VALUES(?,?,?,?)")
          .bind(crypto.randomUUID(),admin.id,"update_standard_rail",existing.id).run();
        updated += 1;
        continue;
      }
      const id = crypto.randomUUID();
      await database.prepare(`INSERT INTO crypto_payment_settings
        (id,label,chain_type,chain_name,chain_id,token_symbol,token_contract,token_decimals,receiver_wallet,basic_amount_cents,intermediate_amount_cents,advanced_amount_cents,basic_token_amount,intermediate_token_amount,advanced_token_amount,min_confirmations,walletconnect_project_id,enabled,created_by_user_id)
        VALUES (?,?,'evm',?,?,?,?,?,?,2000,10000,30000,?,?,?,?,?,1,?)`)
        .bind(id, label, chainName, chainId, tokenSymbol, contract, tokenDecimals, receiverWallet, amounts.basic, amounts.intermediate, amounts.advanced, 12, walletConnectProjectId || null, admin.id).run();
      await database.prepare("INSERT INTO crypto_payment_admin_audit(id,admin_user_id,action,setting_id) VALUES(?,?,?,?)").bind(crypto.randomUUID(), admin.id, "create_standard_rail", id).run();
      created += 1;
    }
    return Response.json({ created, updated, configured: created + updated, total: rails.length });
  } catch (error) {
    return error instanceof Response ? error : Response.json({ error: "Unable to create standard payment rails" }, { status: 500 });
  }
}
