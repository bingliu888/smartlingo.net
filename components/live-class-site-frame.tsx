import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function LiveClassSiteFrame({ children, lang }: { children: ReactNode; lang: "en" | "zh" }) {
  return <main><SiteHeader lang={lang} />{children}<SiteFooter lang={lang} /></main>;
}
