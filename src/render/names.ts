// Display names for ids.

import { getClass } from '../data/classes';

export function className(classId: string | null): string {
  return classId ? getClass(classId).name : 'Без класу';
}
