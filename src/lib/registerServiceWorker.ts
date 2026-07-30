// Registra o service worker no navegador. Só roda no cliente
// (chamado dentro de um useEffect, nunca durante SSR).
// Nunca registra em dev, dentro de iframe ou nos previews do Lovable —
// nesses contextos qualquer registro existente é removido.

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterAll() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => (r.active?.scriptURL ?? r.installing?.scriptURL ?? "").includes("/sw.js"))
      .map((r) => r.unregister()),
  );
}

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isBlockedContext()) {
    void unregisterAll();
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "activated") {
              console.log("[VRENN] Nova versão do app disponível.");
            }
          });
        });
      })
      .catch((error) => {
        console.error("[VRENN] Falha ao registrar service worker:", error);
      });
  });
}
