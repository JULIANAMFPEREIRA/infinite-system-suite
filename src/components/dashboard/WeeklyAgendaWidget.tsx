import { useMemo, useState } from "react";
import { addDays, addWeeks, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Eye, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useVisitas } from "@/hooks/useAgenda";
import { useGoogleCalendarStatus, useGoogleCalendarEvents } from "@/hooks/useGoogleCalendar";

const safeDate = (val: any): Date | null => {
  const str = typeof val === "string" ? val : val?.dateTime ?? val?.date ?? null;
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

const HOUR_START = 7;
const HOUR_END = 20;
const HOUR_PX = 36;

const WeeklyAgendaWidget = () => {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekEnd = useMemo(() => endOfWeek(weekStart, { weekStartsOn: 1 }), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    []
  );

  const { data: visitas = [] } = useVisitas({
    from: weekStart.toISOString(),
    to: addDays(weekEnd, 1).toISOString(),
  });

  const empresaId = useEmpresa();
  const { data: fallbackVisitas = [] } = useQuery({
    queryKey: ["crm_interacoes_visitas", empresaId, weekStart.toISOString()],
    queryFn: async () => {
      const fromIso = weekStart.toISOString();
      const toIso = addDays(weekEnd, 1).toISOString();
      const { data, error } = await supabase
        .from("crm_interacoes")
        .select("id, descricao, visivel_portal, created_at, clientes(nome)")
        .eq("tipo", "visita")
        .gte("created_at", addDays(weekStart, -30).toISOString());
      if (error) return [];
      return (data ?? [])
        .map((row: any) => {
          let p: any = {};
          try { p = JSON.parse(row.descricao ?? "{}"); } catch { p = {}; }
          const s = p.data_inicio ? new Date(p.data_inicio) : null;
          const e = p.data_fim ? new Date(p.data_fim) : null;
          return {
            id: row.id,
            titulo: p.titulo ?? "Visita",
            _start: s && !isNaN(s.getTime()) ? s : null,
            _end: e && !isNaN(e.getTime()) ? e : null,
            visivel_portal: row.visivel_portal ?? p.visivel_portal ?? true,
            clienteNome: row.clientes?.nome ?? null,
            status: p.status ?? "agendada",
          };
        })
        .filter((v: any) => v._start && v._start >= new Date(fromIso) && v._start <= new Date(toIso));
    },
  });

  const { data: googleStatus } = useGoogleCalendarStatus();
  const isGoogleConnected = googleStatus?.connected === true;
  const { data: googleEvents } = useGoogleCalendarEvents(isGoogleConnected);
  const gEvents = (Array.isArray(googleEvents) ? googleEvents : [])
    .map((e: any) => ({ ...e, _start: safeDate(e.start), _end: safeDate(e.end) }))
    .filter((e) => e._start && e._start >= weekStart && e._start <= addDays(weekEnd, 1));

  const blockStyle = (start: Date, end: Date) => {
    const top = (start.getHours() + start.getMinutes() / 60 - HOUR_START) * HOUR_PX;
    const height = Math.max(18, ((end.getTime() - start.getTime()) / 3600000) * HOUR_PX - 2);
    return { top, height };
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between p-4 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Agenda da Semana</h3>
          <p className="text-[11px] text-muted-foreground">
            {format(weekStart, "dd 'de' MMM", { locale: ptBR })} — {format(weekEnd, "dd 'de' MMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, -1))}>
            <ChevronLeft size={14} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight size={14} />
          </Button>
          <Button size="sm" onClick={() => navigate("/agenda")}>
            <Plus size={14} className="mr-1" /> Nova Visita
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[44px_repeat(7,1fr)] border-y border-border bg-secondary/40">
            <div />
            {days.map((d) => {
              const today = isSameDay(d, new Date());
              return (
                <div key={d.toISOString()} className={`p-1.5 text-center border-l border-border ${today ? "bg-primary/10" : ""}`}>
                  <div className="text-[9px] uppercase text-muted-foreground tracking-wider">
                    {format(d, "EEE", { locale: ptBR })}
                  </div>
                  <div className={`text-xs font-semibold ${today ? "text-primary" : ""}`}>
                    {format(d, "dd/MM")}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-[44px_repeat(7,1fr)]">
            <div>
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR_PX }} className="text-[9px] text-muted-foreground text-right pr-1 pt-0.5 border-b border-border/40">
                  {String(h).padStart(2, "0")}h
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayVisitas = visitas.filter((v) => isSameDay(new Date(v.data_inicio), day));
              const dayFallback = fallbackVisitas.filter((v: any) => isSameDay(v._start, day));
              const dayGoogle = gEvents.filter((e: any) => isSameDay(e._start, day));
              return (
                <div
                  key={day.toISOString()}
                  className="relative border-l border-border cursor-pointer"
                  onClick={() => navigate("/agenda")}
                >
                  {hours.map((h) => (
                    <div key={h} style={{ height: HOUR_PX }} className="border-b border-border/40 hover:bg-primary/5 transition-colors" />
                  ))}
                  {dayVisitas.map((v) => {
                    const start = new Date(v.data_inicio);
                    const end = new Date(v.data_fim);
                    const { top, height } = blockStyle(start, end);
                    const visible = (v as any).visivel_portal ?? true;
                    const colorCls = visible
                      ? "bg-amber-400/30 border-amber-500/70 text-amber-950"
                      : "bg-[hsl(210,70%,50%)]/15 border-[hsl(210,70%,50%)]/60 text-foreground";
                    return (
                      <div
                        key={v.id}
                        style={{ top, height }}
                        className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[9px] border overflow-hidden shadow-sm ${v.status === "cancelada" ? "opacity-60 line-through" : ""} ${colorCls}`}
                      >
                        <div className="flex items-center gap-1 font-semibold truncate">
                          {visible && <Eye size={8} className="shrink-0 opacity-80" />}
                          <span className="truncate">{v.titulo}</span>
                        </div>
                        <div className="opacity-80 truncate">{format(start, "HH:mm")}</div>
                      </div>
                    );
                  })}
                  {dayFallback.map((v: any) => {
                    const end = v._end ?? new Date(v._start.getTime() + 60 * 60 * 1000);
                    const { top, height } = blockStyle(v._start, end);
                    const visible = v.visivel_portal ?? true;
                    const colorCls = visible
                      ? "bg-amber-400/30 border-amber-500/70 text-amber-950"
                      : "bg-[hsl(210,70%,50%)]/15 border-[hsl(210,70%,50%)]/60 text-foreground";
                    return (
                      <div
                        key={`f-${v.id}`}
                        style={{ top, height }}
                        className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[9px] border overflow-hidden shadow-sm ${colorCls}`}
                      >
                        <div className="flex items-center gap-1 font-semibold truncate">
                          {visible && <Eye size={8} className="shrink-0 opacity-80" />}
                          <span className="truncate">{v.titulo}</span>
                        </div>
                        <div className="opacity-80 truncate">{format(v._start, "HH:mm")}</div>
                      </div>
                    );
                  })}
                  {isGoogleConnected && dayGoogle.map((ev: any) => {
                    const end = ev._end ?? new Date(ev._start.getTime() + 60 * 60 * 1000);
                    const { top, height } = blockStyle(ev._start, end);
                    return (
                      <div
                        key={`g-${ev.id}`}
                        style={{ top, height }}
                        className="absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[9px] border overflow-hidden shadow-sm bg-[hsl(210,70%,50%)]/15 border-[hsl(210,70%,50%)]/60 text-foreground"
                      >
                        <div className="flex items-center gap-1 font-semibold truncate">
                          <CalendarIcon size={8} className="text-[hsl(210,70%,50%)] shrink-0" />
                          <span className="truncate">{ev.summary || "(sem título)"}</span>
                        </div>
                        <div className="opacity-80 truncate">{format(ev._start, "HH:mm")}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap p-3 border-t border-border">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-amber-400/30 border border-amber-400/60" />
          Compartilhadas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-[hsl(210,70%,50%)]/30 border border-[hsl(210,70%,50%)]/60" />
          Internas / Google
        </span>
      </div>
    </div>
  );
};

export default WeeklyAgendaWidget;