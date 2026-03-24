import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useProjetos, useClientes, useArquitetos, useCreateProjeto, useUpdateProjeto, useProjetoItens, useCreateProjetoItem, useDeleteProjetoItem } from "@/hooks/useProjetos";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useNecessidadesPendentesCount, useCreateNecessidade, useCheckEstoque } from "@/hooks/useNecessidadesCompra";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type StatusProjeto = Database["public"]["Enums"]["status_projeto"];
type TipoItem = Database["public"]["Enums"]["tipo_projeto_item"];

const statusLabels: Record<StatusProjeto, string> = {
  orcamento: "Orçamento", aprovado: "Aprovado", em_andamento: "Em Andamento", concluido: "Concluído", cancelado: "Cancelado"
};
const statusColors: Record<StatusProjeto, string> = {
  orcamento: "bg-secondary text-secondary-foreground", aprovado: "bg-success/15 text-success", em_andamento: "bg-primary/15 text-primary", concluido: "bg-info/15 text-info", cancelado: "bg-destructive/15 text-destructive"
};

const Projetos = () => {
  const navigate = useNavigate();
  const empresaId = useEmpresa();
  const { data: projetos, isLoading } = useProjetos();
  const { data: pendenciaCounts } = useNecessidadesPendentesCount();
  const { data: clientes } = useClientes();
  const { data: arquitetos } = useArquitetos();
  const createProjeto = useCreateProjeto();
  const updateProjeto = useUpdateProjeto();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<StatusProjeto | "todos">("todos");

  // Form state
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [arquitetoId, setArquitetoId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataPrevisao, setDataPrevisao] = useState("");

  // Items section
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);

  const resetForm = () => {
    setNome(""); setDescricao(""); setClienteId(""); setArquitetoId(""); setDataInicio(""); setDataPrevisao("");
    setEditId(null); setShowForm(false); setSelectedProjetoId(null);
  };

  const openEdit = (p: any) => {
    setEditId(p.id); setNome(p.nome); setDescricao(p.descricao ?? ""); setClienteId(p.cliente_id ?? ""); setArquitetoId(p.arquiteto_id ?? "");
    setDataInicio(p.data_inicio ?? ""); setDataPrevisao(p.data_previsao ?? ""); setShowForm(true); setSelectedProjetoId(p.id);
  };

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      if (editId) {
        await updateProjeto.mutateAsync({ id: editId, nome, descricao: descricao || null, cliente_id: clienteId || null, arquiteto_id: arquitetoId || null, data_inicio: dataInicio || null, data_previsao: dataPrevisao || null });
        toast.success("Projeto atualizado");
      } else {
        const data = await createProjeto.mutateAsync({ nome, descricao: descricao || null, cliente_id: clienteId || null, arquiteto_id: arquitetoId || null, data_inicio: dataInicio || null, data_previsao: dataPrevisao || null, status: "orcamento" });
        setSelectedProjetoId(data.id); setEditId(data.id);
        toast.success("Projeto criado! Adicione itens abaixo.");
        return; // keep form open for items
      }
      resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

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

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {(["todos", "orcamento", "aprovado", "em_andamento", "concluido", "cancelado"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
            {s === "todos" ? "Todos" : statusLabels[s as StatusProjeto]}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{editId ? "Editar Projeto" : "Novo Projeto"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Nome *</label>
              <input value={nome} onChange={e => setNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Descrição</label>
              <input value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:ring-1 focus:ring-primary focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Cliente</label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {clientes?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Arquiteto</label>
              <select value={arquitetoId} onChange={e => setArquitetoId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {arquitetos?.map(a => <option key={a.id} value={a.id}>{a.nome} ({a.rt_percentual ?? 0}%)</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Data Início</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Previsão</label>
              <input type="date" value={dataPrevisao} onChange={e => setDataPrevisao(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createProjeto.isPending || updateProjeto.isPending} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition disabled:opacity-50">
              {editId ? "Salvar" : "Criar Projeto"}
            </button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition">Cancelar</button>
          </div>

          {/* Items */}
          {selectedProjetoId && <ProjetoItensSection projetoId={selectedProjetoId} />}
        </div>
      )}

      {/* Table */}
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
                  <th className="text-left px-2.5 py-2 font-semibold text-foreground border-b border-border">Status</th>
                  <th className="text-right px-2.5 py-2 font-semibold text-foreground border-b border-border">Custo Prev.</th>
                  <th className="text-right px-2.5 py-2 font-semibold text-foreground border-b border-border">Venda</th>
                  <th className="text-right px-2.5 py-2 font-semibold text-foreground border-b border-border">Margem</th>
                  <th className="text-center px-2.5 py-2 font-semibold text-foreground border-b border-border">Pendências</th>
                  <th className="text-center px-2.5 py-2 font-semibold text-foreground border-b border-border">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-2.5 py-1.5 text-foreground font-medium">{p.nome}</td>
                    <td className="px-2.5 py-1.5 text-foreground">{(p.clientes as any)?.nome ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-foreground">{(p.fornecedores as any)?.nome ?? "—"}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColors[p.status as StatusProjeto]}`}>
                        {statusLabels[p.status as StatusProjeto]}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right text-foreground">{fmt(p.custo_previsto)}</td>
                    <td className="px-2.5 py-1.5 text-right text-foreground font-medium">{fmt(p.venda_total)}</td>
                    <td className="px-2.5 py-1.5 text-right">
                      <span className={(p.margem_prevista ?? 0) > 0 ? "text-success" : "text-destructive"}>
                        {(p.margem_prevista ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      <button onClick={() => openEdit(p)} className="p-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-primary">
                        <Pencil size={13} />
                      </button>
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

// Subcomponent for project items
const ProjetoItensSection = ({ projetoId }: { projetoId: string }) => {
  const { data: itens, isLoading } = useProjetoItens(projetoId);
  const createItem = useCreateProjetoItem();
  const deleteItem = useDeleteProjetoItem();
  const updateProjeto = useUpdateProjeto();

  const [desc, setDesc] = useState("");
  const [tipo, setTipo] = useState<TipoItem>("produto");
  const [qtd, setQtd] = useState(1);
  const [custo, setCusto] = useState(0);
  const [venda, setVenda] = useState(0);
  const [rt, setRt] = useState(0);

  const totalCusto = itens?.reduce((acc, i) => acc + (i.quantidade ?? 1) * (i.preco_custo ?? 0), 0) ?? 0;
  const totalVenda = itens?.reduce((acc, i) => acc + (i.quantidade ?? 1) * (i.preco_venda ?? 0), 0) ?? 0;
  const margem = totalVenda > 0 ? ((totalVenda - totalCusto) / totalVenda) * 100 : 0;

  const handleAddItem = async () => {
    if (!desc.trim()) { toast.error("Descrição obrigatória"); return; }
    try {
      await createItem.mutateAsync({ projeto_id: projetoId, descricao: desc, tipo, quantidade: qtd, preco_custo: custo, preco_venda: venda, rt_percentual: rt });
      // Update project totals
      const newCusto = totalCusto + qtd * custo;
      const newVenda = totalVenda + qtd * venda;
      const newMargem = newVenda > 0 ? ((newVenda - newCusto) / newVenda) * 100 : 0;
      await updateProjeto.mutateAsync({ id: projetoId, custo_previsto: newCusto, venda_total: newVenda, margem_prevista: newMargem });
      setDesc(""); setQtd(1); setCusto(0); setVenda(0); setRt(0);
      toast.success("Item adicionado");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await deleteItem.mutateAsync({ id: itemId, projetoId });
      toast.success("Item removido");
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <h3 className="text-xs font-semibold text-foreground">Itens do Projeto</h3>

      {/* Summary */}
      <div className="flex gap-4 text-[11px]">
        <span className="text-muted-foreground">Custo: <strong className="text-foreground">R$ {totalCusto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
        <span className="text-muted-foreground">Venda: <strong className="text-foreground">R$ {totalVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
        <span className="text-muted-foreground">Margem: <strong className={margem > 0 ? "text-success" : "text-destructive"}>{margem.toFixed(1)}%</strong></span>
        <span className="text-muted-foreground">Lucro: <strong className={totalVenda - totalCusto > 0 ? "text-success" : "text-destructive"}>R$ {(totalVenda - totalCusto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
      </div>

      {/* Items list */}
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

      {/* Add item */}
      <div className="flex items-end gap-2 flex-wrap">
        <div className="space-y-1 flex-1 min-w-[120px]">
          <label className="text-[11px] text-muted-foreground">Descrição</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-7 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
        </div>
        <div className="space-y-1 w-24">
          <label className="text-[11px] text-muted-foreground">Tipo</label>
          <select value={tipo} onChange={e => setTipo(e.target.value as TipoItem)} className="w-full h-7 px-1 text-xs bg-background border border-border rounded focus:outline-none">
            <option value="produto">Produto</option>
            <option value="servico">Serviço</option>
            <option value="mao_de_obra">Mão de Obra</option>
          </select>
        </div>
        <div className="space-y-1 w-14">
          <label className="text-[11px] text-muted-foreground">Qtd</label>
          <input type="number" value={qtd} onChange={e => setQtd(Number(e.target.value))} className="w-full h-7 px-1 text-xs bg-background border border-border rounded focus:outline-none" />
        </div>
        <div className="space-y-1 w-20">
          <label className="text-[11px] text-muted-foreground">Custo</label>
          <input type="number" value={custo} onChange={e => setCusto(Number(e.target.value))} className="w-full h-7 px-1 text-xs bg-background border border-border rounded focus:outline-none" />
        </div>
        <div className="space-y-1 w-20">
          <label className="text-[11px] text-muted-foreground">Venda</label>
          <input type="number" value={venda} onChange={e => setVenda(Number(e.target.value))} className="w-full h-7 px-1 text-xs bg-background border border-border rounded focus:outline-none" />
        </div>
        <div className="space-y-1 w-14">
          <label className="text-[11px] text-muted-foreground">RT%</label>
          <input type="number" value={rt} onChange={e => setRt(Number(e.target.value))} className="w-full h-7 px-1 text-xs bg-background border border-border rounded focus:outline-none" />
        </div>
        <button onClick={handleAddItem} disabled={createItem.isPending} className="h-7 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition disabled:opacity-50">
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
};

export default Projetos;
