// Display names for ids.

export function className(classId: string | null): string {
  if (!classId) return 'Без класу';
  return CLASS_NAMES[classId] ?? classId;
}

const CLASS_NAMES: Record<string, string> = {
  warrior: 'Воїн',
  mage: 'Маг',
  archer: 'Лучник',
};
