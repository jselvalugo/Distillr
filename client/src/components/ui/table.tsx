import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full text-sm border-collapse", className)} {...props} />
    </div>
  );
}

export function Thead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-[#e5e5e5] bg-[#fafafa]", className)} {...props} />;
}

export function Tbody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-[#f0f0f0]", className)} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("hover:bg-[#fafafa] transition-colors", className)} {...props} />;
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-left text-xs font-semibold text-[#737373] uppercase tracking-wide",
        className
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2.5 text-sm text-[#0a0a0a]", className)} {...props} />;
}
