import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { PublicKey } from "@solana/web3.js";
import type { VaultProgram } from "@/lib/anchor";
import { fetchWillBundle, type WillBundle } from "@/lib/willFetch";

/**
 * One will and its children, keyed in the store by the OWNER's address.
 *
 * Keyed by owner rather than held as a single "my will" because the same data
 * is read from two directions: the dashboard reads the connected wallet's own
 * will, while `/dashboard/inheritance/[owner]` reads someone else's. Both land
 * in the same cache, so an heir who is also an owner never fetches twice.
 */
export interface WillEntry {
  status: "idle" | "loading" | "ready" | "error";
  bundle: WillBundle | null;
  /** A load error, or a partial failure such as "Could not load: custodians". */
  error: string | null;
  /** `Date.now()` of the last successful load; null until one lands. */
  fetchedAt: number | null;
  /**
   * `requestId` of the newest `loadWill` started for this owner. Only that
   * request may write the entry: an older load resolving late would otherwise
   * overwrite fresher data, and a load started before `clearWills` would
   * repopulate the cache (the entry is gone, so it matches nothing).
   */
  requestId: string | null;
  /** Wallet whose program issued that load; lets `clearWills` keep loads the
   *  new wallet started before the clear ran. */
  requestedBy: string | null;
}

export interface WillState {
  byOwner: Record<string, WillEntry>;
  /** Base58 of the wallet whose dashboard is being shown; null when disconnected. */
  connectedOwner: string | null;
}

const initialState: WillState = {
  byOwner: {},
  connectedOwner: null,
};

const emptyEntry: WillEntry = {
  status: "idle",
  bundle: null,
  error: null,
  fetchedAt: null,
  requestId: null,
  requestedBy: null,
};

function entryFor(state: WillState, owner: string): WillEntry {
  const existing = state.byOwner[owner];
  if (existing) return existing;
  const created = { ...emptyEntry };
  state.byOwner[owner] = created;
  return created;
}

/**
 * Loads a will bundle into the store. The Anchor `program` is passed in the
 * thunk argument rather than read from state: it is bound to the connected
 * wallet and is not serialisable, so it belongs to the caller, not the store.
 */
export const loadWill = createAsyncThunk<
  { owner: string; bundle: WillBundle; failures: string[] },
  { program: VaultProgram; owner: PublicKey },
  { rejectValue: { owner: string; message: string } }
>("will/load", async ({ program, owner }, { rejectWithValue }) => {
  const ownerKey = owner.toBase58();
  try {
    const { bundle, failures } = await fetchWillBundle(program, owner);
    return { owner: ownerKey, bundle, failures };
  } catch (e) {
    return rejectWithValue({
      owner: ownerKey,
      message: e instanceof Error ? e.message : "Failed to load will",
    });
  }
});

const willSlice = createSlice({
  name: "will",
  initialState,
  reducers: {
    /** Set (or clear, with null) the wallet whose will the dashboard shows. */
    setConnectedOwner(state, action: PayloadAction<string | null>) {
      state.connectedOwner = action.payload;
    },
    /**
     * Drop every cached will. Called on wallet disconnect/switch so a second
     * wallet never sees the first one's estate while its own load is still in
     * flight. Responses to the dropped loads are discarded by the `requestId`
     * guard.
     *
     * Loads already started by the wallet in the payload (the NEW one) survive as
     * bare "loading" entries: child pages mount and dispatch before the layout's
     * clear runs, and discarding their loads would leave those pages empty
     * with nothing left to re-trigger a fetch.
     */
    clearWills(state, action: PayloadAction<string | null | undefined>) {
      const keepBy = action.payload ?? null;
      const byOwner: Record<string, WillEntry> = {};
      if (keepBy) {
        for (const [owner, e] of Object.entries(state.byOwner)) {
          if (e.status === "loading" && e.requestedBy === keepBy) {
            byOwner[owner] = {
              ...emptyEntry,
              status: "loading",
              requestId: e.requestId,
              requestedBy: e.requestedBy,
            };
          }
        }
      }
      return { ...initialState, byOwner };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadWill.pending, (state, action) => {
        const entry = entryFor(state, action.meta.arg.owner.toBase58());
        entry.status = "loading";
        entry.requestId = action.meta.requestId;
        entry.requestedBy =
          action.meta.arg.program.provider.publicKey?.toBase58() ?? null;
        // Keep `bundle` in place: a refresh after a mutation should re-render
        // the existing will, not blank the page back to the loader.
        entry.error = null;
      })
      .addCase(loadWill.fulfilled, (state, action) => {
        const { owner, bundle, failures } = action.payload;
        // Superseded by a newer load, or the cache was cleared meanwhile.
        if (state.byOwner[owner]?.requestId !== action.meta.requestId) return;
        state.byOwner[owner] = {
          status: "ready",
          bundle,
          error: failures.length
            ? `Could not load: ${failures.join(", ")}`
            : null,
          fetchedAt: Date.now(),
          requestId: action.meta.requestId,
          requestedBy: state.byOwner[owner].requestedBy,
        };
      })
      .addCase(loadWill.rejected, (state, action) => {
        const owner =
          action.payload?.owner ?? action.meta.arg.owner.toBase58();
        const entry = state.byOwner[owner];
        if (!entry || entry.requestId !== action.meta.requestId) return;
        entry.status = "error";
        entry.error =
          action.payload?.message ?? action.error.message ?? "Failed to load will";
      });
  },
});

export const { setConnectedOwner, clearWills } = willSlice.actions;
export const EMPTY_WILL_ENTRY = emptyEntry;
export default willSlice.reducer;
