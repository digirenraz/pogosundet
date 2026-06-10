// Skeleton shown while /raids/new resolves. Mirrors the raid form chrome
// (60px header with back arrow + title, form fields, no BottomNav).
export default function NewRaidLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-10 bg-card border-b border-border px-4 h-[60px] flex items-center gap-3">
        <div className="w-6 h-6 bg-muted rounded animate-pulse" />
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
      </div>

      <main className="pt-[76px] pb-8 px-4 flex flex-col gap-5">
        {/* Image upload placeholder */}
        <div className="flex flex-col gap-2">
          <div className="h-4 w-28 bg-muted rounded animate-pulse" />
          <div className="h-20 bg-muted rounded-xl animate-pulse" />
        </div>

        {/* Gym + boss + note field placeholders */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-11 bg-muted rounded-lg animate-pulse" />
          </div>
        ))}

        {/* Start-time quick picks */}
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>

        {/* Player count stepper + submit */}
        <div className="h-20 bg-muted rounded-xl animate-pulse" />
        <div className="h-12 bg-primary/40 rounded-lg animate-pulse" />
      </main>
    </div>
  );
}
