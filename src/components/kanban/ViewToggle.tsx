import { List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  view: "list" | "kanban";
  onChange: (view: "list" | "kanban") => void;
}

export const ViewToggle = ({ view, onChange }: ViewToggleProps) => (
  <div className="flex items-center border border-border rounded-md overflow-hidden">
    <button
      onClick={() => onChange("list")}
      className={cn(
        "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition",
        view === "list" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
      )}
    >
      <List size={13} /> Lista
    </button>
    <button
      onClick={() => onChange("kanban")}
      className={cn(
        "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition",
        view === "kanban" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"
      )}
    >
      <LayoutGrid size={13} /> Kanban
    </button>
  </div>
);
