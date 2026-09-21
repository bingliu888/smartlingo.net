export function fittingNavigationCount({
  availableWidth,
  brandWidth,
  controlsWidth,
  headerGap,
  itemWidths,
  itemGap,
}: {
  availableWidth: number;
  brandWidth: number;
  controlsWidth: number;
  headerGap: number;
  itemWidths: number[];
  itemGap: number;
}) {
  for (let count = itemWidths.length; count > 0; count -= 1) {
    const navigationWidth = itemWidths
      .slice(0, count)
      .reduce((total, itemWidth) => total + itemWidth, 0)
      + itemGap * Math.max(0, count - 1);
    if (brandWidth + navigationWidth + controlsWidth + headerGap * 2 <= availableWidth - 2) return count;
  }
  return 0;
}
