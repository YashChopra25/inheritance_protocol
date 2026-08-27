/** Shared SPL-token display metadata helpers. */

export interface TokenMeta {
  symbol: string;
  name: string;
  decimals: number;
}

/** A few well-known mints so common tokens render with a friendly symbol. */
export const COMMON_TOKENS: Record<string, TokenMeta> = {
  "So11111111111111111111111111111111111111112": { symbol: "wSOL", name: "Wrapped SOL", decimals: 9 },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", name: "USD Coin", decimals: 6 },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", name: "Tether USDT", decimals: 6 },
  "DezXAZ8z7PnrnRJjz3wXh3tRe6J3gBChcumHGg3bGz56": { symbol: "BONK", name: "Bonk Token", decimals: 5 },
};

/** Fallback metadata for an unknown mint (truncated address as the symbol). */
export function fallbackMeta(mint: string): TokenMeta {
  return { symbol: mint.slice(0, 4).toUpperCase() + "…", name: "SPL Token", decimals: 9 };
}

export function tokenMeta(mint: string): TokenMeta {
  return COMMON_TOKENS[mint] ?? fallbackMeta(mint);
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
