import { ClerkProvider } from "@clerk/nextjs";
import {
  arSA,
  deDE,
  enUS,
  esES,
  frFR,
  hiIN,
  itIT,
  jaJP,
  koKR,
  ptBR,
  ruRU,
  zhCN,
} from "@clerk/localizations";
import type { ComponentProps, ReactNode } from "react";
import type { SmartLingoCommunityLanguage } from "../lib/smartlingo-language-communities";

type ClerkLocalization = NonNullable<ComponentProps<typeof ClerkProvider>["localization"]>;

const clerkLocalizations: Record<SmartLingoCommunityLanguage, ClerkLocalization> = {
  zh: zhCN,
  en: enUS,
  es: esES,
  ja: jaJP,
  ko: koKR,
  fr: frFR,
  de: deDE,
  ru: ruRU,
  it: itIT,
  pt: ptBR,
  ar: arSA,
  hi: hiIN,
};

export function LocalizedClerkProvider({ children, language }: { children: ReactNode; language: SmartLingoCommunityLanguage }) {
  return <ClerkProvider localization={clerkLocalizations[language]}>{children}</ClerkProvider>;
}
