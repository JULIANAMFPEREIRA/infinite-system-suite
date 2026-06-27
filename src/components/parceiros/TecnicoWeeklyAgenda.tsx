import { useMemo, useState } from "react";
import { addDays, addWeeks, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

const HOUR_START = 7;
const HOUR_END = 20;
const HOUR_PX = 36;

interface Props {
  fornecedorId: string;
}

const TecnicoWeeklyAgenda = ({ fornecedorId }: Props) => {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selected, setSelected] = useState<any | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const qc = useQueryClient();
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

  const { data: clientesTecnico = [] } = useQuery({
    queryKey: ["tecnico_clientes_para_agenda", fornecedorId],
    queryFn: async () => {
      const { data: pps, error } = await supabase
        .from("projeto_parceiros")
        .select("projetos(cliente_id, clientes(id, nome))")
        .eq("parceiro_id", fornecedorId);
      if (error) return [];
      const map = new Map<string, string>();
      (pps ?? []).forEach((pp: any) => {
        const c = pp.projetos?.clientes;
        if (c?.id) map.set(c.id, c.nome);
      });
      return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
    },
    enabled: !!fornecedorId,
  });

  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoInicio, setNovoInicio] = useState("");
  const [novoFim, setNovoFim] = useState("");
  const [novoDescricao, setNovoDescricao] = useState("");
  const [novoClienteId, setNovoClienteId] = useState("");

  const openNovo = () => {
    const now = new Date();
    const start = new Date(now.getTime());
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
    setNovoTitulo("");
    setNovoDescricao("");
    setNovoClienteId("");
    setNovoInicio(fmt(start));
    setNovoFim(fmt(end));
    setNovoOpen(true);
  };

  const saveNovo = useMutation({
    mutationFn: async () => {
      if (!novoTitulo.trim()) throw new Error("Título obrigatório");
      if (!novoInicio || !novoFim) throw new Error("Informe data início e fim");
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? null;
      const payload = {
        titulo: novoTitulo.trim().toUpperCase(),
        descricao: novoDescricao.trim() || null,
        data_inicio: new Date(novoInicio).toISOString(),
        data_fim: new Date(novoFim).toISOString(),
        status: "agendada",
        tecnico_ids: [fornecedorId],
        visivel_portal: true,
      };
      const { error } = await supabase.from("crm_interacoes").insert({
        cliente_id: novoClienteId || null,
        tipo: "visita",
        descricao: JSON.stringify(payload),
        visivel_portal: true,
        usuario_id: uid,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Evento criado" });
      qc.invalidateQueries({ queryKey: ["tecnico_weekly_agenda"] });
      qc.invalidateQueries({ queryKey: ["visitas"] });
      qc.invalidateQueries({ queryKey: ["crm_interacoes_visitas"] });
      qc.refetchQueries({ queryKey: ["tecnico_weekly_agenda"] });
      setNovoOpen(false);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
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
          <Button size="sm" onClick={openNovo} className="gap-1">
            <Plus size={14} /> Novo Evento
          </Button>
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

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Evento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Título *</Label>
              <Input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} placeholder="Ex.: VISITA TÉCNICA" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início *</Label>
                <Input type="datetime-local" value={novoInicio} onChange={(e) => setNovoInicio(e.target.value)} />
              </div>
              <div>
                <Label>Fim *</Label>
                <Input type="datetime-local" value={novoFim} onChange={(e) => setNovoFim(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={novoClienteId || "none"} onValueChange={(v) => setNovoClienteId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="none">— Nenhum —</SelectItem>
                  {clientesTecnico.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={novoDescricao} onChange={(e) => setNovoDescricao(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveNovo.mutate()} disabled={saveNovo.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TecnicoWeeklyAgenda;