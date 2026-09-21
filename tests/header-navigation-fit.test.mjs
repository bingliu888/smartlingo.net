import assert from "node:assert/strict";
import test from "node:test";
import { fittingNavigationCount } from "../lib/header-navigation-fit.ts";

const fit = availableWidth => fittingNavigationCount({
  availableWidth,
  brandWidth: 190,
  controlsWidth: 92,
  headerGap: 20,
  itemWidths: [58, 82, 66, 74],
  itemGap: 18,
});

test("localized header reveals the longest leading navigation sequence that fits", () => {
  assert.equal(fit(658), 4);
  assert.equal(fit(566), 3);
  assert.equal(fit(500), 2);
  assert.equal(fit(420), 1);
  assert.equal(fit(360), 0);
  assert.equal(fit(658), 4, "widening restores every item without a refresh");
});

test("rendered label widths can change the visible count for another locale", () => {
  const compactLabels = fittingNavigationCount({ availableWidth: 480, brandWidth: 190, controlsWidth: 92, headerGap: 16, itemWidths: [28, 42, 28], itemGap: 14 });
  const longLabels = fittingNavigationCount({ availableWidth: 480, brandWidth: 190, controlsWidth: 92, headerGap: 16, itemWidths: [76, 92, 70], itemGap: 14 });
  assert.equal(compactLabels, 3);
  assert.equal(longLabels, 1);
});
