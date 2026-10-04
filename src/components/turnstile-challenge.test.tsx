// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TurnstileChallenge, { type TurnstileOptions } from "./turnstile-challenge";

const renderWidget = vi.fn();
const remove = vi.fn();
const onToken = vi.fn();
let options: TurnstileOptions;
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "synthetic-public-key");
  renderWidget.mockImplementation((_node, config) => { options = config; return "synthetic-widget"; });
  Object.assign(window, { turnstile: { render: renderWidget, remove } });
});
afterEach(() => { cleanup(); delete window.turnstile; vi.unstubAllEnvs(); vi.resetAllMocks(); vi.useRealTimers(); });
it("renders the official widget with a single explicit action and invalidates expired tokens", () => {
  render(<TurnstileChallenge onToken={onToken} />);
  expect(options).toMatchObject({ sitekey: "synthetic-public-key", action: "extract", size: "flexible", "response-field": false, retry: "never" });
  act(() => options.callback("synthetic-token"));
  expect(onToken).toHaveBeenLastCalledWith("synthetic-token");
  expect(screen.getByRole("status").textContent).toMatch(/está lista/);
  act(() => options["expired-callback"]());
  expect(onToken).toHaveBeenLastCalledWith(null);
  expect(screen.getByRole("status").textContent).toMatch(/venció/);
  act(() => options.callback("late-token"));
  expect(onToken).not.toHaveBeenCalledWith("late-token");
});
it.each(["error-callback", "timeout-callback"] as const)("recovers manually from %s and ignores replaced/unmounted callbacks", (callback) => {
  const view = render(<TurnstileChallenge onToken={onToken} />);
  const old = options;
  act(() => old[callback]());
  fireEvent.click(screen.getByRole("button", { name: "Reintentar verificación" }));
  expect(remove).toHaveBeenCalledWith("synthetic-widget");
  act(() => old.callback("stale-token"));
  expect(onToken).not.toHaveBeenCalledWith("stale-token");
  act(() => options.callback("fresh-token"));
  expect(onToken).toHaveBeenLastCalledWith("fresh-token");
  view.unmount();
  act(() => options.callback("unmounted-token"));
  expect(onToken).not.toHaveBeenCalledWith("unmounted-token");
});
it("fails closed without a public key", () => {
  vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
  render(<TurnstileChallenge onToken={onToken} />);
  expect(renderWidget).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toMatch(/no está disponible/);
});
it("renders after successful script loading and removes its script and widget", () => {
  delete window.turnstile;
  const view = render(<TurnstileChallenge onToken={onToken} />);
  const script = document.querySelector("script")!;
  Object.assign(window, { turnstile: { render: renderWidget, remove } });
  fireEvent.load(script);
  expect(renderWidget).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(script.isConnected).toBe(false);
  expect(remove).toHaveBeenCalledTimes(1);
});
it("bounds a stalled challenge and expires a token even if the provider loses its expiry callback", () => {
  vi.useFakeTimers();
  render(<TurnstileChallenge onToken={onToken} />);
  act(() => vi.advanceTimersByTime(120_000));
  expect(screen.getByRole("button", { name: "Reintentar verificación" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar verificación" }));
  act(() => options.callback("synthetic-token"));
  act(() => vi.advanceTimersByTime(300_000));
  expect(onToken).toHaveBeenLastCalledWith(null);
  expect(screen.getByRole("status").textContent).toMatch(/venció/);
});
it.each(["error", "timeout", "load"])("loads the direct Cloudflare script and handles %s without waiting forever", (event) => {
  delete window.turnstile;
  vi.useFakeTimers();
  render(<TurnstileChallenge onToken={onToken} />);
  const script = document.querySelector("script")!;
  expect(script.src).toBe("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
  if (event === "timeout") act(() => vi.advanceTimersByTime(15_000));
  else fireEvent(script, new Event(event));
  expect(screen.getByRole("button", { name: "Reintentar verificación" })).toBeTruthy();
  expect(onToken).toHaveBeenLastCalledWith(null);
});
