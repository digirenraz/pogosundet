'use client';

// Three bouncing dots used both inline (channel-list previews) and inside
// a bubble (chat stream). The animation keyframes are defined in globals.css
// — see `pgs-typing` below.
interface TypingDotsProps {
  size?: number;
  // Tailwind text color class (the dots inherit currentColor via bg).
  className?: string;
}

export function TypingDots({ size = 6, className = 'text-muted-foreground' }: TypingDotsProps) {
  return (
    <span
      className={`inline-flex items-center gap-[3px] ${className}`}
      style={{ height: size + 2 }}
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="rounded-full bg-current"
          style={{
            width: size,
            height: size,
            animation: 'pgs-typing 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  );
}
