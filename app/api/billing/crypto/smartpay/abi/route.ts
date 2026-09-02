import { NextResponse } from "next/server";
import { SMARTPAY4_ABI } from "../../../../../../lib/smartpay4";

export const dynamic = "force-dynamic";
export async function GET() {
  const contract = "SmartPay4";
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
    refId: {
      public: true,
      length: 6,
      casePreservedOnChain: true,
      comparison: "case-insensitive",
      websiteCheckout: "automatically supplied from the signed-in member profile",
      thirdPartyCheckout: "supplied by the payer"
    },
    mainIds: [
      "bingacademy_membership_monthly",
      "bingacademy_membership_six_month",
      "bingacademy_membership_annual"
    ],
    subscriptionSecondId: "",
    abi: SMARTPAY4_ABI
  });
}
