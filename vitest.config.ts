import path from "node:path";
import { defineConfig } from "vitest/config";

process.env.DATABASE_URL = `file:${path.join(__dirname, ".test-board.db")}`;

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
