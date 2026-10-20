import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DiffBadge from "./DiffBadge";

describe("DiffBadge", () => {
  it("shows the difficulty name, colored by difficulty, when unranked", () => {
    render(<DiffBadge difficulty="ExpertPlus" />);

    const badge = screen.getByText("ExpertPlus");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("diff-ExpertPlus");
    expect(badge).not.toHaveClass("starred");
  });

  it("switches to the gold \"starred\" look and shows the rating once it has a star value", () => {
    render(<DiffBadge difficulty="Hard" stars={6.5} />);

    const badge = screen.getByText("Hard");
    expect(badge).toHaveClass("starred");
    expect(badge).not.toHaveClass("diff-Hard");
    expect(screen.getByText("★ 6.5")).toBeInTheDocument();
  });

  it("adds the selected class only when selected", () => {
    const { rerender } = render(<DiffBadge difficulty="Easy" />);
    expect(screen.getByText("Easy")).not.toHaveClass("selected");

    rerender(<DiffBadge difficulty="Easy" selected />);
    expect(screen.getByText("Easy")).toHaveClass("selected");
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<DiffBadge difficulty="Normal" onClick={onClick} />);

    await user.click(screen.getByText("Normal"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("stays zero-star at exactly 0 stars (a falsy but valid rating)", () => {
    render(<DiffBadge difficulty="Easy" stars={0} />);

    expect(screen.getByText("Easy")).toHaveClass("starred");
    expect(screen.getByText("★ 0")).toBeInTheDocument();
  });
});
