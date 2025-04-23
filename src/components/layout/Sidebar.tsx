
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  ListFilter, 
  MessageSquareText, 
  Settings, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";


type NavItem = {
  title: string;
  href: string;
  icon: React.ElementType;
};

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: BarChart3,
  },
  {
    title: "Interactions",
    href: "/interactions",
    icon: MessageSquareText,
  },
  {
    title: "Agents",
    href: "/agents",
    icon: ListFilter,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  
  return (
    <div className={cn(
      "bg-sidebar relative h-screen border-r border-border transition-all duration-300 ease-in-out",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-full flex-col gap-2">
        <div className="flex h-14 items-center border-b border-border px-4">
          {!collapsed && (
            <h1 className="font-semibold text-lg" style={{ color: 'var(--primary)' }}>Pathsetter</h1>
          )}
          {collapsed && (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-pulse-100">
              <span className="font-bold text-pulse-700">P</span>
            </div>
          )}
        </div>
        
        <nav className="flex-1 space-y-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all hover:bg-accent",
                  isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          ))}
        </nav>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
      </div>
    </div>
  );
}
