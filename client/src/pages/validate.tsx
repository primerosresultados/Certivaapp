import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Calendar,
  User,
  Award,
  Hash,
  Clock,
  QrCode,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CertificateWithType } from "@shared/schema";
import { getCertificateStatus, formatDate, formatRut } from "@/lib/authUtils";

function InfoRow({ icon: Icon, label, value }: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-sm truncate" data-testid={`text-validate-${label.toLowerCase().replace(/\s+/g, '-')}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-50">
        <div className="container max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded" />
          <Skeleton className="h-5 w-40" />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-4 h-4" />
                  <div className="flex-1">
                    <Skeleton className="h-3 w-16 mb-1" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatusDisplay({ status }: { status: 'valid' | 'expired' | 'expiring_soon' }) {
  const config = {
    valid: {
      icon: ShieldCheck,
      title: 'Certificado Válido',
      subtitle: 'Este certificado se encuentra vigente',
      iconBg: 'bg-green-500/10',
      iconColor: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-500/20',
    },
    expired: {
      icon: ShieldX,
      title: 'Certificado Vencido',
      subtitle: 'Este certificado ha expirado',
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-600 dark:text-red-400',
      borderColor: 'border-red-500/20',
    },
    expiring_soon: {
      icon: ShieldAlert,
      title: 'Próximo a Vencer',
      subtitle: 'Este certificado vence pronto',
      iconBg: 'bg-yellow-500/10',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      borderColor: 'border-yellow-500/20',
    },
  };

  const { icon: Icon, title, subtitle, iconBg, iconColor, borderColor } = config[status];

  return (
    <div className={`text-center p-6 rounded-xl border-2 ${borderColor} ${iconBg}`}>
      <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${iconBg} ${iconColor} mb-4`}>
        <Icon className="w-10 h-10" />
      </div>
      <h2 className={`text-2xl font-bold mb-1 ${iconColor}`} data-testid="text-status-title">
        {title}
      </h2>
      <p className="text-muted-foreground text-sm">{subtitle}</p>
    </div>
  );
}

export default function Validate() {
  const [match, params] = useRoute("/validate/:id");
  const id = params?.id;

  const { data: certificate, isLoading, error } = useQuery<CertificateWithType>({
    queryKey: ["/api/validate", id],
    enabled: !!id,
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const status = certificate ? getCertificateStatus(certificate.expiryDate) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {certificate?.certificateType?.business?.logoUrl && (
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-50">
          <div className="container max-w-md mx-auto px-4 py-4 flex justify-center">
            <img 
              src={certificate.certificateType.business.logoUrl} 
              alt="Logo empresa"
              className="h-14 w-auto"
              data-testid="img-company-logo"
            />
          </div>
        </header>
      )}
      <main className="flex-1 flex items-center justify-center p-4">
        {certificate && status ? (
          <Card className="w-full max-w-md shadow-lg">
            <CardContent className="p-6 space-y-6">
              <StatusDisplay status={status} />

              <div className="space-y-1 divide-y divide-border">
                <div className="pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Titular</span>
                  </div>
                  <p className="text-xl font-bold" data-testid="text-validate-name">
                    {certificate.studentName}
                  </p>
                  <p className="font-mono text-sm text-muted-foreground">
                    {formatRut(certificate.studentRut)}
                  </p>
                </div>

                <InfoRow 
                  icon={Award} 
                  label="Curso Aprobado" 
                  value={certificate.certificateType?.name || "N/A"} 
                />
                <InfoRow 
                  icon={Hash} 
                  label="N° Certificado" 
                  value={certificate.certificateNumber} 
                />
                <InfoRow 
                  icon={Calendar} 
                  label="Fecha de Emisión" 
                  value={formatDate(certificate.issueDate)} 
                />
                <InfoRow 
                  icon={Clock} 
                  label="Válido Hasta" 
                  value={formatDate(certificate.expiryDate)} 
                />
              </div>

              <div className="text-center pt-4 border-t border-border space-y-3">
                <p className="text-xs text-muted-foreground">
                  Verificado el {formatDate(new Date().toISOString())}
                </p>
                
                {certificate.certificateType?.business?.infoLink && (
                  <Button
                    variant="outline"
                    asChild
                    className="w-full"
                    data-testid="button-info-link"
                  >
                    <a 
                      href={certificate.certificateType.business.infoLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Más información
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="w-full max-w-md shadow-lg">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 mb-4">
                <XCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">
                Certificado No Encontrado
              </h2>
              <p className="text-muted-foreground">
                El certificado solicitado no existe en nuestros registros o el enlace es inválido.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="border-t border-border py-4">
        <div className="container max-w-md mx-auto px-4 text-center">
          <p className="text-xs text-muted-foreground">
            Sistema de validación de certificaciones digitales
          </p>
        </div>
      </footer>
    </div>
  );
}
