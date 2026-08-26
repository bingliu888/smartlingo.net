import { createId, getDatabase } from "./auth";

export { createId };

export function database() {
  return getDatabase();
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}
