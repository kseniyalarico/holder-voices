"use client";

import { useEffect, useState } from "react";
import { useConnection, useWriteContractSync } from "wagmi";
import { monadTestnet } from "viem/chains";
import { Choice, CHOICE_LABELS } from "@holder-voices/shared";
import { holderVoicesAddress, HOLDER_VOICES_ABI } from "@/lib/contracts";
import { explorerTxUrl, formatDateUTC, shortAddress } from "@/lib/format";
import { markPollSeen } from "@/lib/seenPolls";
import type { PollDetail } from "@/lib/polls";
import { VotingTimer } from "./VotingTimer";
import { VoteHistory } from "./VoteHistory";

const CHOICE_BUTTON_STYLE: Record<Choice, string> = {
  [Choice.Yes]: "bg-success text-black shadow-[0_8px_0px_#4c6700] border-4 border-transparent hover:border-white",
  [Choice.No]: "bg-[#ff007f] text-black shadow-[0_8px_0px_#91081a] border-4 border-transparent hover:border-white",
  [Choice.Abstain]: "bg-accent text-black shadow-[0_8px_0px_#4923bc] border-4 border-transparent hover:border-white",
};

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

  useEffect(() => {
    markPollSeen(pollId);
  }, [pollId]);

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

  const BAR_COLOR: Record<Choice, string> = {
    [Choice.Yes]: "bg-success",
    [Choice.No]: "bg-[#ff007f]",
    [Choice.Abstain]: "bg-accent",
  };
  const TEXT_COLOR: Record<Choice, string> = {
    [Choice.Yes]: "text-success",
    [Choice.No]: "text-[#ff007f]",
    [Choice.Abstain]: "text-accent-strong",
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      <div className="flex flex-col gap-6 md:col-span-8">
        <section className="relative overflow-hidden rounded-2xl border-2 border-accent bg-surface p-6">
          <div className="absolute right-4 top-4">
            <span
              className={`-rotate-3 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-[4px_4px_0px_var(--success)] ${
                poll.isActive ? "border-accent bg-[#4923bc] text-white" : "border-border bg-border text-muted"
              }`}
            >
              {poll.isActive ? "Active" : "Closed"}
            </span>
          </div>
          <h1 className="max-w-2xl text-2xl font-extrabold uppercase text-foreground md:text-3xl">
            {poll.question}
          </h1>
          <p className="mt-2 text-sm text-muted">{poll.title}</p>
          {poll.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{poll.description}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
              #{poll.pollId}
            </span>
            {poll.collections.map((c) => (
              <span
                key={c.id}
                className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-muted"
              >
                {c.name}
              </span>
            ))}
            <span className="text-xs font-bold text-accent">by {shortAddress(poll.createdBy)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
            <span>Created {formatDateUTC(poll.createdAt)}</span>
            <span>Ends {formatDateUTC(poll.endsAt)}</span>
          </div>

          {poll.isActive && (
            <div className="mt-6">
              <VotingTimer endsAt={poll.endsAt} />
            </div>
          )}
        </section>

        <section className="rounded-2xl border-2 border-transparent bg-surface p-6 transition-colors hover:border-accent">
          <h2 className="mb-4 text-center text-lg font-extrabold uppercase text-foreground">Cast your vote</h2>
          <p className="mb-4 text-center text-sm font-medium text-foreground">{STATUS_LABEL[status]}</p>

          {status === "eligible" && (
            <p className="mb-4 text-center text-xs text-muted">
              {poll.eligibility.heldCollections.map((c) => c.name).join(", ")}
            </p>
          )}

          {status === "eligible" && !voteTxHash && (
            <div className="flex flex-col gap-3">
              {pendingChoice === null ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {CHOICES.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => setPendingChoice(choice)}
                      className={`rounded-xl py-6 text-lg font-black uppercase transition-transform hover:scale-105 active:scale-95 ${CHOICE_BUTTON_STYLE[choice]}`}
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
            <div className="flex flex-col items-center gap-1 text-sm">
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
          <h2 className="text-sm font-medium text-muted">Per-community results</h2>
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
      </div>

      <div className="flex flex-col gap-6 md:col-span-4">
        <section className="relative rounded-2xl border-2 border-border bg-surface p-6">
          <div className="absolute -top-4 right-4 rotate-6 rounded-full border-2 border-success bg-success px-4 py-2 text-xs font-bold uppercase text-black">
            Results
          </div>
          <div className="mt-4 flex flex-col gap-5">
            {CHOICES.map((choice) => {
              const count = choice === Choice.Yes ? poll.results.yes : choice === Choice.No ? poll.results.no : poll.results.abstain;
              return (
                <div key={choice}>
                  <div className="mb-1.5 flex items-end justify-between">
                    <span className={`text-sm font-extrabold uppercase ${TEXT_COLOR[choice]}`}>
                      {CHOICE_LABELS[choice]}
                    </span>
                    <span className={`text-sm font-extrabold ${TEXT_COLOR[choice]}`}>{pct(count)}%</span>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full border border-border bg-background">
                    <div className={`h-full ${BAR_COLOR[choice]}`} style={{ width: `${pct(count)}%` }} />
                  </div>
                  <div className="mt-1 text-right text-xs text-muted">{count} vote{count === 1 ? "" : "s"}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex justify-between border-t border-border pt-4 text-xs font-semibold uppercase text-muted">
            <span>Participants</span>
            <span className="text-accent-strong">{poll.results.uniqueVoters}</span>
          </div>
        </section>

        <VoteHistory pollId={pollId} />
      </div>
    </div>
  );
}
