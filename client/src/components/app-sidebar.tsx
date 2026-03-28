import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Award,
  FolderOpen,
  Upload,
  History,
  LogOut,
  QrCode,
  Users,
  Building2,
  GraduationCap,
  Briefcase,
  Settings,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@shared/schema";

const menuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Certificados",
    url: "/certificates",
    icon: Award,
  },
  {
    title: "Tipos de Certificados",
    url: "/certificate-types",
    icon: FolderOpen,
  },
  {
    title: "Historial",
    url: "/history",
    icon: History,
  },
  {
    title: "Alumnos",
    url: "/students",
    icon: GraduationCap,
  },
  {
    title: "Empresas",
    url: "/companies",
    icon: Briefcase,
  },
];

const adminMenuItems = [
  {
    title: "Importar Datos",
    url: "/import",
    icon: Upload,
  },
  {
    title: "Usuarios",
    url: "/users",
    icon: Users,
  },
  {
    title: "Configuración",
    url: "/settings",
    icon: Settings,
  },
];

const superadminMenuItems = [
  {
    title: "Empresas",
    url: "/businesses",
    icon: Building2,
  },
];

const roleLabels: Record<UserRole, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  operator: "Operador",
  auditor: "Auditor",
};

function SidebarLink({ href, children, ...props }: any) {
  const { isMobile, setOpenMobile } = useSidebar();
  
  return (
    <Link 
      href={href} 
      onClick={() => {
        // Close sidebar ONLY on mobile when a link is clicked
        if (isMobile) {
          setOpenMobile(false);
        }
      }}
      {...props}
    >
      {children}
    </Link>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user, isSuperadmin, isAdmin } = useAuth();

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last || 'U';
  };

  const { logout } = useAuth();

  return (
    <Sidebar className="border-r-0">
      <SidebarHeader className="p-5 border-b border-sidebar-border/50">
        <SidebarLink href="/dashboard">
          <div className="flex items-center gap-3 cursor-pointer group" data-testid="link-logo">
            {user?.business?.logoUrl ? (
              <div className="w-11 h-11 rounded-xl overflow-hidden shadow-md transition-transform group-hover:scale-105 bg-white flex items-center justify-center">
                <img 
                  src={user.business.logoUrl} 
                  alt={user.business.name || "Logo"} 
                  className="w-full h-full object-contain p-1"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-105">
                <QrCode className="w-6 h-6" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
                {user?.business?.name || "certiva.app"}
              </span>
              <span className="text-xs text-sidebar-foreground/60">Certificaciones Digitales</span>
            </div>
          </div>
        </SidebarLink>
      </SidebarHeader>
      
      <SidebarContent className="sidebar-content-scroll">
        {isSuperadmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-5 py-3">
              Super Admin
            </SidebarGroupLabel>
            <SidebarGroupContent className="px-3">
              <SidebarMenu className="space-y-1">
                {superadminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      className="h-10 rounded-lg transition-all duration-200"
                    >
                      <SidebarLink href={item.url} data-testid={`link-${item.url.slice(1)}`}>
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.title}</span>
                      </SidebarLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-5 py-3">
            {isSuperadmin ? "Vista Global" : "Menú Principal"}
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-3">
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    className="h-10 rounded-lg transition-all duration-200"
                  >
                    <SidebarLink href={item.url} data-testid={`link-${item.url.slice(1)}`}>
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.title}</span>
                    </SidebarLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40 px-5 py-3">
              Administración
            </SidebarGroupLabel>
            <SidebarGroupContent className="px-3">
              <SidebarMenu className="space-y-1">
                {adminMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      className="h-10 rounded-lg transition-all duration-200"
                    >
                      <SidebarLink href={item.url} data-testid={`link-${item.url.slice(1)}`}>
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.title}</span>
                      </SidebarLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border/50">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-sidebar-accent/50 mb-3">
          <Avatar className="w-10 h-10 ring-2 ring-primary/20">
            <AvatarImage 
              src={user?.profileImageUrl || undefined} 
              alt={`${user?.firstName || 'Usuario'}`}
              className="object-cover"
            />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
              {getInitials(user?.firstName, user?.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-sidebar-foreground truncate" data-testid="text-user-name">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user?.email || 'Usuario'}
              </span>
            </div>
            <span className="text-xs text-sidebar-foreground/60 truncate" data-testid="text-user-email">
              {user?.email || ''}
            </span>
            {user?.business && (
              <span className="text-xs text-sidebar-foreground/50 truncate" data-testid="text-user-business">
                {user.business.name}
              </span>
            )}
          </div>
          {user?.role && (
            <Badge className="bg-primary/20 text-primary border-0 text-[10px] shrink-0" data-testid="badge-user-role">
              {roleLabels[user.role as UserRole] || user.role}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="w-4 h-4" />
          Cerrar Sesión
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
