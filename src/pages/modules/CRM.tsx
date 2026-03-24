import { useState } from "react";
import { Users, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type StatusCRM = Database["public"]["Enums"]["status_crm"];
type OrigemLead = Database["public"]["Enums"]["origem_lead"];

const statusLabels: Record<StatusCRM, string> = { lead: "Lead", contato: "Contato", proposta: "Proposta", projeto: "Projeto" };
const statusColors: Record<StatusCRM, string> = { lead: "bg-secondary text-secondary-foreground", contato: "bg-warning/15 text-warning", proposta: "bg-primary/15 text-primary", projeto: "bg-success/15 text-success" };
const origemLabels: Record<OrigemLead, string> = { whatsapp: "WhatsApp", instagram: "Instagram", indicacao: "Indicação", outro: "Outro" };

const CRM = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [origem, setOrigem] = useState<OrigemLead>("outro");
  const [filterStatus, setFilterStatus] = useState<StatusCRM | "todos">("todos");

  const { data: clientes, isLoading, isError } = useQuery({
    queryKey: ["clientes", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clientes").insert({ empresa_id: empresaId!, nome, email: email || null, telefone: telefone || null, origem, status_crm: "lead" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); toast.success("Cliente cadastrado!"); setShowForm(false); setNome(""); setEmail(""); setTelefone(""); },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = clientes?.filter(c => filterStatus === "todos" || c.status_crm === filterStatus) ?? [];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">CRM — Gestão de Clientes</h1>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Novo Cliente
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["todos", "lead", "contato", "proposta", "projeto"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
            {s === "todos" ? "Todos" : statusLabels[s as StatusCRM]}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded p-3 flex items-end gap-3 flex-wrap">
          <div className="space-y-1 flex-1 min-w-[150px]">
            <label className="text-[11px] text-muted-foreground">Nome *</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1 w-40">
            <label className="text-[11px] text-muted-foreground">E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
          </div>
          <div className="space-y-1 w-32">
            <label className="text-[11px] text-muted-foreground">Telefone</label>
            <input value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" />
          </div>
          <div className="space-y-1 w-28">
            <label className="text-[11px] text-muted-foreground">Origem</label>
            <select value={origem} onChange={e => setOrigem(e.target.value as OrigemLead)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="indicacao">Indicação</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <button onClick={() => create.mutate()} disabled={create.isPending || !nome.trim()} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
        </div>
      )}

      {isLoading ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p>
      ) : isError ? (
        <p className="text-center py-8 text-xs text-destructive">Erro ao carregar dados. Verifique suas permissões.</p>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nome</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">E-mail</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Telefone</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Origem</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5 font-medium">{c.nome}</td>
                  <td className="px-2.5 py-1.5">{c.email ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{c.telefone ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{origemLabels[c.origem as OrigemLead] ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColors[c.status_crm as StatusCRM]}`}>{statusLabels[c.status_crm as StatusCRM]}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum cliente encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CRM;
