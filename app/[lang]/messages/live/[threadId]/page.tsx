import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "../../../../../lib/auth";
import { SiteHeader } from "../../../../../components/SiteHeader";
import { LiveChatRoom } from "../../../../../components/LiveChatRoom";
import "../live-chat.css";
import "../composer-tuneup.css";
import "../group-tools.css";
import "../live-layout-contract.css";

export const dynamic = "force-dynamic";
export default async function LiveChatPage({ params }: { params: Promise<{ lang: string; threadId: string }> }) { const { lang, threadId } = await params; if (lang !== "en" && lang !== "zh") notFound(); const user = await getSessionUser(); if (!user) redirect(`/${lang}/auth/login`); return <main className="live-chat-page" data-layout-page="live-chat" data-layout-fill="live-chat-page"><SiteHeader lang={lang}/><LiveChatRoom lang={lang} threadId={threadId}/></main>; }
