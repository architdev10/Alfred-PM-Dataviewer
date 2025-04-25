
import { ReactNode, ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeButtonVariants = cva(
  "inline-flex items-center justify-center rounded-full text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        success: "bg-success text-success-foreground hover:bg-success/90",
        neutral: "bg-muted text-muted-foreground hover:bg-muted/90",
      },
      size: {
        default: "h-6 px-2 py-0",
        sm: "h-5 px-1.5 py-0 text-[0.6rem]",
        lg: "h-7 px-3 py-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof badgeButtonVariants> {
  children: ReactNode;
}

export function BadgeButton({
  className,
  variant,
  size,
  children,
  ...props
}: BadgeButtonProps) {
  return (
    <button
      className={cn(badgeButtonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </button>
  );
}
