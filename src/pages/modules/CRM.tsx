import { useState, useMemo, useRef, useCallback } from "react";
import { Users, Plus, Pencil, Trash2, Eye, ArrowLeft, MessageSquare, FileText, Package, Phone, MapPin, User, Calculator, Upload, Download, Image, Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Copy, Check } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useCreateProjeto, useCreateProjetoItem, useArquitetos } from "@/hooks/useProjetos";
import { useContratos } from "@/hooks/useContratos";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type StatusCRM = Database["public"]["Enums"]["status_crm"];
type OrigemLead = Database["public"]["Enums"]["origem_lead"];

const statusLabels: Record<StatusCRM, string> = { lead: "Lead", contato: "Em Contato", proposta: "Proposta Enviada", projeto: "Projeto" };
const statusColors: Record<StatusCRM, string> = { lead: "bg-secondary text-secondary-foreground", contato: "bg-warning/15 text-warning", proposta: "bg-primary/15 text-primary", projeto: "bg-success/15 text-success" };
const origemLabels: Record<OrigemLead, string> = { whatsapp: "WhatsApp", instagram: "Instagram", indicacao: "Indicação", arquiteto: "Arquiteto", outro: "Outro" };

const CRM = () => {
  const empresaId = useEmpresa();
  const { user } = useAuth();
  const qc = useQueryClient();
  const createProjeto = useCreateProjeto();
  const createProjetoItem = useCreateProjetoItem();
  const { data: contratos } = useContratos();
  const { data: arquitetos } = useArquitetos();

  const [viewMode, setViewMode] = useState<"list" | "detail" | "new">("list");
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
  const [editItemId, setEditItemId] = useState<string | null>(null);

  // Lightbox & preview state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; nome: string } | null>(null);

  // Active orcamento
  const [activeOrcamentoId, setActiveOrcamentoId] = useState<string | null>(null);

  const isPreviewable = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    return ["pdf", "jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
  };

  const { data: clientes, isLoading, isError } = useQuery({
    queryKey: ["clientes", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*, fornecedores:arquiteto_id(nome)").order("created_at", { ascending: false });
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
      const { data } = await supabase.from("projetos").select("id, nome, status, venda_total, orcamento_id").eq("cliente_id", detailClient!.id);
      return data ?? [];
    },
    enabled: !!detailClient?.id,
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
      const { data, error } = await supabase.from("equipe").select("*").eq("empresa_id", empresaId!).order("nome");
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
  const resetItemForm = () => { setItemDesc(""); setItemQtd(1); setItemCusto(0); setItemVenda(0); setItemRt(0); setEditItemId(null); };
  const resetIntForm = () => { setIntTipo("ligacao"); setIntDesc(""); setEditIntId(null); setIntData(undefined); setIntMembroEquipe(""); };

  const openEdit = (c: any) => {
    setEditId(c.id); setNome(c.nome); setEmail(c.email ?? ""); setTelefone(c.telefone ?? "");
    setEndereco(c.endereco ?? ""); setEnderecoObra(c.endereco_obra ?? "");
    setOrigem(c.origem ?? "outro"); setArquitetoIdOrigem(c.arquiteto_id ?? "");
    setStatusCrm(c.status_crm ?? "lead"); setShowForm(true);
  };

  const openDetail = (c: any) => { setDetailClient(c); setViewMode("detail"); setActiveOrcamentoId(null); };
  const backToList = () => { setViewMode("list"); setDetailClient(null); setActiveOrcamentoId(null); };

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

  const approveOrcamento = useMutation({
    mutationFn: async (orcId: string) => {
      if (!detailClient?.id || !empresaId) return;
      // Approve this orcamento (allow multiple approvals)
      const { error } = await supabase.from("crm_orcamentos").update({ aprovado: true }).eq("id", orcId);
      if (error) throw error;

      // Get orcamento data
      const { data: orcData } = await supabase.from("crm_orcamentos").select("*, simulacao_pagamento").eq("id", orcId).single();
      const { data: approvedItems } = await supabase.from("crm_itens").select("*").eq("orcamento_id", orcId);
      const items = approvedItems ?? [];
      const totalVenda = items.reduce((s: number, i: any) => s + (Number(i.preco_venda) || 0) * (Number(i.quantidade) || 1), 0);
      const totalCusto = items.reduce((s: number, i: any) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1) + (Number((i as any).rt_comissao) || 0), 0);
      const margem = totalVenda > 0 ? ((totalVenda - totalCusto) / totalVenda) * 100 : 0;

      const sim = (orcData?.simulacao_pagamento as any) ?? {};
      const simParcelas = sim.parcelas ?? [];
      const simFormaPgto = sim.formaPagamento ?? "";

      const cliente = clientes?.find(c => c.id === detailClient.id);
      const origemLabel = cliente?.origem ? origemLabels[cliente.origem as OrigemLead] : "";
      const descParts = [`Projeto criado a partir do CRM — ${orcData?.nome ?? "Orçamento"}`];
      if (origemLabel) descParts.push(`Origem: ${origemLabel}`);
      if (cliente?.notas) descParts.push(`Obs: ${cliente.notas}`);

      // Check if a project already exists for THIS orcamento
      const { data: existingProjects } = await supabase.from("projetos").select("id").eq("orcamento_id", orcId);

      const parseDate = (d: string) => { if (d.includes("/")) { const [dd, mm, yyyy] = d.split("/"); return `${yyyy}-${mm}-${dd}`; } return d; };

      if (existingProjects && existingProjects.length > 0) {
        // Update existing project linked to this orcamento
        const projId = existingProjects[0].id;
        await supabase.from("projetos").update({
          venda_total: totalVenda, custo_previsto: totalCusto, margem_prevista: margem,
          numero_parcelas: simParcelas.length > 0 ? simParcelas.length : 1,
          forma_pagamento: simFormaPgto || null,
          descricao: descParts.join(" | "),
          status: "aprovado",
        }).eq("id", projId);

        await supabase.from("projeto_itens").delete().eq("projeto_id", projId);
        for (const item of items) {
          await createProjetoItem.mutateAsync({ projeto_id: projId, descricao: item.descricao, quantidade: Number(item.quantidade) || 1, preco_custo: Number(item.preco_custo) || 0, preco_venda: Number(item.preco_venda) || 0, tipo: "produto", produto_id: item.produto_id || null, rt_percentual: Number((item as any).rt_comissao) || 0 });
        }

        await supabase.from("financeiro_receber").delete().eq("projeto_id", projId);
        if (simParcelas.length > 0) {
          const inserts = simParcelas.map((p: any, i: number) => ({
            empresa_id: empresaId, projeto_id: projId, cliente_id: detailClient.id,
            descricao: `Parcela ${i + 1}/${simParcelas.length} — ${detailClient.nome}`,
            valor: p.valor, parcela: i + 1, data_vencimento: parseDate(p.data), status: "pendente" as const,
          }));
          await supabase.from("financeiro_receber").insert(inserts);
        }
        toast.success("Projeto atualizado com dados do orçamento!");
      } else {
        // Create new project for this orcamento
        const newProjeto = await createProjeto.mutateAsync({
          nome: `Projeto — ${detailClient.nome} — ${orcData?.nome ?? ""}`,
          descricao: descParts.join(" | "),
          cliente_id: detailClient.id, endereco_obra: detailClient.endereco_obra || detailClient.endereco || null,
          arquiteto_id: detailClient.arquiteto_id || null, status: "aprovado",
          venda_total: totalVenda, custo_previsto: totalCusto, margem_prevista: margem,
          numero_parcelas: simParcelas.length > 0 ? simParcelas.length : 1,
          forma_pagamento: simFormaPgto || null,
          observacoes_pagamento: cliente?.notas || null,
          orcamento_id: orcId,
        } as any);

        for (const item of items) {
          await createProjetoItem.mutateAsync({ projeto_id: newProjeto.id, descricao: item.descricao, quantidade: Number(item.quantidade) || 1, preco_custo: Number(item.preco_custo) || 0, preco_venda: Number(item.preco_venda) || 0, tipo: "produto", produto_id: item.produto_id || null, rt_percentual: Number((item as any).rt_comissao) || 0 });
        }

        if (simParcelas.length > 0) {
          const inserts = simParcelas.map((p: any, i: number) => ({
            empresa_id: empresaId, projeto_id: newProjeto.id, cliente_id: detailClient.id,
            descricao: `Parcela ${i + 1}/${simParcelas.length} — ${detailClient.nome}`,
            valor: p.valor, parcela: i + 1, data_vencimento: parseDate(p.data), status: "pendente" as const,
          }));
          await supabase.from("financeiro_receber").insert(inserts);
        }
        toast.success("Projeto criado a partir do orçamento aprovado!");
      }
    },
    onSuccess: () => { refetchOrcamentos(); qc.invalidateQueries({ queryKey: ["projetos"] }); qc.invalidateQueries({ queryKey: ["cliente_projetos"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  // Unapprove orcamento (cancel linked project)
  const unapproveOrcamento = useMutation({
    mutationFn: async (orcId: string) => {
      const { error } = await supabase.from("crm_orcamentos").update({ aprovado: false }).eq("id", orcId);
      if (error) throw error;
      // Cancel linked project (don't delete — preserve data)
      const { data: linkedProjects } = await supabase.from("projetos").select("id").eq("orcamento_id", orcId);
      if (linkedProjects && linkedProjects.length > 0) {
        for (const proj of linkedProjects) {
          await supabase.from("projetos").update({ status: "cancelado" }).eq("id", proj.id);
        }
      }
    },
    onSuccess: () => {
      refetchOrcamentos();
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["cliente_projetos"] });
      toast.success("Orçamento desaprovado. Projeto vinculado foi cancelado.");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteOrcamento = useMutation({
    mutationFn: async (orcId: string) => {
      const { error } = await supabase.from("crm_orcamentos").delete().eq("id", orcId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchOrcamentos(); refetchCrmItens();
      setActiveOrcamentoId(null);
      toast.success("Orçamento excluído");
    },
  });

  // Save orcamento simulation
  const saveOrcamentoSimulacao = async (simData: any) => {
    if (!activeOrcamentoId) return;
    await supabase.from("crm_orcamentos").update({ simulacao_pagamento: simData }).eq("id", activeOrcamentoId);
    refetchOrcamentos();
  };

  /* ─── Auto-create project logic ─── */
  const autoCreateProject = async (clienteId: string, clienteNome: string, endObra: string | null, endCli: string | null, arqId: string | null, notas?: string | null) => {
    if (!empresaId) return;

    // Find approved orcamento
    const approvedOrc = orcamentos?.find(o => o.aprovado);
    
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
    if (approvedOrc?.simulacao_pagamento) {
      const sim = approvedOrc.simulacao_pagamento as any;
      simParcelas = sim.parcelas ?? [];
      simFormaPgto = sim.formaPagamento ?? "";
    }

    const simParcCount = simParcelas.length;
    const newProjeto = await createProjeto.mutateAsync({
      nome: `Projeto — ${clienteNome}`,
      descricao: descParts.join(" | "),
      cliente_id: clienteId, endereco_obra: endObra || endCli || null,
      arquiteto_id: arqId || null, status: "aprovado",
      venda_total: totalVenda, custo_previsto: totalCusto, margem_prevista: margem,
      numero_parcelas: simParcCount > 0 ? simParcCount : 1,
      forma_pagamento: simFormaPgto || null,
      observacoes_pagamento: notas || cliente?.notas || null,
    });
    for (const item of items) {
      await createProjetoItem.mutateAsync({ projeto_id: newProjeto.id, descricao: item.descricao, quantidade: Number(item.quantidade) || 1, preco_custo: Number(item.preco_custo) || 0, preco_venda: Number(item.preco_venda) || 0, tipo: "produto", produto_id: item.produto_id || null, rt_percentual: Number(item.rt_comissao) || 0 });
    }
    // Generate financial parcels from simulation
    if (simParcelas.length > 0 && totalVenda > 0) {
      const parseDate = (d: string) => {
        if (d.includes("/")) { const [dd, mm, yyyy] = d.split("/"); return `${yyyy}-${mm}-${dd}`; }
        return d;
      };
      const inserts = simParcelas.map((p: any, i: number) => ({
        empresa_id: empresaId, projeto_id: newProjeto.id, cliente_id: clienteId,
        descricao: `Parcela ${i + 1}/${simParcelas.length} — Projeto — ${clienteNome}`,
        valor: p.valor, parcela: i + 1,
        data_vencimento: parseDate(p.data), status: "pendente" as const,
      }));
      await supabase.from("financeiro_receber").insert(inserts);
    }
    toast.success("Projeto criado automaticamente com itens e parcelas do CRM!");
  };

  /* ─── Save new client and open detail ─── */
  const saveNewClient = useMutation({
    mutationFn: async () => {
      const payload: any = { nome, email: email || null, telefone: telefone || null, endereco: endereco || null, endereco_obra: enderecoObra || null, origem, status_crm: statusCrm, arquiteto_id: (origem === "arquiteto" && arquitetoIdOrigem) ? arquitetoIdOrigem : null, empresa_id: empresaId!, notas: novoClienteObs || null };
      const { data, error } = await supabase.from("clientes").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success("Cliente cadastrado!");
      resetForm();
      setDetailClient(data);
      setViewMode("detail");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { nome, email: email || null, telefone: telefone || null, endereco: endereco || null, endereco_obra: enderecoObra || null, origem, status_crm: statusCrm, arquiteto_id: (origem === "arquiteto" && arquitetoIdOrigem) ? arquitetoIdOrigem : null };
      if (editId) {
        const oldCliente = clientes?.find(c => c.id === editId);
        const { error } = await supabase.from("clientes").update(payload).eq("id", editId);
        if (error) throw error;
        if (statusCrm === "projeto" && oldCliente?.status_crm !== "projeto") {
          await autoCreateProject(editId, nome, enderecoObra || null, endereco || null, payload.arquiteto_id, oldCliente?.notas);
        }
      } else {
        const { error } = await supabase.from("clientes").insert({ ...payload, empresa_id: empresaId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); qc.invalidateQueries({ queryKey: ["projetos"] }); toast.success(editId ? "Cliente atualizado!" : "Cliente cadastrado!"); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("clientes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); toast.success("Cliente excluído"); },
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
        const { error } = await supabase.from("crm_interacoes").update({ tipo: intTipo, descricao: descFull }).eq("id", editIntId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_interacoes").insert({ cliente_id: detailClient.id, tipo: intTipo, descricao: descFull, usuario_id: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => { refetchInteracoes(); resetIntForm(); toast.success(editIntId ? "Interação atualizada" : "Interação registrada"); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteInteracao = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("crm_interacoes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { refetchInteracoes(); toast.success("Interação excluída"); },
  });

  const saveCrmItem = useMutation({
    mutationFn: async () => {
      if (!itemDesc.trim() || !detailClient?.id) return;
      if (editItemId) {
        const { error } = await supabase.from("crm_itens").update({ descricao: itemDesc, quantidade: itemQtd, preco_custo: itemCusto, preco_venda: itemVenda, rt_comissao: itemRt } as any).eq("id", editItemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_itens").insert({ cliente_id: detailClient.id, empresa_id: empresaId!, descricao: itemDesc, quantidade: itemQtd, preco_custo: itemCusto, preco_venda: itemVenda, rt_comissao: itemRt, orcamento_id: activeOrcamentoId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { refetchCrmItens(); resetItemForm(); toast.success(editItemId ? "Item atualizado" : "Item adicionado"); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteCrmItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("crm_itens").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { refetchCrmItens(); toast.success("Item excluído"); },
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

  const clienteContratos = contratos?.filter(c => c.cliente_id === detailClient?.id) ?? [];
  const filtered = clientes?.filter(c => filterStatus === "todos" || c.status_crm === filterStatus) ?? [];

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
  }, []);

  const simulacao = useMemo(() => {
    const total = totalCrmVenda;
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
  }, [totalCrmVenda, simCondicao, simEntrada, simParcelas, simIntervalo, simJuros]);

  const parcelasParaExibir = editingParcelas ?? simulacao.parcelas;

  const handleEditParcela = (idx: number, field: "valor" | "data", value: string) => {
    const current = [...(editingParcelas ?? simulacao.parcelas)];
    if (field === "valor") current[idx] = { ...current[idx], valor: Number(value) || 0 };
    else current[idx] = { ...current[idx], data: value };
    setEditingParcelas(current);
  };

  const handleSaveSimulacao = () => {
    const simData = {
      condicao: simCondicao, formaPagamento: simFormaPgto,
      numParcelas: simParcelas, entrada: simEntrada,
      intervalo: simIntervalo, juros: simJuros,
      parcelas: parcelasParaExibir,
    };
    saveOrcamentoSimulacao(simData);
    toast.success("Simulação salva!");
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
                    <option value="lead">Lead</option><option value="contato">Em Contato</option><option value="proposta">Proposta Enviada</option><option value="projeto">Projeto</option>
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
          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusColors[detailClient.status_crm as StatusCRM]}`}>{statusLabels[detailClient.status_crm as StatusCRM]}</span>
        </div>

        <Tabs defaultValue="dados" className="w-full">
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
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${statusColors[detailClient.status_crm as StatusCRM]}`}>{statusLabels[detailClient.status_crm as StatusCRM]}</span>
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
            <div className="space-y-3">
              {/* Orcamento selector */}
              <div className="bg-card border border-border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">Orçamentos</h4>
                  <button onClick={() => createOrcamento.mutate()} disabled={createOrcamento.isPending} className="flex items-center gap-1 h-7 px-2 rounded bg-primary text-primary-foreground text-[11px] font-medium disabled:opacity-50">
                    <Plus size={11} /> Novo Orçamento
                  </button>
                </div>
                {orcamentos && orcamentos.length > 0 ? (
                  <div className="flex gap-3 flex-wrap">
                    {orcamentos.map(orc => (
                      <div
                        key={orc.id}
                        onClick={() => { setActiveOrcamentoId(orc.id); loadSimFromOrc(orc); }}
                        className={`flex flex-col gap-2 px-4 py-3 rounded-lg border-2 text-sm cursor-pointer transition-all ${activeOrcamentoId === orc.id ? "border-primary bg-primary/10 shadow-md" : "border-border bg-card hover:bg-secondary/30 hover:border-primary/40"} ${orc.aprovado ? "ring-2 ring-success ring-offset-1" : ""}`}
                      >
                        <div className="flex items-center gap-2">
                          {orc.aprovado && <Check size={16} className="text-success" />}
                          <span className={`font-semibold ${activeOrcamentoId === orc.id ? "text-primary" : "text-foreground"}`}>{orc.nome}</span>
                          {orc.aprovado && <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-semibold uppercase">Aprovado</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {!orc.aprovado ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); approveOrcamento.mutate(orc.id); }}
                              className="flex items-center gap-1 h-8 px-3 rounded bg-success/15 text-success hover:bg-success/25 text-xs font-medium border border-success/30 transition"
                            >
                              <Check size={14} /> Aprovar
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); if (window.confirm("Desaprovar este orçamento? O projeto vinculado será cancelado.")) unapproveOrcamento.mutate(orc.id); }}
                              className="flex items-center gap-1 h-8 px-3 rounded bg-warning/15 text-warning hover:bg-warning/25 text-xs font-medium border border-warning/30 transition"
                            >
                              <X size={14} /> Desaprovar
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); duplicateOrcamento.mutate(orc.id); }}
                            className="flex items-center gap-1 h-8 px-3 rounded bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium border border-primary/30 transition"
                          >
                            <Copy size={14} /> Duplicar
                          </button>
                          {!orc.aprovado && (
                            <button
                              onClick={(e) => { e.stopPropagation(); if (window.confirm("Excluir orçamento e seus itens?")) deleteOrcamento.mutate(orc.id); }}
                              className="flex items-center gap-1 h-8 px-3 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 text-xs font-medium border border-destructive/30 transition"
                            >
                              <Trash2 size={14} /> Excluir
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Crie um orçamento para organizar os itens do pré-projeto.</p>
                )}
              </div>

              {/* Item form */}
              <div className="bg-primary/5 border-2 border-primary/20 rounded-lg p-3 space-y-2">
                <h4 className="text-xs font-semibold flex items-center gap-1"><Package size={12} /> {editItemId ? "Editar Item" : "Novo Item"} {activeOrcamentoId && activeOrc ? `— ${activeOrc.nome}` : ""}</h4>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <div className="col-span-2 md:col-span-1 space-y-0.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Descrição *</label>
                    <input value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Descrição do item" className="w-full h-8 px-2 text-xs bg-background border border-border rounded" />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quantidade</label>
                    <input type="number" value={itemQtd} onChange={e => setItemQtd(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" min={1} />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Custo (R$)</label>
                    <input type="number" value={itemCusto} onChange={e => setItemCusto(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" step="0.01" />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Venda (R$)</label>
                    <input type="number" value={itemVenda} onChange={e => setItemVenda(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" step="0.01" />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">RT/Comissão (R$)</label>
                    <input type="number" value={itemRt} onChange={e => setItemRt(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" step="0.01" />
                  </div>
                  <div className="flex gap-1 items-end">
                    <button onClick={() => saveCrmItem.mutate()} disabled={!itemDesc.trim()} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">{editItemId ? "Salvar" : "Adicionar"}</button>
                    {editItemId && <button onClick={resetItemForm} className="h-8 px-2 rounded bg-secondary text-secondary-foreground text-xs">Cancelar</button>}
                  </div>
                </div>
              </div>

              {(crmItens && crmItens.length > 0) && (
                <>
                  <div className="border-2 border-primary/15 rounded-lg overflow-hidden bg-card">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-primary/10">
                        <th className="text-left px-2.5 py-2 font-semibold border-b border-primary/15">Descrição</th>
                        <th className="text-center px-2.5 py-2 font-semibold border-b border-primary/15">Qtd</th>
                        <th className="text-right px-2.5 py-2 font-semibold border-b border-primary/15">Custo</th>
                        <th className="text-right px-2.5 py-2 font-semibold border-b border-primary/15">Venda</th>
                        <th className="text-right px-2.5 py-2 font-semibold border-b border-primary/15">RT/Comissão</th>
                        <th className="text-right px-2.5 py-2 font-semibold border-b border-primary/15">Subtotal</th>
                        <th className="text-center px-2.5 py-2 font-semibold border-b border-primary/15">Ações</th>
                      </tr></thead>
                      <tbody>
                        {crmItens.map(item => (
                          <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                            <td className="px-2.5 py-1.5">{item.descricao}</td>
                            <td className="px-2.5 py-1.5 text-center">{item.quantidade}</td>
                            <td className="px-2.5 py-1.5 text-right">R$ {Number(item.preco_custo).toFixed(2)}</td>
                            <td className="px-2.5 py-1.5 text-right">R$ {Number(item.preco_venda).toFixed(2)}</td>
                            <td className="px-2.5 py-1.5 text-right">R$ {Number((item as any).rt_comissao ?? 0).toFixed(2)}</td>
                            <td className="px-2.5 py-1.5 text-right font-medium">R$ {(Number(item.preco_venda) * Number(item.quantidade)).toFixed(2)}</td>
                            <td className="px-2.5 py-1.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => { setEditItemId(item.id); setItemDesc(item.descricao); setItemQtd(Number(item.quantidade)); setItemCusto(Number(item.preco_custo)); setItemVenda(Number(item.preco_venda)); setItemRt(Number((item as any).rt_comissao ?? 0)); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={12} /></button>
                                <button onClick={() => { if (window.confirm("Excluir item?")) deleteCrmItem.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-4 text-xs p-2.5 bg-primary/5 border border-primary/15 rounded-lg flex-wrap">
                    <span>Qtd Total: <strong className="text-foreground">{totalCrmQtd}</strong></span>
                    <span>Total Custo: <strong className="text-destructive">R$ {totalCrmCusto.toFixed(2)}</strong></span>
                    <span>Total Venda: <strong className="text-primary">R$ {totalCrmVenda.toFixed(2)}</strong></span>
                    <span>Total RT: <strong className="text-warning">R$ {totalCrmRt.toFixed(2)}</strong></span>
                    <span>Margem: <strong className="text-success">R$ {(totalCrmVenda - totalCrmCusto - totalCrmRt).toFixed(2)}</strong> ({totalCrmVenda > 0 ? (((totalCrmVenda - totalCrmCusto - totalCrmRt) / totalCrmVenda) * 100).toFixed(1) : "0.0"}%)</span>
                  </div>
                </>
              )}
              {(!crmItens || crmItens.length === 0) && <p className="text-muted-foreground text-xs text-center py-4">Nenhum item adicionado{activeOrcamentoId ? " neste orçamento" : ""}.</p>}

              {/* Simulação de Pagamento (dentro da aba Itens) */}
              {activeOrcamentoId && (
                <div className="bg-card border border-border rounded p-3 space-y-3">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5"><Calculator size={12} /> Simulação de Pagamento — {activeOrc?.nome}</h4>
                  <p className="text-[10px] text-muted-foreground">Ao converter para Projeto, as parcelas do orçamento aprovado serão geradas automaticamente no financeiro.</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Condição</label>
                      <select value={simCondicao} onChange={e => { setSimCondicao(e.target.value as any); if (e.target.value === "avista") setSimParcelas(1); setEditingParcelas(null); }} className="w-full h-8 px-2 text-xs bg-background border border-border rounded"><option value="avista">À Vista</option><option value="parcelado">Parcelado</option></select></div>
                    <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Forma de Pagamento</label>
                      <select value={simFormaPgto} onChange={e => setSimFormaPgto(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded"><option value="boleto">Boleto</option><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="cheque">Cheque</option></select></div>
                    {simCondicao === "parcelado" && (<>
                      <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nº de Parcelas</label><input type="number" value={simParcelas} onChange={e => { setSimParcelas(Math.max(1, Number(e.target.value))); setEditingParcelas(null); }} min={1} max={60} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
                      <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Entrada (R$)</label><input type="number" value={simEntrada} onChange={e => { setSimEntrada(Math.max(0, Number(e.target.value))); setEditingParcelas(null); }} step="0.01" min={0} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
                      <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Intervalo (dias)</label><input type="number" value={simIntervalo} onChange={e => { setSimIntervalo(Math.max(1, Number(e.target.value))); setEditingParcelas(null); }} min={1} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
                      <div className="space-y-0.5"><label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Juros % (opcional)</label><input type="number" value={simJuros} onChange={e => { setSimJuros(Math.max(0, Number(e.target.value))); setEditingParcelas(null); }} step="0.01" min={0} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
                    </>)}
                  </div>
                  <div className={`grid gap-2 ${simCondicao === "parcelado" ? "grid-cols-2 md:grid-cols-5" : "grid-cols-1 md:grid-cols-2"}`}>
                    <div className="bg-secondary/30 rounded p-2 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Venda</p><p className="text-sm font-bold text-foreground">R$ {simulacao.total.toFixed(2)}</p></div>
                    {simCondicao === "parcelado" && (<>
                      <div className="bg-secondary/30 rounded p-2 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Entrada</p><p className="text-sm font-bold text-foreground">R$ {simulacao.entrada.toFixed(2)}</p></div>
                      <div className="bg-secondary/30 rounded p-2 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valor Parcela</p><p className="text-sm font-bold text-primary">R$ {simulacao.valorParcela.toFixed(2)}</p></div>
                      <div className="bg-secondary/30 rounded p-2 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Parcelas</p><p className="text-sm font-bold text-foreground">{simParcelas}x</p></div>
                      <div className="bg-primary/10 rounded p-2 text-center border border-primary/20"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Final</p><p className="text-sm font-bold text-primary">R$ {simulacao.totalFinal.toFixed(2)}</p></div>
                    </>)}
                  </div>
                  {parcelasParaExibir.length > 0 && (
                    <div className="border border-border rounded overflow-hidden max-h-[200px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="bg-secondary/60"><th className="text-center px-2.5 py-1.5 font-semibold border-b border-border">Parcela</th><th className="text-right px-2.5 py-1.5 font-semibold border-b border-border">Valor</th><th className="text-center px-2.5 py-1.5 font-semibold border-b border-border">Data Prevista</th></tr></thead>
                        <tbody>
                          {simulacao.entrada > 0 && (<tr className="border-b border-border bg-primary/5"><td className="px-2.5 py-1 text-center font-medium">Entrada</td><td className="px-2.5 py-1 text-right">R$ {simulacao.entrada.toFixed(2)}</td><td className="px-2.5 py-1 text-center">{new Date().toLocaleDateString("pt-BR")}</td></tr>)}
                          {parcelasParaExibir.map((p, idx) => (
                            <tr key={p.numero} className="border-b border-border last:border-b-0">
                              <td className="px-2.5 py-1 text-center">{p.numero}/{simParcelas}</td>
                              <td className="px-2.5 py-1 text-right"><input type="number" value={p.valor.toFixed(2)} onChange={e => handleEditParcela(idx, "valor", e.target.value)} className="w-24 h-6 px-1 text-xs text-right bg-background border border-border rounded" step="0.01" /></td>
                              <td className="px-2.5 py-1 text-center"><input type="text" value={p.data} onChange={e => handleEditParcela(idx, "data", e.target.value)} className="w-24 h-6 px-1 text-xs text-center bg-background border border-border rounded" placeholder="dd/mm/aaaa" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <button onClick={handleSaveSimulacao} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105">Salvar Simulação</button>
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

  /* ─── LIST VIEW ─── */
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">CRM — Gestão de Clientes</h1>
        </div>
        <button onClick={() => { resetForm(); setViewMode("new"); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Novo Cliente
        </button>
      </div>

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
                <option value="lead">Lead</option><option value="contato">Em Contato</option><option value="proposta">Proposta Enviada</option><option value="projeto">Projeto</option>
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
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nome</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">E-mail</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Telefone</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Origem</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Arquiteto</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => openDetail(c)}>
                  <td className="px-2.5 py-1.5 font-medium">{c.nome}</td>
                  <td className="px-2.5 py-1.5">{c.email ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{c.telefone ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{origemLabels[c.origem as OrigemLead] ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{(c as any).fornecedores?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    <select
                      value={c.status_crm ?? "lead"}
                      onChange={e => { e.stopPropagation(); changeStatusInline.mutate({ id: c.id, newStatus: e.target.value as StatusCRM, old: c }); }}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium border-0 cursor-pointer appearance-none text-center ${statusColors[c.status_crm as StatusCRM]} bg-transparent`}
                      style={{ backgroundImage: "none" }}
                    >
                      <option value="lead">Lead</option>
                      <option value="contato">Em Contato</option>
                      <option value="proposta">Proposta Enviada</option>
                      <option value="projeto">Projeto</option>
                    </select>
                  </td>
                  <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openDetail(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Eye size={13} /></button>
                      <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                      <button onClick={() => { if (window.confirm("Excluir cliente?")) remove.mutate(c.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-4 text-muted-foreground">Nenhum cliente encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    await onSave({ nome, email: email || null, telefone: telefone || null, endereco: endereco || null, endereco_obra: enderecoObra || null, origem, status_crm: statusCrm, arquiteto_id: (origem === "arquiteto" && arquitetoIdOrigem) ? arquitetoIdOrigem : null, notas: obsOrigem || null });
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
          <option value="lead">Lead</option><option value="contato">Em Contato</option><option value="proposta">Proposta Enviada</option><option value="projeto">Projeto</option>
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
