import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertTriangle, Building2, User, Phone, Copy, Check } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const maskCPF = (v: string) =>
  v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");

const maskCNPJ = (v: string) =>
  v.replace(/\D/g, "").slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

const validateCPF = (cpf: string): boolean => {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(d[10]);
};

const validateCNPJ = (cnpj: string): boolean => {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(d[i]) * w1[i];
  let rest = sum % 11;
  if ((rest < 2 ? 0 : 11 - rest) !== parseInt(d[12])) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(d[i]) * w2[i];
  rest = sum % 11;
  return (rest < 2 ? 0 : 11 - rest) === parseInt(d[13]);
};

type TipoPessoa = "pf" | "pj" | null;

const CadastroLivre = () => {
  const [status, setStatus] = useState<"form" | "submitted" | "error">("form");
  const [tipo, setTipo] = useState<TipoPessoa>(null);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [inscricaoEstadual, setInscricaoEstadual] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [responsavel, setResponsavel] = useState("");

  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [servicoInteresse, setServicoInteresse] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [origem, setOrigem] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!tipo) e.tipo = "Selecione o tipo de cadastro";
    if (tipo === "pf" && !nome.trim()) e.nome = "Nome é obrigatório";
    if (tipo === "pf" && cpf && !validateCPF(cpf)) e.cpf = "CPF inválido";
    if (tipo === "pj" && !razaoSocial.trim()) e.razaoSocial = "Razão social é obrigatória";
    if (tipo === "pj" && cnpj && !validateCNPJ(cnpj)) e.cnpj = "CNPJ inválido";
    if (tipo === "pj" && !inscricaoEstadual.trim()) e.inscricaoEstadual = "Inscrição Estadual é obrigatória";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "E-mail inválido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const nomeEnvio = tipo === "pf" ? nome : razaoSocial;
      const cpfCnpjEnvio = tipo === "pf" ? cpf : cnpj;
      const notasExtra = tipo === "pj"
        ? `NOME FANTASIA: ${nomeFantasia}\nINSCRIÇÃO ESTADUAL: ${inscricaoEstadual}\nRESPONSÁVEL: ${responsavel}\nSERVIÇO DE INTERESSE: ${servicoInteresse}\nOBS: ${observacoes}`
        : `SERVIÇO DE INTERESSE: ${servicoInteresse}\nOBS: ${observacoes}`;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/cadastro-livre`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({
          nome: nomeEnvio,
          cpf_cnpj: cpfCnpjEnvio,
          email,
          telefone,
          endereco,
          notas: notasExtra,
          tipo_pessoa: tipo,
          origem: origem || "outro",
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("submitted");
    } catch {
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="max-w-md w-full text-center border-none bg-slate-800/80 shadow-2xl">
          <CardContent className="pt-10 pb-10 space-y-4">
            <CheckCircle2 className="h-14 w-14 text-emerald-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Cadastro enviado com sucesso!</h2>
            <p className="text-slate-400 text-sm">Em breve entraremos em contato.</p>
            <div className="pt-4 space-y-1 text-slate-500 text-xs">
              <p className="font-semibold text-slate-300">INFINIT NETWORK</p>
              <p>www.infinitnetwork.com.br</p>
              <p>WhatsApp: (77) 99971-6415</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <Card className="max-w-md w-full text-center border-none bg-slate-800/80 shadow-2xl">
          <CardContent className="pt-10 pb-10 space-y-4">
            <AlertTriangle className="h-14 w-14 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Erro ao enviar</h2>
            <p className="text-slate-400 text-sm">Ocorreu um erro. Tente novamente mais tarde.</p>
            <Button onClick={() => setStatus("form")} variant="outline" className="mt-2 border-slate-600 text-slate-300">
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const primaryName = tipo === "pf" ? nome : razaoSocial;
  const canSubmit = !!tipo && primaryName.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-start justify-center p-4 pt-8 md:pt-16">
      <Card className="max-w-lg w-full border-none bg-slate-800/80 shadow-2xl backdrop-blur-sm">
        <CardHeader className="text-center space-y-2 pb-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">INFINIT NETWORK</h1>
          <p className="text-sky-400 text-sm font-medium">Cadastro de Cliente</p>
        </CardHeader>

        <CardContent className="pt-2">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Tipo */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm font-semibold">Tipo de cadastro *</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setTipo("pf"); setErrors({}); }}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all font-medium text-sm ${
                    tipo === "pf"
                      ? "border-sky-500 bg-sky-500/10 text-sky-400"
                      : "border-slate-600 bg-slate-700/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <User className="h-5 w-5" /> Pessoa Física
                </button>
                <button
                  type="button"
                  onClick={() => { setTipo("pj"); setErrors({}); }}
                  className={`flex items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all font-medium text-sm ${
                    tipo === "pj"
                      ? "border-sky-500 bg-sky-500/10 text-sky-400"
                      : "border-slate-600 bg-slate-700/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <Building2 className="h-5 w-5" /> Pessoa Jurídica
                </button>
              </div>
              {errors.tipo && <p className="text-red-400 text-xs">{errors.tipo}</p>}
            </div>

            {/* PF */}
            {tipo === "pf" && (
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                <FieldGroup label="Nome completo *" error={errors.nome}>
                  <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" />
                </FieldGroup>
                <FieldGroup label="CPF" error={errors.cpf}>
                  <Input value={cpf} onChange={e => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" type="text" />
                </FieldGroup>
              </div>
            )}

            {/* PJ */}
            {tipo === "pj" && (
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                <FieldGroup label="Razão social *" error={errors.razaoSocial}>
                  <Input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} placeholder="Razão social"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" />
                </FieldGroup>
                <FieldGroup label="Nome fantasia">
                  <Input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} placeholder="Nome fantasia"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" />
                </FieldGroup>
                <FieldGroup label="CNPJ" error={errors.cnpj}>
                  <Input value={cnpj} onChange={e => setCnpj(maskCNPJ(e.target.value))} placeholder="00.000.000/0000-00"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" type="text" />
                </FieldGroup>
                <FieldGroup label="Inscrição Estadual *" error={errors.inscricaoEstadual}>
                  <Input value={inscricaoEstadual} onChange={e => setInscricaoEstadual(e.target.value.toUpperCase())} placeholder="Ex: 123456789 ou ISENTO"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" type="text" />
                </FieldGroup>
                <FieldGroup label="Nome do responsável">
                  <Input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Responsável"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" />
                </FieldGroup>
              </div>
            )}

            {/* Common */}
            {tipo && (
              <div className="space-y-4 animate-in fade-in-50 duration-300">
                <div className="h-px bg-slate-700 my-1" />

                <FieldGroup label="Telefone (WhatsApp)">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input value={telefone} onChange={e => setTelefone(maskPhone(e.target.value))} placeholder="(00) 00000-0000"
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pl-10" type="tel" />
                  </div>
                </FieldGroup>

                <FieldGroup label="E-mail" error={errors.email}>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" />
                </FieldGroup>

                <FieldGroup label="Endereço completo">
                  <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade - UF"
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" />
                </FieldGroup>

                <FieldGroup label="Serviço de interesse">
                  <Input value={servicoInteresse} onChange={e => setServicoInteresse(e.target.value)} placeholder="Ex: Automação, CFTV, Cabeamento..."
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500" />
                </FieldGroup>

                <FieldGroup label="Como nos conheceu?">
                  <Select value={origem} onValueChange={setOrigem}>
                    <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="indicacao">Indicação</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldGroup>

                <FieldGroup label="Observações">
                  <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Informações adicionais..."
                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 min-h-[80px] resize-none" />
                </FieldGroup>

                <Button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 text-base" disabled={submitting || !canSubmit}>
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</> : "Enviar cadastro"}
                </Button>
              </div>
            )}
          </form>

          <div className="mt-5 pt-4 border-t border-slate-700 flex justify-center">
            <button type="button" onClick={handleCopyLink} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Link copiado!" : "Copiar link do formulário"}
            </button>
          </div>

          <div className="mt-4 text-center space-y-0.5 text-slate-600 text-[11px]">
            <p>INFINIT NETWORK</p>
            <p>www.infinitnetwork.com.br · (77) 99971-6415</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const FieldGroup = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-slate-300 text-sm">{label}</Label>
    {children}
    {error && <p className="text-red-400 text-xs">{error}</p>}
  </div>
);

export default CadastroLivre;
