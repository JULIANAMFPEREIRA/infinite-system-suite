import { useState } from "react";
import { Truck, Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { isNotEmpty, validateEmail, isPositiveNumber } from "@/lib/validations";

type TipoFornecedor = Database["public"]["Enums"]["tipo_fornecedor"];

const Fornecedores = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoFornecedor>("fornecedor");
  const [cnpj, setCnpj] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [rt, setRt] = useState(0);
  const [cidade, setCidade] = useState("");

  const { data: fornecedores, isLoading } = useQuery({
    queryKey: ["fornecedores", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("fornecedores").select("*").eq("deletado", false).order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const resetForm = () => { setNome(""); setCnpj(""); setTel(""); setEmail(""); setRt(0); setCidade(""); setTipo("fornecedor"); setEditId(null); setShowForm(false); };

  const openEdit = (f: any) => {
    setEditId(f.id); setNome(f.nome); setTipo(f.tipo ?? "fornecedor"); setCnpj(f.cnpj_cpf ?? ""); setTel(f.telefone ?? ""); setEmail(f.email ?? ""); setRt(f.rt_percentual ?? 0); setCidade(f.cidade ?? ""); setShowForm(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!isNotEmpty(nome, "Nome")) throw new Error("Validação falhou");
      if (!validateEmail(email)) throw new Error("Validação falhou");
      if (tipo === "arquiteto" && !isPositiveNumber(rt, "RT (%)")) throw new Error("Validação falhou");
      const payload = sanitizePayload({ nome, tipo, cnpj_cpf: cnpj || null, telefone: tel || null, email: email || null, rt_percentual: tipo === "arquiteto" ? rt : 0, cidade: cidade || null });
      if (editId) {
        const { error } = await supabase.from("fornecedores").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").insert({ ...payload, empresa_id: empresaId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fornecedores"] }); toast.success(editId ? "Atualizado!" : "Cadastrado!"); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("fornecedores").update({ deletado: true } as any).eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fornecedores"] }); toast.success("Excluído"); },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Fornecedores & Arquitetos</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Novo Cadastro
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded p-3 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">{editId ? "Editar" : "Novo"} Fornecedor</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2">
              <label className="text-[11px] text-muted-foreground">Nome *</label>
              <input value={nome} onChange={e => setNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value as TipoFornecedor)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                <option value="fornecedor">Fornecedor</option>
                <option value="arquiteto">Arquiteto</option>
              </select>
            </div>
            {tipo === "arquiteto" && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">RT (%)</label>
                <input type="number" value={rt} onChange={e => setRt(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">CNPJ/CPF</label>
              <input value={cnpj} onChange={e => setCnpj(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Telefone</label>
              <input value={tel} onChange={e => setTel(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">E-mail</label>
              <input value={email} onChange={e => setEmail(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Cidade</label>
              <input value={cidade} onChange={e => setCidade(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => save.mutate()} disabled={save.isPending || !nome.trim()} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p> : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nome</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Tipo</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">CNPJ/CPF</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Telefone</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">E-mail</th>
                <th className="text-right px-2.5 py-2 font-semibold border-b border-border">RT (%)</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
              </tr>
            </thead>
            <tbody>
              {fornecedores?.map(f => (
                <tr key={f.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => openEdit(f)}>
                  <td className="px-2.5 py-1.5 font-medium">{f.nome}</td>
                  <td className="px-2.5 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${f.tipo === "arquiteto" ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground"}`}>
                      {f.tipo === "arquiteto" ? "Arquiteto" : "Fornecedor"}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5">{f.cnpj_cpf ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{f.telefone ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{f.email ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right">{f.tipo === "arquiteto" ? <span className="text-primary font-semibold">{f.rt_percentual ?? 0}%</span> : "—"}</td>
                  <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(f)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                      <button onClick={() => { if (window.confirm("Excluir fornecedor?")) remove.mutate(f.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!fornecedores || fornecedores.length === 0) && <tr><td colSpan={7} className="text-center py-4 text-muted-foreground">Nenhum fornecedor cadastrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Fornecedores;
