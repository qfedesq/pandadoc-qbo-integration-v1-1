export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-28 rounded-full bg-white/10" />
        <div className="h-10 w-80 rounded-2xl bg-white/10" />
        <div className="h-4 w-[30rem] rounded-full bg-white/10" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="bg-white/6 h-40 rounded-[1.5rem] border border-border/70" />
        <div className="bg-white/6 h-40 rounded-[1.5rem] border border-border/70" />
        <div className="bg-white/6 h-40 rounded-[1.5rem] border border-border/70" />
      </div>
      <div className="bg-white/6 h-72 rounded-[1.5rem] border border-border/70" />
    </div>
  );
}
