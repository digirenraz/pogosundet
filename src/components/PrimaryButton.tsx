interface PrimaryButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

// 52px full-width teal button — the main CTA across all auth screens.
export function PrimaryButton({
  children,
  className = "",
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={`h-[52px] w-full bg-primary text-primary-foreground rounded-md flex items-center justify-center text-base font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-opacity ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
