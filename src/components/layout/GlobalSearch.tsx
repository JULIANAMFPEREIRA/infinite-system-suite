import { useState, useEffect, useRef } from "react";
import { Search, User, FileText, FolderOpen, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  label: string;
  sub?: string;
  type: "cliente" | "orcamento" | "projeto";
}

const GlobalSearch = () => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const empresaId = useEmpresa();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim() || !empresaId) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = query.trim().toLowerCase();
      const [clientes, orcamentos, projetos] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nome, telefone, email")
          .eq("empresa_id", empresaId)
          .eq("deletado", false)
          .or(`nome.ilike.%${q}%,telefone.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(5),
        supabase
          .from("crm_orcamentos")
          .select("id, nome, cliente_id, cliente_nome_avulso, is_avulso, clientes(nome)")
          .eq("empresa_id", empresaId)
          .or(`nome.ilike.%${q}%,cliente_nome_avulso.ilike.%${q}%`)
          .limit(5),
        supabase
          .from("projetos")
          .select("id, nome, clientes(nome)")
          .eq("empresa_id", empresaId)
          .eq("deletado", false)
          .ilike("nome", `%${q}%`)
          .limit(5),
      ]);

      const mapped: SearchResult[] = [];

      (clientes.data ?? []).forEach(c =>
        mapped.push({ id: c.id, label: c.nome, sub: c.telefone ?? c.email ?? undefined, type: "cliente" })
      );

      (orcamentos.data ?? []).forEach(o => {
        const clienteNome = o.is_avulso ? o.cliente_nome_avulso : (o.clientes as any)?.nome;
        mapped.push({ id: o.id, label: o.nome, sub: clienteNome ?? undefined, type: "orcamento" });
      });

      (projetos.data ?? []).forEach(p =>
        mapped.push({ id: p.id, label: p.nome, sub: (p.clientes as any)?.nome ?? undefined, type: "projeto" })
      );

      // Also search orcamentos by client name
      if (clientes.data?.length) {
        // already covered via client search
      }

      // Also search projetos by client name
      const projByClient = await supabase
        .from("projetos")
        .select("id, nome, clientes(nome)")
        .eq("empresa_id", empresaId)
        .eq("deletado", false)
        .limit(5);
      
      (projByClient.data ?? []).forEach(p => {
        const cn = (p.clientes as any)?.nome ?? "";
        if (cn.toLowerCase().includes(q) && !mapped.find(m => m.id === p.id)) {
          mapped.push({ id: p.id, label: p.nome, sub: cn, type: "projeto" });
        }
      });

      setResults(mapped);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, empresaId]);

  const handleSelect = (r: SearchResult) => {
    setOpen(false);
    setQuery("");
    if (r.type === "cliente") navigate("/crm");
    else if (r.type === "orcamento") navigate("/orcamentos");
    else if (r.type === "projeto") navigate(`/projetos/${r.id}`);
  };

  const grouped = {
    cliente: results.filter(r => r.type === "cliente"),
    orcamento: results.filter(r => r.type === "orcamento"),
    projeto: results.filter(r => r.type === "projeto"),
  };

  const icons = {
    cliente: <User size={14} className="text-primary shrink-0" />,
    orcamento: <FileText size={14} className="text-primary shrink-0" />,
    projeto: <FolderOpen size={14} className="text-primary shrink-0" />,
  };

  const labels = {
    cliente: "CLIENTES",
    orcamento: "ORÇAMENTOS",
    projeto: "PROJETOS",
  };

  return (
    <div ref={ref} className="relative hidden md:block">
      <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-md px-3 py-1.5 w-64 lg:w-80 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary transition-all">
        <Search size={14} className="text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => query.trim() && setOpen(true)}
          placeholder="Buscar cliente, orçamento ou projeto..."
          className="bg-transparent text-xs w-full outline-none placeholder:text-muted-foreground text-foreground"
        />
        {query && (
          <button onClick={() => { setQuery(""); setResults([]); }} className="text-muted-foreground hover:text-foreground">
            <X size={12} />
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div className="absolute top-full mt-1 left-0 w-full min-w-[320px] bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
          {loading ? (
            <div className="px-4 py-3 text-xs text-muted-foreground text-center">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground text-center">Nenhum resultado encontrado.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {(["cliente", "orcamento", "projeto"] as const).map(type =>
                grouped[type].length > 0 && (
                  <div key={type}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground bg-muted/50 uppercase tracking-wider">
                      {labels[type]}
                    </div>
                    {grouped[type].map(r => (
                      <button
                        key={r.id}
                        onClick={() => handleSelect(r)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
                      >
                        {icons[type]}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{r.label}</p>
                          {r.sub && <p className="text-[10px] text-muted-foreground truncate">{r.sub}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearch;
