import { activeCryptoPaymentSettings, allCryptoPaymentSettings, cryptoPaymentSettingById } from "./crypto-payments";
export type { CryptoPaymentSetting } from "./crypto-contract";
export const activeCryptoSettings = activeCryptoPaymentSettings;
export const allCryptoSettings = allCryptoPaymentSettings;
export const cryptoSettingById = cryptoPaymentSettingById;
