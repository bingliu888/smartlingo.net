import { spawn } from "node:child_process";

function milliseconds(value, fallback) {
  const match = String(value ?? "").trim().match(/^(\d+)(ms|s|m)?$/);
  if (!match) return fallback;
  const amount = Number(match[1]);
  return amount * (match[2] === "m" ? 60_000 : match[2] === "s" ? 1_000 : 1);
}

const [limitValue, killAfterValue, command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: run-bounded.mjs limit kill-after command [args...]");
  process.exit(64);
}

const limit = milliseconds(limitValue, 180_000);
const killAfter = milliseconds(killAfterValue, 10_000);
const child = spawn(command, args, { stdio: "inherit", env: process.env });
let timedOut = false;

const hardStop = () => {
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
};
const timer = setTimeout(() => {
  timedOut = true;
  console.error(`Command exceeded ${limitValue}; terminating it.`);
  child.kill("SIGTERM");
  setTimeout(hardStop, killAfter).unref();
}, limit);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", error => {
  clearTimeout(timer);
  console.error(error.message);
  process.exitCode = 69;
});

child.on("exit", (code, signal) => {
  clearTimeout(timer);
  process.exitCode = timedOut ? 124 : code ?? (signal ? 1 : 0);
});
