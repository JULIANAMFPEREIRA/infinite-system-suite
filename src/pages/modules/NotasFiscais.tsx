import { Receipt } from "lucide-react";
import { useFinanceiroReceber } from "@/hooks/useFinanceiro";

const NotasFiscais = () => {
  const { data: receber, isLoading } = useFinanceiroReceber();
  const pagos = receber?.filter(r => r.status === "pago") ?? [];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Receipt size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Notas Fiscais</h1>
      </div>
      <p className="text-xs text-muted-foreground">Registros de recebimentos pagos — base para emissão de NFS-e / NF-e.</p>

      {isLoading ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Descrição</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
              <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Valor</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Pagamento</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">NF</th>
            </tr></thead>
            <tbody>
              {pagos.map(r => (
                <tr key={r.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5">{r.descricao ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{(r.projetos as any)?.nome ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-right font-medium">R$ {(r.valor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                  <td className="px-2.5 py-1.5">{r.data_pagamento ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center"><span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-warning/15 text-warning">Pendente</span></td>
                </tr>
              ))}
              {pagos.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum recebimento pago para emissão.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default NotasFiscais;
