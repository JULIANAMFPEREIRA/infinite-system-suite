import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import TopBar from "./TopBar";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="ml-64 flex flex-col min-h-screen transition-all duration-300">
        <TopBar />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
        <footer className="px-6 py-3 border-t border-border text-center">
          <p className="text-xs text-muted-foreground italic">
            "O Senhor é o meu pastor, nada me faltará." — Salmos 23
          </p>
        </footer>
      </div>
    </div>
  );
};

export default AppLayout;
