import { ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  subtitle?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function Card({ title, subtitle, badge, children, className = "" }: CardProps) {
  return (
    <section className={`rounded-3xl border border-line bg-surface p-5 shadow-soft ${className}`}>
      {title || badge ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
          </div>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
