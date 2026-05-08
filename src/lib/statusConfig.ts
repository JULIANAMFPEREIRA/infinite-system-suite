import type { Database } from "@/integrations/supabase/types";

export type StatusCRM = Database["public"]["Enums"]["status_crm"];
export type StatusProjeto = Database["public"]["Enums"]["status_projeto"];

/* ═══════════════════════════════════════════
   STATUS CRM (clientes) — Funil de Vendas
   ═══════════════════════════════════════════ */
export const statusCrmLabels: Record<StatusCRM, string> = {
  lead: "LEAD",
  contato: "EM CONTATO",
  proposta: "PROPOSTA ENVIADA",
  projeto: "PROJETO",
  concluido: "CONCLUÍDO",
};

export const statusCrmColors: Record<StatusCRM, string> = {
  lead: "bg-secondary text-secondary-foreground",
  contato: "bg-warning/15 text-warning",
  proposta: "bg-primary/15 text-primary",
  projeto: "bg-success/15 text-success",
  concluido: "bg-indigo-900 text-white",
};

export const statusCrmKanban: { key: StatusCRM; label: string; color: string; borderColor: string; bgColor: string }[] = [
  { key: "lead", label: "LEADS", color: "text-muted-foreground", borderColor: "border-muted-foreground/30", bgColor: "bg-secondary/30" },
  { key: "contato", label: "EM CONTATO", color: "text-warning", borderColor: "border-warning/30", bgColor: "bg-warning/5" },
  { key: "proposta", label: "PROPOSTA ENVIADA", color: "text-primary", borderColor: "border-primary/30", bgColor: "bg-primary/5" },
  { key: "projeto", label: "PROJETOS", color: "text-success", borderColor: "border-success/30", bgColor: "bg-success/5" },
  { key: "concluido", label: "CONCLUÍDO", color: "text-indigo-600", borderColor: "border-indigo-300", bgColor: "bg-indigo-50" },
];

export const statusCrmOptions: { value: StatusCRM; label: string }[] = [
  { value: "lead", label: "LEAD" },
  { value: "contato", label: "EM CONTATO" },
  { value: "proposta", label: "PROPOSTA ENVIADA" },
  { value: "projeto", label: "PROJETO" },
  { value: "concluido", label: "CONCLUÍDO" },
];

/* ═══════════════════════════════════════════
   STATUS PROJETO — Operacional
   ═══════════════════════════════════════════ */
export const statusProjetoLabels: Record<StatusProjeto, string> = {
  lead: "LEAD",
  proposta: "PROPOSTA",
  orcamento: "ORÇAMENTO",
  aprovado: "APROVADO",
  vendido: "VENDIDO",
  em_andamento: "EM ANDAMENTO",
  infraestrutura: "INFRAESTRUTURA",
  instalacao: "INSTALAÇÃO",
  cabeamento: "CABEAMENTO",
  programacao: "PROGRAMAÇÃO",
  personalizacao: "PERSONALIZAÇÃO",
  concluido: "CONCLUÍDO",
  pos_venda: "PÓS-VENDA",
  cancelado: "CANCELADO",
  em_pausa: "EM PAUSA",
};

export const statusProjetoColors: Record<StatusProjeto, string> = {
  lead: "bg-secondary text-secondary-foreground",
  proposta: "bg-warning/15 text-warning",
  orcamento: "bg-secondary text-secondary-foreground",
  aprovado: "bg-success/15 text-success",
  vendido: "bg-primary/15 text-primary",
  em_andamento: "bg-primary/15 text-primary",
  infraestrutura: "bg-amber-500/15 text-amber-600",
  instalacao: "bg-blue-500/15 text-blue-600",
  cabeamento: "bg-violet-500/15 text-violet-600",
  programacao: "bg-cyan-500/15 text-cyan-600",
  personalizacao: "bg-pink-500/15 text-pink-600",
  concluido: "bg-info/15 text-info",
  pos_venda: "bg-accent text-accent-foreground",
  cancelado: "bg-destructive/15 text-destructive",
  em_pausa: "bg-orange-500/15 text-orange-600",
};

/** Status operacionais exibidos na listagem de projetos (nova ordem) */
export const statusProjetoOperacionais: StatusProjeto[] = [
  "infraestrutura", "cabeamento", "instalacao", "programacao",
  "concluido", "pos_venda", "em_pausa", "cancelado",
];

/** Status do dropdown de alteração dentro do projeto */
export const statusProjetoDropdown: { value: StatusProjeto; label: string }[] =
  statusProjetoOperacionais.map(s => ({ value: s, label: statusProjetoLabels[s] }));
