import type { Address } from "viem";
import { atomicTokenAmountToDisplay } from "./crypto-amount";
import { cryptoRpcUrl } from "./crypto-rpc";
import { activeCryptoSettings, type CryptoPaymentSetting } from "./crypto-settings";
import { availableSmartPayCheckoutIdentity, configuredSmartPay3CheckoutScopes, type SmartPayCheckoutOption } from "./smartpay-checkout";
import { cryptoSubscriptionIdsForCourse } from "./crypto-subscription";
import { smartPay3RulePresets, smartPay3RulePresetStatus } from "./smartpay3-presets";
import { smartPay3PaymentRules, smartPay3PayoutConfigurationRaw, verifySmartPay3Identity } from "./smartpay3-server";
import { fixedCourseId } from "./smartlingo-course-packages";
import {
  isSmartLingoCommunityLanguage,
  SMARTLINGO_COMMUNITY_LANGUAGE_CODES,
  type SmartLingoCommunityLanguage,
} from "./smartlingo-language-communities";

export async function currentSmartPayCheckoutOptions(
  inputSettings?: readonly CryptoPaymentSetting[],
  selectedLanguage?: SmartLingoCommunityLanguage,
) {
  const settings = inputSettings ? [...inputSettings] : await activeCryptoSettings();
  const languages = selectedLanguage ? [selectedLanguage] : SMARTLINGO_COMMUNITY_LANGUAGE_CODES;
  return (await Promise.all(configuredSmartPay3CheckoutScopes(settings).map(async scope => {
    const rpcUrl = await cryptoRpcUrl(scope.chainId);
    if (!rpcUrl) return [] as SmartPayCheckoutOption[];
    const contractAddress = scope.contractAddress as Address;
    const identity = await availableSmartPayCheckoutIdentity(() => verifySmartPay3Identity(rpcUrl, contractAddress));
    if (!identity || identity.paused) return [] as SmartPayCheckoutOption[];
    const [payouts, rules] = await Promise.all([smartPay3PayoutConfigurationRaw(rpcUrl, contractAddress), smartPay3PaymentRules(rpcUrl, contractAddress)]);
    if (!payouts.length) return [] as SmartPayCheckoutOption[];
    return smartPay3RulePresets(settings, scope.chainId).flatMap(preset => {
      const rule = smartPay3RulePresetStatus(preset, rules).rule;
      if (!rule?.enabled || BigInt(rule.primaryTokenAmount) <= 0n) return [];
      const fullPrimary = BigInt(rule.primaryTokenAmount), fullSecondary = BigInt(rule.secondaryTokenAmount);
      if (preset.mode === "dual" ? fullSecondary <= 0n : fullSecondary !== 0n) return [];
      const primaryNumerator = fullPrimary * BigInt(preset.primaryPercent);
      const secondaryNumerator = fullSecondary * BigInt(preset.secondaryPercent);
      if (primaryNumerator % 100n || secondaryNumerator % 100n) return [];
      const primaryAtomic = primaryNumerator / 100n, secondaryAtomic = secondaryNumerator / 100n;
      const primarySetting = settings.find(item => item.id === preset.primarySettingId);
      const secondarySetting = preset.mode === "dual" ? settings.find(item => item.id === preset.secondarySettingId) : null;
      if (!primarySetting || (preset.mode === "dual" && !secondarySetting)) return [];
      const minConfirmations = secondarySetting ? Math.max(primarySetting.minConfirmations, secondarySetting.minConfirmations) : primarySetting.minConfirmations;
      return languages.map(languageCode => {
        const ids = cryptoSubscriptionIdsForCourse(languageCode, preset.plan);
        const classId = fixedCourseId(languageCode, preset.plan);
        return {
          key: `smartpay3:${preset.key}:${languageCode}`, settingId: primarySetting.id, plan: preset.plan, months: 3,
          languageCode, classId, chainId: primarySetting.chainId, chainName: primarySetting.chainName,
          contractAddress, tokenAddress: preset.primaryTokenAddress, tokenSymbol: preset.primaryTokenSymbol,
          tokenDecimals: preset.primaryTokenDecimals, tokenAmountAtomic: fullPrimary.toString(),
          tokenAmount: atomicTokenAmountToDisplay(fullPrimary, preset.primaryTokenDecimals), mainId: ids.mainId, secondId: ids.secondId, minConfirmations,
          smartPay3Offer: {
            mode: preset.mode, contractAddress, primaryTokenAddress: preset.primaryTokenAddress, primaryTokenSymbol: preset.primaryTokenSymbol,
            primaryTokenDecimals: preset.primaryTokenDecimals, primaryTokenAmountAtomic: primaryAtomic.toString(),
            primaryTokenAmount: atomicTokenAmountToDisplay(primaryAtomic, preset.primaryTokenDecimals), primaryPercent: preset.primaryPercent,
            secondaryTokenAddress: preset.secondaryTokenAddress, secondaryTokenSymbol: preset.secondaryTokenSymbol,
            secondaryTokenDecimals: preset.secondaryTokenDecimals, secondaryTokenAmountAtomic: secondaryAtomic.toString(),
            secondaryTokenAmount: atomicTokenAmountToDisplay(secondaryAtomic, preset.secondaryTokenDecimals), secondaryPercent: preset.secondaryPercent,
            minimumSecondaryBalanceAtomic: rule.minimumSecondaryBalance,
            minimumSecondaryBalance: atomicTokenAmountToDisplay(BigInt(rule.minimumSecondaryBalance), preset.secondaryTokenDecimals),
            mainId: ids.mainId, secondId: ids.secondId, minConfirmations,
          },
        } satisfies SmartPayCheckoutOption;
      });
    });
  }))).flat();
}

export async function currentSmartPayCheckoutOption(settingId: string, classId: string) {
  const languageCode = /^course_([a-z]{2})_(?:basic|intermediate|advanced)$/.exec(classId)?.[1] || "";
  if (!isSmartLingoCommunityLanguage(languageCode)) return null;
  return (await currentSmartPayCheckoutOptions(undefined, languageCode))
    .find(option => option.settingId === settingId && option.classId === classId) || null;
}
