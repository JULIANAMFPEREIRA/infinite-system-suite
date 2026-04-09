import { Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { statusProjetoLabels, type StatusProjeto } from "@/lib/statusConfig";

const statusLabels = statusProjetoLabels;
const progressMap: Record<StatusProjeto, number> = {
  lead: 0, proposta: 5, orcamento: 10, aprovado: 15, vendido: 25,
  em_andamento: 35, infraestrutura: 45, instalacao: 55, cabeamento: 65,
  programacao: 75, personalizacao: 85, concluido: 100, pos_venda: 100, cancelado: 0
};

const Cronograma = () => {
  const empresaId = useEmpresa();
  const { data: projetos, isLoading } = useQuery({
    queryKey: ["projetos_cronograma", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projetos").select("id, nome, status, data_inicio, data_previsao, clientes(nome)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Wrench size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Cronograma de Projetos</h1>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p>
      ) : !projetos?.length ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Nenhum projeto encontrado.</p>
      ) : (
        <div className="space-y-3">
          {projetos.map(p => {
            const progress = progressMap[p.status as StatusProjeto] ?? 0;
            return (
              <div key={p.id} className="bg-card border border-border rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{p.nome}</h3>
                    <p className="text-[11px] text-muted-foreground">{(p.clientes as any)?.nome ?? "Sem cliente"}</p>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">{statusLabels[p.status as StatusProjeto]}</span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>Início: {p.data_inicio ?? "—"}</span>
                  <span>Previsão: {p.data_previsao ?? "—"}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2.5">
                  <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[11px] text-right text-muted-foreground">{progress}% concluído</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Cronograma;
