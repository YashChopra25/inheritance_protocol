import { configureStore } from "@reduxjs/toolkit";
import { setAutoFreeze } from "immer";
import willReducer from "./willSlice";
import rolesReducer from "./rolesSlice";

/**
 * The store holds Anchor-decoded accounts as they come off the wire, which
 * means `PublicKey` and `BN` instances rather than plain JSON.
 *
 * That is deliberate. Flattening them to strings and numbers would lose u64
 * precision on token amounts and force every consumer to re-wrap values before
 * building a transaction. The two costs of keeping the class instances are
 * handled here, once:
 *
 *  - Immer deep-freezes every state tree it produces, which would freeze those
 *    instances. Reads (`toBase58`, `toNumber`) are unaffected, but freezing a
 *    `BN` is a foot-gun for any library that strips its internal word array in
 *    place, so auto-freeze is off.
 *  - `serializableCheck` would log a warning for every will loaded, and for the
 *    `program` handle carried in each thunk's argument. Turning it off keeps
 *    the console usable; nothing here is persisted or time-travelled.
 */
setAutoFreeze(false);

export const store = configureStore({
  reducer: {
    will: willReducer,
    roles: rolesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
      immutableCheck: false,
    }),
});

export type AppStore = typeof store;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
