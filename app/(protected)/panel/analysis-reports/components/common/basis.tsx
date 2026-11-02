import type { ReactNode } from "react";

/** One-line note under each tab stating which dates the numbers are based on. */
export const Basis = ({ children }: { children: ReactNode }) => <p className="text-xs text-muted-foreground">Date basis: {children}</p>;
