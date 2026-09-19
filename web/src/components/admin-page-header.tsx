/** Page header from the organiser artboard: eyebrow, title, actions, mono stat row. */
export function AdminPageHeader({
  eyebrow,
  title,
  stats,
  children,
}: {
  eyebrow: string;
  title: string;
  stats: readonly string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="px-6 pb-5 pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <h1 className="mt-[7px] text-[24px] font-semibold tracking-[-0.02em]">{title}</h1>
        </div>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
      {stats.length > 0 ? (
        <div className="mono mt-3.5 flex flex-wrap gap-x-[22px] gap-y-1 text-[11px] uppercase text-dim">
          {stats.map((stat) => (
            <span key={stat}>{stat}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
