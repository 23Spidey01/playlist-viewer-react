import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";

// Throws unconditionally — NOT a "throw once then stop" flag. React
// retries a failed render synchronously once before giving up (to
// rule out a concurrent-rendering fluke), so anything that only
// throws conditionally on a mutable flag read during render can flip
// itself off mid-way through a single logical render attempt and the
// boundary never actually sees an error. Recovery is tested below by
// swapping in a different, non-throwing element via rerender() while
// the boundary is still showing its fallback, not by mutating this one.
const AlwaysThrows: React.FC = () => {
  throw new Error("boom");
};

const Fine: React.FC = () => <div>all good</div>;

function Harness({ bomb }: { bomb: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/bomb"]}>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/bomb" element={bomb} />
        </Routes>
      </ErrorBoundary>
    </MemoryRouter>
  );
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children normally when nothing throws", () => {
    render(<Harness bomb={<Fine />} />);

    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("shows a fallback instead of unmounting the whole app when a child throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Harness bomb={<AlwaysThrows />} />);

    expect(screen.getByText("!! SOMETHING WENT WRONG !!")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("logs the caught error to the console for debugging", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<Harness bomb={<AlwaysThrows />} />);

    expect(errorSpy).toHaveBeenCalledWith(
      "Unhandled error in a React component:",
      expect.any(Error),
      expect.anything(),
    );
  });

  it("recovers on \"Try Again\" once the underlying problem is gone", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    const { rerender } = render(<Harness bomb={<AlwaysThrows />} />);
    expect(screen.getByText("!! SOMETHING WENT WRONG !!")).toBeInTheDocument();

    // Stands in for the real world: whatever made it throw the first
    // time (e.g. a malformed API response) isn't necessarily still
    // true by the time the user clicks retry. The fallback stays up
    // until that click — a boundary that already re-threw on its own
    // wouldn't need a "Try Again" button at all.
    rerender(<Harness bomb={<Fine />} />);
    expect(screen.getByText("!! SOMETHING WENT WRONG !!")).toBeInTheDocument();

    await user.click(screen.getByText("Try Again"));

    expect(screen.getByText("all good")).toBeInTheDocument();
  });
});
