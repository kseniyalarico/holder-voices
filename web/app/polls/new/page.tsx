"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConnection, useWriteContractSync } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import { holderVoicesAddress, HOLDER_VOICES_ABI } from "@/lib/contracts";
import { explorerTxUrl } from "@/lib/format";

interface CollectionOption {
  id: number;
  name: string;
  bitIndex: number;
}

const DESCRIPTION_MAX = 5000;

export default function NewPollPage() {
  const router = useRouter();
  const { address, isConnected } = useConnection();
  const { mutateAsync: writeContractSync, isPending } = useWriteContractSync();

  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then(setCollections)
      .catch(() => setError("Could not load collections."));
  }, []);

  function toggleCollection(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isConnected || !address) {
      setError("Connect your wallet first.");
      return;
    }
    if (selected.length === 0) {
      setError("Select at least one collection.");
      return;
    }
    if (!question.trim()) {
      setError("Question is required.");
      return;
    }
    if (description.length > DESCRIPTION_MAX) {
      setError(`Description must be under ${DESCRIPTION_MAX} characters.`);
      return;
    }
    const endsAtDate = new Date(endsAt);
    if (Number.isNaN(endsAtDate.getTime()) || endsAtDate.getTime() <= Date.now()) {
      setError("End date must be in the future.");
      return;
    }

    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || question.trim(),
          question: question.trim(),
          description: description.trim(),
          endsAt: endsAtDate.toISOString(),
          collectionIds: selected,
          createdBy: address,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to register poll");
      }

      const receipt = await writeContractSync({
        address: holderVoicesAddress(),
        abi: HOLDER_VOICES_ABI,
        functionName: "createPoll",
        args: [data.metadataHash, BigInt(data.endsAtUnix), data.collectionMask],
      });

      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted onchain.");
      }
      setTxHash(receipt.transactionHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (txHash) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <h1 className="text-xl font-semibold">Poll submitted onchain</h1>
        <p className="max-w-md text-sm text-muted">
          Your poll will appear on the home page once the vote indexer links it to this
          transaction (usually within a minute).
        </p>
        <a
          href={explorerTxUrl(txHash)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-sm text-accent-strong hover:underline"
        >
          {txHash}
        </a>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-accent-strong"
        >
          Back to home
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-muted hover:text-foreground">
            ← Holder Voices
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Create a poll</h1>
        </div>
        <ConnectButton />
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5 text-sm">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Shared prize pool"
            maxLength={200}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          Question
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Should NFT communities on Monad create a shared monthly prize pool?"
            maxLength={500}
            required
            className="rounded-lg border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={DESCRIPTION_MAX}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          Voting ends
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            className="rounded-lg border border-border bg-surface px-3 py-2 text-foreground outline-none focus:border-accent"
          />
        </label>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="mb-1">Participating collections</legend>
          {collections.map((c) => (
            <label key={c.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggleCollection(c.id)}
                className="accent-accent"
              />
              {c.name}
            </label>
          ))}
          {collections.length === 0 && <p className="text-muted">No collections available yet.</p>}
        </fieldset>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black transition hover:bg-accent-strong disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Create poll onchain"}
        </button>
      </form>
    </div>
  );
}
