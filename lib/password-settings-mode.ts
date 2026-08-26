export type PasswordSettingsMode = "add" | "update";

export function passwordSettingsMode(passwordEnabled: boolean): {
  action: PasswordSettingsMode;
  requiresCurrentPassword: boolean;
} {
  return passwordEnabled
    ? { action: "update", requiresCurrentPassword: true }
    : { action: "add", requiresCurrentPassword: false };
}
