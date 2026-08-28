"use client";

import { useEffect, useState } from "react";

const policyCopy: Record<string, string> = {
  en: "Password is the default sign-in method. You can switch to an email verification code below.",
  zh: "默认使用密码登录；也可在下方改用邮箱验证码。",
  ja: "デフォルトはパスワードログインです。下でメール認証コードに切り替えられます。",
  ko: "기본 로그인 방법은 비밀번호입니다. 아래에서 이메일 인증 코드로 전환할 수 있습니다.",
  es: "La contraseña es el método de acceso predeterminado. Puedes cambiar al código de verificación por correo abajo.",
  fr: "Le mot de passe est le mode de connexion par défaut. Vous pouvez passer au code de vérification par e-mail ci-dessous.",
  de: "Das Passwort ist die Standard-Anmeldemethode. Unten können Sie zum E-Mail-Bestätigungscode wechseln.",
  ru: "По умолчанию используется вход по паролю. Ниже можно переключиться на код подтверждения из письма.",
  it: "La password è il metodo di accesso predefinito. Puoi passare al codice di verifica via email qui sotto.",
  pt: "A senha é o método de acesso padrão. Você pode mudar para o código de verificação por e-mail abaixo.",
  ar: "كلمة المرور هي طريقة تسجيل الدخول الافتراضية. يمكنك التبديل إلى رمز التحقق عبر البريد أدناه.",
  hi: "पासवर्ड डिफ़ॉल्ट साइन-इन तरीका है। आप नीचे ईमेल सत्यापन कोड पर स्विच कर सकते हैं।",
  id: "Kata sandi adalah metode masuk default. Anda dapat beralih ke kode verifikasi email di bawah.",
  bn: "পাসওয়ার্ড হলো ডিফল্ট সাইন-ইন পদ্ধতি। নিচে ইমেল যাচাইকরণ কোডে পরিবর্তন করতে পারেন।",
  ur: "پاس ورڈ ڈیفالٹ سائن اِن طریقہ ہے۔ آپ نیچے ای میل تصدیقی کوڈ پر جا سکتے ہیں۔",
  pa: "ਪਾਸਵਰਡ ਡਿਫਾਲਟ ਸਾਈਨ-ਇਨ ਤਰੀਕਾ ਹੈ। ਤੁਸੀਂ ਹੇਠਾਂ ਈਮੇਲ ਪੁਸ਼ਟੀ ਕੋਡ ਵਰਤ ਸਕਦੇ ਹੋ।",
  ta: "கடவுச்சொல் இயல்புநிலை உள்நுழைவு முறையாகும். கீழே மின்னஞ்சல் சரிபார்ப்புக் குறியீட்டுக்கு மாறலாம்.",
  te: "పాస్‌వర్డ్ డిఫాల్ట్ సైన్-ఇన్ పద్ధతి. మీరు దిగువన ఇమెయిల్ ధృవీకరణ కోడ్‌కు మారవచ్చు.",
  ne: "पासवर्ड पूर्वनिर्धारित साइन-इन विधि हो। तपाईं तल इमेल प्रमाणीकरण कोडमा बदल्न सक्नुहुन्छ।",
  si: "මුරපදය පෙරනිමි පිවිසුම් ක්‍රමයයි. ඔබට පහතින් ඊමේල් සත්‍යාපන කේතයට මාරු විය හැක.",
  tr: "Parola varsayılan giriş yöntemidir. Aşağıdan e-posta doğrulama koduna geçebilirsiniz.",
};

function normalizeLocale(value: string | undefined) {
  const normalized = value?.trim().toLowerCase().split("-")[0] || "en";
  return policyCopy[normalized] ? normalized : "en";
}

export function AuthPolicyIntro({ locale: localeProp, className }: { locale?: string; className?: string }) {
  const [detectedLocale, setDetectedLocale] = useState("en");

  useEffect(() => {
    if (localeProp) return;
    const root = document.documentElement;
    const sync = () => setDetectedLocale(normalizeLocale(root.lang));
    const frame = window.requestAnimationFrame(sync);
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["lang"] });
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [localeProp]);

  const locale = normalizeLocale(localeProp || detectedLocale);
  return <p className={className}>{policyCopy[locale]}</p>;
}

export const authPolicyLocales = Object.freeze(Object.keys(policyCopy));
