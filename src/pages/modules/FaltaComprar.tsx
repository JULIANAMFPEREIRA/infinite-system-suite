import { useState, useMemo } from "react";
import { ShoppingCart, Search, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Skeleton } from "@/components/ui/skeleton";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const FaltaComprar = () => {
  const empresaId = useEmpresa();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: faltaComprarData, isLoading } = useQuery({
    queryKey: ["falta_comprar_full", empresaId],
    queryFn: async () => {
      const { data: orcAprovados } = await supabase
        .from("crm_orcamentos")
        .select("id, nome, cliente_id, frete, imposto, simulacao_pagamento, clientes(nome)")
        .eq("aprovado", true);

      if (!orcAprovados?.length) return [];

      const orcIds = orcAprovados.map(o => o.id);

      // Itens pendentes para o cálculo do "Falta Comprar"
      const { data: itensPendentes } = await supabase
        .from("crm_itens")
        .select("id, quantidade, preco_custo, orcamento_id, rt_comissao")
        .eq("status_compra", "pendente")
        .in("orcamento_id", orcIds);

      // Todos os itens para o custo total e RT
      const { data: todosItens } = await supabase
        .from("crm_itens")
        .select("id, preco_custo, quantidade, status_compra, orcamento_id, rt_comissao, rt_valor_pago")
        .in("orcamento_id", orcIds);

      const porOrcamento: any[] = [];

      orcAprovados.forEach(orc => {
        const clienteNome = (orc.clientes as any)?.nome ?? "—";
        const allItensOrc = (todosItens ?? []).filter(i => i.orcamento_id === orc.id);
        const itensPend = (itensPendentes ?? []).filter(i => i.orcamento_id === orc.id);

        // Total Custo Projeto = soma de preco_custo * quantidade de TODOS os itens
        const totalCustoProjeto = allItensOrc.reduce(
          (s, i) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0);

        // Total Comprado = soma de preco_custo * quantidade dos itens com status_compra = "comprado"
        const totalComprado = allItensOrc
          .filter(i => i.status_compra === "comprado")
          .reduce((s, i) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0);

        // Falta Comprar = soma de preco_custo * quantidade dos itens pendentes
        const itemsCostPend = itensPend.reduce(
          (s, i) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0);

        // RT Pendente
        const rtTotal = allItensOrc.reduce((s, i) => s + (Number(i.rt_comissao) || 0), 0);
        const rtPago = allItensOrc.reduce((s, i) => {
          const t = Number(i.rt_comissao) || 0;
          return s + Math.min(Math.max(Number(i.rt_valor_pago) || 0, 0), t);
        }, 0);
        const rtPendente = Math.max(rtTotal - rtPago, 0);

        // Frete e Imposto Pendentes
        const sim = (orc.simulacao_pagamento as any) ?? {};
        const fretesExtras = Array.isArray(sim.fretes_extras) ? sim.fretes_extras : [];
        const freteRealizado = fretesExtras.reduce((s: number, f: any) => s + (Number(f.valor) || 0), 0);
        const fretePrevisto = Number(orc.frete) || 0;
        const fretePendente = Math.max(fretePrevisto - freteRealizado, 0);
        const orcImposto = Number(orc.imposto) || 0;
        const impostoPendente = itensPend.length > 0 ? orcImposto : 0;

        const valorFaltaComprar = itemsCostPend + rtPendente + fretePendente + impostoPendente;

        porOrcamento.push({
          clienteId: orc.cliente_id,
          clienteNome,
          orcamentoId: orc.id,
          orcamentoNome: orc.nome,
          totalCustoProjeto,
          totalComprado,
          valorFaltaComprar,
          qtdItensPendentes: itensPend.length
        });
      });

      return porOrcamento
        .filter(o => o.valorFaltaComprar > 0)
        .sort((a, b) => b.valorFaltaComprar - a.valorFaltaComprar);
    },
    enabled: !!empresaId,
  });

  const filteredData = useMemo(() => {
    if (!faltaComprarData) return [];
    if (!searchTerm.trim()) return faltaComprarData;
    const q = searchTerm.toLowerCase();
    return faltaComprarData.filter(o => 
      o.clienteNome.toLowerCase().includes(q) || 
      o.orcamentoNome.toLowerCase().includes(q)
    );
  }, [faltaComprarData, searchTerm]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, curr) => ({
      custo: acc.custo + curr.totalCustoProjeto,
      comprado: acc.comprado + curr.totalComprado,
      falta: acc.falta + curr.valorFaltaComprar,
      itens: acc.itens + curr.qtdItensPendentes
    }), { custo: 0, comprado: 0, falta: 0, itens: 0 });
  }, [filteredData]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="text-orange-600" size={20} />
              Falta Comprar por Projeto
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Resumo de pendências de compras por orçamento aprovado
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
          <input
            type="text"
            placeholder="Buscar por cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-secondary/30 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Orçamento</th>
                <th className="px-4 py-3 text-right">Total Custo Projeto</th>
                <th className="px-4 py-3 text-right">Total Comprado</th>
                <th className="px-4 py-3 text-right">Itens Pend.</th>
                <th className="px-4 py-3 text-right text-orange-600">Falta Comprar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredData.map((item, i) => (
                <tr key={i} className="hover:bg-secondary/20 transition-colors group">
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">{item.clienteNome}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{item.orcamentoNome}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium tabular-nums">{fmt(item.totalCustoProjeto)}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium tabular-nums text-success">{fmt(item.totalComprado)}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className="bg-secondary px-2 py-0.5 rounded-full font-medium text-[11px]">
                      {item.qtdItensPendentes} itens
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-orange-600 tabular-nums">{fmt(item.valorFaltaComprar)}</td>
                </tr>
              ))}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm italic">
                    Nenhum orçamento com pendências encontrado.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-orange-50/30 border-t-2 border-orange-100 font-bold">
              <tr>
                <td colSpan={2} className="px-4 py-4 text-sm uppercase tracking-wider">Total Geral</td>
                <td className="px-4 py-4 text-sm text-right tabular-nums">{fmt(totals.custo)}</td>
                <td className="px-4 py-4 text-sm text-right tabular-nums text-success">{fmt(totals.comprado)}</td>
                <td className="px-4 py-4 text-sm text-right">{totals.itens} itens</td>
                <td className="px-4 py-4 text-sm text-right text-orange-600 tabular-nums">{fmt(totals.falta)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FaltaComprar;