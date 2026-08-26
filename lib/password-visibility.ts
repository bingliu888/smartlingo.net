export type PasswordVisibilityLanguage = "zh" | "en" | "ja" | "ko" | "es" | "fr" | "de" | "ru" | "it" | "pt" | "ar" | "hi";

const labels: Record<PasswordVisibilityLanguage, { show: string; hide: string }> = {
  zh: { show: "显示密码", hide: "隐藏密码" },
  en: { show: "Show password", hide: "Hide password" },
  ja: { show: "パスワードを表示", hide: "パスワードを隠す" },
  ko: { show: "비밀번호 표시", hide: "비밀번호 숨기기" },
  es: { show: "Mostrar contraseña", hide: "Ocultar contraseña" },
  fr: { show: "Afficher le mot de passe", hide: "Masquer le mot de passe" },
  de: { show: "Passwort anzeigen", hide: "Passwort ausblenden" },
  ru: { show: "Показать пароль", hide: "Скрыть пароль" },
  it: { show: "Mostra password", hide: "Nascondi password" },
  pt: { show: "Mostrar senha", hide: "Ocultar senha" },
  ar: { show: "إظهار كلمة المرور", hide: "إخفاء كلمة المرور" },
  hi: { show: "पासवर्ड दिखाएँ", hide: "पासवर्ड छिपाएँ" },
};

export function passwordVisibility(revealed: boolean, lang: PasswordVisibilityLanguage) {
  return {
    type: revealed ? "text" as const : "password" as const,
    label: revealed ? labels[lang].hide : labels[lang].show,
  };
}
