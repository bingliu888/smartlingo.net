export function SmartLingoWordmark({ withMark = true }: { withMark?: boolean }) {
  return <>
    {withMark ? <span className="lingo-brand-mark" aria-hidden="true">S</span> : null}
    <span className="smartlingo-wordmark" aria-label="SmartLingo">
      <span>Smart</span><em>Lingo</em>
    </span>
  </>;
}
