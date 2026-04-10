import { Boxes } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";

const Kits = () => {
  const empresaId = useEmpresa();
  const { data: produtos, isLoading } = useQuery({
    queryKey: ["produtos_kits", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").eq("deletado", false).order("categoria", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const categorias = [...new Set(produtos?.map(p => p.categoria ?? "Sem categoria") ?? [])];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Boxes size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Kits de Produtos</h1>
      </div>
      <p className="text-xs text-muted-foreground">Produtos agrupados por categoria — base para criação de kits personalizados.</p>

      {isLoading ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p>
      ) : !categorias.length ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Nenhum produto cadastrado ainda.</p>
      ) : (
        <div className="space-y-4">
          {categorias.map(cat => (
            <div key={cat} className="bg-card border border-border rounded-lg p-3 space-y-2">
              <h3 className="text-xs font-semibold text-foreground">{cat}</h3>
              <div className="flex flex-wrap gap-2">
                {produtos?.filter(p => (p.categoria ?? "Sem categoria") === cat).map(p => (
                  <div key={p.id} className="bg-secondary/50 rounded px-2.5 py-1.5 text-[11px]">
                    <span className="font-medium text-foreground">{p.nome}</span>
                    <span className="text-muted-foreground ml-1.5">R$ {(p.preco_venda ?? 0).toLocaleString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Kits;
