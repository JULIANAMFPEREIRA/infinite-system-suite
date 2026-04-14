import { useState } from "react";
import { Filter, X } from "lucide-react";

interface FilterOption {
  value: string;
  label: string;
}

interface FinanceiroFiltersProps {
  statusOptions: FilterOption[];
  statusFilter: string;
  onStatusChange: (v: string) => void;
  periodoFilter: string;
  onPeriodoChange: (v: string) => void;
  mesFilter: string;
  onMesChange: (v: string) => void;
  anoFilter: string;
  onAnoChange: (v: string) => void;
  extraFilters?: React.ReactNode;
}

const PERIODO_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "dia", label: "Hoje" },
  { value: "mes", label: "Mês" },
  { value: "ano", label: "Ano" },
];

const MES_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "01", label: "Jan" }, { value: "02", label: "Fev" },
  { value: "03", label: "Mar" }, { value: "04", label: "Abr" },
  { value: "05", label: "Mai" }, { value: "06", label: "Jun" },
  { value: "07", label: "Jul" }, { value: "08", label: "Ago" },
  { value: "09", label: "Set" }, { value: "10", label: "Out" },
  { value: "11", label: "Nov" }, { value: "12", label: "Dez" },
];

const currentYear = new Date().getFullYear();
const ANO_OPTIONS = [
  { value: "", label: "Todos" },
  ...Array.from({ length: 5 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  })),
];

const selectCls = "h-7 px-2 text-[11px] bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary";

const FinanceiroFilters = ({
  statusOptions,
  statusFilter,
  onStatusChange,
  periodoFilter,
  onPeriodoChange,
  mesFilter,
  onMesChange,
  anoFilter,
  onAnoChange,
  extraFilters,
}: FinanceiroFiltersProps) => {
  const hasActive = statusFilter || periodoFilter || mesFilter || anoFilter;

  const clearAll = () => {
    onStatusChange("");
    onPeriodoChange("");
    onMesChange("");
    onAnoChange("");
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter size={13} className="text-muted-foreground" />
      <select value={statusFilter} onChange={e => onStatusChange(e.target.value)} className={selectCls}>
        {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select value={periodoFilter} onChange={e => onPeriodoChange(e.target.value)} className={selectCls}>
        {PERIODO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {(periodoFilter === "mes" || periodoFilter === "") && (
        <select value={mesFilter} onChange={e => onMesChange(e.target.value)} className={selectCls}>
          {MES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      <select value={anoFilter} onChange={e => onAnoChange(e.target.value)} className={selectCls}>
        {ANO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {extraFilters}
      {hasActive && (
        <button onClick={clearAll} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors" title="Limpar filtros">
          <X size={12} /> Limpar
        </button>
      )}
    </div>
  );
};

/** Apply date filters to a list of items */
export const applyDateFilter = (
  items: any[],
  dateField: string,
  periodo: string,
  mes: string,
  ano: string,
) => {
  const today = new Date();
  return items.filter(item => {
    const dateStr = item[dateField];
    if (!dateStr && (periodo || mes || ano)) return false;
    if (!dateStr) return true;
    const d = new Date(dateStr + "T00:00:00");

    if (ano && d.getFullYear() !== Number(ano)) return false;
    if (mes && String(d.getMonth() + 1).padStart(2, "0") !== mes) return false;
    if (periodo === "dia") {
      return d.toDateString() === today.toDateString();
    }
    if (periodo === "mes") {
      return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    }
    if (periodo === "ano") {
      return d.getFullYear() === today.getFullYear();
    }
    return true;
  });
};

export default FinanceiroFilters;
