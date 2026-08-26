import { getDatabase, getSessionUser } from "@/lib/auth";
import { isPermanentAdmin } from "@/lib/admin-access";

const stableAmounts = { basic: "20", intermediate: "100", advanced: "300" };
const glcAmounts = { basic: "20000000", intermediate: "100000000", advanced: "300000000" };

const rails = [
  ["Ethereum USDT", "Ethereum", 1, "USDT", "0xdAC17F958D2ee523a2206206994597C13D831ec7", 6, stableAmounts],
  ["Ethereum USDC", "Ethereum", 1, "USDC", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", 6, stableAmounts],
  ["BSC USDT", "BNB Smart Chain", 56, "USDT", "0x55d398326f99059fF775485246999027B3197955", 18, stableAmounts],
  ["BSC USDC", "BNB Smart Chain", 56, "USDC", "0x8AC76a51cc950d9822D68b83fe1Ad97B32Cd580d", 18, stableAmounts],
  ["Polygon USDT", "Polygon", 137, "USDT", "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", 6, stableAmounts],
  ["Polygon USDC", "Polygon", 137, "USDC", "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", 6, stableAmounts],
  ["Base USDT", "Base", 8453, "USDT", "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", 6, stableAmounts],
  ["Base USDC", "Base", 8453, "USDC", "0x833589fCD6E08f4c7C32D4f71b54bdA02913", 6, stableAmounts],
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
    for (const [label, chainName, chainId, tokenSymbol, tokenContract, tokenDecimals, amounts] of rails) {
      const contract = tokenContract.toLowerCase();
      const existing = await database.prepare("SELECT id FROM crypto_payment_settings WHERE chain_id=? AND lower(token_contract)=? AND deleted_at IS NULL LIMIT 1").bind(chainId, contract).first<{ id: string }>();
      if (existing) continue;
      const id = crypto.randomUUID();
      await database.prepare(`INSERT INTO crypto_payment_settings
        (id,label,chain_type,chain_name,chain_id,token_symbol,token_contract,token_decimals,receiver_wallet,basic_amount_cents,intermediate_amount_cents,advanced_amount_cents,basic_token_amount,intermediate_token_amount,advanced_token_amount,min_confirmations,walletconnect_project_id,enabled,created_by_user_id)
        VALUES (?,?,'evm',?,?,?,?,?,?,2000,10000,30000,?,?,?,?,?,1,?)`)
        .bind(id, label, chainName, chainId, tokenSymbol, contract, tokenDecimals, receiverWallet, amounts.basic, amounts.intermediate, amounts.advanced, 12, walletConnectProjectId || null, admin.id).run();
      await database.prepare("INSERT INTO crypto_payment_admin_audit(id,admin_user_id,action,setting_id) VALUES(?,?,?,?)").bind(crypto.randomUUID(), admin.id, "create_standard_rail", id).run();
      created += 1;
    }
    return Response.json({ created, total: rails.length });
  } catch (error) {
    return error instanceof Response ? error : Response.json({ error: "Unable to create standard payment rails" }, { status: 500 });
  }
}
