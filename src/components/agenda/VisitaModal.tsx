import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, X } from "lucide-react";
import { useClientesLista, useTecnicosLista, useSaveVisita, useDeleteVisita, Visita } from "@/hooks/useAgenda";
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

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState<string>("");
  const [tecnicoIds, setTecnicoIds] = useState<string[]>([]);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [status, setStatus] = useState("agendada");

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
      });
      toast({ title: initial ? "Visita atualizada" : "Visita criada" });
      onClose();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!initial) return;
    if (!confirm("Excluir esta visita?")) return;
    try {
      await del.mutateAsync(initial.id);
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
            <Button onClick={handleSave} disabled={save.isPending}>Salvar</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VisitaModal;