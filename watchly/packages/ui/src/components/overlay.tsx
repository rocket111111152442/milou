"use client";
import { Dialog as D, DropdownMenu as DM, Tabs as T, Accordion as A, Tooltip as TT } from "radix-ui";
import * as React from "react";
import { cn } from "../lib/cn";

/* ----------------------------------------------------------------------------- Dialog */
export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentPropsWithoutRef<typeof D.Content> & { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-[overlay-in_160ms_ease-out]" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-white p-6 shadow-lift focus:outline-none data-[state=open]:animate-[dialog-in_220ms_var(--ease-out-soft)]",
          className,
        )}
        {...props}
      >
        <D.Title className="font-display text-lg font-semibold tracking-tight">{title}</D.Title>
        {description ? <D.Description className="mt-1.5 text-sm text-muted-fg">{description}</D.Description> : null}
        <div className="mt-5">{children}</div>
        <D.Close
          className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted-fg transition-colors hover:bg-surface hover:text-ink"
          aria-label="Fermer"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}

/* ----------------------------------------------------------------------- DropdownMenu */
export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;

export function DropdownMenuContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={6}
        className={cn("z-50 min-w-48 rounded-xl border border-line bg-white p-1.5 shadow-lift", className)}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuItem({
  className,
  destructive,
  ...props
}: React.ComponentPropsWithoutRef<typeof DM.Item> & { destructive?: boolean }) {
  return (
    <DM.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-[highlighted]:bg-surface data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4",
        destructive && "text-danger data-[highlighted]:bg-danger-soft",
        className,
      )}
      {...props}
    />
  );
}

export const DropdownMenuSeparator = ({ className }: { className?: string }) => (
  <DM.Separator className={cn("my-1 h-px bg-line", className)} />
);

/* ------------------------------------------------------------------------------- Tabs */
export const Tabs = T.Root;

export function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof T.List>) {
  return (
    <T.List
      className={cn("inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-fg transition-colors hover:text-ink data-[state=active]:bg-white data-[state=active]:text-ink data-[state=active]:shadow-soft [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export const TabsContent = T.Content;

/* -------------------------------------------------------------------------- Accordion */
export function Accordion(props: React.ComponentPropsWithoutRef<typeof A.Root>) {
  return <A.Root {...props} />;
}

export function AccordionItem({
  value,
  question,
  children,
}: {
  value: string;
  question: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <A.Item value={value} className="border-b border-line last:border-b-0">
      <A.Header asChild>
        <h3>
          <A.Trigger className="group flex w-full items-center justify-between gap-6 py-5 text-left font-display text-base font-semibold text-ink transition-colors hover:text-blue">
            {question}
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center rounded-full border border-line transition-transform duration-300 ease-[var(--ease-out-soft)] group-data-[state=open]:rotate-45"
            >
              <svg viewBox="0 0 16 16" className="size-3.5">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </span>
          </A.Trigger>
        </h3>
      </A.Header>
      <A.Content className="overflow-hidden data-[state=closed]:animate-[accordion-up_200ms_ease-out] data-[state=open]:animate-[accordion-down_250ms_ease-out]">
        <div className="pb-5 pr-12 text-[15px] leading-relaxed text-muted-fg">{children}</div>
      </A.Content>
    </A.Item>
  );
}

/* ---------------------------------------------------------------------------- Tooltip */
export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <TT.Provider delayDuration={250}>
      <TT.Root>
        <TT.Trigger asChild>{children}</TT.Trigger>
        <TT.Portal>
          <TT.Content
            sideOffset={6}
            className="z-50 max-w-64 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lift"
          >
            {content}
            <TT.Arrow className="fill-ink" />
          </TT.Content>
        </TT.Portal>
      </TT.Root>
    </TT.Provider>
  );
}
