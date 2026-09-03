import {
  encodeDeployData,
  encodeFunctionData,
  getCreate2Address,
  isAddress,
  keccak256,
  stringToHex,
  toHex,
  type Abi,
  type Address,
  type Hex
} from "viem";

export type SmartPay5DeploymentArtifact = {
  contractName: "SmartPay5";
  compiler: string;
  bytecode: Hex;
  constructorInputs: ["initialOwner"];
};

type SmartPay5DeploymentProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

const DEPLOYMENT_GAS_BUFFER_PERCENT = 25n;
export const SMARTPAY5_FACTORY_ADDRESS = "0xce0042B868300000d44A59004Da54A005ffdcf9f" as Address;
export const SMARTPAY5_FACTORY_RUNTIME_CODE_HASH = "0xc4d5542b53a8b779595a20a8ddd60e58a6c49d3c3decc2df83ced1c69c8ca807" as Hex;

const SMARTPAY5_FACTORY_ABI = [{
  type: "function",
  name: "deploy",
  stateMutability: "nonpayable",
  inputs: [{ name: "_initCode", type: "bytes" }, { name: "_salt", type: "bytes32" }],
  outputs: [{ name: "createdContract", type: "address" }]
}] as const;

export function smartPay5DeploymentData(artifact: SmartPay5DeploymentArtifact, initialOwner: Address, abi: Abi) {
  if (artifact.contractName !== "SmartPay5" || artifact.constructorInputs?.[0] !== "initialOwner"
    || !/^0x(?:[0-9a-f]{2})+$/i.test(artifact.bytecode) || !isAddress(initialOwner)) {
    throw new Error("INVALID_SMARTPAY5_DEPLOYMENT_ARTIFACT");
  }
  return encodeDeployData({ abi, bytecode: artifact.bytecode, args: [initialOwner] });
}

export function smartPay5AddressFromReceipt(receipt: { contractAddress?: unknown; to?: unknown }, expectedFactoryAddress?: unknown) {
  const address = String(receipt.contractAddress || "");
  if (isAddress(address)) return address as Address;
  const expected = String(expectedFactoryAddress || "");
  if (isAddress(expected) && String(receipt.to || "").toLowerCase() === SMARTPAY5_FACTORY_ADDRESS.toLowerCase()) {
    return expected as Address;
  }
  throw new Error("DEPLOYMENT_ADDRESS_MISSING");
}

export function smartPay5FactoryDeploymentFromSalt(creationData: Hex, salt: Hex) {
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(creationData) || !/^0x[0-9a-f]{64}$/i.test(salt)) {
    throw new Error("INVALID_SMARTPAY5_FACTORY_DEPLOYMENT");
  }
  return {
    factoryAddress: SMARTPAY5_FACTORY_ADDRESS,
    salt,
    contractAddress: getCreate2Address({ from: SMARTPAY5_FACTORY_ADDRESS, salt, bytecode: creationData }),
    data: encodeFunctionData({ abi: SMARTPAY5_FACTORY_ABI, functionName: "deploy", args: [creationData, salt] })
  };
}

export function smartPay5FactoryDeployment(
  creationData: Hex,
  initialOwner: Address,
  chainId: number,
  siteScope: string,
  deploymentId = ""
) {
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(creationData) || !isAddress(initialOwner)
    || !Number.isSafeInteger(chainId) || chainId <= 0 || !/^[a-z0-9.-]+$/i.test(siteScope)
    || (deploymentId && !/^[a-z0-9_-]{8,128}$/i.test(deploymentId))) {
    throw new Error("INVALID_SMARTPAY5_FACTORY_DEPLOYMENT");
  }
  const salt = keccak256(stringToHex(deploymentId
    ? `smartpay5:v2:${siteScope.toLowerCase()}:${chainId}:${initialOwner.toLowerCase()}:${deploymentId.toLowerCase()}`
    : `smartpay5:v1:${siteScope.toLowerCase()}:${chainId}:${initialOwner.toLowerCase()}`));
  return smartPay5FactoryDeploymentFromSalt(creationData, salt);
}

export function smartPay5DeploymentGasLimit(estimate: unknown) {
  if (typeof estimate !== "string" || !/^0x[0-9a-f]+$/i.test(estimate)) {
    throw new Error("DEPLOYMENT_GAS_ESTIMATE_INVALID");
  }
  const estimated = BigInt(estimate);
  if (estimated <= 0n) throw new Error("DEPLOYMENT_GAS_ESTIMATE_INVALID");
  return toHex(estimated + ((estimated * DEPLOYMENT_GAS_BUFFER_PERCENT + 99n) / 100n));
}

export async function requestSmartPay5Deployment(
  provider: SmartPay5DeploymentProvider,
  from: Address,
  creationData: Hex,
  input: { chainId: number; siteScope: string; deploymentId?: string }
) {
  if (!isAddress(from) || !/^0x(?:[0-9a-f]{2})+$/i.test(creationData)) {
    throw new Error("INVALID_SMARTPAY5_DEPLOYMENT_TRANSACTION");
  }
  const deployment = smartPay5FactoryDeployment(creationData, from, input.chainId, input.siteScope, input.deploymentId);
  const factoryCode = await provider.request({ method: "eth_getCode", params: [deployment.factoryAddress, "latest"] }).catch(() => null);
  if (typeof factoryCode !== "string" || !/^0x(?:[0-9a-f]{2})+$/i.test(factoryCode)
    || keccak256(factoryCode as Hex) !== SMARTPAY5_FACTORY_RUNTIME_CODE_HASH) {
    throw new Error("DEPLOYMENT_FACTORY_UNAVAILABLE");
  }
  const transactionBase = { from, to: deployment.factoryAddress, data: deployment.data, value: "0x0" as const };
  let estimate: unknown;
  try {
    estimate = await provider.request({ method: "eth_estimateGas", params: [transactionBase] });
  } catch {
    throw new Error("DEPLOYMENT_GAS_ESTIMATE_FAILED");
  }
  const transaction = { ...transactionBase, gas: smartPay5DeploymentGasLimit(estimate) };
  const hash = await provider.request({ method: "eth_sendTransaction", params: [transaction] });
  if (typeof hash !== "string" || !/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error("NO_TRANSACTION_HASH");
  return { hash, contractAddress: deployment.contractAddress, salt: deployment.salt };
}
