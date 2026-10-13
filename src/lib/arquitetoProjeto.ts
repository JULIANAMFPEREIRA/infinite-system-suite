/**
 * Regra: o arquiteto vale POR PROJETO (projetos.arquiteto_id).
 * O arquiteto do cliente (clientes.arquiteto_id) é só o padrão herdado pelos projetos.
 */

const norm = (v?: string | null) => (v ? String(v).trim().toLowerCase() : "");

/** Compara ids ignorando caixa (a limpeza de texto do app põe UUIDs em maiúsculas). null e "" são iguais. */
export const mesmoId = (a?: string | null, b?: string | null): boolean => norm(a) === norm(b);

/** Arquiteto que vale para o projeto: o do projeto; se não houver, o padrão do cliente. */
export function arquitetoEfetivo(projeto?: string | null, cliente?: string | null): string | null {
  return norm(projeto) ? (projeto as string) : norm(cliente) ? (cliente as string) : null;
}

/**
 * Quando o arquiteto padrão do cliente muda, diz quais projetos acompanham a mudança:
 * os que não têm arquiteto ou que usavam o arquiteto antigo. Quem tem outro arquiteto escolhido não é tocado.
 */
export function projetosParaAtualizarArquiteto(
  projetos: { id: string; arquiteto_id: string | null }[],
  antigo: string | null | undefined,
  novo: string | null | undefined,
): string[] {
  if (mesmoId(antigo, novo)) return [];
  return projetos.filter(p => !norm(p.arquiteto_id) || mesmoId(p.arquiteto_id, antigo)).map(p => p.id);
}
