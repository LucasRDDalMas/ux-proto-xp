import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#fee2e2,transparent_30%),radial-gradient(circle_at_bottom_left,#dbeafe,transparent_30%),linear-gradient(180deg,#fff8ef_0%,#ffffff_45%,#f8fafc_100%)] px-6 py-10 text-slate-950 sm:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl flex-col justify-between gap-12 rounded-[2.5rem] border border-white/70 bg-white/75 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.1)] backdrop-blur sm:p-10 lg:p-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-rose-500">
            Next.js + TypeScript
          </p>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
            Typed Pokemon data, routed into its own page.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            The new page fetches the PokeAPI through a dedicated service layer,
            maps the expected response with TypeScript, and renders the full
            Pokemon list.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/pokemon"
            className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-base font-medium text-white transition hover:bg-slate-700"
          >
            Open Pokemon page
          </Link>
          <a
            href="https://pokeapi.co/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-base font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
          >
            Visit PokeAPI
          </a>
        </div>
      </div>
    </main>
  );
}
