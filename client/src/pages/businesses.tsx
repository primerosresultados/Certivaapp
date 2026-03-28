import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Business, User } from "@shared/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Plus, Pencil, Trash2, Users, Award, Eye, EyeOff } from "lucide-react";

const businessSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  slug: z.string().min(2, "El slug debe tener al menos 2 caracteres").regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  adminEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  adminPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional().or(z.literal("")),
});

const createBusinessWithAdminSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  slug: z.string().min(2, "El slug debe tener al menos 2 caracteres").regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones"),
  adminEmail: z.string().email("Email inválido"),
  adminPassword: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  adminFirstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  adminLastName: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
});

const adminUserSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  firstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  lastName: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
});

type BusinessFormData = z.infer<typeof businessSchema>;
type CreateBusinessWithAdminFormData = z.infer<typeof createBusinessWithAdminSchema>;
type AdminUserFormData = z.infer<typeof adminUserSchema>;

interface BusinessWithStats extends Business {
  usersCount?: number;
  certificatesCount?: number;
}

export default function Businesses() {
  const { isSuperadmin, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessWithStats | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { data: businesses, isLoading: businessesLoading } = useQuery<BusinessWithStats[]>({
    queryKey: ["/api/businesses"],
    enabled: isSuperadmin,
  });

  const createForm = useForm<CreateBusinessWithAdminFormData>({
    resolver: zodResolver(createBusinessWithAdminSchema),
    defaultValues: {
      name: "",
      slug: "",
      adminEmail: "",
      adminPassword: "",
      adminFirstName: "",
      adminLastName: "",
    },
  });

  const editForm = useForm<BusinessFormData>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const adminForm = useForm<AdminUserFormData>({
    resolver: zodResolver(adminUserSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateBusinessWithAdminFormData) => {
      const res = await apiRequest("POST", "/api/businesses", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Empresa creada",
        description: "La empresa y su administrador se han creado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
      setCreateDialogOpen(false);
      createForm.reset();
      setShowPassword(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la empresa.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: BusinessFormData }) => {
      const res = await apiRequest("PATCH", `/api/businesses/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Empresa actualizada",
        description: "La empresa se ha actualizado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
      setEditDialogOpen(false);
      setSelectedBusiness(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la empresa.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/businesses/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Empresa eliminada",
        description: "La empresa se ha eliminado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
      setDeleteDialogOpen(false);
      setSelectedBusiness(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar la empresa.",
        variant: "destructive",
      });
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: async ({ businessId, data }: { businessId: string; data: AdminUserFormData }) => {
      const res = await apiRequest("POST", `/api/businesses/${businessId}/admin`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Administrador creado",
        description: "El administrador se ha creado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/businesses"] });
      setAdminDialogOpen(false);
      setSelectedBusiness(null);
      adminForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el administrador.",
        variant: "destructive",
      });
    },
  });

  const handleOpenEdit = (business: BusinessWithStats) => {
    setSelectedBusiness(business);
    
    // Buscar el email del admin en los usuarios si es posible, o resetearlo
    // Como el endpoint /api/businesses no devuelve el email del admin directamente,
    // podríamos necesitar obtenerlo o simplemente dejarlo vacío para edición opcional
    editForm.reset({
      name: business.name,
      slug: business.slug,
      adminEmail: "",
      adminPassword: "",
    });
    setEditDialogOpen(true);
  };

  const handleOpenDelete = (business: BusinessWithStats) => {
    setSelectedBusiness(business);
    setDeleteDialogOpen(true);
  };

  const handleOpenAdmin = (business: BusinessWithStats) => {
    setSelectedBusiness(business);
    adminForm.reset({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
    });
    setAdminDialogOpen(true);
  };

  const handleCreateSubmit = (data: CreateBusinessWithAdminFormData) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: BusinessFormData) => {
    if (selectedBusiness) {
      updateMutation.mutate({ id: selectedBusiness.id, data });
      setShowPassword(false);
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedBusiness) {
      deleteMutation.mutate(selectedBusiness.id);
    }
  };

  const handleAdminSubmit = (data: AdminUserFormData) => {
    if (selectedBusiness) {
      createAdminMutation.mutate({ businessId: selectedBusiness.id, data });
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  useEffect(() => {
    if (!authLoading && !isSuperadmin) {
      setLocation("/dashboard");
    }
  }, [authLoading, isSuperadmin, setLocation]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Gestión de Empresas
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Administra las empresas del sistema multi-tenant
          </p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          data-testid="button-create-business"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva Empresa
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Empresas Registradas
          </CardTitle>
          <CardDescription>
            {businesses?.length || 0} empresas en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {businessesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : businesses && businesses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-center">Usuarios</TableHead>
                  <TableHead className="text-center">Certificados</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.map((business) => (
                  <TableRow key={business.id} data-testid={`row-business-${business.id}`}>
                    <TableCell className="font-medium" data-testid={`text-business-name-${business.id}`}>
                      {business.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground" data-testid={`text-business-slug-${business.id}`}>
                      {business.slug}
                    </TableCell>
                    <TableCell className="text-center" data-testid={`text-business-users-${business.id}`}>
                      <div className="flex items-center justify-center gap-1">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{business.usersCount || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center" data-testid={`text-business-certificates-${business.id}`}>
                      <div className="flex items-center justify-center gap-1">
                        <Award className="w-4 h-4 text-muted-foreground" />
                        <span>{business.certificatesCount || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={business.isActive ? "default" : "secondary"}
                        data-testid={`badge-business-status-${business.id}`}
                      >
                        {business.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenAdmin(business)}
                          data-testid={`button-add-admin-${business.id}`}
                          title="Crear Administrador"
                        >
                          <Users className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(business)}
                          data-testid={`button-edit-business-${business.id}`}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDelete(business)}
                          data-testid={`button-delete-business-${business.id}`}
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No hay empresas</h3>
              <p className="text-muted-foreground mb-4">
                Crea la primera empresa para empezar a gestionar certificaciones
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Empresa
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={(open) => {
        setCreateDialogOpen(open);
        if (!open) setShowPassword(false);
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva Empresa</DialogTitle>
            <DialogDescription>
              Crea una nueva empresa con su administrador
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Datos de la Empresa</h4>
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Empresa</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Mi Empresa S.A."
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            createForm.setValue("slug", generateSlug(e.target.value));
                          }}
                          data-testid="input-business-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Slug (identificador único)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="mi-empresa-sa"
                          {...field}
                          data-testid="input-business-slug"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3 pt-2 border-t">
                <h4 className="text-sm font-medium text-muted-foreground pt-2">Administrador de la Empresa</h4>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={createForm.control}
                    name="adminFirstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Juan"
                            {...field}
                            data-testid="input-create-admin-firstname"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="adminLastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Pérez"
                            {...field}
                            data-testid="input-create-admin-lastname"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createForm.control}
                  name="adminEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email del Administrador</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@empresa.com"
                          {...field}
                          data-testid="input-create-admin-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="adminPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Mínimo 6 caracteres"
                            {...field}
                            data-testid="input-create-admin-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                            data-testid="button-toggle-create-password"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  data-testid="button-cancel-create"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  data-testid="button-confirm-create"
                >
                  {createMutation.isPending ? "Creando..." : "Crear Empresa"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Empresa</DialogTitle>
            <DialogDescription>
              Modifica los datos de la empresa
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Empresa</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Mi Empresa S.A."
                        {...field}
                        data-testid="input-edit-business-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug (identificador único)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="mi-empresa-sa"
                        {...field}
                        data-testid="input-edit-business-slug"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email del Administrador (opcional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Dejar en blanco para no cambiar"
                        {...field}
                        data-testid="input-edit-admin-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="adminPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva Contraseña del Administrador (opcional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Dejar en blanco para no cambiar"
                          {...field}
                          data-testid="input-edit-admin-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-edit-password"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-confirm-edit"
                >
                  {updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Administrador</DialogTitle>
            <DialogDescription>
              Crea un usuario administrador para {selectedBusiness?.name}
            </DialogDescription>
          </DialogHeader>
          <Form {...adminForm}>
            <form onSubmit={adminForm.handleSubmit(handleAdminSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={adminForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Juan"
                          {...field}
                          data-testid="input-admin-firstname"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={adminForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Pérez"
                          {...field}
                          data-testid="input-admin-lastname"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={adminForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@empresa.com"
                        {...field}
                        data-testid="input-admin-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={adminForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          data-testid="input-admin-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAdminDialogOpen(false)}
                  data-testid="button-cancel-admin"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createAdminMutation.isPending}
                  data-testid="button-confirm-admin"
                >
                  {createAdminMutation.isPending ? "Creando..." : "Crear Administrador"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la empresa "{selectedBusiness?.name}" 
              y todos sus datos asociados (usuarios, certificados, tipos de certificado, etc.).
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
