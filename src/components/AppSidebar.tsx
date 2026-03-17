import { Link, useLocation, useNavigate } from "react-router-dom";
import { Inbox, BarChart3, Link2, Settings, LogOut, Shield, PieChart, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useDemo } from "@/hooks/useDemo";

function getNavItems(base: string, isAdmin: boolean) {
  const items = [
    { to: `${base}/inbox`, icon: Inbox, label: "Inbox" },
    { to: `${base}/folders`, icon: FolderOpen, label: "Folders" },
    { to: `${base}/priority`, icon: BarChart3, label: "Priority View" },
    { to: `${base}/analytics`, icon: PieChart, label: "Analytics" },
    { to: `${base}/accounts`, icon: Link2, label: "Connected Accounts" },
    { to: `${base}/settings`, icon: Settings, label: "Settings" },
  ];
  if (isAdmin && base === "/app") {
    items.push({ to: `${base}/admin`, icon: Shield, label: "Admin" });
  }
  return items;
}

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, isAdmin } = useAuth();
  const isDemo = useDemo();
  const navItems = getNavItems(isDemo ? "/demo" : "/app", isAdmin);

  const handleLogout = async () => {
    if (isDemo) {
      navigate("/");
      return;
    }
    await signOut();
    navigate("/");
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar shrink-0">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <Link to="/" className="font-display text-xl font-bold tracking-tight">
          <span className="text-primary">Col</span>
          <span className="text-sidebar-foreground">labs</span>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-1">
        <div className="flex items-center justify-between px-3 py-1">
          <span className="text-xs text-sidebar-foreground/50">Theme</span>
          <ThemeToggle />
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
