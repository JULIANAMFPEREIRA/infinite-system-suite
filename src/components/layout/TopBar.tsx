import { Bell, Search, User } from "lucide-react";

const TopBar = () => {
  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md flex items-center justify-between px-6">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <Search size={18} className="text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar..."
          className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground w-full"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse-glow" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">Admin</p>
            <p className="text-xs text-muted-foreground">SMP Consultoria</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
            <User size={16} className="text-primary" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
