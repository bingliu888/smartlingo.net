import RTKClient from "@cloudflare/realtimekit";

export type RealtimeBrowserFacts = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  hasPeerConnection: boolean;
  hasTransceiverDirection: boolean;
};

const IOS_DEVICE = /iPad|iPhone|iPod/i;
const APPLE_WEBKIT = /AppleWebKit\//i;
const SAFARI_VERSION = /Version\/\d+(?:\.\d+)?[\s\S]*Safari\//i;
const ANDROID = /Android/i;
const CHROMIUM_VERSION = /(?:Chrome|Chromium)\/\d+/i;
const WALLET_WEBVIEW = /TokenPocket|TPWallet|MetaMaskMobile|TrustWallet|imToken|BitKeep|BitgetWallet/i;
const IOS_STANDALONE_BROWSER = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|Brave/i;
const APP_WEBVIEW = /FBAN|FBAV|Instagram|Line\/|MicroMessenger|WeChat|Twitter|GSA\/|TikTok|BytedanceWebview|Snapchat|Pinterest|LinkedInApp|Telegram|Discord|QQ\//i;

export function isMobileAppBrowser({
  userAgent,
  platform,
  maxTouchPoints,
}: Pick<RealtimeBrowserFacts, "userAgent" | "platform" | "maxTouchPoints">) {
  const ipadDesktopMode =
    /Macintosh/i.test(userAgent) &&
    (platform === "MacIntel" || /Mac/i.test(platform)) &&
    maxTouchPoints > 1;
  const iosWebView =
    APPLE_WEBKIT.test(userAgent) &&
    (IOS_DEVICE.test(userAgent) || ipadDesktopMode) &&
    !SAFARI_VERSION.test(userAgent) &&
    !IOS_STANDALONE_BROWSER.test(userAgent);
  const androidWebView =
    ANDROID.test(userAgent) &&
    (/;\s*wv\)/i.test(userAgent) || /Version\/4\.0/i.test(userAgent));
  const mobileDevice =
    IOS_DEVICE.test(userAgent) || ipadDesktopMode || ANDROID.test(userAgent);
  return (
    mobileDevice &&
    (WALLET_WEBVIEW.test(userAgent) ||
      APP_WEBVIEW.test(userAgent) ||
      iosWebView ||
      androidWebView)
  );
}

// Preserve the previous export while treating wallet browsers as one type of
// mobile app browser.
export const isWalletOrEmbeddedBrowser = isMobileAppBrowser;

/**
 * RealtimeKit selects its WebRTC handler from the UA string. Some capable
 * wallet WebViews omit Safari/Chrome identity (iPad desktop mode is the common
 * case), so the SDK throws `device not supported` after permission succeeds.
 * Only provide a compatibility identity after checking the WebRTC primitives
 * required by the matching handler.
 */
export function realtimeKitCompatibleUserAgent(facts: RealtimeBrowserFacts) {
  if (!facts.hasPeerConnection || !facts.hasTransceiverDirection) return null;
  if (!isMobileAppBrowser(facts)) return null;

  const iosLike =
    IOS_DEVICE.test(facts.userAgent) ||
    (/Macintosh/i.test(facts.userAgent) &&
      facts.maxTouchPoints > 1 &&
      (facts.platform === "MacIntel" || /Mac/i.test(facts.platform)));
  if (
    iosLike &&
    APPLE_WEBKIT.test(facts.userAgent) &&
    !SAFARI_VERSION.test(facts.userAgent)
  ) {
    return `${facts.userAgent} Version/17.0 Mobile/15E148 Safari/604.1`;
  }

  if (
    ANDROID.test(facts.userAgent) &&
    APPLE_WEBKIT.test(facts.userAgent) &&
    !CHROMIUM_VERSION.test(facts.userAgent)
  ) {
    return `${facts.userAgent} Chrome/120.0.0.0 Mobile Safari/537.36`;
  }
  return null;
}

function currentBrowserFacts(): RealtimeBrowserFacts {
  const transceiver = globalThis.RTCRtpTransceiver;
  return {
    userAgent: navigator.userAgent || "",
    platform: navigator.platform || "",
    maxTouchPoints: navigator.maxTouchPoints || 0,
    hasPeerConnection: typeof globalThis.RTCPeerConnection === "function",
    hasTransceiverDirection:
      typeof transceiver === "function" &&
      Object.prototype.hasOwnProperty.call(
        transceiver.prototype,
        "currentDirection",
      ),
  };
}

export async function initRealtimeKitClient(
  options: Parameters<typeof RTKClient.init>[0],
) {
  const compatibleUserAgent = realtimeKitCompatibleUserAgent(
    currentBrowserFacts(),
  );
  if (!compatibleUserAgent) return RTKClient.init(options);

  const originalDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    "userAgent",
  );
  try {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      get: () => compatibleUserAgent,
    });
  } catch {
    return RTKClient.init(options);
  }

  try {
    return await RTKClient.init(options);
  } finally {
    if (originalDescriptor)
      Object.defineProperty(navigator, "userAgent", originalDescriptor);
    else Reflect.deleteProperty(navigator, "userAgent");
  }
}

export function isUnsupportedRealtimeBrowser(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /device not supported|browser not supported|ERR0010/i.test(message);
}

export function openInSystemBrowser(url: string) {
  const opened = window.open(url, "_system");
  if (opened) return true;
  return Boolean(window.open(url, "_blank", "noopener,noreferrer"));
}

export function currentBrowserIsEmbedded() {
  return isMobileAppBrowser(currentBrowserFacts());
}
