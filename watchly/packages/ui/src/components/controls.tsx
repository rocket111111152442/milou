"use client";
import { Checkbox as CheckboxPrimitive, Switch as SwitchPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "../lib/cn";

export const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer grid size-5 shrink-0 place-items-center rounded-md border border-line-strong bg-white transition-colors hover:border-ink-soft data-[state=checked]:border-ink data-[state=checked]:bg-ink aria-[invalid=true]:border-danger",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="text-white">
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
        <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";

export const Switch = React.forwardRef<
  React.ComponentRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-transparent bg-line-strong transition-colors duration-200 data-[state=checked]:bg-blue disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-soft transition-transform duration-200 ease-[var(--ease-out-soft)] data-[state=checked]:translate-x-[22px]" />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
