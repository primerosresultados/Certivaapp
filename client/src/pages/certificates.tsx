import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Search, 
  Eye, 
  Download, 
  Award,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Upload,
  FileSpreadsheet,
  X,
  AlertCircle,
  Check,
  Trash2,
  FolderDown
} from "lucide-react";
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

type TemplatePreset = {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};
import * as XLSX from "xlsx";
import type { CertificateWithType, CertificateType, CustomField, Company } from "@shared/schema";
import { getCertificateStatus, formatDate, formatRut } from "@/lib/authUtils";

// Extended type for certificate type with custom fields from API
type CertificateTypeWithFields = CertificateType & {
  customFields?: CustomField[];
};
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

function StatusBadge({ status }: { status: 'valid' | 'expired' | 'expiring_soon' }) {
  const config = {
    valid: { label: 'Vigente', className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
    expired: { label: 'Vencido', className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
    expiring_soon: { label: 'Por Vencer', className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' },
  };
  
  const { label, className } = config[status];
  
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <Skeleton className="h-10 flex-1 min-w-[200px]" />
        <Skeleton className="h-10 w-[180px]" />
        <Skeleton className="h-10 w-[140px]" />
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                <TableHead><Skeleton className="h-4 w-16" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MobileCard({ certificate, onDownload }: { certificate: CertificateWithType; onDownload: (id: string) => void }) {
  const status = getCertificateStatus(certificate.expiryDate);
  
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="font-medium" data-testid={`text-mobile-name-${certificate.id}`}>
              {certificate.studentName}
            </p>
            <p className="text-sm text-muted-foreground font-mono">
              {formatRut(certificate.studentRut)}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
          <div>
            <p className="text-xs text-muted-foreground/70">Curso</p>
            <p>{certificate.certificateType?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground/70">N° Certificado</p>
            <p className="font-mono text-xs">{certificate.certificateNumber}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground/70">Emisión</p>
            <p>{formatDate(certificate.issueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground/70">Vencimiento</p>
            <p>{formatDate(certificate.expiryDate)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/certificates/${certificate.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full gap-2" data-testid={`button-mobile-view-${certificate.id}`}>
              <Eye className="w-4 h-4" />
              Ver
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2" 
            onClick={() => onDownload(certificate.id)}
            data-testid={`button-mobile-download-${certificate.id}`}
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const createCertificateSchema = z.object({
  studentName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  studentRut: z.string().min(1, "RUT requerido"),
  certificateTypeId: z.string().min(1, "Seleccione un tipo de certificado"),
  issueDate: z.string().min(1, "Fecha de emisión requerida"),
});

type CreateCertificateData = z.infer<typeof createCertificateSchema>;

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export default function Certificates() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [massImportDialogOpen, setMassImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImportTypeId, setSelectedImportTypeId] = useState("");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [createCustomFieldValues, setCreateCustomFieldValues] = useState<Record<string, string>>({});
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("moderno-azul");
  const [downloadCertificateId, setDownloadCertificateId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [certificateToDelete, setCertificateToDelete] = useState<CertificateWithType | null>(null);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const perPage = 25;
  const { toast } = useToast();

  const form = useForm<CreateCertificateData>({
    resolver: zodResolver(createCertificateSchema),
    defaultValues: {
      studentName: "",
      studentRut: "",
      certificateTypeId: "",
      issueDate: new Date().toISOString().split("T")[0],
    },
  });

  const { data: types } = useQuery<CertificateTypeWithFields[]>({
    queryKey: ["/api/certificate-types"],
  });

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const { data: templatePresets } = useQuery<TemplatePreset[]>({
    queryKey: ["/api/certificate-templates/presets"],
  });

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [isAddingNewCompany, setIsAddingNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");

  const selectedCreateTypeId = form.watch("certificateTypeId");
  
  // Load custom fields for selected certificate type in create dialog
  const { data: selectedCreateTypeDetails } = useQuery<CertificateTypeWithFields>({
    queryKey: ["/api/certificate-types", selectedCreateTypeId, "details"],
    queryFn: async () => {
      if (!selectedCreateTypeId) return null;
      const token = localStorage.getItem("accessToken");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(`/api/certificate-types/${selectedCreateTypeId}/details`, { headers });
      if (!response.ok) throw new Error("Error loading type details");
      return response.json();
    },
    enabled: !!selectedCreateTypeId,
  });
  
  const selectedCreateTypeCustomFields: CustomField[] = selectedCreateTypeDetails?.customFields || [];

  const certificatesQueryUrl = `/api/certificates?search=${encodeURIComponent(search)}&status=${statusFilter}&type=${typeFilter}&page=${page}&perPage=${perPage}`;
  
  const { data: response, isLoading } = useQuery<{
    certificates: CertificateWithType[];
    total: number;
    page: number;
    perPage: number;
  }>({
    queryKey: [certificatesQueryUrl],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCertificateData) => {
      const res = await apiRequest("POST", "/api/certificates", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Certificado creado",
        description: "El certificado se ha creado correctamente.",
      });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/certificates');
      }});
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setCreateDialogOpen(false);
      form.reset();
      setCreateCustomFieldValues({});
      setSelectedCompanyId("");
      setIsAddingNewCompany(false);
      setNewCompanyName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el certificado.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/certificates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Certificado eliminado",
        description: "El certificado se ha eliminado correctamente.",
      });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/certificates');
      }});
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDeleteDialogOpen(false);
      setCertificateToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el certificado.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteClick = (cert: CertificateWithType) => {
    setCertificateToDelete(cert);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (certificateToDelete) {
      deleteMutation.mutate(certificateToDelete.id);
    }
  };

  const certificates = response?.certificates || [];
  const total = response?.total || 0;
  const totalPages = Math.ceil(total / perPage);

  const handleCreateSubmit = async (data: CreateCertificateData) => {
    let companyId = selectedCompanyId === "none" ? undefined : selectedCompanyId;
    
    // If adding new company, create it first
    if (isAddingNewCompany && newCompanyName.trim()) {
      try {
        const response = await apiRequest("POST", "/api/companies", { name: newCompanyName.trim() });
        const newCompany = await response.json();
        companyId = newCompany.id;
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      } catch (error) {
        toast({
          title: "Error",
          description: "No se pudo crear la empresa",
          variant: "destructive",
        });
        return;
      }
    }

    createMutation.mutate({
      ...data,
      companyId,
      customFieldValues: Object.keys(createCustomFieldValues).length > 0 ? createCustomFieldValues : undefined,
    } as any);
  };

  const handleDirectDownload = async (certId: string) => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`/api/certificates/${certId}/pdf?template=clasico-dorado`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (!response.ok) throw new Error("Error al descargar");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "Certificado.pdf";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo descargar el certificado",
        variant: "destructive",
      });
    }
  };

  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    try {
      const token = localStorage.getItem("accessToken");
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      
      const response = await fetch(`/api/certificates/download-zip?${params.toString()}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error("Error al descargar");
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Certificados-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Descarga completada",
        description: "Los certificados se han descargado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudieron descargar los certificados",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!downloadCertificateId) return;
    
    setIsDownloading(true);
    try {
      const token = localStorage.getItem("accessToken");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/certificates/${downloadCertificateId}/pdf?template=${selectedTemplate}`, { headers });
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "Certificado.pdf";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "PDF descargado",
        description: "El certificado se ha descargado correctamente.",
      });
      setTemplateDialogOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo descargar el certificado.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const selectedType = types?.find(t => t.id === selectedImportTypeId);
  const customFields: CustomField[] = selectedType?.customFields || [];

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      await processFile(file);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const processFile = async (file: File) => {
    setImportFile(file);
    setImportErrors([]);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (jsonData.length < 2) {
        setImportErrors(["El archivo debe tener al menos una fila de datos además del encabezado"]);
        return;
      }

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1).filter((row: any[]) => row.some(cell => cell !== undefined && cell !== ""));
      
      const requiredColumns = ["Nombre", "RUT", "Fecha"];
      const missingColumns = requiredColumns.filter(col => 
        !headers.some(h => h?.toString().toLowerCase() === col.toLowerCase())
      );
      
      if (missingColumns.length > 0) {
        setImportErrors([`Columnas requeridas faltantes: ${missingColumns.join(", ")}`]);
        return;
      }

      const preview = rows.slice(0, 5).map((row: any[]) => {
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => {
          obj[h] = row[i];
        });
        return obj;
      });
      
      setPreviewData(preview);
    } catch (err) {
      setImportErrors(["Error al leer el archivo. Asegúrese de que sea un archivo Excel o CSV válido."]);
    }
  };

  const handleImportSubmit = async () => {
    if (!importFile || !selectedImportTypeId) {
      toast({
        title: "Error",
        description: "Seleccione un tipo de certificado y un archivo",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportErrors([]);

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("certificateTypeId", selectedImportTypeId);

      const token = localStorage.getItem("accessToken");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
        headers,
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Error al importar certificados");
      }

      toast({
        title: "Importación completada",
        description: `Se importaron ${result.successfulRecords} de ${result.totalRecords} certificados`,
      });

      if (result.errors && result.errors.length > 0) {
        setImportErrors(result.errors);
      } else {
        setMassImportDialogOpen(false);
        resetImportState();
      }

      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.startsWith('/api/certificates');
      }});
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/import/history"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo importar los certificados",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetImportState = () => {
    setImportFile(null);
    setPreviewData([]);
    setImportErrors([]);
    setSelectedImportTypeId("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const baseColumns = ["ID Tipo Certificado", "Tipo Certificado", "Nombre", "RUT", "Fecha", "Email", "Teléfono", "Empresa"];
    const customFieldColumns = customFields.map(f => f.fieldLabel);
    const headers = [...baseColumns, ...customFieldColumns];
    
    const exampleRow = [
      selectedImportTypeId || "",
      selectedType?.name || "",
      "Juan Pérez González",
      "12.345.678-9",
      new Date().toLocaleDateString("es-CL"),
      "juan.perez@email.com",
      "+56912345678",
      "Mi Empresa S.A.",
      ...customFields.map(f => {
        if (f.fieldType === "number") return "0";
        if (f.fieldType === "date") return new Date().toLocaleDateString("es-CL");
        return "Ejemplo";
      })
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");
    XLSX.writeFile(workbook, `plantilla_certificados_${selectedType?.name || "tipo"}.xlsx`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Certificados</h1>
          <p className="text-muted-foreground">
            Listado de todos los certificados emitidos
          </p>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Certificados</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {total} certificados en total
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto sm:flex-row flex-col">
          <Button 
            variant="outline" 
            onClick={() => setCreateDialogOpen(true)}
            data-testid="button-create-certificate"
            className="text-xs sm:text-sm flex-1 sm:flex-none"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Crear Manual</span>
            <span className="sm:hidden">Manual</span>
          </Button>
          <Button 
            onClick={() => setMassImportDialogOpen(true)}
            data-testid="button-import-certificates"
            className="text-xs sm:text-sm flex-1 sm:flex-none"
          >
            <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Crear en forma masiva</span>
            <span className="sm:hidden">Masivo</span>
          </Button>
        </div>
      </div>

      {/* Create Certificate Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Crear Certificado Manual</DialogTitle>
            <DialogDescription>
              Complete los datos para crear un nuevo certificado.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="studentName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Alumno</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Juan Pérez González" 
                        {...field} 
                        data-testid="input-student-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="studentRut"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RUT</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="12.345.678-9" 
                        {...field} 
                        data-testid="input-student-rut"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <Label>Empresa (opcional)</Label>
                {!isAddingNewCompany ? (
                  <div className="flex gap-2">
                    <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                      <SelectTrigger data-testid="select-company" className="flex-1">
                        <SelectValue placeholder="Seleccione una empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin empresa</SelectItem>
                        {companies?.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsAddingNewCompany(true)}
                      data-testid="button-add-company"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre de la nueva empresa"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      data-testid="input-new-company"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setIsAddingNewCompany(false);
                        setNewCompanyName("");
                      }}
                      data-testid="button-cancel-new-company"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
              <FormField
                control={form.control}
                name="certificateTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Certificado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-certificate-type">
                          <SelectValue placeholder="Seleccione un tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {types?.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} ({type.validityMonths} meses)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Emisión</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        data-testid="input-issue-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {selectedCreateTypeCustomFields.length > 0 && (
                <div className="space-y-4 pt-2 border-t">
                  <p className="text-sm font-medium text-muted-foreground">Campos Personalizados</p>
                  {selectedCreateTypeCustomFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label>{capitalize(field.fieldLabel)}{field.isRequired && " *"}</Label>
                      <Input 
                        type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
                        placeholder={capitalize(field.fieldLabel)}
                        value={createCustomFieldValues[field.fieldName] || ""}
                        onChange={(e) => setCreateCustomFieldValues(prev => ({ ...prev, [field.fieldName]: e.target.value }))}
                        data-testid={`input-custom-${field.fieldName}`}
                      />
                    </div>
                  ))}
                </div>
              )}
              <DialogFooter>
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
                  data-testid="button-submit-certificate"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    "Crear Certificado"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Mass Import Dialog */}
      <Dialog open={massImportDialogOpen} onOpenChange={(open) => {
        setMassImportDialogOpen(open);
        if (!open) resetImportState();
      }}>
        <DialogContent className="w-[95vw] sm:max-w-[650px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Crear Certificados en Forma Masiva</DialogTitle>
            <DialogDescription>
              Cargue un archivo Excel o CSV con los datos de los certificados a crear
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="space-y-2">
              <Label>Tipo de Certificado</Label>
              <Select value={selectedImportTypeId} onValueChange={setSelectedImportTypeId}>
                <SelectTrigger data-testid="select-import-type">
                  <SelectValue placeholder="Seleccione un tipo de certificado" />
                </SelectTrigger>
                <SelectContent>
                  {types?.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} ({type.validityMonths} meses)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedImportTypeId && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <Label className="sm:mb-0">Archivo Excel/CSV</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={downloadTemplate}
                    className="gap-2 text-xs sm:text-sm"
                    data-testid="button-download-template"
                  >
                    <FileSpreadsheet className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Descargar plantilla</span>
                    <span className="sm:hidden">Plantilla</span>
                  </Button>
                </div>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center transition-colors ${
                    isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-import"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-file-import"
                  />
                  
                  {importFile ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <FileSpreadsheet className="w-6 h-6 sm:w-8 sm:h-8 text-green-500 mx-auto sm:mx-0" />
                      <div className="text-left flex-1">
                        <p className="font-medium text-xs sm:text-sm truncate">{importFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(importFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetImportState();
                        }}
                        data-testid="button-remove-file"
                        className="h-8 w-8 sm:h-auto sm:w-auto"
                      >
                        <X className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 text-muted-foreground/50" />
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Arrastre un archivo aquí o haga clic para seleccionar
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Formatos: Excel (.xlsx, .xls) o CSV
                      </p>
                    </>
                  )}
                </div>

                {customFields.length > 0 && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-2">Campos personalizados definidos:</p>
                    <div className="flex flex-wrap gap-2">
                      {customFields.map((field, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {field.fieldLabel} {field.isRequired && "*"}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Agregue columnas con estos nombres en su archivo Excel
                    </p>
                  </div>
                )}

                {previewData.length > 0 && (
                  <div className="space-y-2 min-w-0">
                    <Label>Vista previa ({previewData.length} filas)</Label>
                    <div className="border rounded-lg overflow-auto max-w-full max-h-[200px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(previewData[0]).map((key) => (
                              <TableHead key={key} className="whitespace-nowrap text-xs">
                                {key}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.map((row, i) => (
                            <TableRow key={i}>
                              {Object.values(row).map((val: any, j) => (
                                <TableCell key={j} className="text-xs whitespace-nowrap">
                                  {val?.toString() || "-"}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {importErrors.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg space-y-1">
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium">
                      <AlertCircle className="w-4 h-4" />
                      Errores encontrados
                    </div>
                    {importErrors.map((error, i) => (
                      <p key={i} className="text-sm text-red-600 dark:text-red-400">
                        {error}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2 pt-4 border-t shrink-0">
            <Button
              variant="outline"
              onClick={() => {
                setMassImportDialogOpen(false);
                resetImportState();
              }}
              data-testid="button-cancel-import"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImportSubmit}
              disabled={!importFile || !selectedImportTypeId || isImporting || importErrors.length > 0}
              data-testid="button-submit-import"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar Certificados
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o RUT..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 text-xs sm:text-sm"
            data-testid="input-search-certificates"
          />
        </div>
        <div className="flex gap-2 w-full">
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="flex-1 sm:flex-none sm:w-[180px] text-xs sm:text-sm" data-testid="select-type-filter">
              <Filter className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline"><SelectValue placeholder="Tipo de curso" /></span>
              <span className="sm:hidden"><SelectValue placeholder="Curso" /></span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los cursos</SelectItem>
              {types?.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="flex-1 sm:flex-none sm:w-[140px] text-xs sm:text-sm" data-testid="select-status-filter">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="valid">Vigentes</SelectItem>
              <SelectItem value="expiring_soon">Por vencer</SelectItem>
              <SelectItem value="expired">Vencidos</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadZip}
            disabled={isDownloadingZip || total === 0}
            data-testid="button-download-zip"
            className="gap-1"
          >
            {isDownloadingZip ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderDown className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Descargar ZIP</span>
          </Button>
        </div>
      </div>

      {certificates.length > 0 ? (
        <>
          <div className="hidden lg:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>RUT</TableHead>
                      <TableHead>Curso</TableHead>
                      <TableHead>N° Certificado</TableHead>
                      <TableHead>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Emisión
                        </span>
                      </TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {certificates.map((cert) => {
                      const status = getCertificateStatus(cert.expiryDate);
                      return (
                        <TableRow key={cert.id} data-testid={`row-certificate-${cert.id}`}>
                          <TableCell className="font-medium">{cert.studentName}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatRut(cert.studentRut)}
                          </TableCell>
                          <TableCell>{cert.certificateType?.name}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {cert.certificateNumber}
                          </TableCell>
                          <TableCell>{formatDate(cert.issueDate)}</TableCell>
                          <TableCell>{formatDate(cert.expiryDate)}</TableCell>
                          <TableCell>
                            <StatusBadge status={status} />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/certificates/${cert.id}`}>
                                <Button variant="ghost" size="icon" data-testid={`button-view-cert-${cert.id}`}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </Link>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDirectDownload(cert.id)}
                                data-testid={`button-download-cert-${cert.id}`}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeleteClick(cert)}
                                data-testid={`button-delete-cert-${cert.id}`}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="lg:hidden space-y-3">
            {certificates.map((cert) => (
              <MobileCard key={cert.id} certificate={cert} onDownload={handleDirectDownload} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs sm:text-sm text-muted-foreground">
                Mostrando {(page - 1) * perPage + 1} - {Math.min(page * perPage, total)} de {total}
              </p>
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  data-testid="button-prev-page"
                  className="text-xs sm:text-sm"
                >
                  <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <span className="text-xs sm:text-sm text-muted-foreground px-1 sm:px-2">
                  <span className="hidden sm:inline">Página </span>{page}<span className="hidden sm:inline"> de {totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  data-testid="button-next-page"
                  className="text-xs sm:text-sm"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-8 sm:py-12 text-center">
            <Award className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-muted-foreground/30" />
            <h3 className="font-semibold text-base sm:text-lg mb-2">
              {search || statusFilter !== "all" || typeFilter !== "all"
                ? "No se encontraron certificados"
                : "No hay certificados"}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">
              {search || statusFilter !== "all" || typeFilter !== "all"
                ? "Intente con otros filtros de búsqueda"
                : "Cree un certificado manual o importe desde Excel"}
            </p>
            {!search && statusFilter === "all" && typeFilter === "all" && (
              <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setCreateDialogOpen(true)}
                  data-testid="button-create-first-cert"
                  className="text-xs sm:text-sm"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Crear Manual
                </Button>
                <Button 
                  onClick={() => setMassImportDialogOpen(true)}
                  data-testid="button-import-first-cert"
                  className="text-xs sm:text-sm"
                >
                  <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Masivo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Template Selection Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Seleccionar Diseño del Certificado</DialogTitle>
            <DialogDescription>
              Elija el diseño de color para el PDF del certificado
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
            {templatePresets?.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setSelectedTemplate(preset.id)}
                className={`relative p-4 rounded-lg border-2 transition-all hover-elevate ${
                  selectedTemplate === preset.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border'
                }`}
                data-testid={`button-template-${preset.id}`}
              >
                {selectedTemplate === preset.id && (
                  <div className="absolute top-2 right-2">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                )}
                <div className="flex gap-1 mb-3 justify-center">
                  <div 
                    className="w-6 h-6 rounded-full border" 
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                  <div 
                    className="w-6 h-6 rounded-full border" 
                    style={{ backgroundColor: preset.secondaryColor }}
                  />
                  <div 
                    className="w-6 h-6 rounded-full border" 
                    style={{ backgroundColor: preset.accentColor }}
                  />
                </div>
                <p className="text-sm font-medium text-center">{preset.name}</p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDownloadPdf} disabled={isDownloading} data-testid="button-confirm-download">
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Descargando...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Descargar PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar certificado?</AlertDialogTitle>
            <AlertDialogDescription>
              {certificateToDelete && (
                <>
                  Está a punto de eliminar el certificado de <strong>{certificateToDelete.studentName}</strong> 
                  {" "}(N° {certificateToDelete.certificateNumber}).
                  <br /><br />
                  Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
