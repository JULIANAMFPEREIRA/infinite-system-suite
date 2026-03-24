import { useState } from "react";
import { DollarSign, Plus, Check, Pencil, Trash2 } from "lucide-react";
import { useFinanceiroPagar, useCreateContaPagar, useUpdateContaPagar } from "@/hooks/useFinanceiro";
import { useFormasPagamento } from "@/hooks/useCategorias";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const FinanceiroPagar = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const { data: contas, isLoading } = useFinanceiroPagar();
  const createConta = useCreateContaPagar();
  const updateConta = useUpdateContaPagar();
  const { data: formasPgto } = useFormasPagamento();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [valor, setValor] = useState(0);
  const [vencimento, setVencimento] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [projetoId, setProjetoId] = useState("");

  // Modal baixa
  const [showBaixa, setShowBaixa] = useState(false);
  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaForma, setBaixaForma] = useState("");
  const [baixaObs, setBaixaObs] = useState("");

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

  const resetForm = () => { setDesc(""); setValor(0); setVencimento(""); setFornecedorId(""); setProjetoId(""); setEditId(null); setShowForm(false); };

  const openEdit = (c: any) => {
    setEditId(c.id); setDesc(c.descricao ?? ""); setValor(c.valor ?? 0); setVencimento(c.data_vencimento ?? ""); setFornecedorId(c.fornecedor_id ?? ""); setProjetoId(c.projeto_id ?? ""); setShowForm(true);
  };

  const handleSave = async () => {
    if (!desc.trim()) { toast.error("Descrição obrigatória"); return; }
    try {
      if (editId) {
        await updateConta.mutateAsync({ id: editId, descricao: desc, valor, data_vencimento: vencimento || null, fornecedor_id: fornecedorId || null, projeto_id: projetoId || null });
        toast.success("Conta atualizada");
      } else {
        await createConta.mutateAsync({ descricao: desc, valor, data_vencimento: vencimento || null, status: "pendente", fornecedor_id: fornecedorId || null, projeto_id: projetoId || null });
        toast.success("Conta adicionada");
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
      toast.success("Pago!");
      setShowBaixa(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("financeiro_pagar").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financeiro_pagar"] }); toast.success("Conta excluída"); },
    onError: (err: any) => toast.error(err.message),
  });

  const statusColor = (s: string) => s === "pago" ? "bg-success/15 text-success" : s === "vencido" ? "bg-destructive/15 text-destructive" : s === "cancelado" ? "bg-secondary text-muted-foreground" : "bg-warning/15 text-warning";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Contas a Pagar</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Nova Conta
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded p-3 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">{editId ? "Editar" : "Nova"} Conta a Pagar</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Descrição</label><input value={desc} onChange={e => setDesc(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor</label><input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Vencimento</label><input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Fornecedor</label>
              <select value={fornecedorId} onChange={e => setFornecedorId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {fornecedores?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
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
            <button onClick={handleSave} disabled={createConta.isPending || updateConta.isPending} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p> : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Descrição</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Fornecedor</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Vencimento</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas?.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => openEdit(c)}>
                  <td className="px-2.5 py-1.5">{c.descricao}</td>
                  <td className="px-2.5 py-1.5">{(c.fornecedores as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{(c.projetos as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right font-medium">R$ {(c.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2.5 py-1.5 text-center">{c.data_vencimento ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor(c.status ?? "pendente")}`}>{c.status}</span>
                  </td>
                  <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {c.status === "pendente" && <button onClick={() => openBaixa(c.id)} className="p-1 rounded hover:bg-success/15 text-muted-foreground hover:text-success"><Check size={13} /></button>}
                      <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                      <button onClick={() => { if (window.confirm("Excluir conta?")) remove.mutate(c.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!contas || contas.length === 0) && <tr><td colSpan={7} className="text-center py-4 text-muted-foreground">Nenhuma conta encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showBaixa} onOpenChange={setShowBaixa}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Registrar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Pagamento</label><input type="date" value={baixaData} onChange={e => setBaixaData(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
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
            <button onClick={handleBaixa} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground">Confirmar Pagamento</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceiroPagar;
