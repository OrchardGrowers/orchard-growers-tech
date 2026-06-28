type OrchardAiPlaceholderProps = {
  title: string;
  description: string;
};

export default function OrchardAiPlaceholder({
  title,
  description,
}: OrchardAiPlaceholderProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-400">
            {description}
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300">
          Coming soon
        </span>
      </div>
    </section>
  );
}
