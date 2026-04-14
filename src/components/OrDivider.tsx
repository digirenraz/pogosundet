interface OrDividerProps {
  text: string;
}

// Horizontal divider with a centred label — used between primary and Google buttons.
export function OrDivider({ text }: OrDividerProps) {
  return (
    <div className="flex items-center gap-4 my-1" role="separator">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
        {text}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
