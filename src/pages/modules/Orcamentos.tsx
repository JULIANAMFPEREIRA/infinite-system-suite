import { useState } from "react";
import { FileText, Search, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useTransportadoras } from "@/hooks/useTransportadoras";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Table, TableHeader, TableBody, TableRow,
  TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const Orcamentos = () => {
  const empresaId = useEmpresa();
  const { data: transportadoras } = useTransportadoras();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [editOrc, setEditOrc] = useState<any>(null);
  const [deleteOrcId, setDeleteOrcId] = useState<string | null>(null);

  // Edit form state
  const [editNome, setEditNome] = useState("");
  const [editFrete, setEditFrete] = useState(0);
  const [editImposto, setEditImposto] = useState(0);
  const [editFreteTipo, setEditFreteTipo] = useState("");
  const [editDataEnvio, setEditDataEnvio] = useState("");
  const [editDataPagAvista, setEditDataPagAvista] = useState("");

  const { data: orcamentos, isLoading } = useQuery({
    queryKey: ["orcamentos_listagem", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_orcamentos")
        .select("*, clientes(nome), crm_itens(quantidade, preco_venda)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; nome: string; frete: number; imposto: number; frete_tipo: string | null; data_envio_proposta: string | null; data_pagamento_avista: string | null }) => {
      const { id, ...rest } = payload;
      const { error } = await supabase.from("crm_orcamentos").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamentos_listagem"] });
      qc.invalidateQueries({ queryKey: ["crm_orcamentos"] });
      toast.success("Orçamento atualizado!");
      setEditOrc(null);
    },
    onError: () => toast.error("Erro ao atualizar orçamento."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete linked items first
      const { error: itemsErr } = await supabase.from("crm_itens").delete().eq("orcamento_id", id);
      if (itemsErr) throw itemsErr;
      // Delete linked project if exists
      const { data: proj } = await supabase.from("projetos").select("id").eq("orcamento_id", id);
      if (proj && proj.length > 0) {
        for (const p of proj) {
          await supabase.from("financeiro_receber").delete().eq("projeto_id", p.id);
          await supabase.from("financeiro_pagar").delete().eq("projeto_id", p.id);
          await supabase.from("comissoes").delete().eq("projeto_id", p.id);
          await supabase.from("necessidades_compra").delete().eq("projeto_id", p.id);
          await supabase.from("projeto_itens").delete().eq("projeto_id", p.id);
          await supabase.from("projetos").delete().eq("id", p.id);
        }
      }
      const { error } = await supabase.from("crm_orcamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamentos_listagem"] });
      qc.invalidateQueries({ queryKey: ["crm_orcamentos"] });
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Orçamento excluído com sucesso!");
      setDeleteOrcId(null);
    },
    onError: () => toast.error("Erro ao excluir orçamento."),
  });

  const openEdit = (orc: any) => {
    setEditNome(orc.nome ?? "");
    setEditFrete(orc.frete ?? 0);
    setEditImposto(orc.imposto ?? 0);
    setEditFreteTipo(orc.frete_tipo ?? "");
    setEditDataEnvio(orc.data_envio_proposta ?? "");
    setEditDataPagAvista(orc.data_pagamento_avista ?? "");
    setEditOrc(orc);
  };

  const handleSaveEdit = () => {
    if (!editOrc) return;
    updateMutation.mutate({
      id: editOrc.id,
      nome: editNome,
      frete: editFrete,
      imposto: editImposto,
      frete_tipo: editFreteTipo || null,
      data_envio_proposta: editDataEnvio || null,
      data_pagamento_avista: editDataPagAvista || null,
    });
  };

  const filtered = (orcamentos ?? []).filter((o) => {
    const term = busca.toLowerCase();
    const clienteNome = (o.clientes as any)?.nome?.toLowerCase() ?? "";
    const nome = o.nome?.toLowerCase() ?? "";
    return clienteNome.includes(term) || nome.includes(term);
  });

  const calcTotal = (itens: any[]) =>
    (itens ?? []).reduce(
      (sum: number, i: any) => sum + (i.quantidade ?? 1) * (i.preco_venda ?? 0),
      0
    );

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Orçamentos</h1>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum orçamento encontrado.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Orçamento</TableHead>
                <TableHead className="text-xs text-right">Valor Total</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Envio da Proposta</TableHead>
                <TableHead className="text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((orc) => {
                const total = calcTotal(orc.crm_itens as any[]);
                const enviado = orc.data_envio_proposta
                  ? formatDistanceToNow(new Date(orc.data_envio_proposta), {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : null;

                return (
                  <TableRow key={orc.id} className="hover:bg-muted/20">
                    <TableCell className="text-xs font-medium">
                      {(orc.clientes as any)?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{orc.nome}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">
                      {formatCurrency(total)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={orc.aprovado ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {orc.aprovado ? "APROVADO" : "PENDENTE"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {orc.data_envio_proposta ? (
                        <span className="text-muted-foreground">
                          {new Date(orc.data_envio_proposta).toLocaleDateString("pt-BR")}
                          <br />
                          <span className="text-[10px] italic">
                            Enviado {enviado}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          title="Editar"
                          onClick={() => openEdit(orc)}
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          title="Excluir"
                          onClick={() => setDeleteOrcId(orc.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={() => { window.location.href = `/crm`; }}
                        >
                          <ExternalLink size={12} /> Abrir
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editOrc} onOpenChange={(open) => { if (!open) setEditOrc(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Editar Orçamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do Orçamento</Label>
              <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Frete (R$)</Label>
                <Input type="number" value={editFrete} onChange={(e) => setEditFrete(Number(e.target.value))} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Imposto (R$)</Label>
                <Input type="number" value={editImposto} onChange={(e) => setEditImposto(Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Transportadora</Label>
              <select value={editFreteTipo} onChange={(e) => setEditFreteTipo(e.target.value)} className="w-full h-8 text-xs rounded-md border border-input bg-background px-3">
                <option value="">Nenhum</option>
                {(transportadoras ?? []).map((t: any) => (
                  <option key={t.id} value={`${t.nome} (${t.tipo})`}>{t.nome} ({t.tipo})</option>
                ))}
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data Envio Proposta</Label>
                <Input type="date" value={editDataEnvio} onChange={(e) => setEditDataEnvio(e.target.value)} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Data Pgto. à Vista</Label>
                <Input type="date" value={editDataPagAvista} onChange={(e) => setEditDataPagAvista(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditOrc(null)} className="text-xs">Cancelar</Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} className="text-xs">
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteOrcId} onOpenChange={(open) => { if (!open) setDeleteOrcId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Excluir Orçamento</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Esta ação excluirá o orçamento, seus itens vinculados, e quaisquer projetos, financeiros e comissões gerados a partir dele. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteOrcId) deleteMutation.mutate(deleteOrcId); }}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Orcamentos;
