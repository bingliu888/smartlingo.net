export default function SmartCardsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div data-layout-page="smartcards">
    <span data-layout-overlap-check="smartcards-start" style={{ display: "block", height: 1 }} />
    {children}
    <span data-layout-overlap-check="smartcards-end" style={{ display: "block", height: 1 }} />
  </div>;
}
