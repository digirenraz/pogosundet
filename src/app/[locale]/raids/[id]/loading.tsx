import { BottomNav } from '@/components/BottomNav';

// Skeleton shown while a raid detail page resolves.
export default function RaidDetailLoading() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-card border-b border-border flex items-center px-4 z-10">
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
      </header>

      <main className="pt-[76px] pb-[80px] px-4 flex flex-col gap-4">
        <div className="aspect-video bg-card border border-border rounded-lg animate-pulse" />
        <div className="h-20 bg-card border border-border rounded-lg animate-pulse" />
        <div className="h-24 bg-card border border-border rounded-lg animate-pulse" />
      </main>

      <BottomNav />
    </div>
  );
}
