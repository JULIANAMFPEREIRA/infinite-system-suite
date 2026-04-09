import { useAuditLogsProjeto } from "@/hooks/useAuditLog";
import { Clock, Plus, Pencil, Trash2 } from "lucide-react";

const acaoIcon: Record<string, typeof Plus> = { criacao: Plus, edicao: Pencil, exclusao: Trash2 };
const acaoLabel: Record<string, string> = { criacao: "Criação", edicao: "Edição", exclusao: "Exclusão" };
const acaoColor: Record<string, string> = {
  criacao: "bg-success/15 text-success",
  edicao: "bg-warning/15 text-warning",
  exclusao: "bg-destructive/15 text-destructive",
};

const tabelaLabel: Record<string, string> = {
  projetos: "Projeto",
  projeto_itens: "Item do Projeto",
  financeiro_receber: "Conta a Receber",
  financeiro_pagar: "Conta a Pagar",
  compras: "Compra",
  comissoes: "Comissão",
  visitas_tecnicas: "Visita Técnica",
  contratos: "Contrato",
  clientes: "Cliente",
  crm_interacoes: "Interação CRM",
  crm_arquivos: "Arquivo",
};

interface Props {
  projetoId: string;
}

const AtividadeLog = ({ projetoId }: Props) => {
  const { data: logs, isLoading } = useAuditLogsProjeto(projetoId);

  if (isLoading) return <p className="text-center py-6 text-xs text-muted-foreground">Carregando histórico...</p>;
  if (!logs?.length) return <p className="text-center py-6 text-xs text-muted-foreground">Nenhuma atividade registrada.</p>;

  return (
    <div className="space-y-1">
      {logs.map((log) => {
        const Icon = acaoIcon[log.acao] ?? Clock;
        return (
          <div key={log.id} className="flex items-start gap-3 py-2 px-3 rounded hover:bg-secondary/30 transition">
            <div className={`mt-0.5 p-1 rounded ${acaoColor[log.acao] ?? "bg-secondary"}`}>
              <Icon size={12} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">
                <span className="font-semibold">{acaoLabel[log.acao] ?? log.acao}</span>
                {" — "}
                <span className="text-muted-foreground">{tabelaLabel[log.tabela] ?? log.tabela}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(log.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AtividadeLog;
