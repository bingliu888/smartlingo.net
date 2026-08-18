import { notFound } from "next/navigation";
import { SiteFooter } from "../../../../components/SiteFooter";
import { SiteHeader } from "../../../../components/SiteHeader";
import { SmartCardChallengeCalendar } from "../../../../components/SmartCardChallengeCalendar";

export default async function SmartCardChallengePage({params}:{params:Promise<{lang:string}>}){
  const value=await params;if(value.lang!=="en"&&value.lang!=="zh")notFound();const lang=value.lang;const zh=lang==="zh";
  return <main className="daily-challenge"><SiteHeader lang={lang}/><section><p>SMART CARD CHALLENGE</p><h1>{zh?"每天开口，登上排行榜。":"Speak every day. Rise on the leaderboard."}</h1><span>{zh?"今天可进入挑战；过去日期可查看最高分、优胜者和完整排名；未来日期会在当天开放。":"Enter today's challenge, inspect past winners and rankings, and return when future rounds unlock."}</span></section><SmartCardChallengeCalendar lang={lang}/><SiteFooter lang={lang}/><style>{`.daily-challenge{min-height:100vh;background:radial-gradient(circle at 85% 0,#eadcff,transparent 27%),#f7f3ea;color:#17302a}.daily-challenge>section:first-of-type{width:min(1080px,calc(100% - 32px));margin:auto;padding:90px 0 45px}.daily-challenge>section>p{color:#7555a6;font-size:12px;font-weight:950;letter-spacing:.14em}.daily-challenge h1{max-width:920px;margin:12px 0 18px;font:600 clamp(46px,7vw,84px)/.98 "Iowan Old Style","Noto Serif SC",serif}.daily-challenge>section>span{display:block;max-width:70ch;color:#60716b;font-size:18px;line-height:1.65}`}</style></main>;
}
