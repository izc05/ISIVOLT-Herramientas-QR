import {
  Activity,
  Archive,
  Calculator,
  ClipboardCheck,
  Droplets,
  Flame,
  HardHat,
  QrCode,
  Snowflake,
  type LucideIcon,
} from 'lucide-react';

export type EcosystemModuleStatus = 'active' | 'next' | 'planned';

export type EcosystemModule = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  status: EcosystemModuleStatus;
  icon: LucideIcon;
  accent: 'blue' | 'cyan' | 'violet' | 'green' | 'orange';
};

export const ecosystemModules: EcosystemModule[] = [
  {
    id: 'tools',
    name: 'Herramientas · QR/NFC',
    shortName: 'Herramientas',
    description: 'Inventario, responsables, préstamos, devoluciones y etiquetado.',
    status: 'active',
    icon: QrCode,
    accent: 'blue',
  },
  {
    id: 'assets',
    name: 'Activos y mantenimiento',
    shortName: 'Activos',
    description: 'Equipos, ubicaciones, revisiones, averías e historial técnico.',
    status: 'next',
    icon: Activity,
    accent: 'cyan',
  },
  {
    id: 'work-orders',
    name: 'Órdenes de trabajo',
    shortName: 'OT',
    description: 'Incidencias, asignaciones, checklist, fotos, firmas e informes.',
    status: 'next',
    icon: ClipboardCheck,
    accent: 'violet',
  },
  {
    id: 'electrical',
    name: 'Inspecciones eléctricas',
    shortName: 'Eléctricas',
    description: 'REBT, mediciones, defectos, documentación e informes.',
    status: 'planned',
    icon: HardHat,
    accent: 'orange',
  },
  {
    id: 'hvac',
    name: 'RITE y climatización',
    shortName: 'RITE',
    description: 'Equipos térmicos, refrigeración, conductos y mantenimiento.',
    status: 'planned',
    icon: Snowflake,
    accent: 'cyan',
  },
  {
    id: 'fire-protection',
    name: 'Protección contra incendios',
    shortName: 'PCI',
    description: 'Extintores, BIE, detección, revisiones y documentación.',
    status: 'planned',
    icon: Flame,
    accent: 'orange',
  },
  {
    id: 'legionella',
    name: 'Control de Legionella',
    shortName: 'Legionella',
    description: 'Puntos de control, purgas, temperaturas, cloro y muestras.',
    status: 'planned',
    icon: Droplets,
    accent: 'green',
  },
  {
    id: 'warehouse',
    name: 'Inventario y almacén',
    shortName: 'Almacén',
    description: 'Materiales, existencias, entradas, salidas y ubicaciones.',
    status: 'planned',
    icon: Archive,
    accent: 'violet',
  },
  {
    id: 'calculators',
    name: 'Calculadoras técnicas',
    shortName: 'Cálculos',
    description: 'Electricidad, climatización, refrigeración y mantenimiento.',
    status: 'planned',
    icon: Calculator,
    accent: 'green',
  },
];

export const activeEcosystemModule = ecosystemModules.find((module) => module.status === 'active') ?? ecosystemModules[0];
