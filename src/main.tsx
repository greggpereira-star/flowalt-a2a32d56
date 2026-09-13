import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "./index.css";
import "./styles/onboarding.css";

// TipTap mentions usam tippy.js para o dropdown; o CSS é necessário para o popup aparecer.
import "tippy.js/dist/tippy.css";

import { registerServiceWorker } from "@/lib/pwa/registerServiceWorker";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system">
    <App />
  </ThemeProvider>
);

// Registrado no boot, e nao so quando alguem ativa notificacao: e o que
// garante que uma versao publicada chegue no time sem pedir Ctrl+Shift+R.
registerServiceWorker();
