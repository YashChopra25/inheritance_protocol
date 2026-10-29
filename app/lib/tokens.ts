/** Shared SPL-token display metadata, mint inspection and amount helpers. */

import type { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "./anchor";
import { CLUSTER, type Cluster } from "./config";

/**
 * Display-only metadata. Decimals are deliberately NOT part of it: they are
 * always read from the mint on-chain (see `fetchMintInfo`), so a wrong or
 * missing entry here can only ever mislabel a token, never misprice it.
 */
export interface TokenMeta {
  symbol: string;
  name: string;
}

const WSOL: TokenMeta = { symbol: "wSOL", name: "Wrapped SOL" };

/**
 * Well-known mints per cluster. Mainnet addresses do not exist on devnet, so a
 * single shared list made mainnet USDC look "valid" on devnet and the deposit
 * then failed on-chain. Each cluster now only knows its own mints.
 */
const KNOWN_TOKENS: Record<Cluster, Record<string, TokenMeta>> = {
  "mainnet-beta": {
    So11111111111111111111111111111111111111112: WSOL,
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: "USDC", name: "USD Coin" },
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: "USDT", name: "Tether USDT" },
    DezXAZ8z7PnrnRJjz3wXh3tRe6J3gBChcumHGg3bGz56: { symbol: "BONK", name: "Bonk Token" },
  },
  devnet: {
    So11111111111111111111111111111111111111112: WSOL,
    // Circle's devnet USDC faucet mint.
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": { symbol: "USDC", name: "USD Coin (devnet)" },
  },
  testnet: { So11111111111111111111111111111111111111112: WSOL },
  localnet: { So11111111111111111111111111111111111111112: WSOL },
};

/** Whether `mint` is one of the configured cluster's well-known tokens. */
export function isKnownToken(mint: string): boolean {
  return mint in KNOWN_TOKENS[CLUSTER];
}

/** Fallback metadata for an unknown mint (truncated address as the symbol). */
export function fallbackMeta(mint: string): TokenMeta {
  return { symbol: mint.slice(0, 4).toUpperCase() + "…", name: "SPL Token" };
}

export function tokenMeta(mint: string): TokenMeta {
  return KNOWN_TOKENS[CLUSTER][mint] ?? fallbackMeta(mint);
}

// ---- mint inspection ---------------------------------------------------

/** Base SPL mint layout (shared by both token programs). */
const MINT_LEN = 82;
const DECIMALS_OFFSET = 44;
const IS_INITIALIZED_OFFSET = 45;
const FREEZE_AUTHORITY_OFFSET = 46;
/** Token-2022 pads extended mints to the token-account length, then writes an
 *  account-type byte (1 = Mint) followed by the TLV extension list. */
const ACCOUNT_TYPE_OFFSET = 165;
const ACCOUNT_TYPE_MINT = 1;

/** Token-2022 `ExtensionType` discriminants this module reasons about. */
const EXT_TRANSFER_FEE_CONFIG = 1;
const EXT_DEFAULT_ACCOUNT_STATE = 6;
const EXT_NON_TRANSFERABLE = 9;
const EXT_PERMANENT_DELEGATE = 12;
const EXT_TRANSFER_HOOK = 14;
const EXT_PAUSABLE = 26;
const ACCOUNT_STATE_FROZEN = 2;

export interface MintInfo {
  tokenProgram: PublicKey;
  decimals: number;
  freezeAuthority: boolean;
  /** Token-2022 `ExtensionType` discriminants present on the mint. */
  extensions: number[];
  /** `DefaultAccountState` is set to Frozen: new accounts (the vault, heirs'
   *  ATAs) start frozen. Only meaningful when extension 6 is present. */
  defaultFrozen: boolean;
}

/**
 * Read a mint straight from the chain: its owning token program, decimals,
 * freeze authority and Token-2022 extensions. Parsed by byte offset rather
 * than through `@solana/spl-token`, which is not a dependency of this app.
 */
export async function fetchMintInfo(
  connection: Connection,
  mint: PublicKey
): Promise<MintInfo> {
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error("No account exists at that address");
  const is2022 = info.owner.equals(TOKEN_2022_PROGRAM_ID);
  if (!is2022 && !info.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new Error("That address is not a token mint");
  }

  const data = Uint8Array.from(info.data);
  const extended =
    is2022 &&
    data.length > ACCOUNT_TYPE_OFFSET &&
    data[ACCOUNT_TYPE_OFFSET] === ACCOUNT_TYPE_MINT;
  if ((data.length !== MINT_LEN && !extended) || data[IS_INITIALIZED_OFFSET] !== 1) {
    throw new Error("That address is not a token mint");
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const extensions: number[] = [];
  let defaultFrozen = false;
  if (extended) {
    let o = ACCOUNT_TYPE_OFFSET + 1;
    while (o + 4 <= data.length) {
      const type = view.getUint16(o, true);
      const len = view.getUint16(o + 2, true);
      if (type === 0) break; // Uninitialized: end of the TLV list.
      extensions.push(type);
      // DefaultAccountState's payload is one `AccountState` byte (2 = Frozen).
      if (type === EXT_DEFAULT_ACCOUNT_STATE && len >= 1) {
        defaultFrozen = data[o + 4] === ACCOUNT_STATE_FROZEN;
      }
      o += 4 + len;
    }
  }

  return {
    tokenProgram: info.owner,
    decimals: data[DECIMALS_OFFSET],
    freezeAuthority: view.getUint32(FREEZE_AUTHORITY_OFFSET, true) === 1,
    extensions,
    defaultFrozen,
  };
}

/**
 * Token-2022 extensions that break the escrow's guarantees outright. The
 * program accepts any `TokenInterface` mint, so this client-side gate is the
 * only thing standing between an owner and an estate heirs cannot claim — the
 * escrow UI and `useVault.addToken` both refuse these.
 */
const BLOCKING_EXTENSIONS: Record<number, string> = {
  [EXT_NON_TRANSFERABLE]: "is non-transferable, so it could never be paid out to heirs",
  [EXT_PERMANENT_DELEGATE]: "has a permanent delegate who can move tokens out of the vault at any time",
  [EXT_TRANSFER_HOOK]: "has a transfer hook, which the vault program cannot execute",
  [EXT_PAUSABLE]: "is pausable, so its authority can halt every transfer including heirs' claims",
};

/** Extensions known not to affect escrowed public balances. */
const BENIGN_EXTENSIONS = new Set([3, 4, 16, 18, 19, 20, 21, 22, 23]);

export interface MintRisks {
  /** Reasons the mint must not be escrowed. */
  blocking: string[];
  /**
   * Serious enough that the owner must explicitly acknowledge them before
   * depositing (the UI gates the submit button on it).
   */
  severe: string[];
  /** Risks worth showing, but not disqualifying on their own. */
  warnings: string[];
}

export function mintRisks(info: MintInfo): MintRisks {
  const blocking: string[] = [];
  const severe: string[] = [];
  const warnings: string[] = [];
  if (info.freezeAuthority) {
    // No exceptions for well-known stablecoins: their issuers can freeze too.
    warnings.push(
      "This mint has a freeze authority. Whoever holds it can freeze the vault or an heir's account at any time, which would block claims."
    );
  }
  for (const ext of info.extensions) {
    if (BLOCKING_EXTENSIONS[ext]) {
      blocking.push(`This token ${BLOCKING_EXTENSIONS[ext]}.`);
    } else if (ext === EXT_DEFAULT_ACCOUNT_STATE) {
      if (info.defaultFrozen) {
        blocking.push(
          "This token creates every new account frozen, so the vault and heirs' accounts could not move it."
        );
      } else {
        warnings.push(
          "This mint sets a default account state; its authority can change it to frozen for new accounts."
        );
      }
    } else if (ext === EXT_TRANSFER_FEE_CONFIG) {
      // `add_token` records the amount sent, but the vault receives it minus
      // the fee, and each claim pays a fee again. Claims are clamped to the
      // vault balance, so the shortfall lands on whoever claims last.
      severe.push(
        "This token charges a transfer fee. The vault will hold less than the amount recorded, every heir's claim is charged the fee again, and because claims are paid in order until the vault runs dry, the heirs who claim last can receive less than their share — possibly nothing."
      );
    } else if (!BENIGN_EXTENSIONS.has(ext)) {
      warnings.push(`This mint uses Token-2022 extension #${ext}, which has not been reviewed.`);
    }
  }
  return { blocking, severe, warnings };
}

// ---- amounts -----------------------------------------------------------

/**
 * Parse a decimal UI string into raw base units, exactly. Replaces
 * `parseFloat(x) * 10 ** decimals`, which silently lost precision above 2^53
 * and rounded amounts with more decimals than the mint supports.
 */
export function parseUnits(input: string, decimals: number): bigint {
  const value = input.trim();
  if (!/^\d*\.?\d*$/.test(value) || value === "" || value === ".") {
    throw new Error("Enter a positive number, e.g. 12.5");
  }
  const [whole, frac = ""] = value.split(".");
  if (frac.length > decimals) {
    throw new Error(`This token supports at most ${decimals} decimal places`);
  }
  const base = BigInt(10) ** BigInt(decimals);
  return BigInt(whole || "0") * base + BigInt(frac.padEnd(decimals, "0") || "0");
}

/**
 * Format a raw base-unit amount to a decimal UI string, trimming trailing
 * zeros. Uses BigInt so large token supplies never lose precision.
 */
export function formatUnits(raw: bigint, decimals: number): string {
  if (decimals === 0) return raw.toString();
  const neg = raw < BigInt(0);
  const abs = neg ? -raw : raw;
  const base = BigInt(10) ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const out = frac.length > 0 ? `${whole}.${frac}` : whole.toString();
  return neg ? `-${out}` : out;
}
