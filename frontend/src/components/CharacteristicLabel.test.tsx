import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CharacteristicLabel from "./CharacteristicLabel";

describe("CharacteristicLabel", () => {
  it("renders an icon (not text) for a characteristic with one mapped", () => {
    render(<CharacteristicLabel characteristic="Standard" />);

    const img = screen.getByRole("img", { name: "Standard" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("title", "Standard");
  });

  it("uses the friendlier label override for both alt and title when one exists", () => {
    render(<CharacteristicLabel characteristic="NoArrows" />);

    const img = screen.getByRole("img", { name: "No Arrows" });
    expect(img).toHaveAttribute("title", "No Arrows");
  });

  it("falls back to plain text for a characteristic with no icon mapped", () => {
    render(<CharacteristicLabel characteristic="SomeFutureCharacteristic" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("SomeFutureCharacteristic")).toBeInTheDocument();
  });

  it("applies the given className only on the text fallback path", () => {
    render(<CharacteristicLabel characteristic="Unmapped" className="custom-class" />);

    expect(screen.getByText("Unmapped")).toHaveClass("custom-class");
  });
});
