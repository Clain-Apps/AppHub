import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.stubGlobal(
  "matchMedia",
  vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }),
);

vi.stubGlobal("WebSocket", function FakeWebSocket() {
  return {
    addEventListener() {},
    close() {},
    send() {},
  };
});

describe("App", () => {
  it("renders the title, active filter and refresh control", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "AppHub" })).toBeTruthy();
    expect(screen.getByLabelText("Active")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
  });
});
