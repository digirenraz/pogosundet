// Skeleton shown while /players/[id] resolves. Mirrors the swipe-deck chrome
// (60px header with back button + counter, full-height card area, no BottomNav).
export default function PlayerDetailLoading() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <div className="h-[60px] flex-shrink-0 border-b border-border flex items-center justify-between px-3 bg-background z-10">
        <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-12 bg-muted rounded animate-pulse" />
        <div className="w-10 h-10" />
      </div>

      <main className="flex-1 px-5 pt-5 pb-3 bg-[#f7f9f8]">
        <div className="bg-card border border-border rounded-lg p-5 flex flex-col items-center gap-4">
          <div className="w-[104px] h-[104px] rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-40 bg-muted rounded animate-pulse" />
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          <div className="w-[224px] h-[224px] bg-muted rounded-md animate-pulse" />
          <div className="h-12 w-full bg-muted rounded-md animate-pulse" />
        </div>
      </main>
    </div>
  );
}
