import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getAccessToken } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Download, 
  Copy,
  Calendar,
  User,
  Award,
  Hash,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  QrCode,
  FileText
} from "lucide-react";
import type { CertificateWithType } from "@shared/schema";
import { getCertificateStatus, formatDate, formatRut } from "@/lib/authUtils";

function StatusBadge({ status }: { status: 'valid' | 'expired' | 'expiring_soon' }) {
  const config = {
    valid: { 
      label: 'Vigente', 
      icon: CheckCircle2,
      className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' 
    },
    expired: { 
      label: 'Vencido', 
      icon: XCircle,
      className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' 
    },
    expiring_soon: { 
      label: 'Por Vencer', 
      icon: AlertTriangle,
      className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' 
    },
  };
  
  const { label, icon: Icon, className } = config[status];
  
  return (
    <Badge variant="outline" className={`${className} gap-1 text-sm px-3 py-1`}>
      <Icon className="w-4 h-4" />
      {label}
    </Badge>
  );
}

function InfoRow({ icon: Icon, label, value, mono = false }: {
  icon: typeof User;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`font-medium truncate ${mono ? 'font-mono text-sm' : ''}`} data-testid={`text-${label.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-10 h-10" />
        <div>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-5 w-48" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <Skeleton className="w-64 h-64 rounded-lg" />
            <Skeleton className="h-4 w-48 mt-4" />
            <div className="flex gap-2 w-full mt-6">
              <Skeleton className="h-10 flex-1" />
              <Skeleton className="h-10 flex-1" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function CertificateDetail() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, params] = useRoute("/certificates/:id");
  const id = params?.id;

  const [isDownloading, setIsDownloading] = useState(false);

  const { data: certificate, isLoading } = useQuery<CertificateWithType>({
    queryKey: ["/api/certificates", id],
    enabled: !!id,
  });

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

  if (isLoading || authLoading) {
    return <LoadingSkeleton />;
  }

  if (!certificate) {
    return (
      <div className="space-y-6">
        <Link href="/certificates">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-semibold mb-2">Certificado no encontrado</h3>
            <p className="text-sm text-muted-foreground">
              El certificado solicitado no existe o fue eliminado
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = getCertificateStatus(certificate.expiryDate);
  const validationUrl = `${window.location.origin}/validate/${certificate.id}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(validationUrl);
    toast({ title: "URL copiada al portapapeles" });
  };

  const handleDownloadQR = async () => {
    try {
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/certificates/${certificate.id}/qr`, { headers });
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR-${certificate.certificateNumber}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Código QR descargado" });
    } catch {
      toast({ 
        title: "Error al descargar", 
        description: "No se pudo descargar el código QR",
        variant: "destructive" 
      });
    }
  };

  const handleDownloadPDF = async (templateId: string = "clasico-dorado") => {
    try {
      setIsDownloading(true);
      const token = getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/certificates/${certificate.id}/pdf?template=${templateId}`, { headers });
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `Certificado-${certificate.certificateNumber}.pdf`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "PDF descargado" });
    } catch {
      toast({ 
        title: "Error al descargar", 
        description: "No se pudo descargar el PDF",
        variant: "destructive" 
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/certificates">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{certificate.studentName}</h1>
              <StatusBadge status={status} />
            </div>
            <p className="text-muted-foreground">
              Certificado N° {certificate.certificateNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={() => handleDownloadPDF("clasico-dorado")}
            disabled={isDownloading}
            data-testid="button-download-pdf"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{isDownloading ? "Descargando..." : "Descargar PDF"}</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-muted-foreground" />
              Información del Certificado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              <InfoRow 
                icon={User} 
                label="Nombre Completo" 
                value={certificate.studentName} 
              />
              <InfoRow 
                icon={Hash} 
                label="RUT" 
                value={formatRut(certificate.studentRut)} 
                mono 
              />
              <InfoRow 
                icon={Award} 
                label="Tipo de Curso" 
                value={certificate.certificateType?.name || "N/A"} 
              />
              <InfoRow 
                icon={Hash} 
                label="N° Certificado" 
                value={certificate.certificateNumber} 
                mono 
              />
              <InfoRow 
                icon={Calendar} 
                label="Fecha de Emisión" 
                value={formatDate(certificate.issueDate)} 
              />
              <InfoRow 
                icon={Clock} 
                label="Fecha de Vencimiento" 
                value={formatDate(certificate.expiryDate)} 
              />

              {/* Campos Personalizados */}
              {certificate.customFieldValues && 
               Object.keys(certificate.customFieldValues).length > 0 && 
               certificate.certificateType?.customFields && 
               certificate.certificateType.customFields.length > 0 && 
                certificate.certificateType.customFields.map((field: any) => {
                  const value = (certificate.customFieldValues as Record<string, any>)?.[field.fieldName];
                  if (value === undefined || value === null || value === '') return null;
                  
                  let displayValue: string = String(value);
                  if (field.fieldType === 'date' && value) {
                    displayValue = formatDate(String(value));
                  } else if (field.fieldType === 'number') {
                    displayValue = value.toString();
                  }
                  
                  return (
                    <InfoRow 
                      key={field.fieldName}
                      icon={FileText} 
                      label={field.fieldLabel || field.fieldName} 
                      value={displayValue} 
                    />
                  );
                })
              }
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-muted-foreground" />
              Código QR
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {certificate.qrCode ? (
              <div className="p-4 bg-white rounded-xl border border-border">
                <img 
                  src={certificate.qrCode} 
                  alt="Código QR de validación"
                  className="w-56 h-56"
                  data-testid="img-qr-code"
                />
              </div>
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded-xl">
                <QrCode className="w-24 h-24 text-muted-foreground/30" />
              </div>
            )}
            
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">URL de validación</p>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg max-w-full">
                <p className="text-xs font-mono truncate flex-1" title={validationUrl}>
                  {certificate.id}
                </p>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="shrink-0 h-6 w-6"
                  onClick={handleCopyUrl}
                  data-testid="button-copy-url"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <Separator className="my-6 w-full" />

            <div className="flex flex-col gap-2 w-full">
              <Button onClick={handleDownloadQR} className="w-full gap-2" data-testid="button-download-qr">
                <Download className="w-4 h-4" />
                Descargar QR (PNG)
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleDownloadPDF("clasico-dorado")} 
                className="w-full gap-2" 
                disabled={isDownloading}
                data-testid="button-download-pdf-2"
              >
                <Download className="w-4 h-4" />
                {isDownloading ? "Descargando..." : "Descargar Certificado (PDF)"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
