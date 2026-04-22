import { calcOrcamentoTotals } from "@/lib/orcamentoCalc";
import { sanitizePayload } from "@/lib/sanitize";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Plus, PlusCircle, Pencil, Trash2, Eye, ArrowLeft, MessageSquare, FileText, Package, Phone, MapPin, User, Calculator, Upload, Download, Image, Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Copy, Check, RefreshCw, Printer, LayoutGrid, List, DollarSign, GripVertical, ArrowUpDown, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useCreateProjeto, useCreateProjetoItem, useArquitetos } from "@/hooks/useProjetos";
import { toast } from "sonner";
import { isNotEmpty, validateEmail } from "@/lib/validations";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useTransportadoras } from "@/hooks/useTransportadoras";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { statusCrmLabels, statusCrmColors, statusCrmKanban, statusCrmOptions, type StatusCRM } from "@/lib/statusConfig";

type OrigemLead = Database["public"]["Enums"]["origem_lead"];

const origemLabels: Record<OrigemLead, string> = { whatsapp: "WhatsApp", instagram: "Instagram", indicacao: "Indicação", arquiteto: "Arquiteto", outro: "Outro" };

const CRM = () => {
  const empresaId = useEmpresa();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const createProjeto = useCreateProjeto();
  const createProjetoItem = useCreateProjetoItem();
  const { data: arquitetos } = useArquitetos();
  const { data: transportadoras } = useTransportadoras();

  const [viewMode, setViewMode] = useState<"list" | "detail" | "new">("list");
  const [listViewType, setListViewType] = useState<"kanban" | "table">("kanban");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [enderecoObra, setEnderecoObra] = useState("");
  const [origem, setOrigem] = useState<OrigemLead>("outro");
  const [arquitetoIdOrigem, setArquitetoIdOrigem] = useState("");
  const [statusCrm, setStatusCrm] = useState<StatusCRM>("lead");
  const [filterStatus, setFilterStatus] = useState<StatusCRM | "todos">("todos");
  const [novoClienteObs, setNovoClienteObs] = useState("");
  const [dragClientId, setDragClientId] = useState<string | null>(null);
  const [tableSortKey, setTableSortKey] = useState<"nome" | "created_at" | "updated_at">("created_at");
  const [tableSortDir, setTableSortDir] = useState<"asc" | "desc">("desc");

  const [detailClient, setDetailClient] = useState<any>(null);

  // Interaction form
  const [intTipo, setIntTipo] = useState("ligacao");
  const [intDesc, setIntDesc] = useState("");
  const [editIntId, setEditIntId] = useState<string | null>(null);
  const [intData, setIntData] = useState<Date | undefined>(undefined);
  const [intMembroEquipe, setIntMembroEquipe] = useState("");

  // CRM Items form
  const [itemDesc, setItemDesc] = useState("");
  const [itemQtd, setItemQtd] = useState(1);
  const [itemCusto, setItemCusto] = useState(0);
  const [itemVenda, setItemVenda] = useState(0);
  const [itemRt, setItemRt] = useState(0);
  const [itemRtTipo, setItemRtTipo] = useState<"valor" | "percentual">("valor");
  const [itemRtPercentual, setItemRtPercentual] = useState(0);
  const [itemTipo, setItemTipo] = useState<"produto" | "servico" | "adicional">("produto");
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [itemProdutoId, setItemProdutoId] = useState<string | null>(null);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);

  // Auto-calc RT based on architect %
  const arquitetoRtPercentual = useMemo(() => {
    if (!detailClient?.arquiteto_id || !arquitetos) return 0;
    const arq = arquitetos.find(a => a.id === detailClient.arquiteto_id);
    return arq?.rt_percentual ?? 0;
  }, [detailClient?.arquiteto_id, arquitetos]);

  const handleItemVendaChange = (value: number) => {
    setItemVenda(value);
    // Recalc when in % mode (always)
    if (itemRtTipo === "percentual" && itemRtPercentual > 0) {
      setItemRt(Number(((value * itemQtd * itemRtPercentual) / 100).toFixed(2)));
      return;
    }
    // Auto-calc RT only if not editing and architect has RT % (legacy behavior)
    if (!editItemId && arquitetoRtPercentual > 0) {
      setItemRt(Number(((value * itemQtd * arquitetoRtPercentual) / 100).toFixed(2)));
    }
  };

  const handleItemQtdChange = (value: number) => {
    setItemQtd(value);
    if (itemRtTipo === "percentual" && itemRtPercentual > 0) {
      setItemRt(Number(((itemVenda * value * itemRtPercentual) / 100).toFixed(2)));
      return;
    }
    if (!editItemId && arquitetoRtPercentual > 0) {
      setItemRt(Number(((itemVenda * value * arquitetoRtPercentual) / 100).toFixed(2)));
    }
  };

  const handleItemRtPercentualChange = (value: number) => {
    setItemRtPercentual(value);
    setItemRt(Number(((itemVenda * itemQtd * value) / 100).toFixed(2)));
  };

  const handleItemRtTipoChange = (tipo: "valor" | "percentual") => {
    setItemRtTipo(tipo);
    if (tipo === "valor") {
      setItemRtPercentual(0);
    } else {
      // Switching to %, recompute from current %
      setItemRt(Number(((itemVenda * itemQtd * itemRtPercentual) / 100).toFixed(2)));
    }
  };

  // Lightbox & preview state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; nome: string } | null>(null);

  // Active tab & orcamento
  const [activeTab, setActiveTab] = useState("dados");
  const [activeOrcamentoId, setActiveOrcamentoId] = useState<string | null>(null);
  const [editingOrcNome, setEditingOrcNome] = useState<string | null>(null);
  const [orcNomeInput, setOrcNomeInput] = useState("");

  const isPreviewable = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return ["pdf", "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
  };

  const { data: clientes, isLoading, isError } = useQuery({
    queryKey: ["clientes", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*, fornecedores:arquiteto_id(nome)").eq("deletado", false).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  // All orcamentos for kanban card display
  const { data: allOrcamentos } = useQuery({
    queryKey: ["all_crm_orcamentos", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_orcamentos").select("id, cliente_id, nome, aprovado, simulacao_pagamento").order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: produtosCatalogo } = useQuery({
    queryKey: ["produtos_autocomplete_crm", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("id, nome, preco_custo, preco_venda, cor").eq("deletado", false).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const filteredProdutosCrm = produtosCatalogo?.filter(p => p.nome.toLowerCase().includes(itemDesc.toLowerCase())) ?? [];

  // All projetos for kanban card display
  const { data: allProjetos } = useQuery({
    queryKey: ["all_projetos_kanban", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome, status, venda_total, cliente_id").eq("deletado", false).neq("status", "cancelado").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: interacoes, refetch: refetchInteracoes } = useQuery({
    queryKey: ["crm_interacoes", detailClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_interacoes").select("*").eq("cliente_id", detailClient!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!detailClient?.id,
  });

  const { data: clienteProjetos } = useQuery({
    queryKey: ["cliente_projetos", detailClient?.id],
    queryFn: async () => {
      const { data } = await supabase.from("projetos").select("id, nome, status, venda_total, orcamento_id").eq("cliente_id", detailClient!.id).eq("deletado", false);
      return data ?? [];
    },
    enabled: !!detailClient?.id,
  });

  // Contas a pagar de frete/imposto vinculadas aos projetos do cliente — para identificar o que já foi PAGO
  const { data: contasFreteImposto } = useQuery({
    queryKey: ["financeiro_pagar_frete_imposto", detailClient?.id],
    queryFn: async () => {
      const projIds = (clienteProjetos ?? []).map((p: any) => p.id);
      if (projIds.length === 0) return [];
      const { data } = await supabase
        .from("financeiro_pagar")
        .select("projeto_id, descricao, valor, status")
        .in("projeto_id", projIds)
        .is("comissao_id", null)
        .is("fornecedor_id", null)
        .eq("deletado", false);
      return data ?? [];
    },
    enabled: !!detailClient?.id && (clienteProjetos?.length ?? 0) > 0,
  });

  // Orcamentos query
  const { data: orcamentos, refetch: refetchOrcamentos } = useQuery({
    queryKey: ["crm_orcamentos", detailClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_orcamentos").select("*").eq("cliente_id", detailClient!.id).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!detailClient?.id,
  });

  const { data: crmItens, refetch: refetchCrmItens } = useQuery({
    queryKey: ["crm_itens", detailClient?.id, activeOrcamentoId],
    queryFn: async () => {
      let q = supabase.from("crm_itens").select("*").eq("cliente_id", detailClient!.id).order("created_at", { ascending: true });
      if (activeOrcamentoId) {
        q = q.eq("orcamento_id", activeOrcamentoId);
      } else {
        q = q.is("orcamento_id", null);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!detailClient?.id,
  });

  const { data: equipeMembers } = useQuery({
    queryKey: ["equipe", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipe").select("*").eq("empresa_id", empresaId!).eq("deletado", false).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: crmArquivos, refetch: refetchArquivos } = useQuery({
    queryKey: ["crm_arquivos", detailClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_arquivos").select("*").eq("cliente_id", detailClient!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!detailClient?.id,
  });

  const resetForm = () => { setNome(""); setEmail(""); setTelefone(""); setEndereco(""); setEnderecoObra(""); setOrigem("outro"); setArquitetoIdOrigem(""); setStatusCrm("lead"); setEditId(null); setShowForm(false); setNovoClienteObs(""); };
  const resetItemForm = () => { setItemDesc(""); setItemQtd(1); setItemCusto(0); setItemVenda(0); setItemRt(0); setItemRtTipo("valor"); setItemRtPercentual(0); setItemTipo("produto"); setEditItemId(null); setItemProdutoId(null); };
  const resetIntForm = () => { setIntTipo("ligacao"); setIntDesc(""); setEditIntId(null); setIntData(undefined); setIntMembroEquipe(""); };

  const openEdit = (c: any) => {
    setEditId(c.id); setNome(c.nome); setEmail(c.email ?? ""); setTelefone(c.telefone ?? "");
    setEndereco(c.endereco ?? ""); setEnderecoObra(c.endereco_obra ?? "");
    setOrigem(c.origem ?? "outro"); setArquitetoIdOrigem(c.arquiteto_id ?? "");
    setStatusCrm(c.status_crm ?? "lead"); setShowForm(true);
  };

  const openDetail = (c: any) => { setDetailClient(c); setViewMode("detail"); setActiveOrcamentoId(null); setActiveTab("dados"); };
  const backToList = () => { setViewMode("list"); setDetailClient(null); setActiveOrcamentoId(null); setActiveTab("dados"); setSearchParams({}); };

  // Auto-open client/budget from URL params (e.g. from Orcamentos page)
  useEffect(() => {
    const clienteId = searchParams.get("cliente_id");
    const orcamentoId = searchParams.get("orcamento_id");
    if (clienteId && clientes && clientes.length > 0 && viewMode === "list") {
      const cliente = clientes.find((c: any) => c.id === clienteId);
      if (cliente) {
        setDetailClient(cliente);
        setViewMode("detail");
        if (orcamentoId) {
          setActiveOrcamentoId(orcamentoId);
          setActiveTab("itens");
        }
        setSearchParams({});
      }
    }
  }, [clientes, searchParams]);

  // ─── Orcamento management ───
  const createOrcamento = useMutation({
    mutationFn: async () => {
      if (!detailClient?.id || !empresaId) return;
      const count = (orcamentos?.length ?? 0) + 1;
      const { data, error } = await supabase.from("crm_orcamentos").insert({
        cliente_id: detailClient.id, empresa_id: empresaId, nome: `Orçamento ${count}`,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      refetchOrcamentos();
      if (data) setActiveOrcamentoId(data.id);
      toast.success("Orçamento criado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const renameOrcamento = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("crm_orcamentos").update({ nome }).eq("id", id);
      if (error) throw error;
      // Also update linked project name if exists
      const { data: linkedProjects } = await supabase.from("projetos").select("id").eq("orcamento_id", id);
      if (linkedProjects && linkedProjects.length > 0) {
        const clienteNome = detailClient?.nome ?? "";
        for (const proj of linkedProjects) {
          await supabase.from("projetos").update({ nome: `${clienteNome} — ${nome}`.trim() }).eq("id", proj.id);
        }
      }
    },
    onSuccess: () => {
      refetchOrcamentos();
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["cliente_projetos"] });
      setEditingOrcNome(null);
      toast.success("Nome atualizado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const duplicateOrcamento = useMutation({
    mutationFn: async (srcOrcamentoId: string) => {
      if (!detailClient?.id || !empresaId) return;
      const count = (orcamentos?.length ?? 0) + 1;
      const { data: newOrc, error } = await supabase.from("crm_orcamentos").insert({
        cliente_id: detailClient.id, empresa_id: empresaId, nome: `Orçamento ${count}`,
      }).select().single();
      if (error) throw error;
      // Copy items from source
      const { data: srcItems } = await supabase.from("crm_itens").select("*").eq("orcamento_id", srcOrcamentoId);
      if (srcItems && srcItems.length > 0 && newOrc) {
        const copies = srcItems.map(i => ({
          cliente_id: detailClient.id, empresa_id: empresaId,
          descricao: i.descricao, quantidade: i.quantidade,
          preco_custo: i.preco_custo, preco_venda: i.preco_venda,
          rt_comissao: (i as any).rt_comissao ?? 0,
          produto_id: i.produto_id, orcamento_id: newOrc.id,
          tipo: (i as any).tipo ?? "produto",
        }));
        await supabase.from("crm_itens").insert(copies as any);
      }
      return newOrc;
    },
    onSuccess: (data) => {
      refetchOrcamentos(); refetchCrmItens();
      if (data) setActiveOrcamentoId(data.id);
      toast.success("Orçamento duplicado!");
    },
    onError: (err: any) => toast.error(err.message),
  });
  // ─── Reusable sync function (guarded against concurrent calls) ───
  const syncingRef = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const _syncOrcamentoToProjectInner = useCallback(async (orcId: string, opts?: { showToast?: boolean }) => {
    if (!detailClient?.id || !empresaId) return;

    const { data: orcData } = await supabase.from("crm_orcamentos").select("*").eq("id", orcId).single();
    if (!orcData?.aprovado) return; // Only sync approved

    const { data: approvedItems } = await supabase.from("crm_itens").select("*").eq("orcamento_id", orcId);
    const items = approvedItems ?? [];

    const totals = calcOrcamentoTotals({
      itens: items,
      frete: orcData.frete,
      imposto: orcData.imposto,
      simulacao_pagamento: orcData.simulacao_pagamento as any,
    });
    const totalVenda = totals.totalVenda;
    const totalCusto = totals.totalCusto;
    const margem = totals.margem;

    const sim = (orcData.simulacao_pagamento as any) ?? {};
    const simParcelas = sim.parcelas ?? [];
    const simFormaPgto = sim.formaPagamento ?? "";
    const simEntradaValor = Number(sim.entrada) || 0;
    const simEntradaData = sim.entradaData ?? null;
    const frete = totals.frete;
    const imposto = totals.imposto;

    const cliente = clientes?.find(c => c.id === detailClient.id);
    const origemLabel = cliente?.origem ? origemLabels[cliente.origem as OrigemLead] : "";
    const descParts = [`Projeto criado a partir do CRM — ${orcData.nome ?? "Orçamento"}`];
    if (origemLabel) descParts.push(`Origem: ${origemLabel}`);
    if (cliente?.notas) descParts.push(`Obs: ${cliente.notas}`);

    const parseDate = (d: string) => { if (d.includes("/")) { const [dd, mm, yyyy] = d.split("/"); return `${yyyy}-${mm}-${dd}`; } return d; };

    // Check if project already exists for this orcamento
    const { data: existingProjects } = await supabase.from("projetos").select("id").eq("orcamento_id", orcId);

    let projId: string;

    if (existingProjects && existingProjects.length > 0) {
      projId = existingProjects[0].id;
      await supabase.from("projetos").update({
        venda_total: totalVenda, custo_previsto: totalCusto, margem_prevista: margem,
        numero_parcelas: simParcelas.length > 0 ? simParcelas.length : 1,
        forma_pagamento: simFormaPgto || null,
        descricao: descParts.join(" | "),
        status: "infraestrutura",
        observacoes_pagamento: `Sincronizado em ${new Date().toLocaleString("pt-BR")}`,
      }).eq("id", projId);
    } else {
      const hoje = new Date().toISOString().split("T")[0];
      const newProjeto = await createProjeto.mutateAsync({
        nome: `${detailClient.nome} — ${orcData.nome ?? ""}`.trim(),
        descricao: descParts.join(" | "),
        cliente_id: detailClient.id, endereco_obra: detailClient.endereco_obra || detailClient.endereco || null,
        arquiteto_id: detailClient.arquiteto_id || null, status: "infraestrutura",
        venda_total: totalVenda, custo_previsto: totalCusto, margem_prevista: margem,
        numero_parcelas: simParcelas.length > 0 ? simParcelas.length : 1,
        forma_pagamento: simFormaPgto || null,
        observacoes_pagamento: `Criado em ${new Date().toLocaleString("pt-BR")}`,
        orcamento_id: orcId,
        data_inicio: hoje,
      } as any);
      projId = newProjeto.id;
    }

    // ── Sync itens (delete + bulk insert to avoid duplication) ──
    await supabase.from("projeto_itens").delete().eq("projeto_id", projId);
    let insertedItens: any[] = [];
    if (items.length > 0) {
      const itemInserts = items.map(item => ({
        projeto_id: projId, descricao: item.descricao,
        quantidade: Number(item.quantidade) || 1,
        preco_custo: Number(item.preco_custo) || 0,
        preco_venda: Number(item.preco_venda) || 0,
        tipo: (["produto", "servico", "adicional"].includes((item as any).tipo) ? (item as any).tipo : "produto") as "produto" | "servico" | "adicional",
        produto_id: item.produto_id || null,
        rt_percentual: Number((item as any).rt_comissao) || 0,
      }));
      const { data: insertedData, error: itemsError } = await supabase.from("projeto_itens").insert(itemInserts).select();
      if (itemsError) console.error("[CRM] Erro ao inserir itens do projeto:", itemsError);
      insertedItens = insertedData ?? [];
    }

    // ── Sync financeiro_receber ──
    await supabase.from("financeiro_receber").delete().eq("projeto_id", projId);
    // Build full parcel list including entrada (if any) as parcela 1
    const fullParcelas: { valor: number; data: string | null }[] = [];
    if (simEntradaValor > 0) {
      fullParcelas.push({ valor: simEntradaValor, data: simEntradaData ? parseDate(simEntradaData) : null });
    }
    simParcelas.forEach((p: any) => {
      fullParcelas.push({ valor: Number(p.valor) || 0, data: p.data ? parseDate(p.data) : null });
    });
    if (fullParcelas.length > 0) {
      const totalP = fullParcelas.length;
      const inserts = fullParcelas.map((p, i) => ({
        empresa_id: empresaId, projeto_id: projId, cliente_id: detailClient.id,
        descricao: `Parcela ${i + 1}/${totalP} — ${detailClient.nome}`,
        valor: p.valor, parcela: i + 1, data_vencimento: p.data, status: "pendente" as const,
      }));
      await supabase.from("financeiro_receber").insert(inserts);
    } else if (totalVenda > 0) {
      // No payment simulation — generate a single receivable with the full amount
      await supabase.from("financeiro_receber").insert({
        empresa_id: empresaId, projeto_id: projId, cliente_id: detailClient.id,
        descricao: `Conta a receber — ${detailClient.nome}`,
        valor: totalVenda, parcela: 1, status: "pendente" as const,
      });
    }

    // ── Sync comissões (RT) — single consolidated entry ──
    await supabase.from("comissoes").delete().eq("projeto_id", projId).eq("status", "pendente");
    await supabase.from("financeiro_pagar").delete().eq("projeto_id", projId).not("comissao_id", "is", null);
    const arquitetoId = detailClient.arquiteto_id;
    if (arquitetoId && insertedItens.length > 0) {
      const totalRt = insertedItens.reduce((sum: number, pi: any) => sum + (Number(pi.rt_percentual) || 0), 0);
      if (totalRt > 0) {
        const percentualMedio = totalVenda > 0 ? (totalRt / totalVenda) * 100 : 0;
        await supabase.from("comissoes").insert({
          empresa_id: empresaId!, projeto_id: projId, fornecedor_id: arquitetoId,
          valor: totalRt, percentual: percentualMedio, status: "pendente" as const,
        });
      }
    }

    // ── Sync compras directly (skip necessidades_compra intermediate step) ──
    // Delete only pending compras to avoid duplicates; keep compras already in progress
    await supabase.from("compras").delete().eq("projeto_id", projId).eq("status", "pendente");
    if (insertedItens.length > 0) {
      const compraInserts = insertedItens
        .filter((pi: any) => pi.tipo === "produto")
        .map((pi: any) => ({
          empresa_id: empresaId!, projeto_id: projId, projeto_item_id: pi.id,
          produto_id: pi.produto_id || null, descricao: pi.descricao ?? "",
          quantidade: Number(pi.quantidade) || 1, status: "pendente" as const,
          valor_unitario: Number(pi.preco_custo) || 0,
          valor_total: (Number(pi.preco_custo) || 0) * (Number(pi.quantidade) || 1),
        }));
      if (compraInserts.length > 0) {
        await supabase.from("compras").insert(compraInserts);
      }
    }
    // Also sync necessidades_compra for backward compatibility (only products)
    await supabase.from("necessidades_compra" as any).delete().eq("projeto_id", projId).eq("status", "pendente");
    if (insertedItens.length > 0) {
      const necInserts = insertedItens
        .filter((pi: any) => pi.tipo === "produto")
        .map((pi: any) => ({
          empresa_id: empresaId!, projeto_id: projId, projeto_item_id: pi.id,
          produto_id: pi.produto_id || null, descricao: pi.descricao ?? "",
          quantidade: Number(pi.quantidade) || 1, status: "pendente",
        }));
      if (necInserts.length > 0) {
        await supabase.from("necessidades_compra" as any).insert(necInserts);
      }
    }

    // ── Sync frete e imposto como contas a pagar ──
    // Remove existing frete/imposto entries (identified by description pattern)
    await supabase.from("financeiro_pagar").delete().eq("projeto_id", projId).is("comissao_id", null).is("fornecedor_id", null);
    const contasPagarExtras: any[] = [];
    if (frete > 0) {
      contasPagarExtras.push({
        empresa_id: empresaId!, projeto_id: projId,
        descricao: `Frete — ${detailClient.nome}`,
        valor: frete, status: "pendente" as const,
        data_vencimento: (orcData as any).frete_vencimento || null,
      });
    }
    if (imposto > 0) {
      contasPagarExtras.push({
        empresa_id: empresaId!, projeto_id: projId,
        descricao: `Imposto — ${detailClient.nome}`,
        valor: imposto, status: "pendente" as const,
        data_vencimento: (orcData as any).imposto_vencimento || null,
      });
    }
    if (contasPagarExtras.length > 0) {
      await supabase.from("financeiro_pagar").insert(contasPagarExtras);
    }

    if (opts?.showToast !== false) {
      toast.success(existingProjects && existingProjects.length > 0
        ? "Projeto atualizado com dados do orçamento!"
        : "Projeto criado a partir do orçamento aprovado!");
    }
  }, [detailClient, empresaId, clientes, createProjeto]);

  const syncOrcamentoToProject = useCallback(async (orcId: string, opts?: { showToast?: boolean }) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      await _syncOrcamentoToProjectInner(orcId, opts);
    } finally {
      syncingRef.current = false;
    }
  }, [_syncOrcamentoToProjectInner]);

  const approveOrcamento = useMutation({
    mutationFn: async (orcId: string) => {
      if (!detailClient?.id || !empresaId) return;
      const { error } = await supabase.from("crm_orcamentos").update({ aprovado: true }).eq("id", orcId);
      if (error) throw error;
      // Auto-update CRM status to "projeto" to avoid manual change and duplicity
      if (detailClient.status_crm !== "projeto") {
        await supabase.from("clientes").update({ status_crm: "projeto" }).eq("id", detailClient.id);
      }
      await syncOrcamentoToProject(orcId);
    },
    onSuccess: () => { refetchOrcamentos(); qc.invalidateQueries({ queryKey: ["projetos"] }); qc.invalidateQueries({ queryKey: ["cliente_projetos"] }); qc.invalidateQueries({ queryKey: ["comissoes"] }); qc.invalidateQueries({ queryKey: ["financeiro_receber"] }); qc.invalidateQueries({ queryKey: ["necessidades_compra"] }); qc.invalidateQueries({ queryKey: ["financeiro_pagar"] }); qc.invalidateQueries({ queryKey: ["projeto_itens"] }); qc.invalidateQueries({ queryKey: ["clientes"] }); qc.invalidateQueries({ queryKey: ["compras"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  // Manual sync button
  const manualSync = useMutation({
    mutationFn: async (orcId: string) => { await syncOrcamentoToProject(orcId); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projetos"] }); qc.invalidateQueries({ queryKey: ["cliente_projetos"] }); qc.invalidateQueries({ queryKey: ["comissoes"] }); qc.invalidateQueries({ queryKey: ["financeiro_receber"] }); qc.invalidateQueries({ queryKey: ["projeto_itens"] }); qc.invalidateQueries({ queryKey: ["necessidades_compra"] }); qc.invalidateQueries({ queryKey: ["financeiro_pagar"] }); qc.invalidateQueries({ queryKey: ["compras"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  // Unapprove orcamento (cancel linked project)
  const unapproveOrcamento = useMutation({
    mutationFn: async (orcId: string) => {
      const { error } = await supabase.from("crm_orcamentos").update({ aprovado: false }).eq("id", orcId);
      if (error) throw error;
      // Find linked projects
      const { data: linkedProjects } = await supabase.from("projetos").select("id").eq("orcamento_id", orcId);
      if (linkedProjects && linkedProjects.length > 0) {
        for (const proj of linkedProjects) {
          // Delete necessidades_compra (itens a comprar)
          await supabase.from("necessidades_compra").delete().eq("projeto_id", proj.id);
          // Delete financeiro_pagar linked to project
          await supabase.from("financeiro_pagar").delete().eq("projeto_id", proj.id);
          // Delete financeiro_receber linked to project
          await supabase.from("financeiro_receber").delete().eq("projeto_id", proj.id);
          // Delete comissoes linked to project
          await supabase.from("comissoes").delete().eq("projeto_id", proj.id);
          // Delete compras linked to project
          await supabase.from("compras").delete().eq("projeto_id", proj.id);
          // Delete projeto_itens
          await supabase.from("projeto_itens").delete().eq("projeto_id", proj.id);
          // Cancel the project
          await supabase.from("projetos").update({ status: "cancelado" }).eq("id", proj.id);
        }
      }
    },
    onSuccess: () => {
      refetchOrcamentos();
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["cliente_projetos"] });
      qc.invalidateQueries({ queryKey: ["necessidades_compra"] });
      qc.invalidateQueries({ queryKey: ["necessidades_compra_counts"] });
      qc.invalidateQueries({ queryKey: ["financeiro_pagar"] });
      qc.invalidateQueries({ queryKey: ["financeiro_receber"] });
      qc.invalidateQueries({ queryKey: ["comissoes"] });
      qc.invalidateQueries({ queryKey: ["compras"] });
      toast.success("Orçamento desaprovado. Dados vinculados foram removidos.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteOrcamento = useMutation({
    mutationFn: async (orcId: string) => {
      // Soft delete: cancel linked project if exists
      const { data: linkedProjects } = await supabase.from("projetos").select("id").eq("orcamento_id", orcId);
      if (linkedProjects && linkedProjects.length > 0) {
        for (const proj of linkedProjects) {
          await supabase.from("projetos").update({ status: "cancelado" }).eq("id", proj.id);
        }
      }
      // Mark orcamento as not approved (soft cancel)
      const { error } = await supabase.from("crm_orcamentos").update({ aprovado: false }).eq("id", orcId);
      if (error) throw error;
      // Actually delete (keeping data in project)
      const { error: delErr } = await supabase.from("crm_orcamentos").delete().eq("id", orcId);
      if (delErr) throw delErr;
    },
    onSuccess: () => {
      refetchOrcamentos(); refetchCrmItens();
      setActiveOrcamentoId(null);
      toast.success("Orçamento excluído. Projeto vinculado foi cancelado.");
    },
  });

  // Save orcamento simulation + frete/imposto
  const saveOrcamentoSimulacao = async (simData: any) => {
    if (!activeOrcamentoId) return;
    const simWithFretes = { ...(simData ?? {}), fretes_extras: fretesExtras };
    await supabase.from("crm_orcamentos").update({
      simulacao_pagamento: simWithFretes,
      frete: orcFrete,
      frete_tipo: orcFreteTipo || null,
      frete_outro: orcFreteOutro || null,
      imposto: orcImposto,
      data_envio_proposta: orcDataEnvio || null,
      data_pagamento_avista: orcDataPgtoAvista || null,
      frete_vencimento: orcFreteVencimento || null,
      imposto_vencimento: orcImpostoVencimento || null,
    } as any).eq("id", activeOrcamentoId);
    refetchOrcamentos();
  };

  /* ─── Auto-create project logic ─── */
  const autoCreateProject = async (clienteId: string, clienteNome: string, endObra: string | null, endCli: string | null, arqId: string | null, notas?: string | null) => {
    if (!empresaId) return;

    // Find approved orcamento first to check for existing project
    const approvedOrc = orcamentos?.find(o => o.aprovado);

    // Check if a project already exists for this client's approved orcamento
    if (approvedOrc) {
      const { data: existingProjects } = await supabase.from("projetos").select("id").eq("orcamento_id", approvedOrc.id).eq("deletado", false);
      if (existingProjects && existingProjects.length > 0) {
        toast.info("Já existe um projeto vinculado a este orçamento.");
        return;
      }
    } else {
      // No approved orcamento — check if any project exists for this client
      const { data: existingClientProjects } = await supabase.from("projetos").select("id").eq("cliente_id", clienteId).eq("deletado", false);
      if (existingClientProjects && existingClientProjects.length > 0) {
        toast.info("Já existe um projeto vinculado a este cliente.");
        return;
      }
    }

    // Use the approvedOrc already found above
    
    // Get items from approved orcamento or fallback to unlinked items
    let items: any[] = [];
    if (approvedOrc) {
      const { data } = await supabase.from("crm_itens").select("*").eq("orcamento_id", approvedOrc.id);
      items = data ?? [];
    } else {
      // Check if there are any orcamentos at all
      const { data: allOrcs } = await supabase.from("crm_orcamentos").select("id").eq("cliente_id", clienteId);
      if (allOrcs && allOrcs.length > 0) {
        toast.error("Nenhum orçamento aprovado! Aprove um orçamento antes de converter para projeto.");
        return;
      }
      // Fallback: use items without orcamento (legacy)
      const { data } = await supabase.from("crm_itens").select("*").eq("cliente_id", clienteId).is("orcamento_id", null);
      items = data ?? [];
    }

    const totalVenda = items.reduce((s: number, i: any) => s + (Number(i.preco_venda) || 0) * (Number(i.quantidade) || 1), 0);
    const totalCusto = items.reduce((s: number, i: any) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1) + (Number(i.rt_comissao) || 0), 0);
    const margem = totalVenda > 0 ? ((totalVenda - totalCusto) / totalVenda) * 100 : 0;
    const cliente = clientes?.find(c => c.id === clienteId);
    const origemLabel = cliente?.origem ? origemLabels[cliente.origem as OrigemLead] : "";
    const descParts = [`Projeto criado automaticamente a partir do CRM`];
    if (origemLabel) descParts.push(`Origem: ${origemLabel}`);
    if (notas || cliente?.notas) descParts.push(`Obs: ${notas || cliente?.notas}`);

    // Get simulation from approved orcamento
    let simParcelas: any[] = [];
    let simFormaPgto = "";
    let simEntradaValor = 0;
    let simEntradaData: string | null = null;
    if (approvedOrc?.simulacao_pagamento) {
      const sim = approvedOrc.simulacao_pagamento as any;
      simParcelas = sim.parcelas ?? [];
      simFormaPgto = sim.formaPagamento ?? "";
      simEntradaValor = Number(sim.entrada) || 0;
      simEntradaData = sim.entradaData ?? null;
    }

    const simParcCount = simParcelas.length;
    const newProjeto = await createProjeto.mutateAsync({
      nome: `${clienteNome} — ${approvedOrc?.nome ?? ""}`.trim(),
      descricao: descParts.join(" | "),
      cliente_id: clienteId, endereco_obra: endObra || endCli || null,
      arquiteto_id: arqId || null, status: "infraestrutura",
      venda_total: totalVenda, custo_previsto: totalCusto, margem_prevista: margem,
      numero_parcelas: simParcCount > 0 ? simParcCount : 1,
      forma_pagamento: simFormaPgto || null,
      observacoes_pagamento: notas || cliente?.notas || null,
      orcamento_id: approvedOrc?.id || null,
    });
    if (items.length > 0) {
      const itemInserts = items.map(item => ({
        projeto_id: newProjeto.id, descricao: item.descricao,
        quantidade: Number(item.quantidade) || 1,
        preco_custo: Number(item.preco_custo) || 0,
        preco_venda: Number(item.preco_venda) || 0,
        tipo: (["produto", "servico", "adicional"].includes((item as any).tipo) ? (item as any).tipo : "produto") as "produto" | "servico" | "adicional",
        produto_id: item.produto_id || null,
        rt_percentual: Number(item.rt_comissao) || 0,
      }));
      await supabase.from("projeto_itens").insert(itemInserts);
    }
    // Generate financial parcels from simulation
    if (totalVenda > 0) {
      const parseDate = (d: string) => {
        if (!d) return null;
        if (d.includes("/")) { const [dd, mm, yyyy] = d.split("/"); return `${yyyy}-${mm}-${dd}`; }
        return d;
      };
      const fullParcelas: { valor: number; data: string | null }[] = [];
      if (simEntradaValor > 0) {
        fullParcelas.push({ valor: simEntradaValor, data: simEntradaData ? parseDate(simEntradaData) : null });
      }
      simParcelas.forEach((p: any) => {
        fullParcelas.push({ valor: Number(p.valor) || 0, data: p.data ? parseDate(p.data) : null });
      });
      if (fullParcelas.length > 0) {
        const totalP = fullParcelas.length;
        const inserts = fullParcelas.map((p, i) => ({
          empresa_id: empresaId, projeto_id: newProjeto.id, cliente_id: clienteId,
          descricao: `Parcela ${i + 1}/${totalP} — Projeto — ${clienteNome}`,
          valor: p.valor, parcela: i + 1,
          data_vencimento: p.data, status: "pendente" as const,
        }));
        await supabase.from("financeiro_receber").insert(inserts);
      }
    }
    toast.success("Projeto criado automaticamente com itens e parcelas do CRM!");
  };

  /* ─── Save new client and open detail ─── */
  const saveNewClient = useMutation({
    mutationFn: async () => {
      console.log("[CRM] saveNewClient chamado", { nome, email, empresaId });
      if (!empresaId) { toast.error("Empresa não identificada. Faça login novamente."); throw new Error("empresaId ausente"); }
      if (!nome.trim()) { toast.error("Nome é obrigatório"); throw new Error("Nome é obrigatório"); }
      if (email && !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { toast.error("E-mail inválido. Verifique o formato (ex: nome@email.com)"); throw new Error("E-mail inválido"); }
      const payload: any = sanitizePayload({ nome: nome.trim(), email: email || null, telefone: telefone || null, endereco: endereco || null, endereco_obra: enderecoObra || null, origem, status_crm: "lead" as StatusCRM, arquiteto_id: (origem === "arquiteto" && arquitetoIdOrigem) ? arquitetoIdOrigem : null, empresa_id: empresaId, notas: novoClienteObs || null });
      console.log("[CRM] payload:", payload);
      const { data, error } = await supabase.from("clientes").insert(payload).select().single();
      if (error) { console.error("[CRM] Erro ao salvar cliente:", error); throw error; }
      console.log("[CRM] Cliente salvo com sucesso:", data);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente cadastrado com sucesso!");
      resetForm();
      setDetailClient(data);
      setViewMode("detail");
    },
    onError: (err: any) => { console.error("[CRM] Erro na mutation saveNewClient:", err); if (err?.message && !err.message.includes("obrigatório") && !err.message.includes("inválido") && !err.message.includes("ausente")) { toast.error("Erro ao salvar: " + err.message); } },
  });

  const save = useMutation({
    mutationFn: async () => {
      console.log("[CRM] save chamado", { nome, email, editId, empresaId });
      if (!empresaId) { toast.error("Empresa não identificada. Faça login novamente."); throw new Error("empresaId ausente"); }
      if (!nome.trim()) { toast.error("Nome é obrigatório"); throw new Error("Nome é obrigatório"); }
      if (email && !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { toast.error("E-mail inválido. Verifique o formato (ex: nome@email.com)"); throw new Error("E-mail inválido"); }
      const payload: any = sanitizePayload({ nome: nome.trim(), email: email || null, telefone: telefone || null, endereco: endereco || null, endereco_obra: enderecoObra || null, origem, status_crm: statusCrm, arquiteto_id: (origem === "arquiteto" && arquitetoIdOrigem) ? arquitetoIdOrigem : null });
      if (editId) {
        const oldCliente = clientes?.find(c => c.id === editId);
        const { error } = await supabase.from("clientes").update(payload).eq("id", editId);
        if (error) { console.error("[CRM] Erro ao atualizar:", error); throw error; }
        if (statusCrm === "projeto" && oldCliente?.status_crm !== "projeto") {
          await autoCreateProject(editId, nome, enderecoObra || null, endereco || null, payload.arquiteto_id, oldCliente?.notas);
        }
      } else {
        const { error } = await supabase.from("clientes").insert({ ...payload, empresa_id: empresaId });
        if (error) { console.error("[CRM] Erro ao inserir:", error); throw error; }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); qc.invalidateQueries({ queryKey: ["projetos"] }); toast.success(editId ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!"); resetForm(); },
    onError: (err: any) => { console.error("[CRM] Erro na mutation save:", err); if (err?.message && !err.message.includes("obrigatório") && !err.message.includes("inválido") && !err.message.includes("ausente")) { toast.error("Erro ao salvar: " + err.message); } },
  });

  const [deleteClientTarget, setDeleteClientTarget] = useState<{ id: string; nome: string } | null>(null);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      // Soft delete all projects for this client
      const { data: clientProjects } = await supabase.from("projetos").select("id").eq("cliente_id", id);
      const projectIds = (clientProjects ?? []).map(p => p.id);
      if (projectIds.length > 0) {
        for (const pid of projectIds) {
          await supabase.from("visitas_tecnicas").update({ deletado: true } as any).eq("projeto_id", pid);
          await supabase.from("comissoes").update({ deletado: true } as any).eq("projeto_id", pid);
          await supabase.from("financeiro_receber").update({ deletado: true } as any).eq("projeto_id", pid);
          await supabase.from("financeiro_pagar").update({ deletado: true } as any).eq("projeto_id", pid);
          await supabase.from("compras").update({ deletado: true } as any).eq("projeto_id", pid);
          await supabase.from("contratos").update({ deletado: true } as any).eq("projeto_id", pid);
          await supabase.from("necessidades_compra" as any).update({ status: "cancelado" } as any).eq("projeto_id", pid).eq("status", "pendente");
        }
        await supabase.from("projetos").update({ deletado: true } as any).in("id", projectIds);
      }
      // Soft delete financeiro_receber and contratos by client
      await supabase.from("financeiro_receber").update({ deletado: true } as any).eq("cliente_id", id);
      await supabase.from("contratos").update({ deletado: true } as any).eq("cliente_id", id);
      // Audit log
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        await supabase.from("audit_logs").insert({
          tabela: "clientes", registro_id: id, acao: "exclusao",
          usuario_id: authUser.id, empresa_id: empresaId,
          dados_anteriores: { cliente_id: id, projetos_excluidos: projectIds.length },
        });
      }
      const { error } = await supabase.from("clientes").update({ deletado: true } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); qc.invalidateQueries({ queryKey: ["necessidades_compra"] }); qc.invalidateQueries({ queryKey: ["necessidades_compra_counts"] }); qc.invalidateQueries({ queryKey: ["projetos"] }); qc.invalidateQueries({ queryKey: ["compras"] }); qc.invalidateQueries({ queryKey: ["financeiro_pagar"] }); qc.invalidateQueries({ queryKey: ["financeiro_receber"] }); toast.success("Cliente excluído"); },
    onError: (err: any) => toast.error(err.message),
  });

  /* ─── Inline status change from list ─── */
  const changeStatusInline = useMutation({
    mutationFn: async ({ id, newStatus, old }: { id: string; newStatus: StatusCRM; old: any }) => {
      const { error } = await supabase.from("clientes").update({ status_crm: newStatus }).eq("id", id);
      if (error) throw error;
      if (newStatus === "projeto" && old.status_crm !== "projeto") {
        await autoCreateProject(id, old.nome, old.endereco_obra, old.endereco, old.arquiteto_id, old.notas);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); qc.invalidateQueries({ queryKey: ["projetos"] }); toast.success("Status atualizado!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const addInteracao = useMutation({
    mutationFn: async () => {
      if (!intDesc.trim() || !detailClient?.id) return;
      const descFull = intTipo === "visita" && intMembroEquipe
        ? `[Equipe: ${equipeMembers?.find(m => m.id === intMembroEquipe)?.nome ?? intMembroEquipe}] ${intDesc}`
        : intDesc;
      if (editIntId) {
        const { error } = await supabase.from("crm_interacoes").update(sanitizePayload({ tipo: intTipo, descricao: descFull })).eq("id", editIntId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_interacoes").insert(sanitizePayload({ cliente_id: detailClient.id, tipo: intTipo, descricao: descFull, usuario_id: user?.id ?? null }));
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm_interacoes"] }); resetIntForm(); toast.success(editIntId ? "Interação atualizada" : "Interação registrada"); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteInteracao = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("crm_interacoes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["crm_interacoes"] }); toast.success("Interação excluída"); },
  });

  const saveCrmItem = useMutation({
    mutationFn: async () => {
      if (!itemDesc.trim() || !detailClient?.id) return;

      // Auto-create product if it doesn't exist in catalog (only for produto type)
      if (!editItemId && empresaId && itemTipo === "produto") {
        const { data: existingProduct } = await supabase
          .from("produtos")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("nome", itemDesc.trim())
          .eq("deletado", false)
          .maybeSingle();

        if (!existingProduct) {
          await supabase.from("produtos").insert({
            empresa_id: empresaId,
            nome: itemDesc.trim(),
            preco_custo: itemCusto,
            preco_venda: itemVenda,
          } as any);
        }
      }

      if (editItemId) {
        const { error } = await supabase.from("crm_itens").update(sanitizePayload({ descricao: itemDesc, quantidade: itemQtd, preco_custo: itemCusto, preco_venda: itemVenda, rt_comissao: itemRt, rt_tipo: itemRtTipo, rt_percentual: itemRtPercentual, tipo: itemTipo } as any)).eq("id", editItemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_itens").insert(sanitizePayload({ cliente_id: detailClient.id, empresa_id: empresaId!, descricao: itemDesc, quantidade: itemQtd, preco_custo: itemCusto, preco_venda: itemVenda, rt_comissao: itemRt, rt_tipo: itemRtTipo, rt_percentual: itemRtPercentual, orcamento_id: activeOrcamentoId, tipo: itemTipo } as any));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchCrmItens(); resetItemForm(); toast.success(editItemId ? "Item atualizado" : "Item adicionado");
      // Auto-sync if orcamento is approved
      if (activeOrcamentoId) {
        const orc = orcamentos?.find(o => o.id === activeOrcamentoId);
        if (orc?.aprovado) syncOrcamentoToProject(activeOrcamentoId, { showToast: false });
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ─── Inline edit state ───
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: string } | null>(null);
  const [inlineValue, setInlineValue] = useState<string>("");
  const [inlineSaving, setInlineSaving] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);

  const startInlineEdit = useCallback((id: string, field: string, value: any) => {
    setInlineEdit({ id, field });
    setInlineValue(String(value ?? ""));
  }, []);

  const saveInlineEdit = useCallback(async () => {
    if (!inlineEdit) return;
    const { id, field } = inlineEdit;
    const numFields = ["quantidade", "preco_custo", "preco_venda", "rt_comissao"];
    const val = numFields.includes(field) ? Number(inlineValue) : inlineValue;
    if (field === "descricao" && !String(val).trim()) { setInlineEdit(null); return; }
    setInlineSaving(true);
    try {
      let payload: any = { [field]: val };
      if (field === "rt_comissao" || field === "rt_percentual") {
        const item: any = (crmItens ?? []).find((i: any) => i.id === id);
        const venda = (Number(item?.preco_venda) || 0) * (Number(item?.quantidade) || 1);
        const tipo = (item?.rt_tipo ?? "valor") as "valor" | "percentual";
        if (field === "rt_percentual" || tipo === "percentual") {
          const perc = Number(inlineValue) || 0;
          payload = {
            rt_tipo: "percentual",
            rt_percentual: perc,
            rt_comissao: Number(((venda * perc) / 100).toFixed(2)),
          };
        } else {
          payload = {
            rt_tipo: "valor",
            rt_comissao: Number(inlineValue) || 0,
            rt_percentual: 0,
          };
        }
      }
      const { error } = await supabase.from("crm_itens").update(sanitizePayload(payload as any)).eq("id", id);
      if (error) throw error;
      refetchCrmItens();
      if (activeOrcamentoId) {
        const orc = orcamentos?.find((o: any) => o.id === activeOrcamentoId);
        if (orc?.aprovado) syncOrcamentoToProject(activeOrcamentoId, { showToast: false });
      }
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setInlineSaving(false);
      setInlineEdit(null);
    }
  }, [inlineEdit, inlineValue, activeOrcamentoId, orcamentos, crmItens]);

  const handleSortToggle = useCallback((key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) return prev.dir === "asc" ? { key, dir: "desc" } : null;
      return { key, dir: "asc" };
    });
  }, []);

  const sortItems = useCallback((items: any[]) => {
    if (!sortConfig) return items;
    const { key, dir } = sortConfig;
    return [...items].sort((a, b) => {
      const av = key === "descricao" ? String(a[key] ?? "").toLowerCase() : Number(a[key] ?? 0);
      const bv = key === "descricao" ? String(b[key] ?? "").toLowerCase() : Number(b[key] ?? 0);
      if (av < bv) return dir === "asc" ? -1 : 1;
      if (av > bv) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [sortConfig]);

  const deleteCrmItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("crm_itens").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => {
      refetchCrmItens(); toast.success("Item excluído");
      if (activeOrcamentoId) {
        const orc = orcamentos?.find(o => o.id === activeOrcamentoId);
        if (orc?.aprovado) syncOrcamentoToProject(activeOrcamentoId, { showToast: false });
      }
    },
  });

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTipo, setUploadTipo] = useState<"imagem" | "documento">("imagem");

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      if (!detailClient?.id || !empresaId) return;
      const ext = file.name.split(".").pop();
      const path = `${empresaId}/${detailClient.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("crm-files").upload(path, file);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("crm-files").getPublicUrl(path);
      const { error } = await supabase.from("crm_arquivos").insert({
        cliente_id: detailClient.id, empresa_id: empresaId,
        tipo: uploadTipo, nome_arquivo: file.name,
        url: urlData.publicUrl, tamanho: file.size,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { refetchArquivos(); toast.success("Arquivo enviado!"); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteArquivo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_arquivos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { refetchArquivos(); toast.success("Arquivo removido"); },
  });

  

  const filteredSorted = useMemo(() => {
    const list = clientes?.filter(c => filterStatus === "todos" || c.status_crm === filterStatus) ?? [];
    return [...list].sort((a, b) => {
      let av: any, bv: any;
      if (tableSortKey === "nome") { av = (a.nome ?? "").toLowerCase(); bv = (b.nome ?? "").toLowerCase(); }
      else if (tableSortKey === "updated_at") { av = a.updated_at; bv = b.updated_at; }
      else { av = a.created_at; bv = b.created_at; }
      if (av < bv) return tableSortDir === "asc" ? -1 : 1;
      if (av > bv) return tableSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [clientes, filterStatus, tableSortKey, tableSortDir]);

  const toggleTableSort = (key: "nome" | "created_at" | "updated_at") => {
    if (tableSortKey === key) setTableSortDir(d => d === "asc" ? "desc" : "asc");
    else { setTableSortKey(key); setTableSortDir(key === "nome" ? "asc" : "desc"); }
  };

  const getOrcamentoCount = (clienteId: string) => (allOrcamentos ?? []).filter(o => o.cliente_id === clienteId).length;

  const getDaysInStatus = (c: any) => {
    const ref = c.updated_at || c.created_at;
    if (!ref) return 0;
    return Math.floor((Date.now() - new Date(ref).getTime()) / 86400000);
  };

  const totalCrmCusto = (crmItens ?? []).reduce((s, i) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0);
  const totalCrmVenda = (crmItens ?? []).reduce((s, i) => s + (Number(i.preco_venda) || 0) * (Number(i.quantidade) || 1), 0);
  const totalCrmRt = (crmItens ?? []).reduce((s, i) => s + (Number((i as any).rt_comissao) || 0), 0);
  const totalCrmQtd = (crmItens ?? []).reduce((s, i) => s + (Number(i.quantidade) || 0), 0);

  // Payment simulation state - now per orcamento
  const activeOrc = orcamentos?.find(o => o.id === activeOrcamentoId);
  const savedSim = (activeOrc?.simulacao_pagamento as any) ?? {};
  const [simCondicao, setSimCondicao] = useState<"avista" | "parcelado">(savedSim.condicao ?? "avista");
  const [simFormaPgto, setSimFormaPgto] = useState(savedSim.formaPagamento ?? "boleto");
  const [simParcelas, setSimParcelas] = useState(savedSim.numParcelas ?? 1);
  const [simEntrada, setSimEntrada] = useState(savedSim.entrada ?? 0);
  const [simIntervalo, setSimIntervalo] = useState(savedSim.intervalo ?? 30);
  const [simJuros, setSimJuros] = useState(savedSim.juros ?? 0);
  const [editingParcelas, setEditingParcelas] = useState<{ numero: number; valor: number; data: string }[] | null>(savedSim.parcelas ?? null);
  const [simEntradaData, setSimEntradaData] = useState<string>(savedSim.entradaData ?? new Date().toLocaleDateString("pt-BR"));

  // Frete & Imposto state
  const [orcFrete, setOrcFrete] = useState(Number((activeOrc as any)?.frete) || 0);
  const [orcFreteTipo, setOrcFreteTipo] = useState<string>((activeOrc as any)?.frete_tipo ?? "");
  const [orcFreteOutro, setOrcFreteOutro] = useState<string>((activeOrc as any)?.frete_outro ?? "");
  const [orcImposto, setOrcImposto] = useState(Number((activeOrc as any)?.imposto) || 0);
  const [orcDataEnvio, setOrcDataEnvio] = useState<string>((activeOrc as any)?.data_envio_proposta ?? "");
  const [orcFreteVencimento, setOrcFreteVencimento] = useState<string>((activeOrc as any)?.frete_vencimento ?? "");
  const [orcImpostoVencimento, setOrcImpostoVencimento] = useState<string>((activeOrc as any)?.imposto_vencimento ?? "");
  const [orcDataPgtoAvista, setOrcDataPgtoAvista] = useState<string>((activeOrc as any)?.data_pagamento_avista ?? "");
  // Múltiplos fretes (armazenados em simulacao_pagamento.fretes_extras para preservar schema)
  // Status removido (não faz sentido operacional). Descrição passa a identificar o frete.
  type FreteExtra = { id: string; descricao: string; transportadora: string; valor: number; vencimento: string };
  const normalizeFretes = (raw: any): FreteExtra[] =>
    Array.isArray(raw)
      ? raw.map((f: any) => ({
          id: f.id ?? crypto.randomUUID(),
          descricao: f.descricao ?? "",
          transportadora: f.transportadora ?? "",
          valor: Number(f.valor) || 0,
          vencimento: f.vencimento ?? "",
        }))
      : [];
  const [fretesExtras, setFretesExtras] = useState<FreteExtra[]>(
    normalizeFretes(((activeOrc as any)?.simulacao_pagamento as any)?.fretes_extras)
  );
  // Desconto state
  const [orcDescontoTipo, setOrcDescontoTipo] = useState<"percentual" | "fixo">(((activeOrc as any)?.simulacao_pagamento as any)?.descontoTipo ?? "fixo");
  const [orcDescontoValor, setOrcDescontoValor] = useState(Number(((activeOrc as any)?.simulacao_pagamento as any)?.descontoValor) || 0);

  const subtotalOrcamento = totalCrmVenda;
  const descontoCalculado = useMemo(() => {
    if (orcDescontoTipo === "percentual") {
      const pct = Math.min(Math.max(orcDescontoValor, 0), 100);
      return (subtotalOrcamento * pct) / 100;
    }
    return Math.min(Math.max(orcDescontoValor, 0), subtotalOrcamento);
  }, [orcDescontoTipo, orcDescontoValor, subtotalOrcamento]);
  const totalCrmVendaComDesconto = subtotalOrcamento - descontoCalculado;

  // Frete previsto = orcFrete (valor do contrato/projeto).
  // Fretes realizados = lançamentos individuais (fretesExtras) — somatório dos valores efetivamente gastos.
  const fretePrevisto = Number(orcFrete) || 0;
  const freteRealizado = useMemo(
    () => fretesExtras.reduce((s, f) => s + (Number(f.valor) || 0), 0),
    [fretesExtras]
  );
  const fretePendente = Math.max(fretePrevisto - freteRealizado, 0);
  const totalCrmCustoComExtras = totalCrmCusto + fretePrevisto + orcImposto + totalCrmRt;

  // Reset simulation when orcamento changes
  const loadSimFromOrc = useCallback((orc: any) => {
    const sim = (orc?.simulacao_pagamento as any) ?? {};
    setSimCondicao(sim.condicao ?? "avista");
    setSimFormaPgto(sim.formaPagamento ?? "boleto");
    setSimParcelas(sim.numParcelas ?? 1);
    setSimEntrada(sim.entrada ?? 0);
    setSimIntervalo(sim.intervalo ?? 30);
    setSimJuros(sim.juros ?? 0);
    setEditingParcelas(sim.parcelas ?? null);
    setSimEntradaData(sim.entradaData ?? new Date().toLocaleDateString("pt-BR"));
    setOrcFrete(Number(orc?.frete) || 0);
    setOrcFreteTipo(orc?.frete_tipo ?? "");
    setOrcFreteOutro(orc?.frete_outro ?? "");
    setOrcImposto(Number(orc?.imposto) || 0);
    setOrcDataEnvio(orc?.data_envio_proposta ?? "");
    setOrcFreteVencimento(orc?.frete_vencimento ?? "");
    setOrcImpostoVencimento(orc?.imposto_vencimento ?? "");
    setOrcDataPgtoAvista(orc?.data_pagamento_avista ?? "");
    setOrcDescontoTipo(sim.descontoTipo ?? "fixo");
    setOrcDescontoValor(Number(sim.descontoValor) || 0);
    setFretesExtras(normalizeFretes(sim.fretes_extras));
  }, []);

  // Sync state when activeOrc data loads/changes (e.g. after refetch or URL-based navigation)
  const prevActiveOrcRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeOrc && activeOrcamentoId && prevActiveOrcRef.current !== activeOrcamentoId) {
      prevActiveOrcRef.current = activeOrcamentoId;
      loadSimFromOrc(activeOrc);
    }
  }, [activeOrc, activeOrcamentoId, loadSimFromOrc]);

  // Auto-reset edited parcelas when item totals change so simulation recalculates
  // Only reset if parcelas were NOT manually edited (editingParcelas is null means auto-generated)
  const prevTotalRef = useRef(totalCrmVenda);
  useEffect(() => {
    if (prevTotalRef.current !== totalCrmVenda && !editingParcelas) {
      setEditingParcelas(null);
    }
    prevTotalRef.current = totalCrmVenda;
  }, [totalCrmVenda, editingParcelas]);
  const simulacao = useMemo(() => {
    const total = totalCrmVendaComDesconto;
    if (simCondicao === "avista") {
      return { total, totalFinal: total, entrada: 0, restante: 0, valorParcela: 0, parcelas: [] as { numero: number; valor: number; data: string }[] };
    }
    const entrada = Math.min(simEntrada, total);
    const restante = total - entrada;
    const jurosFator = simJuros > 0 ? Math.pow(1 + simJuros / 100, simParcelas) : 1;
    const totalComJuros = restante * jurosFator;
    const valorParcela = simParcelas > 0 ? totalComJuros / simParcelas : 0;
    const totalFinal = entrada + totalComJuros;
    const hoje = new Date();
    const parcelas: { numero: number; valor: number; data: string }[] = [];
    for (let i = 0; i < simParcelas; i++) {
      const d = new Date(hoje);
      d.setDate(d.getDate() + (i + 1) * simIntervalo);
      parcelas.push({ numero: i + 1, valor: valorParcela, data: d.toLocaleDateString("pt-BR") });
    }
    return { total, totalFinal, entrada, restante, valorParcela, parcelas };
  }, [totalCrmVendaComDesconto, simCondicao, simEntrada, simParcelas, simIntervalo, simJuros]);

  const parcelasParaExibir = editingParcelas ?? simulacao.parcelas;

  const handleEditParcela = (idx: number, field: "valor" | "data", value: string) => {
    const current = [...(editingParcelas ?? simulacao.parcelas)];
    if (field === "valor") current[idx] = { ...current[idx], valor: Number(value) || 0 };
    else current[idx] = { ...current[idx], data: value };
    setEditingParcelas(current);
  };

  const handleSaveSimulacao = async () => {
    const simData = {
      condicao: simCondicao, formaPagamento: simFormaPgto,
      numParcelas: simParcelas, entrada: simEntrada, entradaData: simEntradaData,
      intervalo: simIntervalo, juros: simJuros,
      parcelas: parcelasParaExibir,
      descontoTipo: orcDescontoTipo, descontoValor: orcDescontoValor,
    };
    await saveOrcamentoSimulacao(simData);
    toast.success("Simulação salva!");
    // Auto-sync if approved
    if (activeOrcamentoId) {
      const orc = orcamentos?.find(o => o.id === activeOrcamentoId);
      if (orc?.aprovado) {
        await syncOrcamentoToProject(activeOrcamentoId, { showToast: false });
        qc.invalidateQueries({ queryKey: ["financeiro_receber"] });
        qc.invalidateQueries({ queryKey: ["projetos"] });
        qc.invalidateQueries({ queryKey: ["cliente_projetos"] });
        qc.invalidateQueries({ queryKey: ["financeiro_pagar"] });
        qc.invalidateQueries({ queryKey: ["comissoes"] });
        qc.invalidateQueries({ queryKey: ["compras"] });
        toast.success("Financeiro do projeto atualizado!");
      }
    }
  };

  const gerarPropostaPDF = () => {
    if (!detailClient || !crmItens || crmItens.length === 0) {
      toast.error("Adicione itens antes de gerar a proposta.");
      return;
    }
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(30, 58, 95);
    doc.rect(0, 0, pageW, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PROPOSTA COMERCIAL", pageW / 2, 18, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(activeOrc?.nome ?? "Orçamento", pageW / 2, 28, { align: "center" });
    doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, pageW / 2, 34, { align: "center" });

    // Client info
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO CLIENTE", 14, 50);
    doc.setDrawColor(30, 58, 95);
    doc.line(14, 52, pageW - 14, 52);

    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    let y = 58;
    const addLine = (label: string, value: string) => {
      if (!value || value === "—") return;
      doc.setFont("helvetica", "bold");
      doc.text(`${label}: `, 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, 14 + doc.getTextWidth(`${label}: `), y);
      y += 6;
    };
    addLine("Cliente", detailClient.nome);
    addLine("E-mail", detailClient.email ?? "");
    addLine("Telefone", detailClient.telefone ?? "");
    addLine("Endereço da Obra", detailClient.endereco_obra ?? detailClient.endereco ?? "");

    // Items table
    y += 4;
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ITENS DA PROPOSTA", 14, y);
    doc.line(14, y + 2, pageW - 14, y + 2);
    y += 6;

    const tableBody = crmItens.map((item: any) => [
      item.descricao,
      String(item.quantidade),
      `R$ ${Number(item.preco_venda).toFixed(2)}`,
      `R$ ${(Number(item.preco_venda) * Number(item.quantidade)).toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Descrição", "Qtd", "Valor Unit.", "Subtotal"]],
      body: tableBody,
      theme: "striped",
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
      alternateRowStyles: { fillColor: [240, 244, 248] },
      columnStyles: { 0: { cellWidth: "auto" }, 1: { halign: "center", cellWidth: 20 }, 2: { halign: "right", cellWidth: 30 }, 3: { halign: "right", cellWidth: 30 } },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 8;

    // Totals
    doc.setFillColor(240, 244, 248);
    doc.roundedRect(pageW - 80, y, 66, 18, 2, 2, "F");
    doc.setTextColor(30, 58, 95);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", pageW - 76, y + 7);
    doc.setFontSize(13);
    doc.text(`R$ ${totalCrmVenda.toFixed(2)}`, pageW - 76, y + 15);

    y += 26;

    // Payment simulation
    if (activeOrc?.simulacao_pagamento) {
      const sim = activeOrc.simulacao_pagamento as any;
      const parcelas = sim.parcelas ?? [];
      if (parcelas.length > 0) {
        doc.setTextColor(30, 58, 95);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("CONDIÇÕES DE PAGAMENTO", 14, y);
        doc.line(14, y + 2, pageW - 14, y + 2);
        y += 6;

        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        if (sim.formaPagamento) {
          doc.text(`Forma: ${sim.formaPagamento}`, 14, y);
          y += 6;
        }
        if (sim.entrada > 0) {
          doc.text(`Entrada: R$ ${Number(sim.entrada).toFixed(2)}`, 14, y);
          y += 6;
        }
        doc.text(`${parcelas.length}x parcelas:`, 14, y);
        y += 6;

        autoTable(doc, {
          startY: y,
          head: [["Parcela", "Valor", "Vencimento"]],
          body: parcelas.map((p: any) => [
            `${p.numero}/${parcelas.length}`,
            `R$ ${Number(p.valor).toFixed(2)}`,
            p.data,
          ]),
          theme: "grid",
          headStyles: { fillColor: [30, 58, 95], textColor: 255, fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: [60, 60, 60] },
          margin: { left: 14, right: 14 },
          tableWidth: 120,
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 20;
    doc.setDrawColor(30, 58, 95);
    doc.line(14, footerY, pageW - 14, footerY);
    doc.setTextColor(140, 140, 140);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Proposta válida por 30 dias. Valores sujeitos a alteração.", pageW / 2, footerY + 6, { align: "center" });
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, pageW / 2, footerY + 11, { align: "center" });

    doc.save(`Proposta_${detailClient.nome.replace(/\s+/g, "_")}_${activeOrc?.nome?.replace(/\s+/g, "_") ?? "Orcamento"}.pdf`);
    toast.success("Proposta PDF gerada com sucesso!");
  };

  // Status counts
  const statusCounts = {
    lead: clientes?.filter(c => c.status_crm === "lead").length ?? 0,
    contato: clientes?.filter(c => c.status_crm === "contato").length ?? 0,
    proposta: clientes?.filter(c => c.status_crm === "proposta").length ?? 0,
    projeto: clientes?.filter(c => c.status_crm === "projeto").length ?? 0,
  };

  const isProjeto = detailClient?.status_crm === "projeto";

  const imagens = (crmArquivos ?? []).filter(a => (a as any).tipo === "imagem");
  const documentos = (crmArquivos ?? []).filter(a => (a as any).tipo === "documento");

  /* ─── NEW CLIENT VIEW ─── */
  if (viewMode === "new") {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-2">
          <button onClick={backToList} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition">
            <ArrowLeft size={14} /> Voltar
          </button>
          <h1 className="text-lg font-bold text-foreground">Novo Cliente</h1>
        </div>

        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dados" className="text-xs">Dados do Cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="dados">
            <div className="bg-card border border-border rounded p-3 space-y-3">
              <h2 className="text-xs font-semibold text-foreground">Cadastrar Cliente</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Nome *</label><input value={nome} onChange={e => setNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">E-mail</label><input value={email} onChange={e => setEmail(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Telefone</label><input value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Endereço</label><input value={endereco} onChange={e => setEndereco(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Endereço da Obra</label><input value={enderecoObra} onChange={e => setEnderecoObra(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Origem</label>
                  <select value={origem} onChange={e => setOrigem(e.target.value as OrigemLead)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                    <option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="indicacao">Indicação</option><option value="arquiteto">Arquiteto</option><option value="outro">Outro</option>
                  </select>
                </div>
                {origem === "arquiteto" && (
                  <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Arquiteto</label>
                    <select value={arquitetoIdOrigem} onChange={e => setArquitetoIdOrigem(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                      <option value="">Selecione...</option>
                      {(arquitetos ?? []).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Status</label>
                  <select value={statusCrm} onChange={e => setStatusCrm(e.target.value as StatusCRM)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                    {statusCrmOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1 col-span-2 md:col-span-4">
                  <label className="text-[11px] text-muted-foreground">Observação</label>
                  <textarea value={novoClienteObs} onChange={e => setNovoClienteObs(e.target.value)} placeholder="Observações sobre o cliente..." className="w-full min-h-[60px] px-2 py-1.5 text-xs bg-background border border-border rounded resize-y focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveNewClient.mutate()} disabled={saveNewClient.isPending || !nome.trim()} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar e Continuar</button>
                <button onClick={() => { resetForm(); setViewMode("list"); }} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80">Cancelar</button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  /* ─── DETAIL VIEW ─── */
  if (viewMode === "detail" && detailClient) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-2">
          <button onClick={backToList} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition">
            <ArrowLeft size={14} /> Voltar
          </button>
          <h1 className="text-lg font-bold text-foreground">{detailClient.nome}</h1>
          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusCrmColors[detailClient.status_crm as StatusCRM]}`}>{statusCrmLabels[detailClient.status_crm as StatusCRM]}</span>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-secondary/40 p-1">
            <TabsTrigger value="dados" className="text-xs">Dados do Cliente</TabsTrigger>
            <TabsTrigger value="itens" className="text-xs">Itens (Pré-Projeto)</TabsTrigger>
            <TabsTrigger value="anotacoes" className="text-xs">Anotações</TabsTrigger>
            <TabsTrigger value="imagens" className="text-xs">Imagens</TabsTrigger>
            <TabsTrigger value="documentos" className="text-xs">Documentos</TabsTrigger>
            <TabsTrigger value="projetos" className="text-xs">Projetos</TabsTrigger>
          </TabsList>

          {/* ─── DADOS DO CLIENTE ─── */}
          <TabsContent value="dados">
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-card border border-border rounded p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground"><User size={12} /><span className="text-[10px] uppercase tracking-wider font-semibold">Cliente</span></div>
                  <p className="text-sm font-medium text-foreground">{detailClient.nome}</p>
                </div>
                <div className="bg-card border border-border rounded p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground"><Phone size={12} /><span className="text-[10px] uppercase tracking-wider font-semibold">Telefone</span></div>
                  <p className="text-sm font-medium text-foreground">{detailClient.telefone ?? "—"}</p>
                </div>
                <div className="bg-card border border-border rounded p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin size={12} /><span className="text-[10px] uppercase tracking-wider font-semibold">Origem</span></div>
                  <p className="text-sm font-medium text-foreground">{origemLabels[detailClient.origem as OrigemLead] ?? "—"}</p>
                </div>
                <div className="bg-card border border-border rounded p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground"><FileText size={12} /><span className="text-[10px] uppercase tracking-wider font-semibold">Status</span></div>
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${statusCrmColors[detailClient.status_crm as StatusCRM]}`}>{statusCrmLabels[detailClient.status_crm as StatusCRM]}</span>
                </div>
              </div>

              <div className="bg-card border border-border rounded p-3 space-y-3">
                <h2 className="text-xs font-semibold text-foreground">Editar Cliente</h2>
                <ClienteForm
                  nome={detailClient.nome} email={detailClient.email} telefone={detailClient.telefone}
                  endereco={detailClient.endereco} enderecoObra={detailClient.endereco_obra}
                  origem={detailClient.origem} statusCrm={detailClient.status_crm}
                  arquitetoId={detailClient.arquiteto_id} arquitetos={arquitetos ?? []}
                  notas={detailClient.notas}
                  onSave={async (payload: any) => {
                    const oldStatus = detailClient.status_crm;
                    const { error } = await supabase.from("clientes").update(payload).eq("id", detailClient.id);
                    if (error) { toast.error(error.message); return; }
                    if (payload.status_crm === "projeto" && oldStatus !== "projeto") {
                      await autoCreateProject(detailClient.id, payload.nome, payload.endereco_obra, payload.endereco, payload.arquiteto_id, payload.notas || detailClient.notas);
                    }
                    qc.invalidateQueries({ queryKey: ["clientes"] }); qc.invalidateQueries({ queryKey: ["projetos"] });
                    setDetailClient({ ...detailClient, ...payload });
                    toast.success("Cliente atualizado!");
                  }}
                />
              </div>
            </div>
          </TabsContent>

          {/* ─── ANOTAÇÕES ─── */}
          <TabsContent value="anotacoes">
            <div className="space-y-3">
              <div className="bg-card border border-border rounded p-3 space-y-2">
                <h4 className="text-xs font-semibold flex items-center gap-1"><MessageSquare size={12} /> {editIntId ? "Editar Interação" : "Nova Interação"}</h4>
                <div className="flex gap-2 items-end flex-wrap">
                  <select value={intTipo} onChange={e => setIntTipo(e.target.value)} className="h-8 px-2 text-xs bg-background border border-border rounded">
                    <option value="ligacao">Ligação</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option><option value="reuniao">Reunião</option><option value="visita">Visita</option><option value="outro">Outro</option>
                  </select>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn("h-8 px-2 text-xs bg-background border border-border rounded flex items-center gap-1 min-w-[120px]", !intData && "text-muted-foreground")}>
                        <CalendarIcon size={12} />
                        {intData ? format(intData, "dd/MM/yyyy") : "Data"}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={intData} onSelect={setIntData} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                  <input value={intDesc} onChange={e => setIntDesc(e.target.value)} placeholder="Descrição..." className="flex-1 min-w-[200px] h-8 px-2 text-xs bg-background border border-border rounded" />
                  <button onClick={() => addInteracao.mutate()} disabled={!intDesc.trim()} className="h-8 px-4 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">{editIntId ? "Salvar" : "Adicionar"}</button>
                  {editIntId && <button onClick={resetIntForm} className="h-8 px-2 rounded bg-secondary text-secondary-foreground text-xs">Cancelar</button>}
                </div>
                {intTipo === "visita" && (
                  <div className="flex gap-2 items-end flex-wrap mt-1">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Membro da Equipe</label>
                      <select value={intMembroEquipe} onChange={e => setIntMembroEquipe(e.target.value)} className="h-8 px-2 text-xs bg-background border border-border rounded min-w-[180px]">
                        <option value="">Selecione...</option>
                        {(equipeMembers ?? []).map(m => <option key={m.id} value={m.id}>{m.nome} {m.funcao ? `(${m.funcao})` : ""}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                {interacoes?.map(i => (
                  <div key={i.id} className="p-2.5 rounded bg-card border border-border text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-primary capitalize">{i.tipo}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{new Date(i.created_at).toLocaleDateString("pt-BR")} {new Date(i.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        <button onClick={() => { setEditIntId(i.id); setIntTipo(i.tipo ?? "outro"); setIntDesc(i.descricao ?? ""); }} className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={11} /></button>
                        <button onClick={() => { if (window.confirm("Excluir?")) deleteInteracao.mutate(i.id); }} className="p-0.5 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={11} /></button>
                      </div>
                    </div>
                    <p className="text-foreground mt-1">{i.descricao}</p>
                  </div>
                ))}
                {(!interacoes || interacoes.length === 0) && <p className="text-muted-foreground text-xs text-center py-4">Nenhuma interação registrada.</p>}
              </div>
            </div>
          </TabsContent>

          {/* ─── ITENS PRÉ-PROJETO (com múltiplos orçamentos) ─── */}
          <TabsContent value="itens">
            <AutoCreateOrcamento
              orcamentos={orcamentos}
              detailClientId={detailClient?.id}
              empresaId={empresaId}
              createOrcamento={createOrcamento}
              activeOrcamentoId={activeOrcamentoId}
              setActiveOrcamentoId={setActiveOrcamentoId}
              loadSimFromOrc={loadSimFromOrc}
            />
            <div className="space-y-6">

              {/* ═══════════════════════════════════════════════════════ */}
              {/* BLOCO 1 — ORÇAMENTOS                                  */}
              {/* ═══════════════════════════════════════════════════════ */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground tracking-tight">Orçamentos</h3>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                      if (activeOrcamentoId) {
                        const simData = {
                          condicao: simCondicao, formaPagamento: simFormaPgto,
                          numParcelas: simParcelas, entrada: simEntrada, entradaData: simEntradaData,
                          intervalo: simIntervalo, juros: simJuros,
                          parcelas: parcelasParaExibir,
                        };
                        await saveOrcamentoSimulacao(simData);
                        if (activeOrc?.aprovado) {
                          await syncOrcamentoToProject(activeOrcamentoId, { showToast: false });
                          qc.invalidateQueries({ queryKey: ["financeiro_receber"] });
                        }
                      }
                      toast.success("Orçamento salvo!");
                    }} disabled={!activeOrcamentoId} className="flex items-center gap-1 h-7 px-3 rounded bg-success text-white text-[11px] font-medium disabled:opacity-50 hover:brightness-105 transition">
                      <Check size={11} /> Salvar
                    </button>
                    <button onClick={async () => {
                      if (activeOrcamentoId) {
                        const simData = {
                          condicao: simCondicao, formaPagamento: simFormaPgto,
                          numParcelas: simParcelas, entrada: simEntrada, entradaData: simEntradaData,
                          intervalo: simIntervalo, juros: simJuros,
                          parcelas: parcelasParaExibir,
                        };
                        await saveOrcamentoSimulacao(simData);
                        if (activeOrc?.aprovado) {
                          await syncOrcamentoToProject(activeOrcamentoId, { showToast: false });
                        }
                        toast.success("Orçamento salvo!");
                      }
                      createOrcamento.mutate();
                    }} disabled={createOrcamento.isPending} className="flex items-center gap-1 h-7 px-2 rounded bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50">
                      <Plus size={11} /> Novo Orçamento
                    </button>
                    <button onClick={gerarPropostaPDF} className="flex items-center gap-1 h-7 px-2 rounded bg-secondary text-secondary-foreground text-[11px] font-medium hover:bg-secondary/80">
                      <Printer size={11} /> PDF
                    </button>
                  </div>
                </div>

                {orcamentos && orcamentos.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {orcamentos.map(orc => (
                      <div
                        key={orc.id}
                        onClick={() => { setActiveOrcamentoId(orc.id); loadSimFromOrc(orc); }}
                        className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${activeOrcamentoId === orc.id ? "border-primary bg-primary/5 shadow-lg shadow-primary/5" : "border-border bg-card hover:bg-secondary/20 hover:border-primary/30"} ${orc.aprovado ? "ring-1 ring-success/50" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {editingOrcNome === orc.id ? (
                              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                <input value={orcNomeInput} onChange={e => setOrcNomeInput(e.target.value)} className="h-6 px-1.5 text-xs bg-background border border-primary rounded w-32" autoFocus onKeyDown={e => { if (e.key === "Enter") renameOrcamento.mutate({ id: orc.id, nome: orcNomeInput }); if (e.key === "Escape") setEditingOrcNome(null); }} />
                                <button onClick={() => renameOrcamento.mutate({ id: orc.id, nome: orcNomeInput })} className="text-primary"><Check size={12} /></button>
                                <button onClick={() => setEditingOrcNome(null)} className="text-muted-foreground"><X size={12} /></button>
                              </div>
                            ) : (
                              <span className="text-sm font-semibold text-foreground truncate" onDoubleClick={e => { e.stopPropagation(); setEditingOrcNome(orc.id); setOrcNomeInput(orc.nome); }}>{orc.nome}</span>
                            )}
                            {editingOrcNome !== orc.id && <button onClick={e => { e.stopPropagation(); setEditingOrcNome(orc.id); setOrcNomeInput(orc.nome); }} className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-primary shrink-0"><Pencil size={11} /></button>}
                          </div>
                          {orc.aprovado && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold uppercase shrink-0">Aprovado</span>}
                        </div>
                        {orc.data_envio_proposta && (
                          <p className="text-[10px] text-muted-foreground italic mt-1">
                            Proposta enviada {formatDistanceToNow(new Date(orc.data_envio_proposta), { addSuffix: true, locale: ptBR })}
                          </p>
                        )}

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {!orc.aprovado ? (
                            <button onClick={(e) => { e.stopPropagation(); approveOrcamento.mutate(orc.id); }} className="flex items-center gap-1 h-7 px-2.5 rounded bg-success/15 text-success hover:bg-success/25 text-[11px] font-medium border border-success/30 transition">
                              <Check size={12} /> Aprovar
                            </button>
                          ) : (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); manualSync.mutate(orc.id); }} className="flex items-center gap-1 h-7 px-2 rounded bg-primary/15 text-primary hover:bg-primary/25 text-[11px] font-medium border border-primary/30 transition" title="Sincronizar com projeto">
                                <RefreshCw size={11} /> Sincronizar
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Desaprovar este orçamento? Isso cancelará o projeto vinculado e removerá dados financeiros.")) unapproveOrcamento.mutate(orc.id); }} className="flex items-center gap-1 h-7 px-2 rounded bg-warning/15 text-warning hover:bg-warning/25 text-[11px] font-medium border border-warning/30 transition" title="Desaprovar">
                                <X size={11} /> Desaprovar
                              </button>
                            </>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); duplicateOrcamento.mutate(orc.id); }} className="flex items-center gap-1 h-7 px-2 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-[11px] font-medium transition">
                            <Copy size={11} /> Duplicar
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); if (window.confirm("Excluir este orçamento? Isso cancelará o projeto vinculado.")) deleteOrcamento.mutate(orc.id); }} className="flex items-center gap-1 h-7 px-2 rounded bg-destructive/15 text-destructive hover:bg-destructive/25 text-[11px] font-medium border border-destructive/30 transition">
                            <Trash2 size={11} /> Excluir
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Criando primeiro orçamento...</p>
                )}
              </section>

              {/* ═══════════════════════════════════════════════════════ */}
              {/* RESUMO FINANCEIRO (TOPO)                               */}
              {/* ═══════════════════════════════════════════════════════ */}
              {(crmItens && crmItens.length > 0) && (
                <section>
                  <h3 className="text-sm font-bold text-foreground tracking-tight mb-3 flex items-center gap-2">
                    <DollarSign size={14} className="text-primary" />
                    Resumo Financeiro
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-card border border-border rounded-lg p-4 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{descontoCalculado > 0 ? "Total c/ Desconto" : "Total Venda"}</p>
                      <p className="text-xl font-bold text-primary">R$ {totalCrmVendaComDesconto.toFixed(2)}</p>
                      {descontoCalculado > 0 && (
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          subtotal: {totalCrmVenda.toFixed(2)} - desc: {descontoCalculado.toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Custo</p>
                      <p className="text-xl font-bold text-destructive">R$ {totalCrmCustoComExtras.toFixed(2)}</p>
                      {(orcFrete > 0 || orcImposto > 0 || totalCrmRt > 0) && (
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          itens: {totalCrmCusto.toFixed(2)}
                          {orcFrete > 0 ? ` + frete: ${orcFrete.toFixed(2)}` : ""}
                          {orcImposto > 0 ? ` + imp: ${orcImposto.toFixed(2)}` : ""}
                          {totalCrmRt > 0 ? ` + RT: ${totalCrmRt.toFixed(2)}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Lucro</p>
                      <p className="text-xl font-bold text-success">R$ {(totalCrmVendaComDesconto - totalCrmCustoComExtras).toFixed(2)}</p>
                    </div>
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Margem</p>
                      <p className="text-xl font-bold text-success">{totalCrmVendaComDesconto > 0 ? (((totalCrmVendaComDesconto - totalCrmCustoComExtras) / totalCrmVendaComDesconto) * 100).toFixed(1) : "0.0"}%</p>
                    </div>
                    <div className="bg-card border border-border rounded-lg p-4 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total RT</p>
                      <p className="text-xl font-bold text-warning">R$ {totalCrmRt.toFixed(2)}</p>
                      {totalCrmRt > 0 && (() => {
                        const itensComRt = (crmItens ?? []).filter((i: any) => (Number(i.rt_comissao) || 0) > 0);
                        const rtPagoAtual = itensComRt.reduce((s: number, i: any) => {
                          const t = Number(i.rt_comissao) || 0;
                          return s + Math.min(Math.max(Number(i.rt_valor_pago) || 0, 0), t);
                        }, 0);
                        const rtPendenteAtual = Math.max(totalCrmRt - rtPagoAtual, 0);
                        return (
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Pago</span>
                              <input
                                key={`rt-pago-${rtPagoAtual}`}
                                type="number"
                                step="0.01"
                                min={0}
                                max={totalCrmRt}
                                defaultValue={rtPagoAtual}
                                onBlur={async (e) => {
                                  const novoTotalPago = Math.min(Math.max(Number(e.target.value) || 0, 0), totalCrmRt);
                                  if (Math.abs(novoTotalPago - rtPagoAtual) < 0.005) return;
                                  // Distribute proportionally across items with RT
                                  let restante = novoTotalPago;
                                  const updates = itensComRt.map((it: any, idx: number) => {
                                    const t = Number(it.rt_comissao) || 0;
                                    let pago: number;
                                    if (idx === itensComRt.length - 1) {
                                      pago = Math.min(Math.max(restante, 0), t);
                                    } else {
                                      const share = totalCrmRt > 0 ? (t / totalCrmRt) * novoTotalPago : 0;
                                      pago = Math.min(Math.max(share, 0), t);
                                      restante -= pago;
                                    }
                                    return { id: it.id, rt_valor_pago: Number(pago.toFixed(2)) };
                                  });
                                  const results = await Promise.all(
                                    updates.map(u => supabase.from("crm_itens").update({ rt_valor_pago: u.rt_valor_pago } as any).eq("id", u.id))
                                  );
                                  if (results.some(r => r.error)) { toast.error("Erro ao atualizar RT pago"); return; }
                                  refetchCrmItens();
                                }}
                                className="w-24 h-6 px-1.5 text-[11px] text-right bg-background border border-border/60 rounded focus:outline-none focus:border-primary"
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">Pendente: <span className="text-warning font-semibold">R$ {rtPendenteAtual.toFixed(2)}</span></p>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </section>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* FORMULÁRIO NOVO ITEM                                   */}
              {/* ═══════════════════════════════════════════════════════ */}
              <section>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5 text-foreground"><Package size={13} /> {editItemId ? "Editar Item" : "Novo Item"}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</label>
                      <select value={itemTipo} onChange={e => setItemTipo(e.target.value as "produto" | "servico" | "adicional")} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none">
                        <option value="produto">Produto</option>
                        <option value="servico">Serviço</option>
                        <option value="adicional">Adicional</option>
                      </select>
                    </div>
                    <div className="col-span-2 md:col-span-1 space-y-0.5 relative">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Descrição *</label>
                      <input
                        value={itemDesc}
                        onChange={e => { setItemDesc(e.target.value); setItemProdutoId(null); setShowItemSuggestions(itemTipo === "produto" && e.target.value.length > 0); }}
                        onFocus={() => { if (itemTipo === "produto" && itemDesc.length > 0) setShowItemSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowItemSuggestions(false), 200)}
                        placeholder={itemTipo === "produto" ? "Digite ou busque um produto" : "Descrição do item"}
                        className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none"
                      />
                      {showItemSuggestions && filteredProdutosCrm.length > 0 && (
                        <div className="absolute z-20 w-full bg-card border border-border rounded shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {filteredProdutosCrm.slice(0, 10).map(p => (
                            <button
                              key={p.id}
                              onMouseDown={() => {
                                setItemDesc(p.nome);
                                setItemCusto(p.preco_custo ?? 0);
                                setItemVenda(p.preco_venda ?? 0);
                                setItemProdutoId(p.id);
                                setShowItemSuggestions(false);
                                if (!editItemId && arquitetoRtPercentual > 0) {
                                  setItemRt(Number((((p.preco_venda ?? 0) * itemQtd * arquitetoRtPercentual) / 100).toFixed(2)));
                                }
                              }}
                              className="w-full text-left px-2 py-1.5 text-xs hover:bg-secondary/50 flex justify-between items-center border-b border-border last:border-b-0"
                            >
                              <span className="font-medium">{p.nome}</span>
                              <span className="text-muted-foreground ml-2 whitespace-nowrap">C: R$ {(p.preco_custo ?? 0).toLocaleString("pt-BR")} | V: R$ {(p.preco_venda ?? 0).toLocaleString("pt-BR")}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quantidade</label>
                      <input type="number" value={itemQtd} onChange={e => handleItemQtdChange(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" min={1} />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Custo (R$)</label>
                      <input type="number" value={itemCusto} onChange={e => setItemCusto(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" step="0.01" />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Venda (R$)</label>
                      <input type="number" value={itemVenda} onChange={e => handleItemVendaChange(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" step="0.01" />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">RT/Comissão {arquitetoRtPercentual > 0 ? `(arq. ${arquitetoRtPercentual}%)` : ""}</label>
                      <div className="flex gap-1">
                        <select
                          value={itemRtTipo}
                          onChange={e => handleItemRtTipoChange(e.target.value as "valor" | "percentual")}
                          className="h-8 px-1.5 text-xs bg-background border border-border rounded shrink-0"
                          title="Tipo de RT"
                        >
                          <option value="valor">R$</option>
                          <option value="percentual">%</option>
                        </select>
                        {itemRtTipo === "percentual" ? (
                          <input
                            type="number"
                            value={itemRtPercentual}
                            onChange={e => handleItemRtPercentualChange(Number(e.target.value))}
                            className="w-full h-8 px-2 text-xs bg-background border border-border rounded"
                            step="0.01"
                            min={0}
                            placeholder="%"
                          />
                        ) : (
                          <input
                            type="number"
                            value={itemRt}
                            onChange={e => setItemRt(Number(e.target.value))}
                            className="w-full h-8 px-2 text-xs bg-background border border-border rounded"
                            step="0.01"
                            min={0}
                          />
                        )}
                      </div>
                      {itemRtTipo === "percentual" && (
                        <div className="text-[10px] text-muted-foreground">= R$ {itemRt.toFixed(2)}</div>
                      )}
                    </div>
                    <div className="flex gap-1 items-end">
                      <button onClick={() => saveCrmItem.mutate()} disabled={!itemDesc.trim()} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">{editItemId ? "Salvar" : "Adicionar"}</button>
                      {editItemId && <button onClick={resetItemForm} className="h-8 px-2 rounded bg-secondary text-secondary-foreground text-xs">Cancelar</button>}
                    </div>
                  </div>
                </div>
              </section>

              {/* ═══════════════════════════════════════════════════════ */}
              {/* PRODUTOS                                               */}
              {/* ═══════════════════════════════════════════════════════ */}
              {(() => {
                const produtos = (crmItens ?? []).filter(i => (i as any).tipo !== "servico" && (i as any).tipo !== "adicional");
                const servicos = (crmItens ?? []).filter(i => (i as any).tipo === "servico");
                const adicionais = (crmItens ?? []).filter(i => (i as any).tipo === "adicional");

                const SortIcon = ({ colKey }: { colKey: string }) => {
                  if (sortConfig?.key !== colKey) return <ArrowUpDown size={10} className="ml-0.5 opacity-40" />;
                  return sortConfig.dir === "asc" ? <ArrowUp size={10} className="ml-0.5 text-primary" /> : <ArrowDown size={10} className="ml-0.5 text-primary" />;
                };

                const SortableHeader = ({ colKey, label, className }: { colKey: string; label: string; className?: string }) => (
                  <th className={`px-3 py-2.5 font-semibold text-foreground/80 cursor-pointer select-none hover:text-primary transition-colors ${className ?? ""}`} onClick={() => handleSortToggle(colKey)}>
                    <span className="inline-flex items-center gap-0.5">{label}<SortIcon colKey={colKey} /></span>
                  </th>
                );

                const InlineCell = ({ item, field, type, align }: { item: any; field: string; type: "text" | "number"; align?: string }) => {
                  const isEditing = inlineEdit?.id === item.id && inlineEdit?.field === field;
                  const value = field === "rt_comissao" ? (item as any).rt_comissao : item[field];
                  if (isEditing) {
                    return (
                      <td className={`px-1 py-1 ${align ?? ""}`}>
                        <div className="relative">
                          <input
                            type={type}
                            value={inlineValue}
                            onChange={e => setInlineValue(e.target.value)}
                            onBlur={saveInlineEdit}
                            onKeyDown={e => { if (e.key === "Enter") saveInlineEdit(); if (e.key === "Escape") setInlineEdit(null); }}
                            autoFocus
                            step={type === "number" ? "0.01" : undefined}
                            min={type === "number" ? 0 : undefined}
                            className="w-full h-7 px-1.5 text-xs bg-background border-2 border-primary rounded focus:outline-none ring-2 ring-primary/20"
                          />
                          {inlineSaving && <Loader2 size={12} className="absolute right-1.5 top-1.5 animate-spin text-primary" />}
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td
                      className={`px-3 py-2 cursor-pointer hover:bg-primary/5 rounded transition-colors group ${align ?? ""}`}
                      onClick={() => startInlineEdit(item.id, field, value)}
                      title="Clique para editar"
                    >
                      <span className="inline-flex items-center gap-1">
                        {type === "number" ? `R$ ${Number(value ?? 0).toFixed(2)}` : (field === "quantidade" ? Number(value) : String(value ?? ""))}
                        <Pencil size={9} className="opacity-0 group-hover:opacity-40 text-muted-foreground shrink-0" />
                      </span>
                    </td>
                  );
                };

                const renderItemTable = (items: any[], title: string, icon: React.ReactNode, badgeClass: string) => {
                  if (!items || items.length === 0) return null;
                  const sorted = sortItems(items);
                  return (
                    <section>
                      <h3 className="text-sm font-bold text-foreground tracking-tight mb-3 flex items-center gap-2">
                        {icon}
                        {title}
                        <span className="text-[10px] font-normal text-muted-foreground ml-1">({items.length} {items.length === 1 ? "item" : "itens"})</span>
                      </h3>
                      <div className="rounded-lg overflow-hidden border border-border/60 bg-card">
                        <table className="w-full text-xs table-fixed">
                          <colgroup>
                            <col style={{ width: "32%" }} />
                            <col style={{ width: "7%" }} />
                            <col style={{ width: "11%" }} />
                            <col style={{ width: "11%" }} />
                            <col style={{ width: "11%" }} />
                            <col style={{ width: "12%" }} />
                            {(title === "Produtos" || title === "Serviços") && <col style={{ width: "10%" }} />}
                            <col style={{ width: "6%" }} />
                          </colgroup>
                          <thead><tr className="bg-secondary/40">
                            <SortableHeader colKey="descricao" label="Descrição" className="text-left" />
                            <SortableHeader colKey="quantidade" label="Qtd" className="text-center" />
                            <SortableHeader colKey="preco_custo" label="Custo" className="text-right" />
                            <SortableHeader colKey="preco_venda" label="Venda" className="text-right" />
                            <SortableHeader colKey="rt_comissao" label="RT" className="text-right" />
                            <th className="text-right px-3 py-2.5 font-semibold text-foreground/80">Subtotal</th>
                            {(title === "Produtos" || title === "Serviços") && <th className="text-center px-3 py-2.5 font-semibold text-foreground/80">Status</th>}
                            <th className="text-center px-3 py-2.5 font-semibold text-foreground/80 w-16">Ações</th>
                          </tr></thead>
                          <tbody>
                            {sorted.map((item: any) => (
                              <tr key={item.id} className="border-t border-border/40 hover:bg-secondary/20 transition-colors">
                                <InlineCell item={item} field="descricao" type="text" />
                                <InlineCell item={item} field="quantidade" type="number" align="text-center" />
                                <InlineCell item={item} field="preco_custo" type="number" align="text-right" />
                                <InlineCell item={item} field="preco_venda" type="number" align="text-right" />
                                {(() => {
                                  const rtTotal = Number((item as any).rt_comissao ?? 0);
                                  const isPerc = ((item as any).rt_tipo ?? "valor") === "percentual";
                                  const rtField = isPerc ? "rt_percentual" : "rt_comissao";
                                  const isEditingRt = inlineEdit?.id === item.id && (inlineEdit?.field === "rt_comissao" || inlineEdit?.field === "rt_percentual");
                                  if (isEditingRt) {
                                    return (
                                      <td className="px-1 py-1 text-right">
                                        <div className="flex items-center gap-1 justify-end">
                                          <select
                                            value={isPerc ? "percentual" : "valor"}
                                            onChange={async (e) => {
                                              const novoTipo = e.target.value;
                                              await supabase.from("crm_itens").update({ rt_tipo: novoTipo } as any).eq("id", item.id);
                                              setInlineEdit({ id: item.id, field: novoTipo === "percentual" ? "rt_percentual" : "rt_comissao" });
                                              setInlineValue(String(novoTipo === "percentual" ? (Number((item as any).rt_percentual) || 0) : (Number((item as any).rt_comissao) || 0)));
                                              refetchCrmItens();
                                            }}
                                            className="h-7 px-1 text-[10px] bg-background border border-primary rounded focus:outline-none"
                                            onMouseDown={e => e.stopPropagation()}
                                          >
                                            <option value="valor">R$</option>
                                            <option value="percentual">%</option>
                                          </select>
                                          <input
                                            type="number"
                                            value={inlineValue}
                                            onChange={e => setInlineValue(e.target.value)}
                                            onBlur={saveInlineEdit}
                                            onKeyDown={e => { if (e.key === "Enter") saveInlineEdit(); if (e.key === "Escape") setInlineEdit(null); }}
                                            autoFocus
                                            step="0.01"
                                            min={0}
                                            className="w-16 h-7 px-1.5 text-xs bg-background border-2 border-primary rounded focus:outline-none ring-2 ring-primary/20 text-right"
                                          />
                                          {inlineSaving && <Loader2 size={12} className="animate-spin text-primary" />}
                                        </div>
                                      </td>
                                    );
                                  }
                                  return (
                                    <td
                                      className="px-3 py-2 text-right cursor-pointer hover:bg-primary/5 group transition-colors"
                                      onClick={() => startInlineEdit(item.id, rtField, isPerc ? Number((item as any).rt_percentual ?? 0) : rtTotal)}
                                      title="Clique para editar RT"
                                    >
                                      {isPerc ? (
                                        <span className="inline-flex flex-col items-end">
                                          <span className="font-semibold inline-flex items-center gap-1">
                                            {Number((item as any).rt_percentual ?? 0)}%
                                            <Pencil size={9} className="opacity-0 group-hover:opacity-40 text-muted-foreground" />
                                          </span>
                                          <span className="text-[10px] text-muted-foreground">R$ {rtTotal.toFixed(2)}</span>
                                        </span>
                                      ) : (
                                        <span className="font-semibold inline-flex items-center gap-1">
                                          R$ {rtTotal.toFixed(2)}
                                          <Pencil size={9} className="opacity-0 group-hover:opacity-40 text-muted-foreground" />
                                        </span>
                                      )}
                                    </td>
                                  );
                                })()}
                                <td className="px-3 py-2 text-right font-semibold">R$ {(Number(item.preco_venda) * Number(item.quantidade)).toFixed(2)}</td>
                                {(title === "Produtos" || title === "Serviços") && (
                                  <td className="px-2 py-1.5 text-center">
                                    <select
                                      value={(item as any).status_compra ?? "pendente"}
                                      onChange={async (e) => {
                                        const novo = e.target.value;
                                        const { error } = await supabase.from("crm_itens").update({ status_compra: novo } as any).eq("id", item.id);
                                        if (error) { toast.error("Erro ao atualizar status"); return; }
                                        refetchCrmItens();
                                      }}
                                      className={`h-7 px-1.5 text-[11px] rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary ${
                                        ((item as any).status_compra ?? "pendente") === "comprado"
                                          ? "border-success/50 text-success"
                                          : ((item as any).status_compra ?? "pendente") === "pago"
                                          ? "border-primary/50 text-primary"
                                          : "border-warning/50 text-warning"
                                      }`}
                                    >
                                      <option value="pendente">Pendente</option>
                                      <option value="comprado">Comprado</option>
                                      {title === "Serviços" && <option value="pago">Pago</option>}
                                    </select>
                                  </td>
                                )}
                                <td className="px-3 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => { setEditItemId(item.id); setItemDesc(item.descricao); setItemQtd(Number(item.quantidade)); setItemCusto(Number(item.preco_custo)); setItemVenda(Number(item.preco_venda)); setItemRt(Number((item as any).rt_comissao ?? 0)); setItemRtTipo(((item as any).rt_tipo ?? "valor") as "valor" | "percentual"); setItemRtPercentual(Number((item as any).rt_percentual ?? 0)); setItemTipo((item as any).tipo ?? "produto"); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary" title="Editar no formulário"><Pencil size={12} /></button>
                                    <button onClick={() => { if (window.confirm("Excluir item?")) deleteCrmItem.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            <tr className="border-t-2 border-border bg-secondary/20">
                              <td className="px-3 py-2 font-semibold text-foreground/80">Subtotal</td>
                              <td className="px-3 py-2 text-center font-semibold">{items.reduce((s: number, i: any) => s + (Number(i.quantidade) || 0), 0)}</td>
                              <td className="px-3 py-2 text-right font-semibold">R$ {items.reduce((s: number, i: any) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-semibold">R$ {items.reduce((s: number, i: any) => s + (Number(i.preco_venda) || 0) * (Number(i.quantidade) || 1), 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-semibold">R$ {items.reduce((s: number, i: any) => s + (Number((i as any).rt_comissao) || 0), 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-bold text-primary">R$ {items.reduce((s: number, i: any) => s + (Number(i.preco_venda) || 0) * (Number(i.quantidade) || 1), 0).toFixed(2)}</td>
                              {(title === "Produtos" || title === "Serviços") && <td></td>}
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                };

                return (
                  <>
                    {renderItemTable(
                      produtos as any,
                      "Produtos",
                      <Package size={14} className="text-emerald-500" />,
                      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    )}
                    {renderItemTable(
                      servicos as any,
                      "Serviços",
                      <FileText size={14} className="text-blue-500" />,
                      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    )}
                    {renderItemTable(
                      adicionais as any,
                      "Adicionais",
                      <PlusCircle size={14} className="text-amber-500" />,
                      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    )}
                  </>
                );
              })()}

              {(!crmItens || crmItens.length === 0) && <p className="text-muted-foreground text-xs text-center py-6">Nenhum item adicionado{activeOrcamentoId ? " neste orçamento" : ""}.</p>}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* FRETES DO PROJETO (lista leve, múltiplos, sem status) */}
              {/* ═══════════════════════════════════════════════════════ */}
              {activeOrcamentoId && (
                <section>
                  <h3 className="text-xs font-bold text-foreground tracking-tight mb-2 flex items-center gap-2">
                    <Calculator size={13} className="text-warning" />
                    Fretes do Projeto
                  </h3>
                  <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 space-y-2">
                    {/* Frete principal (legacy / compatibilidade) */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Transportadora</label>
                        <select value={orcFreteTipo} onChange={e => { setOrcFreteTipo(e.target.value); if (e.target.value !== "outro") setOrcFreteOutro(""); }} className="w-full h-7 px-2 text-xs bg-background border border-border rounded">
                          <option value="">Selecione...</option>
                          {(transportadoras ?? []).map((t: any) => (
                            <option key={t.id} value={`${t.nome} (${t.tipo})`}>{t.nome} ({t.tipo})</option>
                          ))}
                          <option value="outro">Outro</option>
                        </select>
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Frete (R$)</label>
                        <input type="number" value={orcFrete} onChange={e => setOrcFrete(Number(e.target.value))} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" step="0.01" min={0} />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Venc. Frete</label>
                        <input type="date" value={orcFreteVencimento} onChange={e => setOrcFreteVencimento(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" />
                      </div>
                    </div>
                    {orcFreteTipo === "outro" && (
                      <div className="max-w-[200px]">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Qual?</label>
                        <input type="text" value={orcFreteOutro} onChange={e => setOrcFreteOutro(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" placeholder="Digite..." />
                      </div>
                    )}
                    {/* ── Múltiplos fretes adicionais ── */}
                    <div className="pt-2 mt-1 border-t border-warning/20 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fretes adicionais</span>
                        <button
                          type="button"
                          onClick={() => setFretesExtras(prev => [...prev, { id: crypto.randomUUID(), descricao: "", transportadora: "", valor: 0, vencimento: "" }])}
                          className="text-[10px] font-semibold text-warning hover:underline flex items-center gap-1"
                        >
                          <Plus size={11} /> Adicionar frete
                        </button>
                      </div>
                      {fretesExtras.length > 0 && (
                        <div className="space-y-1">
                          {fretesExtras.map((f, idx) => (
                            <div key={f.id} className="grid grid-cols-[1.4fr_1.2fr_0.8fr_0.9fr_auto] gap-1.5 items-center">
                              <input
                                type="text"
                                value={f.descricao}
                                placeholder="Descrição (ex: Frete rack servidor)"
                                onChange={e => setFretesExtras(prev => prev.map((x, i) => i === idx ? { ...x, descricao: e.target.value } : x))}
                                className="h-7 px-2 text-xs bg-background border border-border rounded"
                              />
                              <select
                                value={f.transportadora}
                                onChange={e => setFretesExtras(prev => prev.map((x, i) => i === idx ? { ...x, transportadora: e.target.value } : x))}
                                className="h-7 px-2 text-xs bg-background border border-border rounded"
                              >
                                <option value="">Transportadora...</option>
                                {(transportadoras ?? []).map((t: any) => (
                                  <option key={t.id} value={`${t.nome} (${t.tipo})`}>{t.nome} ({t.tipo})</option>
                                ))}
                              </select>
                              <input
                                type="number" step="0.01" min={0}
                                value={f.valor || ""}
                                placeholder="Valor"
                                onChange={e => setFretesExtras(prev => prev.map((x, i) => i === idx ? { ...x, valor: Number(e.target.value) || 0 } : x))}
                                className="h-7 px-2 text-xs bg-background border border-border rounded"
                              />
                              <input
                                type="date"
                                value={f.vencimento}
                                onChange={e => setFretesExtras(prev => prev.map((x, i) => i === idx ? { ...x, vencimento: e.target.value } : x))}
                                className="h-7 px-2 text-xs bg-background border border-border rounded"
                              />
                              <button
                                type="button"
                                onClick={() => setFretesExtras(prev => prev.filter((_, i) => i !== idx))}
                                className="h-7 w-7 flex items-center justify-center text-destructive hover:bg-destructive/10 rounded"
                                title="Remover"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          <div className="flex items-center gap-4 pt-1 text-[11px]">
                            <span className="text-foreground"><span className="text-muted-foreground">Previsto:</span> <strong>R$ {fretePrevisto.toFixed(2)}</strong></span>
                            <span className="text-success"><span className="text-muted-foreground">Realizado:</span> <strong>R$ {freteRealizado.toFixed(2)}</strong></span>
                            <span className="text-warning"><span className="text-muted-foreground">Falta pagar:</span> <strong>R$ {fretePendente.toFixed(2)}</strong></span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* IMPOSTOS DO PROJETO (separado do frete)                */}
              {/* ═══════════════════════════════════════════════════════ */}
              {activeOrcamentoId && (
                <section>
                  <h3 className="text-xs font-bold text-foreground tracking-tight mb-2 flex items-center gap-2">
                    <DollarSign size={13} className="text-primary" />
                    Impostos do Projeto
                  </h3>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo (opcional)</label>
                        <input type="text" value={orcFreteOutro && orcFreteTipo === "imposto-tipo" ? orcFreteOutro : ""} placeholder="Ex: ISS, ICMS..." readOnly className="w-full h-7 px-2 text-xs bg-background/50 border border-border rounded text-muted-foreground" />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Valor (R$)</label>
                        <input type="number" value={orcImposto} onChange={e => setOrcImposto(Number(e.target.value))} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" step="0.01" min={0} />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Vencimento</label>
                        <input type="date" value={orcImpostoVencimento} onChange={e => setOrcImpostoVencimento(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* RESUMO COMPRAS (Produtos + Serviços + Fretes)         */}
              {/* ═══════════════════════════════════════════════════════ */}
              {activeOrcamentoId && crmItens && crmItens.length > 0 && (() => {
                const allProdutos = (crmItens ?? []).filter((i: any) => i.tipo !== "servico" && i.tipo !== "adicional");
                const allServicos = (crmItens ?? []).filter((i: any) => i.tipo === "servico");
                // Cost-based valuation — item cost only (RT handled separately below)
                const custoItem = (i: any) => (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1);

                const produtosCompradoCusto = allProdutos.filter((i: any) => (i.status_compra ?? "pendente") === "comprado").reduce((s, i) => s + custoItem(i), 0);
                const produtosPendenteCusto = allProdutos.filter((i: any) => (i.status_compra ?? "pendente") === "pendente").reduce((s, i) => s + custoItem(i), 0);

                const servicosCompradoCusto = allServicos.filter((i: any) => ["comprado", "pago"].includes(i.status_compra ?? "pendente")).reduce((s, i) => s + custoItem(i), 0);
                const servicosPendenteCusto = allServicos.filter((i: any) => (i.status_compra ?? "pendente") === "pendente").reduce((s, i) => s + custoItem(i), 0);

                const impostoValor = Number(orcImposto) || 0;

                // Imposto efetivamente PAGO — vindo do Contas a Pagar vinculado ao projeto deste orçamento
                const projetoVinculadoId = (clienteProjetos ?? []).find((p: any) => p.orcamento_id === activeOrcamentoId)?.id;
                const contasProjeto = (contasFreteImposto ?? []).filter((c: any) => c.projeto_id === projetoVinculadoId);
                const impostoPagoValor = contasProjeto
                  .filter((c: any) => c.status === "pago" && String(c.descricao || "").startsWith("Imposto"))
                  .reduce((s: number, c: any) => s + (Number(c.valor) || 0), 0);

                // RT — total (custo) vs pago (realizado). Capped per item so paid never exceeds total.
                const rtTotal = (crmItens ?? []).reduce((s: number, i: any) => s + (Number(i.rt_comissao) || 0), 0);
                const rtPago = (crmItens ?? []).reduce((s: number, i: any) => {
                  const t = Number(i.rt_comissao) || 0;
                  return s + Math.min(Math.max(Number(i.rt_valor_pago) || 0, 0), t);
                }, 0);
                const rtPendente = Math.max(rtTotal - rtPago, 0);

                // TOTAL CUSTO DO PROJETO = itens (comprados + pendentes) + FRETE PREVISTO + imposto + RT total
                const totalCusto =
                  produtosCompradoCusto + produtosPendenteCusto +
                  servicosCompradoCusto + servicosPendenteCusto +
                  fretePrevisto + impostoValor + rtTotal;

                // TOTAL COMPRADO = itens comprados/pagos + FRETE REALIZADO (lançamentos) + IMPOSTO PAGO + RT PAGA
                const totalComprado =
                  produtosCompradoCusto +
                  servicosCompradoCusto +
                  freteRealizado +
                  impostoPagoValor +
                  rtPago;

                // FALTA COMPRAR = pendentes + RT pendente
                const totalPendente = Math.max(totalCusto - totalComprado, 0);
                const pct = totalCusto > 0 ? (totalComprado / totalCusto) * 100 : 0;

                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border/60 bg-card px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Total custo do projeto</div>
                      <div className="text-sm font-bold text-foreground">R$ {totalCusto.toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-success">Total comprado ({pct.toFixed(0)}%)</div>
                      <div className="text-sm font-bold text-success">R$ {totalComprado.toFixed(2)}</div>
                    </div>
                    <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-warning">Falta comprar</div>
                      <div className="text-sm font-bold text-warning">R$ {totalPendente.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })()}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* DESCONTO                                                */}
              {/* ═══════════════════════════════════════════════════════ */}
              {activeOrcamentoId && (
                <section>
                  <h3 className="text-xs font-bold text-foreground tracking-tight mb-2 flex items-center gap-2">
                    <DollarSign size={13} className="text-destructive" />
                    Desconto
                  </h3>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <div className="space-y-0.5 w-36">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</label>
                        <select value={orcDescontoTipo} onChange={e => { setOrcDescontoTipo(e.target.value as any); setOrcDescontoValor(0); }} className="w-full h-7 px-2 text-xs bg-background border border-border rounded">
                          <option value="fixo">Valor Fixo (R$)</option>
                          <option value="percentual">Percentual (%)</option>
                        </select>
                      </div>
                      <div className="space-y-0.5 w-32">
                        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{orcDescontoTipo === "percentual" ? "% Desconto" : "Valor (R$)"}</label>
                        <input type="number" value={orcDescontoValor || ""} onChange={e => { let v = Number(e.target.value) || 0; if (orcDescontoTipo === "percentual") v = Math.min(Math.max(v, 0), 100); else v = Math.min(Math.max(v, 0), subtotalOrcamento); setOrcDescontoValor(v); }} step="0.01" min={0} max={orcDescontoTipo === "percentual" ? 100 : subtotalOrcamento} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" placeholder={orcDescontoTipo === "percentual" ? "0 a 100" : "0.00"} />
                      </div>
                      {descontoCalculado > 0 && (
                        <div className="flex items-center gap-3 ml-auto text-[11px]">
                          <span className="text-destructive font-semibold">- R$ {descontoCalculado.toFixed(2)}{orcDescontoTipo === "percentual" && ` (${orcDescontoValor}%)`}</span>
                          <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">Final: R$ {totalCrmVendaComDesconto.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {activeOrcamentoId && (
                <section>
                  <h3 className="text-xs font-bold text-foreground tracking-tight mb-2 flex items-center gap-2">
                    <Calculator size={13} className="text-primary" />
                    Condições de Pagamento
                    <span className="text-[10px] text-muted-foreground font-normal">— {activeOrc?.nome}</span>
                  </h3>
                  <div className="bg-secondary/20 border border-border rounded-lg p-3 space-y-3">
                    <p className="text-[9px] text-muted-foreground">Ao aprovar, as parcelas serão geradas automaticamente no financeiro.</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Condição</label>
                        <select value={simCondicao} onChange={e => { setSimCondicao(e.target.value as any); if (e.target.value === "avista") setSimParcelas(1); setEditingParcelas(null); }} className="w-full h-7 px-2 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none"><option value="avista">À Vista</option><option value="parcelado">Parcelado</option></select></div>
                      {simCondicao === "avista" && (
                        <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Data Pgto. à Vista</label>
                          <input type="date" value={orcDataPgtoAvista} onChange={e => setOrcDataPgtoAvista(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none" /></div>
                      )}
                      <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Forma Pgto.</label>
                        <select value={simFormaPgto} onChange={e => setSimFormaPgto(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded"><option value="boleto">Boleto</option><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="cheque">Cheque</option></select></div>
                      {simCondicao === "parcelado" && (<>
                        <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nº Parcelas</label><input type="number" value={simParcelas} onChange={e => { setSimParcelas(Math.max(1, Number(e.target.value))); setEditingParcelas(null); }} min={1} max={60} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
                      </>)}
                    </div>
                    {simCondicao === "parcelado" && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Entrada (R$)</label><input type="number" value={simEntrada} onChange={e => { setSimEntrada(Math.max(0, Number(e.target.value))); setEditingParcelas(null); }} step="0.01" min={0} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
                        <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Intervalo (dias)</label><input type="number" value={simIntervalo} onChange={e => { setSimIntervalo(Math.max(1, Number(e.target.value))); setEditingParcelas(null); }} min={1} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
                        <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Juros % (opc.)</label><input type="number" value={simJuros} onChange={e => { setSimJuros(Math.max(0, Number(e.target.value))); setEditingParcelas(null); }} step="0.01" min={0} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
                      </div>
                    )}

                    {/* Resumo financeiro compacto */}
                    <div className={`flex items-center gap-2 flex-wrap pt-1 border-t border-border/50`}>
                      <div className="bg-primary/10 border border-primary/20 rounded px-3 py-1.5 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">TOTAL VENDA</p>
                        <p className="text-base font-bold text-primary">R$ {simulacao.total.toFixed(2)}</p>
                      </div>
                      {simCondicao === "parcelado" && (<>
                        <div className="bg-card border border-border rounded px-3 py-1.5 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase">Entrada</p>
                          <p className="text-sm font-bold text-foreground">R$ {simulacao.entrada.toFixed(2)}</p>
                        </div>
                        <div className="bg-card border border-border rounded px-3 py-1.5 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase">Parcela</p>
                          <p className="text-sm font-bold text-foreground">{simParcelas}x R$ {simulacao.valorParcela.toFixed(2)}</p>
                        </div>
                        <div className="bg-primary/10 border border-primary/20 rounded px-3 py-1.5 text-center ml-auto">
                          <p className="text-[9px] text-muted-foreground uppercase">Total Final</p>
                          <p className="text-base font-bold text-primary">R$ {simulacao.totalFinal.toFixed(2)}</p>
                        </div>
                      </>)}
                    </div>

                    {/* Tabela de parcelas */}
                    {parcelasParaExibir.length > 0 && (
                      <div className="rounded-lg overflow-hidden border border-border/40 max-h-[180px] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead><tr className="bg-secondary/30"><th className="text-center px-2 py-1.5 font-semibold text-foreground/80">Parcela</th><th className="text-right px-2 py-1.5 font-semibold text-foreground/80">Valor</th><th className="text-center px-2 py-1.5 font-semibold text-foreground/80">Data Prevista</th></tr></thead>
                          <tbody>
                            {simulacao.entrada > 0 && (<tr className="border-t border-border/30 bg-primary/5"><td className="px-2 py-1.5 text-center font-medium">Entrada</td><td className="px-2 py-1.5 text-right font-semibold">R$ {simulacao.entrada.toFixed(2)}</td><td className="px-2 py-1.5 text-center"><input type="text" value={simEntradaData} onChange={e => setSimEntradaData(e.target.value)} className="w-28 h-6 px-1.5 text-xs text-center bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none" placeholder="dd/mm/aaaa" /></td></tr>)}
                            {parcelasParaExibir.map((p, idx) => (
                              <tr key={p.numero} className="border-t border-border/30">
                                <td className="px-2 py-1 text-center">{p.numero}/{simParcelas}</td>
                                <td className="px-2 py-1 text-right"><input type="number" value={p.valor.toFixed(2)} onChange={e => handleEditParcela(idx, "valor", e.target.value)} className="w-24 h-6 px-1.5 text-xs text-right bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none" step="0.01" /></td>
                                <td className="px-2 py-1 text-center"><input type="text" value={p.data} onChange={e => handleEditParcela(idx, "data", e.target.value)} className="w-28 h-6 px-1.5 text-xs text-center bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none" placeholder="dd/mm/aaaa" /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* ═══════════════════════════════════════════════════════ */}
              {/* BOTÃO SALVAR FIXO (RODAPÉ)                             */}
              {/* ═══════════════════════════════════════════════════════ */}
              {activeOrcamentoId && (
                <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border py-3 -mx-1 px-1 z-10">
                  <button onClick={async () => {
                    if (activeOrcamentoId) {
                      const simData = {
                        condicao: simCondicao, formaPagamento: simFormaPgto,
                        numParcelas: simParcelas, entrada: simEntrada, entradaData: simEntradaData,
                        intervalo: simIntervalo, juros: simJuros,
                        parcelas: parcelasParaExibir,
                        descontoTipo: orcDescontoTipo, descontoValor: orcDescontoValor,
                      };
                      await saveOrcamentoSimulacao(simData);
                      if (activeOrc?.aprovado) {
                        await syncOrcamentoToProject(activeOrcamentoId, { showToast: false });
                        qc.invalidateQueries({ queryKey: ["financeiro_receber"] });
                        qc.invalidateQueries({ queryKey: ["projetos"] });
                        qc.invalidateQueries({ queryKey: ["cliente_projetos"] });
                        qc.invalidateQueries({ queryKey: ["financeiro_pagar"] });
                        qc.invalidateQueries({ queryKey: ["comissoes"] });
                        qc.invalidateQueries({ queryKey: ["compras"] });
                      }
                    }
                    toast.success("Orçamento salvo!");
                  }} className="w-full h-10 rounded-lg bg-success text-white text-sm font-semibold hover:brightness-105 transition flex items-center justify-center gap-2">
                    <Check size={16} /> Salvar Orçamento
                  </button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ─── IMAGENS ─── */}
          <TabsContent value="imagens">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold flex items-center gap-1"><Image size={12} /> Imagens</h4>
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => { if (e.target.files) { setUploadTipo("imagem"); Array.from(e.target.files).forEach(f => uploadFile.mutate(f)); } }} />
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium"><Upload size={12} /> Enviar Imagem</button>
                </div>
              </div>
              {imagens.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {imagens.map((img, idx) => (
                    <div key={img.id} className="relative group border border-border rounded overflow-hidden bg-card cursor-pointer" onClick={() => { setLightboxIndex(idx); setLightboxZoom(1); }}>
                      <img src={(img as any).url} alt={(img as any).nome_arquivo} className="w-full h-32 object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                        <button onClick={e => { e.stopPropagation(); setLightboxIndex(idx); setLightboxZoom(1); }} className="p-1.5 rounded bg-white/90 text-foreground hover:bg-white"><Eye size={14} /></button>
                        <a href={(img as any).url} target="_blank" download className="p-1.5 rounded bg-white/90 text-foreground hover:bg-white" onClick={e => e.stopPropagation()}><Download size={14} /></a>
                        <button onClick={e => { e.stopPropagation(); if (window.confirm("Excluir?")) deleteArquivo.mutate(img.id); }} className="p-1.5 rounded bg-destructive/90 text-white hover:bg-destructive"><Trash2 size={14} /></button>
                      </div>
                      <p className="text-[10px] text-muted-foreground p-1 truncate">{(img as any).nome_arquivo}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-xs text-center py-4">Nenhuma imagem adicionada.</p>}
            </div>
          </TabsContent>

          {/* ─── DOCUMENTOS ─── */}
          <TabsContent value="documentos">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold flex items-center gap-1"><FileText size={12} /> Documentos</h4>
                <div>
                  <input id="doc-upload" type="file" multiple className="hidden" onChange={e => { if (e.target.files) { setUploadTipo("documento"); Array.from(e.target.files).forEach(f => uploadFile.mutate(f)); } }} />
                  <button onClick={() => document.getElementById("doc-upload")?.click()} className="flex items-center gap-1 h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium"><Upload size={12} /> Enviar Documento</button>
                </div>
              </div>
              {documentos.length > 0 ? (
                <div className="space-y-1.5">
                  {documentos.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2.5 rounded bg-card border border-border text-xs">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-muted-foreground" />
                        <span className="font-medium">{(doc as any).nome_arquivo}</span>
                        {(doc as any).tamanho && <span className="text-muted-foreground">({((doc as any).tamanho / 1024).toFixed(0)} KB)</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {isPreviewable((doc as any).nome_arquivo) && (
                          <button onClick={() => setPreviewDoc({ url: (doc as any).url, nome: (doc as any).nome_arquivo })} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary" title="Visualizar"><Eye size={13} /></button>
                        )}
                        <a href={(doc as any).url} target="_blank" download className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary" title="Download"><Download size={13} /></a>
                        <button onClick={() => { if (window.confirm("Excluir?")) deleteArquivo.mutate(doc.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-muted-foreground text-xs text-center py-4">Nenhum documento adicionado.</p>}
            </div>
          </TabsContent>

          {/* ─── PROJETOS ─── */}
          <TabsContent value="projetos">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold flex items-center gap-1"><FileText size={12} /> Projetos Vinculados</h4>
              {clienteProjetos && clienteProjetos.length > 0 ? clienteProjetos.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded bg-card border border-border cursor-pointer hover:bg-secondary/30 transition" onClick={() => window.location.href = `/projetos?open=${p.id}`}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium">{p.nome}</span>
                    {p.venda_total != null && <span className="text-[10px] text-muted-foreground">R$ {Number(p.venda_total).toFixed(2)}</span>}
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${p.status === "cancelado" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>{p.status}</span>
                </div>
              )) : <p className="text-muted-foreground text-xs text-center py-4">Nenhum projeto vinculado. Aprove um orçamento para criar um projeto.</p>}
            </div>
          </TabsContent>
        </Tabs>

        {/* ─── LIGHTBOX IMAGENS ─── */}
        <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden flex flex-col items-center justify-center">
            {lightboxIndex !== null && imagens[lightboxIndex] && (
              <>
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <button onClick={() => setLightboxZoom(z => Math.max(0.5, z - 0.25))} className="p-2 rounded-full bg-white/15 text-white hover:bg-white/25 transition"><ZoomOut size={16} /></button>
                  <span className="text-white/70 text-xs min-w-[40px] text-center">{Math.round(lightboxZoom * 100)}%</span>
                  <button onClick={() => setLightboxZoom(z => Math.min(3, z + 0.25))} className="p-2 rounded-full bg-white/15 text-white hover:bg-white/25 transition"><ZoomIn size={16} /></button>
                  <a href={(imagens[lightboxIndex] as any).url} target="_blank" download className="p-2 rounded-full bg-white/15 text-white hover:bg-white/25 transition"><Download size={16} /></a>
                </div>
                {imagens.length > 1 && (
                  <>
                    <button onClick={() => { setLightboxIndex(i => (i! - 1 + imagens.length) % imagens.length); setLightboxZoom(1); }} className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/15 text-white hover:bg-white/25 transition"><ChevronLeft size={20} /></button>
                    <button onClick={() => { setLightboxIndex(i => (i! + 1) % imagens.length); setLightboxZoom(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/15 text-white hover:bg-white/25 transition"><ChevronRight size={20} /></button>
                  </>
                )}
                <div className="flex-1 flex items-center justify-center overflow-auto w-full p-8">
                  <img
                    src={(imagens[lightboxIndex] as any).url}
                    alt={(imagens[lightboxIndex] as any).nome_arquivo}
                    className="max-w-full max-h-[80vh] object-contain transition-transform duration-200"
                    style={{ transform: `scale(${lightboxZoom})` }}
                  />
                </div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                  <span className="text-white/80 text-xs bg-black/60 px-3 py-1 rounded-full">{(imagens[lightboxIndex] as any).nome_arquivo} — {lightboxIndex + 1}/{imagens.length}</span>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ─── PREVIEW DOCUMENTO ─── */}
        <Dialog open={previewDoc !== null} onOpenChange={() => setPreviewDoc(null)}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
            {previewDoc && (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
                  <span className="text-sm font-medium truncate">{previewDoc.nome}</span>
                  <div className="flex items-center gap-2">
                    <a href={previewDoc.url} target="_blank" download className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><Download size={13} /> Download</a>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-muted/30">
                  {previewDoc.nome.toLowerCase().endsWith(".pdf") ? (
                    <iframe src={previewDoc.url} className="w-full h-[80vh] border-none" title={previewDoc.nome} />
                  ) : (
                    <div className="flex items-center justify-center p-8">
                      <img src={previewDoc.url} alt={previewDoc.nome} className="max-w-full max-h-[75vh] object-contain" />
                    </div>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  /* ─── Kanban helpers ─── */
  const kanbanColumns = statusCrmKanban;

  const getClientOrcamentos = (clienteId: string) => (allOrcamentos ?? []).filter(o => o.cliente_id === clienteId);
  const getClientProjetos = (clienteId: string) => (allProjetos ?? []).filter(p => p.cliente_id === clienteId);
  const getClientTotalVenda = (clienteId: string) => {
    const orcs = getClientOrcamentos(clienteId);
    const approved = orcs.find(o => o.aprovado);
    if (approved?.simulacao_pagamento) {
      const sim = approved.simulacao_pagamento as any;
      const parcelas = sim.parcelas ?? [];
      if (parcelas.length > 0) return parcelas.reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0) + (Number(sim.entrada) || 0);
    }
    const projs = getClientProjetos(clienteId);
    if (projs.length > 0) return projs.reduce((s, p) => s + (Number(p.venda_total) || 0), 0);
    return 0;
  };

  const handleDragStart = (e: React.DragEvent, clientId: string) => {
    setDragClientId(clientId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", clientId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetStatus: StatusCRM) => {
    e.preventDefault();
    const clientId = e.dataTransfer.getData("text/plain");
    const client = clientes?.find(c => c.id === clientId);
    if (client && client.status_crm !== targetStatus) {
      changeStatusInline.mutate({ id: clientId, newStatus: targetStatus, old: client });
    }
    setDragClientId(null);
  };

  /* ─── LIST VIEW ─── */
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">CRM — Gestão de Clientes</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary/50 rounded-lg p-0.5">
            <button onClick={() => setListViewType("kanban")} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${listViewType === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <LayoutGrid size={13} /> Kanban
            </button>
            <button onClick={() => setListViewType("table")} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${listViewType === "table" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <List size={13} /> Lista
            </button>
          </div>
          <button onClick={() => { resetForm(); setViewMode("new"); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
            <Plus size={14} /> Novo Cliente
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded p-3 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">{editId ? "Editar" : "Novo"} Cliente</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Nome *</label><input value={nome} onChange={e => setNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">E-mail</label><input value={email} onChange={e => setEmail(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Telefone</label><input value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Endereço</label><input value={endereco} onChange={e => setEndereco(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Endereço da Obra</label><input value={enderecoObra} onChange={e => setEnderecoObra(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Origem</label>
              <select value={origem} onChange={e => setOrigem(e.target.value as OrigemLead)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="indicacao">Indicação</option><option value="arquiteto">Arquiteto</option><option value="outro">Outro</option>
              </select>
            </div>
            {origem === "arquiteto" && (
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Arquiteto</label>
                <select value={arquitetoIdOrigem} onChange={e => setArquitetoIdOrigem(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                  <option value="">Selecione...</option>
                  {(arquitetos ?? []).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Status</label>
              <select value={statusCrm} onChange={e => setStatusCrm(e.target.value as StatusCRM)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                {statusCrmOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => save.mutate()} disabled={save.isPending || !nome.trim()} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p> : isError ? <p className="text-center py-8 text-xs text-destructive">Erro ao carregar dados.</p> : (
        <>
          {/* ═══════ KANBAN VIEW ═══════ */}
          {listViewType === "kanban" && (
            <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none" style={{ minHeight: "calc(100vh - 200px)" }}>
              {kanbanColumns.map(col => {
                const colClients = (clientes ?? []).filter(c => c.status_crm === col.key);
                const isDragOver = dragClientId !== null;
                return (
                  <div
                    key={col.key}
                    className={`flex-shrink-0 w-[280px] md:w-1/4 md:min-w-[240px] flex flex-col rounded-xl border ${col.borderColor} ${col.bgColor} snap-center transition-all ${isDragOver ? "ring-1 ring-primary/20" : ""}`}
                    onDragOver={handleDragOver}
                    onDrop={e => handleDrop(e, col.key)}
                  >
                    {/* Column header */}
                    <div className={`flex items-center justify-between px-3 py-2.5 border-b ${col.borderColor}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-background/80 ${col.color}`}>{colClients.length}</span>
                      </div>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {colClients.map(c => {
                        const orcs = getClientOrcamentos(c.id);
                        const projs = getClientProjetos(c.id);
                        const totalVenda = getClientTotalVenda(c.id);
                        const hasApproved = orcs.some(o => o.aprovado);

                        return (
                          <div
                            key={c.id}
                            draggable
                            onDragStart={e => handleDragStart(e, c.id)}
                            onDragEnd={() => setDragClientId(null)}
                            onClick={() => openDetail(c)}
                            className={`group relative bg-card border border-border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 hover:scale-[1.01] active:scale-[0.98] ${dragClientId === c.id ? "opacity-40 scale-95" : ""}`}
                          >
                            {/* Drag handle */}
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity">
                              <GripVertical size={12} className="text-muted-foreground" />
                            </div>

                            {/* Client name */}
                            <p className="text-sm font-semibold text-foreground truncate pr-4">{c.nome}</p>

                            {/* Origin & Arquiteto */}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{origemLabels[c.origem as OrigemLead] ?? "Outro"}</span>
                              {(c as any).fornecedores?.nome && (
                                <span className="text-[10px] text-muted-foreground truncate">🏗️ {(c as any).fornecedores.nome}</span>
                              )}
                            </div>

                            {/* Budget / Project info */}
                            {(orcs.length > 0 || projs.length > 0) && (
                              <div className="mt-2 space-y-1">
                                {orcs.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <FileText size={10} />
                                    <span>{orcs.length} orç.</span>
                                    {hasApproved && <span className="text-success font-bold">✓ Aprovado</span>}
                                  </div>
                                )}
                                {projs.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <Package size={10} />
                                    <span>{projs.length} projeto{projs.length > 1 ? "s" : ""}</span>
                                    <span className="text-[10px] px-1 py-0 rounded bg-success/10 text-success font-medium">{projs[0].status}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Total value */}
                            {totalVenda > 0 && (
                              <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-1">
                                <DollarSign size={11} className="text-primary" />
                                <span className="text-xs font-bold text-primary">R$ {totalVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}

                            {/* Quick actions on hover */}
                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                              <button onClick={e => { e.stopPropagation(); openEdit(c); }} className="p-1 rounded bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={10} /></button>
                              <button onClick={e => { e.stopPropagation(); setDeleteClientTarget({ id: c.id, nome: c.nome }); }} className="p-1 rounded bg-secondary/80 hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={10} /></button>
                            </div>
                          </div>
                        );
                      })}
                      {colClients.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                          <Users size={20} className="mb-1" />
                          <p className="text-[10px]">Nenhum cliente</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══════ TABLE VIEW ═══════ */}
          {listViewType === "table" && (
            <>
              {/* Status counters */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {([
                  { key: "todos" as const, label: "Todos", count: (clientes ?? []).length, color: "bg-secondary text-secondary-foreground" },
                  { key: "lead" as const, label: "Lead", count: statusCounts.lead, color: "bg-secondary text-secondary-foreground" },
                  { key: "contato" as const, label: "Em Contato", count: statusCounts.contato, color: "bg-warning/15 text-warning" },
                  { key: "proposta" as const, label: "Proposta Enviada", count: statusCounts.proposta, color: "bg-primary/15 text-primary" },
                  { key: "projeto" as const, label: "Projeto", count: statusCounts.projeto, color: "bg-success/15 text-success" },
                ]).map(s => (
                  <button key={s.key} onClick={() => setFilterStatus(s.key)} className={`rounded p-2 text-center transition ${filterStatus === s.key ? "ring-2 ring-primary" : "hover:opacity-80"} ${s.color}`}>
                    <div className="text-lg font-bold">{s.count}</div>
                    <div className="text-[10px] font-medium truncate">{s.label}</div>
                  </button>
                ))}
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-secondary/60">
                    <th className="text-left px-3 py-2.5 font-semibold border-b border-border cursor-pointer select-none group" onClick={() => toggleTableSort("nome")}>
                      <div className="flex items-center gap-1">Nome {tableSortKey === "nome" ? (tableSortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-30 group-hover:opacity-60" />}</div>
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold border-b border-border">Telefone</th>
                    <th className="text-left px-3 py-2.5 font-semibold border-b border-border hidden md:table-cell">Origem</th>
                    <th className="text-center px-3 py-2.5 font-semibold border-b border-border">Orçam.</th>
                    <th className="text-center px-3 py-2.5 font-semibold border-b border-border hidden lg:table-cell">Dias no Status</th>
                    <th className="text-center px-3 py-2.5 font-semibold border-b border-border cursor-pointer select-none group" onClick={() => toggleTableSort("updated_at")}>
                      <div className="flex items-center justify-center gap-1">Atualização {tableSortKey === "updated_at" ? (tableSortDir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-30 group-hover:opacity-60" />}</div>
                    </th>
                    <th className="text-center px-3 py-2.5 font-semibold border-b border-border">Status</th>
                    <th className="text-center px-3 py-2.5 font-semibold border-b border-border">Ações</th>
                  </tr></thead>
                  <tbody>
                    {filteredSorted.map(c => {
                      const orcCount = getOrcamentoCount(c.id);
                      const daysInStatus = getDaysInStatus(c);
                      return (
                      <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-primary/[0.03] cursor-pointer transition-colors group" onClick={() => openDetail(c)}>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-foreground text-[13px] group-hover:text-primary transition-colors">{c.nome}</p>
                          {c.email && <p className="text-[10px] text-muted-foreground mt-0.5">{c.email}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{c.telefone ?? "—"}</td>
                        <td className="px-3 py-2.5 hidden md:table-cell"><span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{origemLabels[c.origem as OrigemLead] ?? "—"}</span></td>
                        <td className="px-3 py-2.5 text-center">
                          {orcCount > 0 ? <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">{orcCount}</span> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center hidden lg:table-cell">
                          <span className={`text-[10px] font-medium ${daysInStatus > 30 ? "text-destructive" : daysInStatus > 14 ? "text-warning" : "text-muted-foreground"}`}>
                            {daysInStatus}d
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true, locale: ptBR })}
                        </td>
                        <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                          <select
                            value={c.status_crm ?? "lead"}
                            onChange={e => { e.stopPropagation(); changeStatusInline.mutate({ id: c.id, newStatus: e.target.value as StatusCRM, old: c }); }}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-medium border-0 cursor-pointer appearance-none text-center ${statusCrmColors[c.status_crm as StatusCRM]} bg-transparent`}
                            style={{ backgroundImage: "none" }}
                          >
                            <option value="lead">Lead</option>
                            <option value="contato">Em Contato</option>
                            <option value="proposta">Proposta Enviada</option>
                            <option value="projeto">Projeto</option>
                          </select>
                        </td>
                        <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openDetail(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Eye size={13} /></button>
                            <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                            <button onClick={() => setDeleteClientTarget({ id: c.id, nome: c.nome })} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                    {filteredSorted.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Nenhum cliente encontrado.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      <AlertDialog open={!!deleteClientTarget} onOpenChange={open => { if (!open) setDeleteClientTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Excluir Cliente Permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação irá excluir permanentemente o cliente <strong>"{deleteClientTarget?.nome}"</strong> e todos os dados vinculados (orçamentos, projetos, financeiro, documentos, interações). Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteClientTarget) { remove.mutate(deleteClientTarget.id); setDeleteClientTarget(null); } }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/* ─── Auto-create first orcamento when Itens tab is opened ─── */
const AutoCreateOrcamento = ({ orcamentos, detailClientId, empresaId, createOrcamento, activeOrcamentoId, setActiveOrcamentoId, loadSimFromOrc }: any) => {
  const didAutoCreate = useRef(false);
  useEffect(() => {
    if (orcamentos && orcamentos.length === 0 && detailClientId && empresaId && !didAutoCreate.current && !createOrcamento.isPending) {
      didAutoCreate.current = true;
      createOrcamento.mutate();
    }
    if (orcamentos && orcamentos.length > 0 && !activeOrcamentoId) {
      setActiveOrcamentoId(orcamentos[0].id);
      loadSimFromOrc(orcamentos[0]);
    }
  }, [orcamentos, detailClientId, empresaId, activeOrcamentoId]);
  return null;
};

/* ─── Inline Edit Form for Detail View ─── */
const ClienteForm = ({ nome: initNome, email: initEmail, telefone: initTel, endereco: initEnd, enderecoObra: initObra, origem: initOrigem, statusCrm: initStatus, arquitetoId: initArqId, arquitetos, notas: initNotas, onSave }: any) => {
  const [nome, setNome] = useState(initNome ?? "");
  const [email, setEmail] = useState(initEmail ?? "");
  const [telefone, setTelefone] = useState(initTel ?? "");
  const [endereco, setEndereco] = useState(initEnd ?? "");
  const [enderecoObra, setEnderecoObra] = useState(initObra ?? "");
  const [origem, setOrigem] = useState<OrigemLead>(initOrigem ?? "outro");
  const [arquitetoIdOrigem, setArquitetoIdOrigem] = useState(initArqId ?? "");
  const [statusCrm, setStatusCrm] = useState<StatusCRM>(initStatus ?? "lead");
  const [obsOrigem, setObsOrigem] = useState(initNotas ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (email && !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) { toast.error("E-mail inválido. Verifique o formato (ex: nome@email.com)"); return; }
    setSaving(true);
    try {
      console.log("[CRM] ClienteForm handleSave chamado", { nome, email });
      await onSave(sanitizePayload({ nome: nome.trim(), email: email || null, telefone: telefone || null, endereco: endereco || null, endereco_obra: enderecoObra || null, origem, status_crm: statusCrm, arquiteto_id: (origem === "arquiteto" && arquitetoIdOrigem) ? arquitetoIdOrigem : null, notas: obsOrigem || null }));
      toast.success("Cliente atualizado com sucesso!");
    } catch (err: any) {
      console.error("[CRM] Erro ao salvar alterações:", err);
      toast.error("Erro ao salvar: " + (err?.message ?? "erro desconhecido"));
    }
    setSaving(false);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Nome *</label><input value={nome} onChange={e => setNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" /></div>
      <div className="space-y-1"><label className="text-[11px] text-muted-foreground">E-mail</label><input value={email} onChange={e => setEmail(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
      <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Telefone</label><input value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
      <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Endereço</label><input value={endereco} onChange={e => setEndereco(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
      <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Endereço da Obra</label><input value={enderecoObra} onChange={e => setEnderecoObra(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
      <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Origem</label>
        <select value={origem} onChange={e => setOrigem(e.target.value as OrigemLead)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
          <option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="indicacao">Indicação</option><option value="arquiteto">Arquiteto</option><option value="outro">Outro</option>
        </select>
      </div>
      {origem === "arquiteto" && (
        <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Arquiteto</label>
          <select value={arquitetoIdOrigem} onChange={e => setArquitetoIdOrigem(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
            <option value="">Selecione...</option>
            {(arquitetos ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
      )}
      <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Status</label>
        <select value={statusCrm} onChange={e => setStatusCrm(e.target.value as StatusCRM)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
          {statusCrmOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="space-y-1 col-span-2 md:col-span-4"><label className="text-[11px] text-muted-foreground">Observação da Origem</label>
        <textarea value={obsOrigem} onChange={e => setObsOrigem(e.target.value)} placeholder="Observações sobre a origem do cliente..." className="w-full min-h-[60px] px-2 py-1.5 text-xs bg-background border border-border rounded resize-y focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>
      <div className="col-span-2 md:col-span-4">
        <button onClick={handleSave} disabled={saving || !nome.trim()} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar Alterações</button>
      </div>
    </div>
  );
};

export default CRM;
