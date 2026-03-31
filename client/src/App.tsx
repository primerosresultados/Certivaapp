import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import CertificateTypes from "@/pages/certificate-types";
import Certificates from "@/pages/certificates";
import CertificateDetail from "@/pages/certificate-detail";
import Import from "@/pages/import";
import History from "@/pages/history";
import Validate from "@/pages/validate";
import Users from "@/pages/users";
import Businesses from "@/pages/businesses";
import Companies from "@/pages/companies";
import Students from "@/pages/students";
import Settings from "@/pages/settings";

function AppLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "280px",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-4 bg-background/80 backdrop-blur-md px-6 py-4 border-b border-border/50">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="text-muted-foreground hover:text-foreground" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-6 md:p-8 lg:p-10 bg-background">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/certificate-types" component={CertificateTypes} />
        <Route path="/certificates" component={Certificates} />
        <Route path="/certificates/:id" component={CertificateDetail} />
        <Route path="/import" component={Import} />
        <Route path="/history" component={History} />
        <Route path="/students" component={Students} />
        <Route path="/companies" component={Companies} />
        <Route path="/users" component={Users} />
        <Route path="/businesses" component={Businesses} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/validate/:id" component={Validate} />
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <Route component={AuthenticatedRoutes} />
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
