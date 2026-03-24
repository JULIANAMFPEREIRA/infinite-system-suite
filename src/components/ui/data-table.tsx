import { useState, useCallback } from "react";

interface Column<T> {
  key: keyof T;
  label: string;
  width?: string;
  editable?: boolean;
  type?: "text" | "number" | "select";
  options?: string[];
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T extends Record<string, any>> {
  columns: Column<T>[];
  data: T[];
  onDataChange?: (data: T[]) => void;
  keyField: keyof T;
}

function DataTable<T extends Record<string, any>>({ columns, data, onDataChange, keyField }: DataTableProps<T>) {
  const [editingCell, setEditingCell] = useState<{ row: string | number; col: keyof T } | null>(null);
  const [localData, setLocalData] = useState(data);

  const handleCellClick = (rowKey: string | number, col: Column<T>) => {
    if (col.editable !== false) {
      setEditingCell({ row: rowKey, col: col.key });
    }
  };

  const handleCellChange = useCallback((rowKey: string | number, colKey: keyof T, value: any) => {
    const updated = localData.map(row =>
      row[keyField] === rowKey ? { ...row, [colKey]: value } : row
    );
    setLocalData(updated);
    onDataChange?.(updated);
  }, [localData, keyField, onDataChange]);

  const handleBlur = () => setEditingCell(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Escape") {
      setEditingCell(null);
    }
  };

  return (
    <div className="border border-border rounded overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-secondary/60">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className="text-left px-2.5 py-2 font-semibold text-foreground border-b border-border whitespace-nowrap"
                  style={{ width: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {localData.map((row, rowIdx) => {
              const rowKey = row[keyField];
              return (
                <tr key={String(rowKey)} className="border-b border-border last:border-b-0 hover:bg-secondary/30 transition-colors">
                  {columns.map(col => {
                    const isEditing = editingCell?.row === rowKey && editingCell?.col === col.key;
                    const value = row[col.key];

                    return (
                      <td
                        key={String(col.key)}
                        className="px-2.5 py-1.5 text-foreground cursor-default"
                        onClick={() => handleCellClick(rowKey, col)}
                      >
                        {isEditing ? (
                          col.type === "select" && col.options ? (
                            <select
                              value={String(value)}
                              onChange={(e) => handleCellChange(rowKey, col.key, e.target.value)}
                              onBlur={handleBlur}
                              autoFocus
                              className="w-full h-7 px-1 text-xs bg-background border border-primary rounded focus:outline-none"
                            >
                              {col.options.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={col.type === "number" ? "number" : "text"}
                              value={String(value ?? "")}
                              onChange={(e) => handleCellChange(rowKey, col.key, col.type === "number" ? Number(e.target.value) : e.target.value)}
                              onBlur={handleBlur}
                              onKeyDown={handleKeyDown}
                              autoFocus
                              className="w-full h-7 px-1 text-xs bg-background border border-primary rounded focus:outline-none"
                            />
                          )
                        ) : (
                          col.render ? col.render(value, row) : (
                            <span className="block truncate">{String(value ?? "")}</span>
                          )
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
