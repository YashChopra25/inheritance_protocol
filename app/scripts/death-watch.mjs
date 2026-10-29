/**
 * Death-confirmation watcher (operator alerting).
 *
 * The 7-day grace period only protects an owner who finds out that custodians
 * have started confirming their death. The program cannot tell anyone, and the
 * app holds no contact details, so this read-only crank is the operator's
 * early-warning line: run it on a schedule (cron, a scheduled CI job, a
 * systemd timer) and it posts every will that is mid-confirmation or inside its
 * grace window to a webhook (Slack / Discord / any JSON endpoint).
 *
 * It never signs or sends a transaction. State is a small JSON file so each
 * (will, approval epoch, status) is reported once, not on every run.
 *
 * Env:
 *   NEXT_PUBLIC_PROGRAM_ID   program to watch (required)
 *   SOLANA_RPC_URL           RPC endpoint (falls back to NEXT_PUBLIC_RPC_ENDPOINT,
 *                            then public devnet)
 *   ALERT_WEBHOOK_URL        where to POST alerts; without it alerts are printed
 *   DEATH_WATCH_STATE        state file path (default .death-watch-state.json)
 *
 *   node scripts/death-watch.mjs
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import { Connection, PublicKey } from "@solana/web3.js";

const GRACE_PERIOD_SECONDS = 7 * 24 * 60 * 60; // must match constants.rs

// Will layout (see lib/server/authz.ts, which asserts the same offsets).
const WILL_LEN = 91;
const OFF = {
  owner: 8,
  status: 40,
  lastActiveAt: 49,
  claimableAt: 65,
  minApprovals: 77,
  approvalsReceived: 78,
  approvalEpoch: 86,
};

const programIdRaw = process.env.NEXT_PUBLIC_PROGRAM_ID?.trim();
if (!programIdRaw) {
  console.error("NEXT_PUBLIC_PROGRAM_ID is required");
  process.exit(1);
}
const PROGRAM_ID = new PublicKey(programIdRaw);
const RPC =
  process.env.SOLANA_RPC_URL?.trim() ||
  process.env.NEXT_PUBLIC_RPC_ENDPOINT?.trim() ||
  "https://api.devnet.solana.com";
const WEBHOOK = process.env.ALERT_WEBHOOK_URL?.trim();
const STATE_PATH =
  process.env.DEATH_WATCH_STATE?.trim() || ".death-watch-state.json";

const discriminator = createHash("sha256")
  .update("account:Will")
  .digest()
  .subarray(0, 8);

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function notify(text) {
  if (!WEBHOOK) {
    console.log(text);
    return;
  }
  // `text` (Slack) and `content` (Discord) cover the common webhook shapes.
  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, content: text }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`webhook responded ${res.status}`);
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  // Only wills that are mid-confirmation: status byte 1 or 2.
  const scans = await Promise.all(
    [1, 2].map((status) =>
      connection.getProgramAccounts(PROGRAM_ID, {
        filters: [
          { dataSize: WILL_LEN },
          {
            memcmp: {
              offset: 0,
              bytes: discriminator.toString("base64"),
              encoding: "base64",
            },
          },
          {
            memcmp: {
              offset: OFF.status,
              bytes: Buffer.from([status]).toString("base64"),
              encoding: "base64",
            },
          },
        ],
      })
    )
  );

  const now = Math.floor(Date.now() / 1000);
  const state = loadState();
  const next = {};
  let sent = 0;

  for (const { pubkey, account } of scans.flat()) {
    const d = account.data;
    const owner = new PublicKey(d.subarray(OFF.owner, OFF.owner + 32));
    const status = d.readUInt8(OFF.status);
    const claimableAt = Number(d.readBigInt64LE(OFF.claimableAt));
    const epoch = d.readUInt16LE(OFF.approvalEpoch);
    const graceEnds = claimableAt + GRACE_PERIOD_SECONDS;

    // Past grace the owner can no longer revoke; nothing actionable to alert.
    if (status === 2 && now >= graceEnds) continue;

    const key = `${pubkey.toBase58()}:${epoch}:${status}`;
    next[key] = true;
    if (state[key]) continue;

    const approvals = `${d.readUInt8(OFF.approvalsReceived)}/${d.readUInt8(
      OFF.minApprovals
    )}`;
    const lastActive = new Date(
      Number(d.readBigInt64LE(OFF.lastActiveAt)) * 1000
    ).toISOString();
    const line =
      status === 2
        ? `⚠️ Will ${pubkey.toBase58()} (owner ${owner.toBase58()}) reached death-confirmation quorum (${approvals}). Owner can revoke until ${new Date(
            graceEnds * 1000
          ).toISOString()}. Last check-in ${lastActive}.`
        : `Will ${pubkey.toBase58()} (owner ${owner.toBase58()}) has death confirmations in progress (${approvals}). Last check-in ${lastActive}.`;
    await notify(line);
    sent += 1;
  }

  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2));
  console.log(`death-watch: ${sent} new alert(s)`);
}

main().catch((err) => {
  console.error("death-watch failed:", err);
  process.exit(1);
});
