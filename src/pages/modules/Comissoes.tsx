import { useState, useMemo } from "react";
import { UserCheck, Check, Search, Filter, Wallet, Clock, CheckCircle2, Scissors } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Comissoes = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();

  // Filtros
  const [filtroParceiro, setFiltroParceiro] = useState("");
  const [filtroProjeto, setFiltroProjeto] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [busca, setBusca] = useState("");

  // Modal de pagamento
  const [showBaixa, setShowBaixa] = useState(false);
  const [showParcelar, setShowParcelar] = useState(false);
  const [comissaoParaParcelar, setComissaoParaParcelar] = useState<any>(null);
  const [numParcelas, setNumParcelas] = useState(2);
  const [selectedComissao, setSelectedComissao] = useState<any>(null);
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split("T")[0]);
  const [baixaValor, setBaixaValor] = useState(0);
  const [baixaObs, setBaixaObs] = useState("");

  // Query principal
  const { data: comissoes, isLoading } = useQuery({
    queryKey: ["comissoes_rt", empresaId, filtroParceiro, filtroStatus, filtroProjeto],
    queryFn: async () => {
      let query = supabase
        .from("comissoes")
        .select(`
          *,
          fornecedores(id, nome),
          projetos(id, nome)
        `)
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .order("created_at", { ascending: false });

      if (filtroParceiro) {
        query = query.eq("fornecedor_id", filtroParceiro);
      }
      if (filtroStatus && filtroStatus !== "todos") {
        query = query.eq("status", filtroStatus as any);
      }
      if (filtroProjeto) {
        query = query.eq("projeto_id", filtroProjeto);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  // Queries para os selects de filtro
  const { data: parceirosList } = useQuery({
    queryKey: ["parceiros_comissoes", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .order("nome");
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const { data: projetosList } = useQuery({
    queryKey: ["projetos_comissoes", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id, nome")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .order("nome");
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const filteredComissoes = useMemo(() => {
    if (!comissoes) return [];
    return comissoes.filter(c => {
      const searchStr = busca.toLowerCase();
      const parceiroNome = (c.fornecedores as any)?.nome?.toLowerCase() || "";
      const projetoNome = (c.projetos as any)?.nome?.toLowerCase() || "";
      return parceiroNome.includes(searchStr) || projetoNome.includes(searchStr);
    });
  }, [comissoes, busca]);

  // Resumos
  const totais = useMemo(() => {
    if (!comissoes) return { total: 0, pago: 0, pendente: 0 };
    return comissoes.reduce((acc, c) => {
      acc.total += c.valor || 0;
      if (c.status === "pago") acc.pago += c.valor || 0;
      else acc.pendente += c.valor || 0;
      return acc;
    }, { total: 0, pago: 0, pendente: 0 });
  }, [comissoes]);

  const handleOpenBaixa = (c: any) => {
    setSelectedComissao(c);
    setBaixaValor(c.valor || 0);
    setBaixaData(new Date().toISOString().split("T")[0]);
    setBaixaObs("");
    setShowBaixa(true);
  };

  const handleOpenParcelar = (c: any) => {
    setComissaoParaParcelar(c);
    setNumParcelas(2);
    setShowParcelar(true);
  };

  const handleConfirmarParcelamento = async () => {
    if (!comissaoParaParcelar || !empresaId) return;
    try {
      // 1. Buscar todos os financeiro_pagar onde comissao_id = comissao.id
      const { data: contasPagar, error: fetchErr } = await supabase
        .from("financeiro_pagar")
        .select("*")
        .eq("comissao_id", comissaoParaParcelar.id)
        .eq("deletado", false);

      if (fetchErr) throw fetchErr;

      if (contasPagar && contasPagar.length > 0) {
        for (const conta of contasPagar) {
          // Deletar original
          const { error: delErr } = await supabase
            .from("financeiro_pagar")
            .delete()
            .eq("id", conta.id);
          if (delErr) throw delErr;

          // Criar N novas parcelas
          const valorParcela = (conta.valor ?? 0) / numParcelas;
          const dataBase = new Date(conta.data_vencimento || new Date());

          const novasParcelas = Array.from({ length: numParcelas }).map((_, i) => {
            const dataVenc = new Date(dataBase);
            dataVenc.setMonth(dataVenc.getMonth() + i);
            return {
              empresa_id: empresaId,
              projeto_id: conta.projeto_id,
              fornecedor_id: conta.fornecedor_id,
              categoria_id: conta.categoria_id,
              comissao_id: conta.comissao_id,
              descricao: `Parcela ${i + 1}/${numParcelas} — ${conta.descricao}`,
              valor: Number(valorParcela.toFixed(2)),
              data_vencimento: dataVenc.toISOString().split("T")[0],
              status: "pendente",
              origem: conta.origem || "comissao",
              tipo_manual: conta.tipo_manual || "comissao"
            };
          });

          const { error: insErr } = await supabase
            .from("financeiro_pagar")
            .insert(novasParcelas as any);
          if (insErr) throw insErr;
        }
      }

      // 3. Atualizar a comissão original
      const { error: updErr } = await supabase
        .from("comissoes")
        .update({
          parcelado: true,
          num_parcelas: numParcelas
        } as any)
        .eq("id", comissaoParaParcelar.id);
      if (updErr) throw updErr;

      toast.success("Comissão parcelada com sucesso!");
      setShowParcelar(false);
      setComissaoParaParcelar(null);

      // 4. Invalidar queries
      qc.invalidateQueries({ queryKey: ["comissoes_rt"] });
      qc.invalidateQueries({ queryKey: ["financeiro_pagar"] });
    } catch (err: any) {
      toast.error("Erro ao parcelar: " + err.message);
    }
  };

  const handleConfirmarPagamento = async () => {
    if (!selectedComissao) return;
    try {
      // 1. Atualizar comissoes
      const { error: errorComissao } = await supabase
        .from("comissoes")
        .update({ status: "pago" })
        .eq("id", selectedComissao.id);
      
      if (errorComissao) throw errorComissao;

      // 2. Atualizar financeiro_pagar
      const { error: errorFinanceiro } = await supabase
        .from("financeiro_pagar")
        .update({ 
          status: "pago" as any, 
          data_pagamento: baixaData,
          observacao: baixaObs 
        } as any)
        .eq("comissao_id", selectedComissao.id);

      // 3. Atualizar parcelas_parceiros
      await supabase
        .from("parcelas_parceiros")
        .update({ status: "pago" })
        .eq("parceiro_id", selectedComissao.fornecedor_id)
        .eq("projeto_id", selectedComissao.projeto_id)
        .eq("status", "pendente");

      toast.success("Pagamento registrado com sucesso");
      setShowBaixa(false);
      qc.invalidateQueries({ queryKey: ["comissoes_rt"] });
      qc.invalidateQueries({ queryKey: ["financeiro_pagar"] });
    } catch (error: any) {
      toast.error("Erro ao registrar pagamento: " + error.message);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-foreground">Comissões RT</h1>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total de Comissões</p>
            <p className="text-lg font-bold">{fmt(totais.total)}</p>
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 rounded-full bg-green-500/10 text-green-500">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Pago</p>
            <p className="text-lg font-bold text-green-600">{fmt(totais.pago)}</p>
          </div>
        </div>
        <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
          <div className="p-3 rounded-full bg-orange-500/10 text-orange-500">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Pendente</p>
            <p className="text-lg font-bold text-orange-600">{fmt(totais.pendente)}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-1">
          <Filter size={16} /> Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Parceiro</label>
            <select 
              value={filtroParceiro} 
              onChange={e => setFiltroParceiro(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">Todos os parceiros</option>
              {parceirosList?.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Projeto</label>
            <select 
              value={filtroProjeto} 
              onChange={e => setFiltroProjeto(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="">Todos os projetos</option>
              {projetosList?.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Status</label>
            <select 
              value={filtroStatus} 
              onChange={e => setFiltroStatus(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2 lg:col-span-2">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Busca</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input 
                type="text"
                placeholder="Nome do parceiro ou projeto..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="border border-border rounded-lg overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left">Parceiro</th>
                <th className="px-4 py-3 text-left">Projeto</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">%</th>
                <th className="px-4 py-3 text-right">Pago</th>
                <th className="px-4 py-3 text-right">Pendente</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Carregando comissões...</td>
                </tr>
              ) : filteredComissoes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Nenhuma comissão encontrada.</td>
                </tr>
              ) : (
                filteredComissoes.map(c => (
                  <tr key={c.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{(c.fornecedores as any)?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{(c.projetos as any)?.nome ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <div className="flex flex-col items-end">
                        <span>{fmt(c.parcelado ? (c.valor / c.num_parcelas) : (c.valor || 0))}</span>
                        {c.parcelado && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded font-bold">
                            Parcelado {c.num_parcelas}x
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{c.percentual || 0}%</td>
                    <td className="px-4 py-3 text-right text-green-600">
                      {c.status === "pago" ? fmt(c.valor || 0) : "R$ 0,00"}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600">
                      {c.status === "pendente" ? fmt(c.valor || 0) : "R$ 0,00"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        c.status === "pago" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {c.status === "pendente" && (
                          <>
                            <button 
                              onClick={() => handleOpenBaixa(c)}
                              className="px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] font-semibold hover:brightness-105 transition shadow-sm flex items-center gap-1"
                            >
                              <Check size={12} /> Registrar Pagamento
                            </button>
                            {!c.parcelado && (
                              <button 
                                onClick={() => handleOpenParcelar(c)}
                                className="px-2 py-1 rounded bg-secondary text-secondary-foreground text-[10px] font-semibold hover:bg-secondary/80 transition shadow-sm flex items-center gap-1"
                                title="Parcelar"
                              >
                                <Scissors size={12} /> Parcelar
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Pagamento */}
      <Dialog open={showBaixa} onOpenChange={setShowBaixa}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Valor Pago</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <input 
                    type="number" 
                    value={baixaValor} 
                    onChange={e => setBaixaValor(Number(e.target.value))}
                    className="w-full h-10 pl-9 pr-3 text-sm bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none font-semibold"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Data do Pagamento</label>
                <input 
                  type="date" 
                  value={baixaData} 
                  onChange={e => setBaixaData(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Observação (opcional)</label>
              <textarea 
                value={baixaObs} 
                onChange={e => setBaixaObs(e.target.value)}
                placeholder="Alguma nota sobre o pagamento..."
                className="w-full min-h-[80px] p-3 text-sm bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none resize-none"
              />
            </div>
            {selectedComissao && (
              <div className="p-3 bg-secondary/30 rounded-md border border-border/50 text-xs space-y-1 text-muted-foreground">
                <p><strong>Parceiro:</strong> {(selectedComissao.fornecedores as any)?.nome}</p>
                <p><strong>Projeto:</strong> {(selectedComissao.projetos as any)?.nome}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button 
              onClick={() => setShowBaixa(false)} 
              className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-md border border-border hover:bg-secondary transition"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirmarPagamento}
              className="flex-1 sm:flex-none px-6 py-2 text-sm rounded-md bg-primary text-primary-foreground font-semibold hover:brightness-105 transition"
            >
              Confirmar Pagamento
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Parcelamento */}
      <Dialog open={showParcelar} onOpenChange={setShowParcelar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Parcelar Comissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Número de Parcelas</label>
              <input 
                type="number" 
                min={2} 
                max={12}
                value={numParcelas} 
                onChange={e => setNumParcelas(Math.max(2, Math.min(12, Number(e.target.value))))}
                className="w-full h-10 px-3 text-sm bg-background border border-border rounded-md focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            {comissaoParaParcelar && (
              <div className="p-3 bg-secondary/30 rounded-md border border-border/50 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Valor Total:</span>
                  <span className="font-bold">{fmt(comissaoParaParcelar.valor || 0)}</span>
                </div>
                <div className="flex justify-between items-center text-primary pt-1 border-t border-border/50">
                  <span className="font-semibold text-muted-foreground">Valor de cada Parcela:</span>
                  <span className="font-bold text-base">{fmt((comissaoParaParcelar.valor || 0) / numParcelas)}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <button 
              onClick={() => setShowParcelar(false)} 
              className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-md border border-border hover:bg-secondary transition"
            >
              Cancelar
            </button>
            <button 
              onClick={handleConfirmarParcelamento}
              className="flex-1 sm:flex-none px-6 py-2 text-sm rounded-md bg-primary text-primary-foreground font-semibold hover:brightness-105 transition"
            >
              Confirmar Parcelamento
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Comissoes;
