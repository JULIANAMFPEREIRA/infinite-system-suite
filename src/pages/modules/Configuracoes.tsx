import { Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEmpresa } from "@/hooks/useEmpresa";

const Configuracoes = () => {
  const { user, profile, roles } = useAuth();
  const empresaId = useEmpresa();

  const { data: empresa } = useQuery({
    queryKey: ["empresa_config", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").eq("id", empresaId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: users } = useQuery({
    queryKey: ["profiles_config", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email:avatar_url, empresa_id").eq("empresa_id", empresaId!);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <Settings size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Configurações</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Empresa</h2>
          <div className="space-y-2 text-xs">
            <div><span className="text-muted-foreground">Nome:</span> <span className="text-foreground font-medium">{empresa?.nome ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Fantasia:</span> <span className="text-foreground">{empresa?.nome_fantasia ?? "—"}</span></div>
            <div><span className="text-muted-foreground">CNPJ:</span> <span className="text-foreground">{empresa?.cnpj ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Segmento:</span> <span className="text-foreground">{empresa?.segmento ?? "—"}</span></div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Meu Perfil</h2>
          <div className="space-y-2 text-xs">
            <div><span className="text-muted-foreground">Nome:</span> <span className="text-foreground font-medium">{profile?.full_name ?? "—"}</span></div>
            <div><span className="text-muted-foreground">E-mail:</span> <span className="text-foreground">{user?.email ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Roles:</span> <span className="text-foreground">{roles.join(", ") || "—"}</span></div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Usuários da Empresa</h2>
        {users && users.length > 0 ? (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nome</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">ID</th>
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                    <td className="px-2.5 py-1.5 font-medium">{u.full_name ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-muted-foreground font-mono text-[10px]">{u.id.slice(0, 8)}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum usuário encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default Configuracoes;
