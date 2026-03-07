import type { Metadata } from "next";
import Link from "next/link";

import { getAllPokemon } from "@/services/pokemon-service";

export const metadata: Metadata = {
  title: "Pokemon Directory",
  description: "A full Pokemon list powered by the PokeAPI.",
};

function formatPokemonId(id: number | null): string {
  if (id === null) {
    return "Unknown";
  }

  return id.toString().padStart(4, "0");
}

async function loadPokemonDirectory() {
  try {
    const directory = await getAllPokemon();

    return {
      directory,
      error: null,
    };
  } catch (error) {
    return {
      directory: null,
      error:
        error instanceof Error
          ? error.message
          : "The Pokemon list could not be loaded.",
    };
  }
}

export default async function PokemonPage() {
  const { directory, error } = await loadPokemonDirectory();

  if (!directory) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-10 text-white">
        <div className="max-w-xl rounded-[2rem] border border-white/10 bg-white/5 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
            Pokemon Directory
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            The PokeAPI request failed.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-300">{error}</p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white transition hover:border-white hover:bg-white hover:text-slate-950"
          >
            Return home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fef3c7,transparent_30%),linear-gradient(180deg,#fff9ef_0%,#ffffff_40%,#f8fafc_100%)] px-6 py-10 text-slate-950 sm:px-10 lg:px-16">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
        <header className="flex flex-col gap-6 rounded-[2rem] border border-slate-200/80 bg-white/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <Link
            href="/"
            className="w-fit rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
          >
            Back home
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-600">
                PokeAPI Directory
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
                Every Pokemon in one typed API call.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                This page calls a TypeScript service that fetches the PokeAPI,
                validates the expected response shape, and renders the full
                Pokemon list.
              </p>
            </div>
            <div className="grid w-full max-w-xl grid-cols-2 gap-4 text-sm sm:text-base">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-slate-500">Pokemon returned</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {directory.items.length}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-slate-500">Total count</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">
                  {directory.totalCount}
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {directory.items.map((pokemon) => (
            <article
              key={pokemon.apiUrl}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                    #{formatPokemonId(pokemon.id)}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    {pokemon.displayName}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    API slug: <span className="font-mono">{pokemon.slug}</span>
                  </p>
                </div>
                <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                  Pokemon
                </div>
              </div>

              <a
                href={pokemon.apiUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950"
              >
                Open API record
              </a>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
