# SmartPay4 for SmartLingo.net

`SmartPay4.sol` is the only supported SmartLingo on-chain checkout. Each site and EVM chain uses an independent deployment. The contract owns the payable rules, W1–W5 payout configuration, public transaction records, pause state, withdrawal controls, and immediate Owner transfer.

## Course-payment identifiers

- Three-month Beginner: `mainId = smartlingo_course_basic_3m`
- Three-month Intermediate: `mainId = smartlingo_course_intermediate_3m`
- Three-month Advanced: `mainId = smartlingo_course_advanced_3m`
- Price-rule `secondId`: the empty string, so all languages share one price
- Payment `secondId`: one supported learning-language code, such as `es`

The public catalog has exactly nine fixed-term packages: three levels at 3, 6, and 12 months. Card payment supports all nine. SmartPay4 supports only the three 3-month packages on Polygon. A successful claim grants the selected 3-month level for the language recorded in the transaction `secondId`.

These identifiers are implementation details shown only in the administrator console. Customer pages display the subscription duration and token amounts.

## Authoritative price rule

The admin database supplies the three eligible product labels, token decimals, and desired SmartPay4 mix percentage. Before displaying an enabled checkout or creating a payment request, the server reads the product-level rule with `paymentRule(primaryToken, secondaryToken, mainId, "")`. A candidate is hidden unless the returned rule is enabled and matches the configured on-chain product. The returned atomic token amounts and eligibility threshold are authoritative for payment. The later `pay(...)` call supplies the selected learning language as `secondId` and the contract validates it against SmartLingo's 12 supported language codes.

`paymentRule` and all other view functions use `eth_call`: no connected wallet, signature, or gas is required.

## Rule modes

A rule stores:

1. primary token address and full primary price;
2. optional secondary token address and full equivalent secondary price;
3. the 3-month package `mainId` and an empty rule `secondId`;
4. minimum secondary-token balance; and
5. enabled state.

For a single-token rule, the secondary address and amounts are zero. For a dual-token rule, the site chooses a primary-token percentage from 0–100 after the payer connects. `pay(...)` resolves the shared product rule, validates the package and language, derives the exact secondary amount from the two full on-chain prices, and rejects every invalid ratio. Historical records keep the selected language and amounts actually paid, so later database percentage changes do not change old transactions.

## Public reads and transaction records

Anyone can call `paymentRule`, `paymentRules`, `payoutConfiguration`, `transactionById`, `getTransactionsByPayerID`, and `getLatestTransactions` without gas. Both list functions accept 1–100 records and return newest first. `getTransactionsByPayerID(payerId, maxCount)` reads one signed-in account's records; `getLatestTransactions(maxCount)` is the administrator's contract-wide audit view.

Each transaction records the ID, timestamp, funding wallet, the signed-in account's public six-character PayerID, the permanent administrator's six-character product-owner RefID, product identifiers, primary token and amount, and secondary token and amount. Both IDs preserve letter case. SmartLingo compares them case-insensitively and requires PayerID, product-owner RefID, product, token pair, and unused TransactionID to match before granting or extending a subscription. The funding wallet remains audit data and is not an account identity.

SmartLingo's signed-in checkout obtains both identities from the server: `payerId` is the current member and `refId` is the verified permanent administrator who owns every SmartLingo course product. The connected wallet may be different from the profile wallet, and the profile may have no wallet. Third-party clients must obtain the same two server-authoritative IDs instead of deriving either identity from the connected wallet. The contract accepts upper- or lower-case unambiguous ID characters but rejects every value that is not exactly six characters.

"Used" status is intentionally site-side: the immutable contract record stays publicly readable, while the SmartLingo database has a unique `(contract, TransactionID)` claim and marks the matching subscription record once. A member refresh therefore needs only free view calls; it never asks the payer to spend gas merely to mark a transaction used.

## Owner controls

Only the current Owner can:

- create or update payment rules;
- configure one to five payout wallets and remainder percentages;
- pause or unpause payments;
- withdraw ERC-20 tokens accidentally sent directly to the contract;
- transfer ownership immediately to a new wallet.

Ownership renunciation is disabled. After `transferOwnership(newOwner)` confirms, the old Owner immediately loses every privileged operation.

## Deployment and artifacts

Compile with `npm run contracts:compile`. The build produces:

- `contracts/artifacts/SmartPay4.json`
- `contracts/abi/SmartPay4.json`
- `public/contracts/SmartPay4.abi.json`

The browser deployment uses the repository artifact and requires the Owner to confirm the EVM transaction in TP Wallet or another compatible wallet. No private key or seed phrase belongs in the site, repository, terminal, or admin form. Optional source verification is off-chain, costs no gas, and is not a security audit.

The public ABI is served at `/contracts/SmartPay4.abi.json`; the structured endpoint is `/api/billing/crypto/smartpay/abi`. Mobile integration examples are in `docs/smartpay4-mobile-integration.md`.
