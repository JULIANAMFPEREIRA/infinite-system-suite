import { useState } from "react";
import { FileText, Search, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow,
  TableHead, TableCell,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const Orcamentos = () => {
  const empresaId = useEmpresa();
  const [busca, setBusca] = useState("");

  const { data: orcamentos, isLoading } = useQuery({
    queryKey: ["orcamentos_listagem", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_orcamentos")
        .select("*, clientes(nome), crm_itens(quantidade, preco_venda)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const filtered = (orcamentos ?? []).filter((o) => {
    const term = busca.toLowerCase();
    const clienteNome = (o.clientes as any)?.nome?.toLowerCase() ?? "";
    const nome = o.nome?.toLowerCase() ?? "";
    return clienteNome.includes(term) || nome.includes(term);
  });

  const calcTotal = (itens: any[]) =>
    (itens ?? []).reduce(
      (sum: number, i: any) => sum + (i.quantidade ?? 1) * (i.preco_venda ?? 0),
      0
    );

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Orçamentos</h1>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por cliente ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum orçamento encontrado.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">Cliente</TableHead>
                <TableHead className="text-xs">Orçamento</TableHead>
                <TableHead className="text-xs text-right">Valor Total</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Envio da Proposta</TableHead>
                <TableHead className="text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((orc) => {
                const total = calcTotal(orc.crm_itens as any[]);
                const enviado = orc.data_envio_proposta
                  ? formatDistanceToNow(new Date(orc.data_envio_proposta), {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : null;

                return (
                  <TableRow key={orc.id} className="hover:bg-muted/20">
                    <TableCell className="text-xs font-medium">
                      {(orc.clientes as any)?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{orc.nome}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">
                      {formatCurrency(total)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={orc.aprovado ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {orc.aprovado ? "APROVADO" : "PENDENTE"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {orc.data_envio_proposta ? (
                        <span className="text-muted-foreground">
                          {new Date(orc.data_envio_proposta).toLocaleDateString("pt-BR")}
                          <br />
                          <span className="text-[10px] italic">
                            Enviado {enviado}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          // Navigate to client CRM view with this budget
                          window.location.href = `/crm`;
                        }}
                      >
                        <ExternalLink size={12} /> Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Orcamentos;
