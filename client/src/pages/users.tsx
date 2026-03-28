import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { 
  Users, 
  Shield, 
  UserCog,
  Eye
} from "lucide-react";
import type { User, UserRole } from "@shared/schema";

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  operator: "Operador",
  auditor: "Auditor",
};

const roleColors: Record<UserRole, string> = {
  admin: "bg-primary text-primary-foreground",
  operator: "bg-blue-500 text-white",
  auditor: "bg-amber-500 text-white",
};

const roleIcons: Record<UserRole, typeof Shield> = {
  admin: Shield,
  operator: UserCog,
  auditor: Eye,
};

function UserCard({ 
  user, 
  currentUserId,
  onChangeRole,
}: { 
  user: User; 
  currentUserId: string;
  onChangeRole: (userId: string, newRole: UserRole) => void;
}) {
  const isCurrentUser = user.id === currentUserId;
  const RoleIcon = roleIcons[user.role as UserRole] || UserCog;
  
  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  return (
    <Card className={isCurrentUser ? "border-primary/50" : ""}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <Avatar className="w-12 h-12">
            <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
            <AvatarFallback>{getInitials(user.firstName, user.lastName)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate" data-testid={`text-user-name-${user.id}`}>
                {user.firstName} {user.lastName}
              </h3>
              {isCurrentUser && (
                <Badge variant="outline" className="text-xs">Tú</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate" data-testid={`text-user-email-${user.id}`}>
              {user.email}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isCurrentUser ? (
              <Badge className={roleColors[user.role as UserRole]}>
                <RoleIcon className="w-3 h-3 mr-1" />
                {roleLabels[user.role as UserRole]}
              </Badge>
            ) : (
              <Select
                value={user.role || "operator"}
                onValueChange={(value) => onChangeRole(user.id, value as UserRole)}
              >
                <SelectTrigger 
                  className="w-[160px]" 
                  data-testid={`select-role-${user.id}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Administrador
                    </div>
                  </SelectItem>
                  <SelectItem value="operator">
                    <div className="flex items-center gap-2">
                      <UserCog className="w-4 h-4" />
                      Operador
                    </div>
                  </SelectItem>
                  <SelectItem value="auditor">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Auditor
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-9 w-[160px]" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function UsersPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [confirmDialog, setConfirmDialog] = useState<{ userId: string; newRole: UserRole } | null>(null);

  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      return apiRequest("PATCH", `/api/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Rol actualizado correctamente" });
      setConfirmDialog(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Sesión expirada",
          description: "Iniciando sesión nuevamente...",
          variant: "destructive",
        });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "No se pudo actualizar el rol del usuario",
        variant: "destructive",
      });
    },
  });

  const handleChangeRole = (userId: string, newRole: UserRole) => {
    setConfirmDialog({ userId, newRole });
  };

  const confirmRoleChange = () => {
    if (confirmDialog) {
      updateRoleMutation.mutate({ userId: confirmDialog.userId, role: confirmDialog.newRole });
    }
  };

  const getUserName = (userId: string) => {
    const user = users?.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}` : "este usuario";
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">
            Administre los roles y permisos de los usuarios
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-destructive/30" />
            <h3 className="font-semibold mb-2">Acceso Denegado</h3>
            <p className="text-sm text-muted-foreground">
              Solo los administradores pueden gestionar usuarios
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
        <p className="text-muted-foreground">
          Administre los roles y permisos de los usuarios
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Administradores</p>
                <p className="text-xl font-bold">
                  {users?.filter(u => u.role === "admin").length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500">
                <UserCog className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Operadores</p>
                <p className="text-xl font-bold">
                  {users?.filter(u => u.role === "operator").length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Auditores</p>
                <p className="text-xl font-bold">
                  {users?.filter(u => u.role === "auditor").length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground shrink-0 mt-0.5">
              <Users className="w-4 h-4" />
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Roles y Permisos</p>
              <ul className="space-y-1">
                <li><strong>Administrador:</strong> Acceso completo, gestión de usuarios y configuración</li>
                <li><strong>Operador:</strong> Gestión de certificados, importación y exportación</li>
                <li><strong>Auditor:</strong> Solo lectura, visualización de certificados y reportes</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingSkeleton />
      ) : users && users.length > 0 ? (
        <div className="space-y-4">
          {users.map((user) => (
            <UserCard 
              key={user.id} 
              user={user} 
              currentUserId={currentUser?.id || ""}
              onChangeRole={handleChangeRole}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-semibold mb-2">No hay usuarios</h3>
            <p className="text-sm text-muted-foreground">
              Los usuarios aparecerán aquí cuando inicien sesión
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar rol del usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Está a punto de cambiar el rol de {confirmDialog && getUserName(confirmDialog.userId)} a{" "}
              <strong>{confirmDialog && roleLabels[confirmDialog.newRole]}</strong>. 
              Esto afectará los permisos del usuario en el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRoleChange}
              data-testid="button-confirm-role-change"
            >
              {updateRoleMutation.isPending ? "Guardando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
