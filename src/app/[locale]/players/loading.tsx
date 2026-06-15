import { Menu } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';

// Skeleton shown while /players resolves. Mirrors the page chrome (fixed header
// + bottom nav + padded content) so the transition between segments is shift-free.
export default function PlayersLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mirrors the branded AppHeader so the title doesn't shift on load. */}
      <header className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border pt-2.5 px-3.5 pb-3">
        <div className="flex items-center gap-[9px]">
          <span className="w-10 h-10 -ml-2 flex items-center justify-center text-muted-foreground">
            <Menu size={22} />
          </span>
          <div className="w-[30px] h-[30px] rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-28 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-7 w-40 bg-muted rounded animate-pulse mt-3 mx-0.5" />
      </header>

      <main className="pt-[116px] pb-[80px] px-4 flex flex-col gap-3">
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
