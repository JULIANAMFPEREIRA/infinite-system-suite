import { useState } from "react";
import { UserCheck, Pencil, Check, Plus } from "lucide-react";
import { useComissoes } from "@/hooks/useFinanceiro";
import { supabase as sbClient } from "@/integrations/supabase/client";
import { useFormasPagamento } from "@/hooks/useCategorias";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const Comissoes = () => {
  const empresaId = useEmpresa();
  const { data: comissoes, isLoading } = useComissoes();
  const { data: formasPgto } = useFormasPagamento();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editPercentual, setEditPercentual] = useState(0);
  const [editValor, setEditValor] = useState(0);

  // Modal baixa
  const [showBaixa, setShowBaixa] = useState(false);
  const [baixaId, setBaixaId] = useState<string | null>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaForma, setBaixaForma] = useState("");
  const [baixaObs, setBaixaObs] = useState("");

  // Nova comissão form
  const [showNew, setShowNew] = useState(false);
  const [newProjetoId, setNewProjetoId] = useState("");
  const [newFornecedorId, setNewFornecedorId] = useState("");
  const [newPercentual, setNewPercentual] = useState(0);
  const [newValor, setNewValor] = useState(0);
  const [newVencimento, setNewVencimento] = useState("");

  const { data: projetos } = useQuery({
    queryKey: ["projetos_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("projetos").select("id, nome").order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["arquitetos_select", empresaId],
    queryFn: async () => { const { data } = await supabase.from("fornecedores").select("id, nome").eq("tipo", "arquiteto").order("nome"); return data ?? []; },
    enabled: !!empresaId,
  });

  const updateComissao = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; percentual?: number; valor?: number; status?: "pendente" | "pago"; data_vencimento?: string }) => {
      const { error } = await supabase.from("comissoes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["comissoes"] }); },
  });

  const handleSaveEdit = async (id: string) => {
    try {
      await updateComissao.mutateAsync({ id, percentual: editPercentual, valor: editValor });
      await supabase.from("financeiro_pagar").update({ valor: editValor }).eq("comissao_id", id);
      setEditId(null);
      toast.success("Comissão atualizada");
    } catch (err: any) { toast.error(err.message); }
  };

  const openBaixa = (c: any) => {
    setBaixaId(c.id); setBaixaData(new Date().toISOString().split("T")[0]); setBaixaForma(""); setBaixaObs(""); setShowBaixa(true);
  };

  const handleBaixa = async () => {
    if (!baixaId) return;
    try {
      await updateComissao.mutateAsync({ id: baixaId, status: "pago" });
      await supabase.from("financeiro_pagar").update({ status: "pago", data_pagamento: baixaData }).eq("comissao_id", baixaId);
      toast.success("Comissão marcada como paga");
      setShowBaixa(false);
    } catch (err: any) { toast.error(err.message); }
  };

  const handleCreateComissao = async () => {
    if (!newProjetoId || !newFornecedorId) { toast.error("Projeto e arquiteto são obrigatórios"); return; }
    if (!empresaId) return;
    try {
      const { error } = await supabase.from("comissoes").insert({
        empresa_id: empresaId, projeto_id: newProjetoId, fornecedor_id: newFornecedorId,
        percentual: newPercentual, valor: newValor,
        data_vencimento: newVencimento || null, status: "pendente",
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["comissoes"] });
      toast.success("Comissão criada");
      setShowNew(false); setNewProjetoId(""); setNewFornecedorId(""); setNewPercentual(0); setNewValor(0); setNewVencimento("");
    } catch (err: any) { toast.error(err.message); }
  };

  const openEdit = (c: any) => {
    setEditId(c.id); setEditPercentual(c.percentual ?? 0); setEditValor(c.valor ?? 0);
  };

  const statusColor = (s: string) => s === "pago" ? "bg-success/15 text-success" : "bg-warning/15 text-warning";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Comissões (RT)</h1>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Nova Comissão
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Comissões geradas automaticamente ou manualmente. Edite valores ou dê baixa.</p>

      {showNew && (
        <div className="bg-card border border-border rounded p-3 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">Nova Comissão Manual</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Projeto *</label>
              <select value={newProjetoId} onChange={e => setNewProjetoId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {projetos?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Arquiteto *</label>
              <select value={newFornecedorId} onChange={e => setNewFornecedorId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="">Selecionar...</option>
                {fornecedores?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Percentual</label><input type="number" value={newPercentual} onChange={e => setNewPercentual(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor</label><input type="number" value={newValor} onChange={e => setNewValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Vencimento</label><input type="date" value={newVencimento} onChange={e => setNewVencimento(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreateComissao} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105">Criar</button>
            <button onClick={() => setShowNew(false)} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p> : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Arquiteto</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Cliente</th>
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
                  <td className="px-2.5 py-1.5">{(c.projetos as any)?.clientes?.nome ?? "—"}</td>
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
                          {c.status !== "pago" && <button onClick={() => openBaixa(c)} className="p-1 rounded hover:bg-success/15 text-muted-foreground hover:text-success" title="Dar baixa"><Check size={13} /></button>}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(!comissoes || comissoes.length === 0) && <tr><td colSpan={8} className="text-center py-4 text-muted-foreground">Nenhuma comissão encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showBaixa} onOpenChange={setShowBaixa}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Registrar Pagamento de Comissão</DialogTitle></DialogHeader>
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

export default Comissoes;
