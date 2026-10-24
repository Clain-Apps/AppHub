import { afterEach, describe, expect, it, vi } from "vitest";
import { createTitleAdminControl } from "./createTitleAdminControl";

describe("createTitleAdminControl", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("turns administrator mode on after a five second hold and ignores the click that follows", () => {
    vi.useFakeTimers();
    const enabled: boolean[] = [];
    const disabled: boolean[] = [];
    const control = createTitleAdminControl({
      holdDurationMilliseconds: 5_000,
      onAdministratorEnabled: () => enabled.push(true),
      onAdministratorDisabled: () => disabled.push(true),
    });

    control.handlePointerDown();
    vi.advanceTimersByTime(4_999);
    expect(enabled).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(enabled).toHaveLength(1);
    control.handlePointerUp();
    control.handleClick();
    expect(disabled).toHaveLength(0);
  });

  it("turns administrator mode off on a short click", () => {
    const disabled: boolean[] = [];
    const control = createTitleAdminControl({
      holdDurationMilliseconds: 5_000,
      onAdministratorEnabled: () => undefined,
      onAdministratorDisabled: () => disabled.push(true),
    });

    control.handlePointerDown();
    control.handlePointerUp();
    control.handleClick();
    expect(disabled).toHaveLength(1);
  });

  it("cancels a hold that is released early", () => {
    vi.useFakeTimers();
    const enabled: boolean[] = [];
    const control = createTitleAdminControl({
      holdDurationMilliseconds: 5_000,
      onAdministratorEnabled: () => enabled.push(true),
      onAdministratorDisabled: () => undefined,
    });

    control.handlePointerDown();
    control.handlePointerCancel();
    vi.advanceTimersByTime(5_000);
    expect(enabled).toHaveLength(0);
  });
});
