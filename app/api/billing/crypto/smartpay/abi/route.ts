import { NextResponse } from "next/server";
import { SMARTPAY5_ABI } from "../../../../../../lib/smartpay5";

export const dynamic = "force-dynamic";
export async function GET() {
  const contract = "SmartPay5";
  return NextResponse.json({
    contract,
    siteSpecific: true,
    domainParameter: false,
    chain: "Polygon",
    chainType: "EVM",
    deploymentScope: "one-independent-instance-per-site-and-chain",
    sourceVerification: {
      defaultAfterDeployment: true,
      service: "Sourcify V2",
      explorerApi: "Etherscan V2 when configured",
      gasRequired: false,
      audit: false
    },
    downloads: {
      abi: `/contracts/${contract}.abi.json`
    },
    conditionalSourceDownloads: true,
    constructorInputs: ["initialOwner"],
    postDeploymentAdmin: true,
    maxPayoutWallets: 5,
    payerId: {
      public: true,
      length: 6,
      comparison: "case-insensitive",
      websiteCheckout: "the signed-in learner's own public referral code"
    },
    refId: {
      public: true,
      length: 6,
      comparison: "case-insensitive",
      websiteCheckout: "the permanent administrator's public referral code as owner of every official SmartLingo language product"
    },
    mainIds: [
      "smartlingo_course_basic_3m",
      "smartlingo_course_intermediate_3m",
      "smartlingo_course_advanced_3m"
    ],
    secondId: "the selected supported learning-language code; the permanent administrator owns each official language product",
    abi: SMARTPAY5_ABI
  });
}
