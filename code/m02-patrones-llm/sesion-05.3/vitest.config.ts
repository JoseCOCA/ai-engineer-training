import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60000,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
