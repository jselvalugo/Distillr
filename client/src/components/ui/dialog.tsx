import { type ReactNode } from "react";
import { cn } from "../../lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Dialog({ open, onClose, title, children, size = "md" }: DialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={cn(
          "relative bg-white rounded-lg shadow-xl border border-[#e5e5e5] flex flex-col w-full mx-2 my-2 max-h-[calc(100vh-16px)] sm:mx-0 sm:my-0 sm:max-h-[90vh]",
          size === "sm" && "sm:max-w-md",
          size === "md" && "sm:max-w-xl",
          size === "lg" && "sm:max-w-3xl"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5e5] shrink-0">
          <h2 className="text-sm font-semibold text-[#0a0a0a]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#737373] hover:text-[#0a0a0a] text-xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
