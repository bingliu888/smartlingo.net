import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { database } from "../../../../lib/db";
import {
  readBoundedExternalResponseText,
  SOURCE_VERIFICATION_REQUEST_TIMEOUT_MS,
  withExternalRequestTimeout,
} from "../../../../lib/external-request-timeout";
import {
  smartPayExplorerAddressUrl,
  smartPayExplorerVerificationStatus,
  smartPaySourceDownloadUrls
} from "../../../../lib/smartpay-source-verification";

export const dynamic = "force-dynamic";

async function sourcifyMatch(chainId: number, contractAddress: string) {
  try {
    const response = await withExternalRequestTimeout((signal) => fetch(`https://sourcify.dev/server/v2/contract/${chainId}/${contractAddress}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal,
    }), SOURCE_VERIFICATION_REQUEST_TIMEOUT_MS);
    if (!response.ok) return "";
    const raw = await readBoundedExternalResponseText(response, 256 * 1024);
    if (raw.truncated) return "";
    let data: { match?: string; runtimeMatch?: string | null; creationMatch?: string | null } = {};
    try { data = JSON.parse(raw.text) as typeof data; } catch { /* invalid upstream JSON */ }
    return String(data.match || data.runtimeMatch || data.creationMatch || "");
  } catch {
    return "";
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = Number(url.searchParams.get("chainId"));
  const contractAddress = String(url.searchParams.get("address") || "").trim().toLowerCase();
  const file = url.searchParams.get("file");
  if (!Number.isInteger(chainId) || chainId <= 0 || !isAddress(contractAddress)
    || !["source", "standard-json", "status"].includes(String(file))) {
    return NextResponse.json({ error: "Select a published SmartPay3 source file" }, { status: 400 });
  }
  const publication = await database().prepare(`SELECT published_at AS publishedAt,
      source_code AS sourceCode,standard_json_input AS standardJsonInput,
      sourcify_verification_id AS sourcifyVerificationId,
      explorer_verification_id AS explorerVerificationId,
      sourcify_message AS sourcifyMessage,
      explorer_message AS explorerMessage,
      explorer_verified AS explorerVerified
    FROM smartpay_source_publications
    WHERE chain_id=? AND lower(contract_address)=lower(?)`)
    .bind(chainId, contractAddress).first<{ publishedAt: number; sourceCode: string; standardJsonInput: string; sourcifyVerificationId: string | null; explorerVerificationId: string | null; sourcifyMessage: string | null; explorerMessage: string | null; explorerVerified: number }>();
  if (file === "status") {
    const downloads = publication ? smartPaySourceDownloadUrls(chainId, contractAddress as Address) : null;
    const match = publication ? await sourcifyMatch(chainId, contractAddress) : "";
    const explorerStatus = publication && !publication.explorerVerified
      ? await smartPayExplorerVerificationStatus(chainId, contractAddress as Address)
      : { verified: Boolean(publication?.explorerVerified), message: publication?.explorerMessage || "" };
    return NextResponse.json({
      published: Boolean(publication),
      downloads,
      explorerUrl: publication ? smartPayExplorerAddressUrl(chainId, contractAddress as Address) : "",
      sourcifyUrl: publication ? `https://repo.sourcify.dev/${chainId}/${contractAddress}` : "",
      sourcifyMatch: match,
      sourcifySubmitted: Boolean(publication?.sourcifyVerificationId || match),
      explorerSubmitted: Boolean(publication?.explorerVerificationId || explorerStatus.verified),
      explorerVerified: explorerStatus.verified,
      sourcifyMessage: publication?.sourcifyMessage || "",
      explorerMessage: explorerStatus.verified ? explorerStatus.message : (publication?.explorerMessage || explorerStatus.message)
    }, { headers: { "cache-control": "private, no-store" } });
  }
  if (!publication) return NextResponse.json({ error: "SmartPay3 source is not public for this contract" }, { status: 404 });
  if (!publication.sourceCode || !publication.standardJsonInput) {
    return NextResponse.json({ error: "SmartPay3 source artifact is unavailable" }, { status: 503 });
  }
  const isSource = file === "source";
  const body = isSource ? `${publication.sourceCode.trimEnd()}\n` : `${publication.standardJsonInput.trimEnd()}\n`;
  const extension = isSource ? "sol" : "standard-input.json";
  return new Response(body, {
    headers: {
      "content-type": isSource ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="SmartPay3-${chainId}-${contractAddress}.${extension}"`,
      "cache-control": "public, max-age=300, s-maxage=31536000, immutable",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
      "last-modified": new Date(publication.publishedAt * 1000).toUTCString()
    }
  });
}
