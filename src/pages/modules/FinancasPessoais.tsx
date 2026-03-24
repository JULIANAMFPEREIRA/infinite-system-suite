import { useState } from "react";
import { Wallet, Plus } from "lucide-react";
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

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("financas_pessoais").insert({ empresa_id: empresaId!, usuario_id: user!.id, descricao: desc, categoria: categoria || null, valor, tipo, data });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financas_pessoais"] }); toast.success("Lançamento registrado"); setShowForm(false); setDesc(""); setCategoria(""); setValor(0); },
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
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
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
        <div className="bg-card border border-border rounded p-3 flex items-end gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-[120px]">
            <label className="text-[11px] text-muted-foreground">Descrição</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1 w-28">
            <label className="text-[11px] text-muted-foreground">Categoria</label>
            <input value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
          </div>
          <div className="space-y-1 w-24">
            <label className="text-[11px] text-muted-foreground">Valor</label>
            <input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
          </div>
          <div className="space-y-1 w-28">
            <label className="text-[11px] text-muted-foreground">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoFinanca)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
              <option value="retirada">Retirada</option>
              <option value="devolucao">Devolução</option>
            </select>
          </div>
          <div className="space-y-1 w-32">
            <label className="text-[11px] text-muted-foreground">Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
          </div>
          <button onClick={() => create.mutate()} disabled={create.isPending || !desc.trim()} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
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
              </tr>
            </thead>
            <tbody>
              {financas?.map(f => (
                <tr key={f.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5">{f.data ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{f.descricao ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{f.categoria ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right font-medium">R$ {(f.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${tipoColor(f.tipo ?? "despesa")}`}>{tipoLabel[f.tipo ?? "despesa"]}</span>
                  </td>
                </tr>
              ))}
              {(!financas || financas.length === 0) && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum lançamento encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FinancasPessoais;
