# Арт: еталон стилю

_30.10.2026 · VISION §10. Арт у грі з'являється, коли контент біому зафіксовано; до того — фігури кодом._

![Еталон героя](hero-reference.png)

`hero-reference.png` — **еталон стилю**. Прикріплюй його до кожної генерації зі словами «same style as the reference».

## Файли

| Файл | Що це |
|---|---|
| `hero-reference.png` | еталон стилю (Воїн цілий) |
| `warrior-anim.png` | 18 кадрів анімації Воїна однією генерацією (сітка 6×3) — оригінал |
| `warrior-walk.png` | ходьба Воїна, 8 кадрів (сітка 4×2) — оригінал; у грі — `public/sprites/anim/warrior-walk.png`. Перший ряд `warrior-anim.png` (стара ходьба) не використовується |
| `warrior-poses.png` | ключові пози — перша спроба, у грі не використовується |
| `fx.png` | ефекти (слід удару, сяйво леза, спалах знака, іскра, кільце, пилюка) — оригінал; у грі — `public/sprites/anim/fx.png` |

**Анімація — покадрова.** Кадри генеруються **однією картинкою** (так персонаж однаковий у всіх кадрах). Скрипт вирізає кожен кадр за його контуром, вирівнює по ногах і центру тулуба й пакує в сітку однакових клітинок: `public/sprites/anim/warrior.png`. Які кадри — які рухи і скільки триває кожен — `src/data/heroAnim.ts`.

Промпт аркуша Воїна (сітка 6×3, прикріпити `hero-reference.png`):

```
Using exactly this character and style, draw one animation sprite sheet:
a grid of 6 columns × 3 rows, 18 frames, landscape image.
Rules for every frame: facing right, three-quarter view, the same size and scale,
one figure per cell, centred, figures never touch or overlap,
feet on the same ground line within each row, identical design, colours and outlines.
No motion blur, no effects, no text, no grid lines, fully transparent background.

Row 1 — walk cycle, 6 frames: right foot forward, down, passing, left foot forward, down, passing.
Row 2 — 1) idle, breathing in; 2) idle, breathing out; 3) ready stance; 4) wind-up, sword raised
behind the shoulder; 5) strike — sword swung horizontally forward; 6) follow-through.
Row 3 — 1) charging, sword low, knees bent; 2) sword raised high overhead, chest sign glowing;
3) dash start behind the shield; 4) low lunge forward, cloak flying back;
5) hit reaction, recoiling; 6) staggered, recovering.
```

Ряди «ходьба / спокій і удар / скіл, ривок, влучання» — шаблон і для інших персонажів (для ворогів — свої рухи).

**Ходьбу генеруй окремо, з описом кожного кадру й чоботами різного кольору** — інакше генератор малює 8 майже однакових стійок (ту саму ногу спереду), і ходьба виглядає як тупцювання. Різний колір чобіт дає і генераторові, і нам перевірити, що ноги чергуються. Генератор однаково може повторити кадр — перевір кожен і візьми в цикл лише правильні (`frames.walk` у `src/data/heroAnim.ts`). Промпт ходьби на 8 кадрів (сітка 4×2):

```
Using exactly this character and style, draw ONLY a walk cycle sprite sheet:
8 frames in a grid of 4 columns × 2 rows, landscape image, reading order left to right, top to bottom.
Facing right, three-quarter view, same size and scale in every frame, one figure per cell,
figures never touch, feet on the same ground line, identical design, colours and outlines.
To tell the legs apart: the NEAR leg (closer to the viewer) has a LIGHT tan boot,
the FAR leg has a DARK brown boot. Keep these colours in every frame.
1) LIGHT boot far forward, heel on the ground; DARK boot far behind, on its toes.
2) Weight on the LIGHT boot, knee bent; DARK boot lifted off the ground behind.
3) DARK boot lifted high (knee raised), swinging past the LIGHT leg; body at its highest.
4) DARK boot reaching forward in the air, LIGHT boot pushing off behind.
5) DARK boot far forward, heel on the ground; LIGHT boot far behind, on its toes.
6) Weight on the DARK boot, knee bent; LIGHT boot lifted off the ground behind.
7) LIGHT boot lifted high (knee raised), swinging past the DARK leg; body at its highest.
8) LIGHT boot reaching forward in the air, DARK boot pushing off behind.
Frames 1 and 5 must look clearly different: a different boot colour in front.
In frames 3 and 7 one foot must be clearly off the ground.
No motion blur, no effects, no text, no grid lines, fully transparent background.
```

Нарізка: `COLS=4 python scripts/pack-frames.py <аркуш> <атлас> <json> <прев'ю> "0-7:xy75"` — по x вирівнювання повне, по y знімається 75% стрибання: генератор перебільшує підйом і присідання тіла (до 18 px), і без цього ходьба трясеться.

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
