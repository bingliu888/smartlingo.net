# SmartPay5 mobile price reads and RefID checkout

The site database is the product catalog: it identifies the three-month course package, learning language, token metadata, and the current USDT/GLC mix percentage. The deployed SmartPay5 contract is the payment authority. A checkout must call the shared product rule with an empty rule `secondId` immediately before displaying a payable option and again before preparing the wallet transaction. SmartPay is available only for the three-month Beginner, Intermediate, and Advanced packages on Polygon; six- and twelve-month packages use card payment. The later `pay(...)` call records the student's selected learning-language code as its transaction `secondId`.

The function is a free `eth_call`:

```solidity
function paymentRule(
    address primaryTokenAddress,
    address secondaryTokenAddress,
    string mainId,
    string secondId
) external view returns (
    uint256 primaryTokenAmount,
    uint256 secondaryTokenAmount,
    uint256 minimumSecondaryBalance,
    bool enabled
);
```

Use the zero address as `secondaryTokenAddress` for a single-token rule. Amounts are atomic integers. Read each ERC-20 token's `decimals()` and format only for display; never use floating-point values to build a transaction.

## TypeScript with viem

```ts
import { createPublicClient, formatUnits, http, type Address } from "viem";
import { polygon } from "viem/chains";

const ZERO = "0x0000000000000000000000000000000000000000" as Address;
const SMARTPAY5_ABI = [
  {
    type: "function",
    name: "paymentRule",
    stateMutability: "view",
    inputs: [
      { name: "primaryTokenAddress", type: "address" },
      { name: "secondaryTokenAddress", type: "address" },
      { name: "mainId", type: "string" },
      { name: "secondId", type: "string" }
    ],
    outputs: [
      { name: "primaryTokenAmount", type: "uint256" },
      { name: "secondaryTokenAmount", type: "uint256" },
      { name: "minimumSecondaryBalance", type: "uint256" },
      { name: "enabled", type: "bool" }
    ]
  }
] as const;

const client = createPublicClient({ chain: polygon, transport: http(POLYGON_RPC_URL) });

async function readSubscriptionPrice(input: {
  smartPay5: Address;
  primaryToken: Address;
  secondaryToken?: Address;
  mainId: "smartlingo_course_basic_3m" | "smartlingo_course_intermediate_3m" | "smartlingo_course_advanced_3m";
  primaryDecimals: number;
  secondaryDecimals?: number;
}) {
  const [primaryAtomic, secondaryAtomic, minimumSecondaryAtomic, enabled] =
    await client.readContract({
      address: input.smartPay5,
      abi: SMARTPAY5_ABI,
      functionName: "paymentRule",
      args: [
        input.primaryToken,
        input.secondaryToken ?? ZERO,
        input.mainId,
        ""
      ]
    });

  if (!enabled || primaryAtomic === 0n) return null;
  return {
    primaryAtomic,
    secondaryAtomic,
    minimumSecondaryAtomic,
    primaryDisplay: formatUnits(primaryAtomic, input.primaryDecimals),
    secondaryDisplay: input.secondaryDecimals == null
      ? "0"
      : formatUnits(secondaryAtomic, input.secondaryDecimals),
    minimumSecondaryDisplay: input.secondaryDecimals == null
      ? "0"
      : formatUnits(minimumSecondaryAtomic, input.secondaryDecimals)
  };
}
```

For a dual-token rule, the contract stores both full equivalent prices. If the site percentage is `p` (0–100), compute exact atomic amounts using integers:

```ts
const primaryToPay = primaryAtomic * BigInt(p) / 100n;
const secondaryToPay = secondaryAtomic * BigInt(100 - p) / 100n;
```

Reject the option if either multiplication is not exactly divisible by 100. The SmartPay5 `pay(...)` call independently derives and validates the same relationship.

## PayerID and product-owner RefID

Every SmartPay5 payment includes two public six-character identities. `payerId` is the current signed-in member who receives the course entitlement. `refId` is the verified permanent administrator who owns the SmartLingo course product. SmartLingo's website checkout obtains both IDs from the server automatically. A third-party client must do the same: never derive either ID from the connected wallet and never ask for a SmartLingo password.

The contract preserves letter case in both fields. SmartLingo later compares the on-chain PayerID and product-owner RefID with the server-authoritative identities case-insensitively, alongside the product identifiers, token pair, and unused TransactionID. The connected wallet is only the funding wallet recorded for audit; it may differ from the profile wallet, and no profile wallet is required.

The contract does not require a second gas transaction to mark a payment used. SmartLingo stores the unique `(contract address, TransactionID)` claim in its database after all fields match, so repeated refreshes cannot extend a subscription twice.

```solidity
function pay(
    address primaryTokenAddress,
    address secondaryTokenAddress,
    string mainId,
    string secondId,
    uint256 primaryTokenAmount,
    string refId,
    string payerId
) external returns (bytes32 transactionId);
```

## Flutter with web3dart

Add `web3dart` and `http`, download the current ABI from `https://smartlingo.net/contracts/SmartPay5.abi.json`, and include it as a Flutter asset.

```dart
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/services.dart' show rootBundle;
import 'package:http/http.dart' as http;
import 'package:web3dart/web3dart.dart';

class SmartPay5Rule {
  final BigInt primaryAmount;
  final BigInt secondaryAmount;
  final BigInt minimumSecondaryBalance;
  final bool enabled;

  const SmartPay5Rule({
    required this.primaryAmount,
    required this.secondaryAmount,
    required this.minimumSecondaryBalance,
    required this.enabled,
  });
}

Future<SmartPay5Rule> readSmartPay5Rule({
  required String rpcUrl,
  required String smartPay5Address,
  required String primaryTokenAddress,
  String secondaryTokenAddress =
      '0x0000000000000000000000000000000000000000',
  required String mainId,
}) async {
  final client = Web3Client(rpcUrl, http.Client());
  try {
    final abiJson = await rootBundle.loadString(
      'assets/contracts/SmartPay5.abi.json',
    );
    final contract = DeployedContract(
      ContractAbi.fromJson(abiJson, 'SmartPay5'),
      EthereumAddress.fromHex(smartPay5Address),
    );
    final paymentRule = contract.function('paymentRule');
    final result = await client.call(
      contract: contract,
      function: paymentRule,
      params: [
        EthereumAddress.fromHex(primaryTokenAddress),
        EthereumAddress.fromHex(secondaryTokenAddress),
        mainId,
        '',
      ],
    );

    return SmartPay5Rule(
      primaryAmount: result[0] as BigInt,
      secondaryAmount: result[1] as BigInt,
      minimumSecondaryBalance: result[2] as BigInt,
      enabled: result[3] as bool,
    );
  } finally {
    client.dispose();
  }
}

String formatAtomic(BigInt value, int decimals) {
  final digits = value.toString().padLeft(decimals + 1, '0');
  if (decimals == 0) return digits;
  final split = digits.length - decimals;
  final whole = digits.substring(0, split);
  final fraction = digits.substring(split).replaceFirst(RegExp(r'0+$'), '');
  return fraction.isEmpty ? whole : '$whole.$fraction';
}
```

Example subscription lookup:

```dart
final rule = await readSmartPay5Rule(
  rpcUrl: polygonRpcUrl,
  smartPay5Address: smartPay5Address,
  primaryTokenAddress: polygonUsdtAddress,
  secondaryTokenAddress: polygonGlcAddress,
  mainId: 'smartlingo_course_basic_3m',
);

if (!rule.enabled || rule.primaryAmount == BigInt.zero) {
  throw StateError('Subscription payment rule is not enabled on-chain');
}

print('${formatAtomic(rule.primaryAmount, 6)} USDT');
print('${formatAtomic(rule.secondaryAmount, 18)} GLC');
```

To prepare a Flutter wallet request, encode the same package `mainId`, the student's selected learning-language code as payment `secondId`, the server-provided permanent-administrator `refId`, and the server-provided signed-in-member `payerId`. The wallet connector must send the transaction; the app must never receive a private key or seed phrase.

```dart
final refIdPattern = RegExp(r'^[A-HJ-NP-Z2-9]{6}$', caseSensitive: false);

Uint8List encodeSmartPay5Payment({
  required DeployedContract contract,
  required String primaryTokenAddress,
  required String secondaryTokenAddress,
  required String mainId,
  required String secondId,
  required BigInt primaryAmount,
  required String refId,
  required String payerId,
}) {
  final ownerValue = refId.trim();
  final payerValue = payerId.trim();
  if (!refIdPattern.hasMatch(ownerValue) || !refIdPattern.hasMatch(payerValue)) {
    throw const FormatException('SmartLingo returned an invalid payment identity');
  }
  return contract.function('pay').encodeCall([
    EthereumAddress.fromHex(primaryTokenAddress),
    EthereumAddress.fromHex(secondaryTokenAddress),
    mainId,
    secondId,
    primaryAmount,
    ownerValue,
    payerValue,
  ]);
}
```

Use `paymentRuleCount()` plus paged `paymentRules(offset, limit)` reads to build the three eligible package products directly from enabled contract rules. The app separately lets the student choose one of SmartLingo's 12 learning languages and passes that code only to `pay(...)`; the payer should never type `mainId` or `secondId`.

The mobile app should obtain the active SmartPay5 contract address and supported token addresses from the authenticated site API, then verify that the returned chain ID matches the wallet's network. Do not hard-code a private RPC key, wallet private key, or seed phrase in the app.
