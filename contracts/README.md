# SmartPay3 for SmartLingo.net

`SmartPay3.sol` is the only supported SmartLingo on-chain checkout. Each site and EVM chain uses an independent deployment. The contract owns the payable rules, W1–W5 payout configuration, public transaction records, pause state, withdrawal controls, and immediate Owner transfer.

## Course-payment identifiers

- Annual course access: `mainId = smartlingo_course_annual`
- Concrete course: `secondId = course_<language>_<tier>`
- Example: `course_es_basic`

The website maintains 12 target languages and three course tiers. Every successful claim adds one year to that exact course. Credit-card monthly course billing remains a separate existing flow.

These identifiers are implementation details shown only in the administrator console. Customer pages display the subscription duration and token amounts.

## Authoritative price rule

The admin database supplies candidate products, labels, token decimals, and the desired SmartPay3 mix percentage. Before displaying an enabled checkout or creating a payment request, the server reads the deployed contract with `paymentRule(primaryToken, secondaryToken, mainId, secondId)`. A candidate is hidden unless the returned rule is enabled and matches the configured on-chain product. The returned atomic token amounts and eligibility threshold are authoritative for payment.

`paymentRule` and all other view functions use `eth_call`: no connected wallet, signature, or gas is required.

## Rule modes

A rule stores:

1. primary token address and full primary price;
2. optional secondary token address and full equivalent secondary price;
3. `mainId` and `secondId`;
4. minimum secondary-token balance; and
5. enabled state.

For a single-token rule, the secondary address and amounts are zero. For a dual-token rule, the site chooses a primary-token percentage from 0–100 after the payer connects. `pay(...)` derives the exact secondary amount from the two full on-chain prices and rejects every invalid ratio. Historical records keep the amounts actually paid, so later database percentage changes do not change old transactions.

## Public reads and transaction records

Anyone can call `paymentRule`, `paymentRules`, `payoutConfiguration`, `transactionById`, and `latestTransactions` without gas. `latestTransactions(address wallet, uint256 maxCount)` accepts 1–100 records and returns newest first. Pass the zero address for the latest contract-wide records or a payer address for that wallet.

Each transaction records the ID, timestamp, payer wallet, the public six-character recipient RefID, product identifiers, primary token and amount, and secondary token and amount. RefID preserves the caller's letter case. SmartLingo compares it case-insensitively and requires the wallet, RefID, product, token pair, and unused TransactionID to match before granting or extending a subscription.

SmartLingo's signed-in checkout obtains the member RefID from the server and supplies it automatically. A third-party app may ask the payer for the recipient's visible six-character RefID and pass the entered case unchanged. The contract accepts upper- or lower-case unambiguous RefID characters but rejects every value that is not exactly six characters.

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

- `contracts/artifacts/SmartPay3.json`
- `contracts/abi/SmartPay3.json`
- `public/contracts/SmartPay3.abi.json`

The browser deployment uses the repository artifact and requires the Owner to confirm the EVM transaction in TP Wallet or another compatible wallet. No private key or seed phrase belongs in the site, repository, terminal, or admin form. Optional source verification is off-chain, costs no gas, and is not a security audit.

The public ABI is served at `/contracts/SmartPay3.abi.json`; the structured endpoint is `/api/billing/crypto/smartpay/abi`. Mobile integration examples are in `docs/smartpay3-mobile-integration.md`.
