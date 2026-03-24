import { useState } from "react";
import { Wallet, Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TipoFinanca = Database["public"]["Enums"]["tipo_financa_pessoal"];

const FinancasPessoais = () => {
  const empresaId = useEmpresa();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [categoria, setCategoria] = useState("");
  const [valor, setValor] = useState(0);
  const [tipo, setTipo] = useState<TipoFinanca>("despesa");
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);

  const { data: financas, isLoading } = useQuery({
    queryKey: ["financas_pessoais", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("financas_pessoais").select("*").order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const resetForm = () => { setDesc(""); setCategoria(""); setValor(0); setTipo("despesa"); setData(new Date().toISOString().split("T")[0]); setEditId(null); setShowForm(false); };

  const openEdit = (f: any) => {
    setEditId(f.id); setDesc(f.descricao ?? ""); setCategoria(f.categoria ?? ""); setValor(f.valor ?? 0); setTipo(f.tipo ?? "despesa"); setData(f.data ?? new Date().toISOString().split("T")[0]); setShowForm(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = { descricao: desc, categoria: categoria || null, valor, tipo, data };
      if (editId) {
        const { error } = await supabase.from("financas_pessoais").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financas_pessoais").insert({ ...payload, empresa_id: empresaId!, usuario_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financas_pessoais"] }); toast.success(editId ? "Atualizado" : "Lançamento registrado"); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("financas_pessoais").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financas_pessoais"] }); toast.success("Excluído"); },
    onError: (err: any) => toast.error(err.message),
  });

  const saldo = financas?.reduce((acc, item) => {
    if (item.tipo === "receita" || item.tipo === "devolucao") return acc + (item.valor ?? 0);
    return acc - (item.valor ?? 0);
  }, 0) ?? 0;

  const tipoColor = (t: string) => t === "receita" || t === "devolucao" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive";
  const tipoLabel: Record<string, string> = { retirada: "Retirada", devolucao: "Devolução", despesa: "Despesa", receita: "Receita" };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Finanças Pessoais</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Novo Lançamento
        </button>
      </div>

      <div className="bg-card border border-border rounded p-3 inline-flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Saldo Atual:</span>
        <span className={`text-sm font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>
          R$ {Math.abs(saldo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} {saldo < 0 ? "(negativo)" : ""}
        </span>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded p-3 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">{editId ? "Editar" : "Novo"} Lançamento</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Descrição</label><input value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Categoria</label><input value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor</label><input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoFinanca)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
                <option value="retirada">Retirada</option>
                <option value="devolucao">Devolução</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data</label><input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
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
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Categoria</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Tipo</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
              </tr>
            </thead>
            <tbody>
              {financas?.map(f => (
                <tr key={f.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => openEdit(f)}>
                  <td className="px-2.5 py-1.5">{f.data ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{f.descricao ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{f.categoria ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right font-medium">R$ {(f.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${tipoColor(f.tipo ?? "despesa")}`}>{tipoLabel[f.tipo ?? "despesa"]}</span>
                  </td>
                  <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(f)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                      <button onClick={() => { if (window.confirm("Excluir lançamento?")) remove.mutate(f.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!financas || financas.length === 0) && <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhum lançamento encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FinancasPessoais;
