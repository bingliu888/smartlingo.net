"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { interfaceText, type InterfaceLanguage } from "../lib/interface-locale";
import { prepareAvatarUpload } from "./avatar-image";
import { TextSizeControl } from "./TextSizeControl";

type Introducer = { displayName: string; status: string } | null;

function CopyIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>;
}

export function ProfileEditor({ lang, email, initialName, initialWalletAddress = "", initialRefId = "", initialAiProviderPreference = "auto", initialIntroducer, initialImageUrl = "" }: { lang: InterfaceLanguage; email: string; initialName: string; initialWalletAddress?: string; initialRefId?: string; initialAiProviderPreference?: "auto" | "openai" | "deepseek"; initialIntroducer: Introducer; initialImageUrl?: string }) {
  const t = (english: string, chinese: string) => interfaceText(lang, english, chinese);
  const [displayName, setDisplayName] = useState(initialName);
  const [walletAddress, setWalletAddress] = useState(initialWalletAddress);
  const [refId, setRefId] = useState(initialRefId);
  const [walletEditing, setWalletEditing] = useState(!initialWalletAddress);
  const [aiProviderPreference, setAiProviderPreference] = useState(initialAiProviderPreference);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);

  useEffect(() => {
    void fetch("/api/profile", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => {
        const savedWallet = result?.profile?.walletAddress;
        const savedRefId = result?.profile?.refId;
        if (typeof savedRefId === "string" && savedRefId) setRefId(savedRefId);
        if (typeof savedWallet === "string" && savedWallet) {
          setWalletAddress(savedWallet);
          setWalletEditing(false);
        }
      })
      .catch(() => undefined);
  }, [initialWalletAddress]);

  async function copyValue(value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setMessage(t("Copied.", "已复制。"));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const normalizedWallet = walletAddress.trim();
    if (normalizedWallet && !/^0x[a-fA-F0-9]{40}$/.test(normalizedWallet)) {
      setMessage(t("Enter a valid EVM wallet address beginning with 0x.", "请输入有效的 EVM 钱包地址（0x 开头）。"));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName, preferredLanguage: lang, aiProviderPreference, walletAddress: normalizedWallet }) });
      if (!response.ok) throw new Error();
      setWalletAddress(normalizedWallet);
      setWalletEditing(false);
      setMessage(t("Profile saved.", "个人资料已保存。"));
    } catch {
      setMessage(t("Could not save. Please try again.", "保存失败，请重试。"));
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(file?: File, input?: HTMLInputElement) {
    if (!file) return;
    if (input) input.value = "";
    setPhotoInputKey((value) => value + 1);
    const accepted = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!accepted.has(file.type)) {
      setMessage(t("Choose a JPG, PNG, or WebP photo.", "请选择 JPG、PNG 或 WebP 照片。"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage(t("Photo must be 5 MB or smaller.", "照片不能超过 5 MB。"));
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const avatarFile = await prepareAvatarUpload(file);
      const form = new FormData();
      form.set("file", avatarFile);
      const response = await fetch("/api/profile", { method: "POST", body: form });
      const result = await response.json() as { imageUrl?: string };
      if (!response.ok || !result.imageUrl) throw new Error();
      setImageUrl(result.imageUrl);
      setMessage(t("Profile photo updated and centered automatically.", "头像已更新并自动居中裁切。"));
    } catch {
      setMessage(t("Photo upload failed. Choose a JPG, PNG, or WebP image.", "头像上传失败，请选择 JPG、PNG 或 WebP。"));
    } finally {
      setBusy(false);
    }
  }

  return <div className="account-profile-grid">
    <form className="profile-form" onSubmit={save}>
      <div className="photo-row">
        <div className="profile-photo">{imageUrl ? <Image src={imageUrl} alt="" width={96} height={96} unoptimized/> : <span>{displayName.slice(0,1).toUpperCase()}</span>}</div>
        <label className="photo-button">{t("Upload photo", "上传头像")}<input key={photoInputKey} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => uploadPhoto(event.target.files?.[0], event.currentTarget)}/></label>
        <small>{t("JPG, PNG, or WebP · 5 MB maximum", "JPG、PNG 或 WebP，最大 5 MB")}</small>
      </div>
      <label>{t("Display name", "显示名称")}<input required minLength={2} maxLength={60} value={displayName} onChange={event => setDisplayName(event.target.value)}/></label>
      <div className="wallet-profile-field"><label>{t("Your 6-character RefID", "您的 6 位 RefID")}</label><div className="copy-field"><input readOnly value={refId}/><button type="button" className="copy-icon-button profile-copy-button" title={t("Copy RefID", "复制 RefID")} aria-label={t("Copy RefID", "复制 RefID")} onClick={() => void copyValue(refId)}><CopyIcon/></button></div><small>{t("This public ID connects a wallet payment to your account. It is not a password.", "该公开编号用于把钱包付款对应到您的账户，不是密码。")}</small></div>
      <fieldset className="ai-provider-field">
        <legend>{t("Default text model", "默认文本模型")}</legend>
        <label><input type="radio" name="ai-provider" value="auto" checked={aiProviderPreference === "auto"} onChange={() => setAiProviderPreference("auto")}/><span><b>{t("Automatic (recommended)", "自动（推荐）")}</b><small>{t("Prefer DeepSeek V4 Flash in China and OpenAI in other supported regions.", "中国优先使用 DeepSeek V4 Flash；其他地区优先使用 OpenAI。")}</small></span></label>
        <label><input type="radio" name="ai-provider" value="openai" checked={aiProviderPreference === "openai"} onChange={() => setAiProviderPreference("openai")}/><span><b>OpenAI</b><small>{t("Always use the OpenAI text model; it may be unavailable in unsupported regions.", "始终使用 OpenAI 文字模型；在不支持地区可能不可用。")}</small></span></label>
        <label><input type="radio" name="ai-provider" value="deepseek" checked={aiProviderPreference === "deepseek"} onChange={() => setAiProviderPreference("deepseek")}/><span><b>DeepSeek V4 Flash</b><small>{t("Always use DeepSeek, including for comparison testing in the United States.", "始终使用 DeepSeek，可在美国等地区进行对比测试。")}</small></span></label>
        <p>{t("This choice affects text Guru, message polishing, and learning feedback only. Images, moderation, and live voice keep their compatible specialist models.", "此选择只影响文字导师、消息润色和学习反馈。图片、安全审核与实时语音继续使用各自兼容的专用模型。")}</p>
      </fieldset>
      <div className="wallet-profile-field">
        <div><label htmlFor="profile-wallet">{t("EVM wallet", "EVM 钱包")}</label><button type="button" onClick={() => setWalletEditing(value => !value)}>{walletEditing ? t("Cancel", "取消") : walletAddress ? t("Edit", "修改") : t("Add", "添加")}</button></div>
        <div className="copy-field"><input id="profile-wallet" inputMode="text" autoComplete="off" readOnly={!walletEditing} placeholder="0x…" value={walletAddress} onChange={event => setWalletAddress(event.target.value)} /><button type="button" className="copy-icon-button profile-copy-button" disabled={!walletAddress} title={t("Copy wallet", "复制钱包地址")} aria-label={t("Copy wallet", "复制钱包地址")} onClick={() => void copyValue(walletAddress)}><CopyIcon/></button></div>
        <small>{t("Optional and used only for compatible features you choose to enable; neither platform subscriptions nor course payments require a wallet.", "可选资料，仅用于您主动启用的兼容功能；平台订阅和课程付款均不要求钱包。")}</small>
      </div>
      <button className="profile-save" disabled={busy}>{busy ? t("Saving…", "正在保存…") : t("Save profile", "保存个人资料")}</button>
      {message && <p className="profile-message" role="status">{message}</p>}
    </form>
    <aside className="account-facts">
      <article><span>{t("Sign-in email", "登录邮箱")}</span><b>{email}</b></article>
      <article><span>{t("Platform introducer relationship", "平台直接介绍关系")}</span>{initialIntroducer ? <><b>{initialIntroducer.displayName}</b><small>{t("One direct introducer is recorded; only a successful platform subscription payment may create introducer points.", "已记录一层直接介绍关系；只有平台订阅成功付款可能产生介绍人积分。")}</small></> : <><b>{t("No introducer recorded", "尚未记录介绍人")}</b><p>{t("The relationship is recorded automatically at first registration through a platform-subscription referral link. Course payments never create introducer points.", "介绍关系通过平台订阅推荐链接在首次注册时自动记录，无需手动填写。课程付款不产生介绍人积分。")}</p><a className="history-button" href={`/${lang}/dashboard`}>{t("Open dashboard", "打开用户面板")} →</a></>}</article>
      <article><span>{t("Reading settings", "阅读设置")}</span><p>{t("Text size applies across every page.", "文字大小会应用到网站所有页面。")}</p><TextSizeControl lang={lang}/></article>
    </aside>
  </div>;
}
