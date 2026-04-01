import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Download,
  FileSpreadsheet,
  Calendar,
  History as HistoryIcon,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Award,
  Loader2,
} from "lucide-react";
import type { ImportBatch, CertificateWithType } from "@shared/schema";
import { formatDate, getCertificateStatus } from "@/lib/authUtils";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    completed: { 
      label: 'Completada', 
      className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    partial: { 
      label: 'Parcial', 
      className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
      icon: <Clock className="w-3 h-3" />,
    },
    failed: { 
      label: 'Fallida', 
      className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      icon: <XCircle className="w-3 h-3" />,
    },
    pending: { 
      label: 'Pendiente', 
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      icon: <Clock className="w-3 h-3" />,
    },
  };
  
  const { label, className, icon } = config[status] || config.pending;
  
  return (
    <Badge variant="outline" className={`${className} flex items-center gap-1`}>
      {icon}
      {label}
    </Badge>
  );
}

function CertStatusBadge({ status }: { status: 'valid' | 'expired' | 'expiring_soon' }) {
  const config = {
    valid: { label: 'Vigente', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
    expired: { label: 'Vencido', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
    expiring_soon: { label: 'Por Vencer', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
  };
  const { label, className } = config[status];
  return <Badge variant="outline" className={className}>{label}</Badge>;
}

function BatchCard({ batch }: { batch: ImportBatch }) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const { data: batchCerts, isLoading: certsLoading } = useQuery<CertificateWithType[]>({
    queryKey: [`/api/import/${batch.id}/certificates`],
    enabled: expanded,
  });

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/import/${batch.id}/certificates/zip`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Error al descargar");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Lote-${batch.fileName.replace(/\.[^.]+$/, '')}-${batch.id.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "ZIP descargado correctamente" });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo descargar el ZIP",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const importTypeLabels: Record<string, string> = {
    certificates: "Certificados",
    students: "Alumnos",
    companies: "Empresas",
  };

  const isCertificateBatch = (batch.importType || 'certificates') === 'certificates';

  return (
    <Card className="hover-elevate transition-all duration-200">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base">{batch.fileName}</h3>
                <StatusBadge status={batch.status} />
                <Badge variant="secondary" className="text-xs">
                  {importTypeLabels[(batch as any).importType || 'certificates'] || 'Certificados'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {batch.createdAt ? formatDate(batch.createdAt as unknown as string) : 'N/A'}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  {batch.successfulRecords} exitosos
                </span>
                {batch.failedRecords > 0 && (
                  <span className="flex items-center gap-1">
                    <XCircle className="w-4 h-4 text-red-500" />
                    {batch.failedRecords} fallidos
                  </span>
                )}
                <span>Total: {batch.totalRecords}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isCertificateBatch && batch.successfulRecords > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadZip}
                disabled={downloading}
                className="gap-2"
              >
                {downloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                ZIP ({batch.successfulRecords})
              </Button>
            )}
            {isCertificateBatch && batch.successfulRecords > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="gap-1"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {expanded ? "Ocultar" : "Ver"}
              </Button>
            )}
          </div>
        </div>

        {/* Expanded certificates list */}
        {expanded && (
          <div className="border-t px-5 py-4 bg-muted/20">
            {certsLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background">
                    <Skeleton className="w-8 h-8 rounded" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : batchCerts && batchCerts.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {batchCerts.map(cert => {
                  const status = getCertificateStatus(cert.expiryDate);
                  return (
                    <div key={cert.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-background border border-border/50 hover:border-border transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded bg-primary/10 text-primary">
                          <Award className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{cert.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {cert.studentRut} · {cert.certificateNumber}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatDate(cert.issueDate)}</span>
                        <CertStatusBadge status={status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No se encontraron certificados para este lote
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="w-24 h-9 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function History() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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

  const { data: batches, isLoading } = useQuery<ImportBatch[]>({
    queryKey: ["/api/import/history"],
  });

  if (isLoading || authLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historial de Cargas Masivas</h1>
          <p className="text-muted-foreground">
            Registro de todas las importaciones realizadas
          </p>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  const importBatches = batches || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial de Cargas Masivas</h1>
        <p className="text-muted-foreground">
          Registro de todas las importaciones realizadas ({importBatches.length})
        </p>
      </div>

      {importBatches.length > 0 ? (
        <div className="space-y-4">
          {importBatches.map((batch) => (
            <BatchCard key={batch.id} batch={batch} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <HistoryIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-semibold mb-2">No hay importaciones registradas</h3>
            <p className="text-sm text-muted-foreground">
              Las cargas masivas aparecerán aquí una vez que realices importaciones
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
