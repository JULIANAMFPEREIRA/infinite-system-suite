import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertTriangle, Building2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";

const FormularioCliente = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadyFilled, setAlreadyFilled] = useState(false);
  const [empresaNome, setEmpresaNome] = useState("");
  const [orcamentoNome, setOrcamentoNome] = useState("");

  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;

  useEffect(() => {
    if (!token) {
      setError("Link inválido. Solicite um novo link.");
      setLoading(false);
      return;
    }
    fetch(`${baseUrl}/functions/v1/formulario-cliente?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          if (data.already_filled) setAlreadyFilled(true);
          else setError(data.error);
        } else {
          setEmpresaNome(data.empresa || "");
          setOrcamentoNome(data.orcamento || "");
          if (data.cliente_nome) setNome(data.cliente_nome);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar formulário. Tente novamente.");
        setLoading(false);
      });
  }, [token, baseUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Nome completo é obrigatório");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${baseUrl}/functions/v1/formulario-cliente`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nome, cpf_cnpj: cpfCnpj, email, telefone, endereco }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar");
      setSuccess(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Sonner />
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando formulário...</p>
        </div>
      </div>
    );
  }

  if (error || alreadyFilled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Sonner />
        <div className="max-w-sm w-full text-center space-y-4 p-6 rounded-xl border border-border bg-card shadow-sm">
          {alreadyFilled ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-success mx-auto" />
              <h1 className="text-lg font-semibold text-foreground">Formulário já preenchido</h1>
              <p className="text-sm text-muted-foreground">Os dados já foram enviados com sucesso anteriormente.</p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <h1 className="text-lg font-semibold text-foreground">Link inválido</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Sonner />
        <div className="max-w-sm w-full text-center space-y-4 p-6 rounded-xl border border-border bg-card shadow-sm">
          <CheckCircle2 className="h-14 w-14 text-success mx-auto" />
          <h1 className="text-lg font-semibold text-foreground">Dados enviados com sucesso!</h1>
          <p className="text-sm text-muted-foreground">
            Obrigado por preencher suas informações. Entraremos em contato em breve.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Sonner />
      <div className="max-w-md w-full space-y-6 p-6 rounded-xl border border-border bg-card shadow-sm">
        <div className="text-center space-y-2">
          {empresaNome && (
            <div className="flex items-center justify-center gap-2 text-primary">
              <Building2 size={18} />
              <span className="text-sm font-semibold">{empresaNome}</span>
            </div>
          )}
          <h1 className="text-lg font-bold text-foreground">Cadastro de Dados</h1>
          {orcamentoNome && (
            <p className="text-xs text-muted-foreground">Ref: {orcamentoNome}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Preencha seus dados para darmos continuidade ao seu atendimento.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-xs">Nome Completo *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-10 text-sm"
              placeholder="Seu nome completo"
              required
            />
          </div>
          <div>
            <Label className="text-xs">CPF / CNPJ</Label>
            <Input
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              className="h-10 text-sm"
              placeholder="000.000.000-00"
            />
          </div>
          <div>
            <Label className="text-xs">E-mail</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 text-sm"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <Label className="text-xs">Telefone</Label>
            <Input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="h-10 text-sm"
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <Label className="text-xs">Endereço Completo</Label>
            <Input
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              className="h-10 text-sm"
              placeholder="Rua, número, bairro, cidade - UF"
            />
          </div>

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={submitting || !nome.trim()}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {submitting ? "Enviando..." : "Enviar Dados"}
          </Button>
        </form>

        <p className="text-[10px] text-muted-foreground text-center">
          Seus dados serão utilizados exclusivamente para fins cadastrais.
        </p>
      </div>
    </div>
  );
};

export default FormularioCliente;
