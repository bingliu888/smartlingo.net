import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import solc from "solc";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entryPath = join(root, "contracts/SmartPay5.sol");
const entryName = "contracts/SmartPay5.sol";
const mockPath = join(root, "contracts/test/MockUSDC.sol");
const mockName = "contracts/test/MockUSDC.sol";
const burnMockPath = join(root, "contracts/test/MockBurnToken.sol");
const burnMockName = "contracts/test/MockBurnToken.sol";

function importSource(importPath) {
  const candidates = [join(root, importPath), join(root, "node_modules", importPath)];
  for (const candidate of candidates) {
    try {
      return { contents: requireRead(candidate) };
    } catch {}
  }
  return { error: `Unable to resolve Solidity import: ${importPath}` };
}

function requireRead(path) {
  const buffer = globalThis.__smartPaySources?.get(path);
  if (!buffer) throw new Error(`Source not preloaded: ${path}`);
  return buffer;
}

async function preload(path, seen = new Set()) {
  if (seen.has(path)) return;
  seen.add(path);
  const source = await readFile(path, "utf8");
  globalThis.__smartPaySources ??= new Map();
  globalThis.__smartPaySources.set(path, source);
  const imports = [...source.matchAll(/import\s+(?:\{[^}]+\}\s+from\s+)?["']([^"']+)["'];/g)].map(match => match[1]);
  for (const importPath of imports) {
    const candidate = importPath.startsWith(".")
      ? resolve(dirname(path), importPath)
      : join(root, "node_modules", importPath);
    await preload(candidate, seen);
  }
}

await Promise.all([preload(entryPath), preload(mockPath), preload(burnMockPath)]);
const [source, mockSource, burnMockSource] = await Promise.all([
  readFile(entryPath, "utf8"),
  readFile(mockPath, "utf8"),
  readFile(burnMockPath, "utf8")
]);
const input = {
  language: "Solidity",
  sources: {
    [entryName]: { content: source },
    [mockName]: { content: mockSource },
    [burnMockName]: { content: burnMockSource }
  },
  settings: {
    optimizer: { enabled: true, runs: 500 },
    viaIR: true,
    evmVersion: "paris",
    metadata: { bytecodeHash: "ipfs" },
    outputSelection: {
      "*": { "*": ["abi", "metadata", "evm.bytecode.object", "evm.deployedBytecode.object"] }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: importSource }));
const diagnostics = (output.errors || []).filter(item => item.severity === "error");
if (diagnostics.length) {
  throw new Error(diagnostics.map(item => item.formattedMessage || item.message).join("\n"));
}

const compiled = output.contracts?.[entryName]?.SmartPay5;
const compiledMock = output.contracts?.[mockName]?.MockUSDC;
const compiledBurnMock = output.contracts?.[burnMockName]?.MockBurnToken;
if (!compiled?.abi || !compiled?.evm?.bytecode?.object) throw new Error("SmartPay5 compilation produced no artifact");
if (!compiledMock?.abi || !compiledMock?.evm?.bytecode?.object) throw new Error("MockUSDC compilation produced no artifact");
if (!compiledBurnMock?.abi || !compiledBurnMock?.evm?.bytecode?.object) throw new Error("MockBurnToken compilation produced no artifact");
const deployedBytecodeBytes = compiled.evm.deployedBytecode.object.length / 2;
if (deployedBytecodeBytes > 24_576) {
  throw new Error(`SmartPay5 deployed bytecode is ${deployedBytecodeBytes} bytes and exceeds the EIP-170 limit`);
}

const abi = `${JSON.stringify(compiled.abi, null, 2)}\n`;
const metadata = JSON.parse(compiled.metadata);
async function verificationInputFor(contractMetadata) {
  const sources = Object.fromEntries(await Promise.all(
  Object.keys(contractMetadata.sources || {}).map(async sourceName => {
    const sourcePath = sourceName.startsWith("@") ? join(root, "node_modules", sourceName) : join(root, sourceName);
    return [sourceName, { content: await readFile(sourcePath, "utf8") }];
  })
  ));
  return { language: "Solidity", sources, settings: input.settings };
}
const standardJsonInput = await verificationInputFor(metadata);
const verificationOutput = JSON.parse(solc.compile(JSON.stringify(standardJsonInput)));
const verificationDiagnostics = (verificationOutput.errors || []).filter(item => item.severity === "error");
if (verificationDiagnostics.length) {
  throw new Error(verificationDiagnostics.map(item => item.formattedMessage || item.message).join("\n"));
}
const verificationBytecode = verificationOutput.contracts?.[entryName]?.SmartPay5?.evm?.bytecode?.object;
if (!verificationBytecode || verificationBytecode !== compiled.evm.bytecode.object) {
  throw new Error("SmartPay5 source-verification input does not reproduce the deployment bytecode");
}
const artifact = {
  contractName: "SmartPay5",
  sourceName: entryName,
  compiler: solc.version(),
  evmVersion: "paris",
  abi: compiled.abi,
  bytecode: `0x${compiled.evm.bytecode.object}`,
  deployedBytecode: `0x${compiled.evm.deployedBytecode.object}`,
  metadata,
  standardJsonInput
};
const mockArtifact = {
  contractName: "MockUSDC",
  sourceName: mockName,
  compiler: solc.version(),
  evmVersion: "paris",
  abi: compiledMock.abi,
  bytecode: `0x${compiledMock.evm.bytecode.object}`,
  deployedBytecode: `0x${compiledMock.evm.deployedBytecode.object}`,
  metadata: JSON.parse(compiledMock.metadata)
};
const burnMockArtifact = {
  contractName: "MockBurnToken",
  sourceName: burnMockName,
  compiler: solc.version(),
  evmVersion: "paris",
  abi: compiledBurnMock.abi,
  bytecode: `0x${compiledBurnMock.evm.bytecode.object}`,
  deployedBytecode: `0x${compiledBurnMock.evm.deployedBytecode.object}`,
  metadata: JSON.parse(compiledBurnMock.metadata)
};

await mkdir(join(root, "contracts/abi"), { recursive: true });
await mkdir(join(root, "contracts/artifacts"), { recursive: true });
await mkdir(join(root, "public/contracts"), { recursive: true });
await writeFile(join(root, "contracts/abi/SmartPay5.json"), abi);
await writeFile(join(root, "public/contracts/SmartPay5.abi.json"), abi);
await writeFile(join(root, "contracts/artifacts/SmartPay5.json"), `${JSON.stringify(artifact, null, 2)}\n`);
await writeFile(join(root, "contracts/artifacts/MockUSDC.json"), `${JSON.stringify(mockArtifact, null, 2)}\n`);
await writeFile(join(root, "contracts/artifacts/MockBurnToken.json"), `${JSON.stringify(burnMockArtifact, null, 2)}\n`);
console.log(`Compiled SmartPay5 with ${solc.version()} (${compiled.abi.length} ABI entries, ${deployedBytecodeBytes} deployed bytes).`);
