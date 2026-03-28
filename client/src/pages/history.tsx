import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Award,
  Calendar,
  History as HistoryIcon
} from "lucide-react";
import type { CertificateWithType } from "@shared/schema";
import { formatDate, getCertificateStatus } from "@/lib/authUtils";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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

function CertificateCard({ cert }: { cert: CertificateWithType }) {
  const status = getCertificateStatus(cert.expiryDate);
  
  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold" data-testid={`text-cert-name-${cert.id}`}>
                  {cert.studentName}
                </h3>
                <StatusBadge status={status} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Tipo: {cert.certificateType?.name || 'N/A'}
              </p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Emitido: {formatDate(cert.issueDate)}
                </span>
                <span>RUT: {cert.studentRut}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-mono text-muted-foreground">
              {cert.certificateNumber}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Vence: {formatDate(cert.expiryDate)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="w-24 h-12" />
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

  const { data: response, isLoading } = useQuery<{ certificates: CertificateWithType[] }>({
    queryKey: ["/api/certificates"],
  });

  const certificates = response?.certificates || [];

  if (isLoading || authLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Historial de Certificados Emitidos</h1>
          <p className="text-muted-foreground">
            Registro de todos los certificados emitidos
          </p>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial de Certificados Emitidos</h1>
        <p className="text-muted-foreground">
          Registro de todos los certificados emitidos ({certificates.length})
        </p>
      </div>

      {certificates.length > 0 ? (
        <div className="space-y-4">
          {certificates.map((cert) => (
            <CertificateCard key={cert.id} cert={cert} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <HistoryIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="font-semibold mb-2">No hay certificados emitidos</h3>
            <p className="text-sm text-muted-foreground">
              Aún no se han emitido certificados
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
