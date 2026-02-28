import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Database, 
  Sparkles, 
  MessageSquare,
  ChevronRight,
  Trophy,
  PlayCircle,
  Tag
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: any;
  children?: NavItem[];
}

const getNavItems = (t: any): NavItem[] => [
  { label: t('navigation.home'), path: "/", icon: Home },
  { label: t('navigation.datasets'), path: "/datasets", icon: Database },
  { label: t('navigation.synthesis'), path: "/synthesis", icon: Sparkles },
  { label: t('navigation.model_playground'), path: "/dialogue_bs", icon: MessageSquare },
  { label: t('navigation.rl_playground'), path: "/rl-playground", icon: PlayCircle },
  { label: t('navigation.annotations'), path: "/annotation", icon: Tag }
];

interface SidebarLayoutProps {
  children: ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const toggleExpand = (path: string) => {
    setExpandedItems(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col">
        {/* Logo */}
        <div className="h-16 border-b flex items-center px-6">
          <img
            src="/static/ant-international-logo.png"
            alt="Ant International"
            className="h-8 object-contain"
            onError={(e) => {
              // Fallback if image doesn't exist
              const img = e.target as HTMLImageElement;
              img.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.className = 'text-lg font-bold text-gray-800';
              fallback.textContent = 'CoEvoLoop';
              img.parentElement?.appendChild(fallback);
            }}
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {getNavItems(t).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const expanded = expandedItems.includes(item.path);
            const hasChildren = item.children && item.children.length > 0;

            return (
              <div key={item.path}>
                <button
                  onClick={() => {
                    if (hasChildren) {
                      toggleExpand(item.path);
                    }
                    navigate(item.path);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-blue-50 text-blue-700 border-r-4 border-blue-700"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {hasChildren && (
                    <ChevronRight 
                      className={cn(
                        "w-4 h-4 transition-transform",
                        expanded && "transform rotate-90"
                      )} 
                    />
                  )}
                </button>

                {/* Children */}
                {hasChildren && expanded && (
                  <div className="bg-gray-50">
                    {item.children?.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = location.pathname === child.path;

                      return (
                        <button
                          key={child.path}
                          onClick={() => navigate(child.path)}
                          className={cn(
                            "w-full flex items-center gap-3 pl-14 pr-6 py-2.5 text-sm transition-colors",
                            childActive
                              ? "bg-blue-100 text-blue-700 font-medium"
                              : "text-gray-600 hover:bg-gray-100"
                          )}
                        >
                          <ChildIcon className="w-4 h-4" />
                          <span>{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
