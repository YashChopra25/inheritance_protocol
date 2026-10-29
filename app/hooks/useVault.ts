"use client";

import { useCallback, useMemo } from "react";
import {
  useConnection,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
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
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createAtaIdempotentIx,
  syncNativeIx,
  resolveTokenProgram,
  cidToBytes,
  mediaTypeToBytes,
  BN,
} from "@/lib/anchor";
import { fetchMintInfo, mintRisks } from "@/lib/tokens";
import { computeBudgetIxs, CU } from "@/lib/priorityFee";

// Defined next to the fetcher in `lib/willFetch`, re-exported here because
// most components reach for them alongside the actions on this hook.
export type {
  WillAccount,
  CustodianAccount,
  BeneficiaryAccount,
  MediaAccount,
  TokenVaultAccount,
} from "@/lib/willFetch";

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

  /**
   * Compute-unit limit + a priority fee priced from recent fees on the
   * accounts the transaction writes. Prepended to every instruction below;
   * never throws (it falls back to a default price).
   */
  const budget = useCallback(
    (writable: PublicKey[], units: number) =>
      computeBudgetIxs(connection, writable, units),
    [connection]
  );

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
        .preInstructions(await budget([publicKey, willPda(publicKey)], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
        .preInstructions(await budget([publicKey, willPda(publicKey)], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
      .preInstructions(await budget([publicKey, willPda(publicKey)], CU.SIMPLE))
      .rpc();
  }, [program, publicKey, budget]);

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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
      .preInstructions(await budget([publicKey, willPda(publicKey)], CU.SIMPLE))
      .rpc();
  }, [program, publicKey, budget]);

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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
  );

  /**
   * Escrow `amount` raw units of `tokenMint`. The token program is read from
   * the mint itself (legacy or Token-2022) unless the caller passes one, and
   * mints whose extensions would break the escrow are refused before anything
   * is signed — the program itself does not check them yet.
   */
  const addToken = useCallback(
    async (tokenMint: PublicKey, amount: BN, tokenProgramOverride?: PublicKey) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const mintInfo = await fetchMintInfo(connection, tokenMint);
      const { blocking } = mintRisks(mintInfo);
      if (blocking.length > 0) {
        throw new Error(`${blocking[0]} It cannot be escrowed safely.`);
      }
      const tokenProgram = tokenProgramOverride ?? mintInfo.tokenProgram;
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
        .preInstructions(await budget([publicKey, will, vault], CU.TOKEN))
        .rpc();
    },
    [program, publicKey, connection, budget],
  );

  /**
   * Escrow native SOL in one transaction: create the owner's wSOL account if
   * needed (idempotent), move `wrapLamports` into it, `SyncNative`, then
   * `add_token` for `amount` of the native mint. `wrapLamports` may be less
   * than `amount` when the owner already holds some wSOL — that is used first.
   * Heirs receive wSOL, which they can unwrap in any wallet.
   */
  const escrowNativeSol = useCallback(
    async (amount: BN, wrapLamports: BN) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const tokenMint = NATIVE_MINT;
      const tokenProgram = TOKEN_PROGRAM_ID;
      const will = willPda(publicKey);
      const ata = getAta(publicKey, tokenMint, tokenProgram);
      const vault = getAta(will, tokenMint, tokenProgram);

      const wrap = wrapLamports.gtn(0)
        ? [
          createAtaIdempotentIx(publicKey, publicKey, tokenMint, tokenProgram),
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: ata,
            lamports: BigInt(wrapLamports.toString()),
          }),
          syncNativeIx(ata),
        ]
        : [];

      return program.methods
        .addToken(amount)
        .accountsPartial({
          owner: publicKey,
          will,
          tokenMint,
          tokenVault: tokenVaultPda(will, tokenMint),
          ata,
          vault,
          tokenProgram,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([
          ...(await budget([publicKey, will, ata, vault], CU.WRAP_AND_ESCROW)),
          ...wrap,
        ])
        .rpc();
    },
    [program, publicKey, budget],
  );

  const removeToken = useCallback(
    async (tokenMint: PublicKey, tokenProgramOverride?: PublicKey) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const tokenProgram =
        tokenProgramOverride ?? (await resolveTokenProgram(connection, tokenMint));
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
        .preInstructions(await budget([publicKey, will, vault], CU.TOKEN))
        .rpc();
    },
    [program, publicKey, connection, budget],
  );

  /**
   * Called by a beneficiary once the will is Claimable to pull their
   * proportional share of one escrowed token. `ownerKey` is the deceased owner.
   */
  const claimToken = useCallback(
    async (
      ownerKey: PublicKey,
      tokenMint: PublicKey,
      tokenProgramOverride?: PublicKey,
    ) => {
      if (!publicKey) throw new Error("Connect a wallet first");
      const tokenProgram =
        tokenProgramOverride ?? (await resolveTokenProgram(connection, tokenMint));
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
        .preInstructions(await budget([publicKey, vault], CU.TOKEN))
        .rpc();
    },
    [program, publicKey, connection, budget],
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
        .preInstructions(await budget([publicKey, will], CU.TOKEN))
        .rpc();
    },
    [program, publicKey, connection, budget]
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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
        .preInstructions(await budget([publicKey, will], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
        .preInstructions(await budget([publicKey, willPda(ownerKey)], CU.SIMPLE))
        .rpc();
    },
    [program, publicKey, budget]
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
    escrowNativeSol,
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
