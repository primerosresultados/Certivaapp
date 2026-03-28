# Directrices de Diseño: Plataforma de Certificaciones Digitales

## Enfoque de Diseño

**Sistema Seleccionado:** Material Design adaptado para aplicaciones empresariales

**Justificación:** Esta es una herramienta administrativa que prioriza eficiencia, claridad de datos y usabilidad en entornos profesionales. Material Design proporciona patrones probados para tablas de datos, formularios y dashboards.

---

## Tipografía

**Familias de Fuente (Google Fonts):**
- **Principal:** Inter (moderna, excelente legibilidad en pantallas)
- **Datos/Números:** JetBrains Mono (para RUTs, números de certificado)

**Jerarquía:**
- Títulos de página: 32px, peso 600
- Encabezados de sección: 24px, peso 600
- Subtítulos: 18px, peso 500
- Cuerpo principal: 16px, peso 400
- Texto secundario/metadatos: 14px, peso 400
- Etiquetas de formulario: 14px, peso 500
- Datos tabulares: 15px, peso 400

---

## Sistema de Espaciado

**Primitivos Tailwind:** Utilizaremos principalmente unidades de **2, 4, 6, 8, 12, 16**

- Padding de tarjetas: `p-6`
- Espaciado entre secciones: `mb-8` o `mb-12`
- Gaps en grids: `gap-4` o `gap-6`
- Margen entre elementos de formulario: `mb-4`
- Padding de botones: `px-6 py-3`
- Padding de página principal: `p-8`

---

## Estructura de Layouts

### Panel de Administración

**Layout Principal:**
- Sidebar fijo izquierdo (280px de ancho en desktop)
- Área de contenido principal con `max-w-7xl` centrado
- Header superior con información de usuario y acciones rápidas (altura 64px)

**Sidebar de Navegación:**
- Logo/nombre empresa arriba (altura 64px)
- Menú vertical con iconos (Heroicons) + etiquetas
- Items de menú: altura 48px, padding `px-4 py-3`
- Secciones: Dashboard, Certificados, Tipos de Curso, Importar, Historial

**Área de Contenido:**
- Breadcrumbs superiores (altura 40px)
- Título de página + acciones principales en header de sección
- Contenido principal con cards y tablas

### Página Pública de Validación (QR)

**Layout Mobile-First:**
- Diseño de tarjeta centrado verticalmente
- Ancho máximo: `max-w-md` (448px)
- Padding horizontal: `px-4`
- Centrado con flexbox/grid
- Sin navegación compleja, interfaz limpia de lectura

---

## Biblioteca de Componentes

### 1. Dashboard (Página Principal Admin)

**Grid de Estadísticas:**
- Layout: 3 columnas en desktop (`grid-cols-1 md:grid-cols-3`)
- Tarjetas con métricas: Certificados Emitidos, Vigentes, Vencidos
- Cada tarjeta incluye: Icono grande (48px), número principal (36px), etiqueta descriptiva, cambio porcentual

**Tabla de Actividad Reciente:**
- Últimos 10 certificados emitidos
- Columnas: Fecha, Nombre, RUT, Curso, Estado
- Acciones rápidas: Ver detalles, Descargar QR

### 2. Gestión de Tipos de Certificado

**Vista de Lista:**
- Tarjetas en grid 2 columnas (`grid-cols-1 md:grid-cols-2`)
- Cada tarjeta muestra: Nombre del curso, cantidad de certificados emitidos, íconos de acción
- Botón flotante "+" para agregar nuevo tipo

**Formulario de Creación/Edición:**
- Modal centrado (`max-w-lg`)
- Campos: Nombre del curso, Descripción, Duración de vigencia (meses)
- Botones de acción en footer del modal

### 3. Importador Masivo

**Interfaz de Carga:**
- Área de drag & drop grande (altura mínima 200px)
- Icono de archivo Excel/CSV centrado (64px)
- Texto instructivo claro
- Botón secundario "Seleccionar archivo"
- Link de descarga de plantilla Excel ejemplo

**Vista Previa de Datos:**
- Tabla con scroll horizontal
- Primeras 5 filas mostradas para validación
- Resumen: "X registros detectados, Y válidos, Z con errores"
- Indicadores visuales de errores en celdas problemáticas
- Botones: Cancelar, Procesar datos

**Progreso de Procesamiento:**
- Barra de progreso linear (altura 8px)
- Contador: "Procesando 45 de 120 certificados..."
- Mensajes de éxito/error agrupados

### 4. Listado de Certificados

**Barra de Filtros:**
- Búsqueda por nombre/RUT (input ancho completo o 50%)
- Filtros: Tipo de curso (dropdown), Estado (tabs: Todos/Vigentes/Vencidos)
- Altura de barra: 64px

**Tabla de Datos:**
- Responsive: en mobile se convierte en cards apiladas
- Columnas desktop: Checkbox, Nombre, RUT, Curso, Fecha Emisión, Estado, Acciones
- Paginación inferior: 25 resultados por página
- Acciones en hover: Ver QR, Descargar, Reenviar

**Estados Visuales:**
- Badge para "Vigente" (verde)
- Badge para "Vencido" (rojo)
- Badge para "Próximo a vencer" (amarillo, <30 días)

### 5. Ficha de Certificado Individual

**Layout de 2 Columnas (desktop):**
- **Columna Izquierda (60%):** Información del certificado
  - Nombre completo (24px)
  - RUT
  - Tipo de curso
  - Número de certificado único
  - Fecha de emisión
  - Fecha de vencimiento
  - Estado actual con badge
  
- **Columna Derecha (40%):** QR Code y acciones
  - Código QR centrado (256x256px)
  - URL de validación debajo
  - Botones de acción apilados: Descargar QR (PNG), Descargar Certificado (PDF), Copiar Link

### 6. Página Pública de Validación (QR Scan)

**Estructura Vertical:**
- Logo/nombre de empresa centrado arriba
- Tarjeta principal con información del certificado:
  - Icono de verificación grande (si vigente) o alerta (si vencido)
  - Título: "Certificado Válido" o "Certificado Vencido"
  - Nombre del titular (20px, peso 600)
  - Detalles en lista: Curso, N° Certificado, Fecha Emisión, Vigencia
- Footer discreto con powered by

**Diseño Mobile:**
- Padding: `px-4 py-6`
- Tarjeta con bordes redondeados (`rounded-2xl`)
- Sombra suave para elevar
- Máximo ancho: 448px, centrado

### 7. Formularios

**Estilo de Campos:**
- Labels encima del input (no flotantes)
- Inputs con borde completo, altura 48px
- Padding interno: `px-4 py-3`
- Border radius: `rounded-lg`
- Mensajes de error debajo en texto pequeño
- Campos requeridos con asterisco rojo

**Validación:**
- Mensajes inline debajo de cada campo
- Resumen de errores en toast superior si hay múltiples problemas

### 8. Navegación y Acciones

**Botones Primarios:**
- Altura: 48px
- Padding: `px-6 py-3`
- Border radius: `rounded-lg`
- Peso de texto: 500

**Botones Secundarios:**
- Mismas dimensiones, estilo outline

**Botones de Acción en Tablas:**
- Iconos de 20px
- Padding cuadrado: `p-2`
- Tooltip en hover

### 9. Sistema de Iconografía

**Librería:** Heroicons (outline para navegación, solid para estados)

**Tamaños:**
- Navegación sidebar: 20px
- Dashboard métricas: 48px
- Botones de acción: 20px
- Estados/badges: 16px

---

## Imágenes

**No se requieren imágenes hero** para esta aplicación administrativa.

**Imágenes funcionales:**
- Logo de empresa en sidebar y página de validación pública
- Iconos para tipos de certificados (personalizables)
- Placeholder de drag & drop en importador

---

## Patrones de Interacción

**Feedback Visual:**
- Toasts para confirmaciones (posición: top-right, duración: 4s)
- Skeleton loaders para carga de tablas
- Spinners para procesamiento de archivos
- Estados de hover sutiles en items clickeables

**Responsividad:**
- Desktop-first para panel admin (optimizado para 1440px+)
- Mobile-first para página de validación (optimizado para 375px+)
- Breakpoints Tailwind estándar: sm(640), md(768), lg(1024), xl(1280)

**Animaciones:** Usar con extrema moderación
- Transiciones suaves en hover (150ms)
- Fade in para modals (200ms)
- NO usar animaciones de scroll o efectos decorativos

---

Esta plataforma prioriza claridad, eficiencia y accesibilidad en entornos profesionales, manteniendo una estética moderna y profesional sin elementos decorativos innecesarios.