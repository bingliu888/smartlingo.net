"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { encodeFunctionData, formatUnits, type Address } from "viem";
import type { CryptoPaymentSetting } from "../lib/crypto-settings";
import { explorerUrl } from "../lib/crypto-explorer";
import { ERC20_ABI } from "../lib/erc20";
import { verifyCryptoPaymentWithConfirmations } from "../lib/crypto-payment-verification";
import { existingPaymentAction, includeClaimedPaymentForLookup, type PaymentLookupContext } from "../lib/crypto-payment-user-flow";
import { assertProviderChain, connectEvmWallet, waitForTransactionReceipt, walletChain, type EthereumProvider } from "../lib/evm-wallet-client";
import { interfaceText } from "../lib/interface-locale";
import type { SiteLanguage } from "../lib/site-locale";
import { smartPayAvailablePlans, smartPayCheckoutDisplayAmount, smartPayOptionsForLanguage, smartPayOptionsForPlan, type SmartPayCheckoutOption } from "../lib/smartpay-checkout";
import { SMARTLINGO_WALLET_CONNECT } from "../lib/smartlingo-commerce-wallet";
import type { CryptoSubscriptionPlan } from "../lib/crypto-subscription";
import type { SubscriptionPlan } from "../lib/subscription-plans";
import { SMARTPAY3_ABI } from "../lib/smartpay3";
import { readSmartPay3WalletPreflight, type SmartPay3WalletPreflight } from "../lib/smartpay3-wallet-preflight";

type Plan = CryptoSubscriptionPlan;
type Status = { signedIn: boolean; wallet?: string | null; cryptoSettings?: CryptoPaymentSetting[]; plans?: SubscriptionPlan[] };
type CheckoutOptionsResponse = { options?: SmartPayCheckoutOption[]; error?: string };
type PreparedCheckoutOption = SmartPayCheckoutOption & { refId: string };
type ExistingPayment = {
  txHash: string;
  paymentId?: string;
  claimed?: boolean;
  verified?: boolean;
  timestamp?: number;
  tokenAmount?: string;
  currentPeriodEnd?: number | null;
};

const displayAtomic = (value: string, decimals: number, maximumFractionDigits = 6) => {
  const [whole, fraction = ""] = formatUnits(BigInt(value), decimals).split(".");
  const trimmed = fraction.slice(0, maximumFractionDigits).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
};

const subscriptionTerm = (plan: Plan, _months: number, t: (english: string, chinese: string) => string) => {
  const level = plan === "basic"
    ? t("Beginner", "初期课程")
    : plan === "intermediate"
      ? t("Intermediate", "中级课程")
      : t("Advanced", "高级课程");
  return `${level} · ${t("3-month fixed-term access", "3 个月固定期限学习权利")}`;
};

export function CryptoCheckout({ lang: locale, initialPlan, initialLanguageCode, lockedCourseId }: { lang: SiteLanguage; initialPlan: Plan; initialLanguageCode: string; lockedCourseId?: string }) {
  const t = useCallback((english: string, chinese: string) => interfaceText(locale, english, chinese), [locale]);
  const [status, setStatus] = useState<Status>({ signedIn: false });
  const [options, setOptions] = useState<SmartPayCheckoutOption[]>([]);
  const [optionsLoaded, setOptionsLoaded] = useState(false);
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [settingId, setSettingId] = useState("");
  const [wallet, setWallet] = useState("");
  const [direct, setDirect] = useState(false);
  const [connected, setConnected] = useState(false);
  const [walletProvider, setWalletProvider] = useState<EthereumProvider | null>(null);
  const [smartPay3Preflight, setSmartPay3Preflight] = useState<SmartPay3WalletPreflight | null>(null);
  const [smartPay3UsingCombo, setSmartPay3UsingCombo] = useState(false);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const [balance, setBalance] = useState("");
  const [txHash, setTxHash] = useState("");
  const [existingPayment, setExistingPayment] = useState<ExistingPayment | null>(null);
  const [pendingPaymentHash, setPendingPaymentHash] = useState("");
  const [confirmedUntil, setConfirmedUntil] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function loadStatus() {
    const data = await fetch("/api/billing/status", { cache: "no-store" }).then(response => response.json()) as Status;
    setStatus(data);
    setWallet(data.wallet || "");
  }

  async function loadOptions() {
    const response = await fetch(`/api/billing/crypto/smartpay/options?language=${encodeURIComponent(initialLanguageCode)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as CheckoutOptionsResponse;
    if (!response.ok) throw new Error(data.error || "OPTIONS_UNAVAILABLE");
    const availableOptions = smartPayOptionsForLanguage(data.options || [], initialLanguageCode, lockedCourseId);
    const nextPlan = availableOptions.some(option => option.plan === plan) ? plan : availableOptions[0]?.plan || initialPlan;
    setOptions(availableOptions);
    setPlan(nextPlan);
    setSettingId(current => availableOptions.some(option => option.plan === nextPlan && option.settingId === current)
      ? current : availableOptions.find(option => option.plan === nextPlan)?.settingId || "");
    setOptionsLoaded(true);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch("/api/billing/status", { cache: "no-store" }).then(response => response.json() as Promise<Status>),
      fetch(`/api/billing/crypto/smartpay/options?language=${encodeURIComponent(initialLanguageCode)}`, { cache: "no-store" }).then(async response => {
        const data = await response.json().catch(() => ({})) as CheckoutOptionsResponse;
        if (!response.ok) throw new Error(data.error || "OPTIONS_UNAVAILABLE");
        return smartPayOptionsForLanguage(data.options || [], initialLanguageCode, lockedCourseId);
      })
    ]).then(([billingStatus, availableOptions]) => {
      if (!active) return;
      setStatus(billingStatus);
      setWallet(billingStatus.wallet || "");
      setOptions(availableOptions);
      const nextPlan = availableOptions.some(option => option.plan === initialPlan) ? initialPlan : availableOptions[0]?.plan || initialPlan;
      setPlan(nextPlan);
      setSettingId(current => availableOptions.some(option => option.plan === nextPlan && option.settingId === current)
        ? current : availableOptions.find(option => option.plan === nextPlan)?.settingId || "");
      setOptionsLoaded(true);
    }).catch(() => {
      if (!active) return;
      setOptionsLoaded(true);
      setMessage(t("Unable to read the active on-chain payment options right now.", "暂时无法读取当前链上付款项目。"));
    });
    return () => { active = false; };
  }, [initialLanguageCode, initialPlan, lockedCourseId, t]);

  const availablePlanIds = useMemo(() => smartPayAvailablePlans(options), [options]);
  const plans = useMemo(() => (status.plans || []).map(item => ({ ...item, price: item.price ? `$${item.price}` : "—" })), [status.plans]);
  const availablePlans = useMemo(() => plans.filter(item => availablePlanIds.includes(item.id)), [availablePlanIds, plans]);
  const planOptions = useMemo(() => smartPayOptionsForPlan(options, plan), [options, plan]);
  const selectedOption = planOptions.find(option => option.settingId === settingId) || planOptions[0] || null;
  const activeCourseId = selectedOption?.classId || lockedCourseId || "";
  const selected = (status.cryptoSettings || []).find(item => item.id === selectedOption?.settingId) || null;
  const selectedPlan = plans.find(item => item.id === plan) || { id: plan, months: 3, price: "—", amountCents: 0 };
  const nativeTokenSymbol = selected ? walletChain(selected).nativeCurrency.symbol : "Gas";
  const smartPay3Offer = selectedOption?.smartPay3Offer || null;
  const smartPay3ShowsPrimary = Boolean(smartPay3Offer) && (smartPay3Preflight
    ? (!smartPay3UsingCombo || BigInt(smartPay3Offer!.primaryTokenAmountAtomic) > 0n)
    : smartPay3Offer!.primaryPercent > 0);
  const smartPay3ShowsSecondary = Boolean(smartPay3Offer) && (smartPay3Preflight
    ? (smartPay3UsingCombo && BigInt(smartPay3Offer!.secondaryTokenAmountAtomic) > 0n)
    : smartPay3Offer!.secondaryPercent > 0);
  const walletOfferEligible = Boolean(connected && smartPay3UsingCombo && smartPay3Preflight?.eligibilityMet);
  const selectedDisplayAmount = selectedOption
    ? smartPayCheckoutDisplayAmount(selectedOption, walletOfferEligible)
    : "";

  const ensureLogin = () => {
    if (!status.signedIn) {
      const returnTo = lockedCourseId
        ? `/${locale}/classes/${lockedCourseId}/pay/crypto?language=${initialLanguageCode}&months=3`
        : `/${locale}/programs/${initialLanguageCode}/pay/crypto?level=${plan}`;
      window.location.assign(`/${locale}/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
      return false;
    }
    return true;
  };

  async function saveWallet(value: string) {
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ walletAddress: value })
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error || "SAVE_FAILED");
    }
    await loadStatus();
  }

  async function connectWallet() {
    if (!selected || !selectedOption || !ensureLogin()) return;
    try {
      setBusy("connect");
      setMessage("");
      setSmartPay3Preflight(null);
      const result = await connectEvmWallet({
        setting: selected,
        projectId: SMARTLINGO_WALLET_CONNECT.projectId,
        appName: SMARTLINGO_WALLET_CONNECT.checkout.appName,
        description: SMARTLINGO_WALLET_CONNECT.checkout.description,
        scriptId: SMARTLINGO_WALLET_CONNECT.scriptId
      });
      await assertProviderChain(result.provider, selectedOption.chainId);
      await saveWallet(result.address);
      setWalletProvider(result.provider);
      setWallet(result.address);
      setConnected(true);
      setDirect(false);
      await refreshConnectedPreflight(result.provider, result.address);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setMessage(reason.includes("another account")
        ? t("This wallet belongs to another account with subscription history. Contact an administrator if it needs correction.", "此钱包已属于有订阅历史的其他账户，无法绑定；如需更正请联系管理员。")
        : t("Could not connect the wallet. Scan the QR code or approve SmartLingo in your wallet.", "无法连接钱包。请扫描二维码或在钱包中允许 SmartLingo 连接。"));
    } finally {
      setBusy("");
    }
  }

  async function preparePayment() {
    if (!selectedOption) throw new Error("RULE_UNAVAILABLE");
    const response = await fetch("/api/billing/crypto/smartpay/prepare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settingId: selectedOption.settingId, classId: activeCourseId })
    });
    const data = await response.json().catch(() => ({})) as { option?: SmartPayCheckoutOption; refId?: string; error?: string };
    if (!response.ok || !data.option || !/^[A-HJ-NP-Z2-9]{6}$/.test(data.refId || "")) {
      throw new Error(data.error || "RULE_UNAVAILABLE");
    }
    return { ...data.option, refId: data.refId! } as PreparedCheckoutOption;
  }

  async function lookupExistingPayment(context: PaymentLookupContext) {
    if (!selectedOption) throw new Error("RULE_UNAVAILABLE");
    const response = await fetch("/api/billing/crypto/find-payment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ classId: activeCourseId, settingId: selectedOption.settingId, includeClaimed: includeClaimedPaymentForLookup(context) })
    });
    const data = await response.json().catch(() => ({})) as ExistingPayment & { error?: string };
    if (response.status === 404) return null;
    if (!response.ok || !data.txHash) throw new Error(data.error || "PAYMENT_LOOKUP_FAILED");
    return data;
  }

  async function reconcileExistingPayment(payment: ExistingPayment) {
    if (!selectedOption) return;
    setBusy("verify");
    try {
      if (payment.claimed && payment.currentPeriodEnd) {
        setConfirmedUntil(payment.currentPeriodEnd);
        setExistingPayment(payment);
        setPendingPaymentHash("");
        setMessage(t("This payment is already confirmed. The subscription is active through {date}.", "该付款已经确认，订阅至 {date}。")
          .replace("{date}", new Date(payment.currentPeriodEnd * 1000).toLocaleDateString(locale)));
        return;
      }
      const response = payment.paymentId
        ? await fetch("/api/billing/crypto/smartpay/claim", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ settingId: selectedOption.settingId, paymentId: payment.paymentId, classId: activeCourseId })
        })
        : null;
      const directResult = response
        ? await response.json().catch(() => ({})) as { verified?: boolean; currentPeriodEnd?: number | null; error?: string }
        : null;
      const result = response?.ok && directResult?.verified
        ? directResult
        : (await verifyCryptoPaymentWithConfirmations({
          plan,
          classId: activeCourseId,
          settingId: selectedOption.settingId,
          txHash: payment.txHash,
          onRetry: ({ retryNumber }) => setMessage(t(
            "Reconciliation is not ready. Retry {retryNumber} of 3 will run in 10 seconds.",
            "核对暂未完成；10 秒后进行第 {retryNumber} / 3 次重试。",
          ).replace("{retryNumber}", String(retryNumber)))
        })).data;
      if (!result.verified) throw new Error(result.error || directResult?.error || "PAYMENT_VERIFICATION_FAILED");
      const currentPeriodEnd = result.currentPeriodEnd || payment.currentPeriodEnd || null;
      setExistingPayment({ ...payment, claimed: true, verified: true, currentPeriodEnd });
      setPendingPaymentHash("");
      setConfirmedUntil(currentPeriodEnd);
      setMessage(currentPeriodEnd
        ? t("Payment confirmed. The subscription is active through {date}.", "付款已确认，订阅至 {date}。")
          .replace("{date}", new Date(currentPeriodEnd * 1000).toLocaleDateString(locale))
        : t("Payment confirmed. The subscription is now active.", "付款已确认，订阅现已生效。"));
      await loadStatus();
    } catch {
      setMessage(t("Unable to reconcile the existing payment right now.", "暂时无法核对已有付款。"));
    } finally {
      setBusy("");
    }
  }

  async function readSmartPay3PreflightForAmounts(
    provider: EthereumProvider,
    address: string,
    prepared: PreparedCheckoutOption,
    primaryRequired: bigint,
    secondaryRequired: bigint
  ) {
    const offer = prepared.smartPay3Offer;
    if (!offer) throw new Error("SMARTPAY3_RULE_UNAVAILABLE");
    return readSmartPay3WalletPreflight({
      provider,
      wallet: address as Address,
      contractAddress: prepared.contractAddress as Address,
      primaryTokenAddress: offer.primaryTokenAddress as Address,
      secondaryTokenAddress: offer.secondaryTokenAddress as Address,
      primaryRequired,
      secondaryRequired,
      minimumSecondaryBalance: BigInt(offer.minimumSecondaryBalanceAtomic),
      mainId: prepared.mainId,
      secondId: prepared.secondId,
      refId: prepared.refId
    });
  }

  async function readCurrentSmartPay3Preflight(
    provider: EthereumProvider,
    address: string,
    prepared: PreparedCheckoutOption,
    forceFullUsdt = false
  ) {
    const offer = prepared.smartPay3Offer;
    if (!offer) throw new Error("SMARTPAY3_RULE_UNAVAILABLE");
    if (!forceFullUsdt && offer.primaryPercent < 100) {
      const combo = await readSmartPay3PreflightForAmounts(provider, address, prepared,
        BigInt(offer.primaryTokenAmountAtomic), BigInt(offer.secondaryTokenAmountAtomic));
      if (offer.primaryPercent === 0 || combo.eligibilityMet) return { preflight: combo, usingCombo: true };
    }
    return {
      preflight: await readSmartPay3PreflightForAmounts(provider, address, prepared, BigInt(prepared.tokenAmountAtomic), 0n),
      usingCombo: false
    };
  }

  async function refreshConnectedPreflight(provider: EthereumProvider, address: string) {
    setPreflightBusy(true);
    try {
      const prepared = await preparePayment();
      const offer = prepared.smartPay3Offer;
      if (!offer) throw new Error("SMARTPAY3_RULE_UNAVAILABLE");
      const result = await readCurrentSmartPay3Preflight(provider, address, prepared);
      setSmartPay3Preflight(result.preflight);
      setSmartPay3UsingCombo(result.usingCombo);
      setMessage(!result.preflight.primaryEnough
          ? t("The wallet {token} balance is insufficient. No approval or payment will be sent.", "钱包 {token} 余额不足；不会发送授权或付款交易。").replace("{token}", offer.primaryTokenSymbol)
          : !result.preflight.eligibilityMet
            ? t("The wallet lacks the required GLC balance or 1-billion-GLC threshold. No approval or payment will be sent.", "钱包 GLC 余额或 10 亿 GLC 门槛不足；不会发送授权或付款交易。")
            : result.preflight.gasEnough === false
              ? t("The wallet does not have enough gas token. No transaction will be sent.", "钱包 Gas 代币不足；不会发送交易。")
              : result.usingCombo
                ? t("The wallet meets the GLC threshold. The {amount} two-token offer is available, and the actual balances will be confirmed before payment.", "钱包 GLC 余额达到门槛，已提供 {amount} 双币付款方案；付款前会再次确认实际余额。").replace("{amount}", smartPayCheckoutDisplayAmount(prepared, true))
                : offer.mode === "single"
                  ? t("This payment will use 100% {token}. The balance will be shown again before payment.", "本次付款将收取 100% {token}；付款前会显示余额并再次确认。").replace("{token}", offer.primaryTokenSymbol)
                  : t("GLC is insufficient or the ratio is 100%; this payment will use 100% USDT only.", "GLC 不足或比例为 100%；本次付款将只收取 100% USDT。"));
    } catch {
      setSmartPay3Preflight(null);
      setMessage(t("Unable to read wallet balances or estimate gas right now.", "暂时无法读取钱包余额或预估 Gas。"));
    } finally {
      setPreflightBusy(false);
    }
  }

  async function sendPayment() {
    if (!selected || !selectedOption || !wallet || !ensureLogin()) return;
    const provider = walletProvider || (window as unknown as { ethereum?: EthereumProvider }).ethereum;
    if (!provider) {
      setMessage(t("No connected wallet was detected.", "未检测到已连接的钱包。"));
      return;
    }
    let submittedHash = "";
    try {
      setBusy("send");
      setMessage(t("Checking this wallet for an unreconciled matching payment…", "正在检查该钱包是否有尚未入账的同项目付款…"));
      const previous = await lookupExistingPayment("new-payment");
      if (previous) {
        setExistingPayment(previous);
        setTxHash(previous.txHash);
        setMessage(t("An unreconciled payment for this option was found. Reconcile it first to avoid paying twice.", "已找到尚未入账的同项目付款。请先核对该付款，避免重复支付。"));
        return;
      }
      setExistingPayment(null);
      setConfirmedUntil(null);
      setMessage(t("Rechecking the on-chain payment rule with the server…", "正在通过服务器重新核对链上付款规则…"));
      const prepared = await preparePayment();
      await assertProviderChain(provider, prepared.chainId);
      const offer = prepared.smartPay3Offer;
      if (!offer) throw new Error("RULE_UNAVAILABLE");
        const mode = await readCurrentSmartPay3Preflight(provider, wallet, prepared);
        let preflight = mode.preflight;
        setSmartPay3Preflight(preflight);
        setSmartPay3UsingCombo(mode.usingCombo);
        const primaryRequired = mode.usingCombo ? BigInt(offer.primaryTokenAmountAtomic) : BigInt(prepared.tokenAmountAtomic);
        const secondaryRequired = mode.usingCombo ? BigInt(offer.secondaryTokenAmountAtomic) : 0n;
        if (!preflight.primaryEnough) throw new Error("INSUFFICIENT_TOKEN_BALANCE");
        if (!preflight.eligibilityMet) throw new Error("INSUFFICIENT_GLC_BALANCE");
        if (preflight.gasEnough === false) throw new Error("INSUFFICIENT_NATIVE_BALANCE");
        if (preflight.simulationError || !preflight.gasLimit) throw new Error("PAYMENT_SIMULATION_FAILED");
        for (let approvals = 0; preflight.nextAction !== "pay" && approvals < 2; approvals += 1) {
          const primary = preflight.nextAction === "approve-primary";
          const tokenAddress = (primary ? offer.primaryTokenAddress : offer.secondaryTokenAddress) as Address;
          const amount = primary ? primaryRequired : secondaryRequired;
          const symbol = primary ? offer.primaryTokenSymbol : offer.secondaryTokenSymbol;
          setMessage(t("Confirm the {token} approval in your wallet.", "请在钱包确认 {token} 授权。").replace("{token}", symbol));
          const approvalData = encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [prepared.contractAddress as Address, amount] });
          const approvalHash = await provider.request({ method: "eth_sendTransaction", params: [{ from: wallet, to: tokenAddress, data: approvalData, gas: preflight.gasLimit }] });
          if (typeof approvalHash !== "string") throw new Error("NO_APPROVAL_HASH");
          await waitForTransactionReceipt(provider, approvalHash);
          preflight = await readSmartPay3PreflightForAmounts(provider, wallet, prepared, primaryRequired, secondaryRequired);
          if (!preflight.primaryEnough || !preflight.eligibilityMet || preflight.gasEnough === false
            || preflight.simulationError || !preflight.gasLimit) throw new Error("PAYMENT_SIMULATION_FAILED");
        }
        if (preflight.nextAction !== "pay") throw new Error("PAYMENT_SIMULATION_FAILED");
        setMessage(primaryRequired > 0n && secondaryRequired > 0n
          ? t("Both token approvals are ready. Confirm the two-token payment in your wallet.", "两种代币授权已确认；请在钱包确认双币付款。")
          : secondaryRequired > 0n
            ? t("{token} approval is ready. Confirm the full-{token} payment in your wallet.", "{token} 授权已确认；请在钱包确认全额 {token} 付款。").replaceAll("{token}", offer.secondaryTokenSymbol)
            : t("{token} approval is ready. Confirm the full-{token} payment in your wallet.", "{token} 授权已确认；请在钱包确认全额 {token} 付款。").replaceAll("{token}", offer.primaryTokenSymbol));
        const payData = encodeFunctionData({
          abi: SMARTPAY3_ABI,
          functionName: "pay",
          args: [offer.primaryTokenAddress as Address, offer.secondaryTokenAddress as Address, prepared.mainId, prepared.secondId, primaryRequired, prepared.refId]
        });
        const hash = await provider.request({ method: "eth_sendTransaction", params: [{ from: wallet, to: prepared.contractAddress, data: payData, gas: preflight.gasLimit }] });
        if (typeof hash !== "string") throw new Error("NO_HASH");
        submittedHash = hash;
        setTxHash(hash);
        setPendingPaymentHash(hash);
        await waitForTransactionReceipt(provider, hash);
        setMessage(t("The payment is on-chain. Reading the transaction record and updating the subscription.", "付款已上链，正在读取交易记录并更新订阅。"));
        await verify(hash, true);
        return;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setMessage(submittedHash
        ? t("The payment was submitted ({hash}…), but subscription reconciliation is still pending. Do not pay again; use “Find or verify an existing payment” to continue.", "付款请求已发送（{hash}…），但订阅尚未完成核对。请勿重复付款；使用“查找或核对已有付款”继续。").replace("{hash}", submittedHash.slice(0, 10))
        : reason === "WRONG_CHAIN"
        ? t("Your wallet is on a different network. Switch to the selected network and retry.", "钱包当前网络与所选付款网络不一致，请切换网络后重试。")
        : reason === "PAYMENT_LOOKUP_FAILED" || /lookup|查找|读取/i.test(reason)
          ? t("The existing-payment check could not complete, so the wallet was not opened and no transaction was sent. Retry later.", "付款前无法完成已有付款检查，因此没有打开钱包或发送交易。请稍后重试。")
        : reason === "RULE_UNAVAILABLE" || reason.includes("not currently enabled")
          ? t("This option is no longer available in the current on-chain list. Go back and choose again.", "该付款项目已不在当前链上可用清单中，请返回重新选择。")
          : reason === "INSUFFICIENT_TOKEN_BALANCE"
            ? t("The wallet does not have enough {token}. No approval or payment was sent.", "钱包 {token} 余额不足，未发送授权或付款交易。").replace("{token}", selectedOption.tokenSymbol)
            : reason === "INSUFFICIENT_GLC_BALANCE"
              ? t("The wallet lacks the required GLC balance or 1-billion-GLC threshold. No approval or payment was sent.", "钱包 GLC 余额或 10 亿 GLC 门槛不足，未发送授权或付款交易。")
            : reason === "INSUFFICIENT_NATIVE_BALANCE"
              ? t("The wallet does not have enough {token} for gas. No transaction was sent.", "钱包 {token} Gas 余额不足，未发送交易。").replace("{token}", walletChain(selected).nativeCurrency.symbol)
              : reason === "PAYMENT_SIMULATION_FAILED"
                  ? t("The payment simulation reverted, so wallet confirmation was not opened. This is not a gas-balance warning; ask an administrator to inspect the contract.", "付款模拟已回滚，未打开钱包确认；这不是 Gas 余额提示。请管理员检查合约状态。")
                  : t("The transaction was not sent or completed. Check wallet approval, balance, and network.", "交易未发送或未完成。请检查钱包授权、余额和网络。"));
      void loadOptions().catch(() => undefined);
    } finally {
      setBusy("");
    }
  }

  async function refreshBalance() {
    if (!selected || !wallet) return;
    setBusy("balance");
    setMessage("");
    const response = await fetch("/api/billing/crypto/balance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settingId: selected.id })
    });
    const data = await response.json().catch(() => ({})) as { amount?: string; symbol?: string; error?: string };
    if (response.ok) setBalance(`${data.amount} ${data.symbol}`);
    else setMessage(data.error || t("Unable to read the balance.", "暂时无法读取余额。"));
    setBusy("");
  }

  async function verify(candidateHash?: string, afterSuccessfulPayment = false) {
    if (!selectedOption || !wallet) return;
    setBusy("verify");
    let hash = (candidateHash || txHash).trim().toLowerCase();
    if (!/^0x[a-f0-9]{64}$/.test(hash)) {
      let existing: ExistingPayment | null = null;
      try {
        existing = await lookupExistingPayment("manual-reconciliation");
      } catch {
        setMessage(t("Unable to look up a payment right now.", "暂时无法查找付款。"));
        setBusy("");
        return;
      }
      if (!existing) {
        setMessage(t("No matching payment was found.", "尚未找到符合条件的付款。"));
        setBusy("");
        return;
      }
      setExistingPayment(existing);
      if (existing.paymentId) {
        await reconcileExistingPayment(existing);
        return;
      }
      hash = existing.txHash;
      setTxHash(hash);
    }
    setMessage(t("Transaction found. Waiting for confirmations and updating your subscription…", "交易已找到，正在等待链上确认并更新订阅…"));
    const { data } = await verifyCryptoPaymentWithConfirmations({
      plan,
      classId: activeCourseId,
      settingId: selectedOption.settingId,
      txHash: hash,
      initialDelayMs: afterSuccessfulPayment ? 6_000 : 0,
      onInitialWait: () => setMessage(t("The payment is confirmed on-chain. The first transaction-record check will run in 6 seconds. Do not pay again.", "付款已确认上链；6 秒后首次读取交易记录。请勿重复付款。")),
      onRetry: ({ retryNumber }) => setMessage(t(
        "The on-chain record is not ready. Retry {retryNumber} of 3 will run in 10 seconds. Do not pay again.",
        "链上记录尚未完成核对；10 秒后进行第 {retryNumber} / 3 次重试。请勿重复付款。",
      ).replace("{retryNumber}", String(retryNumber)))
    });
    if (data.verified) {
      setPendingPaymentHash("");
      setConfirmedUntil(data.currentPeriodEnd || null);
      setExistingPayment(current => current ? { ...current, claimed: true, verified: true, currentPeriodEnd: data.currentPeriodEnd } : {
        txHash: hash,
        paymentId: data.paymentId || undefined,
        claimed: true,
        verified: true,
        currentPeriodEnd: data.currentPeriodEnd
      });
      setMessage(data.currentPeriodEnd
        ? t("Transaction confirmed. The subscription is active through {date}.", "交易已确认，订阅至 {date}。")
          .replace("{date}", new Date(data.currentPeriodEnd * 1000).toLocaleDateString(locale))
        : t("The transaction record was verified. Your subscription is active.", "交易记录已验证，订阅现已生效。"));
      await loadStatus();
    } else {
      setPendingPaymentHash(hash);
      setMessage(t(
        "Payment {hash}… was submitted, but three delayed reconciliation attempts did not complete. Do not pay again; use “Retry submitted payment reconciliation” later.",
        "付款 {hash}… 已发送，但三次延迟核对仍未完成。请勿重复付款；稍后点击“重新核对已发送付款”。",
      ).replace("{hash}", hash.slice(0, 10)));
    }
    setBusy("");
  }

  async function saveDirect() {
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      setMessage(t("Enter a valid EVM wallet address.", "请输入有效的 EVM 钱包地址。"));
      return;
    }
    try {
      setBusy("wallet");
      await saveWallet(wallet);
      setMessage(t("Payer wallet saved.", "付款钱包已保存。"));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      setMessage(reason.includes("another account")
        ? t("This wallet belongs to another account with subscription history. Contact an administrator if it needs correction.", "此钱包已属于有订阅历史的其他账户，无法绑定；如需更正请联系管理员。")
        : t("Could not save the payer wallet.", "付款钱包无法保存。"));
    } finally {
      setBusy("");
    }
  }

  function choosePlan(nextPlan: Plan) {
    setPlan(nextPlan);
    setSettingId(options.find(option => option.plan === nextPlan)?.settingId || "");
    setSmartPay3Preflight(null);
    setSmartPay3UsingCombo(false);
    setExistingPayment(null);
    setPendingPaymentHash("");
    setConfirmedUntil(null);
  }

  return <div className="crypto-flow">
    <Link className="back-link" href={lockedCourseId ? `/${locale}/classes/${lockedCourseId}` : `/${locale}/programs/${initialLanguageCode}`}>← {t("Back to course", "返回课程套餐")}</Link>
    <div className="page-heading centered"><p className="eyebrow"><span/> {t("CRYPTO PAYMENT", "加密货币付款")}</p><h1>{t("Subscribe to this course with crypto", "使用加密货币订阅课程")}</h1><p>{t("The course, tokens, and amounts come only from this site's available on-chain payment rules. We never request a private key or seed phrase.", "课程、代币和金额全部来自本站当前可用的链上付款规则。不会要求私钥或助记词。")}</p></div>
    <ol className="payment-steps"><li className={step >= 1 ? "active" : ""}>1. {t("Product", "选择服务期")}</li><li className={step >= 2 ? "active" : ""}>2. {t("Crypto", "选择代币")}</li><li className={step >= 3 ? "active" : ""}>3. {t("Wallet", "付款钱包")}</li></ol>

    {step === 1 ? <section className="crypto-box flow-card">
      <h2>{t("Step 1: Choose a subscription term", "步骤 1：选择订阅服务期")}</h2>
      <p className="flow-intro">{t("Only terms with at least one available on-chain payment option are shown.", "这里只显示至少有一个可用链上付款项目的服务期。")}</p>
      {!optionsLoaded ? <p>{t("Loading on-chain payment options…", "正在读取链上付款项目…")}</p> : availablePlans.length ? <div className="radio-list">{availablePlans.map(item => <label key={item.id}><input type="radio" checked={plan === item.id} onChange={() => choosePlan(item.id)}/><span className="plan-option-copy"><strong>{subscriptionTerm(item.id, item.months, t)}</strong><small>{t("Available on-chain", "链上可付款")}</small></span><span className="plan-option-price"><b>{item.price}</b><small>{t("Payment options available", "有可用付款选项")}</small></span></label>)}</div> : <p className="billing-message">{t("There is no available subscription payment option right now. Wait for an administrator to confirm the on-chain payment rules.", "当前没有可用的订阅付款项目。请等待管理员确认链上付款规则。")}</p>}
      <button className="button primary" disabled={!availablePlans.length} onClick={() => setStep(2)}>{t("Next: choose crypto", "下一步：选择代币")} →</button>
    </section> : null}

    {step === 2 ? <section className="crypto-box flow-card">
      <button className="text-button" onClick={() => setStep(1)}>← {t("Back", "上一步")}</button>
      <h2>{t("Step 2: Choose an on-chain payment option", "步骤 2：选择链上付款项目")}</h2>
      <p className="flow-intro">{t("Only enabled on-chain payment rules are shown. Current contract values are authoritative for token amounts.", "这里只显示链上已启用的付款规则；代币金额以合约当前返回值为准。")}</p>
      {planOptions.length ? <div className="radio-list">{planOptions.map(option => {
        return <label key={option.key}><input type="radio" checked={selectedOption?.key === option.key} onChange={() => { setSettingId(option.settingId); setSmartPay3Preflight(null); setSmartPay3UsingCombo(false); setExistingPayment(null); setPendingPaymentHash(""); setConfirmedUntil(null); }}/><span className="plan-option-copy"><strong>{option.tokenSymbol}</strong><small>{option.chainName}</small></span><span className="plan-option-price"><b>{smartPayCheckoutDisplayAmount(option)}</b><small>{t("On-chain price", "链上原价")}</small></span></label>;
      })}</div> : <p>{t("This term has no current on-chain payment option.", "此服务期当前没有链上付款项目。")}</p>}
      <button className="button primary" disabled={!selectedOption} onClick={() => { if (!ensureLogin()) return; setStep(3); if (connected && walletProvider && wallet) void refreshConnectedPreflight(walletProvider, wallet); }}>{t("Next: payment wallet", "下一步：付款钱包")} →</button>
    </section> : null}

    {step === 3 && selected && selectedOption ? <section className="crypto-box flow-card">
      <button className="text-button" onClick={() => setStep(2)}>← {t("Back", "上一步")}</button>
      <h2>{t("Step 3: Connect or enter a payer wallet", "步骤 3：连接或填写付款钱包")}</h2>
      <div className="payment-summary"><strong>{subscriptionTerm(plan, selectedPlan.months, t)}</strong><span>{selectedDisplayAmount} · {selectedOption.chainName}</span></div>
      <dl><div><dt>{t("Payment contract", "付款合约")}</dt><dd><a className="chain-link" href={explorerUrl(selectedOption.chainId, "address", selectedOption.contractAddress) || "#"} target="_blank" rel="noreferrer">{selectedOption.contractAddress}</a></dd></div><div><dt>{t("Primary token contract", "主代币合约")}</dt><dd><a className="chain-link" href={explorerUrl(selectedOption.chainId, "token", selectedOption.tokenAddress) || "#"} target="_blank" rel="noreferrer">{selectedOption.tokenAddress}</a></dd></div>{selectedOption.smartPay3Offer?.mode === "dual" ? <div><dt>{t("GLC contract", "GLC 合约")}</dt><dd><a className="chain-link" href={explorerUrl(selectedOption.chainId, "token", selectedOption.smartPay3Offer.secondaryTokenAddress) || "#"} target="_blank" rel="noreferrer">{selectedOption.smartPay3Offer.secondaryTokenAddress}</a></dd></div> : null}</dl>
      <p className="flow-intro">{t("The server rereads the current rule, token balances, and gas first. After validation passes, the wallet directly requests any required approval or payment. The TransactionID then updates the subscription automatically.", "服务器会重新读取当前规则、实际代币余额和 Gas；校验通过后会直接请求钱包完成必要授权或付款。成功后自动读取 TransactionID 并更新订阅。")}</p>
      {!direct ? <>
        {connected ? <div className="direct-payment">
          <p className="connected-wallet-line">{t("Connected {wallet}", "已连接 {wallet}").replace("{wallet}", wallet)}</p>
          <div className="wallet-payment-preflight" aria-label={t("Pre-payment balance and gas check", "付款前余额与 Gas 检查")}>
            {smartPay3Offer ? <>
              {smartPay3ShowsPrimary ? <div><span>{t("Wallet {token} balance", "钱包 {token} 余额").replace("{token}", smartPay3Offer.primaryTokenSymbol)}</span><strong>{smartPay3Preflight ? `${displayAtomic(smartPay3Preflight.primaryBalanceAtomic, smartPay3Offer.primaryTokenDecimals)} ${smartPay3Offer.primaryTokenSymbol}` : (preflightBusy ? "…" : "—")}</strong>{smartPay3Preflight ? <small className={smartPay3Preflight.primaryEnough ? "rule-enabled" : "rule-disabled"}>{smartPay3Preflight.primaryEnough ? t("Enough", "余额足够") : t("Insufficient", "余额不足")}</small> : null}</div> : null}
              {smartPay3ShowsSecondary ? <div><span>{t("Wallet {token} balance", "钱包 {token} 余额").replace("{token}", smartPay3Offer.secondaryTokenSymbol)}</span><strong>{smartPay3Preflight ? `${displayAtomic(smartPay3Preflight.secondaryBalanceAtomic, smartPay3Offer.secondaryTokenDecimals)} ${smartPay3Offer.secondaryTokenSymbol}` : (preflightBusy ? "…" : "—")}</strong>{smartPay3Preflight ? <small className={smartPay3Preflight.eligibilityMet ? "rule-enabled" : "rule-disabled"}>{smartPay3Preflight.eligibilityMet ? t("Balance & threshold met", "余额与门槛足够") : t("Balance or threshold insufficient", "余额或门槛不足")}</small> : null}</div> : null}
              <div><span>{t("Wallet {token} gas balance", "钱包 {token} Gas 余额").replace("{token}", nativeTokenSymbol)}</span><strong>{smartPay3Preflight ? `${displayAtomic(smartPay3Preflight.nativeBalanceAtomic, 18, 8)} ${nativeTokenSymbol}` : (preflightBusy ? "…" : "—")}</strong>{smartPay3Preflight ? <small className={smartPay3Preflight.gasEnough === false ? "rule-disabled" : "rule-enabled"}>{smartPay3Preflight.gasEnough === false ? t("Insufficient gas", "Gas 不足") : smartPay3Preflight.gasEnough === true ? t("Enough gas", "Gas 足够") : t("Awaiting estimate", "等待交易预估")}</small> : null}</div>
              <div><span>{t("Next wallet action", "下一笔钱包操作")}</span><strong>{smartPay3Preflight ? (smartPay3Preflight.nextAction === "approve-primary" ? `${smartPay3Offer.primaryTokenSymbol} approval` : smartPay3Preflight.nextAction === "approve-secondary" ? `${smartPay3Offer.secondaryTokenSymbol} approval` : t("Payment", "付款")) : "—"}</strong><small>{smartPay3Preflight?.gasLimit ? `Gas limit ${BigInt(smartPay3Preflight.gasLimit).toString()} · ≤ ${displayAtomic(smartPay3Preflight.estimatedFeeAtomic || "0", 18, 8)} ${nativeTokenSymbol}` : smartPay3Preflight?.simulationError ? t("Simulation reverted; not sent", "模拟回滚，不会发送") : t("Not estimated", "尚未预估")}</small></div>
            </> : null}
          </div>
          <button type="button" className="button ghost" disabled={preflightBusy || Boolean(busy)} onClick={() => walletProvider && void refreshConnectedPreflight(walletProvider, wallet)}>{preflightBusy ? "…" : t("Refresh balances & gas", "刷新余额与 Gas")}</button>
          {existingPayment ? <div className={`existing-crypto-payment${existingPayment.claimed ? " confirmed" : ""}`} role="status">
            <strong>{existingPayment.claimed ? t("Confirmed payment found", "已找到已确认付款") : t("Unreconciled payment found", "已找到尚未入账付款")}</strong>
            <span>{existingPayment.timestamp ? new Date(existingPayment.timestamp * 1000).toLocaleString(locale) : t("On-chain payment", "链上付款")} · {existingPayment.txHash.slice(0, 12)}…</span>
            {existingPayment.currentPeriodEnd ? <small>{t("Current subscription through {date}", "当前订阅至 {date}").replace("{date}", new Date(existingPayment.currentPeriodEnd * 1000).toLocaleDateString(locale))}</small> : null}
            {existingPaymentAction(existingPayment.claimed) === "reconcile" ? <button type="button" className="button primary" disabled={Boolean(busy)} onClick={() => void reconcileExistingPayment(existingPayment)}>{busy === "verify" ? "…" : t("Reconcile unreconciled payment", "核对尚未入账付款")}</button> : null}
          </div> : pendingPaymentHash ? <div className="existing-crypto-payment pending" role="status">
            <strong>{t("Payment submitted; reconciliation pending", "付款已发送，等待核对")}</strong>
            <span>{pendingPaymentHash.slice(0, 12)}…</span>
            <small>{t("Do not pay again. The system already retried three times at 10-second intervals.", "请勿重复付款。系统已按 10 秒间隔重试三次。")}</small>
            <button type="button" className="button primary" disabled={Boolean(busy)} onClick={() => void verify(pendingPaymentHash)}>{busy === "verify" ? "…" : t("Retry submitted payment reconciliation", "重新核对已发送付款")}</button>
          </div> : confirmedUntil ? <div className="existing-crypto-payment confirmed" role="status"><strong>{t("Payment and subscription confirmed", "付款与订阅已确认")}</strong><small>{t("Subscription through {date}", "订阅至 {date}").replace("{date}", new Date(confirmedUntil * 1000).toLocaleDateString(locale))}</small></div> : <button className="button primary" disabled={Boolean(busy) || preflightBusy} onClick={() => void sendPayment()}>{busy === "send" ? "…" : t("Check balances & pay", "核对余额并付款")}</button>}
        </div> : <button className="button primary" disabled={busy === "connect"} onClick={() => void connectWallet()}>{busy === "connect" ? "…" : t("Connect wallet", "连接钱包")}</button>}
        <button className="text-button direct-link" onClick={() => setDirect(true)}>{t("Find or verify an existing payment", "查找或核对已有付款")} →</button>
      </> : <div className="direct-payment"><label><span>{t("Your payer wallet", "您的付款钱包")}</span><input value={wallet} onChange={event => setWallet(event.target.value.trim())} placeholder="0x…"/></label><button className="button ghost" disabled={busy === "wallet"} onClick={() => void saveDirect()}>{t("Save payer wallet", "保存付款钱包")}</button><p className="wallet-balance">{balance ? `${t("Wallet token balance", "钱包代币余额")} · ${balance}` : t("Wallet token balance not loaded", "尚未读取钱包代币余额")} <button className="inline-icon" title={t("Refresh balance", "刷新余额")} aria-label={t("Refresh balance", "刷新余额")} onClick={() => void refreshBalance()} disabled={busy === "balance"}>{busy === "balance" ? "…" : "↻"}</button></p><label><span>{t("Transaction hash (optional)", "交易哈希（可选）")}</span><input value={txHash} onChange={event => setTxHash(event.target.value.trim())} placeholder="0x…"/><small>{t("Leave blank to find a recent matching on-chain payment for the saved wallet.", "留空会按已保存钱包查找近期匹配的链上付款。")}</small></label><button className="button primary" disabled={busy === "verify" || !wallet} onClick={() => void verify()}>{busy === "verify" ? "…" : t("Read transaction & update {months}-month subscription", "读取交易并更新 {months} 个月订阅").replace("{months}", String(selectedPlan.months))}</button></div>}
      {message ? <p className="billing-message" role="status">{message}</p> : null}
    </section> : null}
  </div>;
}
