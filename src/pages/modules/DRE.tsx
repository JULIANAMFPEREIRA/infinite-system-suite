import { TrendingUp, ShieldAlert } from "lucide-react";
import { useFinanceiroPagar, useFinanceiroReceber, useComissoes } from "@/hooks/useFinanceiro";
import { useFieldVisibility } from "@/hooks/useFieldVisibility";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const DRE = () => {
  const { canSeeFinancials } = useFieldVisibility();

  if (!canSeeFinancials) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-2">
          <ShieldAlert size={18} className="text-destructive" />
          <h1 className="text-lg font-bold text-foreground">Acesso Restrito</h1>
        </div>
        <p className="text-sm text-muted-foreground">Você não tem permissão para visualizar o DRE.</p>
      </div>
    );
  }
  const { data: receber, isLoading: lr } = useFinanceiroReceber();
  const { data: pagar, isLoading: lp } = useFinanceiroPagar();
  const { data: comissoes, isLoading: lc } = useComissoes();

  const receita = receber?.reduce((a, r) => a + (r.valor ?? 0), 0) ?? 0;
  const custos = pagar?.filter(p => !p.comissao_id).reduce((a, p) => a + (p.valor ?? 0), 0) ?? 0;
  const totalComissoes = comissoes?.reduce((a, c) => a + (c.valor ?? 0), 0) ?? 0;
  const lucro = receita - custos - totalComissoes;
  const margem = receita > 0 ? (lucro / receita) * 100 : 0;

  const isLoading = lr || lp || lc;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <TrendingUp size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">DRE em Tempo Real</h1>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border bg-success/5">
                <td className="px-4 py-3 font-semibold text-foreground">Receita Bruta</td>
                <td className="px-4 py-3 text-right font-bold text-success">{fmt(receita)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-foreground pl-8">(-) Custos Diretos (Fornecedores)</td>
                <td className="px-4 py-3 text-right text-destructive">{fmt(custos)}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-foreground pl-8">(-) Comissões (RT)</td>
                <td className="px-4 py-3 text-right text-destructive">{fmt(totalComissoes)}</td>
              </tr>
              <tr className="bg-primary/5">
                <td className="px-4 py-3 font-bold text-foreground">Lucro Líquido</td>
                <td className={`px-4 py-3 text-right font-bold ${lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmt(lucro)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-muted-foreground">Margem Líquida</td>
                <td className={`px-4 py-3 text-right font-semibold ${margem >= 0 ? "text-success" : "text-destructive"}`}>{margem.toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DRE;
