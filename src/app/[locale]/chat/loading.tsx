import { BottomNav } from '@/components/BottomNav';

// Skeleton shown while /chat resolves.
export default function ChatLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border px-4 h-[60px] flex items-center">
        <div className="h-5 w-16 bg-muted rounded animate-pulse" />
      </div>

      <main className="pt-[76px] pb-[80px] px-3 flex flex-col gap-5">
        {/* Online strip skeleton */}
        <div className="flex flex-col gap-2.5">
          <div className="h-3.5 w-24 bg-muted rounded animate-pulse mx-1" />
          <div className="flex gap-3.5 px-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
                <div className="h-3 w-12 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Channel rows skeleton */}
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-card border border-border rounded-lg animate-pulse"
            />
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
