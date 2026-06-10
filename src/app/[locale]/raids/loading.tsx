import { Menu } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';

// Skeleton shown while /raids resolves.
export default function RaidsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border px-4 h-[60px] flex items-center justify-between">
        <div className="flex items-center">
          {/* Hamburger placeholder — mobile only, mirrors the real header */}
          <span className="lg:hidden w-10 h-10 -ml-2 mr-1 flex items-center justify-center text-muted-foreground">
            <Menu size={22} />
          </span>
          <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="bg-primary/40 rounded-full w-9 h-9 animate-pulse" />
      </div>

      <main className="pt-[76px] pb-[80px] px-4 flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-card border border-border rounded-lg animate-pulse" />
        ))}
      </main>

      <BottomNav />
    </div>
  );
}
