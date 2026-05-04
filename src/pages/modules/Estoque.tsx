import { useState } from "react";
import { Package, BookOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type StatusEstoque = Database["public"]["Enums"]["status_estoque"];

const Estoque = () => {
  const empresaId = useEmpresa();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"catalogo" | "fisico">("catalogo");

  // Product form
  const [showProdForm, setShowProdForm] = useState(false);
  const [editProdId, setEditProdId] = useState<string | null>(null);
  const [pNome, setPNome] = useState("");
  const [pCodigo, setPCodigo] = useState("");
  const [pCategoria, setPCategoria] = useState("");
  const [pMarca, setPMarca] = useState("");
  const [pCusto, setPCusto] = useState(0);
  const [pVenda, setPVenda] = useState(0);
  const [pEstMin, setPEstMin] = useState(0);
  const [pFornecedorId, setPFornecedorId] = useState("");

  // Estoque item form
  const [showEstForm, setShowEstForm] = useState(false);
  const [editEstId, setEditEstId] = useState<string | null>(null);
  const [eProdutoId, setEProdutoId] = useState("");
  const [eNumSerie, setENumSerie] = useState("");
  const [eLocal, setELocal] = useState("");
  const [eStatus, setEStatus] = useState<StatusEstoque>("disponivel");

  const { data: produtos, isLoading: loadingProd } = useQuery({
    queryKey: ["produtos", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("deletado", false)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome, tipo")
        .eq("deletado", false)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: estoqueItens, isLoading: loadingEst } = useQuery({
    queryKey: ["estoque_itens", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_itens")
        .select("*, produtos(nome), projetos(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  // Product CRUD
  const resetProdForm = () => {
    setPNome(""); setPCodigo(""); setPCategoria(""); setPMarca("");
    setPCusto(0); setPVenda(0); setPEstMin(0); setPFornecedorId("");
    setEditProdId(null); setShowProdForm(false);
  };
  const openEditProd = (p: any) => {
    setEditProdId(p.id); setPNome(p.nome); setPCodigo(p.codigo ?? "");
    setPCategoria(p.categoria ?? ""); setPMarca(p.marca ?? "");
    setPCusto(p.preco_custo ?? 0); setPVenda(p.preco_venda ?? 0);
    setPEstMin(p.estoque_minimo ?? 0); setPFornecedorId(p.fornecedor_id ?? "");
    setShowProdForm(true);
  };

  const saveProd = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: pNome,
        codigo: pCodigo || null,
        categoria: pCategoria || null,
        marca: pMarca || null,
        preco_custo: pCusto,
        preco_venda: pVenda,
        estoque_minimo: pEstMin,
        fornecedor_id: pFornecedorId || null,
      };
      if (editProdId) {
        const { error } = await supabase.from("produtos").update(payload).eq("id", editProdId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produtos").insert({ ...payload, empresa_id: empresaId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["produtos"] }); toast.success(editProdId ? "Produto atualizado" : "Produto criado"); resetProdForm(); },
    onError: (err: any) => toast.error(err.message),
  });

  const removeProd = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("produtos").update({ deletado: true } as any).eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["produtos"] }); toast.success("Produto excluído"); },
    onError: (err: any) => toast.error(err.message),
  });

  // Estoque item CRUD
  const resetEstForm = () => { setEProdutoId(""); setENumSerie(""); setELocal(""); setEStatus("disponivel"); setEditEstId(null); setShowEstForm(false); };
  const openEditEst = (e: any) => { setEditEstId(e.id); setEProdutoId(e.produto_id); setENumSerie(e.numero_serie ?? ""); setELocal(e.localizacao ?? ""); setEStatus(e.status ?? "disponivel"); setShowEstForm(true); };

  const saveEst = useMutation({
    mutationFn: async () => {
      const payload = { numero_serie: eNumSerie || null, localizacao: eLocal || null, status: eStatus };
      if (editEstId) { const { error } = await supabase.from("estoque_itens").update(payload).eq("id", editEstId); if (error) throw error; }
      else { const { error } = await supabase.from("estoque_itens").insert({ ...payload, empresa_id: empresaId!, produto_id: eProdutoId }); if (error) throw error; }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estoque_itens"] }); toast.success(editEstId ? "Item atualizado" : "Item adicionado"); resetEstForm(); },
    onError: (err: any) => toast.error(err.message),
  });

  const removeEst = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("estoque_itens").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["estoque_itens"] }); toast.success("Item excluído"); },
    onError: (err: any) => toast.error(err.message),
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
        <>
          <div className="flex justify-end">
            <button onClick={() => { resetProdForm(); setShowProdForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
              <Plus size={14} /> Novo Produto
            </button>
          </div>
          {showProdForm && (
            <div className="bg-card border border-border rounded p-3 space-y-3">
              <h2 className="text-xs font-semibold text-foreground">{editProdId ? "Editar" : "Novo"} Produto</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Nome *</label><input value={pNome} onChange={e => setPNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Código</label><input value={pCodigo} onChange={e => setPCodigo(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Categoria</label><input value={pCategoria} onChange={e => setPCategoria(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Marca</label><input value={pMarca} onChange={e => setPMarca(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Fornecedor</label>
                  <select value={pFornecedorId} onChange={e => setPFornecedorId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                    <option value="">Selecionar...</option>
                    {fornecedores?.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Preço Custo</label><input type="number" value={pCusto} onChange={e => setPCusto(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Preço Venda</label><input type="number" value={pVenda} onChange={e => setPVenda(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Est. Mín.</label><input type="number" value={pEstMin} onChange={e => setPEstMin(Number(e.target.value))} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveProd.mutate()} disabled={saveProd.isPending || !pNome.trim()} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
                <button onClick={resetProdForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80">Cancelar</button>
              </div>
            </div>
          )}
          {loadingProd ? <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p> : (
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-secondary/60">
                    <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Código</th>
                    <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Produto</th>
                    <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Categoria</th>
                    <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Marca</th>
                    <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Fornecedor</th>
                    <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Custo</th>
                    <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Venda</th>
                    <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos?.map(p => (
                    <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => openEditProd(p)}>
                      <td className="px-2.5 py-1.5">{p.codigo ?? "—"}</td>
                      <td className="px-2.5 py-1.5 font-medium">{p.nome}</td>
                      <td className="px-2.5 py-1.5">{p.categoria ?? "—"}</td>
                      <td className="px-2.5 py-1.5">{p.marca ?? "—"}</td>
                      <td className="px-2.5 py-1.5">{fornecedores?.find(f => f.id === p.fornecedor_id)?.nome ?? "—"}</td>
                      <td className="px-2.5 py-1.5 text-right">R$ {(p.preco_custo ?? 0).toLocaleString("pt-BR")}</td>
                      <td className="px-2.5 py-1.5 text-right">R$ {(p.preco_venda ?? 0).toLocaleString("pt-BR")}</td>
                      <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditProd(p)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                          <button onClick={() => { if (window.confirm("Excluir produto?")) removeProd.mutate(p.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!produtos || produtos.length === 0) && <tr><td colSpan={8} className="text-center py-4 text-muted-foreground">Nenhum produto cadastrado.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <button onClick={() => { resetEstForm(); setShowEstForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
              <Plus size={14} /> Novo Item
            </button>
          </div>
          {showEstForm && (
            <div className="bg-card border border-border rounded p-3 space-y-3">
              <h2 className="text-xs font-semibold text-foreground">{editEstId ? "Editar" : "Novo"} Item de Estoque</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {!editEstId && (
                  <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Produto *</label>
                    <select value={eProdutoId} onChange={e => setEProdutoId(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                      <option value="">Selecionar...</option>
                      {produtos?.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                )}
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Nº Série</label><input value={eNumSerie} onChange={e => setENumSerie(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Local</label><input value={eLocal} onChange={e => setELocal(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
                <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Status</label>
                  <select value={eStatus} onChange={e => setEStatus(e.target.value as StatusEstoque)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none">
                    <option value="disponivel">Disponível</option>
                    <option value="reservado">Reservado</option>
                    <option value="instalado">Instalado</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveEst.mutate()} disabled={saveEst.isPending || (!editEstId && !eProdutoId)} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
                <button onClick={resetEstForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80">Cancelar</button>
              </div>
            </div>
          )}
          {loadingEst ? <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p> : (
            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-secondary/60">
                    <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Produto</th>
                    <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nº Série</th>
                    <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Local</th>
                    <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
                    <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Projeto</th>
                    <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {estoqueItens?.map(e => (
                    <tr key={e.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => openEditEst(e)}>
                      <td className="px-2.5 py-1.5 font-medium">{(e.produtos as any)?.nome ?? "—"}</td>
                      <td className="px-2.5 py-1.5">{e.numero_serie ?? "—"}</td>
                      <td className="px-2.5 py-1.5">{e.localizacao ?? "—"}</td>
                      <td className="px-2.5 py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColor(e.status ?? "disponivel")}`}>{statusLabel(e.status ?? "disponivel")}</span>
                      </td>
                      <td className="px-2.5 py-1.5">{(e.projetos as any)?.nome ?? "—"}</td>
                      <td className="px-2.5 py-1.5 text-center" onClick={ev => ev.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditEst(e)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                          <button onClick={() => { if (window.confirm("Excluir item?")) removeEst.mutate(e.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!estoqueItens || estoqueItens.length === 0) && <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhum item no estoque.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Estoque;
