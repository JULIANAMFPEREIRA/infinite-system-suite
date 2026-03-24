import { useState } from "react";
import { DollarSign, Plus, Check } from "lucide-react";
import { useFinanceiroReceber, useCreateContaReceber, useUpdateContaReceber } from "@/hooks/useFinanceiro";
import { toast } from "sonner";

const FinanceiroReceber = () => {
  const { data: contas, isLoading } = useFinanceiroReceber();
  const createConta = useCreateContaReceber();
  const updateConta = useUpdateContaReceber();
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState("");
  const [parcela, setParcela] = useState(1);

  const handleAdd = async () => {
    if (!desc.trim()) { toast.error("Descrição obrigatória"); return; }
    try {
      await createConta.mutateAsync({ descricao: desc, valor, data_vencimento: vencimento || null, parcela, status: "pendente" });
      toast.success("Parcela adicionada"); setDesc(""); setValor(0); setVencimento(""); setParcela(1); setShowForm(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleReceber = async (id: string) => {
    try {
      await updateConta.mutateAsync({ id, status: "pago", data_pagamento: new Date().toISOString().split("T")[0] });
      toast.success("Recebido!");
    } catch (err: any) { toast.error(err.message); }
  };

  const statusColor = (s: string) => s === "pago" ? "bg-success/15 text-success" : s === "vencido" ? "bg-destructive/15 text-destructive" : s === "cancelado" ? "bg-secondary text-muted-foreground" : "bg-warning/15 text-warning";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Contas a Receber</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Nova Parcela
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded p-3 flex items-end gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-[150px]">
            <label className="text-[11px] text-muted-foreground">Descrição</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1 w-28">
            <label className="text-[11px] text-muted-foreground">Valor</label>
            <input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
          </div>
          <div className="space-y-1 w-20">
            <label className="text-[11px] text-muted-foreground">Parcela</label>
            <input type="number" value={parcela} onChange={e => setParcela(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
          </div>
          <div className="space-y-1 w-36">
            <label className="text-[11px] text-muted-foreground">Vencimento</label>
            <input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
          </div>
          <button onClick={handleAdd} disabled={createConta.isPending} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
        </div>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p> : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Descrição</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Cliente</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Parcela</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Vencimento</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ação</th>
              </tr>
            </thead>
            <tbody>
              {contas?.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5">{c.descricao}</td>
                  <td className="px-2.5 py-1.5">{(c.clientes as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{(c.projetos as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center">{c.parcela ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right font-medium">R$ {(c.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2.5 py-1.5 text-center">{c.data_vencimento ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor(c.status ?? "pendente")}`}>{c.status}</span>
                  </td>
                  <td className="px-2.5 py-1.5 text-center">
                    {c.status === "pendente" && (
                      <button onClick={() => handleReceber(c.id)} className="p-1 rounded hover:bg-success/15 text-muted-foreground hover:text-success transition">
                        <Check size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {(!contas || contas.length === 0) && <tr><td colSpan={8} className="text-center py-4 text-muted-foreground">Nenhuma conta encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FinanceiroReceber;
