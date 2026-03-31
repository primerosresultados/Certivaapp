import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError, validateRut, formatRut } from "@/lib/authUtils";
import { 
  Upload, 
  FileSpreadsheet, 
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  GraduationCap,
  Building2,
  Award
} from "lucide-react";
import type { CertificateType, CustomField, CertificateTypeWithDetails } from "@shared/schema";

type ImportType = "students" | "companies" | "certificates";

type ParsedRow = {
  data: Record<string, string>;
  isValid: boolean;
  errors: string[];
};

type PreviewData = {
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  headers: string[];
};

const importTypeConfig = {
  students: {
    title: "Alumnos",
    icon: GraduationCap,
    endpoint: "/api/import/students",
    templateColumns: ["Nombre", "RUT", "Email", "Teléfono"],
    templateExample: [
      ["Nombre", "RUT", "Email", "Teléfono"],
      ["Juan Pérez González", "12345678-9", "juan@email.com", "+56 9 1234 5678"],
      ["María López Silva", "98765432-1", "maria@email.com", "+56 9 8765 4321"],
    ],
    requiredColumns: ["nombre", "rut"],
    columnMapping: {
      nombre: ["nombre", "name"],
      rut: ["rut", "dni", "id"],
      email: ["email", "correo"],
      telefono: ["telefono", "teléfono", "phone"],
    },
  },
  companies: {
    title: "Empresas",
    icon: Building2,
    endpoint: "/api/import/companies",
    templateColumns: ["Nombre", "RUT", "Dirección", "Contacto", "Email Contacto", "Teléfono Contacto"],
    templateExample: [
      ["Nombre", "RUT", "Dirección", "Contacto", "Email Contacto", "Teléfono Contacto"],
      ["Empresa ABC S.A.", "76543210-K", "Av. Principal 123", "Pedro Soto", "pedro@abc.cl", "+56 2 1234 5678"],
      ["Servicios XYZ Ltda.", "77654321-0", "Calle Central 456", "Ana García", "ana@xyz.cl", "+56 2 8765 4321"],
    ],
    requiredColumns: ["nombre"],
    columnMapping: {
      nombre: ["nombre", "name", "empresa", "company"],
      rut: ["rut", "dni"],
      direccion: ["direccion", "dirección", "address"],
      contacto: ["contacto", "contact"],
      emailContacto: ["email contacto", "contact email", "correo"],
      telefonoContacto: ["telefono contacto", "contact phone", "teléfono"],
    },
  },
  certificates: {
    title: "Certificados",
    icon: Award,
    endpoint: "/api/import",
    templateColumns: ["Nombre", "RUT", "Fecha"],
    templateExample: [
      ["Nombre", "RUT", "Fecha"],
      ["Juan Pérez González", "12345678-9", "2024-01-15"],
      ["María López Silva", "98765432-1", "2024-01-15"],
    ],
    requiredColumns: ["nombre", "rut"],
    columnMapping: {
      nombre: ["nombre", "name"],
      rut: ["rut", "dni", "id"],
      fecha: ["fecha", "date"],
    },
  },
};

export default function Import() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ImportType>("students");
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedTypeDetails, setSelectedTypeDetails] = useState<CertificateTypeWithDetails | null>(null);

  // Load custom fields when certificate type is selected
  useEffect(() => {
    const loadTypeDetails = async () => {
      if (activeTab === "certificates" && selectedTypeId) {
        try {
          const token = localStorage.getItem("accessToken");
          const headers: HeadersInit = {};
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
          const response = await fetch(`/api/certificate-types/${selectedTypeId}/details`, { headers });
          if (response.ok) {
            const details = await response.json();
            setSelectedTypeDetails(details);
          }
        } catch (error) {
          console.error("Error loading type details:", error);
        }
      } else {
        setSelectedTypeDetails(null);
      }
    };
    loadTypeDetails();
  }, [selectedTypeId, activeTab]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Sesión expirada",
        description: "Iniciando sesión nuevamente...",
        variant: "destructive",
      });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: types } = useQuery<CertificateType[]>({
    queryKey: ["/api/certificate-types"],
  });

  const importMutation = useMutation({
    mutationFn: async ({ formData, endpoint }: { formData: FormData; endpoint: string }) => {
      const token = localStorage.getItem("accessToken");
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        headers,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al importar");
      }
      return response.json();
    },
    onSuccess: (data) => {
      const config = importTypeConfig[activeTab];
      toast({
        title: "Importación completada",
        description: `Se crearon ${data.created} ${config.title.toLowerCase()} correctamente`,
      });
      if (activeTab === "students") {
        queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      } else if (activeTab === "companies") {
        queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      }
      resetForm();
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
        title: "Error en la importación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const findColumnIndex = (headers: string[], columnNames: string[]): number => {
    const lowerHeaders = headers.map(h => String(h).toLowerCase());
    for (const name of columnNames) {
      const idx = lowerHeaders.findIndex(h => h.includes(name.toLowerCase()));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const parseExcel = async (file: File, type: ImportType): Promise<PreviewData> => {
    const XLSX = await import("xlsx");
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 });

    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1).filter((row: any[]) => row.some(cell => cell !== undefined && cell !== ""));

    const config = importTypeConfig[type];
    const columnMapping = config.columnMapping;
    const requiredColumns = config.requiredColumns;

    const rows: ParsedRow[] = dataRows.map((row: any[]) => {
      const errors: string[] = [];
      const rowData: Record<string, string> = {};

      for (const [key, possibleNames] of Object.entries(columnMapping)) {
        const idx = findColumnIndex(headers, possibleNames as string[]);
        if (idx >= 0 && row[idx] !== undefined) {
          let value = String(row[idx]).trim();
          
          if (key === "fecha" && typeof row[idx] === "number") {
            const date = XLSX.SSF.parse_date_code(row[idx]);
            value = `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
          }
          
          rowData[key] = value;
        }
      }

      for (const required of requiredColumns) {
        if (!rowData[required]) {
          const columnLabel = required.charAt(0).toUpperCase() + required.slice(1);
          errors.push(`${columnLabel} requerido`);
        }
      }

      if (rowData.rut && type !== "companies") {
        const cleanRut = rowData.rut.replace(/[^0-9kK]/g, '');
        if (!validateRut(cleanRut)) {
          errors.push("RUT inválido");
        }
      }

      if (type === "certificates" && !rowData.fecha) {
        rowData.fecha = new Date().toISOString().split("T")[0];
      }

      return {
        data: rowData,
        isValid: errors.length === 0,
        errors,
      };
    });

    return {
      rows,
      totalRows: rows.length,
      validRows: rows.filter(r => r.isValid).length,
      invalidRows: rows.filter(r => !r.isValid).length,
      headers: Object.keys(columnMapping),
    };
  };

  const handleFileChange = async (selectedFile: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.endsWith(".xlsx") && 
        !selectedFile.name.endsWith(".xls") && 
        !selectedFile.name.endsWith(".csv")) {
      toast({
        title: "Formato inválido",
        description: "Por favor suba un archivo Excel (.xlsx, .xls) o CSV",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    try {
      const preview = await parseExcel(selectedFile, activeTab);
      setPreviewData(preview);
    } catch (error) {
      toast({
        title: "Error al leer el archivo",
        description: "No se pudo procesar el archivo. Verifique el formato.",
        variant: "destructive",
      });
      setFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileChange(droppedFile);
    }
  }, [activeTab]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const resetForm = () => {
    setFile(null);
    setPreviewData(null);
    setSelectedTypeId("");
    setUploadProgress(0);
  };

  const handleTabChange = (newTab: string) => {
    resetForm();
    setActiveTab(newTab as ImportType);
  };

  const handleImport = async () => {
    if (!file || !previewData) return;
    if (activeTab === "certificates" && !selectedTypeId) return;

    const config = importTypeConfig[activeTab];
    const formData = new FormData();
    formData.append("file", file);
    
    if (activeTab === "certificates") {
      formData.append("certificateTypeId", selectedTypeId);
    }

    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    try {
      await importMutation.mutateAsync({ formData, endpoint: config.endpoint });
      setUploadProgress(100);
    } finally {
      clearInterval(interval);
    }
  };

  const downloadTemplate = () => {
    const config = importTypeConfig[activeTab];
    
    // For certificates, include custom fields in template
    if (activeTab === "certificates" && selectedTypeDetails?.customFields?.length) {
      const customFieldLabels = selectedTypeDetails.customFields.map(f => f.fieldLabel);
      const baseColumns = ["Nombre", "RUT", "Fecha"];
      const allColumns = [...baseColumns, ...customFieldLabels];
      const exampleRow1 = ["Juan Pérez González", "12345678-9", "2024-01-15", ...customFieldLabels.map(() => "Valor ejemplo")];
      const exampleRow2 = ["María López Silva", "98765432-1", "2024-01-15", ...customFieldLabels.map(() => "Valor ejemplo")];
      const csvContent = [allColumns, exampleRow1, exampleRow2].map(row => row.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plantilla_${selectedTypeDetails.name.replace(/\s+/g, "_")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return;
    }
    
    const csvContent = config.templateExample.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plantilla_${activeTab}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const config = importTypeConfig[activeTab];
  const IconComponent = config.icon;

  // Get expected columns including custom fields for certificates
  const getExpectedColumns = () => {
    if (activeTab === "certificates" && selectedTypeDetails?.customFields?.length) {
      const baseColumns = ["Nombre", "RUT", "Fecha"];
      const customFieldLabels = selectedTypeDetails.customFields.map(f => f.fieldLabel);
      return [...baseColumns, ...customFieldLabels];
    }
    return config.templateColumns;
  };

  const getDisplayHeaders = () => {
    const mapping = config.columnMapping;
    return Object.keys(mapping).map(key => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      return label.replace(/([A-Z])/g, ' $1').trim();
    });
  };

  const getRowValues = (row: ParsedRow) => {
    const mapping = config.columnMapping;
    return Object.keys(mapping).map(key => {
      const value = row.data[key];
      if (key === "rut" && value) {
        return formatRut(value);
      }
      return value || "-";
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Importar Datos</h1>
        <p className="text-muted-foreground">
          Cargue archivos Excel o CSV para importar datos masivamente
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="students" className="gap-2" data-testid="tab-students">
            <GraduationCap className="w-4 h-4" />
            Alumnos
          </TabsTrigger>
          <TabsTrigger value="companies" className="gap-2" data-testid="tab-companies">
            <Building2 className="w-4 h-4" />
            Empresas
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {!previewData ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconComponent className="w-5 h-5" />
                  Importar {config.title}
                </CardTitle>
                <CardDescription>
                  Columnas esperadas: {getExpectedColumns().join(", ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {/* For certificates, show type selector BEFORE file upload */}
                {activeTab === "certificates" && (
                  <div className="mb-6 pb-6 border-b border-border">
                    <label className="text-sm font-medium mb-2 block">
                      Primero seleccione el tipo de certificado *
                    </label>
                    <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                      <SelectTrigger className="w-full max-w-md" data-testid="select-certificate-type-before-upload">
                        <SelectValue placeholder="Seleccione el tipo de curso" />
                      </SelectTrigger>
                      <SelectContent>
                        {types?.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} ({type.validityMonths} meses)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {types?.length === 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        No hay tipos de curso disponibles. Cree uno primero.
                      </p>
                    )}
                    {selectedTypeDetails?.customFields && selectedTypeDetails.customFields.length > 0 && (
                      <div className="mt-3 p-3 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-1">Campos personalizados detectados:</p>
                        <div className="flex gap-2 flex-wrap">
                          {selectedTypeDetails.customFields.map((field) => (
                            <Badge key={field.id} variant={field.isRequired ? "default" : "secondary"}>
                              {field.fieldLabel} {field.isRequired && "*"}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    isDragOver 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  } ${activeTab === "certificates" && !selectedTypeId ? "opacity-50 pointer-events-none" : ""}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  data-testid="dropzone"
                >
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-primary animate-spin" />
                      <p className="font-medium">Procesando archivo...</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-xl bg-primary/10 text-primary">
                        <FileSpreadsheet className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        Arrastre su archivo aquí
                      </h3>
                      <p className="text-muted-foreground mb-4">
                        o haga clic para seleccionar un archivo Excel (.xlsx, .xls) o CSV
                      </p>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                        className="hidden"
                        id="file-upload"
                        data-testid="input-file-upload"
                      />
                      <label htmlFor="file-upload">
                        <Button variant="outline" className="gap-2" asChild>
                          <span>
                            <Upload className="w-4 h-4" />
                            Seleccionar Archivo
                          </span>
                        </Button>
                      </label>
                      <div className="mt-6 pt-6 border-t border-border">
                        <Button variant="ghost" onClick={downloadTemplate} className="gap-2" data-testid="button-download-template">
                          <Download className="w-4 h-4" />
                          Descargar plantilla de ejemplo
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Alert>
                <FileSpreadsheet className="w-4 h-4" />
                <AlertTitle>{file?.name}</AlertTitle>
                <AlertDescription className="flex items-center gap-4 flex-wrap mt-2">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    {previewData.validRows} válidos
                  </span>
                  {previewData.invalidRows > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <XCircle className="w-4 h-4" />
                      {previewData.invalidRows} con errores
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {previewData.totalRows} registros en total
                  </span>
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle>Vista Previa de Datos</CardTitle>
                  <CardDescription>
                    Primeras filas del archivo cargado
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden">
                    <Table className="table-fixed w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Estado</TableHead>
                          {getDisplayHeaders().map((header, idx) => (
                            <TableHead key={idx} className="truncate">{header}</TableHead>
                          ))}
                          <TableHead className="w-32">Observaciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.rows.slice(0, 10).map((row, idx) => (
                          <TableRow key={idx} data-testid={`row-preview-${idx}`}>
                            <TableCell>
                              {row.isValid ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                              ) : (
                                <XCircle className="w-5 h-5 text-destructive" />
                              )}
                            </TableCell>
                            {getRowValues(row).map((value, vIdx) => (
                              <TableCell key={vIdx} className={`truncate ${vIdx === 1 ? "font-mono text-sm" : "font-medium"}`}>
                                {value}
                              </TableCell>
                            ))}
                            <TableCell>
                              {row.errors.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                  {row.errors.map((err, i) => (
                                    <Badge key={i} variant="destructive" className="text-xs">
                                      {err}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {previewData.totalRows > 10 && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      Mostrando 10 de {previewData.totalRows} registros
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Configuración de Importación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeTab === "certificates" && selectedTypeDetails && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        Tipo de certificado: <span className="text-primary">{selectedTypeDetails.name}</span>
                      </p>
                      {selectedTypeDetails.customFields && selectedTypeDetails.customFields.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Campos personalizados: {selectedTypeDetails.customFields.map(f => f.fieldLabel).join(", ")}
                        </p>
                      )}
                    </div>
                  )}

                  {previewData.invalidRows > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="w-4 h-4" />
                      <AlertTitle>Registros con errores</AlertTitle>
                      <AlertDescription>
                        Se encontraron {previewData.invalidRows} registros con errores que serán omitidos durante la importación.
                      </AlertDescription>
                    </Alert>
                  )}

                  {importMutation.isPending && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Procesando importación...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <Button
                      variant="outline"
                      onClick={resetForm}
                      disabled={importMutation.isPending}
                      className="gap-2"
                      data-testid="button-cancel-import"
                    >
                      <Trash2 className="w-4 h-4" />
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={
                        (activeTab === "certificates" && !selectedTypeId) || 
                        previewData.validRows === 0 || 
                        importMutation.isPending
                      }
                      className="gap-2"
                      data-testid="button-process-import"
                    >
                      {importMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Importar {previewData.validRows} {config.title.toLowerCase()}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
