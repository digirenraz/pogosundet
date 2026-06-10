import { Menu } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';

// Skeleton shown while /profile resolves.
export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-card border-b border-border flex items-center px-4 z-10">
        {/* Hamburger placeholder — mirrors AppMenu so the title doesn't shift */}
        <span className="w-10 h-10 -ml-2 mr-1 flex items-center justify-center text-muted-foreground">
          <Menu size={22} />
        </span>
        <div className="h-5 w-24 bg-muted rounded animate-pulse" />
      </header>

      <main className="flex-1 pt-[76px] pb-[80px] px-4 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2.5 py-3">
          <div className="w-[104px] h-[104px] rounded-full bg-muted animate-pulse" />
          <div className="h-6 w-40 bg-muted rounded animate-pulse" />
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex gap-2.5">
          <div className="flex-1 h-12 bg-primary/40 rounded-md animate-pulse" />
          <div className="flex-1 h-12 bg-card border border-border rounded-md animate-pulse" />
        </div>
        <div className="h-24 bg-card border border-border rounded-lg animate-pulse" />
      </main>

      <BottomNav />
    </div>
  );
}
