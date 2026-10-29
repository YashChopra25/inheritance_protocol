"use client"; // Error boundaries must be Client Components.

// global-error replaces the root layout, so it brings its own document and
// global styles. Fonts are left to the system stack.
import "./globals.css";
import { ErrorScreen } from "@/app/components/shared/ErrorScreen";

/** Last-resort boundary: catches errors thrown by the root layout itself. */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <title>Something went wrong — VaultWill</title>
        <ErrorScreen code="Error" title="VaultWill failed to load." error={error} retry={retry}>
          The app could not start. Your on-chain will is unaffected — try
          again, and if this keeps happening, reload the page.
        </ErrorScreen>
      </body>
    </html>
  );
}
