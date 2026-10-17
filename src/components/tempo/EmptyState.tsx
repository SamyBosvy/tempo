import type { ReactNode } from 'react';
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="flex flex-col items-center gap-3 py-4 text-center"><svg viewBox="0 0 160 64" className="h-16 w-40 max-w-full" fill="none" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M8 44H152M16 50V54M144 50V54" className="stroke-muted-foreground"/><path d="M24 44V30Q24 24 30 24H62Q68 24 68 30V44M34 34H58" className="stroke-primary"/><path d="M88 44V20Q88 14 94 14H112Q118 14 118 20V44M98 24H108" className="stroke-gold"/><path d="M128 44V36Q128 30 134 30H144" className="stroke-muted-foreground"/></svg><p className="text-sm text-muted-foreground">{children}</p>{action}</div>;
}
