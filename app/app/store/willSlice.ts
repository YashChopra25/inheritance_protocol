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
     * Drop every cached will. Called on wallet disconnect so a second wallet
     * never sees the first one's estate while its own load is still in flight.
     */
    clearWills() {
      return { ...initialState };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadWill.pending, (state, action) => {
        const entry = entryFor(state, action.meta.arg.owner.toBase58());
        entry.status = "loading";
        // Keep `bundle` in place: a refresh after a mutation should re-render
        // the existing will, not blank the page back to the loader.
        entry.error = null;
      })
      .addCase(loadWill.fulfilled, (state, action) => {
        const { owner, bundle, failures } = action.payload;
        state.byOwner[owner] = {
          status: "ready",
          bundle,
          error: failures.length
            ? `Could not load: ${failures.join(", ")}`
            : null,
          fetchedAt: Date.now(),
        };
      })
      .addCase(loadWill.rejected, (state, action) => {
        const owner =
          action.payload?.owner ?? action.meta.arg.owner.toBase58();
        const entry = entryFor(state, owner);
        entry.status = "error";
        entry.error =
          action.payload?.message ?? action.error.message ?? "Failed to load will";
      });
  },
});

export const { setConnectedOwner, clearWills } = willSlice.actions;
export const EMPTY_WILL_ENTRY = emptyEntry;
export default willSlice.reducer;
