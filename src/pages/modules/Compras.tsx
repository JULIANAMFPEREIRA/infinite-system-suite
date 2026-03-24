import { useState } from "react";
import { ShoppingCart, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";

const Compras = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [qtd, setQtd] = useState(1);
  const [valorUnit, setValorUnit] = useState(0);

  const { data: compras, isLoading } = useQuery({
    queryKey: ["compras", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("compras").select("*, fornecedores(nome), projetos(nome)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("compras").insert({ empresa_id: empresaId!, descricao: desc, quantidade: qtd, valor_unitario: valorUnit, valor_total: qtd * valorUnit, status: "pendente" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["compras"] }); toast.success("Compra registrada"); setShowForm(false); setDesc(""); setQtd(1); setValorUnit(0); },
    onError: (err: any) => toast.error(err.message),
  });

  const statusColor = (s: string) => s === "aprovada" ? "bg-success/15 text-success" : s === "pendente" ? "bg-warning/15 text-warning" : s === "entregue" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Compras</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Nova Compra
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded p-3 flex items-end gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-[150px]">
            <label className="text-[11px] text-muted-foreground">Descrição</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1 w-16">
            <label className="text-[11px] text-muted-foreground">Qtd</label>
            <input type="number" value={qtd} onChange={e => setQtd(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
          </div>
          <div className="space-y-1 w-24">
            <label className="text-[11px] text-muted-foreground">Valor Unit.</label>
            <input type="number" value={valorUnit} onChange={e => setValorUnit(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
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
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Fornecedor</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Qtd</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">V. Unit.</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Total</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
              </tr>
            </thead>
            <tbody>
              {compras?.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5">{c.data_compra ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{c.descricao ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{(c.fornecedores as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{(c.projetos as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right">{c.quantidade}</td>
                  <td className="px-2.5 py-1.5 text-right">R$ {(c.valor_unitario ?? 0).toLocaleString("pt-BR")}</td>
                  <td className="px-2.5 py-1.5 text-right font-medium">R$ {(c.valor_total ?? 0).toLocaleString("pt-BR")}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium capitalize ${statusColor(c.status ?? "pendente")}`}>{c.status}</span>
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
