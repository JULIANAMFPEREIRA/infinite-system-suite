import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, ArrowRight, Calendar as CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProximasVisitas } from "@/hooks/useAgenda";
import { useGoogleCalendarStatus, useGoogleCalendarEvents } from "@/hooks/useGoogleCalendar";

const safeDate = (val: any): Date | null => {
  const str = typeof val === "string" ? val : val?.dateTime ?? val?.date ?? null;
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

const ProximosCompromissos = () => {
  const { data: visitas = [], isLoading } = useProximasVisitas(5);
  const navigate = useNavigate();
  const { data: googleStatus } = useGoogleCalendarStatus();
  const isGoogleConnected = googleStatus?.connected === true;
  const { data: googleEvents } = useGoogleCalendarEvents(isGoogleConnected);
  const gEvents = (Array.isArray(googleEvents) ? googleEvents : [])
    .map((e: any) => ({ ...e, _start: safeDate(e.start) }))
    .filter((e) => e._start)
    .slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-primary" />
          <p className="text-[11px] text-foreground font-bold uppercase tracking-wider">Próximos Compromissos</p>
        </div>
        <button onClick={() => navigate("/agenda")} className="text-[11px] text-primary hover:underline flex items-center gap-1">
          Ver agenda <ArrowRight size={11} />
        </button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : visitas.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">Nenhum compromisso agendado.</p>
      ) : (
        <ul className="space-y-2">
          {visitas.map((v) => (
            <li
              key={v.id}
              onClick={() => navigate("/agenda")}
              className="rounded-lg border border-border/60 px-3 py-2 hover:bg-secondary/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold truncate">{v.titulo}</p>
                <span className="text-[10px] text-primary font-medium whitespace-nowrap">
                  {format(new Date(v.data_inicio), "dd/MM HH:mm", { locale: ptBR })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                {v.clientes?.nome && <span>{v.clientes.nome}</span>}
                {v.visita_tecnicos && v.visita_tecnicos.length > 0 && (
                  <span className="truncate">
                    · {v.visita_tecnicos.map((t) => t.fornecedores?.nome).filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {isGoogleConnected && gEvents.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/60">
          <div className="flex items-center gap-2 mb-2">
            <CalendarIcon size={12} className="text-primary" />
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Google Agenda</p>
          </div>
          <ul className="space-y-2">
            {gEvents.map((ev: any) => (
              <li
                key={ev.id}
                onClick={() => navigate("/agenda")}
                className="rounded-lg border border-border/60 px-3 py-2 hover:bg-secondary/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[9px] font-semibold shrink-0">
                      <CalendarIcon size={9} /> Google
                    </span>
                    <p className="text-[13px] font-semibold truncate">{ev.summary || "(sem título)"}</p>
                  </div>
                  <span className="text-[10px] text-primary font-medium whitespace-nowrap">
                    {format(ev._start, "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProximosCompromissos;