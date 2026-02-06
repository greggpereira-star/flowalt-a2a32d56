import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./styles/onboarding.css";

// TipTap mentions usam tippy.js para o dropdown; o CSS é necessário para o popup aparecer.
import "tippy.js/dist/tippy.css";

createRoot(document.getElementById("root")!).render(<App />);
