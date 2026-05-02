 import { useEffect, useRef } from "react";
import { Building2, CheckCircle2, Clock, Calendar, Loader2, Unlink } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
 import { useAuth } from "@/contexts/AuthContext";
import {
  useGoogleCalendarStatus,
  useGoogleAuthUrl,
  useGoogleCallback,
  useGoogleDisconnect,
  useGoogleCalendarEvents,
} from "@/hooks/useGoogleCalendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const integracoes = [
  { nome: "Banco Cora", status: "planejado", desc: "Boletos e conciliação bancária" },
  { nome: "Bradesco", status: "planejado", desc: "Integração via API bancária" },
  { nome: "Nubank", status: "planejado", desc: "Leitura de extratos e conciliação" },
  { nome: "WhatsApp Business", status: "planejado", desc: "Envio de cobranças e notificações" },
  { nome: "Prefeitura (NFS-e)", status: "planejado", desc: "Emissão de notas fiscais de serviço" },
];

const Integracoes = () => {
  const [searchParams, setSearchParams] = useSearchParams();
   const { user } = useAuth();
  const { data: googleStatus, isLoading: loadingStatus } = useGoogleCalendarStatus();
  const authUrlMutation = useGoogleAuthUrl();
  const callbackMutation = useGoogleCallback();
  const disconnectMutation = useGoogleDisconnect();
  const { data: events } = useGoogleCalendarEvents(googleStatus?.connected ?? false);
   const callbackProcessed = useRef(false);

  // Handle OAuth callback code
  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      toast.error("Conexão cancelada.");
      setSearchParams({});
      return;
    }

    if (!code || !user) return;

    // Garantir que só processa uma vez
    if (callbackProcessed.current) return;
    callbackProcessed.current = true;

    toast.info("Conectando ao Google Agenda...");

    callbackMutation.mutate(code, {
      onSuccess: () => {
        toast.success("Google Agenda conectado!");
        setSearchParams({});
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      },
      onError: (err) => {
        callbackProcessed.current = false;
        toast.error("Erro: " + (err as Error).message);
        setSearchParams({});
      },
    });
  }, [user]);

  const handleConnect = () => {
    authUrlMutation.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: (err) => {
        toast.error("Erro: " + (err as Error).message);
      },
    });
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate(undefined, {
      onSuccess: () => toast.success("Google Agenda desconectado."),
      onError: () => toast.error("Erro ao desconectar."),
    });
  };

  const isConnected = googleStatus?.connected ?? false;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <Building2 size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Integrações</h1>
      </div>
      <p className="text-xs text-muted-foreground">Status das integrações disponíveis e planejadas para o sistema.</p>

      {/* Google Calendar Integration */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <Calendar size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Google Agenda</h3>
              <p className="text-[11px] text-muted-foreground">Sincronize visitas técnicas com seu Google Calendar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {loadingStatus ? (
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            ) : isConnected ? (
              <>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[hsl(152,69%,40%)]/15 text-[hsl(152,69%,40%)] flex items-center gap-1">
                  <CheckCircle2 size={12} /> Conectado
                </span>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Desconectar"
                >
                  <Unlink size={14} />
                </button>
              </>
            ) : (
              <button
                onClick={handleConnect}
                disabled={authUrlMutation.isPending || callbackMutation.isPending}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {(authUrlMutation.isPending || callbackMutation.isPending) && <Loader2 size={12} className="animate-spin" />}
                Conectar Google Agenda
              </button>
            )}
          </div>
        </div>

        {/* Upcoming events from Google */}
        {isConnected && events && events.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-3">Próximos eventos do Google</p>
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {events.slice(0, 8).map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex flex-col items-center justify-center w-9 h-9 rounded-lg bg-primary/15 text-primary shrink-0">
                    <span className="text-[10px] font-bold leading-tight">
                      {ev.start ? format(new Date(ev.start), "dd") : "—"}
                    </span>
                    <span className="text-[8px] uppercase">
                      {ev.start ? format(new Date(ev.start), "MMM", { locale: ptBR }) : ""}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{ev.summary}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {ev.start ? format(new Date(ev.start), "HH:mm") : "—"}
                      {ev.end ? ` – ${format(new Date(ev.end), "HH:mm")}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Other integrations */}
      <div className="space-y-3">
        {integracoes.map((int, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {int.status === "ativo" ? <CheckCircle2 size={18} className="text-[hsl(152,69%,40%)]" /> : <Clock size={18} className="text-muted-foreground" />}
              <div>
                <h3 className="text-sm font-semibold text-foreground">{int.nome}</h3>
                <p className="text-[11px] text-muted-foreground">{int.desc}</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${int.status === "ativo" ? "bg-[hsl(152,69%,40%)]/15 text-[hsl(152,69%,40%)]" : "bg-secondary text-secondary-foreground"}`}>
              {int.status === "ativo" ? "Ativo" : "Planejado"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Integracoes;
