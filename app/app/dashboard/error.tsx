"use client"; // Error boundaries must be Client Components.

import { ErrorScreen } from "@/app/components/shared/ErrorScreen";

/**
 * Dashboard pages fail inside the dashboard layout (sidebar and header stay),
 * so the wallet connection survives and a retry only re-renders the page.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <ErrorScreen
      code="Dashboard error"
      title="This page hit an error."
      error={error}
      retry={retry}
      homeHref="/dashboard/overview"
      homeLabel="Back to overview"
    >
      Something went wrong while rendering this view, often a transient RPC
      failure. Your will lives on-chain and is unaffected by this screen.
    </ErrorScreen>
  );
}
