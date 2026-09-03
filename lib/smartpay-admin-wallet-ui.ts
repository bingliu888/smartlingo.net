import type { SiteLanguage } from "./site-locale";

export function smartPayOwnerWalletButton(locale: SiteLanguage, busy: string, connectedWallet = "") {
  return {
    label: locale === "zh" ? "连接钱包" : "Connect wallet",
    disabled: Boolean(busy),
    visible: !connectedWallet
  };
}

export function smartPayOwnerConnectionError(contractOwner: string, ownerField: string, connectedWallet: string) {
  if (contractOwner.toLowerCase() !== connectedWallet.toLowerCase()) return "NOT_OWNER";
  if (!/^0x[a-fA-F0-9]{40}$/.test(ownerField) || ownerField.toLowerCase() !== connectedWallet.toLowerCase()) {
    return "OWNER_FIELD_MISMATCH";
  }
  return null;
}

export function smartPayOwnerActionFeedback(locale: SiteLanguage, reason: string) {
  const zh = locale === "zh";
  if (reason === "NOT_OWNER") {
    return {
      message: zh ? "您连接的钱包不是 SmartPay5 Owner。" : "Your connected wallet is not the SmartPay5 owner.",
      interruptive: true,
    };
  }
  if (reason === "OWNER_FIELD_MISMATCH") {
    return {
      message: zh ? "Owner 编辑框必须与已连接钱包一致。" : "The Owner field must match the connected wallet.",
      interruptive: false,
    };
  }
  return {
    message: zh ? "链上操作未完成；请检查钱包确认和网络。" : "The on-chain action did not complete. Check the wallet confirmation and network.",
    interruptive: false,
  };
}
