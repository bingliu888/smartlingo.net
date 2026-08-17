import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import { TextSizeInitializer } from "../components/TextSizeControl";
import { FloatingAssistant } from "../components/FloatingAssistant";
import { NotificationBar } from "../components/NotificationBar";
import "./globals.css";
import "./readability.css";
import "./project-status.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "smartlingo.net";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  const origin = new URL(`${protocol}://${host}`);
  const title = "SmartLingo — 从第一天开口，与班级一起进步";
  const description = "人工智能原生语言学习：十二种语言、三级固定月费课程、首月免费、五项技能、Webinar 教课室与小组语音练习室。";
  return {
    metadataBase: origin,
    title: { default: title, template: "%s | SmartLingo" },
    description,
    icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
    openGraph: {
      title,
      description,
      type: "website",
      url: origin,
      siteName: "SmartLingo",
      images: [{ url: "/smartlingo-language-community-1600.png", width: 1600, height: 858, alt: "SmartLingo 人工智能语言学习、班级与社区" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/smartlingo-language-community-1600.png"] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="zh-CN" data-text-size="comfortable">
        <body><TextSizeInitializer/><NotificationBar/>{children}<FloatingAssistant/></body>
      </html>
    </ClerkProvider>
  );
}
