import { PublicKey } from "@solana/web3.js";
import type { IdlAccounts } from "@coral-xyz/anchor";
import type { VaultInheritance } from "@/lib/idl/vault_inheritance";
import { willPda, type VaultProgram } from "@/lib/anchor";

export type WillAccount = IdlAccounts<VaultInheritance>["will"];
export type CustodianAccount = IdlAccounts<VaultInheritance>["custodian"];
export type BeneficiaryAccount = IdlAccounts<VaultInheritance>["beneficiary"];
export type MediaAccount = IdlAccounts<VaultInheritance>["mediaReference"];
export type TokenVaultAccount = IdlAccounts<VaultInheritance>["tokenVault"];

export type ProgramItem<T> = { publicKey: PublicKey; account: T };

export interface WillBundle {
  willPubkey: PublicKey;
  will: WillAccount | null;
  media: ProgramItem<MediaAccount>[];
  custodians: ProgramItem<CustodianAccount>[];
  beneficiaries: ProgramItem<BeneficiaryAccount>[];
  tokenVaults: ProgramItem<TokenVaultAccount>[];
}

/** What `fetchWillBundle` returns: the bundle plus any child list that failed. */
export interface WillFetchResult {
  bundle: WillBundle;
  /** Names of child lists that could not be loaded; the bundle has them empty. */
  failures: string[];
}

// `will` is the first field after the 8-byte discriminator on every child account.
const WILL_OFFSET = 8;

/**
 * Like Anchor's `account.all(filter)`, but decodes each account on its own so a
 * single undecodable account can't take down the whole page.
 *
 * This matters after a struct grows: accounts written by an earlier version of
 * the program keep their old (smaller) size, and decoding one with the new
 * layout throws "Trying to access beyond buffer length". Anchor's `.all()`
 * decodes in one pass and rejects the entire batch; here the stale account is
 * skipped and logged instead.
 */
async function allTolerant<T>(
  program: VaultProgram,
  accountName: keyof VaultProgram["account"] & string,
  filters: { memcmp: { offset: number; bytes: string } }[],
): Promise<ProgramItem<T>[]> {
  const { connection } = program.provider;
  // `coder.accounts.memcmp()` returns the memcmp *body* (`{offset, bytes}`), not
  // a filter — it has to be wrapped in `{ memcmp: ... }` the way Anchor's own
  // `.all()` does. Passing it bare produced a filter object the RPC did not
  // recognise, so it returned every program account in the default base58
  // encoding and web3.js threw ("Expected a `Buffer` instance") — which blew up
  // the whole load and left the dashboard showing no will at all.
  const raw = await connection.getProgramAccounts(program.programId, {
    filters: [
      { memcmp: program.coder.accounts.memcmp(accountName) },
      ...filters,
    ],
    encoding: "base64",
  });
  const out: ProgramItem<T>[] = [];
  for (const { pubkey, account } of raw) {
    try {
      out.push({
        publicKey: pubkey,
        account: program.coder.accounts.decode<T>(accountName, account.data),
      });
    } catch (e) {
      console.warn(
        `[willFetch] skipping ${accountName} ${pubkey.toBase58()} — ` +
          `stale on-chain layout (${account.data.length} bytes): ` +
          (e instanceof Error ? e.message : String(e)),
      );
    }
  }
  return out;
}

/**
 * Loads a will (by its owner) together with every child account that belongs to
 * it. A missing will resolves to a bundle with `will: null` rather than
 * throwing, so callers can tell "no will yet" apart from "load failed".
 *
 * Pure and React-free on purpose: the Redux thunk in `store/willSlice` is the
 * only caller, so there is exactly one place that knows how a will is read.
 */
export async function fetchWillBundle(
  program: VaultProgram,
  owner: PublicKey,
): Promise<WillFetchResult> {
  const willKey = willPda(owner);
  const will = await program.account.will.fetchNullable(willKey);
  if (!will) {
    return {
      bundle: {
        willPubkey: willKey,
        will: null,
        media: [],
        custodians: [],
        beneficiaries: [],
        tokenVaults: [],
      },
      failures: [],
    };
  }

  const filter = [
    { memcmp: { offset: WILL_OFFSET, bytes: willKey.toBase58() } },
  ];
  // `allTolerant` rather than Anchor's `.all()`: one account left on an older
  // layout would otherwise reject the entire batch and blank the dashboard,
  // instead of being skipped and logged.
  //
  // `allSettled`, not `all`: the will itself has already been fetched, so a
  // failing child query (RPC hiccup, rate limit) should degrade that one list to
  // empty rather than throw away a will we successfully read.
  const settled = await Promise.allSettled([
    allTolerant<MediaAccount>(program, "mediaReference", filter),
    allTolerant<CustodianAccount>(program, "custodian", filter),
    allTolerant<BeneficiaryAccount>(program, "beneficiary", filter),
    allTolerant<TokenVaultAccount>(program, "tokenVault", filter),
  ]);
  const names = ["media", "custodians", "beneficiaries", "tokenVaults"];
  const failures: string[] = [];
  const [media, custodians, beneficiaries, tokenVaults] = settled.map(
    (r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.error(`[willFetch] failed to load ${names[i]}:`, r.reason);
      failures.push(names[i]);
      return [];
    },
  ) as [
    ProgramItem<MediaAccount>[],
    ProgramItem<CustodianAccount>[],
    ProgramItem<BeneficiaryAccount>[],
    ProgramItem<TokenVaultAccount>[],
  ];

  return {
    bundle: {
      willPubkey: willKey,
      will: will as WillAccount,
      media,
      custodians,
      beneficiaries,
      tokenVaults,
    },
    failures,
  };
}
