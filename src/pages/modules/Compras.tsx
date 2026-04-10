import { useState } from "react";
import { ShoppingCart, Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { isNotEmpty, isPositiveNumber, isGreaterThanZero } from "@/lib/validations";

type StatusCompra = Database["public"]["Enums"]["status_compra"];
const statusOptions: StatusCompra[] = ["pendente", "aprovada", "entregue", "cancelada"];
const statusColor = (s: string) => s === "aprovada" ? "bg-success/15 text-success" : s === "pendente" ? "bg-warning/15 text-warning" : s === "entregue" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive";

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

  const { data: compras, isLoading } = useQuery({
    queryKey: ["compras", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("compras").select("*, fornecedores(nome), projetos(nome)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores", empresaId],
    queryFn: async () => { const { data } = await supabase.from("fornecedores").select("id, nome").order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });

  const { data: projetos } = useQuery({
    queryKey: ["projetos_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("projetos").select("id, nome").order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("produtos").select("id, nome").order("nome"); return data ?? []; },
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
      const payload = { descricao: desc, quantidade: qtd, valor_unitario: valorUnit, valor_total: qtd * valorUnit, fornecedor_id: fornecedorId || null, projeto_id: projetoId || null, produto_id: produtoId || null };
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
      // Auto-insert estoque when entregue
      if (status === "entregue" && produto_id && empresaId) {
        await supabase.from("estoque_itens").insert({ empresa_id: empresaId, produto_id, compra_id: id, projeto_id: projeto_id || null, status: "disponivel", localizacao: "Depósito" });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compras"] }); qc.invalidateQueries({ queryKey: ["estoque_itens"] }); qc.invalidateQueries({ queryKey: ["projetos"] }); toast.success("Status atualizado"); },
    onError: (err: any) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("compras").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compras"] }); toast.success("Compra excluída"); },
    onError: (err: any) => toast.error(err.message),
  });

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
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Data</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Descrição</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Fornecedor</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Qtd</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Total</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
              </tr>
            </thead>
            <tbody>
              {compras?.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => openEdit(c)}>
                  <td className="px-2.5 py-1.5">{c.data_compra ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{c.descricao ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{(c.fornecedores as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{(c.projetos as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right">{c.quantidade}</td>
                  <td className="px-2.5 py-1.5 text-right font-medium">R$ {(c.valor_total ?? 0).toLocaleString("pt-BR")}</td>
                  <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    <select
                      value={c.status ?? "pendente"}
                      onChange={e => changeStatus.mutate({ id: c.id, status: e.target.value as StatusCompra, produto_id: c.produto_id, projeto_id: c.projeto_id })}
                      className={`px-1.5 py-0.5 rounded text-[11px] font-medium border-0 cursor-pointer ${statusColor(c.status ?? "pendente")}`}
                    >
                      {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                      <button onClick={() => { if (window.confirm("Excluir compra?")) remove.mutate(c.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!compras || compras.length === 0) && <tr><td colSpan={8} className="text-center py-4 text-muted-foreground">Nenhuma compra registrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Compras;
