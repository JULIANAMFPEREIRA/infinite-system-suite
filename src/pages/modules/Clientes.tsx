import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { statusCrmLabels, statusCrmColors, type StatusCRM } from "@/lib/statusConfig";
import { NovoOrcamentoModal } from "@/components/crm/NovoOrcamentoModal";
import { Plus, Search, FileText } from "lucide-react";

const Clientes = () => {
  const empresaId = useEmpresa();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showOrcModal, setShowOrcModal] = useState(false);

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes-page", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, telefone, email, cpf_cnpj, cidade, status_crm")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .order("nome");
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const { data: projetosCount } = useQuery({
    queryKey: ["clientes-projetos-count", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projetos")
        .select("cliente_id")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false);
      const map: Record<string, number> = {};
      (data ?? []).forEach((p: any) => { if (p.cliente_id) map[p.cliente_id] = (map[p.cliente_id] ?? 0) + 1; });
      return map;
    },
    enabled: !!empresaId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes ?? [];
    return (clientes ?? []).filter((c: any) =>
      [c.nome, c.telefone, c.email, c.cpf_cnpj].some(v => (v ?? "").toString().toLowerCase().includes(q))
    );
  }, [clientes, search]);

  const openCliente = (id: string) => navigate(`/crm?cliente_id=${id}`);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-bold text-foreground">Clientes</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOrcModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary text-xs font-medium hover:brightness-105 transition border border-border"
          >
            <FileText size={14} /> Novo Orçamento
          </button>
          <button
            onClick={() => navigate("/crm")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition"
          >
            <Plus size={14} /> Novo Cliente
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone, e-mail, CPF/CNPJ..."
          className="w-full h-8 pl-7 pr-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="bg-card border border-border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Nome</th>
              <th className="text-left px-3 py-2 font-semibold">Telefone</th>
              <th className="text-left px-3 py-2 font-semibold">E-mail</th>
              <th className="text-left px-3 py-2 font-semibold">Cidade</th>
              <th className="text-left px-3 py-2 font-semibold">Status</th>
              <th className="text-right px-3 py-2 font-semibold">Nº Projetos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && (
              <tr><td colSpan={6} className="text-center px-3 py-6 text-muted-foreground text-xs italic">Carregando...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center px-3 py-6 text-muted-foreground text-xs italic">Nenhum cliente encontrado</td></tr>
            )}
            {filtered.map((c: any) => {
              const status = (c.status_crm ?? "lead") as StatusCRM;
              return (
                <tr
                  key={c.id}
                  onClick={() => openCliente(c.id)}
                  className="cursor-pointer hover:bg-secondary/40 transition"
                >
                  <td className="px-2.5 py-1.5 font-medium">{c.nome}</td>
                  <td className="px-2.5 py-1.5">{c.telefone ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{c.email ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{c.cidade ?? "—"}</td>
                  <td className="px-2.5 py-1.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-medium ${statusCrmColors[status]}`}>
                      {statusCrmLabels[status]}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 text-right tabular-nums">{projetosCount?.[c.id] ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <NovoOrcamentoModal open={showOrcModal} onOpenChange={setShowOrcModal} />
    </div>
  );
};

export default Clientes;