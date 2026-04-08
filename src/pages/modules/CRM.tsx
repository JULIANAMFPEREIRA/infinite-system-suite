import { useState } from "react";
import { Users, Plus, Pencil, Trash2, Eye, ArrowLeft, MessageSquare, FileText, ShoppingBag, Package } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useCreateProjeto, useCreateProjetoItem, useArquitetos } from "@/hooks/useProjetos";
import { useContratos } from "@/hooks/useContratos";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type StatusCRM = Database["public"]["Enums"]["status_crm"];
type OrigemLead = Database["public"]["Enums"]["origem_lead"];

const statusLabels: Record<StatusCRM, string> = { lead: "Lead", contato: "Em Contato", proposta: "Proposta Enviada", projeto: "Projeto" };
const statusColors: Record<StatusCRM, string> = { lead: "bg-secondary text-secondary-foreground", contato: "bg-warning/15 text-warning", proposta: "bg-primary/15 text-primary", projeto: "bg-success/15 text-success" };
const origemLabels: Record<OrigemLead, string> = { whatsapp: "WhatsApp", instagram: "Instagram", indicacao: "Indicação", arquiteto: "Arquiteto", outro: "Outro" };

/* ─── Main Component ─── */
const CRM = () => {
  const empresaId = useEmpresa();
  const { user } = useAuth();
  const qc = useQueryClient();
  const createProjeto = useCreateProjeto();
  const createProjetoItem = useCreateProjetoItem();
  const { data: contratos } = useContratos();
  const { data: arquitetos } = useArquitetos();

  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [enderecoObra, setEnderecoObra] = useState("");
  const [origem, setOrigem] = useState<OrigemLead>("outro");
  const [arquitetoIdOrigem, setArquitetoIdOrigem] = useState("");
  const [statusCrm, setStatusCrm] = useState<StatusCRM>("lead");
  const [filterStatus, setFilterStatus] = useState<StatusCRM | "todos">("todos");

  // Detail view
  const [detailClient, setDetailClient] = useState<any>(null);

  // Interaction form
  const [intTipo, setIntTipo] = useState("ligacao");
  const [intDesc, setIntDesc] = useState("");

  // CRM Items form
  const [itemDesc, setItemDesc] = useState("");
  const [itemQtd, setItemQtd] = useState(1);
  const [itemCusto, setItemCusto] = useState(0);
  const [itemVenda, setItemVenda] = useState(0);
  const [editItemId, setEditItemId] = useState<string | null>(null);

  const { data: clientes, isLoading, isError } = useQuery({
    queryKey: ["clientes", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: interacoes, refetch: refetchInteracoes } = useQuery({
    queryKey: ["crm_interacoes", detailClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_interacoes").select("*").eq("cliente_id", detailClient!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!detailClient?.id,
  });

  const { data: clienteProjetos } = useQuery({
    queryKey: ["cliente_projetos", detailClient?.id],
    queryFn: async () => {
      const { data } = await supabase.from("projetos").select("id, nome, status").eq("cliente_id", detailClient!.id);
      return data ?? [];
    },
    enabled: !!detailClient?.id,
  });

  const { data: crmItens, refetch: refetchCrmItens } = useQuery({
    queryKey: ["crm_itens", detailClient?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_itens").select("*").eq("cliente_id", detailClient!.id).order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!detailClient?.id,
  });

  const resetForm = () => { setNome(""); setEmail(""); setTelefone(""); setEndereco(""); setEnderecoObra(""); setOrigem("outro"); setArquitetoIdOrigem(""); setStatusCrm("lead"); setEditId(null); setShowForm(false); };
  const resetItemForm = () => { setItemDesc(""); setItemQtd(1); setItemCusto(0); setItemVenda(0); setEditItemId(null); };

  const openEdit = (c: any) => {
    setEditId(c.id); setNome(c.nome); setEmail(c.email ?? ""); setTelefone(c.telefone ?? "");
    setEndereco(c.endereco ?? ""); setEnderecoObra(c.endereco_obra ?? "");
    setOrigem(c.origem ?? "outro"); setArquitetoIdOrigem(c.arquiteto_id ?? "");
    setStatusCrm(c.status_crm ?? "lead"); setShowForm(true);
  };

  const openDetail = (c: any) => { setDetailClient(c); setViewMode("detail"); };
  const backToList = () => { setViewMode("list"); setDetailClient(null); };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { nome, email: email || null, telefone: telefone || null, endereco: endereco || null, endereco_obra: enderecoObra || null, origem, status_crm: statusCrm, arquiteto_id: (origem === "arquiteto" && arquitetoIdOrigem) ? arquitetoIdOrigem : null };
      if (editId) {
        const oldCliente = clientes?.find(c => c.id === editId);
        const { error } = await supabase.from("clientes").update(payload).eq("id", editId);
        if (error) throw error;
        // Auto-create project when status changes to "projeto"
        if (statusCrm === "projeto" && oldCliente?.status_crm !== "projeto" && empresaId) {
          const items = crmItens ?? [];
          const totalVenda = items.reduce((s, i) => s + (Number(i.preco_venda) || 0) * (Number(i.quantidade) || 1), 0);
          const totalCusto = items.reduce((s, i) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0);
          const newProjeto = await createProjeto.mutateAsync({
            nome: `Projeto — ${nome}`,
            descricao: `Projeto criado automaticamente a partir do CRM`,
            cliente_id: editId,
            endereco_obra: enderecoObra || endereco || null,
            arquiteto_id: (origem === "arquiteto" && arquitetoIdOrigem) ? arquitetoIdOrigem : null,
            status: "proposta",
            venda_total: totalVenda,
            custo_previsto: totalCusto,
          });
          // Copy CRM items to project items
          for (const item of items) {
            await createProjetoItem.mutateAsync({
              projeto_id: newProjeto.id,
              descricao: item.descricao,
              quantidade: Number(item.quantidade) || 1,
              preco_custo: Number(item.preco_custo) || 0,
              preco_venda: Number(item.preco_venda) || 0,
              tipo: "produto",
              produto_id: item.produto_id || null,
            });
          }
          toast.success("Projeto criado automaticamente com itens do CRM!");
        }
      } else {
        const { error } = await supabase.from("clientes").insert({ ...payload, empresa_id: empresaId! });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); qc.invalidateQueries({ queryKey: ["projetos"] }); toast.success(editId ? "Cliente atualizado!" : "Cliente cadastrado!"); resetForm(); },
    onError: (err: any) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("clientes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clientes"] }); toast.success("Cliente excluído"); },
    onError: (err: any) => toast.error(err.message),
  });

  const addInteracao = useMutation({
    mutationFn: async () => {
      if (!intDesc.trim() || !detailClient?.id) return;
      const { error } = await supabase.from("crm_interacoes").insert({ cliente_id: detailClient.id, tipo: intTipo, descricao: intDesc, usuario_id: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { refetchInteracoes(); setIntDesc(""); toast.success("Interação registrada"); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteInteracao = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("crm_interacoes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { refetchInteracoes(); toast.success("Interação excluída"); },
  });

  const saveCrmItem = useMutation({
    mutationFn: async () => {
      if (!itemDesc.trim() || !detailClient?.id) return;
      if (editItemId) {
        const { error } = await supabase.from("crm_itens").update({ descricao: itemDesc, quantidade: itemQtd, preco_custo: itemCusto, preco_venda: itemVenda } as any).eq("id", editItemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_itens").insert({ cliente_id: detailClient.id, empresa_id: empresaId!, descricao: itemDesc, quantidade: itemQtd, preco_custo: itemCusto, preco_venda: itemVenda } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { refetchCrmItens(); resetItemForm(); toast.success(editItemId ? "Item atualizado" : "Item adicionado"); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteCrmItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("crm_itens").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { refetchCrmItens(); toast.success("Item excluído"); },
  });

  const clienteContratos = contratos?.filter(c => c.cliente_id === detailClient?.id) ?? [];
  const filtered = clientes?.filter(c => filterStatus === "todos" || c.status_crm === filterStatus) ?? [];

  const totalCrmCusto = (crmItens ?? []).reduce((s, i) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0);
  const totalCrmVenda = (crmItens ?? []).reduce((s, i) => s + (Number(i.preco_venda) || 0) * (Number(i.quantidade) || 1), 0);

  /* ─── DETAIL VIEW ─── */
  if (viewMode === "detail" && detailClient) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-2">
          <button onClick={backToList} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition">
            <ArrowLeft size={14} /> Voltar
          </button>
          <h1 className="text-lg font-bold text-foreground">{detailClient.nome}</h1>
          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusColors[detailClient.status_crm as StatusCRM]}`}>{statusLabels[detailClient.status_crm as StatusCRM]}</span>
        </div>

        <Tabs defaultValue="resumo" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="resumo" className="text-xs">Resumo</TabsTrigger>
            <TabsTrigger value="anotacoes" className="text-xs">Anotações</TabsTrigger>
            <TabsTrigger value="itens" className="text-xs">Itens (Pré-Projeto)</TabsTrigger>
            <TabsTrigger value="projetos" className="text-xs">Projetos</TabsTrigger>
            <TabsTrigger value="contratos" className="text-xs">Contratos</TabsTrigger>
          </TabsList>

          {/* ─── RESUMO ─── */}
          <TabsContent value="resumo">
            <div className="bg-card border border-border rounded p-3 space-y-3">
              <h2 className="text-xs font-semibold text-foreground">Editar Cliente</h2>
              <ClienteForm
                nome={detailClient.nome} email={detailClient.email} telefone={detailClient.telefone}
                endereco={detailClient.endereco} enderecoObra={detailClient.endereco_obra}
                origem={detailClient.origem} statusCrm={detailClient.status_crm}
                arquitetoId={detailClient.arquiteto_id} arquitetos={arquitetos ?? []}
                onSave={async (payload) => {
                  const oldStatus = detailClient.status_crm;
                  const { error } = await supabase.from("clientes").update(payload).eq("id", detailClient.id);
                  if (error) { toast.error(error.message); return; }
                  // Handle auto project creation
                  if (payload.status_crm === "projeto" && oldStatus !== "projeto" && empresaId) {
                    const items = crmItens ?? [];
                    const totalVenda = items.reduce((s, i) => s + (Number(i.preco_venda) || 0) * (Number(i.quantidade) || 1), 0);
                    const totalCusto = items.reduce((s, i) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0);
                    const newProjeto = await createProjeto.mutateAsync({
                      nome: `Projeto — ${payload.nome}`, descricao: `Projeto criado automaticamente a partir do CRM`,
                      cliente_id: detailClient.id, endereco_obra: payload.endereco_obra || payload.endereco || null,
                      arquiteto_id: payload.arquiteto_id || null, status: "proposta", venda_total: totalVenda, custo_previsto: totalCusto,
                    });
                    for (const item of items) {
                      await createProjetoItem.mutateAsync({ projeto_id: newProjeto.id, descricao: item.descricao, quantidade: Number(item.quantidade) || 1, preco_custo: Number(item.preco_custo) || 0, preco_venda: Number(item.preco_venda) || 0, tipo: "produto", produto_id: item.produto_id || null });
                    }
                    toast.success("Projeto criado automaticamente com itens do CRM!");
                  }
                  qc.invalidateQueries({ queryKey: ["clientes"] }); qc.invalidateQueries({ queryKey: ["projetos"] });
                  setDetailClient({ ...detailClient, ...payload });
                  toast.success("Cliente atualizado!");
                }}
              />
            </div>
          </TabsContent>

          {/* ─── ANOTAÇÕES ─── */}
          <TabsContent value="anotacoes">
            <div className="space-y-3">
              <div className="bg-card border border-border rounded p-3 space-y-2">
                <h4 className="text-xs font-semibold flex items-center gap-1"><MessageSquare size={12} /> Nova Interação</h4>
                <div className="flex gap-2 items-end flex-wrap">
                  <select value={intTipo} onChange={e => setIntTipo(e.target.value)} className="h-8 px-2 text-xs bg-background border border-border rounded">
                    <option value="ligacao">Ligação</option><option value="email">E-mail</option><option value="whatsapp">WhatsApp</option><option value="reuniao">Reunião</option><option value="visita">Visita</option><option value="outro">Outro</option>
                  </select>
                  <input value={intDesc} onChange={e => setIntDesc(e.target.value)} placeholder="Descrição..." className="flex-1 min-w-[200px] h-8 px-2 text-xs bg-background border border-border rounded" />
                  <button onClick={() => addInteracao.mutate()} disabled={!intDesc.trim()} className="h-8 px-4 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">Adicionar</button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                {interacoes?.map(i => (
                  <div key={i.id} className="p-2.5 rounded bg-card border border-border text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-primary capitalize">{i.tipo}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{new Date(i.created_at).toLocaleDateString("pt-BR")} {new Date(i.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        <button onClick={() => { if (window.confirm("Excluir?")) deleteInteracao.mutate(i.id); }} className="p-0.5 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={11} /></button>
                      </div>
                    </div>
                    <p className="text-foreground mt-1">{i.descricao}</p>
                  </div>
                ))}
                {(!interacoes || interacoes.length === 0) && <p className="text-muted-foreground text-xs text-center py-4">Nenhuma interação registrada.</p>}
              </div>
            </div>
          </TabsContent>

          {/* ─── ITENS PRÉ-PROJETO ─── */}
          <TabsContent value="itens">
            <div className="space-y-3">
              <div className="bg-card border border-border rounded p-3 space-y-2">
                <h4 className="text-xs font-semibold flex items-center gap-1"><Package size={12} /> {editItemId ? "Editar Item" : "Novo Item"}</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <input value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder="Descrição *" className="col-span-2 md:col-span-1 h-8 px-2 text-xs bg-background border border-border rounded" />
                  <input type="number" value={itemQtd} onChange={e => setItemQtd(Number(e.target.value))} placeholder="Qtd" className="h-8 px-2 text-xs bg-background border border-border rounded" min={1} />
                  <input type="number" value={itemCusto} onChange={e => setItemCusto(Number(e.target.value))} placeholder="Custo" className="h-8 px-2 text-xs bg-background border border-border rounded" step="0.01" />
                  <input type="number" value={itemVenda} onChange={e => setItemVenda(Number(e.target.value))} placeholder="Venda" className="h-8 px-2 text-xs bg-background border border-border rounded" step="0.01" />
                  <div className="flex gap-1">
                    <button onClick={() => saveCrmItem.mutate()} disabled={!itemDesc.trim()} className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">{editItemId ? "Salvar" : "Adicionar"}</button>
                    {editItemId && <button onClick={resetItemForm} className="h-8 px-2 rounded bg-secondary text-secondary-foreground text-xs">Cancelar</button>}
                  </div>
                </div>
              </div>

              {(crmItens && crmItens.length > 0) && (
                <>
                  <div className="border border-border rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-secondary/60">
                        <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Descrição</th>
                        <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Qtd</th>
                        <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Custo</th>
                        <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Venda</th>
                        <th className="text-right px-2.5 py-2 font-semibold border-b border-border">Subtotal</th>
                        <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
                      </tr></thead>
                      <tbody>
                        {crmItens.map(item => (
                          <tr key={item.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30">
                            <td className="px-2.5 py-1.5">{item.descricao}</td>
                            <td className="px-2.5 py-1.5 text-center">{item.quantidade}</td>
                            <td className="px-2.5 py-1.5 text-right">R$ {Number(item.preco_custo).toFixed(2)}</td>
                            <td className="px-2.5 py-1.5 text-right">R$ {Number(item.preco_venda).toFixed(2)}</td>
                            <td className="px-2.5 py-1.5 text-right font-medium">R$ {(Number(item.preco_venda) * Number(item.quantidade)).toFixed(2)}</td>
                            <td className="px-2.5 py-1.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => { setEditItemId(item.id); setItemDesc(item.descricao); setItemQtd(Number(item.quantidade)); setItemCusto(Number(item.preco_custo)); setItemVenda(Number(item.preco_venda)); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={12} /></button>
                                <button onClick={() => { if (window.confirm("Excluir item?")) deleteCrmItem.mutate(item.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-4 text-xs p-2 bg-secondary/30 rounded">
                    <span>Total Custo: <strong className="text-destructive">R$ {totalCrmCusto.toFixed(2)}</strong></span>
                    <span>Total Venda: <strong className="text-primary">R$ {totalCrmVenda.toFixed(2)}</strong></span>
                    <span>Margem: <strong className="text-success">R$ {(totalCrmVenda - totalCrmCusto).toFixed(2)}</strong></span>
                  </div>
                </>
              )}
              {(!crmItens || crmItens.length === 0) && <p className="text-muted-foreground text-xs text-center py-4">Nenhum item adicionado.</p>}
            </div>
          </TabsContent>

          {/* ─── PROJETOS ─── */}
          <TabsContent value="projetos">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold flex items-center gap-1"><FileText size={12} /> Projetos Vinculados</h4>
              {clienteProjetos && clienteProjetos.length > 0 ? clienteProjetos.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded bg-card border border-border cursor-pointer hover:bg-secondary/30 transition" onClick={() => window.location.href = `/projetos?open=${p.id}`}>
                  <span className="text-xs font-medium">{p.nome}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/15 text-primary">{p.status}</span>
                </div>
              )) : <p className="text-muted-foreground text-xs text-center py-4">Nenhum projeto vinculado.</p>}
            </div>
          </TabsContent>

          {/* ─── CONTRATOS ─── */}
          <TabsContent value="contratos">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold flex items-center gap-1"><FileText size={12} /> Contratos</h4>
              {clienteContratos.length > 0 ? clienteContratos.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded bg-card border border-border">
                  <span className="text-xs">{c.descricao ?? "Contrato"}</span>
                  <div className="flex items-center gap-2">
                    {c.valor && <span className="text-xs font-medium">R$ {Number(c.valor).toFixed(2)}</span>}
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-warning/15 text-warning">{c.status}</span>
                  </div>
                </div>
              )) : <p className="text-muted-foreground text-xs text-center py-4">Nenhum contrato vinculado.</p>}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  /* ─── LIST VIEW ─── */
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">CRM — Gestão de Clientes</h1>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} /> Novo Cliente
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["todos", "lead", "contato", "proposta", "projeto"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-2.5 py-1 rounded text-[11px] font-medium transition ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
            {s === "todos" ? "Todos" : statusLabels[s as StatusCRM]}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-card border border-border rounded p-3 space-y-3">
          <h2 className="text-xs font-semibold text-foreground">{editId ? "Editar" : "Novo"} Cliente</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Nome *</label><input value={nome} onChange={e => setNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">E-mail</label><input value={email} onChange={e => setEmail(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Telefone</label><input value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Endereço</label><input value={endereco} onChange={e => setEndereco(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Endereço da Obra</label><input value={enderecoObra} onChange={e => setEnderecoObra(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none" /></div>
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Origem</label>
              <select value={origem} onChange={e => setOrigem(e.target.value as OrigemLead)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="indicacao">Indicação</option><option value="arquiteto">Arquiteto</option><option value="outro">Outro</option>
              </select>
            </div>
            {origem === "arquiteto" && (
              <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Arquiteto</label>
                <select value={arquitetoIdOrigem} onChange={e => setArquitetoIdOrigem(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                  <option value="">Selecione...</option>
                  {(arquitetos ?? []).map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Status</label>
              <select value={statusCrm} onChange={e => setStatusCrm(e.target.value as StatusCRM)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
                <option value="lead">Lead</option><option value="contato">Em Contato</option><option value="proposta">Proposta Enviada</option><option value="projeto">Projeto</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => save.mutate()} disabled={save.isPending || !nome.trim()} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar</button>
            <button onClick={resetForm} className="px-4 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80">Cancelar</button>
          </div>
        </div>
      )}

      {isLoading ? <p className="text-center py-8 text-xs text-muted-foreground">Carregando...</p> : isError ? <p className="text-center py-8 text-xs text-destructive">Erro ao carregar dados.</p> : (
        <div className="border border-border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead><tr className="bg-secondary/60">
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Nome</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">E-mail</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Telefone</th>
              <th className="text-left px-2.5 py-2 font-semibold border-b border-border">Origem</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Status</th>
              <th className="text-center px-2.5 py-2 font-semibold border-b border-border">Ações</th>
            </tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-secondary/30 cursor-pointer" onClick={() => openDetail(c)}>
                  <td className="px-2.5 py-1.5 font-medium">{c.nome}</td>
                  <td className="px-2.5 py-1.5">{c.email ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{c.telefone ?? "—"}</td>
                  <td className="px-2.5 py-1.5">{origemLabels[c.origem as OrigemLead] ?? "—"}</td>
                  <td className="px-2.5 py-1.5 text-center">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${statusColors[c.status_crm as StatusCRM]}`}>{statusLabels[c.status_crm as StatusCRM]}</span>
                  </td>
                  <td className="px-2.5 py-1.5 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openDetail(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Eye size={13} /></button>
                      <button onClick={() => openEdit(c)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary"><Pencil size={13} /></button>
                      <button onClick={() => { if (window.confirm("Excluir cliente?")) remove.mutate(c.id); }} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nenhum cliente encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ─── Inline Edit Form for Detail View ─── */
const ClienteForm = ({ nome: initNome, email: initEmail, telefone: initTel, endereco: initEnd, enderecoObra: initObra, origem: initOrigem, statusCrm: initStatus, arquitetoId: initArqId, arquitetos, onSave }: any) => {
  const [nome, setNome] = useState(initNome ?? "");
  const [email, setEmail] = useState(initEmail ?? "");
  const [telefone, setTelefone] = useState(initTel ?? "");
  const [endereco, setEndereco] = useState(initEnd ?? "");
  const [enderecoObra, setEnderecoObra] = useState(initObra ?? "");
  const [origem, setOrigem] = useState<OrigemLead>(initOrigem ?? "outro");
  const [arquitetoIdOrigem, setArquitetoIdOrigem] = useState(initArqId ?? "");
  const [statusCrm, setStatusCrm] = useState<StatusCRM>(initStatus ?? "lead");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    await onSave({ nome, email: email || null, telefone: telefone || null, endereco: endereco || null, endereco_obra: enderecoObra || null, origem, status_crm: statusCrm, arquiteto_id: (origem === "arquiteto" && arquitetoIdOrigem) ? arquitetoIdOrigem : null });
    setSaving(false);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Nome *</label><input value={nome} onChange={e => setNome(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary" /></div>
      <div className="space-y-1"><label className="text-[11px] text-muted-foreground">E-mail</label><input value={email} onChange={e => setEmail(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
      <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Telefone</label><input value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
      <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Endereço</label><input value={endereco} onChange={e => setEndereco(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
      <div className="space-y-1 col-span-2"><label className="text-[11px] text-muted-foreground">Endereço da Obra</label><input value={enderecoObra} onChange={e => setEnderecoObra(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded" /></div>
      <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Origem</label>
        <select value={origem} onChange={e => setOrigem(e.target.value as OrigemLead)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
          <option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="indicacao">Indicação</option><option value="arquiteto">Arquiteto</option><option value="outro">Outro</option>
        </select>
      </div>
      {origem === "arquiteto" && (
        <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Arquiteto</label>
          <select value={arquitetoIdOrigem} onChange={e => setArquitetoIdOrigem(e.target.value)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
            <option value="">Selecione...</option>
            {(arquitetos ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </div>
      )}
      <div className="space-y-1"><label className="text-[11px] text-muted-foreground">Status</label>
        <select value={statusCrm} onChange={e => setStatusCrm(e.target.value as StatusCRM)} className="w-full h-8 px-2 text-xs bg-background border border-border rounded">
          <option value="lead">Lead</option><option value="contato">Em Contato</option><option value="proposta">Proposta Enviada</option><option value="projeto">Projeto</option>
        </select>
      </div>
      <div className="col-span-2 md:col-span-4">
        <button onClick={handleSave} disabled={saving || !nome.trim()} className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 disabled:opacity-50">Salvar Alterações</button>
      </div>
    </div>
  );
};

export default CRM;
