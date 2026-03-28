import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Users,
  Phone,
  Mail,
  Building2,
  Search,
  GraduationCap
} from "lucide-react";
import type { StudentWithCompany, Company } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  rut: z.string().min(1, "RUT requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  companyId: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

function StudentCard({ 
  student, 
  onEdit, 
  onDelete
}: { 
  student: StudentWithCompany; 
  onEdit: (student: StudentWithCompany) => void;
  onDelete: (student: StudentWithCompany) => void;
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate" data-testid={`text-student-name-${student.id}`}>
                {student.name}
              </h3>
              <p className="text-sm text-muted-foreground" data-testid={`text-student-rut-${student.id}`}>
                RUT: {student.rut}
              </p>
              <div className="flex flex-col gap-1 mt-3 text-sm text-muted-foreground">
                {student.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {student.email}
                  </span>
                )}
                {student.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    {student.phone}
                  </span>
                )}
                {student.company && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    <Badge variant="secondary" className="font-normal">
                      {student.company.name}
                    </Badge>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onEdit(student)}
              data-testid={`button-edit-student-${student.id}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onDelete(student)}
              data-testid={`button-delete-student-${student.id}`}
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
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(5)].map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell><Skeleton className="h-5 w-20" /></TableCell>
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

export default function Students() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithCompany | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      rut: "",
      email: "",
      phone: "",
      companyId: null,
    },
  });

  const { data: students, isLoading } = useQuery<StudentWithCompany[]>({
    queryKey: ["/api/students"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const filteredStudents = students?.filter(student => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.rut.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCompany = 
      companyFilter === "all" || 
      (companyFilter === "none" && !student.companyId) ||
      student.companyId === companyFilter;
    
    return matchesSearch && matchesCompany;
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/students", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Alumno creado correctamente" });
      handleCloseDialog();
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
        description: error?.message || "No se pudo crear el alumno",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData & { id: string }) => {
      const { id, ...rest } = data;
      return apiRequest("PATCH", `/api/students/${id}`, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Alumno actualizado correctamente" });
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
        description: "No se pudo actualizar el alumno",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/students/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      toast({ title: "Alumno eliminado correctamente" });
      setDeleteDialogOpen(false);
      setSelectedStudent(null);
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
        description: error?.message || "No se pudo eliminar el alumno",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setSelectedStudent(null);
    form.reset({
      name: "",
      rut: "",
      email: "",
      phone: "",
      companyId: null,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (student: StudentWithCompany) => {
    setSelectedStudent(student);
    form.reset({
      name: student.name,
      rut: student.rut,
      email: student.email || "",
      phone: student.phone || "",
      companyId: student.companyId || null,
    });
    setDialogOpen(true);
  };

  const handleOpenDelete = (student: StudentWithCompany) => {
    setSelectedStudent(student);
    setDeleteDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedStudent(null);
    form.reset();
  };

  const onSubmit = (data: FormData) => {
    if (selectedStudent) {
      updateMutation.mutate({ ...data, id: selectedStudent.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (selectedStudent) {
      deleteMutation.mutate(selectedStudent.id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Alumnos</h1>
          <p className="text-muted-foreground">
            Gestiona los alumnos que reciben capacitaciones
          </p>
        </div>
        <Button onClick={handleOpenCreate} data-testid="button-create-student">
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Alumno
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar alumnos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-students"
          />
        </div>
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-company-filter">
            <SelectValue placeholder="Filtrar por empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            <SelectItem value="none">Sin empresa</SelectItem>
            {companies?.map((company) => (
              <SelectItem key={company.id} value={company.id}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : filteredStudents && filteredStudents.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => (
                <TableRow key={student.id} data-testid={`row-student-${student.id}`}>
                  <TableCell className="font-medium" data-testid={`text-student-name-${student.id}`}>
                    {student.name}
                  </TableCell>
                  <TableCell className="font-mono text-sm" data-testid={`text-student-rut-${student.id}`}>
                    {student.rut}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {student.email || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {student.phone || "-"}
                  </TableCell>
                  <TableCell>
                    {student.company ? (
                      <Badge variant="secondary">{student.company.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleOpenEdit(student)}
                      data-testid={`button-edit-student-${student.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleOpenDelete(student)}
                      data-testid={`button-delete-student-${student.id}`}
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
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay alumnos</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery || companyFilter !== "all"
                ? "No se encontraron alumnos con ese criterio de búsqueda" 
                : "Comienza agregando tu primer alumno"}
            </p>
            {!searchQuery && companyFilter === "all" && (
              <Button onClick={handleOpenCreate} data-testid="button-create-student-empty">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Alumno
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedStudent ? "Editar Alumno" : "Nuevo Alumno"}
            </DialogTitle>
            <DialogDescription>
              {selectedStudent 
                ? "Modifica los datos del alumno" 
                : "Ingresa los datos del nuevo alumno"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Pérez González" {...field} data-testid="input-student-name" />
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
                      <Input placeholder="12.345.678-9" {...field} data-testid="input-student-rut" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="juan.perez@email.com" {...field} data-testid="input-student-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="+56 9 1234 5678" {...field} data-testid="input-student-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa (opcional)</FormLabel>
                    <Select 
                      value={field.value || "none"} 
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-student-company">
                          <SelectValue placeholder="Selecciona una empresa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sin empresa</SelectItem>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  data-testid="button-submit-student"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Guardando..."
                    : selectedStudent
                    ? "Guardar Cambios"
                    : "Crear Alumno"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Alumno</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar al alumno "{selectedStudent?.name}"?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-student"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
