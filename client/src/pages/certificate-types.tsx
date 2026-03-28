import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  FormDescription,
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
  FolderOpen,
  Award,
  Clock,
  GraduationCap,
  BookOpen,
  FileCheck,
  Upload,
  X,
  Image,
  UserPen,
  Users,
  ImagePlus,
  Settings,
  ListPlus,
  Copy,
  FileText
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { CertificateType, CertificateCategory, CertificateTypeSigner, CertificateTypeLogo, CertificateTypeWithDetails, CustomField } from "@shared/schema";
import { certificateCategories } from "@shared/schema";

const categoryLabels: Record<CertificateCategory, string> = {
  cursos: "Cursos",
  capacitaciones: "Capacitaciones",
  certificaciones: "Certificaciones",
};

const categoryIcons: Record<CertificateCategory, typeof GraduationCap> = {
  cursos: GraduationCap,
  capacitaciones: BookOpen,
  certificaciones: FileCheck,
};

const formSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  description: z.string().optional(),
  category: z.enum(certificateCategories),
  validityMonths: z.coerce.number().min(1, "Mínimo 1 mes").max(120, "Máximo 120 meses"),
  footerText: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

function TypeCard({ 
  type, 
  onEdit, 
  onDelete,
  certificateCount
}: { 
  type: CertificateType; 
  onEdit: (type: CertificateType) => void;
  onDelete: (type: CertificateType) => void;
  certificateCount: number;
}) {
  const category = (type.category || "cursos") as CertificateCategory;
  const IconComponent = categoryIcons[category] || FolderOpen;
  
  return (
    <Card className="hover-elevate">
      <CardContent className="p-3 sm:p-6">
        <div className="flex items-start justify-between gap-2 sm:gap-4">
          <div className="flex items-start gap-2 sm:gap-4 flex-1 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 sm:w-12 sm:h-12 rounded-lg bg-primary/10 text-primary shrink-0">
              <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-semibold truncate" data-testid={`text-type-name-${type.id}`}>
                {type.name}
              </h3>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <p 
                  className="text-xs text-muted-foreground/70 font-mono truncate" 
                  data-testid={`text-type-id-${type.id}`}
                >
                  ID: {type.id.slice(0, 8)}...
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4"
                  onClick={() => {
                    navigator.clipboard.writeText(type.id);
                  }}
                  data-testid={`button-copy-id-${type.id}`}
                >
                  <Copy className="w-2.5 h-2.5" />
                </Button>
              </div>
              {type.description && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">
                  {type.description}
                </p>
              )}
              <div className="flex items-center gap-2 sm:gap-4 mt-2 sm:mt-3 text-xs sm:text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-0.5 sm:gap-1">
                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                  {type.validityMonths} {type.validityMonths === 1 ? 'mes' : 'meses'}
                </span>
                <span className="flex items-center gap-0.5 sm:gap-1">
                  <Award className="w-3 h-3 sm:w-4 sm:h-4" />
                  {certificateCount} cert.
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 sm:h-9 sm:w-9"
              onClick={() => onEdit(type)}
              data-testid={`button-edit-type-${type.id}`}
            >
              <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 sm:h-9 sm:w-9"
              onClick={() => onDelete(type)}
              data-testid={`button-delete-type-${type.id}`}
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-48 mb-3" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface SignerFormData {
  name: string;
  position: string;
  signatureFile: File | null;
  signatureUrl?: string;
}

interface LogoFormData {
  name: string;
  logoFile: File | null;
  logoUrl?: string;
}

function SignersSection({ 
  certificateTypeId, 
  signers,
  onRefresh
}: { 
  certificateTypeId: string;
  signers: CertificateTypeSigner[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingSigner, setEditingSigner] = useState<CertificateTypeSigner | null>(null);
  const [formData, setFormData] = useState<SignerFormData>({ name: "", position: "", signatureFile: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem("accessToken");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      return fetch(`/api/certificate-types/${certificateTypeId}/signers`, {
        method: "POST",
        headers,
        body: data,
      }).then(res => {
        if (!res.ok) throw new Error("Error al agregar firmante");
        return res.json();
      });
    },
    onSuccess: () => {
      toast({ title: "Firmante agregado" });
      resetForm();
      onRefresh();
    },
    onError: () => {
      toast({ title: "Error al agregar firmante", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const token = localStorage.getItem("accessToken");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      return fetch(`/api/certificate-types/${certificateTypeId}/signers/${id}`, {
        method: "PATCH",
        headers,
        body: data,
      }).then(res => {
        if (!res.ok) throw new Error("Error al actualizar firmante");
        return res.json();
      });
    },
    onSuccess: () => {
      toast({ title: "Firmante actualizado" });
      resetForm();
      onRefresh();
    },
    onError: () => {
      toast({ title: "Error al actualizar firmante", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/certificate-types/${certificateTypeId}/signers/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Firmante eliminado" });
      onRefresh();
    },
    onError: () => {
      toast({ title: "Error al eliminar firmante", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", position: "", signatureFile: null });
    setIsAdding(false);
    setEditingSigner(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.position.trim()) {
      toast({ title: "Complete nombre y cargo", variant: "destructive" });
      return;
    }

    const fd = new FormData();
    fd.append("name", formData.name);
    fd.append("position", formData.position);
    fd.append("displayOrder", String(signers.length));
    if (formData.signatureFile) {
      fd.append("signature", formData.signatureFile);
    }

    if (editingSigner) {
      updateMutation.mutate({ id: editingSigner.id, data: fd });
    } else {
      addMutation.mutate(fd);
    }
  };

  const handleEdit = (signer: CertificateTypeSigner) => {
    setEditingSigner(signer);
    setFormData({
      name: signer.name,
      position: signer.position,
      signatureFile: null,
      signatureUrl: signer.signatureUrl || undefined,
    });
    setIsAdding(true);
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Users className="w-4 h-4" />
          Firmantes ({signers.length})
        </h4>
        {!isAdding && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setIsAdding(true)}
            data-testid="button-add-signer"
          >
            <Plus className="w-4 h-4 mr-1" />
            Agregar
          </Button>
        )}
      </div>

      {isAdding && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Juan Pérez"
                  data-testid="input-signer-name"
                />
              </div>
              <div>
                <Label>Cargo *</Label>
                <Input
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="Director de Capacitación"
                  data-testid="input-signer-position"
                />
              </div>
            </div>
            <div>
              <Label>Firma (imagen)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, signatureFile: e.target.files?.[0] || null })}
                  className="flex-1"
                  data-testid="input-signer-signature"
                />
                {(formData.signatureFile || formData.signatureUrl) && (
                  <div className="w-16 h-10 border rounded bg-muted flex items-center justify-center overflow-hidden">
                    <img 
                      src={formData.signatureFile ? URL.createObjectURL(formData.signatureFile) : formData.signatureUrl} 
                      alt="Firma" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
              <Button 
                size="sm" 
                onClick={handleSubmit} 
                disabled={isPending}
                data-testid="button-save-signer"
              >
                {isPending ? "Guardando..." : (editingSigner ? "Actualizar" : "Agregar")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {signers.length === 0 && !isAdding ? (
        <div className="text-center py-6 text-muted-foreground">
          <UserPen className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Sin firmantes configurados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {signers.map((signer) => (
            <div 
              key={signer.id} 
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              {signer.signatureUrl ? (
                <div className="w-12 h-8 border rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  <img src={signer.signatureUrl} alt="Firma" className="max-w-full max-h-full object-contain" />
                </div>
              ) : (
                <div className="w-12 h-8 border rounded bg-muted flex items-center justify-center shrink-0">
                  <UserPen className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{signer.name}</p>
                <p className="text-xs text-muted-foreground truncate">{signer.position}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(signer)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => deleteMutation.mutate(signer.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogosSection({ 
  certificateTypeId,
  logos,
  onRefresh
}: { 
  certificateTypeId: string;
  logos: CertificateTypeLogo[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingLogo, setEditingLogo] = useState<CertificateTypeLogo | null>(null);
  const [formData, setFormData] = useState<LogoFormData>({ name: "", logoFile: null });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem("accessToken");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      return fetch(`/api/certificate-types/${certificateTypeId}/logos`, {
        method: "POST",
        headers,
        body: data,
      }).then(res => {
        if (!res.ok) throw new Error("Error al agregar logo");
        return res.json();
      });
    },
    onSuccess: () => {
      toast({ title: "Logo agregado" });
      resetForm();
      onRefresh();
    },
    onError: () => {
      toast({ title: "Error al agregar logo", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const token = localStorage.getItem("accessToken");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      return fetch(`/api/certificate-types/${certificateTypeId}/logos/${id}`, {
        method: "PATCH",
        headers,
        body: data,
      }).then(res => {
        if (!res.ok) throw new Error("Error al actualizar logo");
        return res.json();
      });
    },
    onSuccess: () => {
      toast({ title: "Logo actualizado" });
      resetForm();
      onRefresh();
    },
    onError: () => {
      toast({ title: "Error al actualizar logo", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/certificate-types/${certificateTypeId}/logos/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Logo eliminado" });
      onRefresh();
    },
    onError: () => {
      toast({ title: "Error al eliminar logo", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ name: "", logoFile: null });
    setIsAdding(false);
    setEditingLogo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = () => {
    if (!formData.logoFile && !editingLogo) {
      toast({ title: "Seleccione una imagen", variant: "destructive" });
      return;
    }

    const fd = new FormData();
    fd.append("name", formData.name || "");
    fd.append("displayOrder", String(logos.length));
    if (formData.logoFile) {
      fd.append("logo", formData.logoFile);
    }

    if (editingLogo) {
      updateMutation.mutate({ id: editingLogo.id, data: fd });
    } else {
      addMutation.mutate(fd);
    }
  };

  const handleEdit = (logo: CertificateTypeLogo) => {
    setEditingLogo(logo);
    setFormData({
      name: logo.name || "",
      logoFile: null,
      logoUrl: logo.logoUrl,
    });
    setIsAdding(true);
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Image className="w-4 h-4" />
          Logos ({logos.length})
        </h4>
        {!isAdding && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setIsAdding(true)}
            data-testid="button-add-logo"
          >
            <Plus className="w-4 h-4 mr-1" />
            Agregar
          </Button>
        )}
      </div>

      {isAdding && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Nombre (opcional)</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Logo empresa certificadora"
                data-testid="input-logo-name"
              />
            </div>
            <div>
              <Label>Imagen *</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, logoFile: e.target.files?.[0] || null })}
                  className="flex-1"
                  data-testid="input-logo-file"
                />
                {(formData.logoFile || formData.logoUrl) && (
                  <div className="w-16 h-12 border rounded bg-muted flex items-center justify-center overflow-hidden">
                    <img 
                      src={formData.logoFile ? URL.createObjectURL(formData.logoFile) : formData.logoUrl} 
                      alt="Logo" 
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
              <Button 
                size="sm" 
                onClick={handleSubmit} 
                disabled={isPending}
                data-testid="button-save-logo"
              >
                {isPending ? "Guardando..." : (editingLogo ? "Actualizar" : "Agregar")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {logos.length === 0 && !isAdding ? (
        <div className="text-center py-6 text-muted-foreground">
          <ImagePlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Sin logos configurados</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {logos.map((logo) => (
            <div 
              key={logo.id} 
              className="flex flex-col items-center gap-2 p-3 rounded-lg border bg-card"
            >
              <div className="w-full h-16 border rounded bg-muted flex items-center justify-center overflow-hidden">
                <img src={logo.logoUrl} alt={logo.name || "Logo"} className="max-w-full max-h-full object-contain" />
              </div>
              <p className="text-xs text-muted-foreground truncate w-full text-center">
                {logo.name || "Sin nombre"}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => handleEdit(logo)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => deleteMutation.mutate(logo.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const fieldTypeLabels: Record<string, string> = {
  text: "Texto",
  number: "Número",
  date: "Fecha",
  select: "Selección",
};

interface CustomFieldFormData {
  fieldName: string;
  fieldLabel: string;
  fieldType: "text" | "number" | "date" | "select";
  isRequired: boolean;
  displayOrder: number;
}

function CustomFieldsSection({ 
  certificateTypeId,
  customFields,
  onRefresh
}: { 
  certificateTypeId: string;
  customFields: CustomField[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [formData, setFormData] = useState<CustomFieldFormData>({ 
    fieldName: "", 
    fieldLabel: "", 
    fieldType: "text",
    isRequired: false,
    displayOrder: 0
  });

  const addMutation = useMutation({
    mutationFn: async (data: CustomFieldFormData) => {
      return apiRequest("POST", `/api/certificate-types/${certificateTypeId}/custom-fields`, data);
    },
    onSuccess: () => {
      toast({ title: "Campo agregado" });
      resetForm();
      onRefresh();
    },
    onError: () => {
      toast({ title: "Error al agregar campo", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CustomFieldFormData> }) => {
      return apiRequest("PATCH", `/api/certificate-types/${certificateTypeId}/custom-fields/${id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Campo actualizado" });
      resetForm();
      onRefresh();
    },
    onError: () => {
      toast({ title: "Error al actualizar campo", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/certificate-types/${certificateTypeId}/custom-fields/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Campo eliminado" });
      onRefresh();
    },
    onError: () => {
      toast({ title: "Error al eliminar campo", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({ 
      fieldName: "", 
      fieldLabel: "", 
      fieldType: "text",
      isRequired: false,
      displayOrder: 0
    });
    setIsAdding(false);
    setEditingField(null);
  };

  const handleSubmit = () => {
    if (!formData.fieldLabel.trim()) {
      toast({ title: "Ingrese el nombre del campo", variant: "destructive" });
      return;
    }

    const data = {
      ...formData,
      displayOrder: editingField ? formData.displayOrder : customFields.length,
    };

    if (editingField) {
      updateMutation.mutate({ id: editingField.id, data });
    } else {
      addMutation.mutate(data);
    }
  };

  const handleEdit = (field: CustomField) => {
    setEditingField(field);
    setFormData({
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType as "text" | "number" | "date" | "select",
      isRequired: field.isRequired,
      displayOrder: field.displayOrder,
    });
    setIsAdding(true);
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Campos Personalizados ({customFields.length})
        </h4>
        {!isAdding && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setIsAdding(true)}
            data-testid="button-add-custom-field"
          >
            <Plus className="w-4 h-4 mr-1" />
            Agregar
          </Button>
        )}
      </div>

      {isAdding && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label>Nombre del Campo *</Label>
              <Input
                value={formData.fieldLabel}
                onChange={(e) => {
                  const label = e.target.value;
                  const technicalName = label
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]+/g, "_")
                    .replace(/^_+|_+$/g, "");
                  setFormData({ 
                    ...formData, 
                    fieldLabel: label,
                    fieldName: technicalName
                  });
                }}
                placeholder="ej: Maquinaria Operada"
                data-testid="input-field-label"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este nombre aparecerá en el certificado
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de dato</Label>
                <Select 
                  value={formData.fieldType} 
                  onValueChange={(v) => setFormData({ ...formData, fieldType: v as "text" | "number" | "date" | "select" })}
                >
                  <SelectTrigger data-testid="select-field-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="date">Fecha</SelectItem>
                    <SelectItem value="select">Selección</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="isRequired"
                  checked={formData.isRequired}
                  onCheckedChange={(checked) => setFormData({ ...formData, isRequired: checked === true })}
                  data-testid="checkbox-field-required"
                />
                <Label htmlFor="isRequired" className="cursor-pointer">Campo obligatorio</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
              <Button 
                size="sm" 
                onClick={handleSubmit} 
                disabled={isPending}
                data-testid="button-save-custom-field"
              >
                {isPending ? "Guardando..." : (editingField ? "Actualizar" : "Agregar")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {customFields.length === 0 && !isAdding ? (
        <div className="text-center py-6 text-muted-foreground">
          <ListPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Sin campos personalizados</p>
          <p className="text-xs mt-1">Los campos personalizados aparecerán en el importador Excel</p>
        </div>
      ) : (
        <div className="space-y-2">
          {customFields.map((field) => (
            <div 
              key={field.id} 
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              data-testid={`row-custom-field-${field.id}`}
            >
              <div className="w-8 h-8 border rounded bg-muted flex items-center justify-center shrink-0">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate" data-testid={`text-field-label-${field.id}`}>{field.fieldLabel}</p>
                <p className="text-xs text-muted-foreground" data-testid={`text-field-info-${field.id}`}>
                  {field.fieldName} • {fieldTypeLabels[field.fieldType]} {field.isRequired && "• Obligatorio"}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleEdit(field)}
                  data-testid={`button-edit-field-${field.id}`}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => deleteMutation.mutate(field.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-field-${field.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CertificateTypes() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CertificateType | null>(null);
  const [activeTab, setActiveTab] = useState<CertificateCategory>("cursos");
  const [dialogTab, setDialogTab] = useState<"general" | "signers" | "logos" | "customFields" | "footer">("general");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "cursos",
      validityMonths: 12,
      footerText: "",
    },
  });

  const { data: types, isLoading } = useQuery<CertificateType[]>({
    queryKey: ["/api/certificate-types"],
  });

  const { data: counts } = useQuery<Record<string, number>>({
    queryKey: ["/api/certificate-types/counts"],
  });

  // Fetch details (signers & logos) when editing
  const { data: typeDetails, refetch: refetchDetails } = useQuery<CertificateTypeWithDetails>({
    queryKey: ["/api/certificate-types", selectedType?.id, "details"],
    enabled: !!selectedType?.id && dialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/certificate-types", data);
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificate-types"] });
      toast({ title: "Tipo de certificado creado correctamente" });
      // If creating, switch to customFields first to add custom fields, then signers and logos
      response.json().then((newType: CertificateType) => {
        setSelectedType(newType);
        setDialogTab("customFields");
        refetchDetails();
      }).catch(() => {
        handleCloseDialog();
      });
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
        description: "No se pudo crear el tipo de certificado",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData & { id: string }) => {
      return apiRequest("PATCH", `/api/certificate-types/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificate-types"] });
      toast({ title: "Tipo de certificado actualizado" });
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
        description: "No se pudo actualizar el tipo de certificado",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/certificate-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificate-types"] });
      toast({ title: "Tipo de certificado eliminado" });
      setDeleteDialogOpen(false);
      setSelectedType(null);
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
        description: "No se pudo eliminar. Puede que tenga certificados asociados.",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setSelectedType(null);
    setDialogTab("general");
    form.reset({
      name: "",
      description: "",
      category: activeTab,
      validityMonths: 12,
      footerText: "",
    });
    setDialogOpen(true);
  };

  const handleEdit = (type: CertificateType) => {
    setSelectedType(type);
    setDialogTab("general");
    form.reset({
      name: type.name,
      description: type.description || "",
      category: (type.category || "cursos") as CertificateCategory,
      validityMonths: type.validityMonths,
      footerText: type.footerText || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (type: CertificateType) => {
    setSelectedType(type);
    setDeleteDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedType(null);
    setDialogTab("general");
    form.reset();
  };

  const onSubmit = (data: FormData) => {
    if (selectedType) {
      updateMutation.mutate({ ...data, id: selectedType.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Filter types by active category
  const filteredTypes = types?.filter(
    (type) => (type.category || "cursos") === activeTab
  ) || [];

  // Count types per category
  const countByCategory = certificateCategories.reduce((acc, cat) => {
    acc[cat] = types?.filter((t) => (t.category || "cursos") === cat).length || 0;
    return acc;
  }, {} as Record<CertificateCategory, number>);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Tipos de Certificados</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            Gestione los tipos de certificaciones disponibles
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm" className="text-xs sm:text-sm" data-testid="button-create-type">
          <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Crear Nuevo
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CertificateCategory)}>
        <TabsList className="grid w-full grid-cols-3 h-9 sm:h-auto">
          {certificateCategories.map((cat) => {
            const IconComp = categoryIcons[cat];
            return (
              <TabsTrigger 
                key={cat} 
                value={cat}
                className="gap-1 sm:gap-2 text-xs sm:text-sm px-1 sm:px-3"
                data-testid={`tab-${cat}`}
              >
                <IconComp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{categoryLabels[cat]}</span>
                <span className="sm:hidden">{categoryLabels[cat].slice(0, 4)}</span>
                {countByCategory[cat] > 0 && (
                  <span className="ml-0.5 sm:ml-1 text-xs bg-muted px-1 py-0.5 rounded-full">
                    {countByCategory[cat]}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {certificateCategories.map((cat) => (
          <TabsContent key={cat} value={cat} className="mt-4 sm:mt-6">
            {isLoading ? (
              <LoadingSkeleton />
            ) : filteredTypes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4">
                {filteredTypes.map((type) => (
                  <TypeCard 
                    key={type.id} 
                    type={type} 
                    onEdit={handleEdit} 
                    onDelete={handleDelete}
                    certificateCount={counts?.[type.id] || 0}
                  />
                ))}
              </div>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>
              {selectedType ? "Editar Tipo de Certificado" : "Crear Nuevo Tipo de Certificado"}
            </DialogTitle>
            <DialogDescription>
              {selectedType 
                ? "Configure los datos, firmantes y logos del certificado" 
                : "Complete los datos para crear un nuevo tipo de certificado"}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as typeof dialogTab)}>
            <TabsList className="grid w-full grid-cols-5 h-9 sm:h-auto">
              <TabsTrigger value="general" className="gap-0.5 sm:gap-1 text-xs px-1">
                <FileCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">General</span>
                <span className="sm:hidden">Gen</span>
              </TabsTrigger>
              <TabsTrigger 
                value="customFields" 
                className="gap-0.5 sm:gap-1 text-xs px-1"
                disabled={!selectedType}
              >
                <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Campos</span>
                <span className="sm:hidden">Cam</span>
                {typeDetails?.customFields?.length ? (
                  <span className="ml-0.5 text-xs bg-muted px-0.5 py-0.5 rounded-full">
                    {typeDetails.customFields.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger 
                value="signers" 
                className="gap-0.5 sm:gap-1 text-xs px-1"
                disabled={!selectedType}
              >
                <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Firmantes</span>
                <span className="sm:hidden">Firm</span>
                {typeDetails?.signers?.length ? (
                  <span className="ml-0.5 text-xs bg-muted px-0.5 py-0.5 rounded-full">
                    {typeDetails.signers.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger 
                value="logos" 
                className="gap-0.5 sm:gap-1 text-xs px-1"
                disabled={!selectedType}
              >
                <Image className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Logos</span>
                <span className="sm:hidden">Logo</span>
                {typeDetails?.logos?.length ? (
                  <span className="ml-0.5 text-xs bg-muted px-0.5 py-0.5 rounded-full">
                    {typeDetails.logos.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger 
                value="footer" 
                className="gap-0.5 sm:gap-1 text-xs px-1"
                disabled={!selectedType}
              >
                <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Pie</span>
                <span className="sm:hidden">Pie</span>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[300px] sm:h-[400px] mt-4 pr-4">
              <TabsContent value="general" className="mt-0">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categoría *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-type-category">
                                <SelectValue placeholder="Seleccione una categoría" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {certificateCategories.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {categoryLabels[cat]}
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
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre *</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ej: Trabajo en Altura" 
                              {...field} 
                              data-testid="input-type-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descripción</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Descripción opcional" 
                              {...field} 
                              data-testid="input-type-description"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="validityMonths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vigencia (meses) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              min={1} 
                              max={120} 
                              {...field} 
                              data-testid="input-type-validity"
                            />
                          </FormControl>
                          <FormDescription>
                            Duración de la vigencia del certificado en meses
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="pt-2">
                      <Button 
                        type="submit" 
                        disabled={isPending}
                        className="w-full"
                        data-testid="button-save-type"
                      >
                        {isPending ? "Guardando..." : (selectedType ? "Guardar Cambios" : "Crear y Continuar")}
                      </Button>
                      {!selectedType && (
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          Después de crear, podrá agregar firmantes y logos
                        </p>
                      )}
                    </div>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="signers" className="mt-0">
                {selectedType && (
                  <SignersSection 
                    certificateTypeId={selectedType.id}
                    signers={typeDetails?.signers || []}
                    onRefresh={() => refetchDetails()}
                  />
                )}
              </TabsContent>

              <TabsContent value="logos" className="mt-0">
                {selectedType && (
                  <LogosSection 
                    certificateTypeId={selectedType.id}
                    logos={typeDetails?.logos || []}
                    onRefresh={() => refetchDetails()}
                  />
                )}
              </TabsContent>

              <TabsContent value="customFields" className="mt-0">
                {selectedType && (
                  <CustomFieldsSection 
                    certificateTypeId={selectedType.id}
                    customFields={typeDetails?.customFields || []}
                    onRefresh={() => refetchDetails()}
                  />
                )}
              </TabsContent>

              <TabsContent value="footer" className="mt-0">
                {selectedType && (
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      Texto que aparecerá en la parte inferior del certificado PDF. 
                      Ideal para información legal, normativas o acreditaciones.
                    </div>
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="footerText"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Texto del Pie</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Ej: Cumpliendo con las disposiciones legales del D.S. N°132/2002 de Seguridad Minera..." 
                                  className="min-h-[150px]"
                                  {...field} 
                                  data-testid="input-footer-text"
                                />
                              </FormControl>
                              <FormDescription>
                                Este texto se mostrará en un recuadro al pie del certificado
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button 
                          type="submit" 
                          disabled={isPending}
                          className="w-full"
                          data-testid="button-save-footer"
                        >
                          {isPending ? "Guardando..." : "Guardar Pie del Certificado"}
                        </Button>
                      </form>
                    </Form>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleCloseDialog}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tipo de certificado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Si hay certificados asociados, no podrá eliminarlo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedType && deleteMutation.mutate(selectedType.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
