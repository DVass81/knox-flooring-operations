import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ accept: vi.fn(), decline: vi.fn() }));
vi.mock("@workspace/api-client-react", () => ({
  useAcceptPublicQuote: () => ({ mutateAsync: mocks.accept, isPending: false }),
  useDeclinePublicQuote: () => ({
    mutateAsync: mocks.decline,
    isPending: false,
  }),
}));
import { usePublicQuoteResponse } from "./use-public-quote-response";
beforeEach(() => {
  mocks.accept.mockReset();
  mocks.decline.mockReset();
});

describe("public quote version review", () => {
  it("allows only one pending response even for repeated calls before a rerender", async () => {
    let finish!: () => void;
    mocks.accept.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(() =>
      usePublicQuoteResponse("quote-token", 1, async () => undefined),
    );
    act(() => {
      result.current.setFullName("One Response");
      result.current.setAgreed(true);
    });
    await act(async () => {
      const first = result.current.handleAccept(),
        second = result.current.handleAccept();
      expect(mocks.accept).toHaveBeenCalledTimes(1);
      finish();
      await Promise.all([first, second]);
    });
  });
  it("retains the signature on conflict and requires refreshed terms and renewed agreement", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    mocks.accept
      .mockRejectedValueOnce({ status: 409 })
      .mockResolvedValue({ status: "Accepted" });
    const { result, rerender } = renderHook(
      ({ revision }) =>
        usePublicQuoteResponse("quote-token", revision, refresh),
      { initialProps: { revision: 7 } },
    );
    act(() => {
      result.current.setFullName("Jordan Smith");
      result.current.setAgreed(true);
    });
    await act(async () => result.current.handleAccept());
    expect(mocks.accept).toHaveBeenLastCalledWith({
      token: "quote-token",
      data: { signature: "Jordan Smith", revision: 7 },
    });
    expect(result.current.fullName).toBe("Jordan Smith");
    expect(result.current.agreed).toBe(false);
    expect(result.current.termsChanged).toBe(true);
    await act(async () => result.current.handleDecline());
    expect(mocks.decline).not.toHaveBeenCalled();
    await act(async () => result.current.refreshTerms());
    rerender({ revision: 8 });
    expect(result.current.termsChanged).toBe(false);
    expect(result.current.fullName).toBe("Jordan Smith");
    await act(async () => result.current.handleAccept());
    expect(mocks.accept).toHaveBeenCalledTimes(1);
    act(() => result.current.setAgreed(true));
    await act(async () => result.current.handleAccept());
    expect(mocks.accept).toHaveBeenLastCalledWith({
      token: "quote-token",
      data: { signature: "Jordan Smith", revision: 8 },
    });
  });
  it("keeps responses blocked when refreshing the current terms fails", async () => {
    mocks.accept.mockRejectedValue({ status: 409 });
    const refresh = vi.fn().mockRejectedValue(new Error("Offline"));
    const { result } = renderHook(() =>
      usePublicQuoteResponse("quote-token", 2, refresh),
    );
    act(() => {
      result.current.setFullName("Retain Me");
      result.current.setAgreed(true);
    });
    await act(async () => result.current.handleAccept());
    await act(async () => result.current.refreshTerms());
    expect(result.current.termsChanged).toBe(true);
    expect(result.current.fullName).toBe("Retain Me");
    expect(result.current.error).toContain("could not be loaded");
    await act(async () => result.current.handleAccept());
    expect(mocks.accept).toHaveBeenCalledTimes(1);
  });
  it("binds a decline to the displayed revision and clears old acceptance when terms update", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    mocks.decline.mockResolvedValue({ status: "Declined" });
    const { result, rerender } = renderHook(
      ({ revision }) =>
        usePublicQuoteResponse("quote-token", revision, refresh),
      { initialProps: { revision: 2 } },
    );
    act(() => result.current.setAgreed(true));
    rerender({ revision: 3 });
    expect(result.current.agreed).toBe(false);
    await act(async () => result.current.handleDecline());
    expect(mocks.decline).toHaveBeenCalledWith({
      token: "quote-token",
      data: { revision: 3 },
    });
  });
});
