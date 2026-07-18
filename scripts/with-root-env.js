#!/usr/bin/env node
/**
 * Cross-platform (PowerShell/cmd/bash) wrapper: loads the root .env into
 * process.env, then spawns the given command with that environment —
 * so `forge` (which only auto-loads .env from its own cwd) can see the
 * monorepo's single root .env without any shell-specific `source` syntax.
 *
 * Usage: node scripts/with-root-env.js <command> [args...]
 */
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: node scripts/with-root-env.js <command> [args...]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
