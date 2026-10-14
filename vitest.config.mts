import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json 의 paths("@/*")를 그대로 쓴다
  resolve: { tsconfigPaths: true },
  test: { environment: "node" },
});
