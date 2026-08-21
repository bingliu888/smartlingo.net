export function sortCollegesByCode<T extends { code: string }>(items: T[]) {
  return [...items].sort((left, right) => left.code.localeCompare(right.code, "en", { numeric: true }));
}
