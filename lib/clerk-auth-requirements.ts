export type AuthLanguage = "en" | "zh";

export const CLERK_CAPTCHA_ELEMENT_ID = "clerk-captcha";

export type ClerkSignUpAttemptResult = {
  status: string | null;
  createdSessionId: string | null;
  missingFields?: readonly string[];
};

export type SignUpRequirementResolution =
  | { kind: "password"; fields: ["password"]; message: string }
  | { kind: "unsupported"; fields: string[]; message: string };

export type SignUpCompletionResolution =
  | { kind: "activated"; sessionId: string }
  | SignUpRequirementResolution;

type EmailCodeFactor = {
  strategy: string;
  emailAddressId?: string;
};

type EmailCodeSignInAttempt = {
  supportedFirstFactors?: readonly EmailCodeFactor[] | null;
  prepareFirstFactor: (params: { strategy: "email_code"; emailAddressId: string }) => Promise<unknown>;
};

type EmailCodeSignUpAttempt = {
  prepareEmailAddressVerification: (params: { strategy: "email_code" }) => Promise<unknown>;
};

export type PrepareEmailCodeDependencies = {
  createSignIn: (identifier: string) => Promise<EmailCodeSignInAttempt>;
  createSignUp: (identifier: string) => Promise<EmailCodeSignUpAttempt>;
  isIdentifierNotFound: (issue: unknown) => boolean;
};

export type PreparedEmailCodeFlow = {
  flow: "sign-in" | "sign-up";
  identifier: string;
  message: string;
};

export type PasswordAuthDependencies<TSignIn, TSignUp> = {
  createSignIn: (identifier: string, password: string) => Promise<TSignIn>;
  createSignUp: (identifier: string, password: string) => Promise<TSignUp>;
  isIdentifierNotFound: (issue: unknown) => boolean;
};

export type PasswordAuthResult<TSignIn, TSignUp> =
  | { flow: "sign-in"; result: TSignIn }
  | { flow: "sign-up"; result: TSignUp };

export type ClerkAuthStep = "credentials" | "code" | "password-required" | "recovery-email" | "recovery-code";
export type ClerkAuthMethod = "code" | "password";

export function clerkAuthStepView(
  step: ClerkAuthStep,
  method: ClerkAuthMethod,
  lang: AuthLanguage,
) {
  const zh = lang === "zh";
  return {
    showCodeField: step === "code" || step === "recovery-code",
    captchaElementId: CLERK_CAPTCHA_ELEMENT_ID,
    primaryAction: step === "recovery-email"
      ? (zh ? "发送重置验证码" : "Send reset code")
      : step === "recovery-code"
        ? (zh ? "重置密码并登录" : "Reset password & sign in")
        : step === "code"
      ? (zh ? "验证并继续" : "Verify & continue")
      : step === "password-required"
        ? (zh ? "设置密码并登录" : "Create password & sign in")
        : method === "code"
          ? (zh ? "发送安全验证码" : "Send secure code")
          : (zh ? "使用密码继续" : "Continue with password"),
    secondaryAction: step === "code" || step === "password-required" || step === "recovery-email" || step === "recovery-code"
      ? (zh ? "更换邮箱" : "Use another email")
      : method === "code"
        ? (zh ? "改用密码" : "Use password instead")
        : (zh ? "改用邮箱验证码" : "Use an email code instead"),
  };
}

export async function startPasswordSignInOrUp<TSignIn, TSignUp>(
  identifier: string,
  password: string,
  dependencies: PasswordAuthDependencies<TSignIn, TSignUp>,
): Promise<PasswordAuthResult<TSignIn, TSignUp>> {
  try {
    return { flow: "sign-in", result: await dependencies.createSignIn(identifier, password) };
  } catch (issue) {
    if (!dependencies.isIdentifierNotFound(issue)) throw issue;
    return { flow: "sign-up", result: await dependencies.createSignUp(identifier, password) };
  }
}

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

export function emailCodeSentMessage(identifier: string, lang: AuthLanguage) {
  return lang === "zh" ? `验证码已发送至 ${identifier}` : `Code sent to ${identifier}`;
}

export async function prepareEmailCodeFlow(
  identifier: string,
  lang: AuthLanguage,
  dependencies: PrepareEmailCodeDependencies,
): Promise<PreparedEmailCodeFlow> {
  try {
    const attempt = await dependencies.createSignIn(identifier);
    const factor = attempt.supportedFirstFactors?.find(item => item.strategy === "email_code");
    if (!factor?.emailAddressId) {
      throw new Error(lang === "zh" ? "邮箱验证码不可用。" : "Email-code sign-in is unavailable.");
    }
    await attempt.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId });
    return { flow: "sign-in", identifier, message: emailCodeSentMessage(identifier, lang) };
  } catch (issue) {
    if (!dependencies.isIdentifierNotFound(issue)) throw issue;
    const attempt = await dependencies.createSignUp(identifier);
    await attempt.prepareEmailAddressVerification({ strategy: "email_code" });
    return { flow: "sign-up", identifier, message: emailCodeSentMessage(identifier, lang) };
  }
}

export async function completeSignUpAttempt(
  result: ClerkSignUpAttemptResult,
  lang: AuthLanguage,
  activateSession: (sessionId: string) => Promise<unknown>,
): Promise<SignUpCompletionResolution> {
  if (result.status === "complete" && result.createdSessionId) {
    await activateSession(result.createdSessionId);
    return { kind: "activated", sessionId: result.createdSessionId };
  }

  if (result.status === "missing_requirements") {
    return resolveSignUpRequirements(result.missingFields, lang);
  }

  throw new Error(lang === "zh"
    ? `无法完成账户创建（${result.status || "未知状态"}），请重新开始。`
    : `Account creation could not finish (${result.status || "unknown status"}). Please start again.`);
}
