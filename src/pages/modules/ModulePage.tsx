import { Construction } from "lucide-react";

interface ModulePageProps {
  title: string;
  description: string;
  icon: React.ElementType;
}

const ModulePage = ({ title, description, icon: Icon }: ModulePageProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-3 animate-fade-in">
      <div className="p-3 rounded-lg bg-primary/10 text-primary">
        <Icon size={32} />
      </div>
      <h1 className="text-lg font-bold text-foreground">{title}</h1>
      <p className="text-xs text-muted-foreground max-w-md">{description}</p>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60 mt-3">
        <Construction size={12} />
        <span>Módulo em desenvolvimento</span>
      </div>
    </div>
  );
};

export default ModulePage;
