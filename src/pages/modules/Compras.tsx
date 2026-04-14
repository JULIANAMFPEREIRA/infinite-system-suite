import { sanitizePayload } from "@/lib/sanitize";
import { useState } from "react";
import { ShoppingCart, Plus, Pencil, Trash2, Filter } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { isNotEmpty, isPositiveNumber, isGreaterThanZero } from "@/lib/validations";
import { fmtBRL, statusBadgeClass, statusLabel } from "@/lib/financeiroUtils";

type StatusCompra = Database["public"]["Enums"]["status_compra"];
const statusOptions: StatusCompra[] = ["pendente", "em_compra", "comprado", "instalado", "cancelada"];

const fmt = (v: number) => fmtBRL(v);

const Compras = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [qtd, setQtd] = useState(1);
  const [valorUnit, setValorUnit] = useState(0);
  const [fornecedorId, setFornecedorId] = useState("");
  const [projetoId, setProjetoId] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterProjeto, setFilterProjeto] = useState<string>("todos");

  const { data: compras, isLoading } = useQuery({
    queryKey: ["compras", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras")
        .select("*, fornecedores(nome), projetos(nome, cliente_id, clientes(nome)), produtos(nome)")
        .eq("deletado", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores", empresaId],
    queryFn: async () => { const { data } = await supabase.from("fornecedores").select("id, nome").eq("deletado", false).order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });

  const { data: projetos } = useQuery({
    queryKey: ["projetos_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("projetos").select("id, nome").eq("deletado", false).order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("produtos").select("id, nome").eq("deletado", false).order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });

  const resetForm = () => { setDesc(""); setQtd(1); setValorUnit(0); setFornecedorId(""); setProjetoId(""); setProdutoId(""); setEditId(null); setShowForm(false); };

  const openEdit = (c: any) => {
    setEditId(c.id); setDesc(c.descricao ?? ""); setQtd(c.quantidade ?? 1); setValorUnit(c.valor_unitario ?? 0);
    setFornecedorId(c.fornecedor_id ?? ""); setProjetoId(c.projeto_id ?? ""); setProdutoId(c.produto_id ?? ""); setShowForm(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!isNotEmpty(desc, "Descrição")) throw new Error("Validação falhou");
      if (!isGreaterThanZero(qtd, "Quantidade")) throw new Error("Validação falhou");
      if (!isPositiveNumber(valorUnit, "Valor unitário")) throw new Error("Validação falhou");
      const payload = sanitizePayload({ descricao: desc, quantidade: qtd, valor_unitario: valorUnit, valor_total: qtd * valorUnit, fornecedor_id: fornecedorId || null, projeto_id: projetoId || null, produto_id: produtoId || null });
      if (editId) {
        const { error } = await supabase.from("compras").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("compras").insert({ ...payload, empresa_id: empresaId!, status: "pendente" });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compras"] }); toast.success(editId ? "Compra atualizada" : "Compra registrada"); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status, produto_id, projeto_id }: { id: string; status: StatusCompra; produto_id?: string | null; projeto_id?: string | null }) => {
      const { error } = await supabase.from("compras").update({ status }).eq("id", id);
      if (error) throw error;
      // Auto-insert estoque when instalado or entregue
      if ((status === "instalado" || status === "entregue") && produto_id && empresaId) {
        const { data: existing } = await supabase.from("estoque_itens").select("id").eq("compra_id", id).limit(1);
        if (!existing || existing.length === 0) {
          await supabase.from("estoque_itens").insert({
            empresa_id: empresaId, produto_id, compra_id: id,
            projeto_id: projeto_id || null,
            status: status === "instalado" ? "instalado" : "disponivel",
            localizacao: status === "instalado" ? "Instalado no projeto" : "Depósito",
          });
        }
      }
      // Sync necessidades_compra status if linked
      if (status === "comprado" || status === "em_compra" || status === "instalado") {
        await supabase.from("necessidades_compra" as any)
          .update({ status: status === "instalado" ? "comprado" : status === "comprado" ? "comprado" : "pendente" } as any)
          .eq("compra_id", id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["estoque_itens"] });
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["necessidades_compra"] });
      toast.success("Status atualizado");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("compras").update({ deletado: true } as any).eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compras"] }); toast.success("Compra excluída"); },
    onError: (err: any) => toast.error(err.message),
  });

  // Filtered data
  const filtered = compras?.filter(c => {
    if (filterStatus !== "todos" && c.status !== filterStatus) return false;
    if (filterProjeto !== "todos" && c.projeto_id !== filterProjeto) return false;
    return true;
  }) ?? [];

  // Unique projects from compras for filter
  const projetosComCompras = compras?.reduce((acc: { id: string; nome: string }[], c) => {
    if (c.projeto_id && !(acc.find(p => p.id === c.projeto_id))) {
      acc.push({ id: c.projeto_id, nome: (c.projetos as any)?.nome ?? "—" });
    }
    return acc;
  }, []) ?? [];

  // Summary counts
  const counts = {
    pendente: compras?.filter(c => c.status === "pendente").length ?? 0,
    em_compra: compras?.filter(c => c.status === "em_compra").length ?? 0,
    comprado: compras?.filter(c => c.status === "comprado" || c.status === "aprovada").length ?? 0,
    instalado: compras?.filter(c => c.status === "instalado" || c.status === "entregue").length ?? 0,
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Compras</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Nova Compra
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Pendentes", value: counts.pendente, color: "text-warning" },
          { label: "Em compra", value: counts.em_compra, color: "text-blue-600" },
          { label: "Comprados", value: counts.comprado, color: "text-success" },
          { label: "Instalados", value: counts.instalado, color: "text-primary" },
        ].map(card => (
          <div key={card.label} className="bg-card border border-border rounded p-2.5 text-center">
            <div className={`text-lg font-bold ${card.color}`}>{card.value}</div>
            <div className="text-[11px] text-muted-foreground">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-muted-foreground" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-7 px-2 text-xs bg-background border border-border rounded focus:outline-none">
          <option value="todos">Todos os status</option>
          {statusOptions.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
          <option value="aprovada">APROVADA (legado)</option>
          <option value="entregue">ENTREGUE (legado)</option>
        </select>
        <select value={filterProjeto} onChange={e => setFilterProjeto(e.target.value)} className="h-7 px-2 text-xs bg-background border border-border rounded focus:outline-none">
          <option value="todos">Todos os projetos</option>
          {projetosComCompras.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded p-3 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">{editId ? "Editar Compra" : "Nova Compra"}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2">
              <label className="text-[11px] text-muted-foreground">Descrição</label>
              <input value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Fornecedor</label>
              <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {fornecedores?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Projeto</label>
              <select value={projetoId} onChange={e => setProjetoId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {projetos?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Produto</label>
              <select value={produtoId} onChange={e => setProdutoId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {produtos?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Qtd</label>
              <input type="number" value={qtd} onChange={e => setQtd(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Valor Unit.</label>
              <input type="number" value={valorUnit} onChange={e => setValorUnit(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => save.mutate()} disabled={save.isPending || !desc.trim()} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p> : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Descrição</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Produto</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Projeto</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Cliente</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Fornecedor</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Qtd</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Total</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Status</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap w-20">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const clienteNome = (c.projetos as any)?.clientes?.nome ?? "—";
                  const produtoNome = (c.produtos as any)?.nome ?? "—";
                  return (
                    <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer transition-colors" onClick={() => openEdit(c)}>
                      <td className="px-3 py-2 font-medium text-foreground max-w-[180px] truncate">{c.descricao ?? "—"}</td>
                      <td className="px-3 py-2 text-foreground/80 max-w-[140px] truncate">{produtoNome}</td>
                      <td className="px-3 py-2 text-foreground/80 max-w-[140px] truncate">{(c.projetos as any)?.nome ?? "—"}</td>
                      <td className="px-3 py-2 text-foreground/80 max-w-[140px] truncate">{clienteNome}</td>
                      <td className="px-3 py-2 text-foreground/80 max-w-[140px] truncate">{(c.fornecedores as any)?.nome ?? "—"}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{c.quantidade}</td>
                      <td className="px-3 py-2 text-right font-bold text-foreground tabular-nums">{fmt(c.valor_total ?? 0)}</td>
                      <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <select
                          value={c.status ?? "pendente"}
                          onChange={e => changeStatus.mutate({ id: c.id, status: e.target.value as StatusCompra, produto_id: c.produto_id, projeto_id: c.projeto_id })}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border cursor-pointer ${statusBadgeClass(c.status ?? "pendente")}`}
                        >
                          {statusOptions.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => openEdit(c)} title="Editar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => { if (window.confirm("Excluir compra?")) remove.mutate(c.id); }} title="Excluir" className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma compra encontrada.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Compras;
