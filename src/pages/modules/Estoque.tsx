import { useState } from "react";
import { Package, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";

const Estoque = () => {
  const empresaId = useEmpresa();
  const [tab, setTab] = useState<"catalogo" | "fisico">("catalogo");

  const { data: produtos, isLoading: loadingProd } = useQuery({
    queryKey: ["produtos", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*").order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: estoqueItens, isLoading: loadingEst } = useQuery({
    queryKey: ["estoque_itens", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("estoque_itens").select("*, produtos(nome), projetos(nome)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const statusColor = (s: string) => s === "disponivel" ? "bg-success/15 text-success" : s === "reservado" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary";
  const statusLabel = (s: string) => s === "disponivel" ? "Disponível" : s === "reservado" ? "Reservado" : "Instalado";

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Package size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Estoque</h1>
      </div>
      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setTab("catalogo")} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === "catalogo" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <BookOpen size={14} /> Catálogo de Produtos
        </button>
        <button onClick={() => setTab("fisico")} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === "fisico" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Package size={14} /> Estoque Físico
        </button>
      </div>

      {tab === "catalogo" ? (
        loadingProd ? <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p> : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/60">
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Código</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Produto</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Categoria</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Marca</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Preço Custo</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Preço Venda</th>
                  <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Est. Mín.</th>
                </tr>
              </thead>
              <tbody>
                {produtos?.map(p => (
                  <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                    <td className="px-2.5 py-1.5">{p.codigo ?? "—"}</td>
                    <td className="px-2.5 py-1.5 font-medium">{p.nome}</td>
                    <td className="px-2.5 py-1.5">{p.categoria ?? "—"}</td>
                    <td className="px-2.5 py-1.5">{p.marca ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-right">R$ {(p.preco_custo ?? 0).toLocaleString("pt-BR")}</td>
                    <td className="px-2.5 py-1.5 text-right">R$ {(p.preco_venda ?? 0).toLocaleString("pt-BR")}</td>
                    <td className="px-2.5 py-1.5 text-right">{p.estoque_minimo ?? 0}</td>
                  </tr>
                ))}
                {(!produtos || produtos.length === 0) && <tr><td colSpan={7} className="text-center py-4 text-muted-foreground">Nenhum produto cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>
        )
      ) : (
        loadingEst ? <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p> : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/60">
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Produto</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nº Série</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Local</th>
                  <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
                  <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                </tr>
              </thead>
              <tbody>
                {estoqueItens?.map(e => (
                  <tr key={e.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                    <td className="px-2.5 py-1.5 font-medium">{(e.produtos as any)?.nome ?? "—"}</td>
                    <td className="px-2.5 py-1.5">{e.numero_serie ?? "—"}</td>
                    <td className="px-2.5 py-1.5">{e.localizacao ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor(e.status ?? "disponivel")}`}>{statusLabel(e.status ?? "disponivel")}</span>
                    </td>
                    <td className="px-2.5 py-1.5">{(e.projetos as any)?.nome ?? "—"}</td>
                  </tr>
                ))}
                {(!estoqueItens || estoqueItens.length === 0) && <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum item no estoque.</td></tr>}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
};

export default Estoque;
