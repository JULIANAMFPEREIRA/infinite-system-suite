import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  data: string;
  lida: boolean;
  projeto_id: string | null;
}

interface Props {
  parceiroId: string;
}

const NotificacoesBell = ({ parceiroId }: Props) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notificacoes = [] } = useQuery({
    queryKey: ["notificacoes", parceiroId],
    queryFn: async (): Promise<Notificacao[]> => {
      const { data, error } = await supabase
        .from("notificacoes")
        .select("id, titulo, mensagem, data, lida, projeto_id")
        .eq("parceiro_id", parceiroId)
        .order("data", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!parceiroId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!parceiroId) return;
    const channel = supabase
      .channel("notificacoes-" + parceiroId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `parceiro_id=eq.${parceiroId}` },
        () => qc.invalidateQueries({ queryKey: ["notificacoes", parceiroId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [parceiroId, qc]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", parceiroId] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notificacoes").update({ lida: true })
        .eq("parceiro_id", parceiroId).eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", parceiroId] }),
  });

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Notificações"
        >
          <Bell size={18} />
          {naoLidas > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold bg-destructive text-destructive-foreground rounded-full">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <p className="text-xs font-semibold">Notificações {naoLidas > 0 && `(${naoLidas})`}</p>
          {naoLidas > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              <CheckCheck size={12} /> Marcar todas
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notificacoes.length === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              Nenhuma notificação.
            </div>
          ) : (
            notificacoes.map(n => (
              <div
                key={n.id}
                className={`px-3 py-2.5 border-b border-border last:border-b-0 transition-colors ${
                  !n.lida ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${!n.lida ? "font-semibold text-foreground" : "text-foreground"}`}>
                      {n.titulo}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{n.mensagem}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.data).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {!n.lida && (
                    <button
                      onClick={() => markRead.mutate(n.id)}
                      className="shrink-0 p-1 rounded hover:bg-muted text-primary"
                      title="Marcar como lida"
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificacoesBell;