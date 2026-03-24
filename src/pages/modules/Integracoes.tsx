import { Building2, CheckCircle2, Clock } from "lucide-react";

const integracoes = [
  { nome: "Banco Cora", status: "planejado", desc: "Boletos e conciliação bancária" },
  { nome: "Bradesco", status: "planejado", desc: "Integração via API bancária" },
  { nome: "Nubank", status: "planejado", desc: "Leitura de extratos e conciliação" },
  { nome: "WhatsApp Business", status: "planejado", desc: "Envio de cobranças e notificações" },
  { nome: "Prefeitura (NFS-e)", status: "planejado", desc: "Emissão de notas fiscais de serviço" },
];

const Integracoes = () => {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Building2 size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Integrações</h1>
      </div>
      <p className="text-xs text-muted-foreground">Status das integrações disponíveis e planejadas para o sistema.</p>

      <div className="space-y-3">
        {integracoes.map((int, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {int.status === "ativo" ? <CheckCircle2 size={18} className="text-success" /> : <Clock size={18} className="text-muted-foreground" />}
              <div>
                <h3 className="text-sm font-semibold text-foreground">{int.nome}</h3>
                <p className="text-[11px] text-muted-foreground">{int.desc}</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${int.status === "ativo" ? "bg-success/15 text-success" : "bg-secondary text-secondary-foreground"}`}>
              {int.status === "ativo" ? "Ativo" : "Planejado"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Integracoes;
