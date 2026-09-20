export type SmartPayApprovalState = {
  nextAction: "approve-primary" | "approve-secondary" | "pay";
};

export async function waitForSmartPayApprovalTransition<T extends SmartPayApprovalState>(input: {
  previousAction: Exclude<SmartPayApprovalState["nextAction"], "pay">;
  read: () => Promise<T>;
  onRead?: (state: T) => void;
  attempts?: number;
  intervalMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
}) {
  const attempts = Math.max(1, input.attempts ?? 10);
  const intervalMs = Math.max(0, input.intervalMs ?? 1_000);
  const wait = input.wait ?? (milliseconds => new Promise<void>(resolve => window.setTimeout(resolve, milliseconds)));
  let state: T | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    state = await input.read();
    input.onRead?.(state);
    if (state.nextAction !== input.previousAction) return { state, transitioned: true } as const;
    if (attempt + 1 < attempts) await wait(intervalMs);
  }

  return { state: state!, transitioned: false } as const;
}
