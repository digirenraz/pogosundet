import { type LucideIcon } from "lucide-react";

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: LucideIcon;
}

// 52px form input with a label and a lucide icon on the left.
// Matches the input style from the Banani login design.
export function AuthInput({ label, icon: Icon, id, ...props }: AuthInputProps) {
  const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="text-sm font-semibold text-foreground ml-0.5"
      >
        {label}
      </label>
      <div className="h-[52px] bg-input border border-border rounded-md flex items-center px-4 gap-3">
        <Icon size={20} className="text-muted-foreground flex-shrink-0" aria-hidden="true" />
        <input
          id={inputId}
          className="flex-1 text-[15px] text-foreground bg-transparent outline-none placeholder:text-muted-foreground"
          {...props}
        />
      </div>
    </div>
  );
}
