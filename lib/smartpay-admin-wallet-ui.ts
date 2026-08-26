import type { SiteLanguage } from "./site-locale";

export function smartPayOwnerWalletButton(locale: SiteLanguage, busy: string, connectedWallet = "") {
  return {
    label: locale === "zh" ? "连接钱包" : "Connect wallet",
    disabled: Boolean(busy),
    visible: !connectedWallet
  };
}
