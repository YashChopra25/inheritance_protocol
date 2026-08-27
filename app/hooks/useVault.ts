"use client";

import { useCallback, useMemo } from "react";
import {
  useConnection,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import type { IdlAccounts } from "@coral-xyz/anchor";
import type { VaultInheritance } from "@/lib/idl/vault_inheritance";
import {
  getProgram,
  getReadonlyProgram,
  willPda,
  custodianPda,
  beneficiaryPda,
  mediaPda,
  tokenVaultPda,
  tokenClaimPda,
  getAta,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  resolveTokenProgram,
  cidToBytes,
  mediaTypeToBytes,
  BN,
} from "@/lib/anchor";

export type WillAccount = IdlAccounts<VaultInheritance>["will"];
export type CustodianAccount = IdlAccounts<VaultInheritance>["custodian"];
export type BeneficiaryAccount = IdlAccounts<VaultInheritance>["beneficiary"];
export type MediaAccount = IdlAccounts<VaultInheritance>["mediaReference"];
export type TokenVaultAccount = IdlAccounts<VaultInheritance>["tokenVault"];

/**
 * Central hook exposing the connected wallet, the Anchor program, PDA helpers,
 * and a typed wrapper around every program instruction. Each action returns the
 * transaction signature.
 */
export function useVault() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(
    () =>
      wallet
        ? getProgram(connection, wallet)
        : getReadonlyProgram(connection),
    [connection, wallet]
  );

  const publicKey = wallet?.publicKey ?? null;
  const connected = !!wallet;

  // ---------- Will lifecycle ----------

  const createWill = useCallback(
    async (inactivityThresholdSecs: number, minApproval: number) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      return program.methods
        .initialiseWill(new BN(inactivityThresholdSecs), minApproval)
        .accountsPartial({
          owner: publicKey,
          will: willPda(publicKey),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    },
    [program, publicKey]
  );

  const updateWill = useCallback(
    async (
      inactivityThresholdSecs: number | null,
      minApproval: number | null
    ) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      return program.methods
        .updateWill(
          inactivityThresholdSecs === null
            ? null
            : new BN(inactivityThresholdSecs),
          minApproval
        )
        .accountsPartial({
          owner: publicKey,
          will: willPda(publicKey),
        })
        .rpc();
    },
    [program, publicKey]
  );

  const deleteWill = useCallback(async () => {
    if (!publicKey) throw new Error("Connect a wallet first");
    return program.methods
      .deleteWill()
      .accountsPartial({
        owner: publicKey,
        will: willPda(publicKey),
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }, [program, publicKey]);

  // ---------- Media references (IPFS CIDs) ----------

  const addMedia = useCallback(
    async (cid: string, mediaType: string, mediaIndex: number) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(publicKey);
      return program.methods
        .addMediaReference(mediaTypeToBytes(mediaType), cidToBytes(cid))
        .accountsPartial({
          owner: publicKey,
          will,
          mediaReference: mediaPda(will, mediaIndex),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    },
    [program, publicKey]
  );

  const removeMedia = useCallback(
    async (mediaIndex: number) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(publicKey);
      return program.methods
        .removeMediaReference(mediaIndex)
        .accountsPartial({
          owner: publicKey,
          will,
          mediaReference: mediaPda(will, mediaIndex),
        })
        .rpc();
    },
    [program, publicKey]
  );

  // ---------- Custodians ----------

  const addCustodian = useCallback(
    async (custodianWallet: PublicKey) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(publicKey);
      return program.methods
        .addCustodian()
        .accountsPartial({
          owner: publicKey,
          will,
          custodian: custodianPda(will, custodianWallet),
          walletKey: custodianWallet,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    },
    [program, publicKey]
  );

  const removeCustodian = useCallback(
    async (custodianWallet: PublicKey) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(publicKey);
      return program.methods
        .removeCustodian()
        .accountsPartial({
          owner: publicKey,
          will,
          custodian: custodianPda(will, custodianWallet),
          walletKey: custodianWallet,
        })
        .rpc();
    },
    [program, publicKey]
  );

  /** Called by a custodian to confirm the owner's death. `ownerKey` is the will owner. */
  const confirmDeath = useCallback(
    async (ownerKey: PublicKey) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(ownerKey);
      return program.methods
        .confirmDeath()
        .accountsPartial({
          custodianSigner: publicKey,
          will,
          custodian: custodianPda(will, publicKey),
        })
        .rpc();
    },
    [program, publicKey]
  );

  // ---------- Beneficiaries ----------

  const addBeneficiary = useCallback(
    async (beneficiaryWallet: PublicKey, allocationBps: number) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(publicKey);
      return program.methods
        .addBeneficiary(allocationBps)
        .accountsPartial({
          owner: publicKey,
          will,
          beneficiary: beneficiaryPda(will, beneficiaryWallet),
          walletKey: beneficiaryWallet,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    },
    [program, publicKey]
  );

  const removeBeneficiary = useCallback(
    async (beneficiaryWallet: PublicKey) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(publicKey);
      return program.methods
        .removeBeneficiary()
        .accountsPartial({
          owner: publicKey,
          will,
          beneficiary: beneficiaryPda(will, beneficiaryWallet),
          walletKey: beneficiaryWallet,
        })
        .rpc();
    },
    [program, publicKey]
  );

  /** Called by a beneficiary once the will is Claimable. `ownerKey` is the will owner. */
  const claimInheritance = useCallback(
    async (ownerKey: PublicKey) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(ownerKey);
      return program.methods
        .claimInheritance()
        .accountsPartial({
          beneficiarySigner: publicKey,
          will,
          beneficiary: beneficiaryPda(will, publicKey),
        })
        .rpc();
    },
    [program, publicKey]
  );

  /**
   * C3 — owner-only escape hatch. Cancels an in-flight death confirmation and
   * puts the will back to Active. Valid while the will is PendingInheritance,
   * or Claimable but still inside the grace period.
   */
  const revokeDeathConfirmation = useCallback(async () => {
    if (!publicKey) throw new Error("Connect a wallet first");
    return program.methods
      .revokeDeathConfirmation()
      .accountsPartial({ owner: publicKey, will: willPda(publicKey) })
      .rpc();
  }, [program, publicKey]);

  /**
   * C5 — beneficiary-only. Publishes the X25519 public key that the owner seals
   * document data keys to. Until an heir does this, nothing can be encrypted for
   * them, so the UI nudges them to run it as soon as they are named.
   */
  const registerRecipientKey = useCallback(
    async (ownerKey: PublicKey, encryptionPubkey: Uint8Array) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      if (encryptionPubkey.length !== 32) {
        throw new Error("Encryption key must be 32 bytes");
      }
      const will = willPda(ownerKey);
      return program.methods
        .registerRecipientKey(Array.from(encryptionPubkey))
        .accountsPartial({
          beneficiarySigner: publicKey,
          will,
          beneficiary: beneficiaryPda(will, publicKey),
        })
        .rpc();
    },
    [program, publicKey]
  );

  const addToken = useCallback(
    async (
      tokenMint: PublicKey,
      amount: BN,
      tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
    ) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(publicKey);
      const tokenVault = tokenVaultPda(will, tokenMint);
      const ata = getAta(publicKey, tokenMint, tokenProgram);
      const vault = getAta(will, tokenMint, tokenProgram);

      return program.methods
        .addToken(amount)
        .accountsPartial({
          owner: publicKey,
          will,
          tokenMint,
          tokenVault,
          ata,
          vault,
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    },
    [program, publicKey],
  );

  const removeToken = useCallback(
    async (
      tokenMint: PublicKey,
      tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
    ) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(publicKey);
      const tokenVault = tokenVaultPda(will, tokenMint);
      const ata = getAta(publicKey, tokenMint, tokenProgram);
      const vault = getAta(will, tokenMint, tokenProgram);

      return program.methods
        .deleteToken()
        .accountsPartial({
          owner: publicKey,
          will,
          tokenMint,
          tokenVault,
          ata,
          vault,
          tokenProgram,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    },
    [program, publicKey],
  );

  /**
   * Called by a beneficiary once the will is Claimable to pull their
   * proportional share of one escrowed token. `ownerKey` is the deceased owner.
   */
  const claimToken = useCallback(
    async (
      ownerKey: PublicKey,
      tokenMint: PublicKey,
      tokenProgram: PublicKey = TOKEN_PROGRAM_ID,
    ) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(ownerKey);
      const tokenVault = tokenVaultPda(will, tokenMint);
      const vault = getAta(will, tokenMint, tokenProgram);
      const beneficiaryAta = getAta(publicKey, tokenMint, tokenProgram);

      return program.methods
        .claimToken()
        .accountsPartial({
          beneficiarySigner: publicKey,
          will,
          beneficiary: beneficiaryPda(will, publicKey),
          tokenVault,
          tokenMint,
          vault,
          beneficiaryAta,
          tokenClaim: tokenClaimPda(tokenVault, publicKey),
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    },
    [program, publicKey],
  );

  // ---------- Post-inheritance teardown (permissionless cranks) ----------
  // These run only once the will is Claimable. Anyone may call them; reclaimed
  // rent always flows to the estate (the will owner), never the caller. They let
  // the estate be wound down so no rent is stranded after the inheritance is
  // settled. `ownerKey` is the deceased will owner.

  /**
   * C2 + M2 — return every residual token (the unallocated remainder, rounding
   * dust, and any unclaimed share) to the estate and close the vault. Only
   * callable once the heirs' claim window has closed; `close_will` refuses to
   * run until every vault has been swept.
   */
  const sweepTokenVault = useCallback(
    async (ownerKey: PublicKey, tokenMint: PublicKey) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(ownerKey);
      const tokenProgram = await resolveTokenProgram(connection, tokenMint);
      return program.methods
        .sweepTokenVault()
        .accountsPartial({
          cranker: publicKey,
          owner: ownerKey,
          will,
          tokenMint,
          tokenVault: tokenVaultPda(will, tokenMint),
          vault: getAta(will, tokenMint, tokenProgram),
          ownerAta: getAta(ownerKey, tokenMint, tokenProgram),
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    },
    [program, publicKey, connection]
  );

  const cleanupMedia = useCallback(
    async (ownerKey: PublicKey, mediaIndex: number) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(ownerKey);
      return program.methods
        .cleanupMedia()
        .accountsPartial({
          cranker: publicKey,
          owner: ownerKey,
          will,
          mediaReference: mediaPda(will, mediaIndex),
        })
        .rpc();
    },
    [program, publicKey]
  );

  const cleanupCustodian = useCallback(
    async (ownerKey: PublicKey, custodianWallet: PublicKey) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(ownerKey);
      return program.methods
        .cleanupCustodian()
        .accountsPartial({
          cranker: publicKey,
          owner: ownerKey,
          will,
          custodian: custodianPda(will, custodianWallet),
        })
        .rpc();
    },
    [program, publicKey]
  );

  const cleanupBeneficiary = useCallback(
    async (ownerKey: PublicKey, beneficiaryWallet: PublicKey) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const will = willPda(ownerKey);
      return program.methods
        .cleanupBeneficiary()
        .accountsPartial({
          cranker: publicKey,
          owner: ownerKey,
          will,
          beneficiary: beneficiaryPda(will, beneficiaryWallet),
        })
        .rpc();
    },
    [program, publicKey]
  );

  /** Closes the will itself; requires every child to have been cleaned up first. */
  const closeWill = useCallback(
    async (ownerKey: PublicKey) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      return program.methods
        .closeWill()
        .accountsPartial({
          cranker: publicKey,
          owner: ownerKey,
          will: willPda(ownerKey),
        })
        .rpc();
    },
    [program, publicKey]
  );

  return {
    connection,
    program,
    publicKey,
    connected,
    // helpers
    willPda,
    custodianPda,
    beneficiaryPda,
    mediaPda,
    tokenVaultPda,
    getAta,
    // actions
    createWill,
    updateWill,
    deleteWill,
    addMedia,
    removeMedia,
    addCustodian,
    removeCustodian,
    confirmDeath,
    revokeDeathConfirmation,
    addBeneficiary,
    removeBeneficiary,
    claimInheritance,
    registerRecipientKey,
    addToken,
    removeToken,
    claimToken,
    // teardown
    sweepTokenVault,
    cleanupMedia,
    cleanupCustodian,
    cleanupBeneficiary,
    closeWill,
  };
}
