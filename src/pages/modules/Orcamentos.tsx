import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Search, ExternalLink, Pencil, Trash2, Zap, UserPlus, Phone, User, Link2, Copy, Check, ShoppingCart } from "lucide-react";
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
import { calcOrcamentoTotals } from "@/lib/orcamentoCalc";
import FinanceiroFilters, { applyDateFilter } from "@/components/financeiro/FinanceiroFilters";

const STATUS_OPTIONS = [
  { value: "", label: "Todos status" },
  { value: "pendente", label: "Pendente" },
  { value: "aprovado", label: "Aprovado" },
  { value: "enviado", label: "Enviado" },
];

const Orcamentos = () => {
  const empresaId = useEmpresa();
  const navigate = useNavigate();
  const { data: transportadoras } = useTransportadoras();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [editOrc, setEditOrc] = useState<any>(null);
  const [deleteOrcId, setDeleteOrcId] = useState<string | null>(null);
  const [viewType, setViewType] = useState<"list" | "kanban">("list");

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [periodoFilter, setPeriodoFilter] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [anoFilter, setAnoFilter] = useState("");

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
  const [editDataPagAvista, setEditDataPagAvista] = useState("");

  const { data: orcamentos, isLoading } = useQuery({
    queryKey: ["orcamentos_listagem", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_orcamentos")
        .select("*, clientes(nome), crm_itens(quantidade, preco_venda, preco_custo)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  // Fetch compras linked via projetos.orcamento_id
  const { data: projetosCompras } = useQuery({
    queryKey: ["orcamentos_compras", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select("orcamento_id, compras(valor_total, status, deletado)")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .not("orcamento_id", "is", null);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  // Build compras map by orcamento_id
  const comprasMap = useMemo(() => {
    const map: Record<string, { totalComprado: number; totalItens: number }> = {};
    (projetosCompras ?? []).forEach((p: any) => {
      const orcId = p.orcamento_id;
      if (!orcId) return;
      if (!map[orcId]) map[orcId] = { totalComprado: 0, totalItens: 0 };
      (p.compras ?? []).filter((c: any) => !c.deletado).forEach((c: any) => {
        map[orcId].totalComprado += Number(c.valor_total) || 0;
        map[orcId].totalItens += 1;
      });
    });
    return map;
  }, [projetosCompras]);

  const getCompraStatus = (orcId: string, totalProdutos: number) => {
    const info = comprasMap[orcId];
    if (!info || info.totalItens === 0) return { label: "NÃO INICIADO", class: "bg-muted text-muted-foreground border border-border" };
    if (info.totalComprado >= totalProdutos) return { label: "COMPLETO", class: "bg-success/15 text-success border border-success/25" };
    return { label: "PARCIAL", class: "bg-warning/15 text-warning border border-warning/25" };
  };

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; nome: string; frete: number; imposto: number; frete_tipo: string | null; data_pagamento_avista: string | null }) => {
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orcamentos_listagem"] });
      toast.success("Orçamento rápido criado!");
      setShowQuickQuote(false);
      setQuickNome("CONSUMIDOR");
      setQuickTelefone("");
      setQuickOrcNome("Orçamento Rápido");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Convert avulso to CRM client
  const convertToClient = useMutation({
    mutationFn: async () => {
      if (!empresaId || !convertOrc) throw new Error("Dados incompletos");
      const nome = convertNome.trim();
      if (!nome) throw new Error("Nome do cliente é obrigatório");

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

      const { data: newClient, error: clientErr } = await supabase.from("clientes").insert({
        empresa_id: empresaId,
        nome,
        telefone: convertTelefone.trim() || null,
        email: convertEmail.trim() || null,
        status_crm: "proposta" as const,
      }).select().single();
      if (clientErr) throw clientErr;

      const { error: updateErr } = await supabase.from("crm_orcamentos").update({
        cliente_id: newClient.id,
        is_avulso: false,
      } as any).eq("id", convertOrc.id);
      if (updateErr) throw updateErr;

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
    setEditDataPagAvista(orc.data_pagamento_avista ?? "");
    setEditOrc(orc);
  };

  const generateFormLink = async (orc: any) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/formulario-cliente`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            orcamento_id: orc.id,
            empresa_id: empresaId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao gerar link");
      }

      const data = await response.json();
      const baseUrl = window.location.origin;
      const fullLink = `${baseUrl}/formulario?token=${data.token}`;
      setGeneratedLink(fullLink);
      setFormLinkOrc(orc);
      toast.success("Link gerado com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar link do formulário");
    }
  };

  const copyLinkToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    toast.success("Link copiado para a área de transferência!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    if (!editOrc) return;
    updateMutation.mutate({
      id: editOrc.id,
      nome: editNome,
      frete: editFrete,
      imposto: editImposto,
      frete_tipo: editFreteTipo || null,
      data_pagamento_avista: editDataPagAvista || null,
    });
  };

  // Filtering
  const filtered = useMemo(() => {
    let list = (orcamentos ?? []).filter((o) => {
      const term = busca.toLowerCase();
      const clienteNome = (o.clientes as any)?.nome?.toLowerCase() ?? "";
      const avulsoNome = ((o as any).cliente_nome_avulso ?? "").toLowerCase();
      const nome = o.nome?.toLowerCase() ?? "";
      return clienteNome.includes(term) || avulsoNome.includes(term) || nome.includes(term);
    });

    if (statusFilter === "aprovado") list = list.filter(o => o.aprovado);
    else if (statusFilter === "pendente") list = list.filter(o => !o.aprovado && !o.data_envio_proposta);
    else if (statusFilter === "enviado") list = list.filter(o => !o.aprovado && !!o.data_envio_proposta);

    list = applyDateFilter(list, "created_at", periodoFilter, mesFilter, anoFilter);
    return list;
  }, [orcamentos, busca, statusFilter, periodoFilter, mesFilter, anoFilter]);

  const calcTotal = (orc: any) => {
    const totals = calcOrcamentoTotals({
      itens: orc.crm_itens ?? [],
      frete: orc.frete,
      imposto: orc.imposto,
      simulacao_pagamento: orc.simulacao_pagamento as any,
    });
    return totals.totalVenda;
  };

  const calcTotalProdutos = (orc: any) => {
    return (orc.crm_itens ?? []).reduce((sum: number, i: any) => sum + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0);
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getClienteDisplay = (orc: any): string => {
    if ((orc as any).is_avulso) {
      return (orc as any).cliente_nome_avulso || "CONSUMIDOR";
    }
    return (orc.clientes as any)?.nome ?? "—";
  };

  // Handle edit button click — navigate to the quote itself
  const handleEditClick = (orc: any) => {
    const isAvulso = (orc as any).is_avulso;
    if (isAvulso) {
      openEdit(orc);
    } else {
      navigate(`/crm?cliente_id=${orc.cliente_id}&orcamento_id=${orc.id}`);
    }
  };

  // Kanban columns
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
    total: calcTotal(orc),
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

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-8 text-xs w-56"
          />
        </div>
        <FinanceiroFilters
          statusOptions={STATUS_OPTIONS}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          periodoFilter={periodoFilter}
          onPeriodoChange={setPeriodoFilter}
          mesFilter={mesFilter}
          onMesChange={setMesFilter}
          anoFilter={anoFilter}
          onAnoChange={setAnoFilter}
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold text-muted-foreground whitespace-nowrap px-3">Cliente</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground whitespace-nowrap px-3">Orçamento</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground whitespace-nowrap text-right px-3">Valor Total</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground whitespace-nowrap text-center px-3">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground whitespace-nowrap px-3">Envio da Proposta</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground whitespace-nowrap text-right px-3">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((orc) => {
                  const total = calcTotal(orc);
                  const isAvulso = (orc as any).is_avulso;
                  const enviado = orc.data_envio_proposta
                    ? formatDistanceToNow(new Date(orc.data_envio_proposta), {
                        addSuffix: true,
                        locale: ptBR,
                      })
                    : null;

                  return (
                    <TableRow key={orc.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-xs px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{getClienteDisplay(orc)}</span>
                          {isAvulso && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-warning/40 text-warning font-medium">
                              AVULSO
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-foreground/80 px-3">{orc.nome}</TableCell>
                      <TableCell className="text-xs text-right font-bold text-foreground tabular-nums px-3">
                        {formatCurrency(total)}
                      </TableCell>
                      <TableCell className="text-center px-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${orc.aprovado ? "bg-success/15 text-success border border-success/25" : "bg-warning/15 text-warning border border-warning/25"}`}>
                          {orc.aprovado ? "APROVADO" : "PENDENTE"}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs px-3">
                        {orc.data_envio_proposta ? (
                          <div>
                            <span className="text-foreground/80 tabular-nums">
                              {new Date(orc.data_envio_proposta).toLocaleDateString("pt-BR")}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1.5 italic">
                              {enviado}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right px-3">
                        <div className="flex items-center justify-end gap-0.5">
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
                            title="Editar orçamento"
                            onClick={() => handleEditClick(orc)}
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
                              className="h-7 text-xs gap-1 text-primary hover:text-primary"
                              title="Solicitar dados do cliente"
                              onClick={() => generateFormLink(orc)}
                            >
                              <Link2 size={12} /> Solicitar Dados
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

      {/* Edit Dialog — compact, no "data envio proposta" */}
      <Dialog open={!!editOrc} onOpenChange={(open) => { if (!open) setEditOrc(null); }}>
        <DialogContent className="max-w-sm">
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
            <div>
              <Label className="text-xs">Data Pgto. à Vista</Label>
              <Input type="date" value={editDataPagAvista} onChange={(e) => setEditDataPagAvista(e.target.value)} className="h-8 text-xs" />
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

      {/* Form Link Modal */}
      <Dialog open={!!formLinkOrc} onOpenChange={(open) => { if (!open) { setFormLinkOrc(null); setGeneratedLink(""); setLinkCopied(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Link2 size={16} className="text-primary" /> Link de Cadastro Gerado
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Envie este link ao cliente para que ele preencha seus dados de cadastro:
          </p>
          <div className="space-y-3">
            <div className="relative">
              <Input
                value={generatedLink}
                readOnly
                className="h-10 text-xs pr-24 font-mono bg-muted"
              />
              <Button
                size="sm"
                variant={linkCopied ? "outline" : "default"}
                className="absolute right-1 top-1 h-8 text-xs gap-1"
                onClick={copyLinkToClipboard}
              >
                {linkCopied ? <Check size={14} /> : <Copy size={14} />}
                {linkCopied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              O link é único e expira após ser usado. Compartilhe apenas com o cliente deste orçamento.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setFormLinkOrc(null); setGeneratedLink(""); setLinkCopied(false); }} className="text-xs">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orcamentos;
