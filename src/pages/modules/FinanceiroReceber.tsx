import { useState } from "react";
import { DollarSign, Plus, Check, Pencil, Trash2 } from "lucide-react";
import { isNotEmpty, isPositiveNumber } from "@/lib/validations";
import { useFinanceiroReceber, useCreateContaReceber, useUpdateContaReceber } from "@/hooks/useFinanceiro";
import { useFormasPagamento } from "@/hooks/useCategorias";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtBRL, fmtDate, statusBadgeClass, statusLabel, rowHighlightClass } from "@/lib/financeiroUtils";

const FinanceiroReceber = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: contas, isLoading } = useFinanceiroReceber();
  const createConta = useCreateContaReceber();
  const updateConta = useUpdateContaReceber();
  const { data: formasPgto } = useFormasPagamento();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState("");
  const [parcela, setParcela] = useState(1);
  const [clienteId, setClienteId] = useState("");
  const [projetoId, setProjetoId] = useState("");

  const [showBaixa, setShowBaixa] = useState(false);
  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaForma, setBaixaForma] = useState("");
  const [baixaObs, setBaixaObs] = useState("");

  const { data: clientesList } = useQuery({
    queryKey: ["clientes_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("clientes").select("id, nome").eq("deletado", false).order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });
  const { data: projetos } = useQuery({
    queryKey: ["projetos_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("projetos").select("id, nome").eq("deletado", false).order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });

  const resetForm = () => { setDesc(""); setValor(0); setVencimento(""); setParcela(1); setClienteId(""); setProjetoId(""); setEditId(null); setShowForm(false); };

  const openEdit = (c: any) => {
    setEditId(c.id); setDesc(c.descricao ?? ""); setValor(c.valor ?? 0); setVencimento(c.data_vencimento ?? ""); setParcela(c.parcela ?? 1); setClienteId(c.cliente_id ?? ""); setProjetoId(c.projeto_id ?? ""); setShowForm(true);
  };

  const handleSave = async () => {
    if (!isNotEmpty(desc, "Descrição")) return;
    if (!isPositiveNumber(valor, "Valor")) return;
    try {
      if (editId) {
        await updateConta.mutateAsync({ id: editId, descricao: desc, valor, data_vencimento: vencimento || null, parcela, cliente_id: clienteId || null, projeto_id: projetoId || null });
        toast.success("Parcela atualizada");
      } else {
        await createConta.mutateAsync({ descricao: desc, valor, data_vencimento: vencimento || null, parcela, status: "pendente", cliente_id: clienteId || null, projeto_id: projetoId || null });
        toast.success("Parcela adicionada");
      }
      resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const openBaixa = (id: string) => {
    setBaixaId(id); setBaixaData(new Date().toISOString().split("T")[0]); setBaixaForma(""); setBaixaObs(""); setShowBaixa(true);
  };

  const handleBaixa = async () => {
    if (!baixaId) return;
    try {
      await updateConta.mutateAsync({ id: baixaId, status: "pago", data_pagamento: baixaData });
      toast.success("Recebido!");
      setShowBaixa(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("financeiro_receber").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financeiro_receber"] }); toast.success("Parcela excluída"); },
    onError: (err: any) => toast.error(err.message),
  });

  // Summary
  const totalPendente = contas?.filter(c => c.status === "pendente").reduce((s, c) => s + (c.valor ?? 0), 0) ?? 0;
  const totalPago = contas?.filter(c => c.status === "pago").reduce((s, c) => s + (c.valor ?? 0), 0) ?? 0;
  const totalVencido = contas?.filter(c => c.status === "vencido").reduce((s, c) => s + (c.valor ?? 0), 0) ?? 0;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-success" />
          <h1 className="text-lg font-bold text-foreground">Contas a Receber</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition btn-press">
          <Plus size={14} /> Nova Parcela
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-warning">{fmtBRL(totalPendente)}</div>
          <div className="text-[11px] text-muted-foreground">Pendente</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-destructive">{fmtBRL(totalVencido)}</div>
          <div className="text-[11px] text-muted-foreground">Vencido</div>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-success">{fmtBRL(totalPago)}</div>
          <div className="text-[11px] text-muted-foreground">Recebido</div>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">{editId ? "Editar" : "Nova"} Parcela</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Descrição</label><input value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor</label><input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Parcela</label><input type="number" value={parcela} onChange={e => setParcela(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Vencimento</label><input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Cliente</label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {clientesList?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Projeto</label>
              <select value={projetoId} onChange={e => setProjetoId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {projetos?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createConta.isPending || updateConta.isPending} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50 btn-press">Salvar</button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 btn-press">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p> : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Descrição</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Cliente</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Projeto</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Parcela</th>
                  <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Valor</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Vencimento</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap">Status</th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground border-b border-border whitespace-nowrap w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {contas?.map(c => (
                  <tr
                    key={c.id}
                    className={`border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer transition-colors ${rowHighlightClass(c.data_vencimento, c.status)}`}
                    onClick={() => openEdit(c)}
                  >
                    <td className="px-3 py-2 font-medium text-foreground max-w-[200px] truncate">{c.descricao}</td>
                    <td className="px-3 py-2 text-foreground/80 max-w-[150px] truncate">{(c.clientes as any)?.nome ?? "—"}</td>
                    <td className="px-3 py-2 text-foreground/80 max-w-[150px] truncate">{(c.projetos as any)?.nome ?? "—"}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground">{c.parcela ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-bold text-foreground tabular-nums">{fmtBRL(c.valor ?? 0)}</td>
                    <td className="px-3 py-2 text-center text-foreground/80 tabular-nums">{fmtDate(c.data_vencimento)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusBadgeClass(c.status ?? "pendente")}`}>
                        {statusLabel(c.status ?? "pendente")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-0.5">
                        {c.status === "pendente" && (
                          <button onClick={() => openBaixa(c.id)} title="Registrar recebimento" className="p-1.5 rounded-md hover:bg-success/15 text-muted-foreground hover:text-success transition-colors">
                            <Check size={14} />
                          </button>
                        )}
                        <button onClick={() => openEdit(c)} title="Editar" className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => { if (window.confirm("Excluir parcela?")) remove.mutate(c.id); }} title="Excluir" className="p-1.5 rounded-md hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!contas || contas.length === 0) && <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Nenhuma conta encontrada.</td></tr>}
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
            <button onClick={handleBaixa} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Confirmar Recebimento</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceiroReceber;
