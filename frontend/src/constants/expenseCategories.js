export const EXPENSE_CATEGORIES = [
  'Administración',
  'Servicios básicos',
  'Limpieza',
  'Mantenimiento preventivo',
  'Mantenimiento correctivo y reparaciones',
  'Seguridad',
  'Jardinería y áreas comunes',
  'Suministros y consumibles',
  'Honorarios y servicios profesionales',
  'Tributos, tasas y comisiones',
  'Seguros y cumplimiento',
  'Otros',
];

export const EXPENSE_CATEGORY_ICONS = {
  Administración: '💼',
  'Servicios básicos': '💧',
  Servicios: '💧',
  Limpieza: '🧹',
  Mantenimiento: '🔧',
  'Mantenimiento preventivo': '🔧',
  'Mantenimiento correctivo y reparaciones': '🛠️',
  Seguridad: '🛡️',
  'Jardinería y áreas comunes': '🌱',
  'Suministros y consumibles': '📦',
  'Honorarios y servicios profesionales': '👔',
  'Tributos, tasas y comisiones': '🏛️',
  'Seguros y cumplimiento': '✅',
  Otros: '📌',
};

export function getExpenseCategoryIcon(category) {
  return EXPENSE_CATEGORY_ICONS[category] || EXPENSE_CATEGORY_ICONS.Otros;
}
