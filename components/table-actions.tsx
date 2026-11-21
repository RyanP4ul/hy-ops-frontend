"use client";

import { useSyncExternalStore, type Ref } from "react";
import { Ellipsis, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type TableAction = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  ariaLabel?: string;
  tooltip?: string;
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
  expanded?: boolean;
  controls?: string;
};

export type TableActionsProps = {
  rowLabel: string;
  primary?: TableAction;
  secondary?: (TableAction | false | undefined)[];
  additional?: (TableAction | false | undefined)[];
  menuTriggerRef?: Ref<HTMLButtonElement>;
};

const tablet = "(min-width: 40rem)";
const desktop = "(min-width: 64rem)";

function subscribeToLayout(onChange: () => void) {
  const queries = [window.matchMedia(tablet), window.matchMedia(desktop)];
  queries.forEach((query) => query.addEventListener("change", onChange));
  return () => queries.forEach((query) => query.removeEventListener("change", onChange));
}

function getLayout() {
  if (window.matchMedia(desktop).matches) return "desktop";
  return window.matchMedia(tablet).matches ? "tablet" : "mobile";
}

function getServerLayout() {
  return "mobile" as const;
}

function ActionIcon({ action }: { action: TableAction }) {
  const Icon = action.busy ? Loader2 : action.icon;
  return <Icon aria-hidden="true" className={action.busy ? "animate-spin motion-reduce:animate-none" : undefined} />;
}

function InlineAction({ action, iconOnly = false }: { action: TableAction; iconOnly?: boolean }) {
  const button = (
    <Button
      type="button"
      variant={iconOnly ? "ghost" : "outline"}
      size={iconOnly ? "icon" : "default"}
      className="max-sm:h-10"
      aria-label={action.ariaLabel ?? (iconOnly ? action.label : undefined)}
      aria-expanded={action.expanded}
      aria-controls={action.controls}
      disabled={action.disabled || action.busy}
      focusableWhenDisabled={Boolean(action.tooltip || iconOnly)}
      onClick={action.onClick}
    >
      <ActionIcon action={action} />
      {!iconOnly && action.label}
    </Button>
  );

  if (!iconOnly && !action.tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{action.tooltip ?? action.label}</TooltipContent>
    </Tooltip>
  );
}

export function TableActions({ rowLabel, primary, secondary = [], additional = [], menuTriggerRef }: TableActionsProps) {
  const layout = useSyncExternalStore(subscribeToLayout, getLayout, getServerLayout);
  const secondaryActions = secondary.filter((action): action is TableAction => Boolean(action));
  const additionalActions = additional.filter((action): action is TableAction => Boolean(action));
  const collapsePrimary = layout === "mobile" && (secondaryActions.length > 0 || additionalActions.length > 0);
  const inlineSecondary = layout === "desktop" ? secondaryActions : [];
  const menuActions = [
    ...(collapsePrimary && primary ? [primary] : []),
    ...(layout === "desktop" ? [] : secondaryActions),
    ...additionalActions,
  ];

  return (
    <div data-slot="table-actions" className="flex items-center justify-end gap-1 whitespace-nowrap">
      {primary && !collapsePrimary && <InlineAction action={primary} />}
      {inlineSecondary.map((action) => <InlineAction key={action.label} action={action} iconOnly />)}
      {menuActions.length > 0 && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            ref={menuTriggerRef}
            render={<Button type="button" variant="ghost" size="icon" className="max-sm:size-10" aria-label={`Actions for ${rowLabel}`} />}
          >
            <Ellipsis aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-max min-w-44 max-w-[calc(100vw-2rem)]">
            {menuActions.map((action) => (
              <DropdownMenuItem
                key={action.label}
                label={action.label}
                variant={action.destructive ? "destructive" : "default"}
                className="min-h-8 px-2 max-sm:min-h-10 data-disabled:pointer-events-auto"
                aria-label={action.ariaLabel}
                aria-expanded={action.expanded}
                aria-controls={action.controls}
                disabled={action.disabled || action.busy}
                title={action.tooltip}
                onClick={action.onClick}
              >
                <ActionIcon action={action} />
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
