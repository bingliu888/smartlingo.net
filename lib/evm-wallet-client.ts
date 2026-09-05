"use client";

import type { CryptoPaymentSetting } from "./crypto-settings";

export type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};

type InjectedEthereumProvider = EthereumProvider & {
  providers?: EthereumProvider[];
  isTokenPocket?: boolean;
  isTP?: boolean;
};

type Eip6963ProviderDetail = {
  info?: { name?: string; rdns?: string };
  provider?: EthereumProvider;
};

export type EthereumTransactionReceipt = {
  status?: string;
  contractAddress?: string;
  to?: string | null;
  transactionHash?: string;
  blockNumber?: string;
  logs?: Array<{ address?: string; topics?: string[]; data?: string }>;
};

export type WalletChain = {
  name: string;
  chainId: number;
  chainIdHex: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

type WalletConnector = {
  connect(config: unknown, market: { chain: WalletChain }): Promise<{ provider: EthereumProvider; address: string }>;
  disconnect?(): Promise<void>;
};

declare global {
  interface Window {
    SmartLingoWalletOnboard?: WalletConnector;
    ethereum?: InjectedEthereumProvider;
    tokenpocket?: { ethereum?: InjectedEthereumProvider };
    web3?: { currentProvider?: EthereumProvider };
  }
}

const chains: Record<number, Omit<WalletChain, "chainId" | "chainIdHex">> = {
  1: { name: "Ethereum", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://eth.llamarpc.com"], blockExplorerUrls: ["https://etherscan.io"] },
  56: { name: "BNB Smart Chain", nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 }, rpcUrls: ["https://bsc-dataseed.binance.org"], blockExplorerUrls: ["https://bscscan.com"] },
  137: { name: "Polygon", nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 }, rpcUrls: ["https://polygon.drpc.org"], blockExplorerUrls: ["https://polygonscan.com"] },
  8453: { name: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"], blockExplorerUrls: ["https://basescan.org"] }
};

export function walletChain(setting: Pick<CryptoPaymentSetting, "chainId" | "chainName">): WalletChain {
  const details = chains[setting.chainId] || { name: setting.chainName, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: [], blockExplorerUrls: [] };
  return { ...details, chainId: setting.chainId, chainIdHex: `0x${setting.chainId.toString(16)}` };
}

async function loadWalletConnector(scriptId: string): Promise<WalletConnector> {
  if (window.SmartLingoWalletOnboard) return window.SmartLingoWalletOnboard;
  await new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("WALLET_CONNECTOR_UNAVAILABLE")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "/wallet-assets/smartlingo-onboard.js";
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("WALLET_CONNECTOR_UNAVAILABLE")), { once: true });
    document.body.appendChild(script);
  });
  if (!window.SmartLingoWalletOnboard) throw new Error("WALLET_CONNECTOR_UNAVAILABLE");
  return window.SmartLingoWalletOnboard;
}

const walletAddress = (value: unknown) => Array.isArray(value)
  ? value.find(account => typeof account === "string" && /^0x[a-fA-F0-9]{40}$/.test(account)) || ""
  : "";

const tokenPocketProvider = (provider: EthereumProvider, label = "") => {
  const flags = provider as InjectedEthereumProvider & { isTokenpocket?: boolean };
  return Boolean(flags.isTokenPocket || flags.isTokenpocket || flags.isTP || /token\s*pocket|tp\s*wallet/i.test(label));
};

async function eip6963Providers() {
  if (typeof window.addEventListener !== "function" || typeof window.dispatchEvent !== "function") return [] as Array<{ provider: EthereumProvider; label: string }>;
  const announced: Array<{ provider: EthereumProvider; label: string }> = [];
  const receive = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
    if (!detail?.provider || typeof detail.provider.request !== "function") return;
    announced.push({ provider: detail.provider, label: `${detail.info?.name || ""} ${detail.info?.rdns || ""}`.trim() });
  };
  window.addEventListener("eip6963:announceProvider", receive);
  try {
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    await new Promise(resolve => setTimeout(resolve, 25));
  } finally {
    window.removeEventListener("eip6963:announceProvider", receive);
  }
  return announced;
}

async function injectedProviders() {
  const candidates: Array<{ provider: EthereumProvider; label: string; priority: number }> = [];
  const seen = new Set<EthereumProvider>();
  const add = (provider: EthereumProvider | undefined, label: string, priority = 0) => {
    if (!provider || typeof provider.request !== "function" || seen.has(provider)) return;
    seen.add(provider);
    candidates.push({ provider, label, priority: priority + (tokenPocketProvider(provider, label) ? 100 : 0) });
  };
  add(window.tokenpocket?.ethereum, "TokenPocket namespace", 50);
  for (const detail of await eip6963Providers()) add(detail.provider, detail.label, 25);
  for (const provider of window.ethereum?.providers || []) add(provider, "Injected provider", 10);
  add(window.ethereum, "window.ethereum", 5);
  add(window.web3?.currentProvider, "window.web3", 0);
  return candidates.sort((left, right) => right.priority - left.priority);
}

export async function authorizedInjectedEvmWallet() {
  const candidates = await injectedProviders();
  for (const candidate of candidates) {
    const address = walletAddress(await candidate.provider.request({ method: "eth_accounts" }).catch(() => []));
    if (address) return { provider: candidate.provider, address };
  }
  return null;
}

async function selectInjectedChain(provider: EthereumProvider, chain: WalletChain) {
  const current = await provider.request({ method: "eth_chainId" }).catch(() => null);
  if (typeof current === "string" && Number.parseInt(current, 16) === chain.chainId) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.chainIdHex }] });
  } catch (error) {
    const code = Number((error as { code?: unknown })?.code);
    if (code !== 4902 || !chain.rpcUrls.length) throw new Error("WRONG_CHAIN");
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: chain.chainIdHex,
        chainName: chain.name,
        nativeCurrency: chain.nativeCurrency,
        rpcUrls: chain.rpcUrls,
        blockExplorerUrls: chain.blockExplorerUrls
      }]
    }).catch(() => { throw new Error("WRONG_CHAIN"); });
  }
}

export async function connectInjectedEvmWallet(chain: WalletChain) {
  const candidates = await injectedProviders();
  if (!candidates.length) return null;
  const authorized = await authorizedInjectedEvmWallet();
  if (authorized) {
    await selectInjectedChain(authorized.provider, chain);
    return authorized;
  }
  const provider = candidates[0].provider;
  const address = walletAddress(await provider.request({ method: "eth_requestAccounts" }));
  if (!address) throw new Error("INVALID_WALLET");
  await selectInjectedChain(provider, chain);
  return { provider, address };
}

export async function connectEvmWallet(input: {
  setting: Pick<CryptoPaymentSetting, "chainId" | "chainName">;
  projectId: string;
  appName: string;
  description: string;
  scriptId?: string;
}) {
  const chain = walletChain(input.setting);
  const injected = await connectInjectedEvmWallet(chain);
  if (injected) return injected;
  const onboard = await loadWalletConnector(input.scriptId || "shared-evm-wallet-connector");
  const result = await onboard.connect({
    walletMethods: { walletconnect: { enabled: true, projectId: input.projectId, version: 2, requiredChains: [input.setting.chainId], dappUrl: window.location.origin } },
    walletConnectApp: { appName: input.appName, description: input.description, icon: "<svg></svg>", logo: "<svg></svg>" }
  }, { chain });
  if (!/^0x[a-fA-F0-9]{40}$/.test(result.address)) throw new Error("INVALID_WALLET");
  return result;
}

export async function assertProviderChain(provider: EthereumProvider, expectedChainId: number) {
  const chainId = await provider.request({ method: "eth_chainId" });
  if (typeof chainId !== "string" || Number.parseInt(chainId, 16) !== expectedChainId) throw new Error("WRONG_CHAIN");
}

export async function waitForTransactionReceipt(provider: EthereumProvider, hash: string): Promise<EthereumTransactionReceipt> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const receipt = await provider.request({ method: "eth_getTransactionReceipt", params: [hash] }) as EthereumTransactionReceipt | null;
    if (receipt) {
      if (receipt.status && receipt.status !== "0x1") throw new Error("TRANSACTION_REVERTED");
      return receipt;
    }
    await new Promise(resolve => window.setTimeout(resolve, 1500));
  }
  throw new Error("TRANSACTION_TIMEOUT");
}
