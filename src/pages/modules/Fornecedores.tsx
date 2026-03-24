import { useState } from "react";
import { Truck, Plus } from "lucide-react";
import DataTable from "@/components/ui/data-table";

interface Fornecedor {
  id: number;
  nome: string;
  tipo: string;
  cnpjCpf: string;
  telefone: string;
  email: string;
  rt: number | null;
  cidade: string;
}

const initialData: Fornecedor[] = [
  { id: 1, nome: "AudioTech Distribuidora", tipo: "Fornecedor", cnpjCpf: "12.345.678/0001-90", telefone: "(11) 99999-0001", email: "contato@audiotech.com", rt: null, cidade: "São Paulo" },
  { id: 2, nome: "NetSupply", tipo: "Fornecedor", cnpjCpf: "23.456.789/0001-01", telefone: "(11) 98888-0002", email: "vendas@netsupply.com", rt: null, cidade: "Campinas" },
  { id: 3, nome: "Marina Lopes Arquitetura", tipo: "Arquiteto", cnpjCpf: "345.678.901-23", telefone: "(11) 97777-0003", email: "marina@arq.com", rt: 8, cidade: "São Paulo" },
  { id: 4, nome: "CaboMax", tipo: "Fornecedor", cnpjCpf: "34.567.890/0001-12", telefone: "(21) 96666-0004", email: "comercial@cabomax.com", rt: null, cidade: "Rio de Janeiro" },
  { id: 5, nome: "Arq. Roberto Santos", tipo: "Arquiteto", cnpjCpf: "567.890.123-45", telefone: "(11) 95555-0005", email: "roberto@santos.arq", rt: 10, cidade: "São Paulo" },
];

const Fornecedores = () => {
  const [data, setData] = useState(initialData);

  const columns = [
    { key: "nome" as const, label: "Nome / Razão Social" },
    { key: "tipo" as const, label: "Tipo", type: "select" as const, options: ["Fornecedor", "Arquiteto"], render: (v: string) => (
      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${v === "Arquiteto" ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground"}`}>{v}</span>
    )},
    { key: "cnpjCpf" as const, label: "CNPJ/CPF" },
    { key: "telefone" as const, label: "Telefone" },
    { key: "email" as const, label: "E-mail" },
    { key: "rt" as const, label: "RT (%)", type: "number" as const, width: "70px", render: (v: number | null, row: Fornecedor) => (
      row.tipo === "Arquiteto" ? <span className="text-primary font-semibold">{v ?? 0}%</span> : <span className="text-muted-foreground">—</span>
    )},
    { key: "cidade" as const, label: "Cidade" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Fornecedores & Arquitetos</h1>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} />
          Novo Cadastro
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Cadastro unificado. Para arquitetos, o campo RT (%) é habilitado. Clique para editar.</p>
      <DataTable columns={columns} data={data} onDataChange={setData} keyField="id" />
    </div>
  );
};

export default Fornecedores;
