import { useState } from "react";
import { Truck, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TipoFornecedor = Database["public"]["Enums"]["tipo_fornecedor"];

const Fornecedores = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
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
      const { data, error } = await supabase.from("fornecedores").select("*").order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("fornecedores").insert({ empresa_id: empresaId!, nome, tipo, cnpj_cpf: cnpj || null, telefone: tel || null, email: email || null, rt_percentual: tipo === "arquiteto" ? rt : 0, cidade: cidade || null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fornecedores"] }); toast.success("Cadastrado!"); setShowForm(false); setNome(""); setCnpj(""); setTel(""); setEmail(""); setRt(0); setCidade(""); },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Fornecedores & Arquitetos</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Novo Cadastro
        </button>
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded p-3 grid grid-cols-2 md:grid-cols-4 gap-3">
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
          <div className="col-span-2 md:col-span-4">
            <button onClick={() => create.mutate()} disabled={create.isPending || !nome.trim()} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
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
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Cidade</th>
              </tr>
            </thead>
            <tbody>
              {fornecedores?.map(f => (
                <tr key={f.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
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
                  <td className="px-2.5 py-1.5">{f.cidade ?? "—"}</td>
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
