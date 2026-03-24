import { useState } from "react";
import { Wallet, Plus } from "lucide-react";
import DataTable from "@/components/ui/data-table";

interface GastoPessoal {
  id: number;
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  tipo: string;
}

const initialData: GastoPessoal[] = [
  { id: 1, data: "2026-03-22", descricao: "Retirada mensal", categoria: "Retirada", valor: 8000, tipo: "Despesa" },
  { id: 2, data: "2026-03-20", descricao: "Devolução parcial", categoria: "Devolução", valor: 2000, tipo: "Receita" },
  { id: 3, data: "2026-03-15", descricao: "Aluguel pessoal", categoria: "Moradia", valor: 3500, tipo: "Despesa" },
  { id: 4, data: "2026-03-10", descricao: "Renda extra freelance", categoria: "Outros", valor: 1500, tipo: "Receita" },
  { id: 5, data: "2026-03-05", descricao: "Cartão pessoal", categoria: "Cartão", valor: 2200, tipo: "Despesa" },
];

const FinancasPessoais = () => {
  const [data, setData] = useState(initialData);

  const saldo = data.reduce((acc, item) => item.tipo === "Receita" ? acc + item.valor : acc - item.valor, 0);

  const columns = [
    { key: "data" as const, label: "Data", width: "90px" },
    { key: "descricao" as const, label: "Descrição" },
    { key: "categoria" as const, label: "Categoria", type: "select" as const, options: ["Retirada", "Devolução", "Moradia", "Cartão", "Alimentação", "Outros"] },
    { key: "valor" as const, label: "Valor", type: "number" as const, render: (v: number) => `R$ ${v.toLocaleString("pt-BR")}` },
    { key: "tipo" as const, label: "Tipo", type: "select" as const, options: ["Receita", "Despesa"], render: (v: string) => (
      <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${v === "Receita" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{v}</span>
    )},
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Finanças Pessoais</h1>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium hover:brightness-105 transition">
          <Plus size={14} />
          Novo Lançamento
        </button>
      </div>

      <div className="bg-card border border-border rounded p-3 inline-flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Saldo Atual:</span>
        <span className={`text-sm font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>
          R$ {Math.abs(saldo).toLocaleString("pt-BR")} {saldo < 0 ? "(negativo)" : ""}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">Controle separado da empresa. Retiradas e devoluções com saldo automático.</p>
      <DataTable columns={columns} data={data} onDataChange={setData} keyField="id" />
    </div>
  );
};

export default FinancasPessoais;
