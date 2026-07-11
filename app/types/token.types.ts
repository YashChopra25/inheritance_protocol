import { PublicKey } from "@solana/web3.js";

export interface TokenVaultDisplay {
  publicKey: PublicKey;
  tokenMint: PublicKey;
  vault: PublicKey;
  ata: PublicKey;
  symbol: string;
  name: string;
  decimals: number;
  vaultBalance: string;
  userBalance: string;
}

export interface NewTokenEscrowInput {
  tokenMint: string;
  amount: string;
}
