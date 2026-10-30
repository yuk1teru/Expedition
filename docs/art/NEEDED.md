# Арт, якого бракує: Ліс

_30.10.2026 · Що в режимі «Реворк: Ліс» ще малюється кодом. Розкладено за локаціями: спершу те, що найпомітніше в грі. Стиль і як ріжуться аркуші — [README.md](README.md)._

## Як генерувати

- Один персонаж — **один чат**. Прикріпи `hero-reference.png` і напиши «same style as the reference».
- **Аркуш = одна картинка**, сітка кадрів. Так персонаж однаковий у всіх кадрах. Фігури **не торкаються** одна одної, між рядами вільне місце. Ноги кожного рядка стоять на одній лінії.
- Прозорий фон, без тіні на землі, без тексту й номерів.
- Готовий аркуш поклади в чат: я поріжу його (`scripts/pack-frames.py` / `scripts/cut-props.py`) і поставлю в гру.

Спільний початок кожного промпта (далі — **[СТИЛЬ]**):

```
2D game sprite sheet for a top-down action roguelite, three-quarter view (camera tilted
about 45 degrees), facing right. Same style as the attached reference: bold even dark
outlines, large simple shapes, flat colours with one shadow tone, very light painted
texture, dark muted Slavic folk-fantasy mood. Readable at 100 px. Enemies use cold dark
colours of their biome. Fully transparent background, no ground shadow, no text, no numbers.
Each pose is a separate figure in its own cell of an even grid; figures never touch,
generous empty space between rows, feet of every figure in a row on one line.
```

Що вже є: герої (Воїн, Маг, Лучник), вовк, гриб-плювака, пеньок, Ватажок зграї, дух занепаду, земля й предмети Лісу (дерева, кущі, камені, Старий дуб, Кам'яне коло, сосна, лігво, святилище, вівтар, скриня, трава).

---

## Локація 1 — «Ліс»

### Лісоруб (завдання «Порятунок»), аркуш 3 × 2
Зараз — фігура кодом. Стоїть, кличе героя, потім іде за ним.

```
[СТИЛЬ]
Character: a frightened village woodcutter, middle-aged, bearded, simple linen shirt,
dark vest, wrapped boots, an axe on his shoulder. Warm muted colours (he is a friend,
not an enemy) but less bright than the hero.
Grid 3 columns x 2 rows:
row 1 — standing scared and looking around; waving one arm high to call for help;
        holding the axe ready, crouched;
row 2 — walking, three frames of a walk cycle (left foot forward, feet together,
        right foot forward), the axe on the shoulder.
```

### Дрібниці (необов'язково), аркуш предметів
Кристал досвіду, монета, вогняна куля, стріла, сокира, спора. Зараз усе це кодом, і воно читається, тож це останнє в черзі.

```
[СТИЛЬ]
A sheet of small separate game items, each alone with space around it:
a small glowing green experience crystal; a gold coin with a simple rune;
a fireball (round, bright orange core, short flame tail); a wooden arrow;
a throwing axe; a pink-red glowing spore ball with a few sparks.
```

---

## Локація 2 — «Глибина лісу»

### Павук, аркуш 3 × 3
Біжить до героя; зупиняється й плюється павутиною в те місце, де стоїть герой.

```
[СТИЛЬ]
Enemy: a forest spider the size of a dog, round dark purple-grey body, eight long bent
legs, a small head with a cluster of red glowing eyes, a few pale hairs. Cold dark colours.
Grid 3 columns x 3 rows:
row 1 — running, three frames of a leg cycle;
row 2 — stopping and rearing up with front legs raised; spitting a white web blob forward
        (the blob is part of the figure); landing back down;
row 3 — hit (recoiling); collapsing on its back with legs curling; dead, legs curled up.
```

### Прядуха (бос), аркуш 3 × 4
Велетенська павучиха: бігає збоку від героя, плює кокон, стягує нитки, після стягування відкрита, кличе павучат.

```
[СТИЛЬ]
Boss: a giant spinner spider, three times the size of a normal spider, long thin legs,
a heavy dark body with a pale bone-coloured spindle mark on the back, a crown of red eyes,
silk threads trailing from her. Cold dark colours, the eyes and the back mark are the
brightest spots.
Grid 3 columns x 4 rows:
row 1 — skittering sideways, three frames of a leg cycle;
row 2 — rearing up before a spit; spitting a big white cocoon blob forward;
        pulling threads towards herself with front legs (threads drawn as a few short lines);
row 3 — exhausted, sagging low with legs spread (open to attack); raising her abdomen to
        release small spiders; hit (recoiling);
row 4 — dying: legs buckling; fallen on her back; dead, legs curled up.
```

### Павутиння й кокони, аркуш предметів
Кокони — ціль завдання «Знищте павутиння». Павутина на землі — пляма від павука. Павутина на дереві — для густого лісу.

```
[СТИЛЬ]
A sheet of separate web objects, each alone with space around it:
a tall pale egg cocoon wrapped in silk and hanging threads, standing on the ground (intact);
the same cocoon cracked with something moving inside; the same cocoon torn open and empty;
a flat round spider web lying on the ground, seen from above at an angle (a sticky patch);
two different cobwebs stretched between branches (to hang in a tree crown);
a small white web blob in flight; a big white cocoon blob in flight.
```

---

## Лігво — Старий Енат (бос біому)

### Старий Енат, аркуш 3 × 4
Найстаріше дерево, коріння якого з'єднує весь Ліс. **Стоїть на місці.** Фази: 1 — живе дерево; 2 (60%) — кора кам'яніє; 3 (25%) — кора тріскає, з тріщин тече бурштиновий сік.

```
[СТИЛЬ]
Boss: the Old Enat — an ancient giant oak spirit, a huge gnarled trunk with a stern old
face in the bark (deep eye hollows with a faint green glow), thick roots like legs, two long
branch arms, a heavy crown of dark leaves with moss and hanging lichen. He stands in place,
he does not walk. Dark greens and browns, the eyes glow faint green.
Grid 3 columns x 4 rows:
row 1 — standing, slow breathing (three frames: crown rising and falling);
row 2 — raising both branch arms high to slam; slamming the arms into the ground;
        stretching one long branch arm far forward to grab;
row 3 — phase 2, the same pose petrified: bark turned to grey stone, leaves grey,
        eyes glowing; casting thorns (arms spread, stone spikes on the bark);
        phase 3: bark cracked open with glowing amber sap, crown thinning;
row 4 — staggered and weak (the big window); collapsing; fallen, at peace, a few fresh
        green leaves on him.
```

### Примара Ената, одна картинка
До бою: прозорий дух дерева просить «Звільни мене від звіра».

```
[СТИЛЬ]
The ghost of the same Old Enat: translucent pale green-white spirit of the ancient oak,
the face in the bark calm and sorrowful, edges dissolving into mist, no hard shadows.
One figure, transparent background.
```

### Коріння й колючки, аркуш ефектів
Атаки Ената: коріння виривається під героєм, колючки йдуть лініями через арену, шип б'є під героєм.

```
[СТИЛЬ]
A sheet of separate effect objects, each alone with space around it:
roots bursting out of the ground, three frames (cracks in the earth; roots breaking out;
roots fully up, curled);
a stone thorn spike bursting from the ground, three frames (crack; half out; full tall spike);
a row of three small thorns in a line (a thorn wave);
a grabbing branch hand (long twisted branch with claw-like twigs);
two petrified boulders with moss (obstacles that appear in the arena).
```

### Земля лігва, безшовна текстура

```
Seamless tileable ground texture for a top-down game, same painted style as the
attached forest ground: dark forest floor of an ancient grove, thick old roots crossing the
earth, moss, dead leaves, a few pale stones, faint amber glints of sap. Darker and older
than the forest ground. No objects that stand up, no shadows, tileable on all sides.
```
