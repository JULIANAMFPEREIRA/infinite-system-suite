import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, DollarSign, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const statusLabel: Record<string, string> = {
  lead: "Lead", proposta: "Proposta", orcamento: "Orçamento", aprovado: "Aprovado",
  em_andamento: "Em Andamento", concluido: "Concluído", vendido: "Vendido",
};

const PortalArquiteto = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["portal_arquiteto", user?.email],
    queryFn: async () => {
      const { data: forn } = await supabase.from("fornecedores").select("id").eq("email", user!.email!).single();
      if (!forn) return { projetos: [], comissoes: [] };
      const [projRes, comRes] = await Promise.all([
        supabase.from("projetos").select("id, nome, status, endereco_obra").eq("arquiteto_id", forn.id).eq("deletado", false).order("created_at", { ascending: false }),
        supabase.from("comissoes").select("*, projetos(nome)").eq("fornecedor_id", forn.id).eq("deletado", false).order("created_at", { ascending: false }),
      ]);
      return { projetos: projRes.data ?? [], comissoes: comRes.data ?? [] };
    },
    enabled: !!user?.email,
  });

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-background">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <FolderKanban size={18} className="text-primary" />
          <h1 className="text-sm font-bold text-foreground">Portal do Arquiteto</h1>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><LogOut size={14} /> Sair</button>
      </header>
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground">Meus Projetos</h2>
          {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : data?.projetos && data.projetos.length > 0 ? (
            <div className="space-y-2">
              {data.projetos.map((p: any) => (
                <div key={p.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                  <div><p className="text-xs font-semibold text-foreground">{p.nome}</p>{p.endereco_obra && <p className="text-[11px] text-muted-foreground">📍 {p.endereco_obra}</p>}</div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-primary/15 text-primary">{statusLabel[p.status] ?? p.status}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">Nenhum projeto vinculado.</p>}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5"><DollarSign size={14} /> Minhas Comissões (RT)</h2>
          {data?.comissoes && data.comissoes.length > 0 ? (
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-secondary/60">
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">%</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
                  <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
                </tr></thead>
                <tbody>
                  {data.comissoes.map((c: any) => (
                    <tr key={c.id} className="border-b border-border last:border-b-0">
                      <td className="px-2.5 py-1.5">{(c.projetos as any)?.nome ?? "—"}</td>
                      <td className="px-2.5 py-1.5 text-right">{c.percentual ?? 0}%</td>
                      <td className="px-2.5 py-1.5 text-right font-medium">{fmt(c.valor ?? 0)}</td>
                      <td className="px-2.5 py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${c.status === "pago" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-xs text-muted-foreground">Nenhuma comissão.</p>}
        </section>
      </main>
    </div>
  );
};

export default PortalArquiteto;
