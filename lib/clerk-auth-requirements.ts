export type AuthLanguage = "en" | "zh";

export type SignUpRequirementResolution =
  | { kind: "password"; fields: ["password"]; message: string }
  | { kind: "unsupported"; fields: string[]; message: string };

const requirementLabels: Record<AuthLanguage, Record<string, string>> = {
  en: {
    email_address: "email address",
    first_name: "first name",
    last_name: "last name",
    legal_accepted: "terms acceptance",
    password: "password",
    phone_number: "phone number",
    protect_check: "security check",
    username: "username",
    web3_wallet: "wallet",
  },
  zh: {
    email_address: "电子邮箱",
    first_name: "名字",
    last_name: "姓氏",
    legal_accepted: "条款确认",
    password: "密码",
    phone_number: "手机号码",
    protect_check: "安全验证",
    username: "用户名",
    web3_wallet: "钱包",
  },
};

export function resolveSignUpRequirements(
  missingFields: readonly string[] | null | undefined,
  lang: AuthLanguage,
): SignUpRequirementResolution {
  const fields = [...new Set((missingFields ?? []).filter(Boolean))];

  if (fields.length === 1 && fields[0] === "password") {
    return {
      kind: "password",
      fields: ["password"],
      message: lang === "zh"
        ? "电子邮箱已验证。当前账户设置还要求新用户创建密码；设置后将自动完成登录。"
        : "Your email is verified. The current account settings also require new users to create a password; sign-in will finish automatically after you set it.",
    };
  }

  const labels = fields.length
    ? fields.map(field => requirementLabels[lang][field] ?? field).join(lang === "zh" ? "、" : ", ")
    : (lang === "zh" ? "未知账户资料" : "unknown account details");

  return {
    kind: "unsupported",
    fields,
    message: lang === "zh"
      ? `电子邮箱已验证，但账户仍需完成：${labels}。请更换登录方式或联系管理员。`
      : `Your email is verified, but the account still requires: ${labels}. Use another sign-in method or contact an administrator.`,
  };
}
