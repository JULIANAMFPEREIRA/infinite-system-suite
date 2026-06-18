import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, BookOpen, FileText, MessageCircle, Send, Upload, Trash2, Pencil, Check, X, Download, CheckCircle2, Circle } from "lucide-react";

const STORAGE_BUCKET = "crm-files";

type AutorTipo = "admin" | "cliente" | "arquiteto" | "tecnico";

interface PortalColaborativoProps {
  clienteId: string;
  projetoId: string;
  autorTipo: AutorTipo;
  userName?: string;
  empresaId?: string;
}

const autorBadgeColor: Record<AutorTipo, string> = {
  admin: "bg-primary/15 text-primary",
  cliente: "bg-info/15 text-info",
  arquiteto: "bg-purple-500/15 text-purple-400",
  tecnico: "bg-amber-500/15 text-amber-500",
};

const autorLabel: Record<AutorTipo, string> = {
  admin: "Admin",
  cliente: "Cliente",
  arquiteto: "Arquiteto",
  tecnico: "Técnico",
};

function AutorBadge({ tipo }: { tipo?: string }) {
  const t = (tipo as AutorTipo) ?? "admin";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${autorBadgeColor[t] ?? autorBadgeColor.admin}`}>
      {autorLabel[t] ?? t}
    </span>
  );
}

export default function PortalColaborativo({ clienteId, projetoId, autorTipo, userName, empresaId }: PortalColaborativoProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Resolve empresa_id if not provided
  const { data: resolvedEmpresaId } = useQuery({
    queryKey: ["portal_colab_empresa", clienteId, empresaId],
    queryFn: async () => {
      if (empresaId) return empresaId;
      const { data } = await supabase.from("clientes").select("empresa_id").eq("id", clienteId).maybeSingle();
      return (data as any)?.empresa_id ?? null;
    },
  });

  return (
    <Tabs defaultValue="pendencias" className="space-y-4">
      <TabsList className="w-full justify-start overflow-x-auto bg-card border border-border">
        <TabsTrigger value="pendencias" className="gap-1.5 text-xs"><AlertCircle size={14} /> Pendências</TabsTrigger>
        <TabsTrigger value="diario" className="gap-1.5 text-xs"><BookOpen size={14} /> Diário de Obra</TabsTrigger>
        <TabsTrigger value="documentos" className="gap-1.5 text-xs"><FileText size={14} /> Documentos</TabsTrigger>
        <TabsTrigger value="comunicacao" className="gap-1.5 text-xs"><MessageCircle size={14} /> Comunicação</TabsTrigger>
      </TabsList>

      <TabsContent value="pendencias">
        <PendenciasTab clienteId={clienteId} projetoId={projetoId} autorTipo={autorTipo} empresaId={resolvedEmpresaId} userId={user?.id} />
      </TabsContent>
      <TabsContent value="diario">
        <DiarioTab clienteId={clienteId} projetoId={projetoId} autorTipo={autorTipo} empresaId={resolvedEmpresaId} userId={user?.id} />
      </TabsContent>
      <TabsContent value="documentos">
        <DocumentosTab clienteId={clienteId} projetoId={projetoId} autorTipo={autorTipo} empresaId={resolvedEmpresaId} userId={user?.id} />
      </TabsContent>
      <TabsContent value="comunicacao">
        <ComunicacaoTab clienteId={clienteId} projetoId={projetoId} autorTipo={autorTipo} userName={userName} empresaId={resolvedEmpresaId} userId={user?.id} />
      </TabsContent>
    </Tabs>
  );
}

/* ───────────────────────────────────────── Pendências ───────────────────────────────────────── */

interface TabCommonProps {
  clienteId: string;
  projetoId: string;
  autorTipo: AutorTipo;
  empresaId?: string | null;
  userId?: string;
}

function PendenciasTab({ clienteId, projetoId, autorTipo, empresaId, userId }: TabCommonProps) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTxt, setEditTxt] = useState("");

  const { data: items } = useQuery({
    queryKey: ["portal_colab_pendencias", projetoId],
    queryFn: async () => {
      const { data } = await (supabase.from("crm_interacoes" as any) as any)
        .select("id, descricao, created_at, status, autor_tipo, usuario_id")
        .eq("projeto_id", projetoId)
        .eq("tipo", "pendencia")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const txt = novo.trim();
      if (!txt) return;
      const { error } = await (supabase.from("crm_interacoes" as any) as any).insert({
        cliente_id: clienteId,
        projeto_id: projetoId,
        empresa_id: empresaId,
        usuario_id: userId,
        tipo: "pendencia",
        descricao: txt,
        status: "aberta",
        autor_tipo: autorTipo,
        visivel_cliente: true,
        visivel_portal: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNovo(""); qc.invalidateQueries({ queryKey: ["portal_colab_pendencias", projetoId] }); },
  });

  const toggle = useMutation({
    mutationFn: async (it: any) => {
      const next = it.status === "concluida" ? "aberta" : "concluida";
      const { error } = await (supabase.from("crm_interacoes" as any) as any)
        .update({ status: next }).eq("id", it.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal_colab_pendencias", projetoId] }),
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const { error } = await (supabase.from("crm_interacoes" as any) as any)
        .update({ descricao: editTxt }).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => { setEditId(null); setEditTxt(""); qc.invalidateQueries({ queryKey: ["portal_colab_pendencias", projetoId] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("crm_interacoes" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal_colab_pendencias", projetoId] }),
  });

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="bg-card border border-border rounded-lg p-3 space-y-2">
        <textarea
          value={novo} onChange={(e) => setNovo(e.target.value)}
          rows={2} placeholder="Nova pendência…"
          className="w-full text-xs bg-background border border-border rounded p-2 resize-none"
        />
        <div className="flex justify-end">
          <button type="submit" disabled={!novo.trim() || add.isPending}
            className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
            Adicionar
          </button>
        </div>
      </form>

      {!items?.length ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma pendência.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const mine = it.usuario_id === userId;
            const done = it.status === "concluida";
            return (
              <div key={it.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${done ? "bg-success/15 text-success" : "bg-orange-500/15 text-orange-500"}`}>
                      {done ? "Concluída" : "Aberta"}
                    </span>
                    <AutorBadge tipo={it.autor_tipo} />
                    <span className="text-[10px] text-muted-foreground">{new Date(it.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggle.mutate(it)} title={done ? "Reabrir" : "Concluir"}
                      className="text-muted-foreground hover:text-foreground p-1">
                      {done ? <Circle size={14} /> : <CheckCircle2 size={14} />}
                    </button>
                    {mine && editId !== it.id && (
                      <>
                        <button onClick={() => { setEditId(it.id); setEditTxt(it.descricao ?? ""); }}
                          className="text-muted-foreground hover:text-foreground p-1"><Pencil size={13} /></button>
                        <button onClick={() => { if (confirm("Excluir pendência?")) del.mutate(it.id); }}
                          className="text-muted-foreground hover:text-destructive p-1"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                </div>
                {editId === it.id ? (
                  <div className="space-y-2">
                    <textarea value={editTxt} onChange={(e) => setEditTxt(e.target.value)} rows={2}
                      className="w-full text-xs bg-background border border-border rounded p-2 resize-none" />
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setEditId(null); setEditTxt(""); }} className="h-7 px-2 rounded border border-border text-xs"><X size={12} /></button>
                      <button onClick={() => update.mutate()} className="h-7 px-2 rounded bg-primary text-primary-foreground text-xs"><Check size={12} /></button>
                    </div>
                  </div>
                ) : (
                  <p className={`text-xs whitespace-pre-wrap ${done ? "line-through text-muted-foreground" : "text-foreground"}`}>{it.descricao}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────── Diário de Obra ───────────────────────────────────────── */

function DiarioTab({ clienteId, projetoId, autorTipo, empresaId, userId }: TabCommonProps) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTxt, setEditTxt] = useState("");

  const { data: items } = useQuery({
    queryKey: ["portal_colab_diario", projetoId],
    queryFn: async () => {
      const { data } = await (supabase.from("crm_interacoes" as any) as any)
        .select("id, descricao, created_at, autor_tipo, usuario_id")
        .eq("projeto_id", projetoId)
        .eq("tipo", "diario")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const txt = novo.trim(); if (!txt) return;
      const { error } = await (supabase.from("crm_interacoes" as any) as any).insert({
        cliente_id: clienteId, projeto_id: projetoId, empresa_id: empresaId,
        usuario_id: userId, tipo: "diario", descricao: txt,
        autor_tipo: autorTipo, visivel_cliente: true, visivel_portal: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNovo(""); qc.invalidateQueries({ queryKey: ["portal_colab_diario", projetoId] }); },
  });

  const update = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const { error } = await (supabase.from("crm_interacoes" as any) as any)
        .update({ descricao: editTxt }).eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => { setEditId(null); setEditTxt(""); qc.invalidateQueries({ queryKey: ["portal_colab_diario", projetoId] }); },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("crm_interacoes" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal_colab_diario", projetoId] }),
  });

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="bg-card border border-border rounded-lg p-3 space-y-2">
        <textarea value={novo} onChange={(e) => setNovo(e.target.value)} rows={3}
          placeholder="Registrar atividade do dia…"
          className="w-full text-xs bg-background border border-border rounded p-2 resize-none" />
        <div className="flex justify-end">
          <button type="submit" disabled={!novo.trim() || add.isPending}
            className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
            Salvar
          </button>
        </div>
      </form>

      {!items?.length ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Nenhum registro.</p>
      ) : (
        <div className="relative pl-4 border-l-2 border-primary/20 space-y-3">
          {items.map((it) => {
            const mine = it.usuario_id === userId;
            return (
              <div key={it.id} className="relative">
                <div className="absolute -left-[21px] top-2 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                <div className="bg-card border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <AutorBadge tipo={it.autor_tipo} />
                      <span className="text-[10px] text-muted-foreground">{new Date(it.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    {mine && editId !== it.id && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditId(it.id); setEditTxt(it.descricao ?? ""); }}
                          className="text-muted-foreground hover:text-foreground p-1"><Pencil size={13} /></button>
                        <button onClick={() => { if (confirm("Excluir registro?")) del.mutate(it.id); }}
                          className="text-muted-foreground hover:text-destructive p-1"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                  {editId === it.id ? (
                    <div className="space-y-2">
                      <textarea value={editTxt} onChange={(e) => setEditTxt(e.target.value)} rows={3}
                        className="w-full text-xs bg-background border border-border rounded p-2 resize-none" />
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditId(null); setEditTxt(""); }} className="h-7 px-2 rounded border border-border text-xs"><X size={12} /></button>
                        <button onClick={() => update.mutate()} className="h-7 px-2 rounded bg-primary text-primary-foreground text-xs"><Check size={12} /></button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-foreground whitespace-pre-wrap">{it.descricao}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────── Documentos ───────────────────────────────────────── */

function DocumentosTab({ clienteId, projetoId, autorTipo, empresaId, userId }: TabCommonProps) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { data: items } = useQuery({
    queryKey: ["portal_colab_docs", projetoId],
    queryFn: async () => {
      const { data } = await (supabase.from("crm_arquivos" as any) as any)
        .select("id, nome_arquivo, url, tipo, tamanho, created_at, autor_tipo, empresa_id")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  // Track who uploaded what — we can't reliably know without an uploader column, so allow delete only for autor_tipo === current autorTipo as a coarse rule
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `projetos/${projetoId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const tipo = file.type.startsWith("image/") ? "imagem" : "documento";
      const { error } = await (supabase.from("crm_arquivos" as any) as any).insert({
        cliente_id: clienteId, projeto_id: projetoId, empresa_id: empresaId,
        nome_arquivo: file.name, url: pub.publicUrl, tipo, tamanho: file.size,
        autor_tipo: autorTipo,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal_colab_docs", projetoId] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("crm_arquivos" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal_colab_docs", projetoId] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <input
          ref={fileRef} type="file" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="h-8 px-3 rounded bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5 disabled:opacity-50"
        >
          <Upload size={13} /> {upload.isPending ? "Enviando…" : "Enviar arquivo"}
        </button>
      </div>

      {!items?.length ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Nenhum documento.</p>
      ) : (
        <div className="space-y-2">
          {items.map((d) => {
            const mine = d.autor_tipo === autorTipo;
            return (
              <div key={d.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                <FileText size={16} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{d.nome_arquivo}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <AutorBadge tipo={d.autor_tipo} />
                    <span className="text-[10px] text-muted-foreground">{new Date(d.created_at).toLocaleDateString("pt-BR")}</span>
                    {d.tipo && <span className="text-[10px] text-muted-foreground">· {d.tipo}</span>}
                  </div>
                </div>
                <a href={d.url} target="_blank" rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground p-1" title="Baixar"><Download size={14} /></a>
                {mine && (
                  <button onClick={() => { if (confirm("Excluir arquivo?")) del.mutate(d.id); }}
                    className="text-muted-foreground hover:text-destructive p-1" title="Excluir"><Trash2 size={14} /></button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────── Comunicação ───────────────────────────────────────── */

function ComunicacaoTab({ clienteId, projetoId, autorTipo, userName, empresaId, userId }: TabCommonProps & { userName?: string }) {
  const qc = useQueryClient();
  const [txt, setTxt] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const { data: msgs } = useQuery({
    queryKey: ["portal_colab_chat", projetoId],
    queryFn: async () => {
      const { data } = await (supabase.from("crm_interacoes" as any) as any)
        .select("id, descricao, created_at, autor_tipo, usuario_id")
        .eq("projeto_id", projetoId)
        .eq("tipo", "comunicacao")
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
    refetchInterval: 15000,
  });

  const send = useMutation({
    mutationFn: async () => {
      const t = txt.trim(); if (!t) return;
      const { error } = await (supabase.from("crm_interacoes" as any) as any).insert({
        cliente_id: clienteId, projeto_id: projetoId, empresa_id: empresaId,
        usuario_id: userId, tipo: "comunicacao", descricao: t,
        autor_tipo: autorTipo, visivel_cliente: true, visivel_portal: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { setTxt(""); qc.invalidateQueries({ queryKey: ["portal_colab_chat", projetoId] }); },
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs?.length]);

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col h-[60vh]">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!msgs?.length && (
          <p className="text-xs text-muted-foreground py-6 text-center">Sem mensagens ainda.</p>
        )}
        {msgs?.map((m) => {
          const mine = m.usuario_id === userId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                {!mine && (
                  <div className="mb-1"><AutorBadge tipo={m.autor_tipo} /></div>
                )}
                <p className="text-xs whitespace-pre-wrap">{m.descricao}</p>
                <p className={`text-[9px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {new Date(m.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} className="border-t border-border p-2 flex gap-2">
        <input
          value={txt} onChange={(e) => setTxt(e.target.value)}
          placeholder={`Mensagem${userName ? ` como ${userName}` : ""}…`}
          className="flex-1 h-9 px-3 text-xs bg-background border border-border rounded"
        />
        <button type="submit" disabled={!txt.trim() || send.isPending}
          className="h-9 px-3 rounded bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1 disabled:opacity-50">
          <Send size={12} /> Enviar
        </button>
      </form>
    </div>
  );
}