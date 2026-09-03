"use client";
import { useCallback,useEffect,useState } from "react";
import type { CryptoPaymentSetting } from "../lib/crypto-contract";
import { cryptoSubscriptionPlanForIds } from "../lib/crypto-subscription";
import { interfaceText,type InterfaceLanguage } from "../lib/interface-locale";
import { fixedCourseId } from "../lib/smartlingo-course-packages";
import { isSmartLingoCommunityLanguage } from "../lib/smartlingo-language-communities";

type RecordRow={transactionId:string;payerId:string;refId:string;mainId:string;secondId:string;timestamp:number;subscriptionRecorded?:boolean;subscriptionEndsAt?:number|null};

function recordCourse(row:RecordRow){
  const plan=cryptoSubscriptionPlanForIds(row.mainId,row.secondId);
  return plan&&isSmartLingoCommunityLanguage(row.secondId)?{plan,classId:fixedCourseId(row.secondId,plan)}:null;
}

export function SmartPayAccountLookup({lang}:{lang:InterfaceLanguage}){
  const t=useCallback((en:string,zh:string)=>interfaceText(lang,en,zh),[lang]),[settings,setSettings]=useState<CryptoPaymentSetting[]>([]),[settingId,setSettingId]=useState(""),[records,setRecords]=useState<RecordRow[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>{void fetch("/api/billing/status",{cache:"no-store"}).then(r=>r.json()).then(data=>{const rows=(data.cryptoSettings||[]).filter((item:CryptoPaymentSetting)=>item.smartPay5Contract);setSettings(rows);setSettingId(rows[0]?.id||"");}).catch(()=>setMessage(t("Payment networks are temporarily unavailable.","付款网络暂时不可用。")));},[t]);
  async function sync(){if(!settingId)return;setBusy(true);setMessage("");try{const response=await fetch(`/api/billing/crypto/smartpay/records?settingId=${encodeURIComponent(settingId)}`,{cache:"no-store"}),data=await response.json();if(!response.ok)throw new Error(data.error);const rows=(data.transactions||[]) as RecordRow[];setRecords(rows);let count=0;for(const row of rows){const course=recordCourse(row);if(row.subscriptionRecorded||!course)continue;const claim=await fetch("/api/billing/crypto/smartpay/claim",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({settingId,paymentId:row.transactionId,classId:course.classId})});if(claim.ok)count+=1;}setMessage(count?t(`${count} course payment(s) synchronized.`,`${count} 笔课程付款已同步。`):t("No new course payment matched this account.","没有发现属于当前账户的新课程付款。"));}catch(error){setMessage(error instanceof Error?error.message:t("Unable to read payments.","无法读取付款。"));}finally{setBusy(false);}}
  return <section className="profile-card smartpay-account-lookup"><h2>{t("On-chain payment check","链上付款检查")}</h2><p>{t("Read the latest 100 records for the signed-in account’s PayerID. The funding wallet may differ from the profile wallet, and no profile wallet is required. Lookup requires no wallet connection, signature, or gas.","按当前登录账户的 PayerID 免费读取最新 100 条记录；出资钱包可以不同于资料钱包，也无需保存资料钱包。查询无需连接钱包、签名或支付 Gas。")}</p><div className="smartpay-account-fields"><label>{t("Payment network","付款网络")}<select value={settingId} onChange={event=>setSettingId(event.target.value)}>{settings.map(item=><option key={item.id} value={item.id}>{item.chainName} · {item.tokenSymbol}</option>)}</select></label><button type="button" className="button primary" disabled={busy||!settingId} onClick={()=>void sync()}>{busy?"…":t("Read latest payments & sync","读取最新付款并同步")}</button></div>{records.length?<ul>{records.slice(0,12).map(row=>{const course=recordCourse(row);return <li key={row.transactionId}><span>{new Date(row.timestamp*1000).toLocaleDateString(lang)}<small>{course?`${row.secondId.toUpperCase()} · ${course.plan}`:row.secondId} · PayerID {row.payerId}</small></span><code>{row.transactionId.slice(0,12)}…</code><strong>{row.subscriptionRecorded?t("Confirmed","已确认"):t("Pending","待核对")}</strong></li>;})}</ul>:null}{message?<p role="status">{message}</p>:null}</section>;
}
