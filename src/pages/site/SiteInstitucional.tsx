import { useEffect } from "react";
import { ArrowRight, Phone, Mail, MapPin, Instagram, Linkedin, Facebook, Network } from "lucide-react";

const NAV = [
  { id: "inicio", label: "Início" },
  { id: "a-infinit", label: "A Infinit" },
  { id: "servicos", label: "Serviços" },
  { id: "projetos", label: "Projetos" },
  { id: "produtos", label: "Produtos" },
  { id: "depoimentos", label: "Depoimentos" },
  { id: "contato", label: "Contato" },
];

export default function SiteInstitucional() {
  useEffect(() => {
    document.title = "INFINIT NETWORK — Automação, AV e Tecnologia de Alto Padrão";
    const meta = document.querySelector('meta[name="description"]') || (() => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
      return m;
    })();
    meta.setAttribute(
      "content",
      "INFINIT NETWORK: 25+ anos em automação residencial e corporativa, AV integration, infraestrutura e consultoria em TI. Prometa menos, entregue mais."
    );
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-white text-[#0D2137]" style={{ fontFamily: "'Inter', 'Work Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Manrope', system-ui, sans-serif; letter-spacing: -0.02em; }
        .infinit-card-shadow { box-shadow: 0 4px 24px -8px rgba(13, 33, 55, 0.12); transition: box-shadow .25s ease, transform .25s ease; }
        .infinit-card-shadow:hover { box-shadow: 0 16px 40px -12px rgba(13, 33, 55, 0.22); transform: translateY(-2px); }
        .hero-grid-bg {
          background-image:
            radial-gradient(circle at 20% 30%, rgba(212,172,13,0.10), transparent 45%),
            radial-gradient(circle at 80% 70%, rgba(27,79,114,0.18), transparent 50%),
            linear-gradient(180deg, #0D2137 0%, #0F2A45 60%, #0D2137 100%);
        }
        .grid-lines {
          background-image:
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 56px 56px;
        }
      `}</style>

      {/* Header fixo */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-[#0D2137]/8">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <button onClick={() => scrollTo("inicio")} className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-[#0D2137] flex items-center justify-center">
              <Network className="w-5 h-5 text-[#D4AC0D]" strokeWidth={2.2} />
            </div>
            <div className="leading-tight text-left">
              <div className="font-display font-extrabold text-[15px] tracking-wide text-[#0D2137]">INFINIT</div>
              <div className="font-display font-medium text-[11px] tracking-[0.22em] text-[#1B4F72]">NETWORK</div>
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-8">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className="text-[13.5px] font-medium text-[#0D2137]/75 hover:text-[#0D2137] transition-colors"
              >
                {n.label}
              </button>
            ))}
          </nav>

          <button
            onClick={() => scrollTo("contato")}
            className="hidden sm:inline-flex items-center gap-2 bg-[#D4AC0D] hover:bg-[#b8950b] text-[#0D2137] font-semibold text-[13.5px] px-5 py-2.5 rounded-lg transition-colors"
          >
            Solicitar Orçamento
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section id="inicio" className="relative pt-20 hero-grid-bg text-white overflow-hidden">
        <div className="absolute inset-0 grid-lines opacity-60 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/8 border border-white/12 text-[12px] font-medium text-white/85 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AC0D]" />
              Mais de 25 anos transformando ambientes em experiências
            </div>
            <h1 className="font-display font-extrabold text-[42px] sm:text-[54px] lg:text-[64px] leading-[1.05] tracking-tight">
              Tecnologia de alto padrão para <span className="text-[#D4AC0D]">residências</span> e <span className="text-[#D4AC0D]">empresas</span>.
            </h1>
            <p className="mt-6 text-[17px] lg:text-[19px] text-white/75 max-w-2xl leading-relaxed">
              Automação, AV integration, infraestrutura e consultoria em TI projetadas para funcionar de forma invisível.
              <span className="block mt-3 font-display font-semibold text-white">"Prometa menos, entregue mais."</span>
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <button
                onClick={() => scrollTo("contato")}
                className="inline-flex items-center gap-2 bg-[#D4AC0D] hover:bg-[#b8950b] text-[#0D2137] font-semibold text-[14px] px-6 py-3.5 rounded-lg transition-colors"
              >
                Fale Conosco
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => scrollTo("projetos")}
                className="inline-flex items-center gap-2 bg-white/8 hover:bg-white/14 border border-white/15 text-white font-semibold text-[14px] px-6 py-3.5 rounded-lg transition-colors"
              >
                Ver Projetos
              </button>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg">
              {[
                { n: "25+", l: "Anos de mercado" },
                { n: "500+", l: "Projetos entregues" },
                { n: "100%", l: "Foco em qualidade" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-display font-extrabold text-3xl text-[#D4AC0D]">{s.n}</div>
                  <div className="text-[12px] text-white/65 mt-1 leading-snug">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Elemento visual tech */}
          <div className="lg:col-span-5">
            <div className="relative aspect-square max-w-md mx-auto">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-[#1B4F72]/60 to-[#0D2137]/80 border border-white/10 backdrop-blur infinit-card-shadow" />
              <svg viewBox="0 0 400 400" className="relative w-full h-full p-8">
                <defs>
                  <linearGradient id="ln" x1="0" x2="1">
                    <stop offset="0" stopColor="#D4AC0D" stopOpacity="0.0" />
                    <stop offset="0.5" stopColor="#D4AC0D" stopOpacity="0.9" />
                    <stop offset="1" stopColor="#D4AC0D" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {[80, 140, 200, 260, 320].map((r) => (
                  <circle key={r} cx="200" cy="200" r={r / 2} fill="none" stroke="rgba(255,255,255,0.08)" />
                ))}
                {Array.from({ length: 12 }).map((_, i) => {
                  const a = (i / 12) * Math.PI * 2;
                  const x = 200 + Math.cos(a) * 150;
                  const y = 200 + Math.sin(a) * 150;
                  return (
                    <g key={i}>
                      <line x1="200" y1="200" x2={x} y2={y} stroke="url(#ln)" strokeWidth="1" />
                      <circle cx={x} cy={y} r="5" fill="#D4AC0D" />
                    </g>
                  );
                })}
                <circle cx="200" cy="200" r="28" fill="#0D2137" stroke="#D4AC0D" strokeWidth="2" />
                <circle cx="200" cy="200" r="10" fill="#D4AC0D" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Placeholders para próximas seções */}
      <section id="a-infinit" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-[13px] uppercase tracking-[0.22em] text-[#1B4F72] font-semibold">Próxima seção</p>
          <h2 className="font-display font-bold text-3xl text-[#0D2137] mt-3">Quem Somos &amp; O que Fazemos</h2>
          <p className="text-[#0D2137]/60 mt-3">Conteúdo será construído no próximo prompt.</p>
        </div>
      </section>

      <section id="servicos" className="py-24 bg-[#F5F6F8]" />
      <section id="projetos" className="py-24 bg-white" />
      <section id="produtos" className="py-24 bg-[#F5F6F8]" />
      <section id="depoimentos" className="py-24 bg-white" />
      <section id="contato" className="py-24 bg-[#F5F6F8]" />

      {/* Footer */}
      <footer className="bg-[#0D2137] text-white pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Network className="w-5 h-5 text-[#D4AC0D]" strokeWidth={2.2} />
              </div>
              <div className="leading-tight">
                <div className="font-display font-extrabold text-[15px] tracking-wide">INFINIT</div>
                <div className="font-display font-medium text-[11px] tracking-[0.22em] text-white/60">NETWORK</div>
              </div>
            </div>
            <p className="text-white/65 text-[14px] leading-relaxed max-w-md">
              Automação residencial e corporativa, AV integration, infraestrutura tecnológica e consultoria em TI.
              Prometa menos, entregue mais.
            </p>
            <div className="flex items-center gap-3 mt-6">
              {[Instagram, Linkedin, Facebook].map((Icon, i) => (
                <a key={i} href="#" aria-label="Rede social" className="w-10 h-10 rounded-full bg-white/5 hover:bg-[#D4AC0D] hover:text-[#0D2137] border border-white/10 flex items-center justify-center transition-colors">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display font-bold text-[13px] uppercase tracking-[0.18em] text-[#D4AC0D] mb-4">Navegação</h4>
            <ul className="space-y-2.5 text-[14px]">
              {NAV.map((n) => (
                <li key={n.id}>
                  <button onClick={() => scrollTo(n.id)} className="text-white/70 hover:text-white transition-colors">
                    {n.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display font-bold text-[13px] uppercase tracking-[0.18em] text-[#D4AC0D] mb-4">Contato</h4>
            <ul className="space-y-3 text-[14px] text-white/70">
              <li className="flex items-start gap-2.5"><Phone className="w-4 h-4 mt-0.5 text-[#D4AC0D]" /> +55 (00) 0000-0000</li>
              <li className="flex items-start gap-2.5"><Mail className="w-4 h-4 mt-0.5 text-[#D4AC0D]" /> contato@infinitnetwork.com.br</li>
              <li className="flex items-start gap-2.5"><MapPin className="w-4 h-4 mt-0.5 text-[#D4AC0D]" /> Brasil</li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[12.5px] text-white/50">© {new Date().getFullYear()} INFINIT NETWORK. Todos os direitos reservados.</p>
          <p className="text-[12.5px] text-white/50">CNPJ 00.000.000/0001-00</p>
        </div>
      </footer>
    </div>
  );
}