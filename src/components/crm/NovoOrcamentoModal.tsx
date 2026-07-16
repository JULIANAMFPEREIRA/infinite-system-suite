import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Search } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const NovoOrcamentoModal = ({ open, onOpenChange }: Props) => {
  const empresaId = useEmpresa();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: clientes } = useQuery({
    queryKey: ["clientes-novo-orcamento", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nome, telefone, email, cpf_cnpj, status_crm")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
        .order("nome");
      return data ?? [];
    },
    enabled: !!empresaId && open,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes ?? [];
    return (clientes ?? []).filter((c: any) =>
      [c.nome, c.telefone, c.email, c.cpf_cnpj].some(v => (v ?? "").toString().toLowerCase().includes(q))
    );
  }, [clientes, search]);

  const handleConfirm = () => {
    if (!selectedId) return;
    onOpenChange(false);
    setSelectedId(null);
    setSearch("");
    navigate(`/crm?cliente_id=${selectedId}&new_orcamento=1`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Novo Orçamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente por nome, telefone, e-mail, CPF/CNPJ..."
              className="w-full h-8 pl-7 pr-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="max-h-72 overflow-y-auto border border-border rounded divide-y divide-border">
            {filtered.length === 0 && (
              <div className="text-[11px] text-muted-foreground p-3 text-center italic">Nenhum cliente encontrado</div>
            )}
            {filtered.map((c: any) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-2.5 py-2 text-xs hover:bg-secondary/60 transition ${selectedId === c.id ? "bg-primary/10 text-primary" : ""}`}
              >
                <div className="font-medium">{c.nome}</div>
                <div className="text-[10px] text-muted-foreground">
                  {[c.telefone, c.email].filter(Boolean).join(" • ")}
                </div>
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-3 py-1.5 text-xs rounded bg-secondary hover:brightness-105">Cancelar</button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Iniciar Orçamento
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};