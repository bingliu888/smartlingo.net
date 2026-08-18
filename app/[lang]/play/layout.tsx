export default function PlayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div data-layout-page="play">
    <span data-layout-overlap-check="play-start" style={{ display: "block", height: 1 }} />
    {children}
    <span data-layout-overlap-check="play-end" style={{ display: "block", height: 1 }} />
  </div>;
}
