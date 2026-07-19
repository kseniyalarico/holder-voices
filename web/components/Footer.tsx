export function Footer() {
  return (
    <footer className="mt-auto flex w-full flex-col items-center justify-between gap-4 border-t-4 border-[#4923bc] bg-surface px-5 py-8 sm:flex-row sm:px-10">
      <div className="text-xl font-extrabold uppercase text-success">Holder Voices</div>
      <div className="flex gap-6 text-xs font-bold uppercase tracking-wide text-muted">
        <span className="transition-transform hover:-rotate-2 hover:text-success">Terms</span>
        <span className="transition-transform hover:-rotate-2 hover:text-success">Privacy</span>
        <span className="transition-transform hover:-rotate-2 hover:text-success">Discord</span>
        <span className="transition-transform hover:-rotate-2 hover:text-success">Twitter</span>
      </div>
      <div className="text-xs font-bold uppercase tracking-wide text-accent-strong">
        © 2026 Holder Voices DAOverse
      </div>
    </footer>
  );
}
