import { useState } from "react";
import { ShoppingCart, Plus } from "lucide-react";
import DataTable from "@/components/ui/data-table";

interface Compra {
  id: number;
  data: string;
  fornecedor: string;
  tipo: string;
  projeto: string;
  item: string;
  qtd: number;
  valorUnit: number;
  total: number;
  status: string;
}

const initialData: Compra[] = [
  { id: 1, data: "2026-03-20", fornecedor: "AudioTech", tipo: "Fornecedor", projeto: "Proj #042", item: "Amplificador Sonos", qtd: 2, valorUnit: 3200, total: 6400, status: "Aprovada" },
  { id: 2, data: "2026-03-18", fornecedor: "NetSupply", tipo: "Fornecedor", projeto: "Proj #041", item: "Switch Ubiquiti 24P", qtd: 1, valorUnit: 1890, total: 1890, status: "Pendente" },
  { id: 3, data: "2026-03-15", fornecedor: "CaboMax", tipo: "Fornecedor", projeto: "Proj #042", item: "Cabo HDMI 2.1 5m", qtd: 10, valorUnit: 85, total: 850, status: "Entregue" },
  { id: 4, data: "2026-03-12", fornecedor: "SmartHome BR", tipo: "Fornecedor", projeto: "Proj #039", item: "Controlador Crestron", qtd: 1, valorUnit: 8500, total: 8500, status: "Aprovada" },
  { id: 5, data: "2026-03-10", fornecedor: "AudioTech", tipo: "Fornecedor", projeto: "Proj #040", item: "Caixa Embutir 6pol", qtd: 8, valorUnit: 420, total: 3360, status: "Pendente" },
];

const Compras = () => {
  const [data, setData] = useState(initialData);

  const columns = [
    { key: "data" as const, label: "Data", width: "90px" },
    { key: "fornecedor" as const, label: "Fornecedor" },
    { key: "tipo" as const, label: "Tipo", type: "select" as const, options: ["Fornecedor", "Arquiteto"] },
    { key: "projeto" as const, label: "Projeto" },
    { key: "item" as const, label: "Item" },
    { key: "qtd" as const, label: "Qtd", type: "number" as const, width: "60px" },
    { key: "valorUnit" as const, label: "Valor Unit.", type: "number" as const, width: "90px", render: (v: number) => `R$ ${v.toLocaleString("pt-BR")}` },
    { key: "total" as const, label: "Total", width: "90px", editable: false, render: (v: number) => <span className="font-semibold">R$ {v.toLocaleString("pt-BR")}</span> },
    { key: "status" as const, label: "Status", type: "select" as const, options: ["Pendente", "Aprovada", "Entregue", "Cancelada"], render: (v: string) => (
      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${v === "Aprovada" ? "bg-success/15 text-success" : v === "Pendente" ? "bg-warning/15 text-warning" : v === "Entregue" ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>{v}</span>
    )},
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Compras</h1>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} />
          Nova Compra
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Compras manuais e automáticas baseadas na necessidade do projeto. Clique em qualquer célula para editar.</p>
      <DataTable columns={columns} data={data} onDataChange={setData} keyField="id" />
    </div>
  );
};

export default Compras;
