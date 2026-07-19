import Image from "next/image";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { PollsTabs } from "@/components/PollsTabs";
import { listPolls } from "@/lib/polls";

export const dynamic = "force-dynamic";

const COLLECTION_LINKS = [
  "https://opensea.io/collection/mongang-xyz",
  "https://opensea.io/collection/lilstarrrs",
  "https://opensea.io/collection/r3tardsnft",
  "https://opensea.io/collection/mouch-115689362",
  "https://opensea.io/collection/the-10k-squad-350905768",
  "https://opensea.io/collection/skrumpeys",
  "https://opensea.io/collection/sealuminati",
  "https://opensea.io/collection/the-daks-663099383",
  "https://opensea.io/collection/monshapeclub",
  "https://opensea.io/collection/blocknads-895269975",
];

const COLLECTIONS = COLLECTION_LINKS.map((href, i) => ({ href, src: `/collections/${i + 1}.png` }));

export default async function HomePage() {
  const polls = await listPolls();
  const active = polls.filter((p) => p.isActive);
  const completed = polls.filter((p) => !p.isActive);

  return (
    <div className="relative flex min-h-screen flex-1 flex-col overflow-x-hidden bg-background">
      <NavBar />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-12 px-5 py-12 sm:px-10 md:py-20">
        <header className="relative z-10 flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <h1 className="mb-4 text-6xl font-black leading-none text-foreground md:text-[80px]">Holder Voices</h1>
            <p className="text-2xl font-extrabold text-foreground">
              <span className="mr-2 inline-block -rotate-3 rounded-md bg-success px-2 py-1 text-black">
                One proposal
              </span>
              Many communities
            </p>
            <p className="mt-4 max-w-xl text-sm font-medium text-muted">
              Public onchain voting for NFT holders across Monad. Connect a wallet, and Holder
              Voices automatically finds which supported NFT communities you belong to — vote
              once, and it counts toward every community you hold.
            </p>
          </div>
          <Link
            href="/polls/new"
            className="shrink-0 rotate-2 rounded-full bg-success px-8 py-4 text-2xl font-extrabold uppercase text-black shadow-[4px_4px_0px_#4923bc] transition-transform hover:scale-105 hover:shadow-[6px_6px_0px_#4923bc] active:scale-95"
          >
            Create Poll
          </Link>
        </header>

        <section className="flex flex-wrap gap-3 py-2">
          {COLLECTIONS.map(({ href, src }) => (
            <a
              key={src}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-success bg-surface transition-transform duration-200 hover:scale-110 hover:rotate-6"
            >
              <Image src={src} alt="" fill className="object-cover" sizes="80px" />
            </a>
          ))}
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-accent-strong text-2xl text-accent-strong transition-transform duration-200 hover:scale-110">
            +
          </span>
        </section>

        <PollsTabs active={active} completed={completed} />
      </main>
      <Footer />
    </div>
  );
}
