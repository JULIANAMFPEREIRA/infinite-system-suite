import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Wallet, MessageCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const fmt = (v: number) => `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const pagamentoSchema = z.object({
  projeto_parceiro_id: z.string().uuid({ message: "Selecione um parceiro" }),
  valor: z.number().positive({ message: "Valor deve ser maior que zero" }).max(99999999, { message: "Valor inválido" }),
  data: z.string().min(1, { message: "Data obrigatória" }),
  observacao: z.string().max(500, { message: "Observação muito longa" }).optional(),
});

interface Props {
  projetoId: string;
}

export const PagamentosRTSection = ({ projetoId }: Props) => {
  const empresaId = useEmpresa();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openModal, setOpenModal] = useState(false);
  const [form, setForm] = useState({
    projeto_parceiro_id: "",
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    observacao: "",
  });

  // Vínculos do projeto (parceiros + RT)
  const { data: vinculos = [] } = useQuery({
    queryKey: ["pp_rt_vinculos", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projeto_parceiros")
        .select("id, parceiro_id, rt_total, rt_recebido, fornecedores(id, nome, subtipo_parceiro)")
        .eq("projeto_id", projetoId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projetoId,
  });

  // Histórico de pagamentos do projeto
  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos_rt_projeto", projetoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos_rt")
        .select("id, valor, data, observacao, parceiro_id, projeto_parceiro_id, fornecedores(nome)")
        .eq("projeto_id", projetoId)
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projetoId,
  });

  // Logs de WhatsApp para os pagamentos deste projeto
  const pagamentoIds = pagamentos.map((p: any) => p.id);
  const { data: waLogs = [] } = useQuery({
    queryKey: ["whatsapp_logs_projeto", projetoId, pagamentoIds.join(",")],
    queryFn: async () => {
      if (pagamentoIds.length === 0) return [];
      const { data, error } = await (supabase as any)
        .from("whatsapp_logs")
        .select("id, data, status, telefone, erro, parceiro_id, fornecedores:parceiro_id(nome)")
        .in("pagamento_rt_id", pagamentoIds)
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: pagamentoIds.length > 0,
  });

  const createPagamento = useMutation({
    mutationFn: async () => {
      const valorNum = Number(form.valor);
      const parsed = pagamentoSchema.safeParse({
        projeto_parceiro_id: form.projeto_parceiro_id,
        valor: valorNum,
        data: form.data,
        observacao: form.observacao || undefined,
      });
      if (!parsed.success) {
        const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
        throw new Error(first ?? "Dados inválidos");
      }
      const vinculo = vinculos.find((v: any) => v.id === form.projeto_parceiro_id);
      if (!vinculo) throw new Error("Vínculo não encontrado");

      const { error } = await supabase.from("pagamentos_rt").insert({
        empresa_id: empresaId!,
        projeto_parceiro_id: form.projeto_parceiro_id,
        projeto_id: projetoId,
        parceiro_id: (vinculo as any).parceiro_id,
        valor: valorNum,
        data: form.data,
        observacao: form.observacao ? form.observacao.toUpperCase() : null,
        usuario_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento de RT registrado");
      qc.invalidateQueries({ queryKey: ["pagamentos_rt_projeto", projetoId] });
      qc.invalidateQueries({ queryKey: ["pp_rt_vinculos", projetoId] });
      qc.invalidateQueries({ queryKey: ["projeto_parceiros"] });
      qc.invalidateQueries({ queryKey: ["parceiro_projetos"] });
      qc.invalidateQueries({ queryKey: ["portal_parceiro_full"] });
      setOpenModal(false);
      setForm({ projeto_parceiro_id: "", valor: "", data: new Date().toISOString().slice(0, 10), observacao: "" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar pagamento"),
  });

  const removePagamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pagamentos_rt").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento removido");
      qc.invalidateQueries({ queryKey: ["pagamentos_rt_projeto", projetoId] });
      qc.invalidateQueries({ queryKey: ["pp_rt_vinculos", projetoId] });
      qc.invalidateQueries({ queryKey: ["projeto_parceiros"] });
      qc.invalidateQueries({ queryKey: ["parceiro_projetos"] });
      qc.invalidateQueries({ queryKey: ["portal_parceiro_full"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Pagamentos de RT (Parceiros)</h3>
        </div>
        <Button size="sm" onClick={() => setOpenModal(true)} disabled={vinculos.length === 0}>
          <Plus size={14} className="mr-1" /> Lançar pagamento de RT
        </Button>
      </div>

      {vinculos.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center bg-secondary/30 rounded">
          Nenhum parceiro vinculado a este projeto. Vincule pela tela de Parceiros.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {vinculos.map((v: any) => {
            const total = Number(v.rt_total ?? 0);
            const rec = Number(v.rt_recebido ?? 0);
            const pen = total - rec;
            const pct = total > 0 ? Math.round((rec / total) * 100) : 0;
            return (
              <div key={v.id} className="bg-card border border-border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">{v.fornecedores?.nome}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{v.fornecedores?.subtipo_parceiro}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div><p className="text-[9px] uppercase text-muted-foreground">Total</p><p className="font-semibold">{fmt(total)}</p></div>
                  <div><p className="text-[9px] uppercase text-muted-foreground">Recebido</p><p className="font-semibold text-success">{fmt(rec)}</p></div>
                  <div><p className="text-[9px] uppercase text-muted-foreground">Pendente</p><p className="font-semibold text-warning">{fmt(pen)}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-9 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h4 className="text-xs font-semibold text-foreground mb-2">Histórico de pagamentos</h4>
        {pagamentos.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">Nenhum pagamento registrado.</p>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="text-left px-2.5 py-1.5 font-semibold">Data</th>
                  <th className="text-left px-2.5 py-1.5 font-semibold">Parceiro</th>
                  <th className="text-left px-2.5 py-1.5 font-semibold">Observação</th>
                  <th className="text-right px-2.5 py-1.5 font-semibold">Valor</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {pagamentos.map((p: any) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-2.5 py-1.5">{new Date(p.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                    <td className="px-2.5 py-1.5">{p.fornecedores?.nome ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">{p.observacao || "—"}</td>
                    <td className="px-2.5 py-1.5 text-right font-medium text-success">{fmt(Number(p.valor) || 0)}</td>
                    <td className="px-1.5 py-1.5 text-center">
                      <button
                        onClick={() => {
                          if (confirm("Remover este pagamento?")) removePagamento.mutate(p.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remover"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <MessageCircle size={12} /> Notificações WhatsApp
        </h4>
        {waLogs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">Nenhuma notificação enviada.</p>
        ) : (
          <div className="border border-border rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-secondary/60">
                <tr>
                  <th className="text-left px-2.5 py-1.5 font-semibold">Data</th>
                  <th className="text-left px-2.5 py-1.5 font-semibold">Parceiro</th>
                  <th className="text-left px-2.5 py-1.5 font-semibold">Telefone</th>
                  <th className="text-left px-2.5 py-1.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {waLogs.map((l: any) => {
                  const ok = l.status === "enviado";
                  const sim = l.status === "simulado";
                  const Icon = ok ? CheckCircle2 : AlertCircle;
                  const color = ok ? "text-success" : sim ? "text-muted-foreground" : "text-destructive";
                  const label = ok ? "Enviado" : sim ? "Simulado (sem provedor)" : l.status === "sem_telefone" ? "Sem telefone" : "Erro";
                  return (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-2.5 py-1.5">{new Date(l.data).toLocaleString("pt-BR")}</td>
                      <td className="px-2.5 py-1.5">{l.fornecedores?.nome ?? "—"}</td>
                      <td className="px-2.5 py-1.5 text-muted-foreground">{l.telefone || "—"}</td>
                      <td className={`px-2.5 py-1.5 ${color}`} title={l.erro || ""}>
                        <span className="inline-flex items-center gap-1"><Icon size={11} />{label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Lançar pagamento de RT</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Parceiro *</label>
              <select
                value={form.projeto_parceiro_id}
                onChange={(e) => setForm({ ...form, projeto_parceiro_id: e.target.value })}
                className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
              >
                <option value="">Selecione…</option>
                {vinculos.map((v: any) => {
                  const pen = Number(v.rt_total ?? 0) - Number(v.rt_recebido ?? 0);
                  return (
                    <option key={v.id} value={v.id}>
                      {v.fornecedores?.nome} — pendente {fmt(pen)}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium">Valor (R$) *</label>
                <input
                  type="number" step="0.01" min="0"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Data *</label>
                <input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                  className="w-full h-9 px-2 mt-1 rounded border border-border bg-background text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Observação</label>
              <textarea
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                maxLength={500}
                className="w-full min-h-[60px] p-2 mt-1 rounded border border-border bg-background text-sm resize-none"
                placeholder="Opcional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(false)} disabled={createPagamento.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => createPagamento.mutate()} disabled={createPagamento.isPending}>
              {createPagamento.isPending ? "Salvando…" : "Salvar pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};