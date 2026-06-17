import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { calcOrcamentoTotals } from "@/lib/orcamentoCalc";
import { useFormasPagamento } from "@/hooks/useCategorias";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";

interface Orc {
  id: string;
  nome: string | null;
  aprovado?: boolean | null;
  frete?: number | null;
  imposto?: number | null;
  simulacao_pagamento?: any;
  grupo_id?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  cliente: { id: string; nome: string | null };
  empresaId: string;
  orcamentos: Orc[];
  /** Called after success so parent can refetch / invalidate */
  onSuccess: () => void;
  /** Existing project sync helper — reused, not modified */
  syncOrcamentoToProject: (orcId: string, opts?: { showToast?: boolean }) => Promise<void>;
}

export default function AprovarConjuntoModal({
  open,
  onClose,
  cliente,
  empresaId,
  orcamentos,
  onSuccess,
  syncOrcamentoToProject,
}: Props) {
  const qc = useQueryClient();
  const { data: formasPgto } = useFormasPagamento();

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [condicao, setCondicao] = useState<"vista" | "parcelado">("parcelado");
  const [numParcelas, setNumParcelas] = useState(3);
  const [primeiraData, setPrimeiraData] = useState(() => new Date().toISOString().slice(0, 10));
  const [intervaloDias, setIntervaloDias] = useState(30);
  const [formaPgto, setFormaPgto] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [parcelaDates, setParcelaDates] = useState<string[]>([]);

  // Pre-select all when opening
  useEffect(() => {
    if (open) {
      const ini: Record<string, boolean> = {};
      orcamentos.forEach(o => { ini[o.id] = true; });
      setSelected(ini);
    }
  }, [open, orcamentos]);

  // Fetch items for all candidate orcamentos at once
  const orcIds = orcamentos.map(o => o.id);
  const { data: itensAll } = useQuery({
    queryKey: ["crm_itens_conjunto", cliente.id, orcIds.join(",")],
    enabled: open && orcIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_itens")
        .select("orcamento_id, quantidade, preco_venda, preco_custo, rt_comissao")
        .in("orcamento_id", orcIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totaisPorOrc = useMemo(() => {
    const map: Record<string, number> = {};
    orcamentos.forEach(o => {
      const itens = (itensAll ?? []).filter((i: any) => i.orcamento_id === o.id);
      const totals = calcOrcamentoTotals({
        itens: itens as any,
        frete: o.frete ?? 0,
        imposto: o.imposto ?? 0,
        simulacao_pagamento: o.simulacao_pagamento ?? null,
      });
      map[o.id] = totals.totalVenda;
    });
    return map;
  }, [orcamentos, itensAll]);

  const totalCombinado = useMemo(
    () => orcamentos.reduce((s, o) => s + (selected[o.id] ? (totaisPorOrc[o.id] ?? 0) : 0), 0),
    [orcamentos, selected, totaisPorOrc],
  );

  const selectedIds = orcamentos.filter(o => selected[o.id]).map(o => o.id);

  const toggle = (id: string) => setSelected(s => ({ ...s, [id]: !s[id] }));

  const computedParcelas = useMemo<{ valor: number; data: string }[]>(() => {
    if (totalCombinado <= 0) return [];
    const n = condicao === "vista" ? 1 : Math.max(1, Math.floor(numParcelas));
    const base = Number((totalCombinado / n).toFixed(2));
    const ultimoAjuste = Number((totalCombinado - base * (n - 1)).toFixed(2));
    const start = new Date(primeiraData + "T00:00:00");
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i * intervaloDias);
      return {
        valor: i === n - 1 ? ultimoAjuste : base,
        data: d.toISOString().slice(0, 10),
      };
    });
  }, [totalCombinado, condicao, numParcelas, primeiraData, intervaloDias]);

  // Reset per-parcela dates whenever the structural inputs change
  useEffect(() => {
    setParcelaDates(computedParcelas.map(p => p.data));
  }, [computedParcelas]);

  const updateParcelaDate = (idx: number, value: string) => {
    setParcelaDates(prev => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedIds.length < 2) {
      toast.error("Selecione pelo menos 2 orçamentos.");
      return;
    }
    if (totalCombinado <= 0) {
      toast.error("Total combinado é zero.");
      return;
    }
    setSubmitting(true);
    try {
      // 1. Garante que o primeiro orçamento tenha projeto vinculado
      const firstOrcId = selectedIds[0];
      const firstOrc = orcamentos.find(o => o.id === firstOrcId)!;
      if (!firstOrc.aprovado) {
        await syncOrcamentoToProject(firstOrcId, { showToast: false });
      }
      const { data: projLink } = await supabase
        .from("projetos")
        .select("id")
        .eq("orcamento_id", firstOrcId)
        .maybeSingle();
      const projetoId = projLink?.id ?? null;
      if (!projetoId) {
        toast.error("Não foi possível identificar o projeto vinculado.");
        setSubmitting(false);
        return;
      }

      // 2. Marca orçamentos selecionados como aprovados sem alterar grupo_id
      const { error: updErr } = await (supabase as any)
        .from("crm_orcamentos")
        .update({ aprovado: true })
        .in("id", selectedIds);
      if (updErr) throw updErr;

      // 3. Apaga parcelas pendentes (preserva pago/parcial)
      const { data: existentes } = await supabase
        .from("financeiro_receber")
        .select("id, status")
        .eq("projeto_id", projetoId);
      const idsApagar = (existentes ?? [])
        .filter((p: any) => p.status === "pendente" || p.status === null)
        .map((p: any) => p.id);
      if (idsApagar.length > 0) {
        await supabase.from("financeiro_receber").delete().in("id", idsApagar);
      }

      // 4. Gera parcelas combinadas (datas individuais editadas pelo usuário)
      const parcelas = computedParcelas.map((p, i) => ({
        valor: p.valor,
        data: parcelaDates[i] ?? p.data,
      }));
      const sufixo = formaPgto ? ` (Conjunto - ${formaPgto})` : " (Conjunto)";
      const inserts = parcelas.map((p, i) => ({
        empresa_id: empresaId,
        projeto_id: projetoId,
        cliente_id: cliente.id,
        descricao: `Parcela ${i + 1}/${parcelas.length} — ${cliente.nome ?? "Cliente"}${sufixo}`,
        valor: p.valor,
        parcela: i + 1,
        data_vencimento: p.data,
        status: "pendente" as const,
      }));
      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from("financeiro_receber").insert(inserts);
        if (insErr) throw insErr;
      }

      toast.success(`Aprovação em conjunto concluída — ${parcelas.length} parcela(s) gerada(s).`);
      qc.invalidateQueries({ queryKey: ["financeiro_receber"] });
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["crm_orcamentos"] });
      qc.invalidateQueries({ queryKey: ["all_crm_orcamentos"] });
      onSuccess();
      onClose();
    } catch (e: any) {
      console.error("[AprovarConjunto] erro:", e);
      toast.error("Erro na aprovação em conjunto: " + (e?.message ?? "desconhecido"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Link2 size={14} className="text-secondary-foreground" />
            Aprovar Orçamentos em Conjunto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-[12px]">
          {/* Lista de orçamentos */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Orçamentos disponíveis
            </p>
            <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
              {orcamentos.map(o => (
                <label
                  key={o.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-secondary/20 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={!!selected[o.id]}
                      onChange={() => toggle(o.id)}
                      className="accent-primary"
                    />
                    <span className="truncate">{o.nome ?? "Orçamento"}</span>
                    {o.aprovado && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/15 text-success font-bold uppercase shrink-0">
                        Aprovado
                      </span>
                    )}
                    {o.grupo_id && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-bold uppercase shrink-0">
                        Grupo
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-primary">
                    R$ {(totaisPorOrc[o.id] ?? 0).toFixed(2)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Total Combinado
            </span>
            <span className="text-lg font-bold text-primary">
              R$ {totalCombinado.toFixed(2)}
            </span>
          </div>

          {/* Condições */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Condição</label>
              <select
                value={condicao}
                onChange={e => setCondicao(e.target.value as any)}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12px]"
              >
                <option value="vista">À Vista</option>
                <option value="parcelado">Parcelado</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Forma de Pagamento</label>
              <select
                value={formaPgto}
                onChange={e => setFormaPgto(e.target.value)}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12px]"
              >
                <option value="">—</option>
                {(formasPgto ?? []).map((f: any) => (
                  <option key={f.id} value={f.nome}>{f.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Nº Parcelas
              </label>
              <input
                type="number"
                min={1}
                value={numParcelas}
                onChange={e => setNumParcelas(Number(e.target.value) || 1)}
                disabled={condicao === "vista"}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12px] disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Intervalo (dias)
              </label>
              <input
                type="number"
                min={1}
                value={intervaloDias}
                onChange={e => setIntervaloDias(Number(e.target.value) || 30)}
                disabled={condicao === "vista"}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12px] disabled:opacity-50"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Data da Primeira Parcela
              </label>
              <input
                type="date"
                value={primeiraData}
                onChange={e => setPrimeiraData(e.target.value)}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="h-8 px-3 rounded bg-secondary text-secondary-foreground text-[12px] font-medium hover:bg-secondary/80"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || selectedIds.length < 2}
            className="h-8 px-3 rounded bg-primary text-primary-foreground text-[12px] font-medium hover:brightness-110 disabled:opacity-50 flex items-center gap-1"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            Aprovar e Gerar Financeiro
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}