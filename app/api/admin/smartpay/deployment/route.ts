import { NextResponse } from "next/server";
import { isAddress, type Address, type Hex } from "viem";
import smartPay3ArtifactJson from "../../../../../contracts/artifacts/SmartPay3.json";
import { cryptoRpc, cryptoRpcUrl } from "../../../../../lib/crypto-rpc";
import { cryptoSettingById } from "../../../../../lib/crypto-settings";
import { createId, database, nowSeconds } from "../../../../../lib/db";
import { requirePermanentAdmin } from "../../../../../lib/member";
import {
  SMARTPAY3_FACTORY_ADDRESS,
  smartPay3DeploymentData,
  smartPay3FactoryDeployment,
  smartPay3FactoryDeploymentFromSalt
} from "../../../../../lib/smartpay-deployment";
import { verifySmartPay3Identity } from "../../../../../lib/smartpay3-server";
import {
  smartPay3SourceVerificationPayload,
  smartPayExplorerAddressUrl,
  smartPayExplorerVerificationStatus,
  smartPaySourceDownloadUrls,
  type SmartPay3VerificationArtifact
} from "../../../../../lib/smartpay-source-verification";
import { SMARTPAY3_ABI } from "../../../../../lib/smartpay3";

export const dynamic = "force-dynamic";

type SmartPayArtifact = {
  contractName?: string;
  compiler?: string;
  bytecode?: string;
};

type VerificationResult = {
  submitted: boolean;
  skipped?: boolean;
  verified?: boolean;
  verificationId?: string;
  message?: string;
};

const serviceMessage = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 200);

async function submitSourcify(chainId: number, contract: Address, payload: ReturnType<typeof smartPay3SourceVerificationPayload>["sourcify"]) {
  const response = await fetch(`https://sourcify.dev/server/v2/verify/${chainId}/${contract}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({})) as { verificationId?: string; message?: string; error?: string };
  const message = serviceMessage(data.message || data.error);
  const alreadyVerified = /already verified/i.test(message);
  return {
    submitted: Boolean(response.ok && data.verificationId) || alreadyVerified,
    verificationId: data.verificationId,
    message: message || (response.ok ? "Verification submitted" : `Sourcify HTTP ${response.status}`)
  } satisfies VerificationResult;
}

async function submitEtherscan(chainId: number, contract: Address, payload: ReturnType<typeof smartPay3SourceVerificationPayload>["etherscan"]) {
  const publicStatus = await smartPayExplorerVerificationStatus(chainId, contract);
  if (publicStatus.verified) return {
    submitted: true,
    verified: true,
    message: publicStatus.message
  } satisfies VerificationResult;
  const { env } = await import("cloudflare:workers");
  const apiKey = String((env as unknown as Record<string, string | undefined>).ETHERSCAN_API_KEY || "").trim();
  if (!apiKey) return { submitted: false, skipped: true, message: "ETHERSCAN_API_KEY is not configured" } satisfies VerificationResult;
  const endpoint = new URL("https://api.etherscan.io/v2/api");
  endpoint.searchParams.set("apikey", apiKey);
  endpoint.searchParams.set("chainid", String(chainId));
  const body = new URLSearchParams({
    module: "contract",
    action: "verifysourcecode",
    contractaddress: contract,
    ...payload
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const data = await response.json().catch(() => ({})) as { status?: string; message?: string; result?: string };
  const message = serviceMessage(data.result || data.message);
  const alreadyVerified = /already verified/i.test(message);
  const submitted = (response.ok && data.status === "1") || alreadyVerified;
  if (!submitted) return {
    submitted: false,
    verified: false,
    message: message || (response.ok ? "Explorer verification rejected" : `Etherscan HTTP ${response.status}`)
  } satisfies VerificationResult;
  if (alreadyVerified) return {
    submitted: true,
    verified: true,
    message
  } satisfies VerificationResult;
  const verificationId = data.status === "1" ? data.result : undefined;
  if (!verificationId) return { submitted: true, verified: false, message } satisfies VerificationResult;
  let statusMessage = message;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (attempt) await new Promise(resolve => globalThis.setTimeout(resolve, 2_000));
    const statusUrl = new URL("https://api.etherscan.io/v2/api");
    statusUrl.searchParams.set("apikey", apiKey);
    statusUrl.searchParams.set("chainid", String(chainId));
    statusUrl.searchParams.set("module", "contract");
    statusUrl.searchParams.set("action", "checkverifystatus");
    statusUrl.searchParams.set("guid", verificationId);
    const statusResponse = await fetch(statusUrl, { headers: { accept: "application/json" } });
    const statusData = await statusResponse.json().catch(() => ({})) as { status?: string; message?: string; result?: string };
    statusMessage = serviceMessage(statusData.result || statusData.message) || statusMessage;
    if (statusResponse.ok && statusData.status === "1") return {
      submitted: true,
      verified: true,
      verificationId,
      message: statusMessage
    } satisfies VerificationResult;
    if (!/pending|queue/i.test(statusMessage)) break;
  }
  return {
    submitted: true,
    verified: false,
    verificationId,
    message: statusMessage || "Explorer verification is still pending"
  } satisfies VerificationResult;
}

export async function GET() {
  try {
    await requirePermanentAdmin();
    const artifact = smartPay3ArtifactJson as SmartPayArtifact;
    if (artifact.contractName !== "SmartPay3" || !artifact.compiler || !/^0x(?:[0-9a-f]{2})+$/i.test(artifact.bytecode || "")) {
      return NextResponse.json({ error: "SmartPay3 deployment artifact is unavailable" }, { status: 503 });
    }
    return NextResponse.json({
      contractName: artifact.contractName,
      compiler: artifact.compiler,
      bytecode: artifact.bytecode,
      constructorInputs: ["initialOwner"]
    }, {
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "SmartPay deployment artifact is unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requirePermanentAdmin();
    const input = await request.json().catch(() => null) as {
      settingId?: unknown;
      contractAddress?: unknown;
      transactionHash?: unknown;
      deploymentSalt?: unknown;
      confirmPublicSource?: unknown;
      retryExisting?: unknown;
    } | null;
    const settingId = String(input?.settingId || "");
    const contractAddress = String(input?.contractAddress || "").trim().toLowerCase();
    let transactionHash = String(input?.transactionHash || "").trim();
    const deploymentSalt = String(input?.deploymentSalt || "").trim().toLowerCase();
    const retryExisting = input?.retryExisting === true;
    const contractName = "SmartPay3";
    const artifactJson = smartPay3ArtifactJson;
    const setting = await cryptoSettingById(settingId);
    const savedContract = setting?.smartPay3Contract;
    if (input?.confirmPublicSource !== true || !setting || !isAddress(contractAddress)
      || (!retryExisting && !/^0x[0-9a-f]{64}$/i.test(transactionHash))
      || (deploymentSalt && !/^0x[0-9a-f]{64}$/i.test(deploymentSalt))
      || savedContract?.toLowerCase() !== contractAddress) {
      return NextResponse.json({ error: `A saved ${contractName} deployment and explicit public-source confirmation are required` }, { status: 400 });
    }
    if (retryExisting) {
      const publication = await database().prepare(`SELECT deployment_tx_hash AS deploymentTxHash
        FROM smartpay_source_publications WHERE chain_id=? AND lower(contract_address)=lower(?) LIMIT 1`)
        .bind(setting.chainId, contractAddress).first<{ deploymentTxHash: string }>();
      if (!publication || !/^0x[0-9a-f]{64}$/i.test(publication.deploymentTxHash)) {
        return NextResponse.json({ error: `Publish this ${contractName} source once before retrying explorer verification` }, { status: 409 });
      }
      transactionHash = publication.deploymentTxHash;
    }
    const rpcUrl = await cryptoRpcUrl(setting.chainId);
    if (!rpcUrl) return NextResponse.json({ error: "Blockchain RPC is not configured for this network" }, { status: 503 });
    const identity = await verifySmartPay3Identity(rpcUrl, contractAddress as Address);
    const receipt = await cryptoRpc<{ contractAddress?: string | null; status?: string; to?: string | null }>(rpcUrl, "eth_getTransactionReceipt", [transactionHash]);
    if (receipt.status !== "0x1") {
      return NextResponse.json({ error: `The deployment receipt does not match the saved ${contractName} address` }, { status: 422 });
    }
    const directDeployment = receipt.contractAddress?.toLowerCase() === contractAddress;
    let factoryDeployment = false;
    if (retryExisting) {
      factoryDeployment = !directDeployment;
    } else if (!directDeployment) {
      const transaction = await cryptoRpc<{ from?: string; to?: string | null; input?: string }>(rpcUrl, "eth_getTransactionByHash", [transactionHash]);
      const artifact = {
        contractName: artifactJson.contractName,
        compiler: artifactJson.compiler,
        bytecode: artifactJson.bytecode as Hex,
        constructorInputs: ["initialOwner"]
      } as never;
      const creationData = smartPay3DeploymentData(artifact, identity.owner, SMARTPAY3_ABI);
      const expected = deploymentSalt
        ? smartPay3FactoryDeploymentFromSalt(creationData, deploymentSalt as Hex)
        : smartPay3FactoryDeployment(creationData, identity.owner, setting.chainId, "smartlingo.net");
      factoryDeployment = expected.contractAddress.toLowerCase() === contractAddress
        && receipt.to?.toLowerCase() === SMARTPAY3_FACTORY_ADDRESS.toLowerCase()
        && transaction.to?.toLowerCase() === SMARTPAY3_FACTORY_ADDRESS.toLowerCase()
        && transaction.from?.toLowerCase() === identity.owner.toLowerCase()
        && transaction.input?.toLowerCase() === expected.data.toLowerCase();
      if (!factoryDeployment) {
        return NextResponse.json({ error: `The deployment receipt does not match the saved ${contractName} address` }, { status: 422 });
      }
    }
    const verificationArtifact = artifactJson as SmartPay3VerificationArtifact;
    const payload = smartPay3SourceVerificationPayload(verificationArtifact, identity.owner, directDeployment ? transactionHash as Hex : undefined);
    const publishedSource = verificationArtifact.standardJsonInput.sources[verificationArtifact.sourceName].content;
    const [sourcify, explorer] = await Promise.all([
      submitSourcify(setting.chainId, contractAddress as Address, payload.sourcify),
      submitEtherscan(setting.chainId, contractAddress as Address, payload.etherscan)
    ]);
    const submitted = sourcify.submitted || explorer.submitted;
    const publishedAt = nowSeconds();
    if (submitted) {
      await database().batch([
        database().prepare(`INSERT INTO smartpay_source_publications
          (id,chain_id,contract_address,deployment_tx_hash,compiler_version,source_code,standard_json_input,sourcify_verification_id,explorer_verification_id,published_by_admin_user_id,published_at,sourcify_message,explorer_message,explorer_verified,verification_updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(chain_id,contract_address) DO UPDATE SET
            deployment_tx_hash=excluded.deployment_tx_hash,
            compiler_version=excluded.compiler_version,
            source_code=excluded.source_code,
            standard_json_input=excluded.standard_json_input,
            sourcify_verification_id=COALESCE(excluded.sourcify_verification_id,smartpay_source_publications.sourcify_verification_id),
            explorer_verification_id=COALESCE(excluded.explorer_verification_id,smartpay_source_publications.explorer_verification_id),
            published_by_admin_user_id=excluded.published_by_admin_user_id,
            published_at=excluded.published_at,
            sourcify_message=excluded.sourcify_message,
            explorer_message=excluded.explorer_message,
            explorer_verified=MAX(smartpay_source_publications.explorer_verified,excluded.explorer_verified),
            verification_updated_at=excluded.verification_updated_at`)
          .bind(createId(), setting.chainId, contractAddress, transactionHash, payload.compilerVersion, publishedSource, payload.sourceCode, sourcify.verificationId || null, explorer.verificationId || null, admin.id, publishedAt, sourcify.message || null, explorer.message || null, explorer.verified ? 1 : 0, publishedAt),
        database().prepare(`INSERT INTO crypto_payment_admin_audit
          (id,admin_user_id,action,setting_id,created_at)
          VALUES (?,?,'publish_smartpay_source',?,?)`)
          .bind(createId(), admin.id, settingId, publishedAt)
      ]);
    }
    const downloads = submitted ? smartPaySourceDownloadUrls(setting.chainId, contractAddress as Address) : null;
    return NextResponse.json({
      submitted,
      publicAndIrreversible: true,
      deploymentMode: factoryDeployment ? "erc2470" : "direct",
      chainId: setting.chainId,
      contractAddress,
      sourcify,
      explorer,
      sourcifySubmitted: sourcify.submitted,
      explorerSubmitted: explorer.submitted,
      explorerVerified: Boolean(explorer.verified),
      sourcifyMessage: sourcify.message,
      explorerMessage: explorer.message,
      sourcifyUrl: `https://repo.sourcify.dev/${setting.chainId}/${contractAddress}`,
      explorerUrl: smartPayExplorerAddressUrl(setting.chainId, contractAddress as Address),
      downloads
    }, {
      status: submitted ? 200 : 502,
      headers: { "cache-control": "private, no-store" }
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.warn("SmartPay source verification failed", serviceMessage(error instanceof Error ? error.message : error));
    return NextResponse.json({ error: "SmartPay was deployed, but public source verification could not be submitted" }, { status: 502 });
  }
}
