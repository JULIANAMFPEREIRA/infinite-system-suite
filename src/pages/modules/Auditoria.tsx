import { useState } from "react";
import { Shield, Filter, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

const acaoLabel: Record<string, string> = { criacao: "Criação", edicao: "Edição", exclusao: "Exclusão" };
const acaoColor: Record<string, string> = { criacao: "bg-success/15 text-success", edicao: "bg-warning/15 text-warning", exclusao: "bg-destructive/15 text-destructive" };

const tabelaLabel: Record<string, string> = {
  projetos: "Projetos", projeto_itens: "Itens do Projeto", financeiro_receber: "Financeiro Receber",
  financeiro_pagar: "Financeiro Pagar", compras: "Compras", comissoes: "Comissões",
  visitas_tecnicas: "Visitas Técnicas", contratos: "Contratos", clientes: "Clientes",
  crm_interacoes: "CRM Interações", crm_arquivos: "CRM Arquivos", crm_orcamentos: "Orçamentos",
  crm_itens: "Itens Orçamento", fornecedores: "Fornecedores", produtos: "Produtos",
  categorias: "Categorias", equipe: "Equipe", estoque_itens: "Estoque",
};

const Auditoria = () => {
  const empresaId = useEmpresa();
  const [filtroModulo, setFiltroModulo] = useState<string>("todos");
  const [filtroAcao, setFiltroAcao] = useState<string>("todos");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit_logs", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles_audit", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").eq("empresa_id", empresaId!);
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const profileMap = new Map(profiles?.map(p => [p.id, p.full_name ?? "Sem nome"]) ?? []);
  const modulosUnicos = [...new Set(logs?.map(l => l.tabela) ?? [])].sort();

  const filteredLogs = logs?.filter(l => {
    if (filtroModulo !== "todos" && l.tabela !== filtroModulo) return false;
    if (filtroAcao !== "todos" && l.acao !== filtroAcao) return false;
    if (filtroUsuario && filtroUsuario !== "todos" && l.usuario_id !== filtroUsuario) return false;
    if (dataInicio) {
      const logDate = new Date(l.created_at);
      if (logDate < dataInicio) return false;
    }
    if (dataFim) {
      const logDate = new Date(l.created_at);
      const fim = new Date(dataFim);
      fim.setHours(23, 59, 59, 999);
      if (logDate > fim) return false;
    }
    return true;
  });

  const hasFilters = filtroModulo !== "todos" || filtroAcao !== "todos" || filtroUsuario !== "" || dataInicio || dataFim;

  const clearFilters = () => {
    setFiltroModulo("todos");
    setFiltroAcao("todos");
    setFiltroUsuario("");
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Shield size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Logs e Auditoria</h1>
        {filteredLogs && <span className="text-xs text-muted-foreground ml-2">({filteredLogs.length} registros)</span>}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
        <Filter size={14} className="text-muted-foreground mb-2" />

        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">Módulo</label>
          <Select value={filtroModulo} onValueChange={setFiltroModulo}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {modulosUnicos.map(m => (
                <SelectItem key={m} value={m}>{tabelaLabel[m] ?? m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">Ação</label>
          <Select value={filtroAcao} onValueChange={setFiltroAcao}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="criacao">Criação</SelectItem>
              <SelectItem value="edicao">Edição</SelectItem>
              <SelectItem value="exclusao">Exclusão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">Usuário</label>
          <Select value={filtroUsuario || "todos"} onValueChange={v => setFiltroUsuario(v === "todos" ? "" : v)}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {profiles?.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.full_name ?? "Sem nome"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">De</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[130px] h-8 text-xs justify-start", !dataInicio && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3 w-3" />
                {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "Início"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground font-medium">Até</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[130px] h-8 text-xs justify-start", !dataFim && "text-muted-foreground")}>
                <CalendarIcon className="mr-1 h-3 w-3" />
                {dataFim ? format(dataFim, "dd/MM/yyyy") : "Fim"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dataFim} onSelect={setDataFim} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={clearFilters}>
            <X size={12} /> Limpar
          </Button>
        )}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p>
      ) : !filteredLogs?.length ? (
        <p className="text-center py-8 text-xs text-muted-foreground">Nenhum log encontrado.</p>
      ) : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-secondary/60">
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Data/Hora</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Usuário</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Módulo</th>
                <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ação</th>
                <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Registro</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(l => (
                <tr key={l.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                  <td className="px-2.5 py-1.5 text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-2.5 py-1.5 font-medium">{profileMap.get(l.usuario_id ?? "") ?? "Sistema"}</td>
                  <td className="px-2.5 py-1.5">{tabelaLabel[l.tabela] ?? l.tabela}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${acaoColor[l.acao] ?? ""}`}>
                      {acaoLabel[l.acao] ?? l.acao}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 text-muted-foreground font-mono text-[10px]">{l.registro_id?.slice(0, 8) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Auditoria;
