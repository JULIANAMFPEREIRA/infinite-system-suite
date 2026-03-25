import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, Clock, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const statusLabel: Record<string, string> = {
  lead: "Lead", proposta: "Proposta", orcamento: "Orçamento", aprovado: "Aprovado",
  em_andamento: "Em Andamento", concluido: "Concluído", pos_venda: "Pós-Venda",
  vendido: "Vendido", cancelado: "Cancelado",
};
const statusColor: Record<string, string> = {
  lead: "bg-secondary text-secondary-foreground", proposta: "bg-warning/15 text-warning",
  aprovado: "bg-success/15 text-success", em_andamento: "bg-primary/15 text-primary",
  concluido: "bg-info/15 text-info", vendido: "bg-success/15 text-success",
  cancelado: "bg-destructive/15 text-destructive", orcamento: "bg-secondary text-secondary-foreground",
  pos_venda: "bg-accent text-accent-foreground",
};

const PortalCliente = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: projetos, isLoading } = useQuery({
    queryKey: ["portal_cliente_projetos", user?.email],
    queryFn: async () => {
      // Find client by email, then get projects
      const { data: cliente } = await supabase.from("clientes").select("id").eq("email", user!.email!).single();
      if (!cliente) return [];
      const { data, error } = await supabase.from("projetos")
        .select("id, nome, status, endereco_obra, data_inicio, data_previsao, descricao")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.email,
  });

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <FolderKanban size={18} className="text-primary" />
          <h1 className="text-sm font-bold text-foreground">Portal do Cliente</h1>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><LogOut size={14} /> Sair</button>
      </header>
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <h2 className="text-lg font-bold text-foreground">Meus Projetos</h2>
        {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : projetos && projetos.length > 0 ? (
          <div className="space-y-3">
            {projetos.map(p => (
              <div key={p.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{p.nome}</h3>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusColor[p.status ?? ""] ?? "bg-secondary text-secondary-foreground"}`}>{statusLabel[p.status ?? ""] ?? p.status}</span>
                </div>
                {p.descricao && <p className="text-xs text-muted-foreground">{p.descricao}</p>}
                <div className="flex gap-4 text-[11px] text-muted-foreground">
                  {p.endereco_obra && <span>📍 {p.endereco_obra}</span>}
                  {p.data_inicio && <span><Clock size={10} className="inline mr-0.5" />Início: {p.data_inicio}</span>}
                  {p.data_previsao && <span>Previsão: {p.data_previsao}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">Nenhum projeto vinculado ao seu e-mail.</p>}
      </main>
    </div>
  );
};

export default PortalCliente;
