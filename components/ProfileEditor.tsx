"use client";

import { useEffect, useState } from "react";
import { prepareAvatarUpload } from "./avatar-image";
import { TextSizeControl } from "./TextSizeControl";

type Introducer = { displayName: string; status: string } | null;

export function ProfileEditor({ lang, email, initialName, initialWalletAddress = "", initialIntroducer, initialImageUrl = "" }: { lang: "en" | "zh"; email: string; initialName: string; initialWalletAddress?: string; initialIntroducer: Introducer; initialImageUrl?: string }) {
  const zh = lang === "zh";
  const [displayName, setDisplayName] = useState(initialName);
  const [walletAddress, setWalletAddress] = useState(initialWalletAddress);
  const [walletEditing, setWalletEditing] = useState(!initialWalletAddress);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);

  useEffect(() => {
    if (initialWalletAddress) return;
    void fetch("/api/profile", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => {
        const savedWallet = result?.profile?.walletAddress;
        if (typeof savedWallet === "string" && savedWallet) {
          setWalletAddress(savedWallet);
          setWalletEditing(false);
        }
      })
      .catch(() => undefined);
  }, [initialWalletAddress]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const normalizedWallet = walletAddress.trim();
    if (normalizedWallet && !/^0x[a-fA-F0-9]{40}$/.test(normalizedWallet)) {
      setMessage(zh ? "请输入有效的 EVM 钱包地址（0x 开头）。" : "Enter a valid EVM wallet address beginning with 0x.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName, preferredLanguage: lang, walletAddress: normalizedWallet }) });
      if (!response.ok) throw new Error();
      setWalletAddress(normalizedWallet);
      setWalletEditing(false);
      setMessage(zh ? "个人资料已保存。" : "Profile saved.");
    } catch {
      setMessage(zh ? "保存失败，请重试。" : "Could not save. Please try again.");
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
      setMessage(zh ? "请选择 JPG、PNG 或 WebP 照片。" : "Choose a JPG, PNG, or WebP photo.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage(zh ? "照片不能超过 5 MB。" : "Photo must be 5 MB or smaller.");
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
      setMessage(zh ? "头像已更新并自动居中裁切。" : "Profile photo updated and centered automatically.");
    } catch {
      setMessage(zh ? "头像上传失败，请选择 JPG、PNG 或 WebP。" : "Photo upload failed. Choose a JPG, PNG, or WebP image.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="account-profile-grid">
    <form className="profile-form" onSubmit={save}>
      <div className="photo-row">
        <div className="profile-photo">{imageUrl ? <img src={imageUrl} alt=""/> : <span>{displayName.slice(0,1).toUpperCase()}</span>}</div>
        <label className="photo-button">{zh ? "上传头像" : "Upload photo"}<input key={photoInputKey} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={event => uploadPhoto(event.target.files?.[0], event.currentTarget)}/></label>
        <small>{zh ? "JPG、PNG 或 WebP，最大 5 MB" : "JPG, PNG, or WebP · 5 MB maximum"}</small>
      </div>
      <label>{zh ? "显示名称" : "Display name"}<input required minLength={2} maxLength={60} value={displayName} onChange={event => setDisplayName(event.target.value)}/></label>
      <div className="wallet-profile-field">
        <div><label htmlFor="profile-wallet">{zh ? "EVM 钱包" : "EVM wallet"}</label><button type="button" onClick={() => setWalletEditing(value => !value)}>{walletEditing ? (zh ? "取消" : "Cancel") : (walletAddress ? (zh ? "修改" : "Edit") : (zh ? "添加" : "Add"))}</button></div>
        <input id="profile-wallet" inputMode="text" autoComplete="off" readOnly={!walletEditing} placeholder="0x…" value={walletAddress} onChange={event => setWalletAddress(event.target.value)} />
        <small>{zh ? "可选资料，仅用于您主动启用的兼容功能；平台订阅和班级付款均不要求钱包。" : "Optional and used only for compatible features you choose to enable; neither platform subscriptions nor class payments require a wallet."}</small>
      </div>
      <button className="profile-save" disabled={busy}>{busy ? (zh ? "正在保存…" : "Saving…") : (zh ? "保存个人资料" : "Save profile")}</button>
      {message && <p className="profile-message" role="status">{message}</p>}
    </form>
    <aside className="account-facts">
      <article><span>{zh ? "登录邮箱" : "Sign-in email"}</span><b>{email}</b></article>
      <article><span>{zh ? "平台直接介绍关系" : "Platform introducer relationship"}</span>{initialIntroducer ? <><b>{initialIntroducer.displayName}</b><small>{zh ? "已记录一层直接介绍关系；只有平台订阅成功付款可能产生介绍人积分。" : "One direct introducer is recorded; only a successful platform subscription payment may create introducer points."}</small></> : <><b>{zh ? "尚未记录介绍人" : "No introducer recorded"}</b><p>{zh ? "介绍关系通过平台订阅推荐链接在首次注册时自动记录，无需手动填写。班级付款不产生介绍人积分。" : "The relationship is recorded automatically at first registration through a platform-subscription referral link. Class payments never create introducer points."}</p><a className="history-button" href={`/${lang}/dashboard`}>{zh ? "打开用户面板" : "Open dashboard"} →</a></>}</article>
      <article><span>{zh ? "阅读设置" : "Reading settings"}</span><p>{zh ? "文字大小会应用到网站所有页面。" : "Text size applies across every page."}</p><TextSizeControl lang={lang}/></article>
    </aside>
  </div>;
}
