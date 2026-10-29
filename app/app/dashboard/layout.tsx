"use client";

import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useVault } from "@/hooks/useVault";
import { useWill } from "@/hooks/useWill";
import { useAppDispatch, useAppStore } from "@/app/store/hooks";
import { clearWills, setConnectedOwner } from "@/app/store/willSlice";
import { clearRoles } from "@/app/store/rolesSlice";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { DashboardSidebar } from "@/app/components/dashboard/shared/DashboardSidebar";
import { DashboardHeader } from "@/app/components/dashboard/shared/DashboardHeader";
import { DisconnectedView } from "@/app/components/dashboard/shared/DisconnectedView";
import { VaultLoader } from "@/app/components/dashboard/shared/VaultLoader";
import { DeathConfirmationBanner } from "@/app/components/dashboard/shared/DeathConfirmationBanner";
import { WillLoadError } from "@/app/components/dashboard/shared/WillLoadError";
import { MobileNavDrawer } from "@/app/components/dashboard/shared/MobileNavDrawer";

/** The mount state never changes after hydration, so there is nothing to subscribe to. */
const subscribeNever = () => () => {};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { connected } = useWallet();
  // Hydration guard: wallet state only exists on the client, so the first paint
  // must match the server. `useSyncExternalStore` reports false on the server
  // and true on the client without a setState-in-effect cascade.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  // Stable, so the drawer's focus-trap effect is not torn down every render.
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const vault = useVault();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const walletKey = vault.publicKey?.toBase58() ?? null;

  // Tell the store whose will the dashboard is showing, and drop every cached
  // will whenever the wallet goes away or is switched directly to another
  // account, so the next wallet never sees the previous one's estate. Roles
  // are cleared on disconnect; a switch is handled inside the roles slice,
  // which discards any list that belongs to a different wallet.
  //
  // Not on first connect: child pages' loads for the new wallet are already in
  // flight by the time this effect runs, and clearing would discard them.
  const prevWallet = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevWallet.current;
    prevWallet.current = walletKey;
    if (prev && prev !== walletKey) dispatch(clearWills(walletKey));
    if (!walletKey) dispatch(clearRoles());
    dispatch(setConnectedOwner(walletKey));
  }, [dispatch, walletKey]);

  // Loads the will into `state.will.byOwner`; every page reads it from there
  // via `useDashboard()` rather than having it passed down.
  const { data, loading, error, refresh } = useWill(vault.publicKey);

  // Changes made by OTHER wallets — above all a custodian confirming death —
  // only reach the owner if the will is re-read. See `useAutoRefresh`.
  // The poll reports failure (a rejected load, e.g. rate-limited) so the
  // auto-refresh can back off instead of retrying at full rate.
  const poll = useCallback(async () => {
    await refresh();
    if (!walletKey) return true;
    return store.getState().will.byOwner[walletKey]?.status !== "error";
  }, [refresh, store, walletKey]);
  useAutoRefresh(poll, { enabled: connected && !!walletKey });

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-100">
        <div className="size-5 animate-spin rounded-full border border-border-strong border-t-accent" />
      </div>
    );
  }

  const renderContent = () => {
    if (!connected) {
      return (
        <div className="max-w-7xl mx-auto px-6 py-8 w-full">
          <DisconnectedView />
        </div>
      );
    }
    if (loading && !data) {
      return <VaultLoader />;
    }
    // Nothing could be read. Rendering the pages here would show "create your
    // will" to an owner who has one, so show the failure instead.
    if (!data && error) {
      return (
        <div className="max-w-7xl mx-auto px-6 py-8 w-full">
          <WillLoadError variant="fatal" message={error} retry={refresh} />
        </div>
      );
    }
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 w-full flex flex-col gap-6">
        {/* The will loaded, but a refresh or one of its child lists failed. */}
        {data && error && (
          <WillLoadError variant="partial" message={error} retry={refresh} />
        )}
        {/* C3: shown on every dashboard page — an owner returning to a wrongly
            confirmed will may land anywhere, and the window to cancel is finite. */}
        <DeathConfirmationBanner will={data?.will ?? null} refresh={refresh} />
        {children}
      </div>
    );
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 subtle-grid" />

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:shrink-0">
        <DashboardSidebar />
      </div>

      <MobileNavDrawer open={mobileOpen} onClose={closeMobile} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 z-10">
        <DashboardHeader
          onMenuClick={() => setMobileOpen(true)}
          menuOpen={mobileOpen}
        />
        <main className="flex-1 overflow-y-auto">{renderContent()}</main>
      </div>
    </div>
  );
}
