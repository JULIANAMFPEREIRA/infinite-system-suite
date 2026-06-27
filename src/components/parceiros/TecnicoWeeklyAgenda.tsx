import { useMemo, useState } from "react";
import { addDays, addWeeks, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const HOUR_START = 7;
const HOUR_END = 20;
const HOUR_PX = 36;

interface Props {
  fornecedorId: string;
}

const TecnicoWeeklyAgenda = ({ fornecedorId }: Props) => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selected, setSelected] = useState<any | null>(null);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = useMemo(
    () => Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i),
    []
  );

  const { data: visitas = [] } = useQuery({
    queryKey: ["tecnico_weekly_agenda", fornecedorId, weekStart.toISOString()],
    queryFn: async () => {
      const fromIso = weekStart.toISOString();
      const toIso = addDays(weekEnd, 1).toISOString();
      const { data, error } = await supabase
        .from("crm_interacoes" as any)
        .select("id, descricao, visivel_portal, created_at, clientes(nome)")
        .eq("tipo", "visita")
        .eq("visivel_portal", true)
        .gte("created_at", addDays(weekStart, -60).toISOString());
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
            descricao: p.descricao ?? null,
            _start: s && !isNaN(s.getTime()) ? s : null,
            _end: e && !isNaN(e.getTime()) ? e : null,
            tecnico_ids: Array.isArray(p.tecnico_ids) ? p.tecnico_ids : [],
            clienteNome: row.clientes?.nome ?? null,
            status: p.status ?? "agendada",
          };
        })
        .filter((v: any) =>
          v._start &&
          v._start >= new Date(fromIso) &&
          v._start <= new Date(toIso) &&
          v.tecnico_ids.includes(fornecedorId)
        );
    },
    enabled: !!fornecedorId,
  });

  const blockStyle = (start: Date, end: Date) => {
    const top = (start.getHours() + start.getMinutes() / 60 - HOUR_START) * HOUR_PX;
    const height = Math.max(18, ((end.getTime() - start.getTime()) / 3600000) * HOUR_PX - 2);
    return { top, height };
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm mb-6">
      <div className="flex items-center justify-between p-4 pb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-foreground">Minha Agenda da Semana</h3>
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
              const dayVisitas = visitas.filter((v: any) => isSameDay(v._start, day));
              return (
                <div key={day.toISOString()} className="relative border-l border-border">
                  {hours.map((h) => (
                    <div key={h} style={{ height: HOUR_PX }} className="border-b border-border/40" />
                  ))}
                  {dayVisitas.map((v: any) => {
                    const end = v._end ?? new Date(v._start.getTime() + 60 * 60 * 1000);
                    const { top, height } = blockStyle(v._start, end);
                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelected(v)}
                        style={{ top, height }}
                        className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 text-[9px] border cursor-pointer overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-amber-400/30 border-amber-500/70 text-amber-950 ${v.status === "cancelada" ? "opacity-60 line-through" : ""}`}
                      >
                        <div className="flex items-center gap-1 font-semibold truncate">
                          <Eye size={8} className="shrink-0 opacity-80" />
                          <span className="truncate">{v.titulo}</span>
                        </div>
                        <div className="opacity-80 truncate">{format(v._start, "HH:mm")}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.titulo}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Data:</span>{" "}
                <span className="font-medium">
                  {format(selected._start, "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  {selected._end ? ` – ${format(selected._end, "HH:mm")}` : ""}
                </span>
              </div>
              {selected.clienteNome && (
                <div>
                  <span className="text-muted-foreground text-xs">Cliente:</span>{" "}
                  <span className="font-medium">{selected.clienteNome}</span>
                </div>
              )}
              {selected.descricao && (
                <div>
                  <span className="text-muted-foreground text-xs">Descrição:</span>
                  <p className="mt-1 whitespace-pre-wrap">{selected.descricao}</p>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground pt-2 border-t border-border">
                Somente leitura. Para alterações, contate o administrador.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TecnicoWeeklyAgenda;