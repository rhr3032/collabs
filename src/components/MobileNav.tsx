import { Link, useLocation } from "react-router-dom";
import { Inbox, BarChart3, Link2, Settings, Menu, X, PieChart, FolderOpen } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/button";
import { useDemo } from "@/hooks/useDemo";

function getNavItems(base: string) {
  return [
    { to: `${base}/inbox`, icon: Inbox, label: "Inbox" },
    { to: `${base}/folders`, icon: FolderOpen, label: "Folders" },
    { to: `${base}/priority`, icon: BarChart3, label: "Priority" },
    { to: `${base}/analytics`, icon: PieChart, label: "Analytics" },
    { to: `${base}/accounts`, icon: Link2, label: "Accounts" },
    { to: `${base}/settings`, icon: Settings, label: "Settings" },
  ];
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isDemo = useDemo();
  const navItems = getNavItems(isDemo ? "/demo" : "/app");

  return (
    <div className="md:hidden">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <Link to="/" className="font-display text-lg font-bold tracking-tight">
          <span className="text-primary">Col</span>
          <span className="text-foreground">labs</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {open && (
        <nav className="border-b border-border bg-background p-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
