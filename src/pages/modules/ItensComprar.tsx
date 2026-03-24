import { useState } from "react";
import { ClipboardList, ShoppingCart, Check } from "lucide-react";
import { useNecessidadesCompra, useConverterEmCompra } from "@/hooks/useNecessidadesCompra";
import { toast } from "sonner";

const ItensComprar = () => {
  const { data: necessidades, isLoading } = useNecessidadesCompra();
  const converter = useConverterEmCompra();
  const [filterStatus, setFilterStatus] = useState<"todos" | "pendente" | "comprado">("pendente");

  const filtered = necessidades?.filter(n => filterStatus === "todos" || n.status === filterStatus) ?? [];

  const handleConverter = async (nec: any) => {
    try {
      await converter.mutateAsync(nec);
      toast.success("Compra gerada com sucesso!");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <ClipboardList size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Itens a Comprar</h1>
      </div>

      <div className="flex gap-1.5">
        {(["pendente", "comprado", "todos"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
            {s === "todos" ? "Todos" : s === "pendente" ? "Pendentes" : "Comprados"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground text-xs">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">Nenhum item encontrado.</div>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-secondary/60">
                  <th className="text-left px-2.5 py-2 font-semibold text-foreground border-b border-border">Descrição</th>
                  <th className="text-left px-2.5 py-2 font-semibold text-foreground border-b border-border">Projeto</th>
                  <th className="text-right px-2.5 py-2 font-semibold text-foreground border-b border-border">Qtd</th>
                  <th className="text-center px-2.5 py-2 font-semibold text-foreground border-b border-border">Status</th>
                  <th className="text-center px-2.5 py-2 font-semibold text-foreground border-b border-border">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((n: any) => (
                  <tr key={n.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-2.5 py-1.5 text-foreground">{n.descricao ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-foreground">{n.projetos?.nome ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-right text-foreground">{n.quantidade}</td>
                    <td className="px-2.5 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${n.status === "pendente" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
                        {n.status === "pendente" ? "Pendente" : "Comprado"}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5 text-center">
                      {n.status === "pendente" ? (
                        <button
                          onClick={() => handleConverter(n)}
                          disabled={converter.isPending}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground text-[11px] font-medium hover:brightness-110 transition disabled:opacity-50"
                        >
                          <ShoppingCart size={11} /> Comprar
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-success text-[11px]">
                          <Check size={11} /> Convertido
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItensComprar;
