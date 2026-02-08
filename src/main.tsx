import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const disableServiceWorker = true;

    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        await Promise.all(registrations.map((registration) => registration.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key.startsWith("chefos-shell-"))
              .map((key) => caches.delete(key)),
          );
        }
      })
      .catch((error) => {
        console.warn("Failed to cleanup existing service workers", error);
      })
      .finally(() => {
        if (disableServiceWorker) return;
        navigator.serviceWorker.register("/sw.js").catch((error) => {
          console.error("Service worker registration failed", error);
        });
      });
  });
}
