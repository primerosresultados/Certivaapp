import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Download,
  Eye,
  TrendingUp,
  Calendar
} from "lucide-react";
import { Link } from "wouter";
import type { DashboardStats, CertificateWithType } from "@shared/schema";
import { getCertificateStatus, formatDate, formatRut } from "@/lib/authUtils";

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  trend,
  variant = 'default'
}: { 
  title: string; 
  value: number | string; 
  icon: typeof Award; 
  description?: string;
  trend?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const iconColors = {
    default: 'bg-primary text-primary-foreground',
    success: 'bg-emerald-500 text-white',
    warning: 'bg-amber-500 text-white',
    destructive: 'bg-red-500 text-white',
  };

  const trendColors = {
    default: 'text-primary',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    destructive: 'text-red-600 dark:text-red-400',
  };

  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-3 sm:p-6">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl shadow-sm shrink-0 ${iconColors[variant]}`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-baseline justify-end gap-2">
              <p className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid={`text-stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
                {value}
              </p>
              {trend && (
                <span className={`text-xs font-medium ${trendColors[variant]}`}>{trend}</span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground mt-0.5 sm:mt-1">{title}</p>
            {description && (
              <p className="text-xs text-muted-foreground/70 mt-0.5 hidden sm:block">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: 'valid' | 'expired' | 'expiring_soon' }) {
  const config = {
    valid: { label: 'Vigente', variant: 'default' as const, className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' },
    expired: { label: 'Vencido', variant: 'destructive' as const, className: '' },
    expiring_soon: { label: 'Por Vencer', variant: 'default' as const, className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20' },
  };
  
  const { label, variant, className } = config[status];
  
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

function CertificateRow({ certificate }: { certificate: CertificateWithType }) {
  const status = getCertificateStatus(certificate.expiryDate);
  
  const statusIcons = {
    valid: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    expired: <XCircle className="w-4 h-4 text-red-500" />,
    expiring_soon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  };
  
  return (
    <div className="flex items-center gap-2 sm:gap-4 py-2 sm:py-4 px-2 sm:px-3 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 text-primary shrink-0">
        <Award className="w-4 h-4 sm:w-5 sm:h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
          <p className="text-sm sm:text-base font-semibold truncate" data-testid={`text-certificate-name-${certificate.id}`}>
            {certificate.studentName}
          </p>
          <span className="text-xs text-muted-foreground font-mono">{formatRut(certificate.studentRut)}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
          <span className="hidden sm:inline">{certificate.certificateType?.name}</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            {formatDate(certificate.issueDate)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <div className="flex items-center gap-1">
          {statusIcons[status]}
          <StatusBadge status={status} />
        </div>
        <Link href={`/certificates/${certificate.id}`}>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-9 sm:w-9" data-testid={`button-view-${certificate.id}`}>
            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="w-12 h-12 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
              <div className="flex-1">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="w-8 h-8" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          Resumen general de sus certificaciones
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-5">
        <StatCard
          title="Total"
          value={stats?.totalCertificates || 0}
          icon={Award}
          description="Certificados emitidos"
        />
        <StatCard
          title="Vigentes"
          value={stats?.activeCertificates || 0}
          icon={CheckCircle2}
          variant="success"
          description="Actualmente válidos"
        />
        <StatCard
          title="Por Vencer"
          value={stats?.expiringSoon || 0}
          icon={AlertTriangle}
          variant="warning"
          description="Próximos 30 días"
        />
        <StatCard
          title="Vencidos"
          value={stats?.expiredCertificates || 0}
          icon={XCircle}
          variant="destructive"
          description="Requieren renovación"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-2 sm:gap-4 flex-wrap pb-3 sm:pb-4">
            <div className="min-w-0">
              <CardTitle className="text-base sm:text-xl font-semibold">
                Certificados Recientes
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Últimos certificados emitidos</CardDescription>
            </div>
            <Link href="/certificates">
              <Button variant="outline" size="sm" data-testid="button-view-all-certificates">
                Ver todos
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-0 px-3 sm:px-6">
            {stats?.recentCertificates && stats.recentCertificates.length > 0 ? (
              <div className="space-y-1">
                {stats.recentCertificates.map((cert) => (
                  <CertificateRow key={cert.id} certificate={cert} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Award className="w-6 h-6 sm:w-8 sm:h-8 text-primary/60" />
                </div>
                <p className="font-medium text-sm sm:text-base">No hay certificados emitidos aún</p>
                <p className="text-xs sm:text-sm mt-1">Crea tus primeros tipos de certificados para comenzar</p>
                <Link href="/certificate-types">
                  <Button className="mt-3 sm:mt-4 text-sm sm:text-base" data-testid="button-create-first-type">
                    Crear Tipo de Certificado
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
