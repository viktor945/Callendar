// Clinical categories for planning and logging; no descriptions of technique.
export const sexTypes = [
  { id: 'vaginal', label: 'Вагинальный', title: 'Вагинальный секс' },
  { id: 'oral', label: 'Оральный', title: 'Оральный секс' },
  { id: 'anal', label: 'Анальный', title: 'Анальный секс' },
  { id: 'nonpenetrative', label: 'Без проникновения', title: 'Секс без проникновения' },
  { id: 'mixed', label: 'Смешанный', title: 'Секс · смешанный формат' },
  { id: 'other', label: 'Другой', title: 'Секс · другой формат' },
  { id: 'unspecified', label: 'Не указывать', title: 'Секс' },
] as const;
export type SexType = typeof sexTypes[number]['id'];
export const sexTitle = (type: SexType | null | undefined) => sexTypes.find(item => item.id === type)?.title || 'Секс';
export const sexTypeLabel = (type: SexType | null | undefined) => sexTypes.find(item => item.id === type)?.label || 'Тип не указан';
