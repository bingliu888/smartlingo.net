export function subscribedCourseHref(locale: string, targetLanguage: string) {
  const query = new URLSearchParams({ mine: "1", target: targetLanguage });
  return `/${locale}/classes?${query.toString()}`;
}
