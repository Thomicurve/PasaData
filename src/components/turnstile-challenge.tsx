"use client";

import { useEffect, useRef, useState } from "react";

export type TurnstileOptions = {
  sitekey: string; action: string; size: "flexible"; theme: "light"; language: "es";
  "response-field": false; retry: "never"; "refresh-expired": "manual"; "refresh-timeout": "manual";
  callback: (token: string) => void;
  "expired-callback": () => void; "error-callback": () => void; "timeout-callback": () => void;
};
declare global {
  interface Window {
    turnstile?: { render: (container: HTMLElement, options: TurnstileOptions) => string | undefined; remove: (id: string) => void };
  }
}
type State = "loading" | "pending" | "ready" | "expired" | "error" | "unavailable";
const messages: Record<State, string> = {
  loading: "Cargando la verificación…",
  pending: "Completá la verificación para continuar.",
  ready: "La verificación está lista. Cloudflare no recibe tu imagen.",
  expired: "La verificación venció. Volvé a verificar para continuar.",
  error: "No pudimos completar la verificación. Volvé a intentarlo.",
  unavailable: "La verificación no está disponible. Volvé a intentarlo más tarde.",
};

export default function TurnstileChallenge({ onToken }: { onToken: (token: string | null) => void }) {
  const [state, setState] = useState<State>("loading");
  const [attempt, setAttempt] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const notify = useRef(onToken);
  useEffect(() => { notify.current = onToken; }, [onToken]);
  useEffect(() => {
    let active = true;
    let accepting = true;
    let widget: string | undefined;
    let api: Window["turnstile"];
    let script: HTMLScriptElement | undefined;
    let timer: number | undefined;
    let expiry: number | undefined;
    const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
    notify.current(null);
    function invalidate(next: State) {
      if (!active) return;
      accepting = false;
      window.clearTimeout(timer);
      window.clearTimeout(expiry);
      notify.current(null);
      setState(next);
    }
    function renderWidget() {
      if (!active || !accepting) return;
      window.clearTimeout(timer);
      api = window.turnstile;
      if (!api || !container.current) { invalidate("error"); return; }
      setState("pending");
      timer = window.setTimeout(() => invalidate("error"), 120_000);
      try {
        widget = api.render(container.current, {
          sitekey: key!, action: "extract", size: "flexible", theme: "light", language: "es",
          "response-field": false, retry: "never", "refresh-expired": "manual", "refresh-timeout": "manual",
          callback: (token) => {
            if (!active || !accepting) return;
            if (!token || token.trim() !== token || token.length > 2048) { invalidate("error"); return; }
            accepting = false;
            window.clearTimeout(timer);
            notify.current(token);
            setState("ready");
            // Also expire locally if the provider callback is delayed or lost.
            expiry = window.setTimeout(() => invalidate("expired"), 300_000);
          },
          "expired-callback": () => invalidate("expired"),
          "error-callback": () => invalidate("error"),
          "timeout-callback": () => invalidate("error"),
        });
        if (!widget) invalidate("error");
      } catch { invalidate("error"); }
    }
    if (!key) invalidate("unavailable");
    else if (window.turnstile) renderWidget();
    else {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = renderWidget;
      script.onerror = () => invalidate("error");
      timer = window.setTimeout(() => invalidate("error"), 15_000);
      document.head.append(script);
    }
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearTimeout(expiry);
      if (script) { script.onload = null; script.onerror = null; script.remove(); }
      if (widget && api) { try { api.remove(widget); } catch { /* A failed provider cleanup cannot authorize a late callback. */ } }
      notify.current(null);
    };
  }, [attempt]);

  return <section className="bot-verification" aria-labelledby="verification-title">
    <h2 id="verification-title">Verificación antibots</h2>
    <div ref={container} className="turnstile-widget" />
    <p id="verification-status" role="status">{messages[state]}</p>
    {(state === "expired" || state === "error") && <button className="secondary" onClick={() => { setState("loading"); setAttempt((value) => value + 1); }}>Reintentar verificación</button>}
  </section>;
}
