import { useMemo, useState } from "react";
import { addDays, addWeeks, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVisitas, Visita } from "@/hooks/useAgenda";
import VisitaModal from "@/components/agenda/VisitaModal";

const HOUR_START = 7;
const HOUR_END = 20;
const HOUR_PX = 56;

const Agenda = () => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Visita | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | null>(null);

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
                  {dayVisitas.map((v) => {
                    const { top, height } = blockStyle(v);
                    return (
                      <div
                        key={v.id}
                        onClick={(e) => { e.stopPropagation(); openEdit(v); }}
                        style={{ top, height }}
                        className={`absolute left-1 right-1 rounded-md px-1.5 py-1 text-[10px] border cursor-pointer overflow-hidden shadow-sm hover:shadow-md transition-shadow ${statusColor(v.status)}`}
                      >
                        <div className="font-semibold truncate">{v.titulo}</div>
                        <div className="opacity-80 truncate">
                          {format(new Date(v.data_inicio), "HH:mm")}–{format(new Date(v.data_fim), "HH:mm")}
                        </div>
                        {v.clientes?.nome && <div className="truncate opacity-70">{v.clientes.nome}</div>}
                      </div>
                    );
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
    </div>
  );
};

export default Agenda;