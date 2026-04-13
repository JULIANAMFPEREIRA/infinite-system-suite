import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Search, ExternalLink, Pencil, Trash2, Zap, UserPlus, Phone, User, Link2, Copy, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { KanbanBoard, type KanbanCardData } from "@/components/kanban/KanbanBoard";
import { ViewToggle } from "@/components/kanban/ViewToggle";
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
import { formatDistanceToNow, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const Orcamentos = () => {
  const empresaId = useEmpresa();
  const navigate = useNavigate();
  const { data: transportadoras } = useTransportadoras();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [editOrc, setEditOrc] = useState<any>(null);
  const [deleteOrcId, setDeleteOrcId] = useState<string | null>(null);
  const [viewType, setViewType] = useState<"list" | "kanban">("list");

  // Quick quote dialog state
  const [showQuickQuote, setShowQuickQuote] = useState(false);
  const [quickNome, setQuickNome] = useState("CONSUMIDOR");
  const [quickTelefone, setQuickTelefone] = useState("");
  const [quickOrcNome, setQuickOrcNome] = useState("Orçamento Rápido");

  // Convert to client dialog state
  const [convertOrc, setConvertOrc] = useState<any>(null);
  const [convertNome, setConvertNome] = useState("");
  const [convertTelefone, setConvertTelefone] = useState("");
  const [convertEmail, setConvertEmail] = useState("");

  // Form link modal state
  const [formLinkOrc, setFormLinkOrc] = useState<any>(null);
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

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
      const { error: itemsErr } = await supabase.from("crm_itens").delete().eq("orcamento_id", id);
      if (itemsErr) throw itemsErr;
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

  // Quick quote creation
  const createQuickQuote = useMutation({
    mutationFn: async () => {
      if (!empresaId) throw new Error("Empresa não encontrada");
      const nome = quickNome.trim();
      if (!nome) throw new Error("Nome do cliente é obrigatório");
      const { data, error } = await supabase.from("crm_orcamentos").insert({
        empresa_id: empresaId,
        nome: quickOrcNome.trim() || "Orçamento Rápido",
        is_avulso: true,
        cliente_nome_avulso: nome,
        cliente_telefone_avulso: quickTelefone.trim() || null,
      } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["orcamentos_listagem"] });
      toast.success("Orçamento rápido criado!");
      setShowQuickQuote(false);
      setQuickNome("CONSUMIDOR");
      setQuickTelefone("");
      setQuickOrcNome("Orçamento Rápido");
      // Navigate to edit (open in CRM-like view or stay on list)
      // For avulso, we stay on the list since there's no CRM client
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Convert avulso to CRM client
  const convertToClient = useMutation({
    mutationFn: async () => {
      if (!empresaId || !convertOrc) throw new Error("Dados incompletos");
      const nome = convertNome.trim();
      if (!nome) throw new Error("Nome do cliente é obrigatório");

      // Check for duplicate client
      const { data: existing } = await supabase
        .from("clientes")
        .select("id")
        .eq("empresa_id", empresaId)
        .eq("nome", nome)
        .eq("deletado", false)
        .limit(1);

      if (existing && existing.length > 0) {
        throw new Error(`Já existe um cliente com o nome "${nome}". Verifique antes de continuar.`);
      }

      // Create client in CRM
      const { data: newClient, error: clientErr } = await supabase.from("clientes").insert({
        empresa_id: empresaId,
        nome,
        telefone: convertTelefone.trim() || null,
        email: convertEmail.trim() || null,
        status_crm: "proposta" as const,
      }).select().single();
      if (clientErr) throw clientErr;

      // Link the quote to the new client and remove avulso flag
      const { error: updateErr } = await supabase.from("crm_orcamentos").update({
        cliente_id: newClient.id,
        is_avulso: false,
      } as any).eq("id", convertOrc.id);
      if (updateErr) throw updateErr;

      // Also update any crm_itens that belong to this quote (they need a cliente_id)
      await supabase.from("crm_itens").update({
        cliente_id: newClient.id,
      }).eq("orcamento_id", convertOrc.id);

      return newClient;
    },
    onSuccess: (newClient) => {
      qc.invalidateQueries({ queryKey: ["orcamentos_listagem"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente criado e orçamento vinculado com sucesso!");
      setConvertOrc(null);
      // Navigate to CRM with the new client
      navigate(`/crm?cliente_id=${newClient.id}`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openConvert = (orc: any) => {
    setConvertNome((orc as any).cliente_nome_avulso || "");
    setConvertTelefone((orc as any).cliente_telefone_avulso || "");
    setConvertEmail("");
    setConvertOrc(orc);
  };

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
    const avulsoNome = ((o as any).cliente_nome_avulso ?? "").toLowerCase();
    const nome = o.nome?.toLowerCase() ?? "";
    return clienteNome.includes(term) || avulsoNome.includes(term) || nome.includes(term);
  });

  const calcTotal = (itens: any[]) =>
    (itens ?? []).reduce(
      (sum: number, i: any) => sum + (i.quantidade ?? 1) * (i.preco_venda ?? 0),
      0
    );

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getClienteDisplay = (orc: any): string => {
    if ((orc as any).is_avulso) {
      return (orc as any).cliente_nome_avulso || "CONSUMIDOR";
    }
    return (orc.clientes as any)?.nome ?? "—";
  };

  // Kanban columns for Orcamentos
  const orcKanbanColumns = [
    { key: "contato", label: "EM CONTATO", color: "text-warning", borderColor: "border-warning/30", bgColor: "bg-warning/5" },
    { key: "enviado", label: "ENVIADO", color: "text-primary", borderColor: "border-primary/30", bgColor: "bg-primary/5" },
    { key: "aprovado", label: "APROVADO", color: "text-success", borderColor: "border-success/30", bgColor: "bg-success/5" },
    { key: "cancelado", label: "CANCELADO", color: "text-destructive", borderColor: "border-destructive/30", bgColor: "bg-destructive/5" },
  ];

  const getOrcKanbanColumn = (orc: any): string => {
    if (orc.aprovado) return "aprovado";
    if (orc.data_envio_proposta) return "enviado";
    return "contato";
  };

  type OrcKanbanItem = KanbanCardData & { orc: any; total: number };

  const kanbanItems: OrcKanbanItem[] = filtered.map((orc) => ({
    id: orc.id,
    columnKey: getOrcKanbanColumn(orc),
    orc,
    total: calcTotal(orc.crm_itens as any[]),
  }));

  const handleKanbanMove = async (itemId: string, _from: string, to: string) => {
    const updates: any = {};
    if (to === "aprovado") updates.aprovado = true;
    else updates.aprovado = false;
    if (to === "enviado" || to === "aprovado") {
      const orc = orcamentos?.find((o) => o.id === itemId);
      if (!orc?.data_envio_proposta) updates.data_envio_proposta = new Date().toISOString().split("T")[0];
    }
    if (to === "contato") {
      updates.data_envio_proposta = null;
    }
    const { error } = await supabase.from("crm_orcamentos").update(updates).eq("id", itemId);
    if (error) { toast.error("Erro ao mover orçamento"); return; }
    qc.invalidateQueries({ queryKey: ["orcamentos_listagem"] });
    qc.invalidateQueries({ queryKey: ["crm_orcamentos"] });
    toast.success("Status atualizado!");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Orçamentos</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 h-8"
            onClick={() => setShowQuickQuote(true)}
          >
            <Zap size={13} className="text-warning" /> Orçamento Rápido
          </Button>
          <ViewToggle view={viewType} onChange={setViewType} />
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
      ) : viewType === "kanban" ? (
        <KanbanBoard
          columns={orcKanbanColumns}
          items={kanbanItems}
          onMove={handleKanbanMove}
          onCardClick={(item) => {
            if ((item.orc as any).is_avulso) { openEdit(item.orc); return; }
            navigate(`/crm?cliente_id=${item.orc.cliente_id}&orcamento_id=${item.orc.id}`);
          }}
          renderCard={(item) => {
            const isAvulso = (item.orc as any).is_avulso;
            const updatedAt = item.orc.created_at;
            const daysInStatus = updatedAt ? differenceInDays(new Date(), new Date(updatedAt)) : 0;
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-bold text-foreground truncate leading-tight">{getClienteDisplay(item.orc)}</p>
                  {isAvulso && (
                    <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 border-warning/50 text-warning bg-warning/10 shrink-0">Rápido</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{item.orc.nome}</p>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-primary">{formatCurrency(item.total)}</p>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${daysInStatus > 14 ? "bg-destructive/10 text-destructive" : daysInStatus > 7 ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                    {daysInStatus}d
                  </span>
                </div>
                {item.orc.data_envio_proposta && (
                  <p className="text-[9px] text-muted-foreground/70">Enviado {new Date(item.orc.data_envio_proposta).toLocaleDateString("pt-BR")}</p>
                )}
              </div>
            );
          }}
        />
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
                const isAvulso = (orc as any).is_avulso;
                const enviado = orc.data_envio_proposta
                  ? formatDistanceToNow(new Date(orc.data_envio_proposta), {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : null;

                return (
                  <TableRow key={orc.id} className="hover:bg-muted/20">
                    <TableCell className="text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        {getClienteDisplay(orc)}
                        {isAvulso && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-warning/40 text-warning font-medium">
                            AVULSO
                          </Badge>
                        )}
                      </div>
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
                        {isAvulso && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1 text-success hover:text-success"
                            title="Converter em Cliente"
                            onClick={() => openConvert(orc)}
                          >
                            <UserPlus size={12} /> Converter
                          </Button>
                        )}
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
                        {!isAvulso && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs gap-1"
                            onClick={() => navigate(`/crm?cliente_id=${orc.cliente_id}&orcamento_id=${orc.id}`)}
                          >
                            <ExternalLink size={12} /> Abrir
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Quick Quote Dialog */}
      <Dialog open={showQuickQuote} onOpenChange={setShowQuickQuote}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Zap size={16} className="text-warning" /> Novo Orçamento Rápido
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Crie um orçamento sem cadastrar cliente no CRM. Você poderá converter em cliente posteriormente.
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs flex items-center gap-1"><User size={11} /> Nome do Cliente *</Label>
              <Input
                value={quickNome}
                onChange={(e) => setQuickNome(e.target.value.toUpperCase())}
                className="h-8 text-xs"
                placeholder="CONSUMIDOR"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Phone size={11} /> Telefone (opcional)</Label>
              <Input
                value={quickTelefone}
                onChange={(e) => setQuickTelefone(e.target.value)}
                className="h-8 text-xs"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><FileText size={11} /> Nome do Orçamento</Label>
              <Input
                value={quickOrcNome}
                onChange={(e) => setQuickOrcNome(e.target.value)}
                className="h-8 text-xs"
                placeholder="Orçamento Rápido"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowQuickQuote(false)} className="text-xs">Cancelar</Button>
            <Button
              size="sm"
              onClick={() => createQuickQuote.mutate()}
              disabled={createQuickQuote.isPending || !quickNome.trim()}
              className="text-xs gap-1"
            >
              <Zap size={12} />
              {createQuickQuote.isPending ? "Criando..." : "Criar Orçamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Client Dialog */}
      <Dialog open={!!convertOrc} onOpenChange={(open) => { if (!open) setConvertOrc(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <UserPlus size={16} className="text-success" /> Converter em Cliente
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Um novo cliente será criado no CRM e o orçamento será vinculado a ele.
          </p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do Cliente *</Label>
              <Input
                value={convertNome}
                onChange={(e) => setConvertNome(e.target.value.toUpperCase())}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input
                value={convertTelefone}
                onChange={(e) => setConvertTelefone(e.target.value)}
                className="h-8 text-xs"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input
                value={convertEmail}
                onChange={(e) => setConvertEmail(e.target.value)}
                className="h-8 text-xs"
                placeholder="email@exemplo.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setConvertOrc(null)} className="text-xs">Cancelar</Button>
            <Button
              size="sm"
              onClick={() => convertToClient.mutate()}
              disabled={convertToClient.isPending || !convertNome.trim()}
              className="text-xs gap-1 bg-success hover:bg-success/90 text-white"
            >
              <UserPlus size={12} />
              {convertToClient.isPending ? "Convertendo..." : "Criar Cliente e Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
