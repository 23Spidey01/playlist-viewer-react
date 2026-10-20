// vitest.config.ts — kept separate from vite.config.ts on purpose: the
// app's own config stays focused on build/dev-server concerns (the
// Tailwind plugin, the /proxy and /api dev-server proxies), none of
// which tests need, while this one only needs the React plugin (for
// JSX) plus jsdom so components have a DOM to render into.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
