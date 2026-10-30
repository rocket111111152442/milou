import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "../lib/cn";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,box-shadow,transform,border-color] duration-200 ease-[var(--ease-out-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Bouton principal : encre + halo dégradé au survol (contraste 18,9:1). */
        primary:
          "bg-ink text-white shadow-[0_0_0_1px_rgb(17_17_24)] hover:shadow-[0_0_0_1px_rgb(17_17_24),0_8px_28px_-6px_rgb(128_40_255/0.45),0_4px_14px_-4px_rgb(0_229_255/0.35)]",
        /** Bordure dégradée Waverti, fond blanc, texte encre. */
        gradient:
          "border-gradient bg-white text-ink hover:shadow-[0_8px_24px_-8px_rgb(36_91_255/0.35)]",
        secondary:
          "border border-line bg-white text-ink hover:border-line-strong hover:bg-surface",
        subtle: "bg-surface text-ink hover:bg-surface-strong",
        ghost: "text-ink hover:bg-surface",
        danger: "bg-danger text-white hover:bg-[#a51b31]",
        link: "rounded-md px-0 text-blue underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3.5 text-[13px]",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={asChild ? undefined : disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading ? <Spinner className="size-4" label="Chargement" /> : null}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";
