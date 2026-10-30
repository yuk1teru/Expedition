# Арт: еталон стилю

_30.10.2026 · VISION §10. Арт у грі з'являється, коли контент біому зафіксовано; до того — фігури кодом._

![Еталон героя](hero-reference.png)

`hero-reference.png` — **еталон стилю**. Прикріплюй його до кожної генерації зі словами «same style as the reference».

## Файли

| Файл | Що це |
|---|---|
| `hero-reference.png` | еталон стилю (Воїн цілий) |
| **`warrior-full.png`** | **аркуш Воїна, яким грає гра:** 3 × 6 — стояння, ходьба, вертикальний удар, горизонтальний удар, випад мечем, ривок щитом. У грі — `public/sprites/anim/warrior.png` |
| `mage-reference.png`, **`mage-full.png`** | Маг: цілий і аркуш 3 × 6 — стояння, ходьба, каст уперед, каст над головою, канал, блимання. У грі — `public/sprites/anim/mage.png` (нарізка з `GRID=3x6`: кристал посоха торкається фігури рядом нижче) |
| `archer-reference.png`, **`archer-full.png`** | Лучник: цілий і аркуш 3 × 6 — стояння, ходьба, постріл уперед, постріл угору, віяло, відскок. У грі — `public/sprites/anim/archer.png` (`GRID=3x6`) |
| `fx.png` | ефекти (слід удару, сяйво леза, спалах знака, іскра, кільце, пилюка) — оригінал; у грі — `public/sprites/anim/fx.png` |
| `wolf-full.png` | Вовк, 3 × 3: біг, присід / стрибок / приземлення з укусом, удар / падіння / мертвий. У грі — `public/sprites/anim/wolf.png` (`GRID=3x3`) |
| `mushroom-full.png` | Гриб-плювака, 3 × 3: хода, набухання / плювок / відкат, удар / розпад / купка. У грі — `public/sprites/anim/mushroom.png` (`GRID=3x3`) |
| `alpha-full.png` | Ватажок зграї, 3 × 4: біг, ривок (присід, кидок, гальмування), стрибок (присід, політ, удар об землю), виття / задишка / удар. У грі — `public/sprites/anim/alpha.png` (`GRID=3x4`) |
| `spirit-full.png` | Дух занепаду, 3 × 2: ширяння, набухання / випуск туману / втеча (дивиться ліворуч). У грі — `public/sprites/anim/spirit.png` (`GRID=3x2`) |
| `forest-ground.png`, `forest-obstacles.png`, `forest-concept.png` | Ліс: безшовна текстура землі, аркуш перешкод, концепт локації. **У грі ще не використані** |

Звірі описані в `BEAST_SHEETS` (`src/data/beastAnim.ts`): які кадри — які пози, масштаб, тінь. Пеньок поки без аркуша — малюється кодом.

**Анімація — покадрова.** Усі рухи персонажа генеруються **однією картинкою** — так персонаж однаковий у всіх кадрах і в однакових пропорціях. Скрипт вирізає кожен кадр за його контуром, розкладає по рядах за лінією ніг, вирівнює по ногах і центру тулуба й пакує в сітку однакових клітинок:

```
COLS=3 python scripts/pack-frames.py <аркуш> <атлас.png> <атлас.json> <прев'ю.png> "0-2:xy,3-5:xy75"
```

Які кадри — які рухи, скільки триває кожен і який скіл грає який рух — `HERO_SHEETS` у `src/data/heroAnim.ts` (по класу). Якщо фігури сусідніх рядів торкаються (посох, лук), додай `GRID=3x6`: аркуш ріжеться по найпорожніших лініях біля сітки, а відрізані кінчики повертаються своїй фігурі.

**Чого навчились:**
- кожен рух — **3 кадри** (початок, середина, кінець): генератор їх тримає однаковими, а більше кадрів дає «тупцювання» й повтори;
- ходьба — **3 кадри** (крок, ноги разом, інший крок), грається туди й назад; **у кадрах 1 і 3 спереду мають бути різні ноги** — перевір перед тим, як брати;
- **дихання й відкидання — кодом** (одна картинка), плавніше за перемикання майже однакових кадрів;
- генеруй усе **в одному чаті** з `hero-reference.png` і попереднім аркушем як зразком пропорцій.

Промпт аркуша (3 × 6, вертикальна картинка; прикріпити `hero-reference.png`):

```
Using exactly this character and style, with the SAME PROPORTIONS AND SCALE as the attached
walk sheet (same height, same leg length and thickness, same boots, cloak, shield and sword size),
draw one animation sprite sheet: a grid of 3 columns × 6 rows, 18 frames, PORTRAIT image.

Rules for every frame: facing right, three-quarter view, the same size and scale, one figure per
cell, centred, figures never touch or overlap, feet on the same ground line within each row,
identical design, colours and outlines. The sword is always in the right hand, the shield on the
left arm. No motion blur, no speed lines, no effects, no text, no grid lines,
fully transparent background.

Row 1 — STANDING: 1) relaxed ready stance, feet a little apart, sword held low pointing
down-forward; 2) the same, chest slightly raised (breathing in); 3) the same, shoulders slightly lower.
Row 2 — WALK (3 frames): 1) one leg far forward, heel down, the other far behind;
2) passing — legs close together, the back foot slightly lifted; 3) the OTHER leg far forward,
the first leg far behind (the mirror of frame 1 — clearly the other leg in front).
Row 3 — VERTICAL SLASH: 1) start — the sword raised high above the head, body leaning slightly
back; 2) middle — the sword coming down at shoulder height in front; 3) end — the sword low in
front near the ground, body leaning forward.
Row 4 — HORIZONTAL SLASH: 1) start — the sword pulled back behind the body at waist height;
2) middle — the sword straight out in front, horizontal, arm extended; 3) end — follow-through,
the sword swung across to the far side, arm across the chest.
Row 5 — SWORD LUNGE FORWARD: 1) start — knees bent, the sword pulled back at the hip, point
forward; 2) middle — lunging forward, front leg stepping out; 3) end — full lunge, front knee
bent deep, the sword thrust straight forward at full reach.
Row 6 — SHIELD DASH FORWARD: 1) start — crouched low behind the raised shield;
2) middle — charging forward behind the shield, body leaning far forward, back leg pushing off;
3) end — the shield thrust forward at full reach as at an impact, sword held back.
```

Для інших персонажів — той самий шаблон рядів зі своїми рухами (для ворогів — їхні атаки).

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
