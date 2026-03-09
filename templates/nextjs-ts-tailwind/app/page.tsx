export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold tracking-[0.2em] text-zinc-600 uppercase dark:border-white/15 dark:text-zinc-400">
          ux-proto
        </div>
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <p className="rounded-full border border-black/10 px-3 py-1 text-sm font-medium text-zinc-600 dark:border-white/15 dark:text-zinc-400">
            ux-proto template
          </p>
          <h1 className="max-w-xl text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Start a new prototype from the official Next.js baseline.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            This starter was generated with <code>create-next-app</code> and
            stored as a built-in ux-proto template. Use it when you want a
            clean Next.js, TypeScript, and Tailwind app without any upstream
            sync behavior.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Next Docs
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://tailwindcss.com/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tailwind Docs
          </a>
        </div>
      </main>
    </div>
  );
}
