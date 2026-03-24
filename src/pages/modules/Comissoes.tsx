import { useState } from "react";
import { UserCheck, Pencil, Check } from "lucide-react";
import { useComissoes } from "@/hooks/useFinanceiro";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Comissoes = () => {
  const { data: comissoes, isLoading } = useComissoes();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editPercentual, setEditPercentual] = useState(0);
  const [editValor, setEditValor] = useState(0);

  const updateComissao = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; percentual?: number; valor?: number; status?: string; data_vencimento?: string }) => {
      const { error } = await supabase.from("comissoes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comissoes"] }); },
  });

  const handleSaveEdit = async (id: string) => {
    try {
      await updateComissao.mutateAsync({ id, percentual: editPercentual, valor: editValor });
      // Update linked conta a pagar
      await supabase.from("financeiro_pagar").update({ valor: editValor }).eq("comissao_id", id);
      setEditId(null);
      toast.success("Comissão atualizada");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleBaixa = async (c: any) => {
    try {
      await updateComissao.mutateAsync({ id: c.id, status: "pago" });
      // Update linked conta a pagar
      await supabase.from("financeiro_pagar").update({ status: "pago", data_pagamento: new Date().toISOString().split("T")[0] }).eq("comissao_id", c.id);
      toast.success("Comissão marcada como paga");
    } catch (err: any) { toast.error(err.message); }
  };

  const openEdit = (c: any) => {
    setEditId(c.id); setEditPercentual(c.percentual ?? 0); setEditValor(c.valor ?? 0);
  };

  const statusColor = (s: string) => s === "pago" ? "bg-success/15 text-success" : "bg-warning/15 text-warning";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <UserCheck size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Comissões (RT)</h1>
      </div>
      <p className="text-xs text-muted-foreground">Comissões geradas automaticamente. Edite valores ou dê baixa.</p>

      {isLoading ? <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p> : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Arquiteto</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">%</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Vencimento</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
              </tr>
            </thead>
            <tbody>
              {comissoes?.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5">{(c.fornecedores as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{(c.projetos as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right">
                    {editId === c.id ? <input type="number" value={editPercentual} onChange={e => setEditPercentual(Number(e.target.value))} className="w-14 h-6 px-1 text-xs bg-background border border-border rounded" /> : `${c.percentual ?? 0}%`}
                  </td>
                  <td className="px-2.5 py-1.5 text-right font-medium">
                    {editId === c.id ? <input type="number" value={editValor} onChange={e => setEditValor(Number(e.target.value))} className="w-20 h-6 px-1 text-xs bg-background border border-border rounded" /> : `R$ ${(c.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                  </td>
                  <td className="px-2.5 py-1.5 text-center">{c.data_vencimento ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor(c.status ?? "pendente")}`}>{c.status}</span>
                  </td>
                  <td className="px-2.5 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {editId === c.id ? (
                        <button onClick={() => handleSaveEdit(c.id)} className="px-2 py-0.5 rounded bg-primary text-primary-foreground text-[11px]">Salvar</button>
                      ) : (
                        <>
                          <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                          {c.status !== "pago" && <button onClick={() => handleBaixa(c)} className="p-1 rounded hover:bg-success/15 text-muted-foreground hover:text-success" title="Dar baixa"><Check size={13} /></button>}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(!comissoes || comissoes.length === 0) && <tr><td colSpan={7} className="text-center py-4 text-muted-foreground">Nenhuma comissão encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Comissoes;
