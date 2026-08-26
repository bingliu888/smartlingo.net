"use client";

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
import { usePathname } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { clerkLocalizationLanguage } from "../lib/clerk-localization-language";
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

export function LocalizedClerkProvider({ children }: { children: ReactNode }) {
  const language = clerkLocalizationLanguage(usePathname());
  return <ClerkProvider localization={clerkLocalizations[language]}>{children}</ClerkProvider>;
}
