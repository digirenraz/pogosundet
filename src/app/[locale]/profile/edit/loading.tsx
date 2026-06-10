import { BottomNav } from '@/components/BottomNav';

// Skeleton shown while /profile/edit resolves. Mirrors the edit page chrome
// (back-arrow header, profile form fields, BottomNav).
export default function ProfileEditLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border bg-card">
        <div className="w-6 h-6 bg-muted rounded animate-pulse" />
        <div className="h-5 w-32 bg-muted rounded animate-pulse" />
      </div>

      <main className="flex-1 px-4 pt-4 pb-[96px] flex flex-col gap-5">
        {/* Avatar picker placeholder */}
        <div className="flex flex-col items-center gap-2.5 py-3">
          <div className="w-[104px] h-[104px] rounded-full bg-muted animate-pulse" />
        </div>

        {/* Form field placeholders (label + input pairs) */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-4 w-28 bg-muted rounded animate-pulse" />
            <div className="h-11 bg-muted rounded-lg animate-pulse" />
          </div>
        ))}

        {/* Submit button */}
        <div className="h-12 bg-primary/40 rounded-lg animate-pulse" />
      </main>

      <BottomNav />
    </div>
  );
}
