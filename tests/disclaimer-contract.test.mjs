import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

async function firstReadable(paths) {
  for (const path of paths) {
    try { return await read(path); } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`None of the expected files exists: ${paths.join(", ")}`);
}

test("footer exposes localized disclaimer and public subscription contracts", async () => {
  const [footer, route, copy, subscriptionCopy, subscriptionRoute] = await Promise.all([
    firstReadable(["../components/SiteFooter.tsx", "../components/site-frame.tsx", "../app/site-footer.tsx", "../app/project-footer.tsx"]),
    firstReadable(["../app/[lang]/disclaimer/page.tsx", "../app/disclaimer/page.tsx"]),
    read("../lib/disclaimer-copy.ts"),
    read("../lib/subscription-copy.ts"),
    firstReadable(["../app/[lang]/pricing/page.tsx", "../app/pricing/page.tsx", "../app/plans/page.tsx", "../app/membership/page.tsx", "../app/[lang]/programs/page.tsx"]),
  ]);
  assert.match(footer, /\/terms[\s\S]*\/disclaimer[\s\S]*\/(?:pricing|plans|membership|programs)[\s\S]*\/(?:project|projects|status)/);
  assert.match(route, /disclaimerFor|kind="disclaimer"|DisclaimerPageContent/);
  for (const locale of ["zh","en","es","ja","ko","fr","de","ru","it","pt","ar","hi","id","bn","ur","pa","ta","te","ne","si","tr"]) {
    assert.match(copy, new RegExp(`\\n  ${locale}: \\{`));
    assert.match(subscriptionCopy, new RegExp(`\\n  ${locale}: `));
  }
  assert.match(footer, /subscriptionLabelFor/);
  assert.doesNotMatch(subscriptionRoute, /redirect\([^)]*(?:auth|sign-?in|login)/i);
  assert.match(copy, /All payments are final and non-refundable/);
  assert.match(copy, /所有付款均为最终付款且不可退款/);
  assert.match(copy, /X, Facebook, TikTok/);
  assert.match(copy, /wallet applications, crypto exchanges/);
});
