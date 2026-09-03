import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Common, Hardfork, Mainnet } from "@ethereumjs/common";
import { createLegacyTx } from "@ethereumjs/tx";
import { bytesToHex, createAccount, createAddressFromPrivateKey, hexToBytes } from "@ethereumjs/util";
import { createVM, runTx } from "@ethereumjs/vm";
import { decodeEventLog, decodeFunctionResult, encodeDeployData, encodeFunctionData } from "viem";

const artifact=JSON.parse(await readFile(new URL("../contracts/artifacts/SmartPay5.json",import.meta.url),"utf8"));
const tokenArtifact=JSON.parse(await readFile(new URL("../contracts/artifacts/MockUSDC.json",import.meta.url),"utf8"));
const burnTokenArtifact=JSON.parse(await readFile(new URL("../contracts/artifacts/MockBurnToken.json",import.meta.url),"utf8"));
const ownerKey=hexToBytes(`0x${"11".repeat(32)}`);
const payerKey=hexToBytes(`0x${"22".repeat(32)}`);
const treasuryKey=hexToBytes(`0x${"33".repeat(32)}`);
const owner=createAddressFromPrivateKey(ownerKey);
const payer=createAddressFromPrivateKey(payerKey);
const treasury=createAddressFromPrivateKey(treasuryKey);
const zeroAddress="0x0000000000000000000000000000000000000000";
const basicMainId="smartlingo_course_basic_3m";
const intermediateMainId="smartlingo_course_intermediate_3m";
const productOwnerRefId="ADM234";
const payerId="USR234";

async function testChain(){
  const common=new Common({chain:Mainnet,hardfork:Hardfork.Prague});
  const vm=await createVM({common});
  for(const address of [owner,payer,treasury])await vm.stateManager.putAccount(address,createAccount({nonce:0n,balance:10n**22n}));
  async function send(key,{to,data,expectFailure=false}){
    const sender=createAddressFromPrivateKey(key);
    const account=await vm.stateManager.getAccount(sender);
    const tx=createLegacyTx({nonce:account?.nonce||0n,gasLimit:20_000_000n,gasPrice:10n,to,data:hexToBytes(data)},{common}).sign(key);
    const result=await runTx(vm,{tx});
    assert.equal(Boolean(result.execResult.exceptionError),expectFailure,result.execResult.exceptionError?.error||"unexpected transaction status");
    return result;
  }
  async function deploy(key,deploymentArtifact,args=[]){
    const result=await send(key,{data:encodeDeployData({abi:deploymentArtifact.abi,bytecode:deploymentArtifact.bytecode,args})});
    assert.ok(result.createdAddress);
    return result.createdAddress;
  }
  async function call(address,abi,functionName,args=[],caller=owner){
    const result=await vm.evm.runCall({caller,to:address,gasLimit:10_000_000n,data:hexToBytes(encodeFunctionData({abi,functionName,args}))});
    assert.equal(result.execResult.exceptionError,undefined,result.execResult.exceptionError?.error);
    return decodeFunctionResult({abi,functionName,data:bytesToHex(result.execResult.returnValue)});
  }
  return {send,deploy,call};
}

async function deployCheckout(chain,{configure=true}={}){
  const primary=await chain.deploy(ownerKey,tokenArtifact);
  const secondary=await chain.deploy(ownerKey,tokenArtifact);
  const contract=await chain.deploy(ownerKey,artifact,[owner.toString()]);
  const fullPrimary=300_000_000n;
  const fullSecondary=300_000_000_000_000n;
  const minimumSecondaryBalance=1_000_000_000_000_000n;
  if(configure){
    await chain.send(ownerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"setPayouts",args:[[owner.toString(),treasury.toString()],[3000,0]]})});
    await chain.send(ownerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"setPaymentRule",args:[primary.toString(),secondary.toString(),basicMainId,"",fullPrimary,fullSecondary,minimumSecondaryBalance,true]})});
  }
  return {primary,secondary,contract,fullPrimary,fullSecondary,minimumSecondaryBalance};
}

test("SmartPay5 is the only public ABI and exposes authoritative price reads",async()=>{
  const publicAbi=JSON.parse(await readFile(new URL("../public/contracts/SmartPay5.abi.json",import.meta.url),"utf8"));
  assert.deepEqual(publicAbi,artifact.abi);
  assert.equal(artifact.contractName,"SmartPay5");
  const rule=publicAbi.find(item=>item.type==="function"&&item.name==="paymentRule");
  assert.deepEqual(rule.inputs.map(input=>input.name),["primaryTokenAddress","secondaryTokenAddress","mainId","secondId"]);
  assert.deepEqual(rule.outputs.map(output=>output.name),["primaryTokenAmount","secondaryTokenAmount","minimumSecondaryBalance","enabled"]);
  const pay=publicAbi.find(item=>item.type==="function"&&item.name==="pay");
  assert.deepEqual(pay.inputs.map(input=>input.name),["primaryTokenAddress","secondaryTokenAddress","mainId","secondId","primaryTokenAmount","refId","payerId"]);
  const transaction=publicAbi.find(item=>item.type==="function"&&item.name==="transactionById");
  assert.deepEqual(transaction.outputs[0].components.map(component=>component.name),["transactionId","timestamp","wallet","payerId","refId","mainId","secondId","primaryTokenAddress","primaryTokenAmount","secondaryTokenAddress","secondaryTokenAmount"]);
  assert.ok(publicAbi.some(item=>item.type==="function"&&item.name==="getTransactionsByPayerID"));
  assert.equal(publicAbi.some(item=>item.type==="function"&&item.name==="latestTransactions"),false);
  assert.equal(JSON.stringify(publicAbi).toLowerCase().includes("domain"),false);
  const source=await readFile(new URL("../contracts/SmartPay5.sol",import.meta.url),"utf8");
  assert.doesNotMatch(source,/TokenTransferAmountMismatch|_transferExact|balanceBefore|balanceAfter/);
});

test("SmartPay5 reads its rule and atomically records mixed, secondary-only, and primary-only payments",async()=>{
  const chain=await testChain();
  const {primary,secondary,contract,fullPrimary,fullSecondary,minimumSecondaryBalance}=await deployCheckout(chain);
  const rule=await chain.call(contract,artifact.abi,"paymentRule",[primary.toString(),secondary.toString(),basicMainId,""]);
  assert.deepEqual(rule,[fullPrimary,fullSecondary,minimumSecondaryBalance,true]);
  await chain.send(ownerKey,{to:primary,data:encodeFunctionData({abi:tokenArtifact.abi,functionName:"mint",args:[payer.toString(),fullPrimary*2n]})});
  await chain.send(ownerKey,{to:secondary,data:encodeFunctionData({abi:tokenArtifact.abi,functionName:"mint",args:[payer.toString(),minimumSecondaryBalance+fullSecondary*2n]})});
  await chain.send(payerKey,{to:primary,data:encodeFunctionData({abi:tokenArtifact.abi,functionName:"approve",args:[contract.toString(),fullPrimary*2n]})});
  await chain.send(payerKey,{to:secondary,data:encodeFunctionData({abi:tokenArtifact.abi,functionName:"approve",args:[contract.toString(),minimumSecondaryBalance+fullSecondary*2n]})});
  const rows=[[fullPrimary/2n,fullSecondary/2n],[0n,fullSecondary],[fullPrimary,0n]];
  const ids=[];
  for(const [primaryAmount,secondaryAmount] of rows){
    const result=await chain.send(payerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"pay",args:[primary.toString(),secondary.toString(),basicMainId,"es",primaryAmount,productOwnerRefId,payerId]})});
    const decoded=result.receipt.logs.map(([address,topics,data])=>({address:bytesToHex(address),topics:topics.map(bytesToHex),data:bytesToHex(data)})).map(log=>{try{return decodeEventLog({abi:artifact.abi,...log});}catch{return null;}});
    const recorded=decoded.find(item=>item?.eventName==="TransactionRecorded");
    assert.ok(recorded);
    assert.equal(recorded.args.primaryTokenAmount,primaryAmount);
    assert.equal(recorded.args.secondaryTokenAmount,secondaryAmount);
    assert.equal(recorded.args.refId,productOwnerRefId);
    assert.equal(recorded.args.payerId,payerId);
    assert.equal(recorded.args.secondId,"es");
    ids.push(recorded.args.transactionId);
    const payouts=decoded.filter(item=>item?.eventName==="PayoutExecuted");
    for(const [token,amount] of [[primary.toString(),primaryAmount],[secondary.toString(),secondaryAmount]]){
      const splits=payouts.filter(item=>item.args.tokenAddress.toLowerCase()===token.toLowerCase()).map(item=>item.args.tokenAmount);
      assert.deepEqual(splits,amount?[amount*30n/100n,amount-(amount*30n/100n)]:[]);
    }
  }
  const latest=await chain.call(contract,artifact.abi,"getTransactionsByPayerID",[payerId,100n]);
  assert.equal(latest[1],3n);
  assert.deepEqual(latest[0].map(record=>record.transactionId),ids.toReversed());
  assert.deepEqual(latest[0].map(record=>record.refId),rows.map(()=>productOwnerRefId).toReversed());
  assert.deepEqual(latest[0].map(record=>record.payerId),rows.map(()=>payerId).toReversed());
});

test("SmartPay5 accepts 30% burn GLC and keeps nominal language-scoped records",async()=>{
  const chain=await testChain();
  const primary=await chain.deploy(ownerKey,tokenArtifact);
  const glc=await chain.deploy(ownerKey,burnTokenArtifact);
  const contract=await chain.deploy(ownerKey,artifact,[owner.toString()]);
  const payoutWallets=[owner.toString(),treasury.toString(),
    createAddressFromPrivateKey(hexToBytes(`0x${"44".repeat(32)}`)).toString(),
    createAddressFromPrivateKey(hexToBytes(`0x${"55".repeat(32)}`)).toString(),
    createAddressFromPrivateKey(hexToBytes(`0x${"66".repeat(32)}`)).toString()];
  const shares=[1000,1500,2000,2500,0];
  const nominal=10_000_000n*10n**18n;
  await chain.send(ownerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"setPayouts",args:[payoutWallets,shares]})});
  await chain.send(ownerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"setPaymentRule",args:[primary.toString(),glc.toString(),basicMainId,"",30_000_000n,nominal,nominal,true]})});
  await chain.send(ownerKey,{to:glc,data:encodeFunctionData({abi:burnTokenArtifact.abi,functionName:"mint",args:[payer.toString(),nominal]})});
  await chain.send(payerKey,{to:glc,data:encodeFunctionData({abi:burnTokenArtifact.abi,functionName:"approve",args:[contract.toString(),nominal]})});
  const result=await chain.send(payerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"pay",args:[primary.toString(),glc.toString(),basicMainId,"ja",0n,productOwnerRefId,payerId]})});
  const decoded=result.receipt.logs.map(([address,topics,data])=>({address:bytesToHex(address),topics:topics.map(bytesToHex),data:bytesToHex(data)})).map(log=>{try{return decodeEventLog({abi:artifact.abi,...log});}catch{return null;}});
  const recorded=decoded.find(item=>item?.eventName==="TransactionRecorded");
  assert.equal(recorded.args.secondaryTokenAmount,nominal);
  assert.equal(recorded.args.secondId,"ja");
  const nominalSplits=[nominal/10n,nominal*15n/100n,nominal/5n,nominal/4n,nominal*3n/10n];
  for(let index=0;index<payoutWallets.length;index+=1){
    assert.equal(await chain.call(glc,burnTokenArtifact.abi,"balanceOf",[payoutWallets[index]]),nominalSplits[index]*70n/100n);
  }
});

test("SmartPay5 enforces secondary eligibility and exact single-token rules",async()=>{
  const chain=await testChain();
  const {primary,secondary,contract,fullPrimary,fullSecondary,minimumSecondaryBalance}=await deployCheckout(chain);
  await chain.send(ownerKey,{to:primary,data:encodeFunctionData({abi:tokenArtifact.abi,functionName:"mint",args:[payer.toString(),fullPrimary*2n]})});
  await chain.send(ownerKey,{to:secondary,data:encodeFunctionData({abi:tokenArtifact.abi,functionName:"mint",args:[payer.toString(),minimumSecondaryBalance-1n]})});
  await chain.send(payerKey,{to:primary,data:encodeFunctionData({abi:tokenArtifact.abi,functionName:"approve",args:[contract.toString(),fullPrimary*2n]})});
  await chain.send(payerKey,{to:secondary,data:encodeFunctionData({abi:tokenArtifact.abi,functionName:"approve",args:[contract.toString(),fullSecondary]})});
  await chain.send(payerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"pay",args:[primary.toString(),secondary.toString(),basicMainId,"ja",fullPrimary/2n,productOwnerRefId,payerId]}),expectFailure:true});
  await chain.send(payerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"pay",args:[primary.toString(),secondary.toString(),basicMainId,"ja",fullPrimary,productOwnerRefId,payerId]})});
  await chain.send(ownerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"setPaymentRule",args:[primary.toString(),zeroAddress,intermediateMainId,"",fullPrimary,0n,0n,true]})});
  await chain.send(payerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"pay",args:[primary.toString(),zeroAddress,intermediateMainId,"zh",fullPrimary/2n,productOwnerRefId,payerId]}),expectFailure:true});
  await chain.send(payerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"pay",args:[primary.toString(),zeroAddress,intermediateMainId,"zh",fullPrimary,productOwnerRefId,payerId]})});
  await chain.send(payerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"pay",args:[primary.toString(),zeroAddress,intermediateMainId,"zh",fullPrimary,"ABC12",payerId]}),expectFailure:true});
  await chain.send(payerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"pay",args:[primary.toString(),zeroAddress,intermediateMainId,"zh",fullPrimary,"ABC1DE",payerId]}),expectFailure:true});
  await chain.send(payerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"pay",args:[primary.toString(),zeroAddress,intermediateMainId,"zh",fullPrimary,productOwnerRefId,"USR12"]}),expectFailure:true});
  await chain.send(payerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"pay",args:[primary.toString(),zeroAddress,intermediateMainId,"xx",fullPrimary,productOwnerRefId,payerId]}),expectFailure:true});
  await chain.send(ownerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"setPaymentRule",args:[primary.toString(),zeroAddress,"smartlingo_course_basic_6m","",fullPrimary,0n,0n,true]}),expectFailure:true});
  await chain.send(ownerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"setPaymentRule",args:[primary.toString(),zeroAddress,basicMainId,"es",fullPrimary,0n,0n,true]}),expectFailure:true});
});

test("SmartPay5 owner operations transfer immediately and reject the former owner and every non-owner",async()=>{
  const chain=await testChain();
  const {primary,secondary,contract,fullPrimary,fullSecondary,minimumSecondaryBalance}=await deployCheckout(chain);
  const calls=[
    ["setPayouts",[[payer.toString()],[0]]],
    ["setPaymentRule",[primary.toString(),secondary.toString(),"vip","",1n,1n,1n,true]],
    ["withdrawToken",[primary.toString(),1n]],
    ["pause",[]],
    ["transferOwnership",[treasury.toString()]]
  ];
  for(const [functionName,args] of calls)await chain.send(payerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName,args}),expectFailure:true});
  await chain.send(ownerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"renounceOwnership"}),expectFailure:true});
  await chain.send(ownerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"transferOwnership",args:[treasury.toString()]})});
  assert.equal((await chain.call(contract,artifact.abi,"owner")).toLowerCase(),treasury.toString().toLowerCase());
  for(const [functionName,args] of calls)await chain.send(ownerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName,args}),expectFailure:true});
  await chain.send(treasuryKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"setPaymentRule",args:[primary.toString(),secondary.toString(),basicMainId,"",fullPrimary,fullSecondary,minimumSecondaryBalance,true]})});
  const stranded=77_000_000n;
  await chain.send(ownerKey,{to:primary,data:encodeFunctionData({abi:tokenArtifact.abi,functionName:"mint",args:[owner.toString(),stranded]})});
  await chain.send(ownerKey,{to:primary,data:encodeFunctionData({abi:tokenArtifact.abi,functionName:"transfer",args:[contract.toString(),stranded]})});
  await chain.send(ownerKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"withdrawToken",args:[primary.toString(),stranded]}),expectFailure:true});
  await chain.send(treasuryKey,{to:contract,data:encodeFunctionData({abi:artifact.abi,functionName:"withdrawToken",args:[primary.toString(),stranded]})});
  assert.equal(await chain.call(primary,tokenArtifact.abi,"balanceOf",[contract.toString()]),0n);
});
