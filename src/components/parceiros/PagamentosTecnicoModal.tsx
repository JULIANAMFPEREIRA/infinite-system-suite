import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
 import { Plus, Trash2, Pencil, DollarSign, Calculator, Calendar, MessageSquare, Clock, Check } from "lucide-react";
import { toast } from "sonner";
import { useEmpresa } from "@/hooks/useEmpresa";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PagamentosTecnicoModalProps {
  parceiroId: string;
  onClose: () => void;
  inline?: boolean;
}

const PagamentosTecnicoModal = ({ parceiroId, onClose, inline = false }: PagamentosTecnicoModalProps) => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const [openAddProjeto, setOpenAddProjeto] = useState(false);
   const [openAddLancamento, setOpenAddLancamento] = useState(false);
   const [openAddPrevisto, setOpenAddPrevisto] = useState(false);
   const [openConfirmarPagamento, setOpenConfirmarPagamento] = useState(false);
  const [editingProjeto, setEditingProjeto] = useState<any>(null);
  const [editingLancamento, setEditingLancamento] = useState<any>(null);
  const [lancamentoParaConfirmar, setLancamentoParaConfirmar] = useState<any>(null);

    const [formProj, setFormProj] = useState({ projeto_id: "", cliente_id: "", tipo: "projeto" as "projeto" | "cliente", valor_combinado: "", descricao: "" });
   const [buscaProjeto, setBuscaProjeto] = useState("");
   const [formLanc, setFormLanc] = useState({ projeto_id: "", valor: "", data_pagamento: format(new Date(), "yyyy-MM-dd"), observacao: "", mes_referencia: format(new Date(), "MM/yyyy") });
   const [formPrev, setFormPrev] = useState({ projeto_id: "", valor: "", data_prevista: format(new Date(), "yyyy-MM-dd"), observacao: "", mes_referencia: format(new Date(), "MM/yyyy") });
   const [formConfirm, setFormConfirm] = useState({ projeto_id: "", valor: "", data_pagamento: format(new Date(), "yyyy-MM-dd"), observacao: "", mes_referencia: "" });

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

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes_crm", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, status_crm")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .order("nome");
      return data ?? [];
    },
    enabled: !!empresaId
  });

  const { data: pagamentos = [], refetch: refetchPagamentos } = useQuery({
    queryKey: ["pagamentos_tecnico", parceiroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_tecnico")
        .select("*, projetos(nome), clientes(nome)")
        .eq("tecnico_id", parceiroId);
      if (error) throw error;
      return data ?? [];
    }
  });

   const { data: allLancamentos = [], refetch: refetchLancamentos } = useQuery({
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
 
    const lancamentosRealizados = useMemo(() => allLancamentos.filter((l: any) => l.tipo !== "previsto"), [allLancamentos]);
    const lancamentosPrevistos = useMemo(() => allLancamentos.filter((l: any) => l.tipo === "previsto"), [allLancamentos]);

   const resumo = useMemo(() => {
     const totalCombinado = pagamentos.reduce((acc, p) => acc + Number(p.valor_combinado), 0);
     const totalPago = lancamentosRealizados.reduce((acc, l) => acc + Number(l.valor), 0);
     return {
       totalCombinado,
       totalPago,
       saldoDevedor: totalCombinado - totalPago
     };
   }, [pagamentos, lancamentosRealizados]);

  const handleAddProjeto = async () => {
    const id = formProj.tipo === "projeto" ? formProj.projeto_id : formProj.cliente_id;
    if (!id || !formProj.valor_combinado) {
      toast.error("Preencha o item e o valor combinado");
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
          projeto_id: formProj.tipo === "projeto" ? formProj.projeto_id : null,
          cliente_id: formProj.tipo === "cliente" ? formProj.cliente_id : null,
          valor_combinado: Number(formProj.valor_combinado),
          descricao: formProj.descricao
        });
        if (error) throw error;
        toast.success("Item adicionado");
      }
      setOpenAddProjeto(false);
      setEditingProjeto(null);
      setFormProj({ projeto_id: "", cliente_id: "", tipo: "projeto", valor_combinado: "", descricao: "" });
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

   const handleAddLancamento = async (tipo: "realizado" | "previsto" = "realizado") => {
     const form = tipo === "realizado" ? formLanc : formPrev;
     const dataField = tipo === "realizado" ? "data_pagamento" : "data_prevista";
     
     if (!form.valor || !form[dataField as keyof typeof form]) {
      toast.error("Preencha valor e data");
      return;
    }
     try {
       const payload: any = {
         projeto_id: form.projeto_id || null,
         valor: Number(form.valor),
         observacao: form.observacao,
         mes_referencia: form.mes_referencia,
         tipo: editingLancamento ? editingLancamento.tipo : tipo
       };
       
       if (payload.tipo === "previsto") {
         payload.data_prevista = (form as any).data_prevista;
         // Se for previsto, a data_pagamento pode ser nula ou igual à prevista para ordenação
         payload.data_pagamento = (form as any).data_prevista;
       } else {
         payload.data_pagamento = (form as any).data_pagamento;
       }
 
       if (editingLancamento) {
         const { error } = await supabase.from("pagamentos_tecnico_lancamentos").update(payload).eq("id", editingLancamento.id);
         if (error) throw error;
         toast.success("Lançamento atualizado");
       } else {
         payload.empresa_id = empresaId;
         payload.tecnico_id = parceiroId;
         const { error } = await supabase.from("pagamentos_tecnico_lancamentos").insert(payload);
         if (error) throw error;
         toast.success(tipo === "realizado" ? "Pagamento registrado" : "Pagamento agendado");
       }
       setOpenAddLancamento(false);
       setOpenAddPrevisto(false);
       setEditingLancamento(null);
       setFormLanc({ projeto_id: "", valor: "", data_pagamento: format(new Date(), "yyyy-MM-dd"), observacao: "", mes_referencia: format(new Date(), "MM/yyyy") });
       setFormPrev({ projeto_id: "", valor: "", data_prevista: format(new Date(), "yyyy-MM-dd"), observacao: "", mes_referencia: format(new Date(), "MM/yyyy") });
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

   const handleConfirmarPagamento = async () => {
     if (!lancamentoParaConfirmar) return;
     try {
       const { error } = await supabase
         .from("pagamentos_tecnico_lancamentos")
         .update({
           tipo: "realizado",
           data_pagamento: formConfirm.data_pagamento,
           valor: Number(formConfirm.valor),
           observacao: formConfirm.observacao,
           mes_referencia: formConfirm.mes_referencia
         })
         .eq("id", lancamentoParaConfirmar.id);

       if (error) throw error;
       toast.success("Pagamento confirmado");
       setOpenConfirmarPagamento(false);
       setLancamentoParaConfirmar(null);
       qc.invalidateQueries({ queryKey: ["pagamentos_tecnico_lancamentos", parceiroId] });
       refetchLancamentos();
     } catch (e: any) {
       toast.error(e.message);
     }
   };

   const fmtMoeda = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
 
   const filteredItems = useMemo(() => {
     const termo = buscaProjeto.toLowerCase();
     const filteredProjs = termo ? projetosEmpresa.filter(p => p.nome.toLowerCase().includes(termo)) : projetosEmpresa;
     const filteredClis = termo ? clientes.filter(c => c.nome.toLowerCase().includes(termo)) : clientes;
     
     return {
       projetos: filteredProjs,
       clientes: filteredClis
     };
   }, [projetosEmpresa, clientes, buscaProjeto]);

  const content = (
    <div className={inline ? "space-y-6" : "space-y-6 pt-4"}>
      {!inline && (
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="text-success" />
            Pagamentos do Técnico: {parceiro?.nome}
          </DialogTitle>
        </DialogHeader>
      )}

      {inline && (
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="text-success" />
          <h2 className="text-xl font-bold">Pagamentos do Técnico: {parceiro?.nome}</h2>
        </div>
      )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-secondary/30 p-4 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Contratado</p>
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
                Projetos e Valores Contratados
              </h3>
              <Button size="sm" onClick={() => { setEditingProjeto(null); setFormProj({ projeto_id: "", cliente_id: "", tipo: "projeto", valor_combinado: "", descricao: "" }); setOpenAddProjeto(true); }}>
                <Plus size={14} className="mr-1" /> Adicionar Projeto
              </Button>
            </div>
            <div className="border border-border rounded overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="text-left p-2 font-semibold">Projeto</th>
                    <th className="text-right p-2 font-semibold">Contratado</th>
                    <th className="text-right p-2 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pagamentos.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-4 text-muted-foreground">Nenhum item vinculado.</td></tr>
                  ) : (
                    pagamentos.map(p => (
                      <tr key={p.id} className="border-t border-border hover:bg-secondary/20">
                        <td className="p-2 font-medium">{p.projetos?.nome || p.clientes?.nome || "Sem nome"}</td>
                        <td className="p-2 text-right">{fmtMoeda(p.valor_combinado)}</td>
                        <td className="p-2 flex items-center justify-end gap-2">
                          <button onClick={() => { setEditingProjeto(p); setFormProj({ projeto_id: p.projeto_id || "", cliente_id: p.cliente_id || "", tipo: p.projeto_id ? "projeto" : "cliente", valor_combinado: p.valor_combinado.toString(), descricao: p.descricao || "" }); setOpenAddProjeto(true); }} className="text-muted-foreground hover:text-primary"><Pencil size={14} /></button>
                          <button onClick={() => handleDeleteProjeto(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

           <section>
             <div className="flex items-center justify-between mb-3">
               <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
                 <Calendar size={16} className="text-primary" />
                 Pagamentos Realizados
               </h3>
               <div className="flex gap-2">
                 <Button size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => setOpenAddPrevisto(true)}>
                   <Clock size={14} className="mr-1" /> Agendar Pagamento
                 </Button>
                 <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10" onClick={() => setOpenAddLancamento(true)}>
                   <Plus size={14} className="mr-1" /> Registrar Pagamento
                 </Button>
               </div>
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
                   {lancamentosRealizados.length === 0 && (
                     <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhum pagamento registrado.</td></tr>
                   )}
                    {lancamentosRealizados.map((l: any) => (
                     <tr key={l.id} className="border-t border-border hover:bg-secondary/20">
                       <td className="p-2">{l.data_pagamento ? format(new Date(l.data_pagamento + 'T12:00:00'), 'dd/MM/yyyy') : "-"}</td>
                       <td className="p-2 text-muted-foreground">{l.projetos?.nome || "Geral / Sem Projeto"}</td>
                       <td className="p-2 text-right font-medium text-success">{fmtMoeda(l.valor)}</td>
                       <td className="p-2 text-center">{l.mes_referencia}</td>
                       <td className="p-2 text-muted-foreground italic truncate max-w-[200px]" title={l.observacao}>{l.observacao}</td>
                       <td className="p-2 text-right flex items-center justify-end gap-2">
                         <button onClick={() => { setEditingLancamento(l); setFormLanc({ projeto_id: l.projeto_id || "", valor: l.valor.toString(), data_pagamento: l.data_pagamento, observacao: l.observacao || "", mes_referencia: l.mes_referencia || "" }); setOpenAddLancamento(true); }} className="text-muted-foreground hover:text-primary"><Pencil size={14} /></button>
                         <button onClick={() => handleDeleteLancamento(l.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </section>
 
           <section>
             <div className="flex items-center justify-between mb-3">
               <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-amber-600">
                 <Clock size={16} />
                 Pagamentos Previstos
               </h3>
             </div>
             <div className="border border-border rounded overflow-x-auto border-amber-100">
               <table className="w-full text-xs">
                 <thead className="bg-amber-50/50">
                   <tr>
                     <th className="text-left p-2 font-semibold">Data Prevista</th>
                     <th className="text-left p-2 font-semibold">Projeto</th>
                     <th className="text-right p-2 font-semibold">Valor</th>
                     <th className="text-center p-2 font-semibold">Mês Ref.</th>
                     <th className="text-left p-2 font-semibold">Obs.</th>
                     <th className="w-10"></th>
                   </tr>
                 </thead>
                 <tbody>
                   {lancamentosPrevistos.length === 0 && (
                     <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhum pagamento previsto.</td></tr>
                   )}
                    {lancamentosPrevistos.map((l: any) => (
                     <tr key={l.id} className="border-t border-border hover:bg-amber-50/30">
                       <td className="p-2">{l.data_prevista ? format(new Date(l.data_prevista + 'T12:00:00'), 'dd/MM/yyyy') : "-"}</td>
                       <td className="p-2 text-muted-foreground">{l.projetos?.nome || "Geral / Sem Projeto"}</td>
                       <td className="p-2 text-right font-medium text-amber-600">{fmtMoeda(l.valor)}</td>
                       <td className="p-2 text-center">{l.mes_referencia}</td>
                        <td className="p-2 text-muted-foreground italic truncate max-w-[200px]" title={l.observacao}>{l.observacao}</td>
                         <td className="p-2 text-right flex items-center justify-end gap-2">
                           <button 
                             onClick={() => {
                               setLancamentoParaConfirmar(l);
                               setFormConfirm({
                                 projeto_id: l.projeto_id || "",
                                 valor: l.valor.toString(),
                                 data_pagamento: format(new Date(), "yyyy-MM-dd"),
                                 observacao: l.observacao || "",
                                 mes_referencia: l.mes_referencia || ""
                               });
                               setOpenConfirmarPagamento(true);
                             }} 
                             className="text-success hover:text-success/80" 
                             title="Confirmar Pagamento"
                           >
                             <Check size={14} />
                           </button>
                           <button onClick={() => { setEditingLancamento(l); setFormPrev({ projeto_id: l.projeto_id || "", valor: l.valor.toString(), data_prevista: l.data_prevista, observacao: l.observacao || "", mes_referencia: l.mes_referencia || "" }); setOpenAddPrevisto(true); }} className="text-muted-foreground hover:text-primary"><Pencil size={14} /></button>
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
             <DialogHeader><DialogTitle>{editingProjeto ? "Editar Valor" : "Adicionar Projeto/Cliente"}</DialogTitle></DialogHeader>
             <div className="space-y-3 py-2">
               {!editingProjeto && (
                 <div className="space-y-1.5">
                   <label className="text-xs font-medium">Projeto</label>
                   <input
                     type="text"
                     placeholder="Buscar projeto..."
                     value={buscaProjeto}
                     onChange={(e) => setBuscaProjeto(e.target.value)}
                     className="w-full h-8 px-2 rounded border border-border bg-background text-xs"
                   />
                   <select
                     value={formProj.tipo === "projeto" ? formProj.projeto_id : formProj.cliente_id}
                     onChange={(e) => {
                        const selected = e.target.options[e.target.selectedIndex];
                        const tipo = selected.getAttribute("data-tipo") as "projeto" | "cliente";
                        if (tipo === "projeto") {
                          setFormProj({ ...formProj, tipo: "projeto", projeto_id: e.target.value, cliente_id: "" });
                        } else {
                          setFormProj({ ...formProj, tipo: "cliente", cliente_id: e.target.value, projeto_id: "" });
                        }
                     }}
                     className="w-full h-9 px-2 rounded border border-border bg-background text-sm"
                   >
                     <option value="">Selecione...</option>
                     {filteredItems.projetos.length > 0 && (
                       <optgroup label="PROJETOS">
                         {filteredItems.projetos.map((p) => (
                           <option key={p.id} value={p.id} data-tipo="projeto">
                             {p.nome}
                           </option>
                         ))}
                       </optgroup>
                     )}
                     {filteredItems.clientes.length > 0 && (
                       <optgroup label="CLIENTES CRM">
                         {filteredItems.clientes.map((c) => (
                           <option key={c.id} value={c.id} data-tipo="cliente">
                             {c.nome}
                           </option>
                         ))}
                       </optgroup>
                     )}
                   </select>
                 </div>
               )}
              <div>
                <label className="text-xs font-medium">Valor Contratado</label>
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
        <Dialog open={openAddLancamento} onOpenChange={(o) => { setOpenAddLancamento(o); if (!o) { setEditingLancamento(null); setFormLanc({ projeto_id: "", valor: "", data_pagamento: format(new Date(), "yyyy-MM-dd"), observacao: "", mes_referencia: format(new Date(), "MM/yyyy") }); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editingLancamento ? "Editar Pagamento" : "Registrar Pagamento"}</DialogTitle></DialogHeader>
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
               <Button size="sm" onClick={() => handleAddLancamento("realizado")}>{editingLancamento ? "Salvar Alterações" : "Registrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mini Modal Agendar Pagamento */}
        <Dialog open={openAddPrevisto} onOpenChange={(o) => { setOpenAddPrevisto(o); if (!o) { setEditingLancamento(null); setFormPrev({ projeto_id: "", valor: "", data_prevista: format(new Date(), "yyyy-MM-dd"), observacao: "", mes_referencia: format(new Date(), "MM/yyyy") }); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>{editingLancamento ? "Editar Pagamento Previsto" : "Agendar Pagamento"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-medium">Projeto (opcional)</label>
                <select value={formPrev.projeto_id} onChange={e => setFormPrev({...formPrev, projeto_id: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm">
                  <option value="">Geral / Sem Projeto</option>
                  {pagamentos.map(p => <option key={p.projeto_id || p.id} value={p.projeto_id || ""}>{p.projetos?.nome || p.clientes?.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Valor</label>
                  <input type="number" value={formPrev.valor} onChange={e => setFormPrev({...formPrev, valor: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-medium">Data Prevista</label>
                  <input type="date" value={formPrev.data_prevista} onChange={e => setFormPrev({...formPrev, data_prevista: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Mês Referência (MM/AAAA)</label>
                <input type="text" value={formPrev.mes_referencia} onChange={e => setFormPrev({...formPrev, mes_referencia: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" placeholder="05/2026" />
              </div>
              <div>
                <label className="text-xs font-medium">Observação</label>
                <input type="text" value={formPrev.observacao} onChange={e => setFormPrev({...formPrev, observacao: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpenAddPrevisto(false)}>Cancelar</Button>
              <Button size="sm" onClick={() => handleAddLancamento("previsto")}>{editingLancamento ? "Salvar Alterações" : "Agendar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Confirmar Pagamento */}
        <Dialog open={openConfirmarPagamento} onOpenChange={(o) => { setOpenConfirmarPagamento(o); if (!o) { setLancamentoParaConfirmar(null); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Confirmar Pagamento</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-medium">Projeto</label>
                <select disabled value={formConfirm.projeto_id} className="w-full h-9 px-2 mt-1 rounded border border-border bg-muted text-sm cursor-not-allowed">
                  <option value="">Geral / Sem Projeto</option>
                  {pagamentos.map(p => <option key={p.projeto_id} value={p.projeto_id}>{p.projetos?.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium">Valor</label>
                  <input type="number" value={formConfirm.valor} onChange={e => setFormConfirm({...formConfirm, valor: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-xs font-medium">Data do Pagamento</label>
                  <input type="date" value={formConfirm.data_pagamento} onChange={e => setFormConfirm({...formConfirm, data_pagamento: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Mês Referência (MM/AAAA)</label>
                <input type="text" value={formConfirm.mes_referencia} onChange={e => setFormConfirm({...formConfirm, mes_referencia: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Observação</label>
                <input type="text" value={formConfirm.observacao} onChange={e => setFormConfirm({...formConfirm, observacao: e.target.value})} className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpenConfirmarPagamento(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleConfirmarPagamento}>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );

  if (inline) return content;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {content}
      </DialogContent>
    </Dialog>
  );
};

export default PagamentosTecnicoModal;