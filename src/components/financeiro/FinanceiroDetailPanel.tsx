import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtBRL, fmtDate, statusBadgeClass, statusLabel } from "@/lib/financeiroUtils";
import { Check, Pencil, Trash2, X, Calendar, DollarSign, FileText, User, Briefcase, Hash } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface FinanceiroDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipo: "pagar" | "receber";
  conta: any | null;
  /** Extra resolved names */
  clienteNome?: string;
  fornecedorNome?: string;
  projetoNome?: string;
  /** Parcela display e.g. "1/3" */
  parcelaLabel?: string;
  /** Action callbacks */
  onBaixa?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const InfoRow = ({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: any }) => (
  <div className="flex items-start gap-2 py-1.5">
    {Icon && <Icon size={13} className="text-muted-foreground mt-0.5 shrink-0" />}
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-xs font-medium text-foreground mt-0.5">{value || "—"}</div>
    </div>
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pt-2 pb-1">{children}</div>
);

const FinanceiroDetailPanel = ({
  open,
  onOpenChange,
  tipo,
  conta,
  clienteNome,
  fornecedorNome,
  projetoNome,
  parcelaLabel,
  onBaixa,
  onEdit,
  onDelete,
}: FinanceiroDetailPanelProps) => {
  if (!conta) return null;

  const status = conta.status ?? "pendente";
  const isPendente = status === "pendente";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <DialogHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-sm font-bold text-foreground">
                {tipo === "receber" ? "Conta a Receber" : "Conta a Pagar"}
              </DialogTitle>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-semibold ${statusBadgeClass(status)}`}>
                {statusLabel(status)}
              </span>
            </div>
          </DialogHeader>

          {/* Valor em destaque */}
          <div className="mt-3 bg-muted/40 rounded-lg p-3 text-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Valor</div>
            <div className="text-2xl font-bold text-foreground tabular-nums">{fmtBRL(conta.valor ?? 0)}</div>
          </div>
        </div>

        <Separator />

        {/* Body */}
        <div className="px-5 py-3 space-y-1 max-h-[55vh] overflow-y-auto">
          {/* Identificação */}
          <SectionTitle>Identificação</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4">
            {tipo === "receber" && (
              <InfoRow label="Cliente" value={clienteNome} icon={User} />
            )}
            {tipo === "pagar" && (
              <InfoRow label="Fornecedor" value={fornecedorNome} icon={User} />
            )}
            <InfoRow label="Projeto" value={projetoNome} icon={Briefcase} />
          </div>

          <Separator className="my-2" />

          {/* Datas */}
          <SectionTitle>Datas</SectionTitle>
          <div className="grid grid-cols-2 gap-x-4">
            <InfoRow label="Emissão" value={fmtDate(conta.created_at?.split("T")[0])} icon={Calendar} />
            <InfoRow label="Vencimento" value={fmtDate(conta.data_vencimento)} icon={Calendar} />
            <InfoRow
              label={tipo === "receber" ? "Recebido em" : "Pago em"}
              value={conta.data_pagamento ? fmtDate(conta.data_pagamento) : "—"}
              icon={Calendar}
            />
          </div>

          {/* Parcelamento (só receber) */}
          {tipo === "receber" && parcelaLabel && (
            <>
              <Separator className="my-2" />
              <SectionTitle>Parcelamento</SectionTitle>
              <div className="grid grid-cols-2 gap-x-4">
                <InfoRow label="Parcela" value={parcelaLabel} icon={Hash} />
              </div>
            </>
          )}

          <Separator className="my-2" />

          {/* Detalhes */}
          <SectionTitle>Detalhes</SectionTitle>
          <InfoRow label="Descrição" value={conta.descricao} icon={FileText} />

          {/* Origem */}
          {(conta.projeto_id || conta.comissao_id) && (
            <>
              <Separator className="my-2" />
              <SectionTitle>Origem</SectionTitle>
              <div className="grid grid-cols-2 gap-x-4">
                {conta.projeto_id && <InfoRow label="Projeto vinculado" value={projetoNome} icon={Briefcase} />}
                {conta.comissao_id && <InfoRow label="Comissão vinculada" value="Sim" icon={DollarSign} />}
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Ações */}
        <div className="px-5 py-3 flex items-center gap-2 justify-end">
          {isPendente && onBaixa && (
            <button
              onClick={() => { onOpenChange(false); onBaixa(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-success/10 text-success text-xs font-medium hover:bg-success/20 transition-colors"
            >
              <Check size={13} />
              {tipo === "receber" ? "Receber" : "Pagar"}
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => { onOpenChange(false); onEdit(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
            >
              <Pencil size={13} />
              Editar
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm("Excluir este registro?")) {
                  onOpenChange(false);
                  onDelete();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
            >
              <Trash2 size={13} />
              Excluir
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FinanceiroDetailPanel;
