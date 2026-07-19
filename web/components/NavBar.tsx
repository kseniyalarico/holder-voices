import Link from "next/link";
import { ConnectButton } from "./ConnectButton";
import { ThemeToggle } from "./ThemeToggle";

export function NavBar() {
  return (
    <nav className="sticky top-0 z-50 flex w-full max-w-full items-center justify-between border-b-4 border-success bg-background px-5 py-2 sm:px-10">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-xs font-extrabold uppercase text-success transition-transform hover:scale-105"
        >
          Dashboard
        </Link>
        <Link
          href="/polls/new"
          className="text-xs font-extrabold uppercase text-foreground transition-transform hover:scale-105 hover:text-accent-strong"
        >
          Create Poll
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <ConnectButton />
      </div>
    </nav>
  );
}
