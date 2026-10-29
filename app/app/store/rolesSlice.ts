import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { PublicKey } from "@solana/web3.js";
import type { VaultProgram } from "@/lib/anchor";
import { EMPTY_ROLES, fetchMyRoles } from "@/lib/rolesFetch";
import type { MyRoles } from "@/app/types/roles.types";

/** The wills the connected wallet is attached to, as custodian or as heir. */
export interface RolesState {
  data: MyRoles;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /**
   * Base58 of the wallet the latest load was for. Responses for any other
   * wallet are stale (the user switched or disconnected) and are dropped.
   */
  wallet: string | null;
  /** `Date.now()` of the last successful load; null until one lands. */
  fetchedAt: number | null;
}

const initialState: RolesState = {
  data: EMPTY_ROLES,
  status: "idle",
  error: null,
  wallet: null,
  fetchedAt: null,
};

export const loadMyRoles = createAsyncThunk<
  { wallet: string; roles: MyRoles },
  { program: VaultProgram; wallet: PublicKey },
  { rejectValue: string }
>("roles/load", async ({ program, wallet }, { rejectWithValue }) => {
  try {
    return { wallet: wallet.toBase58(), roles: await fetchMyRoles(program, wallet) };
  } catch (e) {
    return rejectWithValue(
      e instanceof Error ? e.message : "Failed to load your wills",
    );
  }
});

const rolesSlice = createSlice({
  name: "roles",
  initialState,
  reducers: {
    clearRoles() {
      return { ...initialState };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMyRoles.pending, (state, action) => {
        const wallet = action.meta.arg.wallet.toBase58();
        // A different wallet's roles must never be shown, even briefly, while
        // this one's load is in flight.
        if (state.wallet !== wallet) {
          state.data = EMPTY_ROLES;
          state.fetchedAt = null;
        }
        state.wallet = wallet;
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadMyRoles.fulfilled, (state, action) => {
        // Stale: the wallet changed (or disconnected) while this was loading.
        if (action.payload.wallet !== state.wallet) return;
        state.status = "ready";
        state.data = action.payload.roles;
        state.error = null;
        state.fetchedAt = Date.now();
      })
      .addCase(loadMyRoles.rejected, (state, action) => {
        if (action.meta.arg.wallet.toBase58() !== state.wallet) return;
        state.status = "error";
        state.error =
          action.payload ?? action.error.message ?? "Failed to load your wills";
      });
  },
});

export const { clearRoles } = rolesSlice.actions;
export default rolesSlice.reducer;
