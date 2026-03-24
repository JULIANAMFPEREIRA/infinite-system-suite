import { Construction } from "lucide-react";

interface ModulePageProps {
  title: string;
  description: string;
  icon: React.ElementType;
}

const ModulePage = ({ title, description, icon: Icon }: ModulePageProps) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4 animate-fade-in">
      <div className="p-4 rounded-2xl bg-primary/10 text-primary">
        <Icon size={40} />
      </div>
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <p className="text-muted-foreground max-w-md">{description}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground/60 mt-4">
        <Construction size={14} />
        <span>Módulo em desenvolvimento</span>
      </div>
    </div>
  );
};

export default ModulePage;
