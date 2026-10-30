# Арт: еталон стилю

_30.10.2026 · VISION §10. Арт у грі з'являється, коли контент біому зафіксовано; до того — фігури кодом._

![Еталон героя](hero-reference.png)

`hero-reference.png` — **еталон стилю**. Прикріплюй його до кожної генерації зі словами «same style as the reference».

## Файли

| Файл | Що це |
|---|---|
| `hero-reference.png` | еталон стилю (Воїн цілий) |
| `warrior-parts.png` | частини Воїна для анімації — оригінал; у грі — `public/sprites/rig/warrior.png` (удвічі менший) |
| `warrior-poses.png` | ключові пози — орієнтир для анімації, у грі не використовується |
| `fx.png` | ефекти (слід удару, сяйво леза, спалах знака, іскра, кільце, пилюка) — оригінал; у грі — `public/sprites/rig/fx.png` |

Координати частин і суглобів — у `src/data/heroRig.ts`, у пікселях оригінальних аркушів. Новий аркуш частин — нові координати.

## Правила стилю

- **Чіткі товсті темні контури**, великі прості форми, пласкі кольори з одним тоном тіні, легка мальована фактура на великих площах. Дрібних деталей немає (кільця кольчуги, дірки, пряжки).
- **Має читатися при ~100 px** на екрані. Перевірка — зменшити й поставити на землю біому серед ворогів.
- **Вид — три чверті, обличчям праворуч**, прозорий фон, без тіні на землі.
- **Настрій темний, приглушений**, але не брудний.
- **Герой теплий** (вино-червоний, охра, золото знака), **вороги — холодні й темні кольори свого біому**, щоб героя було видно в будь-якому натовпі.
- **Знак Берегині — найяскравіша пляма** на героєві.
- **Анімація частинами:** голова, тулуб, плащ, руки, ноги, зброя — окремо. Один персонаж — один чат: спершу цілий, потім розклад на частини з тієї самої картинки.

## Промпт героя (ChatGPT)

```
2D game character sprite for a top-down action roguelite, three-quarter view
(camera tilted about 45 degrees), facing right, full body, idle standing pose.

Style: clean bold cartoon-like illustration with thick, even dark outlines
(like Don't Starve or Darkest Dungeon simplified), large simple shapes,
flat colours with only one shadow tone per colour, almost no texture,
no fine details. Must stay readable at 100 pixels tall.

Character: a foreign warrior from across the sea, sole survivor of a shipwreck,
in a dark Slavic folk-fantasy world. Hooded cloak, simple tunic over a plain mail shirt
(drawn as one solid grey shape, no ring pattern), a wide belt, wrapped boots,
a round shield and a short one-handed sword.
A large glowing rune-like sign on the chest — pale gold, clearly visible.

Colours: warm and contrasting so he stands out against green forest ground —
deep crimson cloak, warm ochre tunic, dark brown leather, grey steel,
pale gold glow. Slightly larger head and hands than realistic.

Strong clear silhouette. Fully transparent background, no ground shadow, no text.
```

Далі в тому самому чаті:

```
Keep exactly this design, outlines and simplicity, but make the mood darker and more somber:
desaturate the colours slightly (darker wine-red cloak, muted ochre tunic, darker steel),
add one soft shadow tone and a very light painted texture on large areas.
The glowing sign stays bright pale gold — it should be the brightest spot on the character.
Transparent background.
```
