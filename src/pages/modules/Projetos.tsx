import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, Pencil, Trash2, AlertTriangle, Search } from "lucide-react";
import { useProjetos, useClientes, useArquitetos, useCreateProjeto, useUpdateProjeto, useProjetoItens, useCreateProjetoItem, useDeleteProjetoItem } from "@/hooks/useProjetos";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useNecessidadesPendentesCount, useCreateNecessidade, useCheckEstoque } from "@/hooks/useNecessidadesCompra";
import { useFormasPagamento } from "@/hooks/useCategorias";
import { useVisitasTecnicas, useCreateVisita, useUpdateVisita } from "@/hooks/useVisitasTecnicas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type StatusProjeto = Database["public"]["Enums"]["status_projeto"];
type TipoItem = Database["public"]["Enums"]["tipo_projeto_item"];

const statusLabels: Record<StatusProjeto, string> = {
  lead: "Lead", proposta: "Proposta", orcamento: "Orçamento", aprovado: "Aprovado",
  vendido: "Vendido", em_andamento: "Em Andamento", concluido: "Concluído",
  pos_venda: "Pós-Venda", cancelado: "Cancelado"
};
const statusColors: Record<StatusProjeto, string> = {
  lead: "bg-secondary text-secondary-foreground", proposta: "bg-warning/15 text-warning",
  orcamento: "bg-secondary text-secondary-foreground", aprovado: "bg-success/15 text-success",
  vendido: "bg-primary/15 text-primary", em_andamento: "bg-primary/15 text-primary",
  concluido: "bg-info/15 text-info", pos_venda: "bg-accent text-accent-foreground",
  cancelado: "bg-destructive/15 text-destructive"
};
const statusOptions: StatusProjeto[] = ["lead", "proposta", "orcamento", "aprovado", "vendido", "em_andamento", "concluido", "pos_venda", "cancelado"];

const Projetos = () => {
  const navigate = useNavigate();
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: projetos, isLoading } = useProjetos();
  const { data: pendenciaCounts } = useNecessidadesPendentesCount();
  const { data: clientes } = useClientes();
  const { data: arquitetos } = useArquitetos();
  const { data: formasPagamento } = useFormasPagamento();
  const createProjeto = useCreateProjeto();
  const updateProjeto = useUpdateProjeto();

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
  const [observacoesPagamento, setObservacoesPagamento] = useState("");
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);

  const resetForm = () => {
    setNome(""); setDescricao(""); setClienteId(""); setArquitetoId("");
    setDataInicio(""); setDataPrevisao(""); setEnderecoObra(""); setFormaPagamento("");
    setNumeroParcelas(1); setObservacoesPagamento("");
    setEditId(null); setShowForm(false); setSelectedProjetoId(null);
  };

  const openEdit = (p: any) => {
    setEditId(p.id); setNome(p.nome); setDescricao(p.descricao ?? "");
    setClienteId(p.cliente_id ?? ""); setArquitetoId(p.arquiteto_id ?? "");
    setDataInicio(p.data_inicio ?? ""); setDataPrevisao(p.data_previsao ?? "");
    setEnderecoObra(p.endereco_obra ?? ""); setFormaPagamento(p.forma_pagamento ?? "");
    setNumeroParcelas(p.numero_parcelas ?? 1); setObservacoesPagamento(p.observacoes_pagamento ?? "");
    setShowForm(true); setSelectedProjetoId(p.id);
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
        toast.success("Projeto criado! Adicione itens abaixo.");
        return;
      }
      resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleApprove = async (projetoId: string, projeto: any) => {
    try {
      await supabase.from("projetos").update({ status: "aprovado" }).eq("id", projetoId);
      // Auto-generate financeiro_receber parcelas
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
      // Auto-generate comissoes RT
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
      if (status === "aprovado" && projeto) {
        await handleApprove(id, projeto);
        return;
      }
      const { error } = await supabase.from("projetos").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projetos"] }); toast.success("Status atualizado"); },
    onError: (err: any) => toast.error(err.message),
  });

  const removeProjeto = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("projetos").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projetos"] }); toast.success("Projeto excluído"); },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = projetos?.filter(p => filterStatus === "todos" || p.status === filterStatus) ?? [];
  const fmt = (v: number | null) => `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderKanban size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Projetos</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Novo Projeto
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["todos", ...statusOptions] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
            {s === "todos" ? "Todos" : statusLabels[s as StatusProjeto]}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{editId ? "Editar Projeto" : "Novo Projeto"}</h2>
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
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Forma Pagamento</label>
              <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {formasPagamento?.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                <option value="Pix">Pix</option><option value="Boleto">Boleto</option><option value="Cartão">Cartão</option><option value="Transferência">Transferência</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Nº Parcelas</label><input type="number" min={1} value={numeroParcelas} onChange={e => setNumeroParcelas(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Início</label><input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Previsão</label><input type="date" value={dataPrevisao} onChange={e => setDataPrevisao(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1 col-span-full"><label className="text-[11px] text-muted-foreground">Observações Pagamento</label><input value={observacoesPagamento} onChange={e => setObservacoesPagamento(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createProjeto.isPending || updateProjeto.isPending} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition disabled:opacity-50">
              {editId ? "Salvar" : "Criar Projeto"}
            </button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition">Cancelar</button>
          </div>
          {selectedProjetoId && (
            <>
              <ProjetoItensSection projetoId={selectedProjetoId} />
              <VisitasTecnicasSection projetoId={selectedProjetoId} />
            </>
          )}
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
                        <button onClick={() => { if (window.confirm("Excluir projeto e todos os itens vinculados?")) removeProjeto.mutate(p.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Subcomponent for project items with product autocomplete
const ProjetoItensSection = ({ projetoId }: { projetoId: string }) => {
  const empresaId = useEmpresa();
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

  const filteredProdutos = produtos?.filter(p => p.nome.toLowerCase().includes(desc.toLowerCase())) ?? [];

  const selectProduto = (p: any) => {
    setDesc(p.nome); setCusto(p.preco_custo ?? 0); setVenda(p.preco_venda ?? 0);
    setProdutoId(p.id); setShowSuggestions(false);
  };

  const totalCusto = itens?.reduce((acc, i) => acc + (i.quantidade ?? 1) * (i.preco_custo ?? 0), 0) ?? 0;
  const totalVenda = itens?.reduce((acc, i) => acc + (i.quantidade ?? 1) * (i.preco_venda ?? 0), 0) ?? 0;
  const margem = totalVenda > 0 ? ((totalVenda - totalCusto) / totalVenda) * 100 : 0;

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

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <h3 className="text-xs font-semibold text-foreground">Itens do Projeto</h3>
      <div className="flex gap-4 text-[11px]">
        <span className="text-muted-foreground">Custo: <strong className="text-foreground">R$ {totalCusto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
        <span className="text-muted-foreground">Venda: <strong className="text-foreground">R$ {totalVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
        <span className="text-muted-foreground">Margem: <strong className={margem > 0 ? "text-success" : "text-destructive"}>{margem.toFixed(1)}%</strong></span>
        <span className="text-muted-foreground">Lucro: <strong className={totalVenda - totalCusto > 0 ? "text-success" : "text-destructive"}>R$ {(totalVenda - totalCusto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
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
    </div>
  );
};

// Visitas Técnicas subcomponent
const VisitasTecnicasSection = ({ projetoId }: { projetoId: string }) => {
  const empresaId = useEmpresa();
  const { data: visitas, isLoading } = useVisitasTecnicas(projetoId);
  const createVisita = useCreateVisita();
  const updateVisita = useUpdateVisita();

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
  const [tecnicoId, setTecnicoId] = useState("");
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [servicos, setServicos] = useState("");
  const [valor, setValor] = useState(0);

  const handleAdd = async () => {
    try {
      const v = await createVisita.mutateAsync({
        projeto_id: projetoId, tecnico_id: tecnicoId || null,
        data: data || null, descricao: descricao || null,
        servicos_executados: servicos || null, valor_pago_tecnico: valor,
      });
      // Auto-generate conta a pagar for technician payment
      if (valor > 0 && empresaId) {
        await supabase.from("financeiro_pagar").insert({
          empresa_id: empresaId, projeto_id: projetoId,
          fornecedor_id: tecnicoId || null,
          descricao: `Visita técnica — ${descricao || "Sem descrição"}`,
          valor, data_vencimento: data || null, status: "pendente",
        });
      }
      setTecnicoId(""); setData(""); setDescricao(""); setServicos(""); setValor(0); setShowForm(false);
      toast.success("Visita registrada");
    } catch (err: any) { toast.error(err.message); }
  };

  const markPago = async (visita: any) => {
    try {
      await updateVisita.mutateAsync({ id: visita.id, projeto_id: projetoId, status_pagamento: "pago", data_pagamento: new Date().toISOString().split("T")[0] });
      toast.success("Pagamento registrado");
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground">Visitas Técnicas</h3>
        <button onClick={() => setShowForm(!showForm)} className="text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:brightness-105">
          <Plus size={12} className="inline mr-1" />Nova Visita
        </button>
      </div>

      {showForm && (
        <div className="bg-secondary/30 rounded p-3 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Técnico</label>
              <select value={tecnicoId} onChange={e => setTecnicoId(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded">
                <option value="">Selecionar...</option>
                {tecnicos?.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data</label><input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor Técnico</label><input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Descrição</label><input value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Serviços Executados</label><input value={servicos} onChange={e => setServicos(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={createVisita.isPending} className="px-3 py-1 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50">Salvar</button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1 text-xs rounded bg-secondary text-secondary-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : visitas && visitas.length > 0 && (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Técnico</th>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Data</th>
              <th className="text-left px-2 py-1.5 font-semibold border-b border-border">Descrição</th>
              <th className="text-right px-2 py-1.5 font-semibold border-b border-border">Valor</th>
              <th className="text-center px-2 py-1.5 font-semibold border-b border-border">Pgto</th>
            </tr></thead>
            <tbody>
              {visitas.map(v => (
                <tr key={v.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2 py-1.5">{(v.fornecedores as any)?.nome ?? "—"}</td>
                  <td className="px-2 py-1.5">{v.data ?? "—"}</td>
                  <td className="px-2 py-1.5">{v.descricao ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">R$ {(v.valor_pago_tecnico ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1.5 text-center">
                    {v.status_pagamento === "pago" ? (
                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-success/15 text-success">Pago</span>
                    ) : (
                      <button onClick={() => markPago(v)} className="px-1.5 py-0.5 rounded text-[11px] bg-warning/15 text-warning hover:bg-warning/25">Pendente</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Projetos;
