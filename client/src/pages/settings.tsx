import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Settings, 
  Building2, 
  Lock, 
  Upload, 
  Eye, 
  EyeOff,
  Loader2,
  Camera,
  Check,
  Link2,
  ExternalLink,
  Save
} from "lucide-react";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Contraseña actual requerida"),
  newPassword: z.string().min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirme la nueva contraseña"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/password", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al cambiar la contraseña");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Contraseña actualizada",
        description: "Su contraseña ha sido cambiada exitosamente.",
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Error",
          description: "Por favor seleccione un archivo de imagen válido",
          variant: "destructive",
        });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      toast({
        title: "Error",
        description: "Seleccione una imagen primero",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", logoFile);

      // Get token from localStorage for authentication
      const accessToken = localStorage.getItem("accessToken");
      
      const response = await fetch("/api/business/logo", {
        method: "PATCH",
        body: formData,
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al subir el logo");
      }

      toast({
        title: "Logo actualizado",
        description: "El logo de su empresa ha sido actualizado exitosamente.",
      });
      
      setLogoFile(null);
      setLogoPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo subir el logo",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handlePasswordSubmit = (data: PasswordFormData) => {
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const currentLogoUrl = user?.business?.logoUrl;
  const [infoLink, setInfoLink] = useState(user?.business?.infoLink || "");
  const [isSavingInfoLink, setIsSavingInfoLink] = useState(false);

  const handleSaveInfoLink = async () => {
    setIsSavingInfoLink(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      const response = await apiRequest("PATCH", "/api/business/info-link", { infoLink });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al guardar el enlace");
      }

      toast({
        title: "Enlace actualizado",
        description: "El enlace de información ha sido guardado exitosamente.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo guardar el enlace",
        variant: "destructive",
      });
    } finally {
      setIsSavingInfoLink(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6" />
          Configuración
        </h1>
        <p className="text-muted-foreground">
          Administre la configuración de su cuenta y empresa
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Logo de la Empresa
            </CardTitle>
            <CardDescription>
              Suba o actualice el logo de su empresa certificadora. Este logo aparecerá en los certificados generados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/30">
                  <AvatarImage 
                    src={logoPreview || currentLogoUrl || undefined} 
                    alt="Logo de empresa"
                    className="object-contain p-1"
                  />
                  <AvatarFallback className="rounded-lg bg-muted text-muted-foreground">
                    <Building2 className="w-10 h-10" />
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full shadow-md"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-select-logo"
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex-1 space-y-2">
                <Label>Seleccionar imagen</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  className="cursor-pointer"
                  data-testid="input-logo-file"
                />
                <p className="text-xs text-muted-foreground">
                  Formatos: PNG, JPG, SVG. Tamaño recomendado: 200x200px
                </p>
              </div>
            </div>
            
            {logoFile && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm">{logoFile.name}</span>
                </div>
                <Button
                  onClick={handleLogoUpload}
                  disabled={isUploadingLogo}
                  data-testid="button-upload-logo"
                >
                  {isUploadingLogo ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Subiendo...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Guardar Logo
                    </>
                  )}
                </Button>
              </div>
            )}

            {currentLogoUrl && !logoFile && (
              <p className="text-sm text-muted-foreground">
                Logo actual configurado. Seleccione una nueva imagen para reemplazarlo.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Enlace de Información
            </CardTitle>
            <CardDescription>
              Configure un enlace que aparecerá en la página de validación pública de certificados. Ideal para enlazar a su sitio web o página de información.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="info-link">URL del enlace</Label>
              <Input
                id="info-link"
                type="url"
                placeholder="https://www.ejemplo.com/informacion"
                value={infoLink}
                onChange={(e) => setInfoLink(e.target.value)}
                data-testid="input-info-link"
              />
              <p className="text-xs text-muted-foreground">
                Este enlace se mostrará a quienes validen certificados de su empresa
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={handleSaveInfoLink}
                disabled={isSavingInfoLink}
                data-testid="button-save-info-link"
              >
                {isSavingInfoLink ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Enlace
                  </>
                )}
              </Button>
              
              {infoLink && (
                <Button
                  variant="outline"
                  asChild
                  data-testid="button-preview-info-link"
                >
                  <a href={infoLink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ver enlace
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Cambiar Contraseña
            </CardTitle>
            <CardDescription>
              Actualice su contraseña de acceso al sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña Actual</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showCurrentPassword ? "text" : "password"}
                            placeholder="Ingrese su contraseña actual"
                            {...field}
                            data-testid="input-current-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          >
                            {showCurrentPassword ? (
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

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Ingrese su nueva contraseña"
                            {...field}
                            data-testid="input-new-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? (
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

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Nueva Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirme su nueva contraseña"
                            {...field}
                            data-testid="input-confirm-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? (
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

                <Button
                  type="submit"
                  className="w-full"
                  disabled={changePasswordMutation.isPending}
                  data-testid="button-change-password"
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cambiando...
                    </>
                  ) : (
                    "Cambiar Contraseña"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información de la Cuenta</CardTitle>
          <CardDescription>
            Datos de su cuenta y empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase">Nombre</Label>
              <p className="font-medium" data-testid="text-user-fullname">
                {user?.firstName} {user?.lastName}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase">Email</Label>
              <p className="font-medium" data-testid="text-user-email">
                {user?.email}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs uppercase">Rol</Label>
              <p className="font-medium capitalize" data-testid="text-user-role">
                {user?.role === "superadmin" ? "Super Administrador" : 
                 user?.role === "admin" ? "Administrador" :
                 user?.role === "operator" ? "Operador" : "Auditor"}
              </p>
            </div>
            {user?.business && (
              <>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs uppercase">Empresa</Label>
                  <p className="font-medium" data-testid="text-business-name">
                    {user.business.name}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs uppercase">Slug</Label>
                  <p className="font-medium font-mono text-sm" data-testid="text-business-slug">
                    {user.business.slug}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
