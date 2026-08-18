import Link from "next/link";
import { SMARTLINGO_LANGUAGE_COMMUNITIES } from "../lib/smartlingo-language-communities";

export function GameLanguagePicker({ lang, basePath, selected }: { lang: "en" | "zh"; basePath: string; selected?: string }) {
  const zh = lang === "zh";
  return <section className="game-language-picker" aria-labelledby="game-language-title">
    <header><p>{zh ? "选择学习语言" : "CHOOSE A LANGUAGE"}</p><h2 id="game-language-title">{zh ? "您想用哪种语言游戏？" : "Which language do you want to play?"}</h2></header>
    <div>{SMARTLINGO_LANGUAGE_COMMUNITIES.map(language => <Link className={selected === language.code ? "selected" : ""} href={`${basePath}?language=${language.code}`} key={language.code} aria-current={selected === language.code ? "true" : undefined}><small>{language.code.toUpperCase()}</small><strong>{zh ? language.nameZh : language.nameEn}</strong><span>{language.nativeName}</span></Link>)}</div>
    <style>{`.game-language-picker{width:min(1180px,calc(100% - 36px));margin:0 auto 70px;padding:clamp(22px,4vw,38px);border:1px solid #c9d8d2;border-radius:28px;background:#fff}.game-language-picker header p{margin:0;color:#087d62;font-size:12px;font-weight:950;letter-spacing:.13em}.game-language-picker h2{margin:8px 0 24px;font:600 clamp(30px,4vw,48px)/1.05 "Iowan Old Style","Noto Serif SC",serif}.game-language-picker>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.game-language-picker a{min-height:108px;padding:16px;display:flex;flex-direction:column;border:1px solid #d6e4de;border-radius:16px;background:#f6faf8;color:#173129;text-decoration:none;transition:transform .18s,border-color .18s,background .18s}.game-language-picker a:hover,.game-language-picker a.selected{transform:translateY(-2px);border-color:#087d62;background:#ddfff1}.game-language-picker small{color:#087d62;font-weight:900}.game-language-picker strong{margin-top:auto;font-size:20px}.game-language-picker span{color:#65776f}@media(max-width:760px){.game-language-picker>div{grid-template-columns:repeat(2,minmax(0,1fr))}}`}</style>
  </section>;
}
