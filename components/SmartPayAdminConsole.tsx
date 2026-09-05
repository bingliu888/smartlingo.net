"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, isAddress, type Address } from "viem";
import type { CryptoPaymentSetting } from "../lib/crypto-settings";
import { smartPayWithdrawalPreflight } from "../lib/crypto-amount";
import {
  assertProviderChain,
  authorizedInjectedEvmWallet,
  connectEvmWallet,
  waitForTransactionReceipt,
  type EthereumProvider
} from "../lib/evm-wallet-client";
import type { SiteLanguage } from "../lib/site-locale";
import { smartPayOwnerActionFeedback, smartPayOwnerConnectionError, smartPayOwnerWalletButton } from "../lib/smartpay-admin-wallet-ui";
import { smartPayChainLabel, smartPayChainOptions, smartPayChainSettings } from "../lib/smartpay-chain-options";
import {
  requestSmartPay5Deployment,
  smartPay5AddressFromReceipt,
  smartPay5DeploymentData,
  type SmartPay5DeploymentArtifact
} from "../lib/smartpay-deployment";
import { SMARTLINGO_WALLET_CONNECT } from "../lib/smartlingo-commerce-wallet";
import { SMARTPAY5_ABI } from "../lib/smartpay5";
import { smartPay5SettingsForContract } from "../lib/smartpay-checkout";
import { smartPay5ConfirmationControl } from "../lib/smartpay5-confirmation-control";
import { smartPayTransactionNeedsReconciliation } from "../lib/smartpay-reconciliation";
import {
  smartPay5RulePresets,
  smartPay5RulePresetStatus,
  type SmartPay5RulePreset
} from "../lib/smartpay5-presets";

type PayoutRow = { wallet: string; percent: string };
type TokenState = { symbol: string; decimals: number; balanceAtomic: string | null; balance: string | null };
type SmartPay5PaymentRule = {
  primaryTokenAddress: string;
  secondaryTokenAddress: string;
  mainId: string;
  secondId: string;
  primaryTokenAmount: string;
  primaryTokenAmountDisplay: string;
  primaryTokenSymbol: string;
  primaryTokenDecimals: number;
  secondaryTokenAmount: string;
  secondaryTokenAmountDisplay: string;
  secondaryTokenSymbol: string;
  secondaryTokenDecimals: number;
  minimumSecondaryBalance: string;
  minimumSecondaryBalanceDisplay: string;
  enabled: boolean;
};
type TransactionRecord = {
  transactionId: string;
  timestamp: number;
  wallet: string;
  payerId: string;
  refId: string;
  mainId: string;
  secondId: string;
  primaryTokenAddress?: string;
  primaryTokenAmount?: string;
  secondaryTokenAddress?: string;
  secondaryTokenAmount?: string;
  claimStatus?: string | null;
  claimedMemberId?: string | null;
  subscriptionRecorded?: boolean;
  subscriptionEndsAt?: number | null;
  siteOwned?: boolean;
};
type MatchedMember = { id: string; email: string; displayName: string; payerId: string };
type ContractState = {
  contract: string;
  owner: string;
  paused: boolean;
  payouts: Array<{ wallet: string; shareBps: number }>;
  rules: SmartPay5PaymentRule[];
  tokens: Record<string, TokenState>;
  totalTransactions: number;
  latestTransactions: TransactionRecord[];
};
type LookupResponse = {
  transactions?: TransactionRecord[];
  totalTransactions?: number;
  matchedMembers?: MatchedMember[];
  error?: string;
};
type SourceVerificationResponse = {
  published?: boolean;
  submitted?: boolean;
  sourcifyUrl?: string;
  explorerUrl?: string;
  sourcifyMatch?: string;
  sourcifySubmitted?: boolean;
  explorerSubmitted?: boolean;
  explorerVerified?: boolean;
  sourcifyMessage?: string;
  explorerMessage?: string;
  downloads?: { source?: string; standardJsonInput?: string } | null;
  error?: string;
};

const toBps = (value: string) => /^\d+(?:\.\d{1,2})?$/.test(value.trim()) ? Math.round(Number(value) * 100) : Number.NaN;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const shortAddress = (value: string) => value ? `${value.slice(0, 8)}…${value.slice(-6)}` : "—";
const hasSecondaryTransaction = (record: TransactionRecord) => Boolean(record.secondaryTokenAddress
  && record.secondaryTokenAddress.toLowerCase() !== ZERO_ADDRESS
  && BigInt(record.secondaryTokenAmount || "0") > 0n);
const subscriptionEndLabel = (value: number | null | undefined, locale: SiteLanguage) => value
  ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "America/Los_Angeles" }).format(new Date(value * 1000))
  : "";

export function SmartPayAdminConsole({
  initialSettings,
  locale,
  defaultWallet
}: {
  initialSettings: CryptoPaymentSetting[];
  locale: SiteLanguage;
  defaultWallet: string;
}) {
  const zh = locale === "zh";
  const initialChainSettings = smartPayChainSettings(initialSettings);
  const [settings, setSettings] = useState(initialSettings);
  const [settingId, setSettingId] = useState(initialChainSettings[0]?.id || "");
  const chainOptions = useMemo(() => smartPayChainOptions(settings), [settings]);
  const selected = settings.find(item => item.id === settingId) || settings[0];
  const [contractAddress, setContractAddress] = useState(selected?.smartPay5Contract || "");
  const [smartPay5UsdtPercent, setSmartPay5UsdtPercent] = useState(String(selected?.smartPay5UsdtPercent ?? 50));
  const [contractState, setContractState] = useState<ContractState | null>(null);
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [connectedWallet, setConnectedWallet] = useState("");
  const [ownerWallet, setOwnerWallet] = useState(defaultWallet);
  const [newOwner, setNewOwner] = useState("");
  const [payouts, setPayouts] = useState<PayoutRow[]>(() => Array.from({ length: 5 }, (_, index) => ({ wallet: index === 0 ? defaultWallet : "", percent: "" })));
  const [withdrawToken, setWithdrawToken] = useState(selected?.tokenContract || "");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawTokenState, setWithdrawTokenState] = useState<TokenState | null>(null);
  const [queryPayerId, setQueryPayerId] = useState("");
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [matchedMembers, setMatchedMembers] = useState<MatchedMember[]>([]);
  const [publishSource, setPublishSource] = useState(true);
  const [verificationLinks, setVerificationLinks] = useState<{ sourcifyUrl?: string; explorerUrl?: string; source?: string; standardJsonInput?: string; sourcifyMatch?: string; sourcifySubmitted?: boolean; explorerSubmitted?: boolean; explorerVerified?: boolean; sourcifyMessage?: string; explorerMessage?: string } | null>(null);
  const [publicationRevision, setPublicationRevision] = useState(0);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [enabledPresetKeys, setEnabledPresetKeys] = useState<Set<string>>(() => new Set());
  const [knownPresetKeys, setKnownPresetKeys] = useState<Set<string>>(() => new Set());
  const [stalePresetKeys, setStalePresetKeys] = useState<Set<string>>(() => new Set());
  const [confirmationStateChainId, setConfirmationStateChainId] = useState<number | null>(null);

  const lastPayoutIndex = payouts.reduce((last, row, index) => row.wallet.trim() ? index : last, -1);
  const activePayouts = lastPayoutIndex >= 0 ? payouts.slice(0, lastPayoutIndex + 1) : [];
  const explicitBps = activePayouts.slice(0, -1).map(row => toBps(row.percent));
  const remainingBps = 10_000 - explicitBps.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
  const selectedContract = selected?.smartPay5Contract || "";
  const contractName = "SmartPay5";
  const contractAbi = SMARTPAY5_ABI;
  const contractConfigured = Boolean(selectedContract && isAddress(selectedContract));
  const transactionReadReady = Boolean(contractState);
  const ownerWalletButton = smartPayOwnerWalletButton(locale, busy, connectedWallet);
  const selectedChainId = selected?.chainId;
  const confirmationStateReady = Boolean(selectedChainId && confirmationStateChainId === selectedChainId);
  const smartPay5Rules = useMemo(() => contractState?.rules || [], [contractState?.rules]);
  const smartPay5PresetSettings = useMemo(
    () => smartPay5SettingsForContract(settings, selectedChainId, selectedContract),
    [settings, selectedChainId, selectedContract],
  );
  const smartPay5Presets = useMemo(
    () => smartPay5RulePresets(smartPay5PresetSettings, selectedChainId),
    [smartPay5PresetSettings, selectedChainId],
  );
  const smartPay5PresetRows = useMemo(() => smartPay5Presets.map(preset => ({
    preset,
    status: smartPay5RulePresetStatus(preset, smartPay5Rules)
  })), [smartPay5Presets, smartPay5Rules]);
  const withdrawTokenOptions = useMemo(() => Object.entries(contractState?.tokens || {}), [contractState?.tokens]);
  const withdrawalPreflight = useMemo(() => withdrawTokenState && withdrawAmount
    ? smartPayWithdrawalPreflight(withdrawAmount, withdrawTokenState.decimals, withdrawTokenState.balanceAtomic)
    : null, [withdrawAmount, withdrawTokenState]);
  const payoutShares = activePayouts.length ? [...explicitBps, 0] : [];
  const payoutsMatchChain = Boolean(contractState && activePayouts.length === contractState.payouts.length
    && activePayouts.every((row, index) => isAddress(row.wallet)
      && row.wallet.toLowerCase() === contractState.payouts[index]?.wallet.toLowerCase()
      && Number.isInteger(payoutShares[index])
      && payoutShares[index] === contractState.payouts[index]?.shareBps));
  const applyContractState = useCallback((value: ContractState) => {
    setContractState(value);
    setPayouts(Array.from({ length: 5 }, (_, index) => {
      const row = value.payouts[index];
      if (!row) return { wallet: index === 0 && value.payouts.length === 0 ? defaultWallet : "", percent: "" };
      return { wallet: row.wallet, percent: index === value.payouts.length - 1 ? "" : (row.shareBps / 100).toFixed(2).replace(/\.00$/, "") };
    }));
    setOwnerWallet(value.owner);
    const currentToken = withdrawToken.toLowerCase();
    const nextToken = value.tokens[currentToken] ? currentToken : Object.keys(value.tokens)[0] || "";
    setWithdrawToken(nextToken);
    setWithdrawTokenState(nextToken ? value.tokens[nextToken] : null);
  }, [defaultWallet, withdrawToken]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedChainId) return () => { cancelled = true; };
    void fetch(`/api/admin/crypto-payments/rules?chainId=${selectedChainId}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("READ_FAILED")))
      .then((data: { enabledPresetKeys?: string[]; knownPresetKeys?: string[]; stalePresetKeys?: string[] }) => {
        if (cancelled) return;
        setEnabledPresetKeys(new Set(data.enabledPresetKeys || [])); setKnownPresetKeys(new Set(data.knownPresetKeys || [])); setStalePresetKeys(new Set(data.stalePresetKeys || [])); setConfirmationStateChainId(selectedChainId);
      }).catch(() => {
        if (cancelled) return;
        setEnabledPresetKeys(new Set()); setKnownPresetKeys(new Set()); setStalePresetKeys(new Set());
        setMessage(zh ? "无法读取付款项目确认状态；Stop 与确认操作已暂时锁定。" : "Payment-item confirmation state is unavailable; Stop and confirmation actions are temporarily locked.");
      });
    return () => { cancelled = true; };
  }, [selectedChainId, zh]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedChainId || !isAddress(selectedContract)) return () => { cancelled = true; };
    const query = new URLSearchParams({ chainId: String(selectedChainId), address: selectedContract, file: "status" });
    void fetch(`/api/contracts/smartpay5?${query}`, { cache: "no-store" })
      .then(response => response.json())
      .then((result: SourceVerificationResponse) => {
        if (cancelled) return;
        setVerificationLinks(result.published ? {
          sourcifyUrl: result.sourcifyUrl,
          explorerUrl: result.explorerUrl,
          sourcifyMatch: result.sourcifyMatch,
          sourcifySubmitted: result.sourcifySubmitted,
          explorerSubmitted: result.explorerSubmitted,
          explorerVerified: result.explorerVerified,
          sourcifyMessage: result.sourcifyMessage,
          explorerMessage: result.explorerMessage,
          source: result.downloads?.source,
          standardJsonInput: result.downloads?.standardJsonInput
        } : null);
      })
      .catch(() => { if (!cancelled) setVerificationLinks(null); });
    return () => { cancelled = true; };
  }, [publicationRevision, selectedChainId, selectedContract]);

  useEffect(() => {
    let cancelled = false;
    if (!selected?.id || !isAddress(selectedContract)) return () => { cancelled = true; };
    void fetch(`/api/admin/crypto-payments/state?settingId=${encodeURIComponent(selected.id)}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("READ_FAILED")))
      .then((data: ContractState) => { if (!cancelled) applyContractState(data); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [applyContractState, selected?.id, selectedContract]);

  useEffect(() => {
    let active = true;
    let detectedProvider: EthereumProvider | null = null;
    let accountListener: ((...args: unknown[]) => void) | null = null;
    void authorizedInjectedEvmWallet().then(result => {
      if (!active || !result) return;
      detectedProvider = result.provider;
      setProvider(result.provider);
      setConnectedWallet(result.address);
      setOwnerWallet(current => current || result.address);
      accountListener = (accounts: unknown) => {
        const address = Array.isArray(accounts)
          ? accounts.find(account => typeof account === "string" && /^0x[a-fA-F0-9]{40}$/.test(account))
          : "";
        setConnectedWallet(typeof address === "string" ? address : "");
        if (!address) setProvider(null);
      };
      result.provider.on?.("accountsChanged", accountListener);
    }).catch(() => undefined);
    return () => {
      active = false;
      if (detectedProvider && accountListener) detectedProvider.removeListener?.("accountsChanged", accountListener);
    };
  }, [selectedChainId]);

  function selectSetting(nextId: string) {
    const next = settings.find(item => item.id === nextId) || settings[0];
    setSettingId(next?.id || "");
    setContractAddress(next?.smartPay5Contract || "");
    setSmartPay5UsdtPercent(String(next?.smartPay5UsdtPercent ?? 50));
    setWithdrawToken("");
    setWithdrawTokenState(null);
    setContractState(null);
    setProvider(null);
    setConnectedWallet("");
    setTransactions([]);
    setMatchedMembers([]);
    setVerificationLinks(null);
    setEnabledPresetKeys(new Set()); setKnownPresetKeys(new Set()); setStalePresetKeys(new Set()); setConfirmationStateChainId(null);
    setMessage("");
  }

  async function refreshContractState(force = false, silent = false) {
    if (!selected || (!force && !selectedContract && !isAddress(contractAddress))) return;
    if (!silent) {
      setBusy("refresh-contract");
      setMessage("");
    }
    try {
      const response = await fetch(`/api/admin/crypto-payments/state?settingId=${encodeURIComponent(selected.id)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({})) as ContractState & { error?: string };
      if (!response.ok) throw new Error(data.error || "READ_FAILED");
      applyContractState(data);
      if (!silent) setMessage(zh ? `已从链上刷新 ${contractName} 状态。` : `${contractName} state refreshed from chain.`);
    } catch (error) {
      if (!silent) setMessage(error instanceof Error ? error.message : (zh ? "无法读取合约。" : "Unable to read the contract."));
    } finally {
      if (!silent) setBusy("");
    }
  }

  async function verifyAndSaveContractAddress(nextAddress: string) {
    if (!selected || !isAddress(nextAddress)) throw new Error("INVALID_CONTRACT_ADDRESS");
    const response = await fetch("/api/admin/crypto-payments/contract", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settingId: selected.id, contractAddress: nextAddress })
    });
    const data = await response.json().catch(() => ({})) as { contractAddress?: string; error?: string };
    if (!response.ok || !data.contractAddress) throw new Error(data.error || "SAVE_FAILED");
    setSettings(current => current.map(item => item.chainId === selected.chainId
      ? { ...item, smartPay5Contract: data.contractAddress || null }
      : item));
    setContractAddress(data.contractAddress);
    return data.contractAddress;
  }

  async function saveSmartPay5Percentage() {
    if (!selected) return;
    const percent = Number(smartPay5UsdtPercent);
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      setMessage(zh ? "USDT 比例必须是 0–100 的整数。" : "USDT percentage must be an integer from 0 to 100.");
      return;
    }
    setBusy("save-smartpay5-percent");
    try {
      const response = await fetch("/api/admin/crypto-payments/contract", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settingId: selected.id, usdtPercent: percent })
      });
      const data = await response.json().catch(() => ({})) as { updated?: boolean; error?: string };
      if (!response.ok || !data.updated) throw new Error(data.error || "SAVE_FAILED");
      setSettings(current => current.map(item => ({ ...item, smartPay5UsdtPercent: percent })));
      setMessage(zh
        ? `SmartPay5 比例已保存：${percent}% USDT + ${100 - percent}% GLC；无需 Owner 或链上确认。`
        : `SmartPay5 ratio saved: ${percent}% USDT + ${100 - percent}% GLC. No Owner or on-chain confirmation is required.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (zh ? "无法保存 SmartPay5 比例。" : "Unable to save the SmartPay5 ratio."));
    } finally {
      setBusy("");
    }
  }

  async function saveContractAddress() {
    if (!isAddress(contractAddress)) {
      setMessage(zh ? `请输入有效的 ${contractName} 合约地址。` : `Enter a valid ${contractName} contract address.`);
      return;
    }
    setBusy("save-contract");
    setMessage(zh ? `正在验证此网络上的 ${contractName} 代码与固定 mainID…` : `Verifying ${contractName} code and fixed mainIDs on this network…`);
    try {
      await verifyAndSaveContractAddress(contractAddress);
      await refreshContractState(true);
      setMessage(zh ? "合约地址已验证并保存。" : "Contract address verified and saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (zh ? "无法保存合约地址。" : "Unable to save the contract address."));
    } finally {
      setBusy("");
    }
  }

  async function connectWallet() {
    if (!selected) return null;
    setBusy("connect");
    setMessage("");
    try {
      const result = await connectEvmWallet({
        setting: selected,
        projectId: SMARTLINGO_WALLET_CONNECT.projectId,
        appName: SMARTLINGO_WALLET_CONNECT.admin.appName,
        description: SMARTLINGO_WALLET_CONNECT.admin.description,
        scriptId: SMARTLINGO_WALLET_CONNECT.scriptId
      });
      setProvider(result.provider);
      setConnectedWallet(result.address);
      setOwnerWallet(result.address);
      await assertProviderChain(result.provider, selected.chainId);
      setMessage(contractState?.owner.toLowerCase() === result.address.toLowerCase()
        ? (zh ? "Owner 钱包已连接。" : "Owner wallet connected.")
        : (zh ? "钱包已连接；链上写入前会再次核对 Owner。" : "Wallet connected. Owner will be checked again before every write."));
      return result;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setMessage(reason === "WRONG_CHAIN"
        ? (zh ? "钱包网络与所选付款通道不一致。" : "The wallet network does not match the selected rail.")
        : (zh ? "无法连接 TP 或其他 EVM 钱包。" : "Could not connect TP or another EVM wallet."));
      return null;
    } finally {
      setBusy("");
    }
  }

  async function deploySelectedContract(redeploy = false) {
    if (!selected || (contractConfigured && !redeploy)) return;
    if (redeploy && !window.confirm(zh
      ? `重新部署会创建一个全新的空 ${contractName} 合约，并在验证成功后替换本站当前地址。旧合约和历史链上记录不会删除；新合约需要重新写入 W1–W5 和付款项目。是否继续？`
      : `Redeploy creates a new empty ${contractName} contract and replaces this site's current address only after verification succeeds. The old contract and its history remain on-chain; W1-W5 and payment items must be configured again. Continue?`)) return;
    const active = provider && connectedWallet ? { provider, address: connectedWallet } : await connectWallet();
    if (!active) return;
    setBusy("deploy-contract");
    try {
      await assertProviderChain(active.provider, selected.chainId);
      if (isAddress(ownerWallet) && ownerWallet.toLowerCase() !== active.address.toLowerCase()) {
        throw new Error("OWNER_FIELD_MISMATCH");
      }
      const initialOwner = active.address as Address;
      setOwnerWallet(initialOwner);
      const artifactResponse = await fetch("/api/admin/smartpay/bundle", { cache: "no-store" });
      const artifact = await artifactResponse.json().catch(() => ({})) as SmartPay5DeploymentArtifact & { error?: string };
      if (!artifactResponse.ok) throw new Error(artifact.error || "DEPLOYMENT_ARTIFACT_UNAVAILABLE");
      const data = smartPay5DeploymentData(artifact, initialOwner, SMARTPAY5_ABI);
      setMessage(zh ? `正在预估部署 Gas；随后请在钱包确认 ${contractName} 部署。` : `Estimating deployment gas; then confirm the ${contractName} deployment in your wallet.`);
      const deployment = await requestSmartPay5Deployment(active.provider, initialOwner, data, {
        chainId: selected.chainId,
        siteScope: "smartlingo.net",
        deploymentId: crypto.randomUUID()
      });
      const { hash } = deployment;
      setMessage(zh ? "部署交易已发送，正在等待链上确认…" : "Deployment submitted. Waiting for on-chain confirmation…");
      const receipt = await waitForTransactionReceipt(active.provider, hash);
      const deployedAddress = smartPay5AddressFromReceipt(receipt, deployment.contractAddress);
      setMessage(zh ? "合约已部署，正在验证并保存地址…" : "Contract deployed. Verifying and saving its address…");
      await verifyAndSaveContractAddress(deployedAddress);
      await refreshContractState(true);
      if (publishSource) {
        setMessage(zh ? "合约已保存，正在公开提交 Solidity 源码验证…" : "Contract saved. Submitting its Solidity source for public verification…");
        const sourceResponse = await fetch("/api/admin/smartpay/bundle", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            settingId: selected.id,
            contractAddress: deployedAddress,
            transactionHash: hash,
            deploymentSalt: deployment.salt,
            confirmPublicSource: true
          })
        });
        const sourceResult = await sourceResponse.json().catch(() => ({})) as SourceVerificationResponse;
        const sourceSubmitted = sourceResponse.ok && sourceResult.submitted;
        setVerificationLinks(sourceSubmitted ? {
          sourcifyUrl: sourceResult.sourcifyUrl,
          explorerUrl: sourceResult.explorerUrl,
          sourcifyMatch: sourceResult.sourcifyMatch,
          sourcifySubmitted: sourceResult.sourcifySubmitted,
          explorerSubmitted: sourceResult.explorerSubmitted,
          explorerVerified: sourceResult.explorerVerified,
          sourcifyMessage: sourceResult.sourcifyMessage,
          explorerMessage: sourceResult.explorerMessage,
          source: sourceResult.downloads?.source,
          standardJsonInput: sourceResult.downloads?.standardJsonInput
        } : null);
        if (sourceSubmitted) setPublicationRevision(current => current + 1);
        setMessage(sourceSubmitted
          ? sourceResult.explorerVerified
            ? (zh ? `${contractName} 已部署并保存；Sourcify 与 PolygonScan 源码验证均已完成：` + shortAddress(deployedAddress) : `${contractName} deployed and saved; Sourcify and PolygonScan source verification are complete: ` + shortAddress(deployedAddress))
            : /ETHERSCAN_API_KEY is not configured/i.test(sourceResult.explorerMessage || "")
              ? (zh ? `${contractName} 已部署并由 Sourcify 精确验证；PolygonScan 需先在生产环境配置 ETHERSCAN_API_KEY，之后可在本页重试：` + shortAddress(deployedAddress) : `${contractName} deployed with an exact Sourcify match. Configure ETHERSCAN_API_KEY in the production Worker, then retry PolygonScan from this page: ` + shortAddress(deployedAddress))
              : (zh ? `${contractName} 已部署并保存；源码已提交，PolygonScan 仍在处理：` + shortAddress(deployedAddress) : `${contractName} deployed and saved; source was submitted and PolygonScan is still processing it: ` + shortAddress(deployedAddress))
          : (zh ? `${contractName} 已部署并保存，但公开源码验证尚未完成；可稍后在区块浏览器验证：` + shortAddress(deployedAddress) : `${contractName} deployed and saved, but public source verification did not complete. It can be verified in the explorer later: ` + shortAddress(deployedAddress)));
      } else {
        setMessage(zh ? `${contractName} 已部署、验证并保存；未公开 Solidity 源码：` + shortAddress(deployedAddress) : `${contractName} deployed, verified, and saved without publishing Solidity source: ` + shortAddress(deployedAddress));
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setMessage(reason === "WRONG_CHAIN"
        ? (zh ? "钱包网络与所选部署网络不一致。" : "The wallet network does not match the selected deployment network.")
        : reason === "OWNER_FIELD_MISMATCH"
          ? (zh ? "为避免永久指定错误 Owner，Owner 编辑框必须与已连接钱包一致。" : "To avoid assigning the wrong Owner permanently, the Owner field must match the connected wallet.")
          : reason === "DEPLOYMENT_GAS_ESTIMATE_FAILED" || reason === "DEPLOYMENT_GAS_ESTIMATE_INVALID"
            ? (zh ? "无法取得有效的部署 Gas 预估；请确认钱包已在所选网络并稍后重试。交易尚未发送。" : "A valid deployment gas estimate could not be obtained. Confirm the selected wallet network and retry later. No transaction was sent.")
          : reason === "DEPLOYMENT_FACTORY_UNAVAILABLE"
            ? (zh ? "所选网络未返回已验证的标准部署工厂代码；为保护 Owner 与部署资金，交易尚未发送。" : "The selected network did not return the verified standard deployment factory code. No transaction was sent, protecting the Owner and deployment funds.")
          : (zh ? `${contractName} 未完成部署；钱包拒绝、Gas 不足或网络异常时不会保存地址。` : `${contractName} was not deployed. A rejected wallet request, insufficient gas, or a network error will not save an address.`));
    } finally {
      setBusy("");
    }
  }

  async function retrySourceVerification() {
    if (!selectedContract || !isAddress(selectedContract)) return;
    setBusy("source-verification");
    setMessage(zh ? "正在重新提交公开源码并检查 PolygonScan 最终验证状态…" : "Resubmitting public source and checking the final PolygonScan verification status…");
    try {
      const response = await fetch("/api/admin/smartpay/bundle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          settingId: selected.id,
          contractAddress: selectedContract,
          confirmPublicSource: true,
          retryExisting: true
        })
      });
      const result = await response.json().catch(() => ({})) as SourceVerificationResponse;
      if (!response.ok && !result.submitted) throw new Error(result.error || result.explorerMessage || "SOURCE_VERIFICATION_FAILED");
      setVerificationLinks(current => ({
        ...current,
        sourcifyUrl: result.sourcifyUrl,
        explorerUrl: result.explorerUrl,
        sourcifyMatch: result.sourcifyMatch || current?.sourcifyMatch,
        sourcifySubmitted: result.sourcifySubmitted,
        explorerSubmitted: result.explorerSubmitted,
        explorerVerified: result.explorerVerified,
        sourcifyMessage: result.sourcifyMessage,
        explorerMessage: result.explorerMessage,
        source: result.downloads?.source || current?.source,
        standardJsonInput: result.downloads?.standardJsonInput || current?.standardJsonInput
      }));
      setPublicationRevision(current => current + 1);
      setMessage(result.explorerVerified
        ? (zh ? "PolygonScan 已完成源码验证，合约页面将显示可读源码与 ABI。" : "PolygonScan source verification is complete; the contract page will expose readable source and ABI.")
        : /ETHERSCAN_API_KEY is not configured/i.test(result.explorerMessage || "")
          ? (zh ? "Sourcify 已精确验证；PolygonScan 尚未提交，因为生产环境未配置 ETHERSCAN_API_KEY。配置密钥后可再次点击此按钮，不需要重新部署或支付 Gas。" : "Sourcify is an exact match. PolygonScan was not submitted because ETHERSCAN_API_KEY is not configured in the production Worker. Retry after configuring it; no redeployment or gas is required.")
          : (zh ? `源码已重新提交，但 PolygonScan 尚未确认：${result.explorerMessage || "等待浏览器处理"}` : `Source was resubmitted, but PolygonScan has not confirmed it yet: ${result.explorerMessage || "waiting for explorer processing"}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (zh ? "无法重新提交源码验证。" : "Unable to resubmit source verification."));
    } finally {
      setBusy("");
    }
  }

  async function ownerConnection() {
    const active = provider && connectedWallet ? { provider, address: connectedWallet } : await connectWallet();
    if (!active || !selected || !contractState) throw new Error("CONNECT_OWNER_FIRST");
    await assertProviderChain(active.provider, selected.chainId);
    const ownerError = smartPayOwnerConnectionError(contractState.owner, ownerWallet, active.address);
    if (ownerError) throw new Error(ownerError);
    return active;
  }

  async function sendOwnerTransaction(functionName: string, args: readonly unknown[], key: string, prompt: string) {
    if (!selectedContract) return false;
    setBusy(key);
    setMessage(prompt);
    try {
      const active = await ownerConnection();
      const data = encodeFunctionData({ abi: contractAbi, functionName, args });
      const hash = await active.provider.request({ method: "eth_sendTransaction", params: [{ from: active.address, to: selectedContract, data }] });
      if (typeof hash !== "string") throw new Error("NO_TRANSACTION_HASH");
      await waitForTransactionReceipt(active.provider, hash);
      await refreshContractState();
      setMessage(zh ? "链上交易已确认并刷新。" : "On-chain transaction confirmed and refreshed.");
      return true;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      const feedback = smartPayOwnerActionFeedback(locale, reason);
      if (feedback.interruptive) window.alert(feedback.message);
      setMessage(feedback.message);
      return false;
    } finally {
      setBusy("");
    }
  }

  function updatePayout(index: number, key: keyof PayoutRow, value: string) {
    setPayouts(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row));
  }

  async function savePayouts() {
    const wallets = activePayouts.map(row => row.wallet.trim());
    const shares = [...explicitBps, 0];
    if (wallets.length < 1 || wallets.length > 5 || wallets.some(wallet => !isAddress(wallet))
      || payouts.slice(0, lastPayoutIndex + 1).some(row => !row.wallet.trim())
      || new Set(wallets.map(wallet => wallet.toLowerCase())).size !== wallets.length
      || explicitBps.some(value => !Number.isInteger(value) || value <= 0) || remainingBps <= 0) {
      setMessage(zh ? "请输入 1–5 个不重复钱包；前面比例须大于 0 且合计小于 100%，最后比例固定为 0。" : "Enter 1–5 unique wallets. Earlier shares must be positive and total less than 100%; the final share is fixed at 0.");
      return;
    }
    await sendOwnerTransaction("setPayouts", [wallets as Address[], shares], "save-payouts", zh ? "请在 Owner 钱包确认 W1–W5 分账。" : "Confirm the W1-W5 split in the Owner wallet.");
  }

  async function transferOwner() {
    if (!isAddress(newOwner)) {
      setMessage(zh ? "请输入有效的新 Owner 钱包。" : "Enter a valid new Owner wallet.");
      return;
    }
    if (contractState?.owner.toLowerCase() === newOwner.toLowerCase()) {
      setMessage(zh ? "新 Owner 与当前链上 Owner 相同。" : "The new Owner is already the current on-chain Owner.");
      return;
    }
    const confirmed = window.confirm(zh
      ? "这是单步即时转移。交易确认后，当前钱包会立即失去全部 Owner 权限；确定继续吗？"
      : "This is an immediate one-step transfer. Once confirmed, the current wallet immediately loses every Owner permission. Continue?");
    if (!confirmed) return;
    const completed = await sendOwnerTransaction("transferOwnership", [newOwner as Address], "transfer-owner", zh ? "请在当前 Owner 钱包确认即时转移。确认后旧 Owner 立即失权。" : "Confirm the immediate transfer in the current Owner wallet. The former Owner loses access as soon as it confirms.");
    if (completed) setNewOwner("");
  }

  async function fetchWithdrawTokenState() {
    if (!selected || !isAddress(withdrawToken) || !contractState?.tokens[withdrawToken.toLowerCase()]) {
      throw new Error("TOKEN_NOT_AVAILABLE");
    }
    const params = new URLSearchParams({ settingId: selected.id, tokenAddress: withdrawToken });
    const response = await fetch(`/api/admin/crypto-payments/token?${params}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as TokenState & { error?: string };
    if (!response.ok) throw new Error(data.error || "TOKEN_READ_FAILED");
    setWithdrawTokenState(data);
    return data;
  }

  async function refreshWithdrawToken() {
    setBusy("refresh-token");
    try {
      const data = await fetchWithdrawTokenState();
      setMessage(zh ? `合约余额：${data.balance} ${data.symbol}（${data.decimals} 位精度）。` : `Contract balance: ${data.balance} ${data.symbol} (${data.decimals} decimals).`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setMessage(reason === "TOKEN_NOT_AVAILABLE"
        ? (zh ? "请选择已在 SmartPay5 链上付款规则中的代币。" : "Select a token from an enabled SmartPay5 on-chain payment rule.")
        : (error instanceof Error ? error.message : (zh ? "无法读取代币。" : "Unable to read the token.")));
    } finally {
      setBusy("");
    }
  }

  async function withdraw() {
    if (!withdrawTokenState || !isAddress(withdrawToken)) {
      setMessage(zh ? "请先刷新代币余额和精度。" : "Refresh the token balance and decimals first.");
      return;
    }
    setBusy("withdraw-check");
    setMessage(zh ? "正在刷新合约余额并核对提款数量…" : "Refreshing the contract balance and checking the withdrawal amount…");
    try {
      const latestTokenState = await fetchWithdrawTokenState();
      const preflight = smartPayWithdrawalPreflight(withdrawAmount, latestTokenState.decimals, latestTokenState.balanceAtomic);
      if (!preflight.ok) {
        if (preflight.reason === "insufficient-balance") {
          setMessage(zh
            ? `合约代币余额不足：当前 ${latestTokenState.balance ?? "—"} ${latestTokenState.symbol}，无法提款 ${withdrawAmount} ${latestTokenState.symbol}。未调用钱包。`
            : `Insufficient contract token balance: ${latestTokenState.balance ?? "—"} ${latestTokenState.symbol} is available, so ${withdrawAmount} ${latestTokenState.symbol} cannot be withdrawn. The wallet was not called.`);
          return;
        }
        throw new Error(preflight.reason === "balance-unavailable" ? "BALANCE_UNAVAILABLE" : "INVALID_WITHDRAW_AMOUNT");
      }
      setBusy("");
      const completed = await sendOwnerTransaction("withdrawToken", [withdrawToken as Address, preflight.amountAtomic], "withdraw", zh ? "请在 Owner 钱包确认提款；代币将发送给当前链上 Owner。" : "Confirm withdrawal in the Owner wallet. Tokens go to the current on-chain Owner.");
      if (completed) {
        setWithdrawAmount("");
        await refreshWithdrawToken();
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setMessage(reason === "BALANCE_UNAVAILABLE"
        ? (zh ? "暂时无法读取合约代币余额；未调用钱包。" : "The contract token balance is unavailable. The wallet was not called.")
        : reason === "TOKEN_NOT_AVAILABLE"
          ? (zh ? "请选择已在 SmartPay5 链上付款规则中的代币。" : "Select a token from an enabled SmartPay5 on-chain payment rule.")
          : (zh ? "请输入符合代币精度的有效提款数量。" : "Enter a valid withdrawal amount for this token's decimals."));
    } finally {
      setBusy(current => current === "withdraw-check" ? "" : current);
    }
  }

  async function confirmSmartPay5Preset(preset: SmartPay5RulePreset) {
    if (enabledPresetKeys.has(preset.key)) {
      setMessage(zh ? "请先点击 Stop；Stop 只会从本站付款选择中隐藏该项目，不会调用钱包或合约。" : "Click Stop first. Stop only hides this item from this site's payment selection; it does not call the wallet or contract.");
      return;
    }
    const completed = await sendOwnerTransaction(
      "setPaymentRule",
      [
        preset.primaryTokenAddress as Address,
        preset.secondaryTokenAddress as Address,
        preset.mainId,
        preset.secondId,
        BigInt(preset.primaryTokenAmountAtomic),
        BigInt(preset.secondaryTokenAmountAtomic),
        BigInt(preset.minimumSecondaryBalanceAtomic),
        true
      ],
      `preset:${preset.key}`,
      preset.mode === "dual"
        ? (zh
          ? `请在 Owner 钱包确认写入 ${preset.months} 个月 USDT / GLC 等值付款项目。`
          : `Confirm the ${preset.months}-month USDT / GLC equivalent-value rule in the Owner wallet.`)
        : (zh
          ? `请在 Owner 钱包确认写入 ${preset.months} 个月 100% ${preset.primaryTokenSymbol} 单币付款项目。`
          : `Confirm the ${preset.months}-month 100% ${preset.primaryTokenSymbol} single-token rule in the Owner wallet.`)
    );
    if (!completed) return;
    try {
      const response = await fetch("/api/admin/crypto-payments/rules", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId: preset.chainId, presetKey: preset.key, action: "confirm" }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "CONFIRM_STATE_FAILED");
      setEnabledPresetKeys(current => new Set(current).add(preset.key)); setKnownPresetKeys(current => new Set(current).add(preset.key));
      setStalePresetKeys(current => { const next = new Set(current); next.delete(preset.key); return next; });
      setMessage(zh ? "链上规则已重新确认；此项目已恢复到付款选择。" : "The on-chain rule is re-confirmed and this item is available in payment selection again.");
    } catch {
      setMessage(zh ? "链上交易已确认，但服务器复核未完成；此项目仍不会出现在付款选择中，请再次点击 Re-confirm。" : "The on-chain transaction confirmed, but server verification did not finish. This item remains hidden from payment selection; click Re-confirm again.");
    }
  }

  async function stopSmartPay5Preset(preset: SmartPay5RulePreset) {
    const key = `stop-preset:${preset.key}`;
    setBusy(key);
    setMessage(zh ? "正在从本站付款选择中隐藏此项目；不会调用钱包或合约。" : "Hiding this item from this site's payment selection. The wallet and contract will not be called.");
    try {
      const response = await fetch("/api/admin/crypto-payments/rules", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId: preset.chainId, presetKey: preset.key, action: "stop" }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "STOP_STATE_FAILED");
      setEnabledPresetKeys(current => { const next = new Set(current); next.delete(preset.key); return next; }); setKnownPresetKeys(current => new Set(current).add(preset.key));
      setStalePresetKeys(current => { const next = new Set(current); next.delete(preset.key); return next; });
      setMessage(zh ? "已 Stop：此项目不会出现在付款选择中。点击 Re-confirm 才会再次调用合约并恢复。" : "Stopped: this item is hidden from payment selection. Only Re-confirm will call the contract and restore it.");
    } catch { setMessage(zh ? "Stop 未完成；付款项目状态没有改变。" : "Stop did not complete; the payment-item state was not changed."); }
    finally { setBusy(""); }
  }

  async function syncMember(member: MatchedMember, records: TransactionRecord[]) {
    if (!selected) return { synced: 0, alreadyRecorded: 0, errors: [] as string[], currentPeriodEnds: [] as number[] };
    let synced = 0;
    let alreadyRecorded = 0;
    const errors: string[] = [];
    const currentPeriodEnds: number[] = [];
    const eligible = records.filter(record => record.siteOwned
      && smartPayTransactionNeedsReconciliation(record, member.payerId, record.refId));
    for (const record of eligible) {
      const paymentTokenAddress = record.primaryTokenAddress;
      const paymentSetting = settings.find(item => item.chainId === selected.chainId
        && item.smartPay5Contract?.toLowerCase() === selectedContract.toLowerCase()
        && paymentTokenAddress && item.tokenContract.toLowerCase() === paymentTokenAddress.toLowerCase());
      if (!paymentSetting) continue;
      const response = await fetch("/api/billing/crypto/smartpay/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ settingId: paymentSetting.id, paymentId: record.transactionId, memberId: member.id })
      });
      const result = await response.json().catch(() => ({})) as {
        verified?: boolean;
        alreadyRecorded?: boolean;
        currentPeriodEnd?: number | null;
        error?: string;
      };
      if (response.ok && result.verified) {
        if (result.alreadyRecorded) alreadyRecorded += 1;
        else synced += 1;
        if (result.currentPeriodEnd) currentPeriodEnds.push(result.currentPeriodEnd);
      } else {
        errors.push(`${record.transactionId.slice(0, 10)}… · ${result.error || `HTTP ${response.status}`}`);
      }
    }
    return { synced, alreadyRecorded, errors, currentPeriodEnds };
  }

  async function loadLatestTransactions() {
    if (!selected) throw new Error("SELECT_RAIL");
    const payerId = queryPayerId.trim().toUpperCase();
    if (payerId && !/^[A-HJ-NP-Z2-9]{6}$/.test(payerId)) throw new Error(zh ? "请输入有效的 6 位 PayerID，或留空读取最新 25 条。" : "Enter a valid six-character PayerID, or leave it blank for the latest 25.");
    const firstParams = new URLSearchParams({ settingId: selected.id, limit: payerId ? "100" : "25" });
    if (payerId) firstParams.set("payerId", payerId);
    const firstResponse = await fetch(`/api/billing/crypto/smartpay/records?${firstParams}`, { cache: "no-store" });
    const first = await firstResponse.json().catch(() => ({})) as LookupResponse;
    if (!firstResponse.ok) throw new Error(first.error || "TRANSACTION_LOOKUP_FAILED");
    const records = first.transactions || [];
    const members = first.matchedMembers || [];
    const total = first.totalTransactions || records.length;
    return { records, members, total };
  }

  async function refreshTransactions(autoSync = true) {
    if (!transactionReadReady) {
      setMessage(zh ? "请先部署并验证 SmartPay5，再读取交易。" : "Deploy and verify SmartPay5 before reading transactions.");
      return;
    }
    setBusy("transactions");
    setMessage("");
    try {
      let result = await loadLatestTransactions();
      setTransactions(result.records);
      setTransactionTotal(result.total);
      setMatchedMembers(result.members);
      let synced = 0;
      const syncErrors: string[] = [];
      const subscriptionEnds: number[] = [];
      if (autoSync && result.records.length && result.members.length) {
        const grouped = new Map<string, MatchedMember[]>();
        for (const member of result.members) {
          const key = member.payerId.toUpperCase();
          grouped.set(key, [...(grouped.get(key) || []), member]);
        }
        for (const [, members] of grouped) if (members.length === 1) {
          const sync = await syncMember(members[0], result.records);
          synced += sync.synced;
          syncErrors.push(...sync.errors);
          subscriptionEnds.push(...sync.currentPeriodEnds);
        }
        if (synced) {
          result = await loadLatestTransactions();
          setTransactions(result.records);
          setTransactionTotal(result.total);
          setMatchedMembers(result.members);
        }
      }
      const ambiguous = result.members.filter(member => result.members.filter(item => item.payerId.toUpperCase() === member.payerId.toUpperCase()).length > 1).length;
      const latestSubscriptionEnd = subscriptionEnds.length ? Math.max(...subscriptionEnds) : null;
      setMessage(syncErrors.length
        ? (zh ? `交易已读取，但 ${syncErrors.length} 条订阅核对失败：${syncErrors.join("；")}` : `Transactions loaded, but ${syncErrors.length} subscription reconciliation(s) failed: ${syncErrors.join("; ")}`)
        : synced
        ? (zh
          ? `已自动核对并新增 ${synced} 条订阅记录${latestSubscriptionEnd ? `；订阅至 ${subscriptionEndLabel(latestSubscriptionEnd, locale)}` : ""}。`
          : `${synced} subscription record(s) were reconciled automatically${latestSubscriptionEnd ? `; subscription through ${subscriptionEndLabel(latestSubscriptionEnd, locale)}` : ""}.`)
        : ambiguous ? (zh ? "交易已读取；有 PayerID 匹配多个会员，请手动选择会员同步。" : "Transactions loaded. A PayerID matches multiple members, so choose the member manually.")
          : (zh ? "交易与订阅状态已刷新，没有新的未入账付款。" : "Transactions and subscription status refreshed; no new unrecorded payment was found."));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (zh ? "无法读取交易。" : "Unable to read transactions."));
    } finally {
      setBusy("");
    }
  }

  async function manualSync(member: MatchedMember) {
    setBusy(`sync:${member.id}`);
    try {
      const result = await syncMember(member, transactions);
      const latestSubscriptionEnd = result.currentPeriodEnds.length ? Math.max(...result.currentPeriodEnds) : null;
      const completionMessage = result.errors.length
        ? (zh ? `人工核对失败：${result.errors.join("；")}` : `Manual reconciliation failed: ${result.errors.join("; ")}`)
        : result.synced
          ? (zh
            ? `已确认并新增 ${result.synced} 条订阅；订阅至 ${subscriptionEndLabel(latestSubscriptionEnd, locale)}。`
            : `${result.synced} subscription record(s) confirmed; subscription through ${subscriptionEndLabel(latestSubscriptionEnd, locale)}.`)
          : result.alreadyRecorded
            ? (zh ? `该付款已经确认；订阅至 ${subscriptionEndLabel(latestSubscriptionEnd, locale)}。` : `This payment is already confirmed; subscription through ${subscriptionEndLabel(latestSubscriptionEnd, locale)}.`)
            : (zh ? "没有可同步的新付款。" : "No new payment was available to sync.");
      if (result.synced || result.alreadyRecorded) await refreshTransactions(false);
      setMessage(completionMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (zh ? "人工核对失败。" : "Manual reconciliation failed."));
    } finally {
      setBusy("");
    }
  }

  if (!settings.length) return <section className="admin-smartpay-config"><p>{zh ? "请先在管理员面板新增并启用 Polygon 等付款通道。" : "Add and enable a Polygon or other payment rail in the Admin dashboard first."}</p></section>;

  return <div className="smartpay-console-grid">
    <section className="smartpay-console-card smartpay-contract-card">
      <div className="admin-form-heading"><div><span>CONTRACT</span><h2>{zh ? "部署或导入合约" : "Deploy or import contract"}</h2></div></div>
      <label><span>{zh ? "部署链" : "Deployment chain"}</span><select value={selected?.id || ""} onChange={event => selectSetting(event.target.value)}>{chainOptions.map(option => <option key={option.chainId} value={option.setting?.id || `unconfigured:${option.chainId}`} disabled={!option.setting}>{option.label}</option>)}</select></label>
      <p className="smartpay-token-balance">{selectedContract ? (zh ? "当前合约" : "Current contract") + " · " + selectedContract : (zh ? `此网络尚未配置 ${contractName}。` : `${contractName} is not configured for this network.`)}</p>
      <div className="smartpay-ratio-setting"><label><span>{zh ? "USDT 付款比例（0–100）" : "USDT payment percentage (0–100)"}</span><input inputMode="numeric" value={smartPay5UsdtPercent} onChange={event => setSmartPay5UsdtPercent(event.target.value)} /></label><button type="button" className="button ghost" onClick={() => void saveSmartPay5Percentage()} disabled={Boolean(busy)}>{busy === "save-smartpay5-percent" ? "…" : (zh ? "更新比例" : "Update ratio")}</button><small>{zh ? `当前输入表示 ${smartPay5UsdtPercent || "0"}% USDT + ${Number.isFinite(Number(smartPay5UsdtPercent)) ? 100 - Number(smartPay5UsdtPercent) : "—"}% GLC。只保存本站数据库，不需要 Owner 或链上交易。` : `The current input means ${smartPay5UsdtPercent || "0"}% USDT + ${Number.isFinite(Number(smartPay5UsdtPercent)) ? 100 - Number(smartPay5UsdtPercent) : "—"}% GLC. It is saved only in this site's database and requires no Owner or on-chain transaction.`}</small></div>
      <label className="toggle-field smartpay-source-toggle"><input type="checkbox" checked={publishSource} onChange={event => setPublishSource(event.target.checked)} disabled={Boolean(busy)}/><span>{zh ? "提交源码进行公开验证（默认开启）" : "Submit source code for public verification (default on)"}</span></label>
      <small className="smartpay-source-warning">{zh ? "开启：钱包部署确认后上传源码、执行链下字节码匹配，并开放源码与浏览器链接；不产生额外 Gas，也不等于审计。关闭：只提供 ABI 链接，源码不上传、不开放下载。" : "On: after wallet-confirmed deployment, upload source for an off-chain bytecode match and expose source and explorer links; this adds no gas and is not an audit. Off: provide only the ABI link, without uploading or exposing source."}</small>
      {contractConfigured ? <p className="flow-intro">{zh ? "需要新代码或重置链上配置时，可重新部署全新空合约；旧合约和历史记录不会删除。" : "Redeploy a new empty contract when code changes or on-chain configuration must be reset. The old contract and history are not deleted."}</p> : null}
      <button type="button" className="button primary" onClick={() => void deploySelectedContract(contractConfigured)} disabled={Boolean(busy)}>{busy === "deploy-contract" ? "…" : contractConfigured ? (zh ? `重新部署 ${contractName}` : `Redeploy ${contractName}`) : (zh ? `部署 ${contractName}` : `Deploy ${contractName}`)}</button>
      <small>{selected ? smartPayChainLabel(selected.chainId, selected.chainName) : "—"} · Chain ID {selected?.chainId}<br/>{zh ? "每个站点在每条链使用一个独立地址；同链付款通道共享此合约。初始 Owner 固定为已连接钱包。" : "Each site uses one independent address per chain; payment rails on the same chain share it. The connected wallet becomes the initial Owner."}</small>
      <div className="smartpay-verification-links" aria-label={`${contractName} contract downloads`}><a href={`/contracts/${contractName}.abi.json`} download>{zh ? "下载 ABI" : "Download ABI"}</a>{verificationLinks?.source ? <a href={verificationLinks.source} download>{zh ? "下载已公开源码" : "Download published source"}</a> : null}{verificationLinks?.standardJsonInput ? <a href={verificationLinks.standardJsonInput} download>{zh ? "下载已公开 Standard JSON" : "Download published Standard JSON"}</a> : null}</div>
      {verificationLinks ? <div className="smartpay-verification-status">
        <span className={verificationLinks.sourcifyMatch === "exact_match" ? "rule-enabled" : "rule-disabled"}>{verificationLinks.sourcifyMatch === "exact_match" ? (zh ? "Sourcify 精确验证" : "Sourcify exact match") : verificationLinks.sourcifySubmitted ? (zh ? "Sourcify 已提交" : "Sourcify submitted") : (zh ? "Sourcify 未提交" : "Sourcify not submitted")}</span>
        <span className={verificationLinks.explorerVerified ? "rule-enabled" : "rule-disabled"}>{verificationLinks.explorerVerified ? (zh ? "PolygonScan 源码已验证" : "PolygonScan source verified") : verificationLinks.explorerSubmitted ? (zh ? "PolygonScan 已提交，等待验证" : "PolygonScan submitted; verification pending") : (zh ? "PolygonScan 尚未提交" : "PolygonScan not submitted")}</span>
      </div> : null}
      {verificationLinks && !verificationLinks.explorerVerified ? <p className="smartpay-source-warning">{/ETHERSCAN_API_KEY is not configured/i.test(verificationLinks.explorerMessage || "")
        ? (zh ? "原因：生产环境尚未配置 ETHERSCAN_API_KEY。Sourcify 精确验证仍然有效；配置密钥后可在此重试 PolygonScan，不需要重新部署或支付 Gas。" : "Reason: ETHERSCAN_API_KEY is not configured in the production Worker. The Sourcify exact match remains valid; retry PolygonScan here after configuration without redeployment or gas.")
        : (verificationLinks.explorerMessage || (zh ? "PolygonScan 尚未返回最终验证结果。" : "PolygonScan has not returned a final verification result."))}</p> : null}
      {verificationLinks && !verificationLinks.explorerVerified ? <button type="button" className="button ghost" onClick={() => void retrySourceVerification()} disabled={Boolean(busy)}>{busy === "source-verification" ? "…" : (zh ? "重新提交 PolygonScan 源码验证" : "Retry PolygonScan source verification")}</button> : null}
      {verificationLinks ? <div className="smartpay-verification-links">{verificationLinks.explorerUrl ? <a href={verificationLinks.explorerUrl} target="_blank" rel="noreferrer">{zh ? "查看区块浏览器状态" : "View explorer status"}</a> : null}{verificationLinks.sourcifyUrl ? <a href={verificationLinks.sourcifyUrl} target="_blank" rel="noreferrer">{zh ? "查看 Sourcify 验证" : "View Sourcify verification"}</a> : null}</div> : null}
      <details className="smartpay-contract-import">
        <summary>{zh ? `导入已有 ${contractName} 地址` : `Import an existing ${contractName} address`}</summary>
        <label><span>{contractName} {zh ? "合约地址" : "contract address"}</span><input value={contractAddress} onChange={event => setContractAddress(event.target.value.trim())} placeholder="0x…"/></label>
        <div className="smartpay-console-actions"><button type="button" onClick={() => void saveContractAddress()} disabled={Boolean(busy)}>{busy === "save-contract" ? "…" : (zh ? "验证并更新" : "Verify & update")}</button>{contractConfigured ? <button type="button" onClick={() => void refreshContractState()} disabled={Boolean(busy)}>{busy === "refresh-contract" ? "…" : (zh ? "刷新链上数据" : "Refresh chain data")}</button> : null}</div>
      </details>
    </section>

    <section className="smartpay-console-card">
      <div className="admin-form-heading"><div><span>OWNER</span><h2>{zh ? "Owner 钱包" : "Contract Owner"}</h2></div></div>
      <label><span>{zh ? "Owner 钱包编辑框" : "Owner wallet"}</span><input value={ownerWallet} onChange={event => setOwnerWallet(event.target.value.trim())} placeholder="0x…"/></label>
      {ownerWalletButton.visible ? <button type="button" className="button primary" onClick={() => void connectWallet()} disabled={ownerWalletButton.disabled}>{busy === "connect" ? "…" : ownerWalletButton.label}</button> : <p className="smartpay-connected-wallet"><span className="rule-enabled">{zh ? "钱包已连接" : "Wallet connected"}</span> {shortAddress(connectedWallet)}</p>}
      <dl className="smartpay-state-list"><div><dt>{zh ? "链上 Owner" : "On-chain Owner"}</dt><dd>{contractState?.owner || "—"}</dd></div><div><dt>{zh ? "已连接" : "Connected"}</dt><dd>{connectedWallet || "—"}</dd></div><div><dt>{zh ? "Owner 转移" : "Owner transfer"}</dt><dd>{zh ? "单步即时" : "Immediate one-step"}</dd></div><div><dt>{zh ? "付款状态" : "Payment state"}</dt><dd>{contractState?.paused ? (zh ? "已暂停" : "Paused") : (zh ? "可付款" : "Active")}</dd></div></dl>
      <label><span>{zh ? "新 Owner 钱包" : "New Owner wallet"}</span><input value={newOwner} onChange={event => setNewOwner(event.target.value.trim())} placeholder="0x…"/></label>
      <div className="smartpay-console-actions"><button type="button" onClick={() => void transferOwner()} disabled={!contractState || Boolean(busy)}>{zh ? "立即转移 Owner" : "Transfer Owner now"}</button></div>
    </section>

    <section className="smartpay-console-card smartpay-wide-card">
      <div className="admin-form-heading"><div><span>W1–W5</span><h2>{zh ? "收款钱包与百分比" : "Payout wallets & percentages"}</h2></div></div>
      <p>{zh ? "五个位置固定显示；从 W1 开始连续填写。当前最后一个钱包自动获得余款，空位置不会写入合约。" : "All five positions stay visible. Fill them consecutively from W1; the last active wallet receives the remainder, and blank positions are not written to the contract."}</p>
      <div className="smartpay-payout-list">{payouts.map((row, index) => {
        const chainRow = contractState?.payouts[index];
        const onChain = Boolean(chainRow && row.wallet.trim() && row.wallet.toLowerCase() === chainRow.wallet.toLowerCase() && payoutShares[index] === chainRow.shareBps);
        const activeLast = index === lastPayoutIndex;
        return <div className="smartpay-payout-row" key={index}><label><span>W{index + 1} · {zh ? "钱包" : "Wallet"}</span><input value={row.wallet} onChange={event => updatePayout(index, "wallet", event.target.value)} placeholder="0x…"/></label><label><span>{activeLast ? (zh ? "比例 0 · 自动余款" : "Share 0 · automatic remainder") : (zh ? "百分比" : "Percentage")}</span>{index < lastPayoutIndex ? <input inputMode="decimal" value={row.percent} onChange={event => updatePayout(index, "percent", event.target.value)} placeholder="30"/> : <output>{activeLast ? `${Math.max(0, remainingBps / 100).toFixed(2)}%` : "—"}</output>}</label><span className={onChain ? "rule-enabled" : "rule-disabled"}>{onChain ? (zh ? "链上已有" : "On-chain") : row.wallet.trim() ? (zh ? "待写入" : "Pending") : (zh ? "链上无数据" : "No on-chain data")}</span></div>;
      })}</div>
      {!payoutsMatchChain ? <div className="smartpay-console-actions"><button type="button" className="button primary" onClick={() => void savePayouts()} disabled={!contractState || Boolean(busy)}>{busy === "save-payouts" ? "…" : (zh ? "确认写入 W1–W5" : "Confirm W1-W5 on-chain")}</button></div> : null}
    </section>

    <section className="smartpay-console-card">
      <div className="admin-form-heading"><div><span>WITHDRAW</span><h2>{zh ? "合约代币提款" : "Contract token withdrawal"}</h2></div></div>
      <p>{zh ? "仅用于误转进合约的 ERC‑20 余额；正常付款会直接分给 W1–W5。提款发送给当前链上 Owner。" : "For ERC-20 tokens sent to the contract by mistake. Normal payments go directly to W1-W5. Withdrawals go to the current on-chain Owner."}</p>
      <label><span>{zh ? "链上付款代币" : "On-chain payment token"}</span><select value={withdrawToken} onChange={event => { const next = event.target.value; setWithdrawToken(next); setWithdrawTokenState(contractState?.tokens[next] || null); }} disabled={!withdrawTokenOptions.length}>{withdrawTokenOptions.length ? withdrawTokenOptions.map(([address, token]) => <option key={address} value={address}>{token.symbol} · {address}</option>) : <option value="">{zh ? "合约尚无可用付款代币" : "No available contract payment token"}</option>}</select></label>
      <label><span>{zh ? "提款数量" : "Amount to withdraw"}</span><input inputMode="decimal" value={withdrawAmount} onChange={event => setWithdrawAmount(event.target.value)} placeholder={withdrawTokenState?.decimals === 6 ? "100.5" : "0.1"}/></label>
      <p className="smartpay-token-balance">{withdrawTokenState ? `${contractName} ${zh ? "合约余额" : "contract balance"} · ${withdrawTokenState.balance} ${withdrawTokenState.symbol} · ${withdrawTokenState.decimals} decimals` : (zh ? "合约尚无可读取的链上付款代币" : "The contract has no readable on-chain payment token")}</p>
      {withdrawTokenState && withdrawalPreflight && !withdrawalPreflight.ok && withdrawalPreflight.reason === "insufficient-balance"
        ? <p className="rule-disabled" role="status">{zh ? `余额不足：当前仅有 ${withdrawTokenState.balance} ${withdrawTokenState.symbol}。` : `Insufficient balance: only ${withdrawTokenState.balance} ${withdrawTokenState.symbol} is available.`}</p>
        : null}
      <div className="smartpay-console-actions"><button type="button" onClick={() => void refreshWithdrawToken()} disabled={!contractState || !withdrawTokenOptions.length || Boolean(busy)}>{busy === "refresh-token" ? "…" : (zh ? "刷新合约余额" : "Refresh contract balance")}</button><button type="button" className="button primary" onClick={() => void withdraw()} disabled={!withdrawTokenState || !withdrawAmount || Boolean(busy)}>{busy === "withdraw" || busy === "withdraw-check" ? "…" : (zh ? "提款到 Owner" : "Withdraw to Owner")}</button></div>
    </section>

    <section className="smartpay-console-card smartpay-wide-card">
      <div className="admin-form-heading"><div><span>PAYMENT ITEMS</span><h2>{zh ? "后台付款项目与链上规则" : "Dashboard payment items & on-chain rules"}</h2></div><button type="button" onClick={() => void refreshContractState()} disabled={!contractConfigured || Boolean(busy)}>{busy === "refresh-contract" ? "…" : (zh ? "刷新链上规则" : "Refresh on-chain rules")}</button></div>
      <p>{zh ? "链上只保存初期、中级、高级三个 3 个月价格产品；所有学习语言共享同一价格规则，学生付款时选择的语言会单独记录为 secondID。USDT 项目保存 100% USDT、100% 等值 GLC 与 10 亿 GLC 门槛，实际 USDT 比例保存在本站数据库。" : "Only the three 3-month Beginner, Intermediate, and Advanced price products are stored on-chain. Every learning language shares the same price rule; the language selected at checkout is recorded separately as secondID. USDT rules store full USDT/GLC equivalents and the 1-billion-GLC threshold, while the active mix stays in this site's database."}</p>
      {smartPay5PresetRows.length ? <div className="smartpay-rule-list smartpay-preset-list">{smartPay5PresetRows.map(({ preset, status }) => {
        const key = `preset:${preset.key}`;
        const stopKey = `stop-preset:${preset.key}`;
        const tier = preset.plan === "basic" ? (zh ? "初期课程" : "Beginner") : preset.plan === "intermediate" ? (zh ? "中级课程" : "Intermediate") : (zh ? "高级课程" : "Advanced");
        const databaseState = enabledPresetKeys.has(preset.key) ? "enabled" as const : stalePresetKeys.has(preset.key) ? "stale" as const : knownPresetKeys.has(preset.key) ? "stopped" as const : "unconfirmed" as const;
        const control = smartPay5ConfirmationControl(status.state, databaseState);
        const statusLabel = databaseState === "stopped" ? (zh ? "待 Re-confirm · 付款不可选" : "Awaiting Re-confirm · unavailable") : databaseState === "stale" ? (zh ? "数据库价格已变 · 需 Re-confirm · 付款不可选" : "Database price changed · Re-confirm required · unavailable") : databaseState === "unconfirmed" ? (zh ? "尚未确认 · 付款不可选" : "Not confirmed · unavailable") : status.state === "missing" ? (zh ? "数据库已启用 · 链上缺失" : "Database enabled · missing on-chain") : status.state === "disabled" ? (zh ? "数据库已启用 · 链上已停用" : "Database enabled · stopped on-chain") : null;
        const stopLabel = status.state === "different" ? (zh ? "价格已改变 · Stop" : "Price changed · Stop") : status.state === "configured" ? (zh ? "已确认 · Stop" : "Confirmed · Stop") : (zh ? "数据库已启用 · Stop" : "Database enabled · Stop");
        return <article key={preset.key}><div><strong>{tier} · {preset.months} {zh ? "个月" : "months"} · {preset.mode === "dual" ? `${preset.primaryTokenSymbol} / ${preset.secondaryTokenSymbol}` : preset.primaryTokenSymbol}</strong><small>{preset.mainId} · {zh ? "语言由学生付款时选择" : "Language selected at checkout"}</small></div><div><b>{preset.mode === "dual" ? `${preset.primaryTokenAmount} ${preset.primaryTokenSymbol} ↔ ${preset.secondaryTokenAmount} ${preset.secondaryTokenSymbol}` : `${preset.primaryTokenAmount} ${preset.primaryTokenSymbol}`}</b><small>{preset.mode === "dual" ? `${zh ? `当前本站：${preset.primaryPercent}% / ${preset.secondaryPercent}%` : `Current site: ${preset.primaryPercent}% / ${preset.secondaryPercent}%`} · ${zh ? `门槛 ${preset.minimumSecondaryBalance} GLC` : `Threshold ${preset.minimumSecondaryBalance} GLC`}` : (zh ? "非 USDT · 100% 单币付款" : "Non-USDT · 100% single-token payment")}</small></div>{control.showStop ? <button type="button" className={status.state === "configured" ? "rule-enabled" : "rule-disabled"} title={zh ? "仅从本站付款选择中隐藏；不调用钱包或合约" : "Hide only from this site's payment selection; no wallet or contract call"} onClick={() => void stopSmartPay5Preset(preset)} disabled={!confirmationStateReady || Boolean(busy)}>{busy === stopKey ? "…" : stopLabel}</button> : statusLabel ? <span className="rule-disabled">{statusLabel}</span> : null}{control.showConfirm ? <button type="button" className="button primary" onClick={() => void confirmSmartPay5Preset(preset)} disabled={!confirmationStateReady || !contractState || Boolean(busy)}>{busy === key ? "…" : control.confirmKind === "reconfirm" ? "Re-confirm" : (zh ? "确认写入" : "Confirm on-chain")}</button> : null}</article>;
      })}</div> : <p>{zh ? "所选链尚无可写入 SmartPay5 的后台付款项目。" : "No dashboard payment item is available for SmartPay5 on this chain."}</p>}
    </section>

    <section className="smartpay-console-card smartpay-wide-card">
      <div className="admin-form-heading"><div><span>TRANSACTIONS</span><h2>{zh ? "交易与订阅自动核对" : "Transactions & subscription reconciliation"}</h2></div></div>
      <p>{zh ? "输入 PayerID 读取该账户最新 100 条交易；留空读取合约最新 25 条。付款钱包仅作为审计信息，PayerID 识别付款人，RefID 识别课程产品 Owner。" : "Enter a PayerID to read that account's latest 100 transactions, or leave it blank for the latest 25 contract transactions. The funding wallet is audit data only: PayerID identifies the payer and RefID identifies the course product Owner."}</p>
      <div className="smartpay-transaction-query"><label><span>{zh ? "PayerID（可留空）" : "PayerID (optional)"}</span><input value={queryPayerId} onChange={event => setQueryPayerId(event.target.value.trim().toUpperCase())} placeholder="ABC234" disabled={!transactionReadReady}/></label><button type="button" className="button primary" onClick={() => void refreshTransactions()} disabled={!contractConfigured || !transactionReadReady || Boolean(busy)}>{busy === "transactions" ? "…" : (zh ? "刷新交易并核对订阅" : "Refresh transactions & subscriptions")}</button></div>
      <p className="smartpay-record-count">{!transactionReadReady ? (zh ? "交易读取：等待重新部署" : "Transaction reads: redeploy required") : queryPayerId ? (zh ? `PayerID 交易：${transactions.length} / ${transactionTotal}` : `PayerID transactions: ${transactions.length} of ${transactionTotal}`) : (zh ? `最新交易：${transactions.length} / 合约总计 ${transactionTotal}` : `Latest transactions: ${transactions.length} of ${transactionTotal} total`)}</p>
      {transactions.length ? <div className="smartpay-transaction-table" role="region" aria-label={`${contractName} transactions`}><table><thead><tr><th>TransactionID</th><th>{zh ? "时间 / 钱包 / PayerID / RefID" : "Time / wallet / PayerID / RefID"}</th><th>mainID / secondID</th><th>{zh ? "代币 / 数量" : "Token / amount"}</th><th>{zh ? "订阅状态" : "Subscription"}</th></tr></thead><tbody>{transactions.map(record => <tr key={record.transactionId}><td><code>{record.transactionId}</code></td><td>{new Date(record.timestamp * 1000).toLocaleString(locale)}<small>{record.wallet}</small><small>PayerID · {record.payerId}</small><small>RefID · {record.refId}</small></td><td>{record.mainId}<small>{record.secondId || "—"}</small></td><td>{record.primaryTokenAmount}<small>{record.primaryTokenAddress}</small>{hasSecondaryTransaction(record) ? <>{record.secondaryTokenAmount}<small>{record.secondaryTokenAddress}</small></> : null}</td><td><span className={record.subscriptionRecorded ? "rule-enabled" : "rule-disabled"}>{record.subscriptionRecorded ? (zh ? "已确认" : "Confirmed") : (zh ? "待核对" : "Pending")}</span>{record.subscriptionEndsAt ? <small>{zh ? `订阅至 ${subscriptionEndLabel(record.subscriptionEndsAt, locale)}` : `Subscription through ${subscriptionEndLabel(record.subscriptionEndsAt, locale)}`}</small> : null}</td></tr>)}</tbody></table></div> : null}
      {matchedMembers.length ? <div className="smartpay-matched-members"><strong>{zh ? "匹配会员" : "Matched members"}</strong>{matchedMembers.map(member => {
        const needsReconciliation = transactions.some(record => record.siteOwned && smartPayTransactionNeedsReconciliation(record, member.payerId, record.refId));
        return <div key={member.id}><span>{member.displayName} · {member.email}{" "}<small>PayerID {member.payerId}</small></span>{needsReconciliation ? <button type="button" onClick={() => void manualSync(member)} disabled={Boolean(busy)}>{busy === `sync:${member.id}` ? "…" : (zh ? "手动核对此会员" : "Reconcile this member")}</button> : null}</div>;
      })}</div> : null}
    </section>

    {message ? <p className="billing-message smartpay-console-message" role="status">{message}</p> : null}
  </div>;
}
