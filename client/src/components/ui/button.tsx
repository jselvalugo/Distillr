import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "md", className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
          variant === "default" && "bg-[var(--brand)] text-white hover:bg-[var(--brand)]",
          variant === "outline" && "border border-[#e5e5e5] bg-white text-[#0a0a0a] hover:bg-[#f7f7f7]",
          variant === "ghost" && "text-[#0a0a0a] hover:bg-[#f7f7f7]",
          variant === "destructive" && "bg-red-600 text-white hover:bg-red-700",
          size === "sm" && "h-7 px-2.5 text-xs rounded",
          size === "md" && "h-9 px-3.5 text-sm rounded-md",
          size === "lg" && "h-10 px-5 text-sm rounded-md",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
