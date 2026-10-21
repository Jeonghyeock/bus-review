import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json 의 paths("@/*")를 그대로 쓴다
  resolve: { tsconfigPaths: true },
  // --expose-gc: 요청 객체가 GC 돼도 끊김이 전해지는지 테스트에서 GC 를 직접 일으켜 확인한다(tests/in-view-gc.test.ts)
  test: { environment: "node", execArgv: ["--expose-gc"] },
});
