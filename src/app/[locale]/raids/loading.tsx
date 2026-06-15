import { Menu } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';

// Skeleton shown while /raids resolves.
export default function RaidsLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mobile: branded header skeleton (icon + wordmark + large title + action). */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-10 bg-card border-b border-border pt-2.5 px-3.5 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[9px]">
            <span className="w-10 h-10 -ml-2 flex items-center justify-center text-muted-foreground">
              <Menu size={22} />
            </span>
            <div className="w-[30px] h-[30px] rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-28 bg-muted rounded animate-pulse" />
          </div>
          <div className="bg-primary/40 rounded-full w-10 h-10 animate-pulse" />
        </div>
        <div className="h-7 w-36 bg-muted rounded animate-pulse mt-3 mx-0.5" />
      </div>

      {/* Desktop: simple header skeleton. */}
      <div className="hidden lg:flex fixed top-0 left-0 right-0 z-10 bg-card border-b border-border px-4 h-[60px] items-center justify-between">
        <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        <div className="bg-primary/40 rounded-full w-9 h-9 animate-pulse" />
      </div>

      <main className="pt-[116px] lg:pt-[76px] pb-[80px] px-4 flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-card border border-border rounded-lg animate-pulse" />
        ))}
      </main>

      <BottomNav />
    </div>
  );
}
