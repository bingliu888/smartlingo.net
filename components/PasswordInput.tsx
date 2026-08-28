"use client";

import { InputHTMLAttributes, useId, useState } from "react";
import { passwordVisibility, type PasswordVisibilityLanguage } from "../lib/password-visibility";
import styles from "./password-input.module.css";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  lang: PasswordVisibilityLanguage;
  hint?: string;
};

export function PasswordInput({ label, lang, hint, id, ...inputProps }: PasswordInputProps) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const [revealed, setRevealed] = useState(false);
  const view = passwordVisibility(revealed, lang);

  return <div className={styles.group}>
    <label htmlFor={fieldId}>{label}</label>
    <span className={styles.field} data-layout-allow-overlap="intentional">
      <input {...inputProps} id={fieldId} type={view.type} aria-describedby={hintId || inputProps["aria-describedby"]} />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setRevealed(value => !value)}
        aria-label={view.label}
        aria-controls={fieldId}
        aria-pressed={revealed}
        title={view.label}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {revealed ? <path d="m4 4 16 16" /> : null}
        </svg>
      </button>
    </span>
    {hint ? <small id={hintId}>{hint}</small> : null}
  </div>;
}
