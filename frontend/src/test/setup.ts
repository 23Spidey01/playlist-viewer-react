// src/test/setup.ts — runs once before every test file (see
// vitest.config.ts's setupFiles). Extends Vitest's `expect` with
// jest-dom's DOM matchers (toBeInTheDocument, toHaveTextContent, ...)
// and cleans up anything React Testing Library rendered after each
// test, so one test's leftover DOM never leaks into the next.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
