import { Bell, Search, User } from "lucide-react";
import logoGold from "@/assets/logo-gold.jpeg";

const TopBar = () => {
  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-3 flex-1 max-w-xs">
        <Search size={16} className="text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar..."
          className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground w-full"
        />
      </div>

      <div className="absolute left-1/2 -translate-x-1/2">
        <img src={logoGold} alt="INFINIT NETWORK" className="h-9 object-contain" />
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right">
            <p className="text-xs font-medium text-foreground">Admin</p>
            <p className="text-[11px] text-muted-foreground">SMP Consultoria</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center border border-primary/30">
            <User size={14} className="text-primary" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
