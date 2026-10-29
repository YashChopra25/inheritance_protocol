"use client"; // Error boundaries must be Client Components.

import { ErrorScreen } from "@/app/components/shared/ErrorScreen";

/** Catches render errors in any route below the root layout. */
export default function RootError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <ErrorScreen code="Error" title="Something went wrong." error={error} retry={retry}>
      This page failed to render. Nothing was signed or sent from this screen —
      your on-chain will is unaffected. Try again, or head back home.
    </ErrorScreen>
  );
}
