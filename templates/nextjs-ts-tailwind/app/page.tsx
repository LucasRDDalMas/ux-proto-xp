export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_35%),linear-gradient(180deg,#f8fafc_0%,#ffffff_50%,#eef2ff_100%)] px-6 py-10 text-slate-950 sm:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-between gap-12 rounded-[2.5rem] border border-slate-200/80 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:p-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-sky-600">
            ux-proto template
          </p>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight sm:text-6xl">
            Start shaping the flow from a clean Next.js baseline.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            This prototype was created from the built-in Next.js + TypeScript + Tailwind template.
            It has local version history, but it does not sync against an upstream source repository.
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-lg font-semibold text-slate-950">What you get</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
              <li>Next.js App Router</li>
              <li>TypeScript enabled</li>
              <li>Tailwind CSS v4 ready</li>
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-950">What to do next</h2>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
              <li>Edit <code>app/page.tsx</code></li>
              <li>Run <code>pnpm dev</code></li>
              <li>Use Proto Save Version as you iterate</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
