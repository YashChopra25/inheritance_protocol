import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Server modules read these at import time; real values are never needed.
    env: {
      SESSION_SECRET: "test-secret-0123456789abcdef0123456789",
      NEXT_PUBLIC_PROGRAM_ID: "6sgj9jnnFcYem1u3N4wCfMdtTeeQRf7uT2AGWRU5EhtY",
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_RPC_ENDPOINT: "https://api.devnet.solana.com",
    },
  },
});
