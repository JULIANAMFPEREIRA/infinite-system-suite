import { useState } from "react";
import { Package, BookOpen } from "lucide-react";
import DataTable from "@/components/ui/data-table";

interface Produto {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
  marca: string;
  ultimoPreco: number;
  qtdEstoque: number;
  estoqueMin: number;
}

interface EstoqueItem {
  id: number;
  produto: string;
  serie: string;
  local: string;
  status: string;
  projeto: string;
}

const catalogoData: Produto[] = [
  { id: 1, codigo: "AMP-001", nome: "Amplificador Sonos Amp", categoria: "Áudio", marca: "Sonos", ultimoPreco: 3200, qtdEstoque: 4, estoqueMin: 2 },
  { id: 2, codigo: "SW-001", nome: "Switch Ubiquiti USW-24", categoria: "Redes", marca: "Ubiquiti", ultimoPreco: 1890, qtdEstoque: 2, estoqueMin: 1 },
  { id: 3, codigo: "CAB-001", nome: "Cabo HDMI 2.1 5m", categoria: "Cabos", marca: "CaboMax", ultimoPreco: 85, qtdEstoque: 32, estoqueMin: 10 },
  { id: 4, codigo: "CTR-001", nome: "Controlador Crestron CP4", categoria: "Automação", marca: "Crestron", ultimoPreco: 8500, qtdEstoque: 1, estoqueMin: 1 },
  { id: 5, codigo: "CX-001", nome: "Caixa Embutir 6pol", categoria: "Áudio", marca: "B&W", ultimoPreco: 420, qtdEstoque: 12, estoqueMin: 4 },
];

const estoqueData: EstoqueItem[] = [
  { id: 1, produto: "Amplificador Sonos Amp", serie: "SN-2026-0041", local: "Estoque Principal", status: "Disponível", projeto: "-" },
  { id: 2, produto: "Amplificador Sonos Amp", serie: "SN-2026-0042", local: "Estoque Principal", status: "Reservado", projeto: "Proj #042" },
  { id: 3, produto: "Switch Ubiquiti USW-24", serie: "UBQ-88321", local: "Estoque Principal", status: "Disponível", projeto: "-" },
  { id: 4, produto: "Controlador Crestron CP4", serie: "CR-99201", local: "Em Obra", status: "Instalado", projeto: "Proj #039" },
  { id: 5, produto: "Caixa Embutir 6pol", serie: "BW-11201", local: "Estoque Secundário", status: "Disponível", projeto: "-" },
];

const Estoque = () => {
  const [tab, setTab] = useState<"catalogo" | "fisico">("catalogo");
  const [catalogo, setCatalogo] = useState(catalogoData);
  const [estoque, setEstoque] = useState(estoqueData);

  const catalogoColumns = [
    { key: "codigo" as const, label: "Código", width: "80px" },
    { key: "nome" as const, label: "Produto" },
    { key: "categoria" as const, label: "Categoria", type: "select" as const, options: ["Áudio", "Redes", "Cabos", "Automação", "Vídeo"] },
    { key: "marca" as const, label: "Marca" },
    { key: "ultimoPreco" as const, label: "Último Preço", type: "number" as const, render: (v: number) => `R$ ${v.toLocaleString("pt-BR")}` },
    { key: "qtdEstoque" as const, label: "Estoque", type: "number" as const, width: "70px", render: (v: number, row: Produto) => (
      <span className={v <= row.estoqueMin ? "text-destructive font-semibold" : ""}>{v}</span>
    )},
    { key: "estoqueMin" as const, label: "Mín.", type: "number" as const, width: "60px" },
  ];

  const estoqueColumns = [
    { key: "produto" as const, label: "Produto" },
    { key: "serie" as const, label: "Nº Série" },
    { key: "local" as const, label: "Local", type: "select" as const, options: ["Estoque Principal", "Estoque Secundário", "Em Obra"] },
    { key: "status" as const, label: "Status", type: "select" as const, options: ["Disponível", "Reservado", "Instalado"], render: (v: string) => (
      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${v === "Disponível" ? "bg-success/15 text-success" : v === "Reservado" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"}`}>{v}</span>
    )},
    { key: "projeto" as const, label: "Projeto" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Package size={18} className="text-primary" />
        <h1 className="text-lg font-bold text-foreground">Estoque</h1>
      </div>

      <div className="flex gap-1 border-b border-border">
        <button onClick={() => setTab("catalogo")} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === "catalogo" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <BookOpen size={14} />
          Catálogo de Produtos
        </button>
        <button onClick={() => setTab("fisico")} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${tab === "fisico" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <Package size={14} />
          Estoque Físico
        </button>
      </div>

      {tab === "catalogo" ? (
        <>
          <p className="text-xs text-muted-foreground">Catálogo alimentado automaticamente por compras. Clique para editar.</p>
          <DataTable columns={catalogoColumns} data={catalogo} onDataChange={setCatalogo} keyField="id" />
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Controle físico por número de série. Baixa apenas na instalação.</p>
          <DataTable columns={estoqueColumns} data={estoque} onDataChange={setEstoque} keyField="id" />
        </>
      )}
    </div>
  );
};

export default Estoque;
