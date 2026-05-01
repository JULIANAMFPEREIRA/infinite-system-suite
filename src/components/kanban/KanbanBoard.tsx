import { useState, useRef } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KanbanColumn<T> {
  key: string;
  label: string;
  color: string;
  borderColor: string;
  bgColor: string;
}

export interface KanbanCardData {
  id: string;
  columnKey: string;
  [key: string]: any;
}

interface KanbanBoardProps<T extends KanbanCardData> {
  columns: KanbanColumn<T>[];
  items: T[];
  onMove: (itemId: string, fromColumn: string, toColumn: string) => void;
  onCardClick?: (item: T) => void;
  renderCard: (item: T) => React.ReactNode;
  itemsLimit?: number;
  kanbanLimits?: Record<string, number>;
  onLoadMore?: (columnKey: string) => void;
}

export function KanbanBoard<T extends KanbanCardData>({
  columns,
  items,
  onMove,
  onCardClick,
  renderCard,
  itemsLimit,
  kanbanLimits,
  onLoadMore,
}: KanbanBoardProps<T>) {
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragSourceCol = useRef<string | null>(null);

  const handleDragStart = (e: React.DragEvent, item: T) => {
    setDragItem(item.id);
    dragSourceCol.current = item.columnKey;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colKey);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(null);
    if (dragItem && dragSourceCol.current && dragSourceCol.current !== colKey) {
      onMove(dragItem, dragSourceCol.current, colKey);
    }
    setDragItem(null);
    dragSourceCol.current = null;
  };

  const handleDragEnd = () => {
    setDragItem(null);
    setDragOverCol(null);
    dragSourceCol.current = null;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2" style={{ height: "calc(100vh - 220px)" }}>
      {columns.map((col) => {
        const colItems = items.filter((i) => i.columnKey === col.key);
        const isOver = dragOverCol === col.key;
        const limit =
          itemsLimit !== undefined
            ? kanbanLimits?.[col.key] ?? itemsLimit
            : undefined;
        const visibleItems =
          limit !== undefined ? colItems.slice(0, limit) : colItems;
        const hiddenCount =
          limit !== undefined ? Math.max(0, colItems.length - limit) : 0;

        return (
          <div
            key={col.key}
            className={cn(
              "flex-shrink-0 w-[260px] rounded-lg border flex flex-col transition-all h-full",
              col.borderColor,
              col.bgColor,
              isOver && "ring-2 ring-primary/40 scale-[1.01]"
            )}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
          >
            <div className={cn("px-3 py-2 border-b flex items-center justify-between flex-shrink-0", col.borderColor)}>
              <span className={cn("text-xs font-bold uppercase tracking-wide", col.color)}>
                {col.label}
              </span>
              <span className={cn("text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-background/60", col.color)}>
                {limit !== undefined && hiddenCount > 0
                  ? `${visibleItems.length} de ${colItems.length}`
                  : colItems.length}
              </span>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-0 pb-2">
              {colItems.length === 0 && (
                <div className="text-[11px] text-muted-foreground text-center py-6 italic">
                  Nenhum item
                </div>
              )}
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onCardClick?.(item)}
                  className={cn(
                    "bg-card border border-border rounded-md p-2.5 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group",
                    dragItem === item.id && "opacity-40 scale-95"
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    <GripVertical size={12} className="text-muted-foreground/40 mt-0.5 flex-shrink-0 group-hover:text-muted-foreground transition" />
                    <div className="flex-1 min-w-0">{renderCard(item)}</div>
                  </div>
                </div>
              ))}
              {hiddenCount > 0 && onLoadMore && (
                <button
                  type="button"
                  onClick={() => onLoadMore(col.key)}
                  className="w-full text-xs text-muted-foreground hover:text-primary py-2 transition-colors"
                >
                  + Ver mais {hiddenCount} {hiddenCount === 1 ? "item" : "itens"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
