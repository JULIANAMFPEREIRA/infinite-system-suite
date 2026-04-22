/** Shared visual utilities for financial tables */

/** Format currency BRL */
export const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Format date to pt-BR */
export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("pt-BR");
};

/** Check if a date is overdue (before today) */
export const isOverdue = (d: string | null | undefined): boolean => {
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d + "T00:00:00");
  return target < today;
};

/** Check if a date is due within N days */
export const isDueSoon = (d: string | null | undefined, days = 7): boolean => {
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d + "T00:00:00");
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
};

/** Status badge classes — unified across all financial screens */
export const statusBadgeClass = (s: string): string => {
  switch (s) {
    case "pago":
    case "aprovado":
    case "aprovada":
    case "comprado":
      return "bg-success/15 text-success border border-success/25";
    case "parcial":
      return "bg-info/15 text-info border border-info/25";
    case "vencido":
    case "cancelado":
    case "cancelada":
      return "bg-destructive/15 text-destructive border border-destructive/25";
    case "pendente":
      return "bg-warning/15 text-warning border border-warning/25";
    case "em_compra":
      return "bg-info/15 text-info border border-info/25";
    case "instalado":
    case "entregue":
      return "bg-primary/15 text-primary border border-primary/25";
    default:
      return "bg-secondary text-muted-foreground border border-border";
  }
};

/** Status label — uppercase */
export const statusLabel = (s: string): string => {
  const map: Record<string, string> = {
    pendente: "PENDENTE",
    pago: "PAGO",
    parcial: "PARCIAL",
    vencido: "VENCIDO",
    cancelado: "CANCELADO",
    aprovado: "APROVADO",
    aprovada: "APROVADA",
    em_compra: "EM COMPRA",
    comprado: "COMPRADO",
    instalado: "INSTALADO",
    entregue: "ENTREGUE",
    cancelada: "CANCELADA",
  };
  return map[s] ?? s?.toUpperCase() ?? "—";
};

/** Row highlight class based on due date and status */
export const rowHighlightClass = (
  vencimento: string | null | undefined,
  status: string | null | undefined
): string => {
  if (status === "pago" || status === "cancelado" || status === "cancelada") return "";
  if (isOverdue(vencimento)) return "bg-destructive/[0.04]";
  if (isDueSoon(vencimento, 5)) return "bg-warning/[0.04]";
  return "";
};

/**
 * Saldo restante de uma conta a receber (ou a pagar) considerando recebimentos parciais.
 * Garante que nunca seja negativo.
 */
export const saldoRestante = (conta: any): number => {
  const total = Number(conta?.valor) || 0;
  const recebido = Number(conta?.valor_recebido) || 0;
  return Math.max(total - recebido, 0);
};

/**
 * Indica se uma conta está vencida (pendente/parcial com vencimento passado e saldo > 0).
 * Contas pagas ou canceladas nunca aparecem como vencidas.
 */
export const isContaVencida = (conta: any): boolean => {
  if (!conta) return false;
  if (conta.status === "pago" || conta.status === "cancelado" || conta.status === "cancelada") return false;
  if (saldoRestante(conta) <= 0) return false;
  if (conta.status === "vencido") return true;
  return isOverdue(conta.data_vencimento);
};
