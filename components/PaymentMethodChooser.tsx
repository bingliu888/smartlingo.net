"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { InterfaceLanguage } from "../lib/interface-locale";
import type { SmartLingoPlatformProductId } from "../lib/platform-commerce";

type PaymentCopy = { eyebrow:string; title:string; intro:string; card:string; cardHint:string; crypto:string; cryptoHint:string; continueCard:string; back:string; busy:string; confirming:string; error:string; success:string; pending:string; cancelled:string };

const paymentCopy: Record<InterfaceLanguage, PaymentCopy> = {
  en:{eyebrow:"PAYMENT METHOD",title:"Choose how to pay",intro:"Card, US bank-account, and crypto payments activate one fixed service term. SmartLingo does not automatically renew it.",card:"Credit card or US bank account",cardHint:"Secure hosted checkout by Stripe, with no Stripe or Link account required.",crypto:"Crypto",cryptoHint:"On-chain payment through SmartPay5.",continueCard:"Pay by credit card or US bank account",back:"Back",busy:"Opening secure checkout…",confirming:"Confirming the Stripe payment…",error:"Credit-card or bank-account checkout is temporarily unavailable.",success:"Payment confirmed and your account has been updated.",pending:"Stripe is still confirming this payment. Refresh shortly; do not pay again.",cancelled:"Payment was cancelled. Nothing was charged."},
  zh:{eyebrow:"付款方式",title:"选择付款方式",intro:"信用卡、美国银行账户与加密货币付款均会激活一个固定服务期；SmartLingo 不会自动续费。",card:"信用卡或美国银行账户",cardHint:"由 Stripe 托管安全结账，无需 Stripe 或 Link 账户。",crypto:"加密货币",cryptoHint:"通过 SmartPay5 链上付款。",continueCard:"使用信用卡或美国银行账户付款",back:"返回",busy:"正在打开安全结账…",confirming:"正在确认 Stripe 付款…",error:"暂时无法打开信用卡或银行账户结账。",success:"付款已确认，账户权益已经更新。",pending:"Stripe 仍在确认付款。请稍后刷新，不要重复付款。",cancelled:"付款已取消，没有收费。"},
  ja:{eyebrow:"支払い方法",title:"支払い方法を選択",intro:"カード、米国銀行口座、暗号資産の支払いで固定期間が有効になります。自動更新はありません。",card:"クレジットカードまたは米国銀行口座",cardHint:"Stripe がホストする安全な決済です。Stripe または Link アカウントは不要です。",crypto:"暗号資産",cryptoHint:"SmartPay5 によるオンチェーン決済。",continueCard:"カードまたは米国銀行口座で支払う",back:"戻る",busy:"安全な決済を開いています…",confirming:"Stripe 支払いを確認しています…",error:"カードまたは銀行口座での決済は現在利用できません。",success:"支払いを確認し、アカウントを更新しました。",pending:"Stripe が支払いを確認中です。しばらくして更新し、再度支払わないでください。",cancelled:"支払いをキャンセルしました。請求はありません。"},
  ko:{eyebrow:"결제 방법",title:"결제 방법 선택",intro:"카드, 미국 은행 계좌 및 암호화폐 결제는 하나의 고정 서비스 기간을 활성화하며 자동 갱신되지 않습니다.",card:"신용카드 또는 미국 은행 계좌",cardHint:"Stripe가 호스팅하는 안전한 결제이며 Stripe 또는 Link 계정이 필요하지 않습니다.",crypto:"암호화폐",cryptoHint:"SmartPay5 온체인 결제입니다.",continueCard:"카드 또는 미국 은행 계좌로 결제",back:"뒤로",busy:"안전한 결제를 여는 중…",confirming:"Stripe 결제를 확인하는 중…",error:"카드 또는 은행 계좌 결제를 일시적으로 열 수 없습니다.",success:"결제가 확인되어 계정이 업데이트되었습니다.",pending:"Stripe가 결제를 확인 중입니다. 잠시 후 새로고침하고 다시 결제하지 마세요.",cancelled:"결제가 취소되었으며 청구되지 않았습니다."},
  es:{eyebrow:"MÉTODO DE PAGO",title:"Elige cómo pagar",intro:"Los pagos con tarjeta, cuenta bancaria de EE. UU. y criptomonedas activan un plazo fijo. No hay renovación automática.",card:"Tarjeta o cuenta bancaria de EE. UU.",cardHint:"Pago seguro alojado por Stripe, sin necesitar una cuenta de Stripe ni Link.",crypto:"Criptomonedas",cryptoHint:"Pago en cadena mediante SmartPay5.",continueCard:"Pagar con tarjeta o cuenta bancaria",back:"Volver",busy:"Abriendo el pago seguro…",confirming:"Confirmando el pago de Stripe…",error:"El pago con tarjeta o cuenta bancaria no está disponible temporalmente.",success:"Pago confirmado y cuenta actualizada.",pending:"Stripe aún está confirmando el pago. Actualiza en breve y no vuelvas a pagar.",cancelled:"El pago se canceló. No se realizó ningún cargo."},
  fr:{eyebrow:"MODE DE PAIEMENT",title:"Choisissez votre paiement",intro:"La carte, le compte bancaire américain et la crypto activent une durée fixe sans renouvellement automatique.",card:"Carte ou compte bancaire américain",cardHint:"Paiement sécurisé hébergé par Stripe, sans compte Stripe ni Link.",crypto:"Crypto",cryptoHint:"Paiement sur chaîne via SmartPay5.",continueCard:"Payer par carte ou compte bancaire",back:"Retour",busy:"Ouverture du paiement sécurisé…",confirming:"Confirmation du paiement Stripe…",error:"Le paiement par carte ou compte bancaire est temporairement indisponible.",success:"Paiement confirmé et compte mis à jour.",pending:"Stripe confirme encore ce paiement. Actualisez bientôt et ne payez pas à nouveau.",cancelled:"Paiement annulé. Aucun débit n’a été effectué."},
  de:{eyebrow:"ZAHLUNGSART",title:"Zahlungsart wählen",intro:"Karte, US-Bankkonto und Krypto aktivieren eine feste Laufzeit ohne automatische Verlängerung.",card:"Kreditkarte oder US-Bankkonto",cardHint:"Sicherer, von Stripe gehosteter Checkout ohne Stripe- oder Link-Konto.",crypto:"Krypto",cryptoHint:"On-Chain-Zahlung über SmartPay5.",continueCard:"Mit Karte oder US-Bankkonto zahlen",back:"Zurück",busy:"Sicherer Checkout wird geöffnet…",confirming:"Stripe-Zahlung wird bestätigt…",error:"Karten- oder Bankkonto-Checkout ist vorübergehend nicht verfügbar.",success:"Zahlung bestätigt und Konto aktualisiert.",pending:"Stripe bestätigt die Zahlung noch. Bitte bald aktualisieren und nicht erneut zahlen.",cancelled:"Zahlung abgebrochen. Es wurde nichts berechnet."},
  ru:{eyebrow:"СПОСОБ ОПЛАТЫ",title:"Выберите способ оплаты",intro:"Карта, банковский счёт в США и криптовалюта активируют фиксированный срок без автопродления.",card:"Карта или банковский счёт в США",cardHint:"Безопасная страница Stripe без необходимости иметь аккаунт Stripe или Link.",crypto:"Криптовалюта",cryptoHint:"Ончейн-платёж через SmartPay5.",continueCard:"Оплатить картой или через банковский счёт",back:"Назад",busy:"Открываем безопасную оплату…",confirming:"Подтверждаем платёж Stripe…",error:"Оплата картой или через банковский счёт временно недоступна.",success:"Платёж подтверждён, аккаунт обновлён.",pending:"Stripe ещё подтверждает платёж. Обновите страницу позже и не платите повторно.",cancelled:"Платёж отменён. Списание не выполнено."},
  it:{eyebrow:"METODO DI PAGAMENTO",title:"Scegli come pagare",intro:"Carta, conto bancario USA e criptovaluta attivano un periodo fisso senza rinnovo automatico.",card:"Carta o conto bancario USA",cardHint:"Pagamento sicuro ospitato da Stripe, senza account Stripe o Link.",crypto:"Criptovaluta",cryptoHint:"Pagamento on-chain tramite SmartPay5.",continueCard:"Paga con carta o conto bancario",back:"Indietro",busy:"Apertura del pagamento sicuro…",confirming:"Conferma del pagamento Stripe…",error:"Il pagamento con carta o conto bancario è temporaneamente non disponibile.",success:"Pagamento confermato e account aggiornato.",pending:"Stripe sta ancora confermando il pagamento. Aggiorna tra poco e non pagare di nuovo.",cancelled:"Pagamento annullato. Nessun addebito effettuato."},
  pt:{eyebrow:"FORMA DE PAGAMENTO",title:"Escolha como pagar",intro:"Cartão, conta bancária dos EUA e cripto ativam um período fixo sem renovação automática.",card:"Cartão ou conta bancária dos EUA",cardHint:"Pagamento seguro hospedado pela Stripe, sem exigir conta Stripe ou Link.",crypto:"Cripto",cryptoHint:"Pagamento on-chain pelo SmartPay5.",continueCard:"Pagar com cartão ou conta bancária",back:"Voltar",busy:"Abrindo pagamento seguro…",confirming:"Confirmando o pagamento da Stripe…",error:"O pagamento com cartão ou conta bancária está temporariamente indisponível.",success:"Pagamento confirmado e conta atualizada.",pending:"A Stripe ainda está confirmando o pagamento. Atualize em breve e não pague novamente.",cancelled:"Pagamento cancelado. Nenhuma cobrança foi feita."},
  ar:{eyebrow:"طريقة الدفع",title:"اختر طريقة الدفع",intro:"تفعّل مدفوعات البطاقة والحساب المصرفي الأمريكي والعملات المشفرة مدة خدمة ثابتة دون تجديد تلقائي.",card:"بطاقة ائتمان أو حساب مصرفي أمريكي",cardHint:"دفع آمن مستضاف من Stripe من دون الحاجة إلى حساب Stripe أو Link.",crypto:"عملة مشفرة",cryptoHint:"دفع على السلسلة عبر SmartPay5.",continueCard:"الدفع بالبطاقة أو الحساب المصرفي",back:"رجوع",busy:"جارٍ فتح الدفع الآمن…",confirming:"جارٍ تأكيد دفعة Stripe…",error:"الدفع بالبطاقة أو الحساب المصرفي غير متاح مؤقتًا.",success:"تم تأكيد الدفع وتحديث الحساب.",pending:"لا يزال Stripe يؤكد الدفع. حدّث الصفحة لاحقًا ولا تدفع مرة أخرى.",cancelled:"أُلغي الدفع ولم يتم الخصم."},
  hi:{eyebrow:"भुगतान विधि",title:"भुगतान का तरीका चुनें",intro:"कार्ड, अमेरिकी बैंक खाते और क्रिप्टो भुगतान से एक निश्चित सेवा अवधि सक्रिय होती है; स्वतः नवीनीकरण नहीं होगा।",card:"क्रेडिट कार्ड या अमेरिकी बैंक खाता",cardHint:"Stripe द्वारा सुरक्षित होस्टेड चेकआउट; Stripe या Link खाता आवश्यक नहीं है।",crypto:"क्रिप्टो",cryptoHint:"SmartPay5 से ऑन-चेन भुगतान।",continueCard:"कार्ड या बैंक खाते से भुगतान करें",back:"वापस",busy:"सुरक्षित चेकआउट खुल रहा है…",confirming:"Stripe भुगतान की पुष्टि हो रही है…",error:"कार्ड या बैंक-खाता चेकआउट अभी उपलब्ध नहीं है।",success:"भुगतान की पुष्टि हुई और खाता अपडेट हो गया।",pending:"Stripe अभी भुगतान की पुष्टि कर रहा है। थोड़ी देर बाद रीफ़्रेश करें और दोबारा भुगतान न करें।",cancelled:"भुगतान रद्द हुआ। कोई शुल्क नहीं लगा।"},
};

export function PaymentMethodChooser({ locale, product, returnTo, result, sessionId, cardConfigured }: {
  locale: InterfaceLanguage;
  product: SmartLingoPlatformProductId;
  returnTo: string;
  result?: string;
  sessionId?: string;
  cardConfigured: boolean;
}) {
  const text = paymentCopy[locale];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(result === "cancelled" ? text.cancelled : result === "success" ? text.confirming : "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (result !== "success" || !sessionId) return;
    let active = true;
    fetch("/api/billing/platform/stripe/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).then(response => {
      if (active) setMessage(response.ok ? text.success : text.pending);
    }).catch(() => {
      if (active) setMessage(text.pending);
    });
    return () => { active = false; };
  }, [result, sessionId, text.pending, text.success]);

  async function payByCardOrBank() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/billing/platform/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: product, locale, returnTo }),
      });
      const payload = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || "CHECKOUT_UNAVAILABLE");
      window.location.assign(payload.url);
    } catch {
      setError(text.error);
      setBusy(false);
    }
  }

  return <section className="payment-method-flow">
    <header><p className="eyebrow"><span/> {text.eyebrow}</p><h1>{text.title}</h1><p>{text.intro}</p></header>
    {message ? <p className="billing-message" role="status">{message}</p> : null}
    <div className="payment-method-grid">
      <article><span aria-hidden="true">▣</span><h2>{text.card}</h2><p>{text.cardHint}</p><button className="primary-button" type="button" disabled={busy || !cardConfigured} onClick={() => void payByCardOrBank()}>{!cardConfigured ? text.error : busy ? text.busy : text.continueCard}<i aria-hidden="true">→</i></button></article>
      <article><span aria-hidden="true">◇</span><h2>{text.crypto}</h2><p>{text.cryptoHint}</p><Link className="primary-button" href={`/${locale}/pricing/crypto?product=${product}`}>{text.crypto}<i aria-hidden="true">→</i></Link></article>
    </div>
    {error ? <p className="billing-message is-error" role="alert">{error}</p> : null}
    <Link className="payment-method-back" href={returnTo}>← {text.back}</Link>
  </section>;
}
