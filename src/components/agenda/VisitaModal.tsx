import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, X, Eye } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useClientesLista, useTecnicosLista, useSaveVisita, useDeleteVisita, Visita } from "@/hooks/useAgenda";
import { useGoogleCalendarStatus, useCreateGoogleEvent, useUpdateGoogleEvent } from "@/hooks/useGoogleCalendar";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: Visita | null;
  defaultStart?: Date | null;
}

const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");

const VisitaModal = ({ open, onClose, initial, defaultStart }: Props) => {
  const { data: clientes = [] } = useClientesLista();
  const { data: tecnicos = [] } = useTecnicosLista();
  const save = useSaveVisita();
  const del = useDeleteVisita();
  const { data: googleStatus } = useGoogleCalendarStatus();
  const createGoogleEvent = useCreateGoogleEvent();
  const updateGoogleEvent = useUpdateGoogleEvent();

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [tecnicoIds, setTecnicoIds] = useState<string[]>([]);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [status, setStatus] = useState("agendada");
  const [visivelPortal, setVisivelPortal] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitulo(initial.titulo);
      setDescricao(initial.descricao ?? "");
      setClienteId(initial.cliente_id ?? "");
      setTecnicoIds((initial.visita_tecnicos ?? []).map((t) => t.tecnico_id));
      setInicio(toLocalInput(new Date(initial.data_inicio)));
      setFim(toLocalInput(new Date(initial.data_fim)));
      setStatus(initial.status);
      setVisivelPortal(initial.visivel_portal ?? true);
    } else {
      const start = defaultStart ?? new Date();
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      setTitulo("");
      setDescricao("");
      setClienteId("");
      setTecnicoIds([]);
      setInicio(toLocalInput(start));
      setFim(toLocalInput(end));
      setStatus("agendada");
      setVisivelPortal(true);
    }
  }, [open, initial, defaultStart]);

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    if (!inicio || !fim) {
      toast({ title: "Informe data de início e fim", variant: "destructive" });
      return;
    }
    try {
      await save.mutateAsync({
        id: initial?.id,
        titulo: titulo.trim().toUpperCase(),
        descricao: descricao.trim() || null,
        cliente_id: clienteId || null,
        tecnico_ids: tecnicoIds,
        data_inicio: new Date(inicio).toISOString(),
        data_fim: new Date(fim).toISOString(),
        status,
        visivel_portal: visivelPortal,
        _source: initial?._source,
      });
      // Auto-sync to Google Calendar (all visits)
      const isNew = !initial;
      const existingGoogleEventId = (initial as any)?.google_event_id ?? null;
      console.log(
        "Google sync attempt - connected:",
        googleStatus?.connected,
        "isNew:",
        isNew,
        "visivelPortal:",
        visivelPortal,
        "existingGoogleEventId:",
        existingGoogleEventId
      );
      let googleSynced = false;
      let googleError: string | null = null;
      if (googleStatus?.connected) {
        try {
          const clienteNome = clientes.find((c: any) => c.id === clienteId)?.nome;
          const descParts = [descricao.trim()].filter(Boolean);
          if (clienteNome) descParts.push(`Cliente: ${clienteNome}`);
          const summary = titulo.trim().toUpperCase();
          const description = descParts.join("\n") || undefined;
          const startDateTime = new Date(inicio).toISOString();
          const endDateTime = new Date(fim).toISOString();
          console.log("Google event data:", { summary, description, startDateTime, endDateTime });
          if (!isNew && existingGoogleEventId) {
            await updateGoogleEvent.mutateAsync({
              eventId: existingGoogleEventId,
              summary,
              description,
              startDateTime,
              endDateTime,
            });
          } else {
            await createGoogleEvent.mutateAsync({
              summary,
              description,
              startDateTime,
              endDateTime,
            });
          }
          googleSynced = true;
        } catch (gErr: any) {
          console.error("[VisitaModal] Google Calendar sync error:", gErr);
          googleError = gErr?.message ?? "erro desconhecido";
        }
      }
      if (googleSynced) {
        toast({ title: "Visita salva e sincronizada com Google Calendar ✓" });
      } else if (googleError) {
        toast({
          title: `Visita salva, mas erro ao sincronizar Google: ${googleError}`,
          variant: "destructive",
        });
      } else {
        toast({ title: initial ? "Alterações salvas" : "Visita criada" });
      }
      onClose();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!initial) return;
    if (!confirm("Excluir esta visita?")) return;
    try {
      await del.mutateAsync({ id: initial.id, source: initial._source });
      toast({ title: "Visita excluída" });
      onClose();
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  };

  const toggleTecnico = (id: string) => {
    setTecnicoIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Visita" : "Nova Visita"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: VISITA TÉCNICA" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início *</Label>
              <Input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div>
              <Label>Fim *</Label>
              <Input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Cliente</Label>
            <Select value={clienteId || "none"} onValueChange={(v) => setClienteId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value="none">— Nenhum —</SelectItem>
                {clientes.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Técnico(s) Responsável(is)</Label>
            <div className="max-h-32 overflow-y-auto border border-border rounded-md p-2 space-y-1 bg-background">
              {tecnicos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum disponível</p>}
              {tecnicos.map((t: any) => (
                <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-secondary/50 rounded px-1.5 py-1">
                  <input
                    type="checkbox"
                    checked={tecnicoIds.includes(t.id)}
                    onChange={() => toggleTecnico(t.id)}
                  />
                  <span>{t.nome}</span>
                  {t.subtipo_parceiro && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">{t.subtipo_parceiro}</Badge>
                  )}
                </label>
              ))}
            </div>
            {tecnicoIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {tecnicoIds.map((id) => {
                  const t = tecnicos.find((x: any) => x.id === id);
                  return (
                    <Badge key={id} variant="default" className="text-[10px] gap-1">
                      {t?.nome ?? id}
                      <X size={10} className="cursor-pointer" onClick={() => toggleTecnico(id)} />
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} />
          </div>

          <div
            className={`flex items-center justify-between rounded-md border px-3 py-2 transition-colors ${
              visivelPortal
                ? "border-yellow-500/50 bg-yellow-500/10"
                : "border-blue-500/50 bg-blue-500/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <Eye size={14} className={visivelPortal ? "text-yellow-500" : "text-blue-500"} />
              <Label htmlFor="visivel-portal" className="text-xs cursor-pointer">
                {visivelPortal
                  ? "Compartilhar com cliente, técnico e arquiteto"
                  : "Apenas administradores (eu e Nei)"}
              </Label>
            </div>
            <Switch
              id="visivel-portal"
              checked={visivelPortal}
              onCheckedChange={setVisivelPortal}
            />
          </div>

          {initial && (
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agendada">Agendada</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div>
            {initial && (
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={del.isPending}>
                <Trash2 size={14} className="mr-1" /> Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={save.isPending}>
              {initial ? "Salvar alterações" : "Salvar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VisitaModal;