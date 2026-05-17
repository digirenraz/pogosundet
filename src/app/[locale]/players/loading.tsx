import { BottomNav } from '@/components/BottomNav';

// Skeleton shown while /players resolves. Mirrors the page chrome (fixed header
// + bottom nav + padded content) so the transition between segments is shift-free.
export default function PlayersLoading() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-card border-b border-border flex items-center px-4 z-10">
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
      </header>

      <main className="pt-[76px] pb-[80px] px-4 flex flex-col gap-3">
        <div className="h-10 bg-input rounded-[24px] animate-pulse" />
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-16 bg-card border border-border rounded-full animate-pulse" />
          ))}
        </div>
        <div className="flex flex-col gap-3 mt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-card border border-border rounded-lg animate-pulse" />
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
