import { useState, useMemo } from "react";
import { 
  Wallet, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, 
  Filter, Search, CheckCircle2, Clock, AlertCircle, RefreshCcw,
  Settings2, MoreVertical, X, Calendar, DollarSign
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, parseISO, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FinancasPessoais = () => {
  const empresaId = useEmpresa();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dataFiltro, setDataFiltro] = useState(new Date());
  
  // Modais
  const [showLancamento, setShowLancamento] = useState(false);
  const [showCategorias, setShowCategorias] = useState(false);
  const [showBaixa, setShowBaixa] = useState(false);
  
  // Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  // Estado Formulário Lançamento
  const [editId, setEditId] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [tipo, setTipo] = useState<string>("despesa");
  const [categoriaId, setCategoriaId] = useState("");
  const [valor, setValor] = useState("");
  const [dataVenc, setDataVenc] = useState(format(new Date(), "yyyy-MM-dd"));
  const [recorrente, setRecorrente] = useState(false);
  const [mesesRecorrencia, setMesesRecorrencia] = useState("1");

  // Estado Formulário Baixa
  const [lancamentoParaBaixa, setLancamentoParaBaixa] = useState<any>(null);
  const [valorPago, setValorPago] = useState("");
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), "yyyy-MM-dd"));
  const [observacao, setObservacao] = useState("");

  // Estado Formulário Categoria
  const [catNome, setCatNome] = useState("");
  const [catTipo, setCatTipo] = useState("despesa");
  const [catCor, setCatCor] = useState("#3b82f6");

  const mesReferencia = format(dataFiltro, "MM/yyyy");

  // Queries
  const { data: categorias } = useQuery({
    queryKey: ["financas_pessoais_categorias", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financas_pessoais_categorias")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: lancamentos, isLoading } = useQuery({
    queryKey: ["financas_pessoais_lancamentos", user?.id, mesReferencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financas_pessoais_lancamentos")
        .select("*, financas_pessoais_categorias(nome, cor)")
        .eq("user_id", user!.id)
        .eq("empresa_id", empresaId!)
        .eq("mes_referencia", mesReferencia)
        .order("data_vencimento");
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!empresaId,
  });

  // Mutações
  const saveLancamento = useMutation({
    mutationFn: async () => {
      if (!empresaId || !user) return;
      
      const numValor = parseFloat(valor.replace(",", "."));
      const payloadBase = {
        empresa_id: empresaId,
        user_id: user.id,
        descricao: desc,
        tipo,
        categoria_id: categoriaId || null,
        valor: numValor,
        data_vencimento: dataVenc,
        mes_referencia: format(parseISO(dataVenc), "MM/yyyy"),
        recorrente,
        status: "pendente"
      };

      if (editId) {
        const { error } = await supabase
          .from("financas_pessoais_lancamentos")
          .update(payloadBase)
          .eq("id", editId);
        if (error) throw error;
      } else {
        // Primeiro lançamento
        const { data: primeiro, error: errPri } = await supabase
          .from("financas_pessoais_lancamentos")
          .insert(payloadBase)
          .select()
          .single();
        if (errPri) throw errPri;

        // Se recorrente, criar os próximos meses
        if (recorrente && primeiro) {
          const numMeses = parseInt(mesesRecorrencia);
          const novos = [];
          for (let i = 1; i <= numMeses; i++) {
            const novaData = addMonths(parseISO(dataVenc), i);
            novos.push({
              ...payloadBase,
              data_vencimento: format(novaData, "yyyy-MM-dd"),
              mes_referencia: format(novaData, "MM/yyyy"),
              lancamento_pai_id: primeiro.id,
              recorrente: true
            });
          }
          const { error: errNovos } = await supabase
            .from("financas_pessoais_lancamentos")
            .insert(novos);
          if (errNovos) throw errNovos;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financas_pessoais_lancamentos"] });
      toast.success(editId ? "Lançamento atualizado" : "Lançamento(s) criado(s)");
      fecharLancamento();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const confirmBaixa = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("financas_pessoais_lancamentos")
        .update({
          status: "pago",
          valor_pago: parseFloat(valorPago.replace(",", ".")),
          data_pagamento: dataPagamento,
          observacao
        })
        .eq("id", lancamentoParaBaixa.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financas_pessoais_lancamentos"] });
      toast.success("Baixa realizada com sucesso!");
      setShowBaixa(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeLancamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financas_pessoais_lancamentos")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financas_pessoais_lancamentos"] });
      toast.success("Lançamento excluído");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const saveCategoria = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("financas_pessoais_categorias")
        .insert({
          empresa_id: empresaId!,
          user_id: user!.id,
          nome: catNome,
          tipo: catTipo,
          cor: catCor
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financas_pessoais_categorias"] });
      setCatNome("");
      toast.success("Categoria criada");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeCategoria = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financas_pessoais_categorias")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financas_pessoais_categorias"] });
      toast.success("Categoria excluída");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Helpers
  const fecharLancamento = () => {
    setShowLancamento(false);
    setEditId(null);
    setDesc("");
    setTipo("despesa");
    setCategoriaId("");
    setValor("");
    setDataVenc(format(new Date(), "yyyy-MM-dd"));
    setRecorrente(false);
    setMesesRecorrencia("1");
  };

  const abrirEditar = (l: any) => {
    setEditId(l.id);
    setDesc(l.descricao);
    setTipo(l.tipo);
    setCategoriaId(l.categoria_id || "");
    setValor(l.valor.toString());
    setDataVenc(l.data_vencimento);
    setRecorrente(l.recorrente || false);
    setShowLancamento(true);
  };

  const abrirBaixa = (l: any) => {
    setLancamentoParaBaixa(l);
    setValorPago(l.valor.toString());
    setDataPagamento(format(new Date(), "yyyy-MM-dd"));
    setObservacao("");
    setShowBaixa(true);
  };

  const lancamentosFiltrados = useMemo(() => {
    if (!lancamentos) return [];
    return lancamentos.filter(l => {
      const matchesTipo = filtroTipo === "todos" || l.tipo === filtroTipo;
      const matchesStatus = filtroStatus === "todos" || l.status === filtroStatus;
      const matchesBusca = l.descricao.toLowerCase().includes(busca.toLowerCase());
      return matchesTipo && matchesStatus && matchesBusca;
    });
  }, [lancamentos, filtroTipo, filtroStatus, busca]);

  const resumo = useMemo(() => {
    const receitas = lancamentos?.filter(l => l.tipo === "receita").reduce((acc, l) => acc + Number(l.valor), 0) || 0;
    const despesas = lancamentos?.filter(l => l.tipo === "despesa" || l.tipo === "retirada").reduce((acc, l) => acc + Number(l.valor), 0) || 0;
    const aPagar = lancamentos?.filter(l => l.status === "pendente" && (l.tipo === "despesa" || l.tipo === "retirada")).reduce((acc, l) => acc + Number(l.valor), 0) || 0;
    
    return {
      receitas,
      despesas,
      aPagar,
      saldo: receitas - despesas
    };
  }, [lancamentos]);



  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Header com Navegação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="text-primary w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Finanças Pessoais</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button 
                onClick={() => setDataFiltro(subMonths(dataFiltro, 1))}
                className="p-1 hover:bg-secondary rounded transition"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-medium min-w-[100px] text-center capitalize">
                {format(dataFiltro, "MMMM / yyyy", { locale: ptBR })}
              </span>
              <button 
                onClick={() => setDataFiltro(addMonths(dataFiltro, 1))}
                className="p-1 hover:bg-secondary rounded transition"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCategorias(true)}>
            <Settings2 className="w-4 h-4 mr-2" />
            Categorias
          </Button>
          <Button size="sm" onClick={() => { setTipo("receita"); setShowLancamento(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Receita
          </Button>
          <Button size="sm" variant="destructive" onClick={() => { setTipo("despesa"); setShowLancamento(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Despesa
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receitas do Mês</CardTitle>
            <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {resumo.receitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas do Mês</CardTitle>
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              R$ {resumo.despesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A PAGAR</CardTitle>
            <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              R$ {resumo.aPagar.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Final</CardTitle>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <RefreshCcw className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${resumo.saldo >= 0 ? "text-primary" : "text-destructive"}`}>
              R$ {resumo.saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="bg-card border rounded-lg p-4 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full space-y-1.5">
          <Label>Buscar por descrição</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Ex: Aluguel, Supermercado..." 
              value={busca} 
              onChange={e => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-full md:w-40 space-y-1.5">
          <Label>Tipo</Label>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="receita">Receita</SelectItem>
              <SelectItem value="despesa">Despesa</SelectItem>
              <SelectItem value="retirada">Retirada</SelectItem>
              <SelectItem value="devolucao">Devolução</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-40 space-y-1.5">
          <Label>Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Vencimento</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-center">Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">Carregando lançamentos...</TableCell>
              </TableRow>
            ) : lancamentosFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nenhum lançamento encontrado para os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              lancamentosFiltrados.map((l) => {
                const isVencido = l.status === "pendente" && isBefore(parseISO(l.data_vencimento), startOfMonth(new Date()));
                const categoria = l.financas_pessoais_categorias;

                return (
                  <TableRow key={l.id} className="group">
                    <TableCell className="font-medium">
                      {format(parseISO(l.data_vencimento), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {l.descricao}
                        {l.recorrente && (
                          <RefreshCcw size={12} className="text-muted-foreground" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {categoria ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoria.cor }} />
                          {categoria.nome}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`capitalize ${
                        l.tipo === "receita" ? "border-success text-success" : 
                        l.tipo === "despesa" ? "border-destructive text-destructive" : 
                        "border-warning text-warning"
                      }`}>
                        {l.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      R$ {Number(l.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      {l.status === "pago" ? (
                        <Badge className="bg-success hover:bg-success/90">PAGO</Badge>
                      ) : isVencido ? (
                        <Badge variant="destructive">VENCIDO</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-warning text-warning-foreground hover:bg-warning/80">PENDENTE</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {l.status === "pendente" && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                            onClick={() => abrirBaixa(l)}
                          >
                            <CheckCircle2 size={16} />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => abrirEditar(l)}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (window.confirm("Excluir este lançamento?")) removeLancamento.mutate(l.id);
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal Lançamento */}
      <Dialog open={showLancamento} onOpenChange={fecharLancamento}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Lançamento" : `Nova ${tipo === 'receita' ? 'Receita' : 'Despesa'}`}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="desc">Descrição *</Label>
              <Input id="desc" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Mercado mensal" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="retirada">Retirada</SelectItem>
                    <SelectItem value="devolucao">Devolução</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias?.filter(c => c.tipo === tipo).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor *</Label>
                <Input 
                  id="valor" 
                  value={valor} 
                  onChange={e => setValor(e.target.value)} 
                  placeholder="0,00" 
                  type="text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data">Data Vencimento *</Label>
                <Input id="data" type="date" value={dataVenc} onChange={e => setDataVenc(e.target.value)} />
              </div>
            </div>
            {!editId && (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-secondary/20">
                <div className="space-y-0.5">
                  <Label className="text-sm">Lançamento Recorrente?</Label>
                  <p className="text-[11px] text-muted-foreground">Repetir automaticamente nos próximos meses.</p>
                </div>
                <Switch checked={recorrente} onCheckedChange={setRecorrente} />
              </div>
            )}
            {recorrente && !editId && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <Label htmlFor="meses">Repetir por quantos meses? (Máx 24)</Label>
                <Select value={mesesRecorrencia} onValueChange={setMesesRecorrencia}>
                  <SelectTrigger id="meses">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...Array(24)].map((_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1} {i === 0 ? 'mês' : 'meses'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={fecharLancamento}>Cancelar</Button>
            <Button onClick={() => saveLancamento.mutate()} disabled={saveLancamento.isPending || !desc || !valor}>
              {saveLancamento.isPending ? "Salvando..." : "Salvar Lançamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Baixa */}
      <Dialog open={showBaixa} onOpenChange={setShowBaixa}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Dar Baixa no Lançamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <div className="text-sm font-medium p-2 bg-secondary/30 rounded">{lancamentoParaBaixa?.descricao}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Pago</Label>
                <Input value={valorPago} onChange={e => setValorPago(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Data Pagamento</Label>
                <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBaixa(false)}>Cancelar</Button>
            <Button onClick={() => confirmBaixa.mutate()} className="bg-success hover:bg-success/90">
              {confirmBaixa.isPending ? "Processando..." : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Categorias */}
      <Dialog open={showCategorias} onOpenChange={setShowCategorias}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="bg-secondary/20 p-4 rounded-lg space-y-4">
              <h4 className="text-sm font-bold">Nova Categoria</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={catNome} onChange={e => setCatNome(e.target.value)} placeholder="Ex: Alimentação" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={catTipo} onValueChange={setCatTipo}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="retirada">Retirada</SelectItem>
                      <SelectItem value="devolucao">Devolução</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cor</Label>
                  <div className="flex gap-2">
                    <Input type="color" className="p-1 h-10 w-16" value={catCor} onChange={e => setCatCor(e.target.value)} />
                    <Input value={catCor} onChange={e => setCatCor(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-end">
                  <Button className="w-full" onClick={() => saveCategoria.mutate()} disabled={!catNome}>
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold">Categorias Existentes</h4>
              <div className="max-h-[250px] overflow-y-auto space-y-2 border rounded-lg p-2">
                {categorias?.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 hover:bg-secondary/30 rounded border border-transparent hover:border-border transition group">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: c.cor }} />
                      <div>
                        <p className="text-sm font-medium">{c.nome}</p>
                        <p className="text-[10px] uppercase text-muted-foreground">{c.tipo}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                      onClick={() => {
                        if (window.confirm("Excluir esta categoria?")) removeCategoria.mutate(c.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                {(!categorias || categorias.length === 0) && (
                  <p className="text-center py-6 text-sm text-muted-foreground">Nenhuma categoria cadastrada.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategorias(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinancasPessoais;