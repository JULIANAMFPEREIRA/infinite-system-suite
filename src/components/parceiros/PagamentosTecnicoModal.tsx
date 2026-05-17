import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, DollarSign, Calculator, Calendar, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { useEmpresa } from "@/hooks/useEmpresa";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PagamentosTecnicoModalProps {
  parceiroId: string;
  onClose: () => void;
}

const PagamentosTecnicoModal = ({ parceiroId, onClose }: PagamentosTecnicoModalProps) => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const [openAddProjeto, setOpenAddProjeto] = useState(false);
  const [openAddLancamento, setOpenAddLancamento] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<any>(null);

  const [formProj, setFormProj] = useState({ projeto_id: "", valor_combinado: "", descricao: "" });
  const [formLanc, setFormLanc] = useState({ projeto_id: "", valor: "", data_pagamento: format(new Date(), "yyyy-MM-dd"), observacao: "", mes_referencia: format(new Date(), "MM/yyyy") });

  const { data: parceiro } = useQuery({
    queryKey: ["parceiro_detalhe", parceiroId],
    queryFn: async () => {
      const { data } = await supabase.from("fornecedores").select("nome").eq("id", parceiroId).single();
      return data;
    }
  });

  const { data: projetosEmpresa = [] } = useQuery({
    queryKey: ["projetos_simples", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("projetos").select("id, nome").eq("empresa_id", empresaId!).eq("deletado", false);
      return data ?? [];
    },
    enabled: !!empresaId
  });

  const { data: pagamentos = [], refetch: refetchPagamentos } = useQuery({
    queryKey: ["pagamentos_tecnico", parceiroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_tecnico")
        .select("*, projetos(nome)")
        .eq("tecnico_id", parceiroId);
      if (error) throw error;
      return data ?? [];
    }
  });

  const { data: lancamentos = [], refetch: refetchLancamentos } = useQuery({
    queryKey: ["pagamentos_tecnico_lancamentos", parceiroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_tecnico_lancamentos")
        .select("*, projetos(nome)")
        .eq("tecnico_id", parceiroId)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return data ?? [];
    }
  });

  const resumo = useMemo(() => {
    const totalCombinado = pagamentos.reduce((acc, p) => acc + Number(p.valor_combinado), 0);
    const totalPago = lancamentos.reduce((acc, l) => acc + Number(l.valor), 0);
    return {
      totalCombinado,
      totalPago,
      saldoDevedor: totalCombinado - totalPago
    };
  }, [pagamentos, lancamentos]);

  const handleAddProjeto = async () => {
    if (!formProj.projeto_id || !formProj.valor_combinado) {
      toast.error("Preencha projeto e valor combinado");
      return;
    }
    try {
      if (editingProjeto) {
        const { error } = await supabase.from("pagamentos_tecnico").update({
          valor_combinado: Number(formProj.valor_combinado),
          descricao: formProj.descricao
        }).eq("id", editingProjeto.id);
        if (error) throw error;
        toast.success("Valor atualizado");
      } else {
        const { error } = await supabase.from("pagamentos_tecnico").insert({
          empresa_id: empresaId,
          tecnico_id: parceiroId,
          projeto_id: formProj.projeto_id,
          valor_combinado: Number(formProj.valor_combinado),
          descricao: formProj.descricao
        });
        if (error) throw error;
        toast.success("Projeto adicionado");
      }
      setOpenAddProjeto(false);
      setEditingProjeto(null);
      setFormProj({ projeto_id: "", valor_combinado: "", descricao: "" });
      refetchPagamentos();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteProjeto = async (id: string) => {
    if (!confirm("Excluir este projeto dos pagamentos?")) return;
    const { error } = await supabase.from("pagamentos_tecnico").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Excluído");
      refetchPagamentos();
    }
  };

  const handleAddLancamento = async () => {
    if (!formLanc.valor || !formLanc.data_pagamento) {
      toast.error("Preencha valor e data");
      return;
    }
    try {
      const { error } = await supabase.from("pagamentos_tecnico_lancamentos").insert({
        empresa_id: empresaId,
        tecnico_id: parceiroId,
        projeto_id: formLanc.projeto_id || null,
        valor: Number(formLanc.valor),
        data_pagamento: formLanc.data_pagamento,
        observacao: formLanc.observacao,
        mes_referencia: formLanc.mes_referencia
      });
      if (error) throw error;
      toast.success("Pagamento registrado");
      setOpenAddLancamento(false);
      setFormLanc({ projeto_id: "", valor: "", data_pagamento: format(new Date(), "yyyy-MM-dd"), observacao: "", mes_referencia: format(new Date(), "MM/yyyy") });
      refetchLancamentos();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteLancamento = async (id: string) => {
    if (!confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from("pagamentos_tecnico_lancamentos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Lançamento excluído");
      refetchLancamentos();
    }
  };

  const fmtMoeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="text-success" />
            Pagamentos do Técnico: {parceiro?.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-secondary/30 p-4 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Combinado</p>
            <p className="text-xl font-bold text-foreground">{fmtMoeda(resumo.totalCombinado)}</p>
          </div>
          <div className="bg-success/10 p-4 rounded-lg border border-success/20">
            <p className="text-xs text-success uppercase font-semibold">Total Pago</p>
            <p className="text-xl font-bold text-success">{fmtMoeda(resumo.totalPago)}</p>
          </div>
          <div className="bg-destructive/10 p-4 rounded-lg border border-destructive/20">
            <p className="text-xs text-destructive uppercase font-semibold">Saldo Devedor</p>
            <p className="text-xl font-bold text-destructive">{fmtMoeda(resumo.saldoDevedor)}</p>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
                <Calculator size={16} className="text-primary" />
                Projetos e Valores Combinados
              </h3>
              <Button size="sm" onClick={() => { setEditingProjeto(null); setFormProj({ projeto_id: "", valor_combinado: "", descricao: "" }); setOpenAddProjeto(true); }}>
                <Plus size={14} className="mr-1" /> Adicionar Projeto
              </Button>
            </div>
            <div className="border border-border rounded overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left p-2 font-semibold">Projeto</th>
                    <th className="text-right p-2 font-semibold">Combinado</th>
                    <th className="text-right p-2 font-semibold">Total Pago</th>
                    <th className="text-right p-2 font-semibold">Saldo</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentos.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum projeto vinculado.</td></tr>
                  )}
                  {pagamentos.map(p => {
                    const pagoNoProjeto = lancamentos.filter(l => l.projeto_id === p.projeto_id).reduce((acc, cur) => acc + Number(cur.valor), 0);
                    return (
                      <tr key={p.id} className="border-t border-border hover:bg-secondary/20">
                        <td className="p-2 font-medium">{p.projetos?.nome}</td>
                        <td className="p-2 text-right">{fmtMoeda(p.valor_combinado)}</td>
                        <td className="p-2 text-right text-success">{fmtMoeda(pagoNoProjeto)}</td>
                        <td className="p-2 text-right font-bold text-destructive">{fmtMoeda(p.valor_combinado - pagoNoProjeto)}</td>
                        <td className="p-2 flex items-center justify-end gap-2">
                          <button onClick={() => { setEditingProjeto(p); setFormProj({ projeto_id: p.projeto_id, valor_combinado: p.valor_combinado.toString(), descricao: p.descricao || "" }); setOpenAddProjeto(true); }} className="text-muted-foreground hover:text-primary"><Pencil size={14} /></button>
                          <button onClick={() => handleDeleteProjeto(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
                <Calendar size={16} className="text-primary" />
                Lançamentos de Pagamento
              </h3>
              <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10" onClick={() => setOpenAddLancamento(true)}>
                <Plus size={14} className="mr-1" /> Registrar Pagamento
              </Button>
            </div>
            <div className="border border-border rounded overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left p-2 font-semibold">Data</th>
                    <th className="text-left p-2 font-semibold">Projeto</th>
                    <th className="text-right p-2 font-semibold">Valor</th>
                    <th className="text-center p-2 font-semibold">Mês Ref.</th>
                    <th className="text-left p-2 font-semibold">Obs.</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lancamentos.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhum pagamento registrado.</td></tr>
                  )}
                  {lancamentos.map(l => (
                    <tr key={l.id} className="border-t border-border hover:bg-secondary/20">
                      <td className="p-2">{l.data_pagamento ? format(new Date(l.data_pagamento + 'T12:00:00'), 'dd/MM/yyyy') : "-"}</td>
                      <td className="p-2 text-muted-foreground">{l.projetos?.nome || "Geral / Sem Projeto"}</td>
                      <td className="p-2 text-right font-medium text-success">{fmtMoeda(l.valor)}</td>
                      <td className="p-2 text-center">{l.mes_referencia}</td>
                      <td className="p-2 text-muted-foreground italic truncate max-w-[200px]" title={l.observacao}>{l.observacao}</td>
                      <td className="p-2 text-right">
                        <button onClick={() => handleDeleteLancamento(l.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Mini Modal Add Projeto */}
        <Dialog open={openAddProjeto} onOpenChange={setOpenAddProjeto}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editingProjeto ? "Editar Valor" : "Adicionar Projeto"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              {!editingProjeto && (
                <div>
                  <label className="text-xs font-medium">Projeto</label>
                  <select value={formProj.projeto_id} onChange={e => setFormProj({...formProj, projeto_id: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm">
                    <option value="">Selecione...</option>
                    {projetosEmpresa.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium">Valor Combinado</label>
                <input type="number" value={formProj.valor_combinado} onChange={e => setFormProj({...formProj, valor_combinado: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs font-medium">Descrição (opcional)</label>
                <textarea value={formProj.descricao} onChange={e => setFormProj({...formProj, descricao: e.target.value})} className="w-full p-2 mt-1 rounded border border-border bg-background text-sm min-h-[60px]" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpenAddProjeto(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAddProjeto}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mini Modal Registrar Pagamento */}
        <Dialog open={openAddLancamento} onOpenChange={setOpenAddLancamento}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-medium">Projeto (opcional)</label>
                <select value={formLanc.projeto_id} onChange={e => setFormLanc({...formLanc, projeto_id: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm">
                  <option value="">Geral / Sem Projeto</option>
                  {pagamentos.map(p => <option key={p.projeto_id} value={p.projeto_id}>{p.projetos?.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Valor</label>
                  <input type="number" value={formLanc.valor} onChange={e => setFormLanc({...formLanc, valor: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-medium">Data</label>
                  <input type="date" value={formLanc.data_pagamento} onChange={e => setFormLanc({...formLanc, data_pagamento: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Mês Referência (MM/AAAA)</label>
                <input type="text" value={formLanc.mes_referencia} onChange={e => setFormLanc({...formLanc, mes_referencia: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" placeholder="05/2026" />
              </div>
              <div>
                <label className="text-xs font-medium">Observação</label>
                <input type="text" value={formLanc.observacao} onChange={e => setFormLanc({...formLanc, observacao: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpenAddLancamento(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAddLancamento}>Registrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};

export default PagamentosTecnicoModal;