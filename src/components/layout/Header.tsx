
import { ReactNode } from "react";
import { Sparkles, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function Header({ title, description, children }: HeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border px-6 py-3">
      <div>
        <h1 className="text-2xl font-semibold text-foreground flex items-center">
          {title}
          <Sparkles className="ml-2 h-5 w-5 text-blue-600" />
        </h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="w-64 pl-8 h-9 bg-background border-border"
          />
        </div>
        {children}
      </div>
    </div>
  );
}
