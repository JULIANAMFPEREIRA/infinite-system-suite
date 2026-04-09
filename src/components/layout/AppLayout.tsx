import { useState } from "react";
import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import TopBar from "./TopBar";

const AppLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <AppSidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="md:ml-56 flex flex-col min-h-screen transition-all duration-300">
        <TopBar onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)} />
        <main className="flex-1 p-3 md:p-5 overflow-auto">
          <Outlet />
        </main>
        <footer className="px-5 py-2 border-t border-border text-center">
          <p className="text-[11px] text-muted-foreground italic">
            "O Senhor é o meu pastor, nada me faltará." — Salmos 23
          </p>
        </footer>
      </div>
    </div>
  );
};

export default AppLayout;
