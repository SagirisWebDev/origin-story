import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["app/**/*.test.{js,ts,jsx,tsx}"],
    environment: "node",
  },
});
