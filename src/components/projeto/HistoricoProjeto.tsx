import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { statusProjetoLabels, statusProjetoColors } from "@/lib/statusConfig";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, History } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type StatusProjeto = Database["public"]["Enums"]["status_projeto"];

interface Props {
  projetoId: string;
  dataCriacao?: string;
}

const HistoricoProjeto = ({ projetoId, dataCriacao }: Props) => {
  const { data: historico, isLoading } = useQuery({
    queryKey: ["historico_projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_projeto")
        .select("*")
        .eq("projeto_id", projetoId)
        .order("data", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!projetoId,
  });

  const tempoAtivo = dataCriacao
    ? formatDistanceToNow(new Date(dataCriacao), { locale: ptBR })
    : null;

  const getLabel = (status: string) =>
    statusProjetoLabels[status as StatusProjeto] ?? status.toUpperCase();

  const getColor = (status: string) =>
    statusProjetoColors[status as StatusProjeto] ?? "bg-secondary text-secondary-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <History size={14} className="text-primary" />
          Linha do Tempo
        </h3>
        {tempoAtivo && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 px-2.5 py-1 rounded-full">
            <Clock size={12} />
            Projeto ativo há {tempoAtivo}
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-6">Carregando histórico...</p>
      ) : !historico || historico.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Nenhuma alteração de status registrada ainda. O histórico será preenchido automaticamente a partir da próxima mudança de status.
        </p>
      ) : (
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-4">
            {historico.map((h, idx) => {
              const isLast = idx === historico.length - 1;
              const dataFormatada = new Date(h.data).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              const tempoRelativo = formatDistanceToNow(new Date(h.data), {
                addSuffix: true,
                locale: ptBR,
              });

              // Duration in this status
              let duracao: string | null = null;
              if (idx < historico.length - 1) {
                const next = new Date(historico[idx + 1].data);
                const curr = new Date(h.data);
                const diffMs = next.getTime() - curr.getTime();
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                if (diffDays > 0) {
                  duracao = `${diffDays} dia${diffDays > 1 ? "s" : ""}`;
                } else {
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                  duracao = diffHours > 0 ? `${diffHours}h` : "< 1h";
                }
              }

              return (
                <div key={h.id} className="relative flex items-start gap-3">
                  {/* Dot */}
                  <div
                    className={`absolute -left-6 top-1 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${
                      isLast
                        ? "border-primary bg-primary/20"
                        : "border-border bg-card"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isLast ? "bg-primary" : "bg-muted-foreground/50"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${getColor(
                          h.status
                        )}`}
                      >
                        {getLabel(h.status)}
                      </span>
                      {duracao && (
                        <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
                          {duracao} neste status
                        </span>
                      )}
                      {isLast && (
                        <span className="text-[10px] text-primary font-medium">
                          ● Status atual
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {dataFormatada} · {tempoRelativo}
                    </p>
                    {h.observacao && (
                      <p className="text-[11px] text-foreground/70 mt-0.5">{h.observacao}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoricoProjeto;
