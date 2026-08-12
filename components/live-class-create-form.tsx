"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function defaultStartTime() {
  const nextHour = new Date(Date.now() + 60 * 60 * 1000);
  return nextHour.toISOString().slice(0, 16);
}

export function LiveClassCreateForm({ basePath = "/classrooms" }: { basePath?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStartTime);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(form.entries());
      const response = await fetch("/api/classrooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as { code?: string; error?: string };
      if (response.ok && result.code) {
        router.push(`${basePath}/${result.code}`);
        return;
      }
      setError(result.error || "Unable to create class");
    } catch {
      setError("Unable to create class");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="class-form" onSubmit={submit}>
      <label>Class title<input name="title" required minLength={3} maxLength={120} /></label>
      <label>Subject<input name="subject" maxLength={80} /></label>
      <label>Description<textarea name="description" maxLength={2000} /></label>
      <div>
        <label>Class type<select name="classType" defaultValue="public"><option value="public">Public</option><option value="trial">Trial</option><option value="private">Private</option></select></label>
        <label>Streaming<select name="streamingMode" defaultValue="video"><option value="video">Audio / Video</option><option value="audio">Audio only</option></select></label>
        <label>Interaction<select name="realtimeMode" defaultValue="group_call"><option value="group_call">Group call · up to 100 interactive participants</option><option value="webinar">Webinar · viewers raise hand, 9 on stage</option><option value="livestream">Livestream · invited speakers, 9 on stage</option></select></label>
      </div>
      <div>
        <label>Start time<input name="startsAt" type="datetime-local" required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label>Duration (minutes)<input name="durationMinutes" type="number" min={15} max={480} defaultValue={60} /></label>
      </div>
      <div>
        <input type="hidden" name="trialMinutes" value={10080} />
        <label>Tuition (USD)<input name="tuition" type="number" min={0} step="0.01" defaultValue={0} /></label>
      </div>
      <label>Private invitation emails<textarea name="invites" placeholder="name@example.com, another@example.com" /></label>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "Creating…" : "Create class"}</button>
    </form>
  );
}
