import { useMemo, useState } from "react";
import { addDays, addWeeks, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVisitas, Visita } from "@/hooks/useAgenda";
import VisitaModal from "@/components/agenda/VisitaModal";
import { useGoogleCalendarStatus, useGoogleCalendarEvents } from "@/hooks/useGoogleCalendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { layoutOverlaps } from "@/lib/agendaLayout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format as fmtDate } from "date-fns";

const safeDate = (val: any): Date | null => {
  const str = typeof val === "string" ? val : val?.dateTime ?? val?.date ?? null;
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

const HOUR_START = 6;
const HOUR_END = 22;
const HOUR_PX = 56;

const Agenda = () => {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Visita | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | null>(null);
  const [selectedGoogleEvent, setSelectedGoogleEvent] = useState<any | null>(null);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
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
      let q = supabase
        .from("crm_interacoes")
        .select("id, cliente_id, descricao, visivel_portal, created_at, clientes(nome)")
        .eq("tipo", "visita")
        .gte("created_at", addDays(weekStart, -30).toISOString());
      const { data, error } = await q;
      if (error) return [];
      return (data ?? [])
        .map((row: any) => {
          let parsed: any = {};
          try { parsed = JSON.parse(row.descricao ?? "{}"); } catch { parsed = {}; }
          const start = parsed.data_inicio ? new Date(parsed.data_inicio) : null;
          const end = parsed.data_fim ? new Date(parsed.data_fim) : null;
          return {
            id: row.id,
            cliente_id: row.cliente_id,
            descricao: parsed.descricao ?? null,
            tecnico_ids: Array.isArray(parsed.tecnico_ids) ? parsed.tecnico_ids : [],
            titulo: parsed.titulo ?? "Visita",
            _start: start && !isNaN(start.getTime()) ? start : null,
            _end: end && !isNaN(end.getTime()) ? end : null,
            clienteNome: row.clientes?.nome ?? null,
            status: parsed.status ?? "agendada",
            visivel_portal: row.visivel_portal ?? parsed.visivel_portal ?? true,
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
    .filter((e) => e._start);

  const gEventsByDay = (day: Date) =>
    gEvents.filter((e) => e._start && isSameDay(e._start as Date, day));

  const gBlockStyle = (ev: any) => {
    const start = ev._start as Date;
    const end = (ev._end as Date) ?? new Date(start.getTime() + 60 * 60 * 1000);
    const top = (start.getHours() + start.getMinutes() / 60 - HOUR_START) * HOUR_PX;
    const height = Math.max(24, ((end.getTime() - start.getTime()) / 3600000) * HOUR_PX - 2);
    return { top, height };
  };

  const openNew = (day: Date, hour: number) => {
    const d = new Date(day);
    d.setHours(hour, 0, 0, 0);
    setEditing(null);
    setDefaultStart(d);
    setModalOpen(true);
  };

  const openEdit = (v: Visita) => {
    setEditing(v);
    setDefaultStart(null);
    setModalOpen(true);
  };

  const visitasByDay = (day: Date) => visitas.filter((v) => isSameDay(new Date(v.data_inicio), day));

  const fallbackByDay = (day: Date) =>
    fallbackVisitas.filter((v: any) => v._start && isSameDay(v._start, day));

  const fallbackBlockStyle = (v: any) => {
    const start: Date = v._start;
    const end: Date = v._end ?? new Date(start.getTime() + 60 * 60 * 1000);
    const top = (start.getHours() + start.getMinutes() / 60 - HOUR_START) * HOUR_PX;
    const height = Math.max(24, ((end.getTime() - start.getTime()) / 3600000) * HOUR_PX - 2);
    return { top, height };
  };

  const blockStyle = (v: Visita) => {
    const start = new Date(v.data_inicio);
    const end = new Date(v.data_fim);
    const top = (start.getHours() + start.getMinutes() / 60 - HOUR_START) * HOUR_PX;
    const height = Math.max(24, ((end.getTime() - start.getTime()) / 3600000) * HOUR_PX - 2);
    return { top, height };
  };

  const statusColor = (s: string) => {
    if (s === "concluida") return "bg-emerald-500/20 border-emerald-500/60 text-emerald-100";
    if (s === "cancelada") return "bg-red-500/15 border-red-500/50 text-red-100 line-through opacity-70";
    return "bg-primary/20 border-primary/60 text-foreground";
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Agenda</h1>
          <p className="text-xs text-muted-foreground">
            {format(weekStart, "dd 'de' MMMM", { locale: ptBR })} — {format(weekEnd, "dd 'de' MMMM yyyy", { locale: ptBR })}
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
          <Button size="sm" onClick={() => { setEditing(null); setDefaultStart(new Date()); setModalOpen(true); }}>
            <Plus size={14} className="mr-1" /> Nova Visita
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-secondary/40 sticky top-0 z-10">
            <div className="p-2 text-[11px] text-muted-foreground" />
            {days.map((d) => {
              const today = isSameDay(d, new Date());
              return (
                <div key={d.toISOString()} className={`p-2 text-center border-l border-border ${today ? "bg-primary/10" : ""}`}>
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
                    {format(d, "EEE", { locale: ptBR })}
                  </div>
                  <div className={`text-sm font-semibold ${today ? "text-primary" : ""}`}>
                    {format(d, "dd/MM")}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            {/* Hours column */}
            <div>
              {hours.map((h) => (
                <div key={h} style={{ height: HOUR_PX }} className="text-[10px] text-muted-foreground text-right pr-2 pt-1 border-b border-border/40">
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const dayVisitas = visitasByDay(day);
              const dayFallback = fallbackByDay(day);
              const dayGoogle = isGoogleConnected ? gEventsByDay(day) : [];

              type Block = {
                key: string;
                start: Date;
                end: Date;
                render: (style: React.CSSProperties) => JSX.Element;
              };
              const blocks: Block[] = [];

              for (const v of dayVisitas) {
                const start = new Date(v.data_inicio);
                const end = new Date(v.data_fim);
                const visible = (v as any).visivel_portal ?? true;
                const colorCls = visible
                  ? "bg-amber-400/30 border-amber-500/70 text-amber-950"
                  : "bg-[hsl(210,70%,50%)]/15 border-[hsl(210,70%,50%)]/60 text-foreground";
                blocks.push({
                  key: `v-${v.id}`,
                  start,
                  end,
                  render: (style) => (
                    <div
                      key={`v-${v.id}`}
                      onClick={(e) => { e.stopPropagation(); openEdit(v); }}
                      style={style}
                      className={`absolute rounded-md px-1.5 py-1 text-[10px] border cursor-pointer overflow-hidden shadow-sm hover:shadow-md transition-shadow ${v.status === "cancelada" ? "opacity-60 line-through" : ""} ${colorCls}`}
                    >
                      <div className="flex items-center gap-1 font-semibold truncate">
                        {visible && <Eye size={9} className="shrink-0 opacity-80" />}
                        <span className="truncate">{v.titulo}</span>
                      </div>
                      <div className="opacity-80 truncate">
                        {format(start, "HH:mm")}–{format(end, "HH:mm")}
                      </div>
                      {v.clientes?.nome && <div className="truncate opacity-70">{v.clientes.nome}</div>}
                    </div>
                  ),
                });
              }

              for (const v of dayFallback) {
                const start: Date = v._start;
                const end: Date = v._end ?? new Date(start.getTime() + 60 * 60 * 1000);
                const visible = v.visivel_portal ?? true;
                const colorCls = visible
                  ? "bg-amber-400/30 border-amber-500/70 text-amber-950"
                  : "bg-[hsl(210,70%,50%)]/15 border-[hsl(210,70%,50%)]/60 text-foreground";
                blocks.push({
                  key: `f-${v.id}`,
                  start,
                  end,
                  render: (style) => (
                    <div
                      key={`f-${v.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit({
                          id: v.id,
                          empresa_id: empresaId ?? "",
                          cliente_id: v.cliente_id,
                          titulo: v.titulo,
                          descricao: v.descricao ?? null,
                          data_inicio: start.toISOString(),
                          data_fim: end.toISOString(),
                          status: v.status,
                          visivel_portal: v.visivel_portal,
                          created_by: null,
                          created_at: "",
                          updated_at: "",
                          visita_tecnicos: (v.tecnico_ids ?? []).map((tid: string) => ({ id: tid, tecnico_id: tid })),
                          clientes: v.clienteNome ? { nome: v.clienteNome } : null,
                          _source: "crm_interacoes",
                        } as Visita);
                      }}
                      style={style}
                      className={`absolute rounded-md px-1.5 py-1 text-[10px] border cursor-pointer overflow-hidden shadow-sm hover:shadow-md transition-shadow ${colorCls}`}
                    >
                      <div className="flex items-center gap-1 font-semibold truncate">
                        {visible && <Eye size={9} className="shrink-0 opacity-80" />}
                        <span className="truncate">{v.titulo}</span>
                      </div>
                      <div className="opacity-80 truncate">
                        {format(start, "HH:mm")}{v._end ? `–${format(end, "HH:mm")}` : ""}
                      </div>
                      {v.clienteNome && <div className="truncate opacity-70">{v.clienteNome}</div>}
                    </div>
                  ),
                });
              }

              for (const ev of dayGoogle) {
                const start: Date = ev._start;
                const end: Date = ev._end ?? new Date(start.getTime() + 60 * 60 * 1000);
                blocks.push({
                  key: `g-${ev.id}`,
                  start,
                  end,
                  render: (style) => (
                    <div
                      key={`g-${ev.id}`}
                       onClick={(e) => { e.stopPropagation(); setSelectedGoogleEvent({ ...ev, _start: start, _end: end }); }}
                      style={style}
                      className="absolute rounded-md px-1.5 py-1 text-[10px] border cursor-pointer overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-[hsl(210,70%,50%)]/15 border-[hsl(210,70%,50%)]/60 text-foreground"
                    >
                      <div className="flex items-center gap-1 font-semibold truncate">
                        <CalendarIcon size={9} className="text-[hsl(210,70%,50%)] shrink-0" />
                        <span className="truncate">{ev.summary || "(sem título)"}</span>
                      </div>
                      <div className="opacity-80 truncate">
                        {format(start, "HH:mm")}{ev._end ? `–${format(end, "HH:mm")}` : ""}
                      </div>
                    </div>
                  ),
                });
              }

              const laid = layoutOverlaps(blocks);

              return (
                <div key={day.toISOString()} className="relative border-l border-border">
                  {hours.map((h) => (
                    <div
                      key={h}
                      style={{ height: HOUR_PX }}
                      className="border-b border-border/40 hover:bg-primary/5 cursor-pointer transition-colors"
                      onClick={() => openNew(day, h)}
                    />
                  ))}
                  {laid.map((r) => {
                    const top = (r.item.start.getHours() + r.item.start.getMinutes() / 60 - HOUR_START) * HOUR_PX;
                    const height = Math.max(24, ((r.item.end.getTime() - r.item.start.getTime()) / 3600000) * HOUR_PX - 2);
                    const gap = 2;
                    const style: React.CSSProperties = {
                      top,
                      height,
                      left: `calc(${r.leftPct}% + ${r.col === 0 ? 4 : gap}px)`,
                      width: `calc(${r.widthPct}% - ${r.col === 0 || r.col + 1 === r.cols ? gap + 4 : gap * 2}px)`,
                    };
                    return r.item.render(style);
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <VisitaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editing}
        defaultStart={defaultStart}
      />

      <Dialog open={!!selectedGoogleEvent} onOpenChange={(v) => !v && setSelectedGoogleEvent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon size={14} className="text-[hsl(210,70%,50%)]" />
              {selectedGoogleEvent?.summary || "(sem título)"}
            </DialogTitle>
          </DialogHeader>
          {selectedGoogleEvent && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Início:</span>{" "}
                <span className="font-medium">
                  {fmtDate(selectedGoogleEvent._start, "dd/MM/yyyy HH:mm")}
                </span>
              </div>
              {selectedGoogleEvent._end && (
                <div>
                  <span className="text-muted-foreground text-xs">Fim:</span>{" "}
                  <span className="font-medium">
                    {fmtDate(selectedGoogleEvent._end, "dd/MM/yyyy HH:mm")}
                  </span>
                </div>
              )}
              {selectedGoogleEvent.description && (
                <div>
                  <span className="text-muted-foreground text-xs">Descrição:</span>
                  <p className="mt-1 whitespace-pre-wrap">{selectedGoogleEvent.description}</p>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
                Evento do Google Agenda — somente leitura.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[hsl(210,70%,50%)]/30 border border-[hsl(210,70%,50%)]/60" />
          Interno (Google Agenda + visitas privadas)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400/30 border border-amber-400/60" />
          Compartilhadas (cliente / técnico / arquiteto)
        </span>
      </div>
      {!isGoogleConnected && (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border p-4">
          <p className="text-xs text-muted-foreground">
            Conecte sua conta do Google para visualizar eventos do Google Agenda na grade.
          </p>
          <Button size="sm" onClick={() => navigate("/integracoes")}>
            <CalendarIcon size={14} className="mr-1" /> Conectar Google Agenda
          </Button>
        </div>
      )}
    </div>
  );
};

export default Agenda;