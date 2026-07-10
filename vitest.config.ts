import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    exclude: ["**/node_modules/**", "src/**/*.integration.test.{ts,tsx}"],
    // jsdom UI smokes (e.g. meal-planner) can exceed Vitest's 5s default under CI load.
    testTimeout: 15_000,
  },
});
