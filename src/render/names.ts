// Display names for ids.

import { getClass } from '../data/classes';
import { getPromotion } from '../data/promotions';

export function className(classId: string | null, promotion: string | null = null): string {
  if (!classId) return 'Новачок';
  const c = getClass(classId).name;
  return promotion ? `${c} → ${getPromotion(promotion).name}` : c;
}

/** Outline colour of the hero: the branch colour after the promotion, else the class colour. */
export function heroColor(classId: string | null, promotion: string | null): string | null {
  if (promotion) return getPromotion(promotion).color;
  return classId ? getClass(classId).color : null;
}
