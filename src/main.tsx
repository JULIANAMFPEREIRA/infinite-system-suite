import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";

// Monitoramento de erros (Sentry): só em produção, sem dados pessoais, sem rastreamento de desempenho.
// O DSN é uma chave PÚBLICA de envio (pode ficar no front-end); não dá acesso a nada.
const emProducao = window.location.hostname.endsWith("infinitnetwork.com.br");
Sentry.init({
  dsn:
    import.meta.env.VITE_SENTRY_DSN ??
    "https://412d13563badf946df2655f1c5dc8662@o4512198681034752.ingest.us.sentry.io/4512247052238848",
  enabled: emProducao,
  environment: emProducao ? "producao" : "desenvolvimento",
  tracesSampleRate: 0,
});

createRoot(document.getElementById("root")!).render(<App />);
