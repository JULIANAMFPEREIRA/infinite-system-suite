import { useState } from "react";
import { PenTool, Plus, Pencil, Trash2 } from "lucide-react";
import { useContratos, useCreateContrato, useUpdateContrato, useDeleteContrato } from "@/hooks/useContratos";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";

const statusLabel: Record<string, string> = { rascunho: "Rascunho", enviado: "Enviado", assinado: "Assinado", cancelado: "Cancelado" };
const statusColor: Record<string, string> = { rascunho: "bg-secondary text-secondary-foreground", enviado: "bg-warning/15 text-warning", assinado: "bg-success/15 text-success", cancelado: "bg-destructive/15 text-destructive" };

const Contratos = () => {
  const empresaId = useEmpresa();
  const { data: contratos, isLoading } = useContratos();
  const createContrato = useCreateContrato();
  const updateContrato = useUpdateContrato();
  const deleteContrato = useDeleteContrato();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [projetoId, setProjetoId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [status, setStatus] = useState("rascunho");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState(0);
  const [dataEnvio, setDataEnvio] = useState("");
  const [dataAssinatura, setDataAssinatura] = useState("");

  const { data: projetos } = useQuery({ queryKey: ["projetos_select", empresaId], queryFn: async () => { const { data } = await supabase.from("projetos").select("id, nome").order("nome"); return data ?? []; }, enabled: !!empresaId });
  const { data: clientes } = useQuery({ queryKey: ["clientes_select", empresaId], queryFn: async () => { const { data } = await supabase.from("clientes").select("id, nome").order("nome"); return data ?? []; }, enabled: !!empresaId });

  const resetForm = () => { setProjetoId(""); setClienteId(""); setStatus("rascunho"); setDescricao(""); setValor(0); setDataEnvio(""); setDataAssinatura(""); setEditId(null); setShowForm(false); };

  const openEdit = (c: any) => {
    setEditId(c.id); setProjetoId(c.projeto_id ?? ""); setClienteId(c.cliente_id ?? "");
    setStatus(c.status ?? "rascunho"); setDescricao(c.descricao ?? ""); setValor(c.valor ?? 0);
    setDataEnvio(c.data_envio ?? ""); setDataAssinatura(c.data_assinatura ?? ""); setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const payload = { projeto_id: projetoId || null, cliente_id: clienteId || null, status, descricao: descricao || null, valor, data_envio: dataEnvio || null, data_assinatura: dataAssinatura || null };
      if (editId) {
        await updateContrato.mutateAsync({ id: editId, ...payload });
        toast.success("Contrato atualizado");
      } else {
        await createContrato.mutateAsync(payload);
        toast.success("Contrato criado");
      }
      resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenTool size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Contratos</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Novo Contrato
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded p-3 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">{editId ? "Editar" : "Novo"} Contrato</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Projeto</label>
              <select value={projetoId} onChange={e => setProjetoId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded"><option value="">Selecionar...</option>{projetos?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Cliente</label>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded"><option value="">Selecionar...</option>{clientes?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="rascunho">Rascunho</option><option value="enviado">Enviado</option><option value="assinado">Assinado</option><option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Valor</label><input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Descrição</label><input value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Envio</label><input type="date" value={dataEnvio} onChange={e => setDataEnvio(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Data Assinatura</label><input type="date" value={dataAssinatura} onChange={e => setDataAssinatura(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={createContrato.isPending || updateContrato.isPending} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p> : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Cliente</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Descrição</th>
              <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
            </tr></thead>
            <tbody>
              {contratos?.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => openEdit(c)}>
                  <td className="px-2.5 py-1.5 font-medium">{(c.projetos as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{(c.clientes as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{c.descricao ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right font-medium">{fmt(c.valor ?? 0)}</td>
                  <td className="px-2.5 py-1.5 text-center"><span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor[c.status] ?? statusColor.rascunho}`}>{statusLabel[c.status] ?? c.status}</span></td>
                  <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                      <button onClick={() => { if (window.confirm("Excluir contrato?")) deleteContrato.mutate(c.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!contratos || contratos.length === 0) && <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhum contrato.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Contratos;
