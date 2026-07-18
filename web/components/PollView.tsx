"use client";

import { useEffect, useState } from "react";
import { useConnection, useWriteContractSync } from "wagmi";
import { monadTestnet } from "viem/chains";
import { Choice, CHOICE_LABELS } from "@holder-voices/shared";
import { holderVoicesAddress, HOLDER_VOICES_ABI } from "@/lib/contracts";
import { explorerTxUrl, shortAddress } from "@/lib/format";
import type { PollDetail } from "@/lib/polls";
import { VoteHistory } from "./VoteHistory";

const CHOICES = [Choice.Yes, Choice.No, Choice.Abstain] as const;

type Status = "connect" | "wrong-network" | "closed" | "voted" | "ineligible" | "eligible";

function computeStatus(poll: PollDetail, isConnected: boolean, chainId: number | undefined): Status {
  if (!isConnected) return "connect";
  if (chainId !== monadTestnet.id) return "wrong-network";
  if (!poll.isActive) return "closed";
  if (poll.hasVoted) return "voted";
  if (poll.eligibility.collectionMask === 0) return "ineligible";
  return "eligible";
}

const STATUS_LABEL: Record<Status, string> = {
  connect: "Connect your wallet to check eligibility",
  "wrong-network": "Switch to Monad Testnet to vote",
  closed: "Voting has ended",
  voted: "You already voted on this poll",
  ineligible: "No eligible NFTs — you don't hold any of the required collections",
  eligible: "You can vote as a holder of:",
};

export function PollView({ pollId, initialData }: { pollId: string; initialData: PollDetail }) {
  const { address, isConnected, chainId } = useConnection();
  const { mutateAsync: writeContractSync, isPending: voting } = useWriteContractSync();

  const [poll, setPoll] = useState<PollDetail>(initialData);
  const [pendingChoice, setPendingChoice] = useState<Choice | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteTxHash, setVoteTxHash] = useState<string | null>(null);

  useEffect(() => {
    const url = address ? `/api/polls/${pollId}?wallet=${address}` : `/api/polls/${pollId}`;
    fetch(url)
      .then((r) => r.json())
      .then(setPoll)
      .catch(() => {});
  }, [address, pollId]);

  const status = computeStatus(poll, isConnected, chainId);
  const totalVotes = poll.results.yes + poll.results.no + poll.results.abstain;
  const pct = (n: number) => (totalVotes === 0 ? 0 : Math.round((n / totalVotes) * 100));

  async function castVote(choice: Choice) {
    setVoteError(null);
    if (!address) return;
    try {
      const signRes = await fetch("/api/eligibility/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: address, pollId }),
      });
      const proof = await signRes.json();
      if (!signRes.ok) {
        throw new Error(typeof proof.error === "string" ? proof.error : "Not eligible to vote");
      }

      const receipt = await writeContractSync({
        address: holderVoicesAddress(),
        abi: HOLDER_VOICES_ABI,
        functionName: "vote",
        args: [
          BigInt(proof.pollId),
          choice,
          proof.collectionMask,
          BigInt(proof.ownershipCheckedAt),
          BigInt(proof.expiresAt),
          BigInt(proof.nonce),
          proof.signature,
        ],
      });
      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted onchain.");
      }
      setVoteTxHash(receipt.transactionHash);

      const updated = await fetch(`/api/polls/${pollId}?wallet=${address}`).then((r) => r.json());
      setPoll(updated);
    } catch (err) {
      setVoteError(err instanceof Error ? err.message : "Vote failed");
    } finally {
      setPendingChoice(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">{poll.title}</h1>
        <p className="text-foreground">{poll.question}</p>
        {poll.description && <p className="text-sm text-muted whitespace-pre-wrap">{poll.description}</p>}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>By {shortAddress(poll.createdBy)}</span>
          <span>Created {new Date(poll.createdAt).toLocaleString()}</span>
          <span>Ends {new Date(poll.endsAt).toLocaleString()}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {poll.collections.map((c) => (
            <span key={c.id} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
              {c.name}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-sm font-medium text-foreground">{STATUS_LABEL[status]}</p>

        {status === "eligible" && (
          <p className="mt-1 text-xs text-muted">
            {poll.eligibility.heldCollections.map((c) => c.name).join(", ")}
          </p>
        )}

        {status === "eligible" && !voteTxHash && (
          <div className="mt-4 flex flex-col gap-3">
            {pendingChoice === null ? (
              <div className="flex gap-2">
                {CHOICES.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setPendingChoice(choice)}
                    className="flex-1 rounded-lg border border-border px-3 py-2 text-sm transition hover:border-accent"
                  >
                    {CHOICE_LABELS[choice]}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-accent bg-surface-2 p-3 text-sm">
                <span>
                  Confirm vote: <strong>{CHOICE_LABELS[pendingChoice]}</strong>
                </span>
                <button
                  type="button"
                  disabled={voting}
                  onClick={() => castVote(pendingChoice)}
                  className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-black disabled:opacity-50"
                >
                  {voting ? "Submitting…" : "Confirm"}
                </button>
                <button
                  type="button"
                  disabled={voting}
                  onClick={() => setPendingChoice(null)}
                  className="text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
            {voteError && <p className="text-sm text-danger">{voteError}</p>}
          </div>
        )}

        {voteTxHash && (
          <div className="mt-4 flex flex-col gap-1 text-sm">
            <span className="text-success">Vote recorded onchain.</span>
            <a
              href={explorerTxUrl(voteTxHash)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-accent-strong hover:underline"
            >
              {voteTxHash}
            </a>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Results</h2>
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex justify-between text-sm">
            <span>Yes: {pct(poll.results.yes)}%</span>
            <span>No: {pct(poll.results.no)}%</span>
            <span>Abstain: {pct(poll.results.abstain)}%</span>
          </div>
          <p className="mt-2 text-xs text-muted">{poll.results.uniqueVoters} unique participant(s)</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {Object.entries(poll.perCollection).map(([name, stats]) => (
            <div key={name} className="rounded-xl border border-border bg-surface p-4 text-sm">
              <p className="font-medium">{name}</p>
              <p className="mt-1 text-xs text-muted">
                Yes: {stats.yes} · No: {stats.no} · Abstain: {stats.abstain} · Total: {stats.total}
              </p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted">
          One wallet can hold NFTs from several collections. Its vote is counted in the
          statistics of each matching community, but only once in the overall result.
        </p>
      </section>

      <VoteHistory pollId={pollId} />
    </div>
  );
}
