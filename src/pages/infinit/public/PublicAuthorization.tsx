import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

export default function PublicAuthorization() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [responses, setResponses] = useState<Record<string, { response: 'approved' | 'rejected', observation?: string }>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const { data: authorization, isLoading } = useQuery({
    queryKey: ["public-authorization", slug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_public_authorization", {
        _slug: slug as string,
      });
      if (error) throw error;
      if (!data) return null;
      const auth = (data as any).authorization ?? null;
      const items = (data as any).items ?? [];
      if (!auth) return null;
      return { ...auth, items };
    },
  });

  useEffect(() => {
    if (authorization?.status === 'responded') {
      setIsSubmitted(true);
    }
  }, [authorization]);

  const handleResponse = (itemId: string, response: 'approved' | 'rejected') => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], response }
    }));
  };

  const handleObservation = (itemId: string, observation: string) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], observation }
    }));
  };

  const itemsCount = authorization?.items?.length || 0;
  const answeredCount = Object.keys(responses).length;
  const progress = itemsCount > 0 ? (answeredCount / itemsCount) * 100 : 0;
  const allAnswered = answeredCount === itemsCount;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = Object.keys(responses).map((itemId) => ({
        id: itemId,
        response: responses[itemId].response,
        observation: responses[itemId].observation || null,
      }));
      const { error } = await (supabase.rpc as any)("submit_public_authorization", {
        _slug: slug as string,
        _responses: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Autorização enviada com sucesso!");
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["public-authorization", slug] });
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar autorização: " + error.message);
    }
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!authorization) return <div className="min-h-screen flex items-center justify-center text-red-500">Documento não encontrado.</div>;

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-6">
          <div className="flex justify-center">
            <div className="bg-green-100 p-4 rounded-full">
              <ShieldCheck className="h-12 w-12 text-[#1D9E75]" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Documento Enviado</CardTitle>
          <CardContent className="space-y-4 px-0">
            <p className="text-gray-600">
              Prezado(a) <strong>{authorization.recipient_name}</strong>, agradecemos por sua resposta.
            </p>
            <p className="text-gray-600">
              A equipe da <strong>INFINIT Network</strong> já foi notificada e dará prosseguimento aos trâmites necessários.
            </p>
            <div className="pt-6">
               <p className="text-xs text-muted-foreground uppercase tracking-widest">Infinit Network - Gestão Interina</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 h-24 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="h-12 w-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 font-bold uppercase tracking-widest border border-dashed">
               INFINIT
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div className="h-12 w-32 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400 font-bold uppercase tracking-widest border border-dashed">
               {authorization.client_name}
            </div>
          </div>
          <div className="hidden md:block text-right">
            <p className="text-sm font-semibold text-gray-900">{new Date().toLocaleDateString("pt-BR")}</p>
            <p className="text-xs text-gray-500">Documento de Autorização</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-4xl space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight">
            {authorization.title}
          </h1>
          <p className="text-xl text-gray-600">
            {authorization.client_name} — {authorization.recipient_name} ({authorization.recipient_role})
          </p>
        </div>

        <div className="space-y-6">
          {authorization.items?.sort((a: any, b: any) => a.order_index - b.order_index).map((item: any) => (
            <Card key={item.id} className={`transition-all ${responses[item.id]?.response === 'rejected' ? 'border-red-100' : responses[item.id]?.response === 'approved' ? 'border-green-100' : ''}`}>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">{item.label}</h3>
                  <p className="text-gray-600 leading-relaxed">{item.description}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button 
                    variant={responses[item.id]?.response === 'approved' ? 'default' : 'outline'}
                    className={responses[item.id]?.response === 'approved' ? 'bg-[#1D9E75] hover:bg-[#157a5a]' : 'hover:border-green-200 hover:bg-green-50'}
                    onClick={() => handleResponse(item.id, 'approved')}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Aprovar
                  </Button>
                  <Button 
                    variant={responses[item.id]?.response === 'rejected' ? 'destructive' : 'outline'}
                    className={responses[item.id]?.response === 'rejected' ? 'bg-red-600' : 'hover:border-red-200 hover:bg-red-50'}
                    onClick={() => handleResponse(item.id, 'rejected')}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Reprovar
                  </Button>
                </div>

                {responses[item.id]?.response === 'rejected' && (
                  <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-sm font-semibold text-red-900">Por favor, descreva o motivo da reprovação (opcional):</label>
                    <Textarea 
                      placeholder="Observações..." 
                      className="border-red-200 focus:ring-red-200"
                      value={responses[item.id]?.observation || ''}
                      onChange={(e) => handleObservation(item.id, e.target.value)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-20">
        <div className="container mx-auto max-w-4xl flex items-center justify-between gap-8">
          <div className="flex-1 space-y-1">
            <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-gray-500">
              <span>Progresso</span>
              <span>{answeredCount} de {itemsCount} itens</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          <Button 
            className="bg-[#1D9E75] hover:bg-[#157a5a] h-12 px-8 font-bold text-lg" 
            disabled={!allAnswered || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? "Enviando..." : "Enviar Autorização"}
            <Send className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
