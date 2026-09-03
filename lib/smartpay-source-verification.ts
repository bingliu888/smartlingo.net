import { encodeAbiParameters, isAddress, type Address, type Hex } from "viem";
import {
  readBoundedExternalResponseText,
  SOURCE_VERIFICATION_REQUEST_TIMEOUT_MS,
  withExternalRequestTimeout,
} from "./external-request-timeout.ts";

type StandardJsonInput = {
  language: "Solidity";
  sources: Record<string, { content: string }>;
  settings: Record<string, unknown>;
};

export type SmartPay5VerificationArtifact = {
  contractName: "SmartPay5";
  sourceName: string;
  compiler: string;
  evmVersion: string;
  standardJsonInput: StandardJsonInput;
};

export function smartPayCompilerVersion(value: string) {
  const match = /^(\d+\.\d+\.\d+\+commit\.[0-9a-f]+)/i.exec(value.trim());
  if (!match) throw new Error("INVALID_SMARTPAY5_COMPILER_VERSION");
  return match[1];
}

export function smartPay5SourceVerificationPayload(
  artifact: SmartPay5VerificationArtifact,
  initialOwner: Address,
  creationTransactionHash?: Hex
) {
  const source = artifact.standardJsonInput?.sources?.[artifact.sourceName]?.content;
  if (artifact.contractName !== "SmartPay5" || artifact.sourceName !== "contracts/SmartPay5.sol"
    || artifact.standardJsonInput?.language !== "Solidity" || !source?.includes("contract SmartPay5")
    || !Object.keys(artifact.standardJsonInput.sources || {}).some(name => name.startsWith("@openzeppelin/contracts/"))
    || !isAddress(initialOwner)
    || (creationTransactionHash != null && !/^0x[0-9a-f]{64}$/i.test(creationTransactionHash))) {
    throw new Error("INVALID_SMARTPAY5_VERIFICATION_ARTIFACT");
  }
  const compilerVersion = smartPayCompilerVersion(artifact.compiler);
  const contractIdentifier = `${artifact.sourceName}:${artifact.contractName}`;
  const constructorArguments = encodeAbiParameters([{ type: "address" }], [initialOwner]).slice(2);
  const sourceCode = JSON.stringify(artifact.standardJsonInput);
  return {
    compilerVersion,
    contractIdentifier,
    constructorArguments,
    sourceCode,
    sourcify: {
      stdJsonInput: artifact.standardJsonInput,
      compilerVersion,
      contractIdentifier,
      ...(creationTransactionHash ? { creationTransactionHash } : {})
    },
    etherscan: {
      sourceCode,
      codeformat: "solidity-standard-json-input",
      contractname: contractIdentifier,
      compilerversion: `v${compilerVersion}`,
      optimizationUsed: "1",
      runs: "500",
      constructorArguments,
      evmVersion: artifact.evmVersion,
      licenseType: "3"
    }
  };
}

export function smartPayExplorerAddressUrl(chainId: number, contract: Address) {
  const base = ({
    1: "https://etherscan.io/address/",
    56: "https://bscscan.com/address/",
    137: "https://polygonscan.com/address/",
    8453: "https://basescan.org/address/"
  } as Record<number, string>)[chainId];
  return base ? `${base}${contract}#code` : "";
}

export function smartPayExplorerPageIsVerified(html: string) {
  return /(?:contract\s+)?source\s+code\s+verified/i.test(html);
}

export async function smartPayExplorerVerificationStatus(chainId: number, contract: Address) {
  const explorerUrl = smartPayExplorerAddressUrl(chainId, contract);
  if (!explorerUrl) return { verified: false, message: "Explorer is not configured for this chain" };
  try {
    const response = await withExternalRequestTimeout((signal) => fetch(explorerUrl, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "SmartLingo SmartPay5 source verification status"
      },
      cache: "no-store",
      signal,
    }), SOURCE_VERIFICATION_REQUEST_TIMEOUT_MS);
    if (!response.ok) return { verified: false, message: `Explorer HTTP ${response.status}` };
    const body = await readBoundedExternalResponseText(response, 2 * 1024 * 1024);
    if (body.truncated) return { verified: false, message: "Explorer response exceeded the verification limit" };
    const verified = smartPayExplorerPageIsVerified(body.text);
    return {
      verified,
      message: verified ? "Source Code Verified on explorer" : "Explorer source verification is not yet visible"
    };
  } catch {
    return { verified: false, message: "Explorer source verification status is temporarily unavailable" };
  }
}

export function smartPaySourceDownloadUrls(chainId: number, contract: Address) {
  const query = `chainId=${chainId}&address=${encodeURIComponent(contract)}`;
  return {
    source: `/api/contracts/smartpay5?${query}&file=source`,
    standardJsonInput: `/api/contracts/smartpay5?${query}&file=standard-json`
  };
}
