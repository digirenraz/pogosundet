// Skeleton shown while /chat/dm/[partnerId] resolves. Mirrors the DM screen
// chrome (60px header with avatar + name, message bubbles, fixed composer —
// the DM screen renders no BottomNav).
export default function DMLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border h-[60px] flex items-center gap-3 px-3">
        <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 flex flex-col gap-1">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <main className="pt-[76px] pb-[80px] px-3 flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-12 rounded-2xl bg-muted animate-pulse ${
              i % 2 === 0 ? 'w-2/3 self-start' : 'w-1/2 self-end'
            }`}
          />
        ))}
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-3 pt-2.5 pb-3.5 flex items-end gap-2">
        <div className="flex-1 h-10 rounded-3xl bg-muted animate-pulse" />
        <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
      </div>
    </div>
  );
}
