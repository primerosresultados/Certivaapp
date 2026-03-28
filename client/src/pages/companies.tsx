import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
  Search
} from "lucide-react";
import type { Company } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  rut: z.string().optional(),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

function CompanyCard({ 
  company, 
  onEdit, 
  onDelete
}: { 
  company: Company; 
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate" data-testid={`text-company-name-${company.id}`}>
                {company.name}
              </h3>
              {company.rut && (
                <p className="text-sm text-muted-foreground" data-testid={`text-company-rut-${company.id}`}>
                  RUT: {company.rut}
                </p>
              )}
              <div className="flex flex-col gap-1 mt-3 text-sm text-muted-foreground">
                {company.contactName && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {company.contactName}
                  </span>
                )}
                {company.contactEmail && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {company.contactEmail}
                  </span>
                )}
                {company.contactPhone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {company.contactPhone}
                  </span>
                )}
                {company.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {company.address}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onEdit(company)}
              data-testid={`button-edit-company-${company.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onDelete(company)}
              data-testid={`button-delete-company-${company.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>RUT</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell className="text-right">
                <Skeleton className="h-8 w-16 ml-auto" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function Companies() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      rut: "",
      address: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    },
  });

  const { data: companies, isLoading } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const filteredCompanies = companies?.filter(company => 
    company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.rut?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    company.contactName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Empresa creada correctamente" });
      handleCloseDialog();
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
        description: "No se pudo crear la empresa",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PATCH", `/api/companies/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Empresa actualizada correctamente" });
      handleCloseDialog();
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
        description: "No se pudo actualizar la empresa",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({ title: "Empresa eliminada correctamente" });
      setDeleteDialogOpen(false);
      setSelectedCompany(null);
    },
    onError: (error: any) => {
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
        description: error?.message || "No se pudo eliminar la empresa",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setSelectedCompany(null);
    form.reset({
      name: "",
      rut: "",
      address: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (company: Company) => {
    setSelectedCompany(company);
    form.reset({
      name: company.name,
      rut: company.rut || "",
      address: company.address || "",
      contactName: company.contactName || "",
      contactEmail: company.contactEmail || "",
      contactPhone: company.contactPhone || "",
    });
    setDialogOpen(true);
  };

  const handleOpenDelete = (company: Company) => {
    setSelectedCompany(company);
    setDeleteDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedCompany(null);
    form.reset();
  };

  const onSubmit = (data: FormData) => {
    if (selectedCompany) {
      updateMutation.mutate({ ...data, id: selectedCompany.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (selectedCompany) {
      deleteMutation.mutate(selectedCompany.id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Empresas</h1>
          <p className="text-muted-foreground">
            Gestiona las empresas clientes que contratan servicios de capacitación
          </p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-create-company">
          <Plus className="w-4 h-4 mr-2" />
          Nueva Empresa
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar empresas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-companies"
        />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : filteredCompanies && filteredCompanies.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id} data-testid={`row-company-${company.id}`}>
                  <TableCell className="font-medium" data-testid={`text-company-name-${company.id}`}>
                    {company.name}
                  </TableCell>
                  <TableCell className="font-mono text-sm" data-testid={`text-company-rut-${company.id}`}>
                    {company.rut || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.contactName || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.contactEmail || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.contactPhone || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleOpenEdit(company)}
                      data-testid={`button-edit-company-${company.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleOpenDelete(company)}
                      data-testid={`button-delete-company-${company.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay empresas</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery 
                ? "No se encontraron empresas con ese criterio de búsqueda" 
                : "Comienza agregando tu primera empresa cliente"}
            </p>
            {!searchQuery && (
              <Button onClick={handleOpenCreate} data-testid="button-create-company-empty">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Empresa
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedCompany ? "Editar Empresa" : "Nueva Empresa"}
            </DialogTitle>
            <DialogDescription>
              {selectedCompany 
                ? "Modifica los datos de la empresa" 
                : "Ingresa los datos de la nueva empresa cliente"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Empresa</FormLabel>
                    <FormControl>
                      <Input placeholder="Empresa S.A." {...field} data-testid="input-company-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RUT</FormLabel>
                    <FormControl>
                      <Input placeholder="12.345.678-9" {...field} data-testid="input-company-rut" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl>
                      <Input placeholder="Av. Principal 123, Santiago" {...field} data-testid="input-company-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Contacto</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Pérez" {...field} data-testid="input-company-contact-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de Contacto</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contacto@empresa.com" {...field} data-testid="input-company-contact-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono de Contacto</FormLabel>
                    <FormControl>
                      <Input placeholder="+56 9 1234 5678" {...field} data-testid="input-company-contact-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-company"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Guardando..."
                    : selectedCompany
                    ? "Guardar Cambios"
                    : "Crear Empresa"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Empresa</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar la empresa "{selectedCompany?.name}"?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-company"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
