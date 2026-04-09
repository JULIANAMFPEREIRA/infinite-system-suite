import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FolderKanban, Plus, Pencil, Trash2, AlertTriangle, Search, ArrowLeft, Check, DollarSign, Filter } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useProjetos, useClientes, useArquitetos, useCreateProjeto, useUpdateProjeto, useProjetoItens, useCreateProjetoItem, useDeleteProjetoItem } from "@/hooks/useProjetos";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useNecessidadesPendentesCount, useCreateNecessidade, useCheckEstoque, useNecessidadesCompra } from "@/hooks/useNecessidadesCompra";
import { useFormasPagamento } from "@/hooks/useCategorias";
import { useVisitasTecnicas, useCreateVisita, useUpdateVisita } from "@/hooks/useVisitasTecnicas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Database } from "@/integrations/supabase/types";

type StatusProjeto = Database["public"]["Enums"]["status_projeto"];
type TipoItem = Database["public"]["Enums"]["tipo_projeto_item"];

const statusLabels: Record<StatusProjeto, string> = {
  lead: "Lead", proposta: "Proposta", orcamento: "Orçamento", aprovado: "Aprovado",
  vendido: "Vendido", em_andamento: "Em Andamento", infraestrutura: "Infraestrutura",
  instalacao: "Instalação", cabeamento: "Cabeamento", programacao: "Programação",
  personalizacao: "Personalização", concluido: "Concluído",
  pos_venda: "Pós-Venda", cancelado: "Cancelado"
};
const statusColors: Record<StatusProjeto, string> = {
  lead: "bg-secondary text-secondary-foreground", proposta: "bg-warning/15 text-warning",
  orcamento: "bg-secondary text-secondary-foreground", aprovado: "bg-success/15 text-success",
  vendido: "bg-primary/15 text-primary", em_andamento: "bg-primary/15 text-primary",
  infraestrutura: "bg-amber-500/15 text-amber-600", instalacao: "bg-blue-500/15 text-blue-600",
  cabeamento: "bg-violet-500/15 text-violet-600", programacao: "bg-cyan-500/15 text-cyan-600",
  personalizacao: "bg-pink-500/15 text-pink-600",
  concluido: "bg-info/15 text-info", pos_venda: "bg-accent text-accent-foreground",
  cancelado: "bg-destructive/15 text-destructive"
};
const statusOptions: StatusProjeto[] = ["infraestrutura", "instalacao", "cabeamento", "programacao", "personalizacao", "concluido", "pos_venda", "cancelado"];
const projetoIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ProjetoState = ({
  title,
  description,
  onBack,
}: {
  title: string;
  description: string;
  onBack: () => void;
}) => (
  <div className="space-y-4 animate-fade-in">
    <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
      <ArrowLeft size={14} /> Voltar para lista
    </button>
    <div className="bg-card border border-border rounded-lg p-6 text-center space-y-2">
      <h1 className="text-lg font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);

const Projetos = () => {
  const navigate = useNavigate();
  const { id: routeProjetoId } = useParams<{ id?: string }>();
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: projetos, isLoading, error: projetosError } = useProjetos();
  const { data: pendenciaCounts } = useNecessidadesPendentesCount();
  const { data: clientes } = useClientes();
  const { data: arquitetos } = useArquitetos();
  const { data: formasPagamento } = useFormasPagamento();
  const createProjeto = useCreateProjeto();
  const updateProjeto = useUpdateProjeto();

  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusProjeto | "todos">("todos");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [arquitetoId, setArquitetoId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataPrevisao, setDataPrevisao] = useState("");
  const [enderecoObra, setEnderecoObra] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nome: string } | null>(null);
  const [observacoesPagamento, setObservacoesPagamento] = useState("");
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState("lista");

  const statusCounts = useMemo(() => {
    const all = projetos ?? [];
    return {
      todos: all.length,
      infraestrutura: all.filter(p => p.status === "infraestrutura").length,
      instalacao: all.filter(p => p.status === "instalacao").length,
      cabeamento: all.filter(p => p.status === "cabeamento").length,
      programacao: all.filter(p => p.status === "programacao").length,
      personalizacao: all.filter(p => p.status === "personalizacao").length,
      concluido: all.filter(p => p.status === "concluido").length,
      pos_venda: all.filter(p => p.status === "pos_venda").length,
      cancelado: all.filter(p => p.status === "cancelado").length,
    };
  }, [projetos]);

  const pendenciasCount = Object.values(pendenciaCounts ?? {}).reduce((a: number, b: number) => a + b, 0);
  const detailProjetoId = routeProjetoId ?? selectedProjetoId;
  const shouldShowDetail = viewMode === "detail" || !!routeProjetoId;
  const isValidProjetoId = !routeProjetoId || projetoIdPattern.test(routeProjetoId);
  const currentProjeto = useMemo(
    () => (detailProjetoId ? projetos?.find(p => p.id === detailProjetoId) ?? null : null),
    [detailProjetoId, projetos]
  );

  const fillProjetoForm = (p: any) => {
    setEditId(p.id); setNome(p.nome); setDescricao(p.descricao ?? "");
    setClienteId(p.cliente_id ?? ""); setArquitetoId(p.arquiteto_id ?? "");
    setDataInicio(p.data_inicio ?? ""); setDataPrevisao(p.data_previsao ?? "");
    setEnderecoObra(p.endereco_obra ?? ""); setFormaPagamento(p.forma_pagamento ?? "");
    setNumeroParcelas(p.numero_parcelas ?? 1); setObservacoesPagamento(p.observacoes_pagamento ?? "");
    setShowForm(true); setSelectedProjetoId(p.id); setViewMode("detail");
  };

  useEffect(() => {
    if (!routeProjetoId || !currentProjeto || selectedProjetoId === routeProjetoId) return;
    fillProjetoForm(currentProjeto);
  }, [routeProjetoId, currentProjeto, selectedProjetoId]);

  const resetForm = () => {
    setNome(""); setDescricao(""); setClienteId(""); setArquitetoId("");
    setDataInicio(""); setDataPrevisao(""); setEnderecoObra(""); setFormaPagamento("");
    setNumeroParcelas(1); setObservacoesPagamento("");
    setEditId(null); setShowForm(false); setSelectedProjetoId(null);
    setViewMode("list");
    navigate("/projetos");
  };

  const openEdit = (p: any) => {
    fillProjetoForm(p);
    navigate(`/projetos/${p.id}`);
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      const payload = {
        nome, descricao: descricao || null, cliente_id: clienteId || null,
        arquiteto_id: arquitetoId || null, data_inicio: dataInicio || null,
        data_previsao: dataPrevisao || null, endereco_obra: enderecoObra || null,
        forma_pagamento: formaPagamento || null, numero_parcelas: numeroParcelas,
        observacoes_pagamento: observacoesPagamento || null,
      };
      if (editId) {
        await updateProjeto.mutateAsync({ id: editId, ...payload });
        toast.success("Projeto atualizado");
      } else {
        const data = await createProjeto.mutateAsync({ ...payload, status: "orcamento" });
        setSelectedProjetoId(data.id); setEditId(data.id);
        setViewMode("detail");
        navigate(`/projetos/${data.id}`);
        toast.success("Projeto criado! Adicione itens abaixo.");
        return;
      }
    } catch (err: any) { toast.error(err.message); }
  };

  const handleApprove = async (projetoId: string, projeto: any) => {
    try {
      await supabase.from("projetos").update({ status: "aprovado" }).eq("id", projetoId);
      const venda = projeto.venda_total ?? 0;
      const parcelas = projeto.numero_parcelas ?? 1;
      if (venda > 0 && empresaId) {
        const valorParcela = Math.round((venda / parcelas) * 100) / 100;
        const today = new Date();
        const inserts = Array.from({ length: parcelas }, (_, i) => {
          const dt = new Date(today); dt.setMonth(dt.getMonth() + i + 1);
          return {
            empresa_id: empresaId, projeto_id: projetoId, cliente_id: projeto.cliente_id,
            descricao: `Parcela ${i + 1}/${parcelas} — ${projeto.nome}`,
            valor: valorParcela, parcela: i + 1,
            data_vencimento: dt.toISOString().split("T")[0], status: "pendente" as const,
          };
        });
        await supabase.from("financeiro_receber").insert(inserts);
      }
      const { data: itens } = await supabase.from("projeto_itens").select("*").eq("projeto_id", projetoId);
      if (itens && projeto.arquiteto_id && empresaId) {
        const comissoes = itens.filter(i => (i.rt_percentual ?? 0) > 0).map(i => ({
          empresa_id: empresaId, projeto_id: projetoId, fornecedor_id: projeto.arquiteto_id!,
          projeto_item_id: i.id, percentual: i.rt_percentual,
          valor: ((i.preco_venda ?? 0) * (i.quantidade ?? 1) * (i.rt_percentual ?? 0)) / 100,
          status: "pendente" as const,
        }));
        if (comissoes.length > 0) await supabase.from("comissoes").insert(comissoes);
      }
      qc.invalidateQueries({ queryKey: ["projetos"] });
      toast.success("Projeto aprovado! Parcelas e comissões geradas.");
    } catch (err: any) { toast.error(err.message); }
  };

  const changeStatus = useMutation({
    mutationFn: async ({ id, status, projeto }: { id: string; status: StatusProjeto; projeto?: any }) => {
      if (status === "aprovado" && projeto) { await handleApprove(id, projeto); return; }
      const { error } = await supabase.from("projetos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projetos"] }); toast.success("Status atualizado"); },
    onError: (err: any) => toast.error(err.message),
  });

  const removeProjeto = useMutation({
    mutationFn: async (id: string) => {
      // Cascade delete all linked data
      await supabase.from("visitas_tecnicas").delete().eq("projeto_id", id);
      await supabase.from("comissoes").delete().eq("projeto_id", id);
      await supabase.from("financeiro_receber").delete().eq("projeto_id", id);
      await supabase.from("financeiro_pagar").delete().eq("projeto_id", id);
      await supabase.from("necessidades_compra").delete().eq("projeto_id", id);
      await supabase.from("compras").delete().eq("projeto_id", id);
      await supabase.from("contratos").delete().eq("projeto_id", id);
      await supabase.from("estoque_itens").delete().eq("projeto_id", id);
      await supabase.from("projeto_itens").delete().eq("projeto_id", id);
      // Audit log
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const projeto = projetos?.find(p => p.id === id);
        await supabase.from("audit_logs").insert({
          tabela: "projetos", registro_id: id, acao: "exclusao",
          usuario_id: user.id, empresa_id: empresaId,
          dados_anteriores: projeto ? JSON.parse(JSON.stringify(projeto)) : null,
        });
      }
      const { error } = await supabase.from("projetos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projetos"] }); toast.success("Projeto e dados vinculados excluídos"); resetForm(); setDeleteTarget(null); },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = (projetos ?? [])
    .filter(p => {
      if (filterStatus === "todos") return p.status !== "cancelado";
      return p.status === filterStatus;
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const fmt = (v: number | null) => `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  // DETAIL VIEW
  if (shouldShowDetail) {
    if (!isValidProjetoId) {
      return <ProjetoState title="Projeto não encontrado" description="O ID informado é inválido." onBack={resetForm} />;
    }

    if (projetosError) {
      return <ProjetoState title="Erro ao carregar projeto" description="Não foi possível carregar os dados do projeto." onBack={resetForm} />;
    }

    if (isLoading || (routeProjetoId && selectedProjetoId !== routeProjetoId)) {
      return <ProjetoState title="Carregando projeto..." description="Aguarde enquanto buscamos os dados do projeto." onBack={resetForm} />;
    }

    if (!currentProjeto || !detailProjetoId) {
      return <ProjetoState title="Projeto não encontrado" description="Verifique se o projeto ainda existe antes de tentar abrir novamente." onBack={resetForm} />;
    }

    const isCrmGenerated = !!currentProjeto.orcamento_id;

    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={resetForm} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition">
            <ArrowLeft size={14} /> Voltar para lista
          </button>
          <span className="text-muted-foreground">|</span>
          <h1 className="text-lg font-bold text-foreground">{nome || currentProjeto.nome || "Projeto"}</h1>
          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusColors[currentProjeto.status as StatusProjeto]}`}>
            {statusLabels[currentProjeto.status as StatusProjeto]}
          </span>
          {isCrmGenerated && (
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
              ⚡ Gerado automaticamente via CRM
            </span>
          )}
        </div>

        <Tabs defaultValue="resumo" className="w-full">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-secondary/40 p-1">
            <TabsTrigger value="resumo" className="text-xs">Dados do Projeto</TabsTrigger>
            <TabsTrigger value="itens" className="text-xs">Itens do Projeto</TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs">Financeiro</TabsTrigger>
            <TabsTrigger value="compras" className="text-xs">Compras</TabsTrigger>
            <TabsTrigger value="comissoes" className="text-xs">Comissões (RT)</TabsTrigger>
            <TabsTrigger value="visitas" className="text-xs">Visitas Técnicas</TabsTrigger>
            <TabsTrigger value="cronograma" className="text-xs">Cronograma</TabsTrigger>
            <TabsTrigger value="contratos" className="text-xs">Contratos</TabsTrigger>
            <TabsTrigger value="anotacoes" className="text-xs">Anotações</TabsTrigger>
            <TabsTrigger value="imagens" className="text-xs">Imagens</TabsTrigger>
            <TabsTrigger value="documentos" className="text-xs">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo">
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Dados do Projeto</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Nome *</label><input value={nome} onChange={e => setNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Descrição</label><input value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Cliente</label>
                  <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                    <option value="">Selecionar...</option>
                    {clientes?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Arquiteto</label>
                  <select value={arquitetoId} onChange={e => setArquitetoId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                    <option value="">Selecionar...</option>
                    {arquitetos?.map(a => <option key={a.id} value={a.id}>{a.nome} ({a.rt_percentual ?? 0}%)</option>)}
                  </select>
                </div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Endereço da Obra</label><input value={enderecoObra} onChange={e => setEnderecoObra(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Início</label><input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data de Fechamento</label><input type="date" value={dataPrevisao} onChange={e => setDataPrevisao(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1 col-span-full"><label className="text-[11px] text-muted-foreground">Observações Pagamento</label><input value={observacoesPagamento} onChange={e => setObservacoesPagamento(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={updateProjeto.isPending} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition disabled:opacity-50">Salvar Alterações</button>
                {currentProjeto.status !== "aprovado" && (
                  <button onClick={() => changeStatus.mutate({ id: detailProjetoId, status: "aprovado", projeto: currentProjeto })} className="px-4 py-1.5 rounded bg-success text-white text-xs font-medium hover:brightness-105 transition">Aprovar Projeto</button>
                )}
                <button onClick={() => setDeleteTarget({ id: detailProjetoId, nome: currentProjeto.nome })} className="px-4 py-1.5 rounded bg-destructive text-destructive-foreground text-xs font-medium hover:brightness-105 transition">Excluir</button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="itens">
            <div className="bg-card border border-border rounded-lg p-4">
              <ProjetoItensSection projetoId={detailProjetoId} projetoNome={nome || currentProjeto.nome} clienteId={clienteId || currentProjeto.cliente_id || ""} empresaId={empresaId} numeroParcelas={numeroParcelas} isCrmGenerated={isCrmGenerated} />
            </div>
          </TabsContent>

          <TabsContent value="visitas">
            <div className="bg-card border border-border rounded-lg p-4">
              <VisitasTecnicasSection projetoId={detailProjetoId} />
            </div>
          </TabsContent>

          <TabsContent value="financeiro">
            <div className="bg-card border border-border rounded-lg p-4">
              <ProjetoFinanceiroSection projetoId={detailProjetoId} projetoNome={nome || currentProjeto.nome} clienteId={clienteId || currentProjeto.cliente_id || ""} />
            </div>
          </TabsContent>

          <TabsContent value="compras">
            <div className="bg-card border border-border rounded-lg p-4">
              <ProjetoComprasSection projetoId={detailProjetoId} />
            </div>
          </TabsContent>

          <TabsContent value="comissoes">
            <div className="bg-card border border-border rounded-lg p-4">
              <ProjetoComissoesSection projetoId={detailProjetoId} arquitetoId={arquitetoId || currentProjeto.arquiteto_id || ""} />
            </div>
          </TabsContent>

          <TabsContent value="cronograma">
            <div className="bg-card border border-border rounded-lg p-4">
              <ProjetoCronogramaSection projeto={currentProjeto} dataInicio={dataInicio} dataPrevisao={dataPrevisao} />
            </div>
          </TabsContent>

          <TabsContent value="contratos">
            <div className="bg-card border border-border rounded-lg p-4">
              <ProjetoContratosSection projetoId={detailProjetoId} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Projetos</h1>
          <span className="text-xs text-muted-foreground">({statusCounts.todos})</span>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); setMainTab("lista"); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Novo Projeto
        </button>
      </div>

      {/* Status counters - same pattern as CRM */}
      <div className="grid grid-cols-11 gap-1.5">
        {([
          { key: "todos" as const, label: "Todos", count: statusCounts.todos - statusCounts.cancelado, color: "bg-secondary text-secondary-foreground" },
          { key: "infraestrutura" as const, label: "Infra", count: statusCounts.infraestrutura, color: "bg-amber-500/15 text-amber-600" },
          { key: "instalacao" as const, label: "Instalação", count: statusCounts.instalacao, color: "bg-blue-500/15 text-blue-600" },
          { key: "cabeamento" as const, label: "Cabeam.", count: statusCounts.cabeamento, color: "bg-violet-500/15 text-violet-600" },
          { key: "programacao" as const, label: "Program.", count: statusCounts.programacao, color: "bg-cyan-500/15 text-cyan-600" },
          { key: "personalizacao" as const, label: "Person.", count: statusCounts.personalizacao, color: "bg-pink-500/15 text-pink-600" },
          { key: "concluido" as const, label: "Concluído", count: statusCounts.concluido, color: "bg-info/15 text-info" },
          { key: "pos_venda" as const, label: "Pós-Venda", count: statusCounts.pos_venda, color: "bg-accent text-accent-foreground" },
          { key: "cancelado" as const, label: "Cancelado", count: statusCounts.cancelado, color: "bg-destructive/15 text-destructive" },
        ] as const).map(s => (
          <button key={s.key} onClick={() => { setFilterStatus(s.key); setMainTab("lista"); }} className={`rounded px-1 py-2 text-center transition ${filterStatus === s.key && mainTab === "lista" ? "ring-2 ring-primary" : "hover:opacity-80"} ${s.color}`}>
            <div className="text-lg font-bold leading-none">{s.count}</div>
            <div className="text-[9px] font-medium mt-0.5 truncate">{s.label}</div>
          </button>
        ))}
        <button
          onClick={() => setMainTab(mainTab === "pendencias" ? "lista" : "pendencias")}
          className={`rounded px-1 py-2 text-center transition ${mainTab === "pendencias" ? "ring-2 ring-warning" : "hover:opacity-80"} bg-warning/15 text-warning`}
        >
          <div className="text-lg font-bold leading-none">{pendenciasCount}</div>
          <div className="text-[9px] font-medium mt-0.5 truncate">Pendências</div>
        </button>
        <button
          onClick={() => setMainTab(mainTab === "financeiro_global" ? "lista" : "financeiro_global")}
          className={`rounded px-1 py-2 text-center transition ${mainTab === "financeiro_global" ? "ring-2 ring-primary" : "hover:opacity-80"} bg-success/15 text-success`}
        >
          <div className="text-lg font-bold leading-none"><DollarSign size={18} className="mx-auto" /></div>
          <div className="text-[9px] font-medium mt-0.5 truncate">Financeiro</div>
        </button>
      </div>

      {mainTab === "financeiro_global" && (
        <FinanceiroGlobalSection projetos={projetos ?? []} empresaId={empresaId} />
      )}

      {mainTab === "pendencias" && (
        <PendenciasSection projetos={projetos ?? []} pendenciaCounts={pendenciaCounts ?? {}} navigate={navigate} />
      )}

      {mainTab !== "financeiro_global" && mainTab !== "pendencias" && (
        <>
          {showForm && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Novo Projeto</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Nome *</label><input value={nome} onChange={e => setNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Descrição</label><input value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Cliente</label>
                  <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                    <option value="">Selecionar...</option>
                    {clientes?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Arquiteto</label>
                  <select value={arquitetoId} onChange={e => setArquitetoId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                    <option value="">Selecionar...</option>
                    {arquitetos?.map(a => <option key={a.id} value={a.id}>{a.nome} ({a.rt_percentual ?? 0}%)</option>)}
                  </select>
                </div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Endereço da Obra</label><input value={enderecoObra} onChange={e => setEnderecoObra(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={createProjeto.isPending} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition disabled:opacity-50">Criar Projeto</button>
                <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition">Cancelar</button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground text-xs">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">Nenhum projeto encontrado.</div>
          ) : (
            <div className="border border-border rounded overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/60">
                      <th className="text-left px-2.5 py-2 font-semibold text-foreground border-b border-border">Nome</th>
                      <th className="text-left px-2.5 py-2 font-semibold text-foreground border-b border-border">Cliente</th>
                      <th className="text-left px-2.5 py-2 font-semibold text-foreground border-b border-border">Arquiteto</th>
                      <th className="text-center px-2.5 py-2 font-semibold text-foreground border-b border-border">Status</th>
                      <th className="text-right px-2.5 py-2 font-semibold text-foreground border-b border-border">Custo</th>
                      <th className="text-right px-2.5 py-2 font-semibold text-foreground border-b border-border">Venda</th>
                      <th className="text-right px-2.5 py-2 font-semibold text-foreground border-b border-border">Margem</th>
                      <th className="text-center px-2.5 py-2 font-semibold text-foreground border-b border-border">Pend.</th>
                      <th className="text-center px-2.5 py-2 font-semibold text-foreground border-b border-border">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => (
                      <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer transition-colors" onClick={() => openEdit(p)}>
                        <td className="px-2.5 py-1.5 text-foreground font-medium">{p.nome}</td>
                        <td className="px-2.5 py-1.5 text-foreground">{(p.clientes as any)?.nome ?? "—"}</td>
                        <td className="px-2.5 py-1.5 text-foreground">{(p.fornecedores as any)?.nome ?? "—"}</td>
                        <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                          <select
                            value={p.status ?? "orcamento"}
                            onChange={e => changeStatus.mutate({ id: p.id, status: e.target.value as StatusProjeto, projeto: p })}
                            className={`px-1.5 py-0.5 rounded text-[11px] font-medium border-0 cursor-pointer ${statusColors[p.status as StatusProjeto]}`}
                          >
                            {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                          </select>
                        </td>
                        <td className="px-2.5 py-1.5 text-right text-foreground">{fmt(p.custo_previsto)}</td>
                        <td className="px-2.5 py-1.5 text-right text-foreground font-medium">{fmt(p.venda_total)}</td>
                        <td className="px-2.5 py-1.5 text-right">
                          <span className={(p.margem_prevista ?? 0) > 0 ? "text-success" : "text-destructive"}>{(p.margem_prevista ?? 0).toFixed(1)}%</span>
                        </td>
                        <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                          {(pendenciaCounts?.[p.id] ?? 0) > 0 ? (
                            <button onClick={() => navigate(`/itens-comprar?projeto=${p.id}`)} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-destructive/15 text-destructive text-[11px] font-medium hover:bg-destructive/25 transition">
                              <AlertTriangle size={11} /> {pendenciaCounts![p.id]}
                            </button>
                          ) : <span className="text-muted-foreground text-[11px]">—</span>}
                        </td>
                        <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEdit(p)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                            <button onClick={() => setDeleteTarget({ id: p.id, nome: p.nome })} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Excluir Projeto Permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação irá excluir permanentemente o projeto <strong>"{deleteTarget?.nome}"</strong> e todos os dados vinculados (financeiro, comissões RT, compras, visitas técnicas, contratos, estoque e itens). Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && removeProjeto.mutate(deleteTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// ======== FINANCEIRO GLOBAL ========
const FinanceiroGlobalSection = ({ projetos, empresaId }: { projetos: any[]; empresaId: string | null }) => {
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const { data: clientes } = useClientes();
  const { data: receber } = useQuery({ queryKey: ["financeiro_receber_all"], queryFn: async () => { const { data, error } = await supabase.from("financeiro_receber").select("*, clientes(nome), projetos(nome)").order("data_vencimento"); if (error) throw error; return data; } });
  const { data: pagar } = useQuery({ queryKey: ["financeiro_pagar_all"], queryFn: async () => { const { data, error } = await supabase.from("financeiro_pagar").select("*, fornecedores(nome), projetos(nome)").order("data_vencimento"); if (error) throw error; return data; } });
  const { data: compras } = useQuery({ queryKey: ["compras_all_global"], queryFn: async () => { const { data, error } = await supabase.from("compras").select("*, projetos(nome)").order("created_at", { ascending: false }); if (error) throw error; return data; } });

  const filterByDate = (items: any[], dateField: string) => (items ?? []).filter(item => { const d = item[dateField]; if (!d) return true; if (filtroMes && new Date(d).getMonth() + 1 !== Number(filtroMes)) return false; if (filtroAno && new Date(d).getFullYear() !== Number(filtroAno)) return false; return true; });
  const filteredReceber = filterByDate(receber ?? [], "data_vencimento").filter(r => { if (filtroCliente && r.cliente_id !== filtroCliente) return false; if (filtroStatus !== "todos" && r.status !== filtroStatus) return false; return true; });
  const filteredPagar = filterByDate(pagar ?? [], "data_vencimento").filter(r => { if (filtroStatus !== "todos" && r.status !== filtroStatus) return false; return true; });

  const totalReceber = filteredReceber.reduce((a: number, r: any) => a + (r.valor ?? 0), 0);
  const totalPagar = filteredPagar.reduce((a: number, r: any) => a + (r.valor ?? 0), 0);
  const totalVendido = projetos.reduce((a, p) => a + (p.venda_total ?? 0), 0);
  const totalCusto = projetos.reduce((a, p) => a + (p.custo_previsto ?? 0), 0);
  const totalCompras = (compras ?? []).reduce((a: number, c: any) => a + (c.valor_total ?? 0), 0);
  const saldo = totalReceber - totalPagar;
  const faltaComprar = totalCusto - totalCompras;
  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><DollarSign size={16} /> Visão Financeira Global</h3>
      <div className="flex gap-2 flex-wrap items-end">
        <div className="space-y-1"><label className="text-[10px] text-muted-foreground uppercase font-semibold">Cliente</label>
          <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} className="h-8 px-2 text-xs bg-background border border-border rounded min-w-[150px]"><option value="">Todos</option>{clientes?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></div>
        <div className="space-y-1"><label className="text-[10px] text-muted-foreground uppercase font-semibold">Mês</label>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className="h-8 px-2 text-xs bg-background border border-border rounded"><option value="">Todos</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i).toLocaleString("pt-BR", { month: "long" })}</option>)}</select></div>
        <div className="space-y-1"><label className="text-[10px] text-muted-foreground uppercase font-semibold">Ano</label>
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className="h-8 px-2 text-xs bg-background border border-border rounded">{[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}</select></div>
        <div className="space-y-1"><label className="text-[10px] text-muted-foreground uppercase font-semibold">Status</label>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="h-8 px-2 text-xs bg-background border border-border rounded"><option value="todos">Todos</option><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="vencido">Vencido</option></select></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center"><div className="text-[10px] text-muted-foreground font-semibold uppercase">A Receber</div><div className="text-sm font-bold text-success">{fmt(totalReceber)}</div></div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center"><div className="text-[10px] text-muted-foreground font-semibold uppercase">A Pagar</div><div className="text-sm font-bold text-destructive">{fmt(totalPagar)}</div></div>
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center"><div className="text-[10px] text-muted-foreground font-semibold uppercase">Total Vendido</div><div className="text-sm font-bold text-primary">{fmt(totalVendido)}</div></div>
        <div className="bg-secondary border border-border rounded-lg p-3 text-center"><div className="text-[10px] text-muted-foreground font-semibold uppercase">Custo Total</div><div className="text-sm font-bold text-foreground">{fmt(totalCusto)}</div></div>
        <div className={`border rounded-lg p-3 text-center ${saldo >= 0 ? "bg-success/10 border-success/20" : "bg-destructive/10 border-destructive/20"}`}><div className="text-[10px] text-muted-foreground font-semibold uppercase">Saldo</div><div className={`text-sm font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>{fmt(saldo)}</div></div>
        <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center"><div className="text-[10px] text-muted-foreground font-semibold uppercase">Falta Comprar</div><div className="text-sm font-bold text-warning">{fmt(Math.max(0, faltaComprar))}</div></div>
      </div>
      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-secondary/60">
            <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
            <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Cliente</th>
            <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Venda</th>
            <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Custo</th>
            <th className="text-right px-2.5 py-2 font-semibold border-b border-border">A Receber</th>
            <th className="text-right px-2.5 py-2 font-semibold border-b border-border">A Pagar</th>
            <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Falta Comprar</th>
          </tr></thead>
          <tbody>
            {projetos.filter(p => !filtroCliente || p.cliente_id === filtroCliente).map(p => {
              const pReceber = filteredReceber.filter((r: any) => r.projeto_id === p.id).reduce((a: number, r: any) => a + (r.valor ?? 0), 0);
              const pPagar = filteredPagar.filter((r: any) => r.projeto_id === p.id).reduce((a: number, r: any) => a + (r.valor ?? 0), 0);
              const pCompras = (compras ?? []).filter((c: any) => c.projeto_id === p.id).reduce((a: number, c: any) => a + (c.valor_total ?? 0), 0);
              const falta = Math.max(0, (p.custo_previsto ?? 0) - pCompras);
              return (
                <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5 font-medium">{p.nome}</td>
                  <td className="px-2.5 py-1.5">{(p.clientes as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmt(p.venda_total ?? 0)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmt(p.custo_previsto ?? 0)}</td>
                  <td className="px-2.5 py-1.5 text-right text-success">{fmt(pReceber)}</td>
                  <td className="px-2.5 py-1.5 text-right text-destructive">{fmt(pPagar)}</td>
                  <td className="px-2.5 py-1.5 text-right text-warning">{falta > 0 ? fmt(falta) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ======== PENDÊNCIAS ========
const PendenciasSection = ({ projetos, pendenciaCounts, navigate }: { projetos: any[]; pendenciaCounts: Record<string, number>; navigate: any }) => {
  const projetosComPendencia = projetos.filter(p => (pendenciaCounts[p.id] ?? 0) > 0);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><AlertTriangle size={16} className="text-warning" /> Projetos com Pendências de Compra</h3>
      {projetosComPendencia.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">Nenhuma pendência encontrada.</p>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-warning/10">
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Cliente</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Itens Pendentes</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ação</th>
            </tr></thead>
            <tbody>
              {projetosComPendencia.map(p => (
                <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5 font-medium">{p.nome}</td>
                  <td className="px-2.5 py-1.5">{(p.clientes as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center"><span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive text-[11px] font-medium">{pendenciaCounts[p.id]}</span></td>
                  <td className="px-2.5 py-1.5 text-center"><button onClick={() => navigate(`/itens-comprar?projeto=${p.id}`)} className="px-2 py-1 rounded bg-primary text-primary-foreground text-[11px] hover:brightness-105">Ver Itens</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ======== ITENS DO PROJETO ========
const ProjetoItensSection = ({ projetoId, projetoNome, clienteId, empresaId, numeroParcelas, isCrmGenerated }: { projetoId: string; projetoNome: string; clienteId: string; empresaId: string | null; numeroParcelas: number; isCrmGenerated?: boolean }) => {
  const qc = useQueryClient();
  const { data: itens, isLoading } = useProjetoItens(projetoId);
  const createItem = useCreateProjetoItem();
  const deleteItem = useDeleteProjetoItem();
  const updateProjeto = useUpdateProjeto();
  const createNecessidade = useCreateNecessidade();
  const checkEstoque = useCheckEstoque();

  const { data: produtos } = useQuery({
    queryKey: ["produtos_autocomplete", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("id, nome, preco_custo, preco_venda").order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const [desc, setDesc] = useState("");
  const [tipo, setTipo] = useState<TipoItem>("produto");
  const [qtd, setQtd] = useState(1);
  const [custo, setCusto] = useState(0);
  const [venda, setVenda] = useState(0);
  const [rt, setRt] = useState(0);
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showGerarParcelas, setShowGerarParcelas] = useState(false);
  const [gerarQtdParcelas, setGerarQtdParcelas] = useState(numeroParcelas);

  const filteredProdutos = produtos?.filter(p => p.nome.toLowerCase().includes(desc.toLowerCase())) ?? [];

  const selectProduto = (p: any) => {
    setDesc(p.nome); setCusto(p.preco_custo ?? 0); setVenda(p.preco_venda ?? 0);
    setProdutoId(p.id); setShowSuggestions(false);
  };

  const totalCusto = itens?.reduce((acc, i) => acc + (i.quantidade ?? 1) * (i.preco_custo ?? 0), 0) ?? 0;
  const totalVenda = itens?.reduce((acc, i) => acc + (i.quantidade ?? 1) * (i.preco_venda ?? 0), 0) ?? 0;
  const margem = totalVenda > 0 ? ((totalVenda - totalCusto) / totalVenda) * 100 : 0;
  const lucro = totalVenda - totalCusto;

  const handleAddItem = async () => {
    if (!desc.trim()) { toast.error("Descrição obrigatória"); return; }
    try {
      const newItem = await createItem.mutateAsync({ projeto_id: projetoId, descricao: desc, tipo, quantidade: qtd, preco_custo: custo, preco_venda: venda, rt_percentual: rt, produto_id: produtoId });
      const newCusto = totalCusto + qtd * custo;
      const newVenda = totalVenda + qtd * venda;
      const newMargem = newVenda > 0 ? ((newVenda - newCusto) / newVenda) * 100 : 0;
      await updateProjeto.mutateAsync({ id: projetoId, custo_previsto: newCusto, venda_total: newVenda, margem_prevista: newMargem });

      if (tipo === "produto" && empresaId) {
        const hasStock = await checkEstoque(newItem.produto_id, qtd);
        if (!hasStock) {
          await createNecessidade.mutateAsync({ empresa_id: empresaId, projeto_id: projetoId, projeto_item_id: newItem.id, produto_id: newItem.produto_id ?? undefined, descricao: desc, quantidade: qtd });
          toast.info("⚠️ Estoque insuficiente — necessidade de compra gerada");
        }
      }
      setDesc(""); setQtd(1); setCusto(0); setVenda(0); setRt(0); setProdutoId(null);
      toast.success("Item adicionado");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDeleteItem = async (itemId: string) => {
    try { await deleteItem.mutateAsync({ id: itemId, projetoId }); toast.success("Item removido"); } catch (err: any) { toast.error(err.message); }
  };

  const handleGerarParcelas = async () => {
    if (totalVenda <= 0) { toast.error("Valor de venda total deve ser maior que 0"); return; }
    if (!empresaId) return;
    try {
      const valorParcela = Math.round((totalVenda / gerarQtdParcelas) * 100) / 100;
      const today = new Date();
      const inserts = Array.from({ length: gerarQtdParcelas }, (_, i) => {
        const dt = new Date(today); dt.setMonth(dt.getMonth() + i + 1);
        return {
          empresa_id: empresaId, projeto_id: projetoId, cliente_id: clienteId || null,
          descricao: `Parcela ${i + 1}/${gerarQtdParcelas} — ${projetoNome}`,
          valor: valorParcela, parcela: i + 1,
          data_vencimento: dt.toISOString().split("T")[0], status: "pendente" as const,
        };
      });
      await supabase.from("financeiro_receber").insert(inserts);
      qc.invalidateQueries({ queryKey: ["financeiro_receber_projeto", projetoId] });
      toast.success(`${gerarQtdParcelas} parcelas geradas!`);
      setShowGerarParcelas(false);
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Itens do Projeto</h3>
        <div className="flex items-center gap-2">
          {isCrmGenerated && (
            <span className="text-[10px] text-muted-foreground italic">Financeiro gerado via CRM</span>
          )}
          {!isCrmGenerated && (
            <button onClick={() => { setShowGerarParcelas(true); setGerarQtdParcelas(numeroParcelas); }} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-success text-white hover:brightness-105">
              <DollarSign size={12} /> Gerar Pagamento
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 text-[11px] flex-wrap">
        <span className="text-muted-foreground">Custo: <strong className="text-foreground">R$ {totalCusto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
        <span className="text-muted-foreground">Venda: <strong className="text-foreground">R$ {totalVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
        <span className="text-muted-foreground">Margem: <strong className={margem > 0 ? "text-success" : "text-destructive"}>{margem.toFixed(1)}%</strong></span>
        <span className="text-muted-foreground">Lucro: <strong className={lucro > 0 ? "text-success" : "text-destructive"}>R$ {lucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
      </div>

      {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : itens && itens.length > 0 && (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/60">
                <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Descrição</th>
                <th className="text-left px-2 py-1.5 font-semibold border-b border-border w-20">Tipo</th>
                <th className="text-right px-2 py-1.5 font-semibold border-b border-border w-12">Qtd</th>
                <th className="text-right px-2 py-1.5 font-semibold border-b border-border w-20">Custo</th>
                <th className="text-right px-2 py-1.5 font-semibold border-b border-border w-20">Venda</th>
                <th className="text-right px-2 py-1.5 font-semibold border-b border-border w-14">RT%</th>
                <th className="text-center px-2 py-1.5 font-semibold border-b border-border w-10"></th>
              </tr>
            </thead>
            <tbody>
              {itens.map(item => (
                <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2 py-1.5">{item.descricao}</td>
                  <td className="px-2 py-1.5 capitalize">{item.tipo}</td>
                  <td className="px-2 py-1.5 text-right">{item.quantidade}</td>
                  <td className="px-2 py-1.5 text-right">R$ {(item.preco_custo ?? 0).toLocaleString("pt-BR")}</td>
                  <td className="px-2 py-1.5 text-right">R$ {(item.preco_venda ?? 0).toLocaleString("pt-BR")}</td>
                  <td className="px-2 py-1.5 text-right text-primary">{item.rt_percentual ?? 0}%</td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => handleDeleteItem(item.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1 flex-1 min-w-[120px] relative">
          <label className="text-[11px] text-muted-foreground">Descrição {tipo === "produto" && <Search size={10} className="inline ml-1" />}</label>
          <input
            value={desc}
            onChange={e => { setDesc(e.target.value); setProdutoId(null); setShowSuggestions(tipo === "produto" && e.target.value.length > 0); }}
            onFocus={() => { if (tipo === "produto" && desc.length > 0) setShowSuggestions(true); }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full h-7 px-2 text-xs bg-background border border-border rounded focus:outline-none"
            placeholder={tipo === "produto" ? "Buscar produto..." : "Descrição"}
          />
          {showSuggestions && filteredProdutos.length > 0 && (
            <div className="absolute z-10 w-full bg-card border border-border rounded shadow-lg mt-1 max-h-32 overflow-y-auto">
              {filteredProdutos.slice(0, 8).map(p => (
                <button key={p.id} onMouseDown={() => selectProduto(p)} className="w-full text-left px-2 py-1.5 text-xs hover:bg-secondary/50 flex justify-between">
                  <span>{p.nome}</span>
                  <span className="text-muted-foreground">R$ {(p.preco_custo ?? 0).toLocaleString("pt-BR")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1 w-24"><label className="text-[11px] text-muted-foreground">Tipo</label>
          <select value={tipo} onChange={e => { setTipo(e.target.value as TipoItem); setShowSuggestions(false); }} className="w-full h-7 px-1 text-xs bg-background border border-border rounded focus:outline-none">
            <option value="produto">Produto</option><option value="servico">Serviço</option><option value="mao_de_obra">Mão de Obra</option>
          </select>
        </div>
        <div className="space-y-1 w-14"><label className="text-[11px] text-muted-foreground">Qtd</label><input type="number" value={qtd} onChange={e => setQtd(Number(e.target.value))} className="w-full h-7 px-1 text-xs bg-background border border-border rounded focus:outline-none" /></div>
        <div className="space-y-1 w-20"><label className="text-[11px] text-muted-foreground">Custo</label><input type="number" value={custo} onChange={e => setCusto(Number(e.target.value))} className="w-full h-7 px-1 text-xs bg-background border border-border rounded focus:outline-none" /></div>
        <div className="space-y-1 w-20"><label className="text-[11px] text-muted-foreground">Venda</label><input type="number" value={venda} onChange={e => setVenda(Number(e.target.value))} className="w-full h-7 px-1 text-xs bg-background border border-border rounded focus:outline-none" /></div>
        <div className="space-y-1 w-14"><label className="text-[11px] text-muted-foreground">RT%</label><input type="number" value={rt} onChange={e => setRt(Number(e.target.value))} className="w-full h-7 px-1 text-xs bg-background border border-border rounded focus:outline-none" /></div>
        <button onClick={handleAddItem} disabled={createItem.isPending} className="h-7 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition disabled:opacity-50"><Plus size={12} /></button>
      </div>

      <Dialog open={showGerarParcelas} onOpenChange={setShowGerarParcelas}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Gerar Parcelas</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Total de Venda: <strong className="text-foreground">R$ {totalVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Nº de Parcelas</label>
              <input type="number" min={1} value={gerarQtdParcelas} onChange={e => setGerarQtdParcelas(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" />
            </div>
            <p className="text-xs text-muted-foreground">Valor por parcela: <strong>R$ {(totalVenda / (gerarQtdParcelas || 1)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></p>
          </div>
          <DialogFooter>
            <button onClick={() => setShowGerarParcelas(false)} className="px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground">Cancelar</button>
            <button onClick={handleGerarParcelas} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Gerar Parcelas</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ======== VISITAS TÉCNICAS ========
const VisitasTecnicasSection = ({ projetoId }: { projetoId: string }) => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: visitas, isLoading } = useVisitasTecnicas(projetoId);
  const createVisita = useCreateVisita();
  const updateVisita = useUpdateVisita();
  const { data: formasPgto } = useFormasPagamento();

  const { data: tecnicos } = useQuery({
    queryKey: ["tecnicos_select", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [tecnicoId, setTecnicoId] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [statusVisita, setStatusVisita] = useState("agendada");
  const [descricao, setDescricao] = useState("");
  const [servicos, setServicos] = useState("");
  const [produtosLevados, setProdutosLevados] = useState("");
  const [valor, setValor] = useState(0);
  const [dataPagamento, setDataPagamento] = useState("");

  // Baixa modal
  const [showBaixa, setShowBaixa] = useState(false);
  const [baixaVisitaId, setBaixaVisitaId] = useState<string | null>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaForma, setBaixaForma] = useState("");

  const resetVisitaForm = () => {
    setEditId(null); setTecnicoId(""); setData(""); setHora(""); setStatusVisita("agendada"); setDescricao("");
    setServicos(""); setProdutosLevados(""); setValor(0); setDataPagamento("");
    setShowForm(false);
  };

  const openEditVisita = (v: any) => {
    setEditId(v.id); setTecnicoId(v.tecnico_id ?? ""); setData(v.data ?? "");
    setHora(v.hora ?? ""); setStatusVisita(v.status_visita ?? "agendada");
    setDescricao(v.descricao ?? ""); setServicos(v.servicos_executados ?? "");
    setProdutosLevados(v.produtos_levados ? JSON.stringify(v.produtos_levados) : "");
    setValor(v.valor_pago_tecnico ?? 0); setDataPagamento(v.data_pagamento ?? "");
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const payload: any = {
        tecnico_id: tecnicoId || null, data: data || null, hora: hora || null,
        status_visita: statusVisita, descricao: descricao || null,
        servicos_executados: servicos || null, valor_pago_tecnico: valor,
        produtos_levados: produtosLevados ? JSON.parse(produtosLevados) : [],
        data_pagamento: dataPagamento || null,
      };
      if (editId) {
        await updateVisita.mutateAsync({ id: editId, projeto_id: projetoId, ...payload });
        toast.success("Visita atualizada");
      } else {
        await createVisita.mutateAsync({ projeto_id: projetoId, ...payload });
        if (valor > 0 && empresaId) {
          await supabase.from("financeiro_pagar").insert({
            empresa_id: empresaId, projeto_id: projetoId,
            fornecedor_id: tecnicoId || null,
            descricao: `Visita técnica — ${descricao || "Sem descrição"}`,
            valor, data_vencimento: data || null, status: "pendente",
          });
        }
        toast.success("Visita registrada");
      }
      resetVisitaForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("visitas_tecnicas").delete().eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["visitas_tecnicas", projetoId] });
      toast.success("Visita excluída");
    } catch (err: any) { toast.error(err.message); }
  };

  const openBaixa = (v: any) => {
    setBaixaVisitaId(v.id); setBaixaData(new Date().toISOString().split("T")[0]); setBaixaForma(""); setShowBaixa(true);
  };

  const handleBaixa = async () => {
    if (!baixaVisitaId) return;
    try {
      await updateVisita.mutateAsync({ id: baixaVisitaId, projeto_id: projetoId, status_pagamento: "pago", data_pagamento: baixaData });
      await supabase.from("financeiro_pagar").update({ status: "pago", data_pagamento: baixaData }).eq("projeto_id", projetoId).eq("fornecedor_id", visitas?.find(v => v.id === baixaVisitaId)?.tecnico_id ?? "");
      toast.success("Pagamento registrado");
      setShowBaixa(false);
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Visitas Técnicas</h3>
        <button onClick={() => { resetVisitaForm(); setShowForm(true); }} className="text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:brightness-105">
          <Plus size={12} className="inline mr-1" />Nova Visita
        </button>
      </div>

      {showForm && (
        <div className="bg-secondary/30 rounded p-3 space-y-2">
          <h4 className="text-xs font-semibold">{editId ? "Editar Visita" : "Nova Visita"}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Técnico</label>
              <select value={tecnicoId} onChange={e => setTecnicoId(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded">
                <option value="">Selecionar...</option>
                {tecnicos?.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data</label><input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Hora</label><input type="time" value={hora} onChange={e => setHora(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Status</label>
              <select value={statusVisita} onChange={e => setStatusVisita(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded">
                <option value="agendada">Agendada</option><option value="realizada">Realizada</option><option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor Técnico</label><input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Pagamento</label><input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Descrição</label><input value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Serviços Executados</label><input value={servicos} onChange={e => setServicos(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1 col-span-full"><label className="text-[11px] text-muted-foreground">Produtos Levados (JSON)</label><input value={produtosLevados} onChange={e => setProdutosLevados(e.target.value)} placeholder='["item1","item2"]' className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createVisita.isPending} className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50">Salvar</button>
            <button onClick={resetVisitaForm} className="px-3 py-1 text-xs rounded bg-secondary text-secondary-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : visitas && visitas.length > 0 ? (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Técnico</th>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Data</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Hora</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Status</th>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Descrição</th>
              <th className="text-right px-2 py-1.5 font-semibold border-b border-border">Valor</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Pgto</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Ações</th>
            </tr></thead>
            <tbody>
              {visitas.map(v => (
                <tr key={v.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => openEditVisita(v)}>
                  <td className="px-2 py-1.5">{(v.fornecedores as any)?.nome ?? "—"}</td>
                  <td className="px-2 py-1.5">{v.data ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center">{(v as any).hora ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${(v as any).status_visita === "realizada" ? "bg-success/15 text-success" : (v as any).status_visita === "cancelada" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>
                      {(v as any).status_visita === "realizada" ? "Realizada" : (v as any).status_visita === "cancelada" ? "Cancelada" : "Agendada"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">{v.descricao ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">R$ {(v.valor_pago_tecnico ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    {v.status_pagamento === "pago" ? (
                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-success/15 text-success">Pago</span>
                    ) : (
                      <button onClick={() => openBaixa(v)} className="px-1.5 py-0.5 rounded text-[11px] bg-warning/15 text-warning hover:bg-warning/25">Pendente</button>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEditVisita(v)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={12} /></button>
                      <button onClick={() => { if (window.confirm("Excluir visita?")) handleDelete(v.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-xs text-muted-foreground">Nenhuma visita registrada.</p>}

      <Dialog open={showBaixa} onOpenChange={setShowBaixa}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Registrar Pagamento — Visita Técnica</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Pagamento</label><input type="date" value={baixaData} onChange={e => setBaixaData(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Forma de Pagamento</label>
              <select value={baixaForma} onChange={e => setBaixaForma(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="">Selecionar...</option>
                {formasPgto?.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="Pix">Pix</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowBaixa(false)} className="px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground">Cancelar</button>
            <button onClick={handleBaixa} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Confirmar Pagamento</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ======== FINANCEIRO DO PROJETO ========
const ProjetoFinanceiroSection = ({ projetoId, projetoNome, clienteId }: { projetoId: string; projetoNome: string; clienteId: string }) => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: formasPgto } = useFormasPagamento();

  const { data: parcelas, isLoading } = useQuery({
    queryKey: ["financeiro_receber_projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("financeiro_receber").select("*").eq("projeto_id", projetoId).order("parcela");
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });

  const { data: contasPagar } = useQuery({
    queryKey: ["financeiro_pagar_projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("financeiro_pagar").select("*, fornecedores(nome)").eq("projeto_id", projetoId).order("data_vencimento");
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState("");
  const [forma, setForma] = useState("");
  const [parcNum, setParcNum] = useState(1);

  const resetForm = () => { setEditId(null); setValor(0); setVencimento(""); setForma(""); setParcNum((parcelas?.length ?? 0) + 1); setShowForm(false); };

  const openEditParcela = (p: any) => {
    setEditId(p.id); setValor(p.valor ?? 0); setVencimento(p.data_vencimento ?? ""); setForma(""); setParcNum(p.parcela ?? 1); setShowForm(true);
  };

  const handleSave = async () => {
    try {
      if (editId) {
        const { error } = await supabase.from("financeiro_receber").update({ valor, data_vencimento: vencimento || null, parcela: parcNum }).eq("id", editId);
        if (error) throw error;
        toast.success("Parcela atualizada");
      } else {
        const { error } = await supabase.from("financeiro_receber").insert({
          empresa_id: empresaId!, projeto_id: projetoId, cliente_id: clienteId || null,
          descricao: `Parcela ${parcNum} — ${projetoNome}`, valor, parcela: parcNum,
          data_vencimento: vencimento || null, status: "pendente",
        });
        if (error) throw error;
        toast.success("Parcela criada");
      }
      qc.invalidateQueries({ queryKey: ["financeiro_receber_projeto", projetoId] });
      resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDeleteParcela = async (id: string) => {
    try {
      const { error } = await supabase.from("financeiro_receber").delete().eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["financeiro_receber_projeto", projetoId] });
      toast.success("Parcela excluída");
    } catch (err: any) { toast.error(err.message); }
  };

  // Baixa modal
  const [showBaixa, setShowBaixa] = useState(false);
  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaForma, setBaixaForma] = useState("");
  const [baixaObs, setBaixaObs] = useState("");

  // Baixa pagar modal
  const [showBaixaPagar, setShowBaixaPagar] = useState(false);
  const [baixaPagarId, setBaixaPagarId] = useState<string | null>(null);
  const [baixaPagarData, setBaixaPagarData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaPagarForma, setBaixaPagarForma] = useState("");

  const handleBaixa = async () => {
    if (!baixaId) return;
    try {
      const { error } = await supabase.from("financeiro_receber").update({ status: "pago", data_pagamento: baixaData }).eq("id", baixaId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["financeiro_receber_projeto", projetoId] });
      toast.success("Recebido!"); setShowBaixa(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleBaixaPagar = async () => {
    if (!baixaPagarId) return;
    try {
      const { error } = await supabase.from("financeiro_pagar").update({ status: "pago", data_pagamento: baixaPagarData }).eq("id", baixaPagarId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["financeiro_pagar_projeto", projetoId] });
      toast.success("Pago!"); setShowBaixaPagar(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const totalReceber = parcelas?.reduce((acc, p) => acc + (p.valor ?? 0), 0) ?? 0;
  const totalRecebido = parcelas?.filter(p => p.status === "pago").reduce((acc, p) => acc + (p.valor ?? 0), 0) ?? 0;
  const totalPagar = contasPagar?.reduce((acc, p) => acc + (p.valor ?? 0), 0) ?? 0;
  const totalPago = contasPagar?.filter(p => p.status === "pago").reduce((acc, p) => acc + (p.valor ?? 0), 0) ?? 0;
  const lucro = totalRecebido - totalPago;
  const statusColor = (s: string) => s === "pago" ? "bg-success/15 text-success" : s === "vencido" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Financeiro do Projeto</h3>
        <button onClick={() => { resetForm(); setParcNum((parcelas?.length ?? 0) + 1); setShowForm(true); }} className="text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:brightness-105">
          <Plus size={12} className="inline mr-1" />Nova Parcela
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px]">
        <div className="bg-secondary/30 rounded p-2"><span className="text-muted-foreground block">A Receber</span><strong className="text-foreground">R$ {totalReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
        <div className="bg-success/10 rounded p-2"><span className="text-muted-foreground block">Recebido</span><strong className="text-success">R$ {totalRecebido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
        <div className="bg-secondary/30 rounded p-2"><span className="text-muted-foreground block">A Pagar</span><strong className="text-foreground">R$ {totalPagar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
        <div className="bg-destructive/10 rounded p-2"><span className="text-muted-foreground block">Pago</span><strong className="text-destructive">R$ {totalPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
        <div className={`rounded p-2 ${lucro >= 0 ? "bg-success/10" : "bg-destructive/10"}`}><span className="text-muted-foreground block">Lucro</span><strong className={lucro >= 0 ? "text-success" : "text-destructive"}>R$ {lucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div>
      </div>

      {showForm && (
        <div className="bg-secondary/30 rounded p-3 space-y-2">
          <h4 className="text-xs font-semibold">{editId ? "Editar Parcela" : "Nova Parcela"}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Nº Parcela</label><input type="number" value={parcNum} onChange={e => setParcNum(Number(e.target.value))} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor</label><input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Vencimento</label><input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Forma Pagamento</label>
              <select value={forma} onChange={e => setForma(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded">
                <option value="">Selecionar...</option>
                {formasPgto?.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="Pix">Pix</option><option value="Boleto">Boleto</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground">Salvar</button>
            <button onClick={resetForm} className="px-3 py-1 text-xs rounded bg-secondary text-secondary-foreground">Cancelar</button>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold text-foreground mb-2">Contas a Receber</h4>
        {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : parcelas && parcelas.length > 0 ? (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-secondary/60">
                <th className="text-center px-2 py-1.5 font-semibold border-b border-border w-12">#</th>
                <th className="text-right px-2 py-1.5 font-semibold border-b border-border">Valor</th>
                <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Vencimento</th>
                <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Status</th>
                <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Pagamento</th>
                <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Ações</th>
              </tr></thead>
              <tbody>
                {parcelas.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => openEditParcela(p)}>
                    <td className="px-2 py-1.5 text-center">{p.parcela}</td>
                    <td className="px-2 py-1.5 text-right font-medium">R$ {(p.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1.5 text-center">{p.data_vencimento ?? "—"}</td>
                    <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor(p.status ?? "pendente")}`}>{p.status}</span></td>
                    <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">
                      {p.status === "pago" ? (
                        <span>{p.data_pagamento ?? "—"}</span>
                      ) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {p.status === "pendente" && <button onClick={() => { setBaixaId(p.id); setBaixaData(new Date().toISOString().split("T")[0]); setBaixaForma(""); setBaixaObs(""); setShowBaixa(true); }} className="p-1 rounded hover:bg-success/15 text-muted-foreground hover:text-success"><Check size={12} /></button>}
                        <button onClick={() => openEditParcela(p)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={12} /></button>
                        <button onClick={() => { if (window.confirm("Excluir parcela?")) handleDeleteParcela(p.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-xs text-muted-foreground">Nenhuma parcela encontrada.</p>}
      </div>

      {contasPagar && contasPagar.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-foreground mb-2">Contas a Pagar</h4>
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-secondary/60">
                <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Descrição</th>
                <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Fornecedor</th>
                <th className="text-right px-2 py-1.5 font-semibold border-b border-border">Valor</th>
                <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Vencimento</th>
                <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Status</th>
                <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Ações</th>
              </tr></thead>
              <tbody>
                {contasPagar.map(c => (
                  <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                    <td className="px-2 py-1.5">{c.descricao}</td>
                    <td className="px-2 py-1.5">{(c.fornecedores as any)?.nome ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right font-medium">R$ {(c.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1.5 text-center">{c.data_vencimento ?? "—"}</td>
                    <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor(c.status ?? "pendente")}`}>{c.status}</span></td>
                    <td className="px-2 py-1.5 text-center">
                      {c.status === "pendente" && (
                        <button onClick={() => { setBaixaPagarId(c.id); setBaixaPagarData(new Date().toISOString().split("T")[0]); setBaixaPagarForma(""); setShowBaixaPagar(true); }} className="p-1 rounded hover:bg-success/15 text-muted-foreground hover:text-success"><Check size={12} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={showBaixa} onOpenChange={setShowBaixa}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Registrar Recebimento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Recebimento</label><input type="date" value={baixaData} onChange={e => setBaixaData(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Forma de Pagamento</label>
              <select value={baixaForma} onChange={e => setBaixaForma(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="">Selecionar...</option>
                {formasPgto?.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="Pix">Pix</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Observação</label><input value={baixaObs} onChange={e => setBaixaObs(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowBaixa(false)} className="px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground">Cancelar</button>
            <button onClick={handleBaixa} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Confirmar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBaixaPagar} onOpenChange={setShowBaixaPagar}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Pagamento</label><input type="date" value={baixaPagarData} onChange={e => setBaixaPagarData(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Forma de Pagamento</label>
              <select value={baixaPagarForma} onChange={e => setBaixaPagarForma(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="">Selecionar...</option>
                {formasPgto?.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="Pix">Pix</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowBaixaPagar(false)} className="px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground">Cancelar</button>
            <button onClick={handleBaixaPagar} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Confirmar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ======== COMPRAS DO PROJETO ========
const ProjetoComprasSection = ({ projetoId }: { projetoId: string }) => {
  const qc = useQueryClient();
  const { data: compras, isLoading } = useQuery({
    queryKey: ["compras_projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("compras").select("*, fornecedores(nome), produtos(nome)").eq("projeto_id", projetoId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });

  const { data: necessidades } = useNecessidadesCompra(projetoId);

  const changeCompraStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("compras").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compras_projeto", projetoId] }); toast.success("Status atualizado"); },
  });

  const statusColor = (s: string) => s === "entregue" ? "bg-success/15 text-success" : s === "cancelada" ? "bg-destructive/15 text-destructive" : s === "aprovada" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning";

  const pendentes = necessidades?.filter(n => n.status === "pendente") ?? [];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Compras do Projeto</h3>

      {pendentes.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-warning mb-2">⚠️ Itens Pendentes de Compra ({pendentes.length})</h4>
          <div className="border border-warning/30 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-warning/10">
                <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Descrição</th>
                <th className="text-right px-2 py-1.5 font-semibold border-b border-border">Qtd</th>
                <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Status</th>
              </tr></thead>
              <tbody>
                {pendentes.map((n: any) => (
                  <tr key={n.id} className="border-b border-border last:border-b-0">
                    <td className="px-2 py-1.5">{n.descricao ?? "—"}</td>
                    <td className="px-2 py-1.5 text-right">{n.quantidade}</td>
                    <td className="px-2 py-1.5 text-center"><span className="px-1.5 py-0.5 rounded text-[11px] bg-warning/15 text-warning font-medium">Pendente</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : compras && compras.length > 0 ? (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Produto</th>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Fornecedor</th>
              <th className="text-right px-2 py-1.5 font-semibold border-b border-border">Qtd</th>
              <th className="text-right px-2 py-1.5 font-semibold border-b border-border">Total</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Status</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Ações</th>
            </tr></thead>
            <tbody>
              {compras.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2 py-1.5">{(c.produtos as any)?.nome ?? c.descricao ?? "—"}</td>
                  <td className="px-2 py-1.5">{(c.fornecedores as any)?.nome ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{c.quantidade}</td>
                  <td className="px-2 py-1.5 text-right font-medium">R$ {(c.valor_total ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1.5 text-center">
                    <select value={c.status ?? "pendente"} onChange={e => changeCompraStatus.mutate({ id: c.id, status: e.target.value as any })} onClick={e => e.stopPropagation()} className={`px-1.5 py-0.5 rounded text-[11px] font-medium border-0 cursor-pointer ${statusColor(c.status ?? "pendente")}`}>
                      <option value="pendente">Pendente</option>
                      <option value="aprovada">Aprovada</option>
                      <option value="entregue">Entregue</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className="text-[10px] text-muted-foreground">—</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-xs text-muted-foreground">Nenhuma compra vinculada.</p>}
    </div>
  );
};

// ======== COMISSÕES DO PROJETO ========
const ProjetoComissoesSection = ({ projetoId, arquitetoId }: { projetoId: string; arquitetoId: string }) => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: formasPgto } = useFormasPagamento();

  const { data: comissoes, isLoading } = useQuery({
    queryKey: ["comissoes_projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("comissoes").select("*, fornecedores(nome)").eq("projeto_id", projetoId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["arquitetos_comissao", empresaId],
    queryFn: async () => { const { data } = await supabase.from("fornecedores").select("id, nome").eq("tipo", "arquiteto").order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fornecedorId, setFornecedorId] = useState(arquitetoId);
  const [percentual, setPercentual] = useState(0);
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState("");

  const [showBaixa, setShowBaixa] = useState(false);
  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaForma, setBaixaForma] = useState("");
  const [baixaObs, setBaixaObs] = useState("");

  const resetForm = () => { setEditId(null); setFornecedorId(arquitetoId); setPercentual(0); setValor(0); setVencimento(""); setShowForm(false); };

  const handleSave = async () => {
    if (!fornecedorId) { toast.error("Selecione o arquiteto/parceiro"); return; }
    if (!empresaId) return;
    try {
      if (editId) {
        const { error } = await supabase.from("comissoes").update({ fornecedor_id: fornecedorId, percentual, valor, data_vencimento: vencimento || null } as any).eq("id", editId);
        if (error) throw error;
        await supabase.from("financeiro_pagar").update({ valor, fornecedor_id: fornecedorId, data_vencimento: vencimento || null }).eq("comissao_id", editId);
        toast.success("Comissão atualizada");
      } else {
        const { error } = await supabase.from("comissoes").insert({
          empresa_id: empresaId, projeto_id: projetoId, fornecedor_id: fornecedorId,
          percentual, valor, data_vencimento: vencimento || null, status: "pendente",
        });
        if (error) throw error;
        toast.success("Comissão criada");
      }
      qc.invalidateQueries({ queryKey: ["comissoes_projeto", projetoId] });
      qc.invalidateQueries({ queryKey: ["financeiro_pagar_projeto", projetoId] });
      resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const openEdit = (c: any) => {
    setEditId(c.id); setFornecedorId(c.fornecedor_id); setPercentual(c.percentual ?? 0); setValor(c.valor ?? 0); setVencimento(c.data_vencimento ?? ""); setShowForm(true);
  };

  const openBaixa = (c: any) => {
    setBaixaId(c.id); setBaixaData(new Date().toISOString().split("T")[0]); setBaixaForma(""); setBaixaObs(""); setShowBaixa(true);
  };

  const handleBaixa = async () => {
    if (!baixaId) return;
    try {
      const { error } = await supabase.from("comissoes").update({ status: "pago", forma_pagamento: baixaForma || null, observacao: baixaObs || null } as any).eq("id", baixaId);
      if (error) throw error;
      await supabase.from("financeiro_pagar").update({ status: "pago", data_pagamento: baixaData }).eq("comissao_id", baixaId);
      qc.invalidateQueries({ queryKey: ["comissoes_projeto", projetoId] });
      qc.invalidateQueries({ queryKey: ["financeiro_pagar_projeto", projetoId] });
      toast.success("Comissão paga"); setShowBaixa(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("comissoes").delete().eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["comissoes_projeto", projetoId] });
      toast.success("Comissão excluída");
    } catch (err: any) { toast.error(err.message); }
  };

  const statusColor = (s: string) => s === "pago" ? "bg-success/15 text-success" : "bg-warning/15 text-warning";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Comissões (RT)</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:brightness-105">
          <Plus size={12} className="inline mr-1" />Nova Comissão
        </button>
      </div>

      {showForm && (
        <div className="bg-secondary/30 rounded p-3 space-y-2">
          <h4 className="text-xs font-semibold">{editId ? "Editar Comissão" : "Nova Comissão"}</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Arquiteto/Parceiro *</label>
              <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded">
                <option value="">Selecionar...</option>
                {fornecedores?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Percentual</label><input type="number" value={percentual} onChange={e => setPercentual(Number(e.target.value))} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor</label><input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Vencimento</label><input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground">Salvar</button>
            <button onClick={resetForm} className="px-3 py-1 text-xs rounded bg-secondary text-secondary-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : comissoes && comissoes.length > 0 ? (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Arquiteto</th>
              <th className="text-right px-2 py-1.5 font-semibold border-b border-border">%</th>
              <th className="text-right px-2 py-1.5 font-semibold border-b border-border">Valor</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Vencimento</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Status</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Pagamento</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Ações</th>
            </tr></thead>
            <tbody>
              {comissoes.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2 py-1.5">{(c.fornecedores as any)?.nome ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">{c.percentual ?? 0}%</td>
                  <td className="px-2 py-1.5 text-right font-medium">R$ {(c.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1.5 text-center">{c.data_vencimento ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor(c.status ?? "pendente")}`}>{c.status}</span></td>
                  <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground">
                    {c.status === "pago" ? (
                      <div className="space-y-0.5">
                        {(c as any).forma_pagamento && <div>{(c as any).forma_pagamento}</div>}
                        {(c as any).observacao && <div className="italic">{(c as any).observacao}</div>}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={12} /></button>
                      {c.status !== "pago" && <button onClick={() => openBaixa(c)} className="p-1 rounded hover:bg-success/15 text-muted-foreground hover:text-success" title="Dar baixa"><Check size={12} /></button>}
                      <button onClick={() => { if (window.confirm("Excluir comissão?")) handleDelete(c.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-xs text-muted-foreground">Nenhuma comissão encontrada.</p>}

      <Dialog open={showBaixa} onOpenChange={setShowBaixa}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Registrar Pagamento — Comissão</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Pagamento</label><input type="date" value={baixaData} onChange={e => setBaixaData(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Forma de Pagamento</label>
              <select value={baixaForma} onChange={e => setBaixaForma(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="">Selecionar...</option>
                {formasPgto?.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="Pix">Pix</option><option value="Boleto">Boleto</option><option value="Transferência">Transferência</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Observação</label><input value={baixaObs} onChange={e => setBaixaObs(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" placeholder="Observação opcional" /></div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowBaixa(false)} className="px-3 py-1.5 text-xs rounded bg-secondary text-secondary-foreground">Cancelar</button>
            <button onClick={handleBaixa} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Confirmar Pagamento</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ======== CRONOGRAMA ========
const ProjetoCronogramaSection = ({ projeto, dataInicio, dataPrevisao }: { projeto: any; dataInicio: string; dataPrevisao: string }) => {
  const status = projeto?.status as StatusProjeto | undefined;
  const statusIdx = status ? statusOptions.indexOf(status) : 0;
  const progress = status === "cancelado" ? 0 : Math.round((statusIdx / (statusOptions.length - 2)) * 100);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Cronograma</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div><span className="text-muted-foreground">Início:</span> <strong>{dataInicio || "Não definido"}</strong></div>
        <div><span className="text-muted-foreground">Previsão:</span> <strong>{dataPrevisao || "Não definido"}</strong></div>
        <div><span className="text-muted-foreground">Status:</span> <strong>{statusLabels[status ?? "orcamento"]}</strong></div>
        <div><span className="text-muted-foreground">Progresso:</span> <strong>{progress}%</strong></div>
      </div>
      <div className="w-full bg-secondary rounded-full h-3">
        <div className="bg-primary h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex gap-1 flex-wrap mt-2">
        {statusOptions.filter(s => s !== "cancelado").map((s, i) => (
          <div key={s} className={`px-2 py-1 rounded text-[10px] font-medium ${i <= statusIdx && status !== "cancelado" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
            {statusLabels[s]}
          </div>
        ))}
      </div>
    </div>
  );
};

// ======== CONTRATOS DO PROJETO ========
const ProjetoContratosSection = ({ projetoId }: { projetoId: string }) => {
  const { data: contratos, isLoading } = useQuery({
    queryKey: ["contratos_projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase.from("contratos").select("*").eq("projeto_id", projetoId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });

  const statusColor = (s: string) => s === "assinado" ? "bg-success/15 text-success" : s === "cancelado" ? "bg-destructive/15 text-destructive" : s === "enviado" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Contratos do Projeto</h3>
      {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : contratos && contratos.length > 0 ? (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Descrição</th>
              <th className="text-right px-2 py-1.5 font-semibold border-b border-border">Valor</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Status</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Enviado</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Assinado</th>
            </tr></thead>
            <tbody>
              {contratos.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2 py-1.5">{c.descricao ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right font-medium">R$ {(c.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor(c.status)}`}>{c.status}</span></td>
                  <td className="px-2 py-1.5 text-center">{c.data_envio ?? "—"}</td>
                  <td className="px-2 py-1.5 text-center">{c.data_assinatura ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-xs text-muted-foreground">Nenhum contrato vinculado.</p>}
    </div>
  );
};

export default Projetos;
