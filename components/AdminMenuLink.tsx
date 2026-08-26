"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { InterfaceLanguage } from "../lib/interface-locale";

const labels: Record<InterfaceLanguage, { dashboard: string; crypto: string }> = {
  en: { dashboard: "Admin dashboard", crypto: "Crypto payments" },
  zh: { dashboard: "管理员面板", crypto: "加密货币付款" },
  ja: { dashboard: "管理者ダッシュボード", crypto: "暗号資産決済" },
  ko: { dashboard: "관리자 대시보드", crypto: "암호화폐 결제" },
  es: { dashboard: "Panel de administración", crypto: "Pagos con criptomonedas" },
  fr: { dashboard: "Tableau d’administration", crypto: "Paiements en cryptomonnaie" },
  de: { dashboard: "Admin-Dashboard", crypto: "Kryptozahlungen" },
  ru: { dashboard: "Панель администратора", crypto: "Криптоплатежи" },
  it: { dashboard: "Pannello amministratore", crypto: "Pagamenti in criptovaluta" },
  pt: { dashboard: "Painel administrativo", crypto: "Pagamentos em criptomoeda" },
  ar: { dashboard: "لوحة الإدارة", crypto: "مدفوعات العملات المشفرة" },
  hi: { dashboard: "एडमिन डैशबोर्ड", crypto: "क्रिप्टो भुगतान" },
};

export function AdminMenuLink({ lang, onNavigate }: { lang: InterfaceLanguage; onNavigate?: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    fetch("/api/account-context", { cache: "no-store" })
      .then(response => response.ok ? response.json() : null)
      .then(value => setVisible(Boolean(value?.isPermanentAdmin)))
      .catch(() => setVisible(false));
  }, []);
  if (!visible) return null;
  const label = labels[lang];
  return <>
    <Link onClick={onNavigate} href={`/${lang}/admin`}><b>{label.dashboard}</b><small>→</small></Link>
    <Link onClick={onNavigate} href={`/${lang}/admin/crypto-payments`}><b>{label.crypto}</b><small>→</small></Link>
  </>;
}
