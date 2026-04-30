type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="panel-soft rounded-[28px] px-6 py-10 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[rgba(92,174,254,0.12)] text-2xl text-[var(--accent)]">
        ◇
      </div>
      <h2 className="mt-5 text-2xl font-bold">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--text-secondary)]">
        {body}
      </p>
    </div>
  );
}
