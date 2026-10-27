// Tutorial hints (ROADMAP 11.4): each shows once per player, at the moment it is needed
// (the first town, the first battle, the first red circle…). Editable in the wiki.

export const HINTS: Record<string, string> = {
  town: 'Ходи — WASD або клік. Біля жителя натисни E. «!» над головою — у нього є для тебе квест.',
  map: 'Клік по локації — вирушити. Рівень під назвою: червоний — тобі ще зарано. J — журнал квестів, «!» на карті — куди вони ведуть.',
  battle: 'Герой б’є найближчого ворога сам. Ти ходиш (WASD) і цілишся мишею.',
  telegraph: 'Червона зона — удар, що ось-ось влучить. Вийди з неї!',
  skills: 'Клавіші 1–5 — скіли класу, R і F — скіли гілки; перезарядка видна на слотах унизу.',
  potion: 'Мало HP! Z / X / C — трави й зілля зі швидких слотів.',
  tree: 'У тебе є очки таланту! T — дерево талантів: відкривай нові скіли, підсилюй ранги й пасивки. Усе вкачати не вийде — обирай.',
  loot: 'Нова річ! Tab — інвентар: перетягни її на героя, щоб вдягнути.',
};

export type HintId = keyof typeof HINTS;
