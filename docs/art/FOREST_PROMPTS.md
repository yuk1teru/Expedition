# Промпти: Лісовий біом

_31.10.2026 · Усе, що потрібно Лісу (Ліс → Глибина лісу → Лігво Ената), з нуля. Кожен промпт самодостатній — стиль усередині, копіюй цілком. Стиль і нарізка — [README.md](README.md)._

**Позначки:** ✓ є в грі (генерувати заново лише якщо хочемо перемалювати) · ✗ потрібно · ○ за бажанням.

## Як генерувати

1. **Один персонаж — один чат.** Спершу фігура цілком, потім у тому самому чаті — аркуш поз.
2. **Прикріплюй еталон** `heroes/warrior/reference.png` до кожного першого промпта в чаті.
3. **Аркуш — одна картинка:** сітка, фігури не торкаються, між рядами порожньо, ноги в рядку на одній лінії. Так персонаж однаковий у всіх кадрах.
4. **Ходьба й біг — кадр за кадром:** яка нога попереду, яка позаду, яка піднята. Інакше генератор малює однакові кадри. Але **крок звичайний**, не шпагат (ноги не ширше плечей), і **обидві ноги однакові** — колір, обмотки, довжина не міняються від кадру до кадру, лише положення. Якщо кадри однакові — промпт «Виправити ходьбу» в кінці.
5. **Куди класти:** `heroes/<клас>/`, `mobs/<звір>/`, `bosses/<бос>/`, `npc/<хто>/`, `locations/<локація>/` — `reference.png` (фігура) і `poses.png` (аркуш). Скинь у чат — я поріжу й поставлю в гру.

| Що | Позначка | Розділ |
|---|---|---|
| Воїн, Маг, Лучник | ✓ | 1 |
| Вовк, Гриб, Пеньок, Дух занепаду | ✓ | 2 |
| Ватажок зграї | ✓ | 2 |
| Лісоруб | ✗ | 2 |
| Земля й предмети Лісу | ✓ | 2 |
| Павук, Прядуха, павутиння й кокони | ✗ | 3 |
| Земля Глибини лісу | ○ | 3 |
| Старий Енат, його примара, коріння й колючки | ✗ | 4 |
| Земля й предмети лігва | ✗ | 4 |
| Сцена точки Лісу на карті | ✗ | 5 |
| Кристал, монета, снаряди, іконки скілів | ○ | 6 |

---

## 1. Герої ✓

### Воїн — фігура ✓ → `heroes/warrior/reference.png`

```
2D game character sprite for a top-down action roguelite, three-quarter view (camera tilted
about 45 degrees), facing right, full body, idle standing pose.
Style: clean bold illustration with thick, even dark outlines (like Don't Starve or Darkest
Dungeon simplified), large simple shapes, flat colours with one soft shadow tone, a very light
painted texture on large areas, no fine details. Readable at 100 pixels tall. Dark, somber,
muted Slavic folk-fantasy mood.
Character: a foreign warrior from across the sea, sole survivor of a shipwreck. Hooded cloak,
simple tunic over a plain mail shirt (one solid grey shape, no ring pattern), a wide belt,
wrapped boots, a round shield and a short one-handed sword. A large glowing rune-like sign on
the chest, pale gold — the brightest spot on him.
Colours: warm so he stands out on green forest ground — dark wine-red cloak, muted ochre tunic,
dark brown leather, dark steel, pale gold glow. Slightly larger head and hands than realistic.
Strong clear silhouette. Fully transparent background, no ground shadow, no text.
```

### Воїн — аркуш поз ✓ → `heroes/warrior/poses.png`

```
Using exactly this character and style, draw one animation sprite sheet: a grid of 3 columns
x 6 rows, 18 frames, PORTRAIT image. Every frame: facing right, three-quarter view, the same
size and scale, one figure per cell, centred, figures never touch, feet on the same ground line
within each row, identical design, colours and outlines. Sword in the right hand, shield on the
left arm. No motion blur, no speed lines, no effects, no text, no grid lines, transparent background.
Row 1 — STANDING: 1) ready stance, feet a little apart, sword low pointing down-forward;
2) the same, chest slightly raised (breathing in); 3) the same, shoulders slightly lower.
Row 2 — WALK, 3 frames of a calm natural walk (not a run, not a lunge). The stride is
moderate: the feet at most about one shoulder-width apart, never a split or a wide V.
Both legs and both boots look exactly the same in every frame — the same colours, wraps,
length and thickness; only their position changes. (The far leg may be a touch darker as a
natural shadow — the same in every frame.)
1) CONTACT, left leg in front: the front leg almost straight, heel on the ground, toes up;
   the back leg slightly bent, only its toes on the ground; the opposite arm swings a little forward.
2) PASSING: one leg straight under the body carrying the weight; the other bent at the knee
   and passing it, its foot lifted just above the ground; the head a little higher than in 1 and 3.
3) CONTACT, right leg in front: the mirror of frame 1.
The three frames must be clearly different even at 100 px, but stay a normal walk.
Row 3 — VERTICAL SLASH: 1) sword raised high above the head, leaning back; 2) sword coming down
at shoulder height in front; 3) sword low in front near the ground, leaning forward.
Row 4 — HORIZONTAL SLASH: 1) sword pulled back behind the body at waist height; 2) sword
straight out in front, arm extended; 3) follow-through, sword swung across to the far side.
Row 5 — SWORD LUNGE: 1) knees bent, sword pulled back at the hip; 2) lunging forward, front leg
stepping out; 3) full lunge, front knee bent deep, sword thrust forward at full reach.
Row 6 — SHIELD DASH: 1) crouched low behind the raised shield; 2) charging forward behind the
shield, leaning far forward; 3) shield thrust forward as at an impact, sword held back.
```

### Маг — фігура ✓ → `heroes/mage/reference.png`

```
[Прикріпи heroes/warrior/reference.png]
Same style, outlines, proportions and mood as the attached warrior — the same world, a
different class. 2D game character sprite, three-quarter view, facing right, full body, idle
standing pose, feet together.
Character: a foreign mage, survivor of the same shipwreck. Long hooded robe, a wide sash, a
short shoulder cape, wrapped boots, a tall wooden staff with a glowing crystal on top held in
the right hand. The same glowing pale gold sign on the chest — the brightest spot.
Colours: warm — deep wine-red robe with muted gold trim, dark brown leather, pale gold glow;
the staff crystal a warm amber. Fully transparent background, no ground shadow, no text.
```

### Маг — аркуш поз ✓ → `heroes/mage/poses.png`

```
Using exactly this mage and style, draw one sprite sheet: a grid of 3 columns x 6 rows, PORTRAIT
image. Every frame facing right, the same size and scale, one figure per cell, figures never touch
(keep the staff inside its cell), feet on one line in each row, transparent background, no effects,
no text. Staff always in the right hand.
Row 1 — STANDING: 1) staff upright, feet together; 2) breathing in; 3) breathing out.
Row 2 — WALK, 3 frames of a calm natural walk (not a run, not a lunge). The stride is
moderate: the feet at most about one shoulder-width apart, never a split or a wide V.
Both legs and both boots look exactly the same in every frame — the same colours, wraps,
length and thickness; only their position changes. (The far leg may be a touch darker as a
natural shadow — the same in every frame.)
1) CONTACT, left leg in front: the front leg almost straight, heel on the ground, toes up;
   the back leg slightly bent, only its toes on the ground; the opposite arm swings a little forward.
2) PASSING: one leg straight under the body carrying the weight; the other bent at the knee
   and passing it, its foot lifted just above the ground; the head a little higher than in 1 and 3.
3) CONTACT, right leg in front: the mirror of frame 1.
The three frames must be clearly different even at 100 px, but stay a normal walk.
The robe hem swings with the legs; the boots peek out under it, the same in every frame.
Row 3 — CAST FORWARD: 1) staff pulled back; 2) staff thrust forward, free hand open forward;
3) follow-through, leaning forward.
Row 4 — CAST OVERHEAD: 1) staff raised in both hands; 2) staff high above the head, crystal up;
3) staff brought down pointing forward.
Row 5 — CHANNEL: 1) staff planted, free hand raised; 2) both arms spread wide; 3) staff raised,
head tilted back.
Row 6 — BLINK: 1) crouching, robe gathered; 2) leaping forward, body stretched; 3) landing, cape flaring.
```

### Лучник — фігура ✓ → `heroes/archer/reference.png`

```
[Прикріпи heroes/warrior/reference.png]
Same style, outlines, proportions and mood as the attached warrior — the same world, a
different class. 2D game character sprite, three-quarter view, facing right, full body, idle pose.
Character: a foreign archer, survivor of the same shipwreck. Short hooded cloak, a padded
jerkin, bracers, wrapped boots, a quiver on the back, a longbow in the left hand. The same
glowing pale gold sign on the chest — the brightest spot.
Colours: warm — dark wine-red hood and cloak, muted ochre jerkin, dark brown leather, pale gold
glow. Fully transparent background, no ground shadow, no text.
```

### Лучник — аркуш поз ✓ → `heroes/archer/poses.png`

```
Using exactly this archer and style, draw one sprite sheet: a grid of 3 columns x 6 rows, PORTRAIT
image. Every frame facing right, the same size and scale, one figure per cell, figures never
touch (keep bow and arrows inside the cell), feet on one line in each row, transparent
background, no effects, no text. Bow in the left hand.
Row 1 — STANDING: 1) bow lowered; 2) breathing in; 3) breathing out.
Row 2 — WALK, 3 frames of a calm natural walk (not a run, not a lunge). The stride is
moderate: the feet at most about one shoulder-width apart, never a split or a wide V.
Both legs and both boots look exactly the same in every frame — the same colours, wraps,
length and thickness; only their position changes. (The far leg may be a touch darker as a
natural shadow — the same in every frame.)
1) CONTACT, left leg in front: the front leg almost straight, heel on the ground, toes up;
   the back leg slightly bent, only its toes on the ground; the opposite arm swings a little forward.
2) PASSING: one leg straight under the body carrying the weight; the other bent at the knee
   and passing it, its foot lifted just above the ground; the head a little higher than in 1 and 3.
3) CONTACT, right leg in front: the mirror of frame 1.
The three frames must be clearly different even at 100 px, but stay a normal walk.
Row 3 — SHOOT FORWARD: 1) arrow nocked, bow raised; 2) full draw, aiming straight ahead;
3) release, bowstring hand flung back.
Row 4 — SHOOT UP: 1) nocking, looking up; 2) full draw aiming high into the sky; 3) release upward.
Row 5 — FAN SHOT: 1) three arrows nocked at once; 2) full draw, bow tilted; 3) release, bow swept sideways.
Row 6 — VAULT BACK: 1) crouched to jump; 2) leaping backwards, body arched; 3) landing on one knee.
```

---

## 2. Локація 1 — «Ліс»

Вороги — холодні темні кольори Лісу (сірі, мохово-зелені, темно-брунатні), щоб теплого героя було видно в натовпі.

### Вовк ✓ → `mobs/wolf/poses.png`

```
[Прикріпи heroes/warrior/reference.png]
2D game sprite sheet, same style as the reference: bold even dark outlines, large simple
shapes, flat colours with one shadow tone, very light painted texture, dark muted Slavic
folk-fantasy mood, readable at 100 px. Three-quarter view, facing right. Transparent
background, no ground shadow, no text. A grid of 3 columns x 3 rows; one figure per cell,
figures never touch, feet of a row on one line.
Enemy: a lean grey forest wolf, ragged fur, yellow eyes, cold grey and dark brown colours.
Row 1 — RUN, a light trot-gallop, three clearly different frames: 1) front legs reaching
forward, back legs pushing behind; 2) all four legs gathered under the body; 3) front legs
pushing back, back legs reaching forward. Moderate reach — the legs never stretched flat like a
split. All four legs the same colour and fur in every frame; only their position changes.
Row 2 — LEAP: crouched low before a jump; in the air, body stretched; landing with a bite, jaws open.
Row 3 — hit, recoiling; falling on its side; dead, lying still.
```

### Гриб-плювака ✓ → `mobs/mushroom/poses.png`

```
[Прикріпи heroes/warrior/reference.png]
2D game sprite sheet, same style as the reference (bold dark outlines, simple shapes, flat
colours, one shadow tone, dark muted folk-fantasy mood, readable at 100 px). Three-quarter view,
facing right, transparent background, no text. Grid 3 columns x 3 rows, figures never touch,
feet of a row on one line.
Enemy: a walking toadstool spitter — a red cap with pale spots, a pale fibrous stem body with
short legs, small glowing yellow eyes under the cap.
Row 1 — WALK, a short waddle, three clearly different frames: 1) left foot a small step
forward, body leaning a little right; 2) feet together, body upright and a little higher;
3) right foot a small step forward, leaning a little left. Small steps — the short legs never
spread wide. Both legs the same colour in every frame.
Row 2 — SPIT: the cap swelling and glowing pink; spitting a glowing pink-red spore ball forward
(the ball in the same cell); recoiling back.
Row 3 — hit; collapsing, the cap breaking; a heap of cap pieces.
```

### Пеньок ✓ → `mobs/stump/poses.png`

```
[Прикріпи heroes/warrior/reference.png]
2D game sprite sheet, same style as the reference (bold dark outlines, simple shapes, flat
colours, one shadow tone, dark muted folk-fantasy mood, readable at 100 px). Three-quarter view,
facing right, transparent background, no text. Grid 3 columns x 3 rows, figures never touch,
feet of a row on one line.
Enemy: a living tree stump — a short cut trunk with a flat top and broken twigs, root legs,
two branch arms with twig claws, moss patches, small glowing amber eyes and a dark mouth.
Row 1 — WALK, a heavy shuffle, three clearly different frames: 1) left root leg a short step
forward, the trunk tilted slightly; 2) roots together, the trunk upright; 3) right root leg a
short step forward, tilted the other way. Short steps, roots never spread wide; both root legs
the same wood colour in every frame.
Row 2 — STOMP: arms raised high; slamming the ground (a few earth chips); standing in a crack of the ground.
Row 3 — hit; splitting apart; a heap of splinters and moss.
```

### Дух занепаду ✓ → `mobs/spirit/poses.png`

```
[Прикріпи heroes/warrior/reference.png]
2D game sprite sheet, same style as the reference (bold dark outlines, simple shapes, dark muted
folk-fantasy mood, readable at 100 px). Three-quarter view, facing right, transparent background,
no text. Grid 3 columns x 2 rows, figures never touch.
Enemy: the spirit of decay — a hooded ragged shape of pale sickly green mist and rotten leaves,
no legs, the lower body trailing off into mist, long thin claw hands, two dark eye holes.
Row 1 — FLOATING, three slightly different frames (rags and mist moving).
Row 2 — swelling up, arms raised, gathering fog around itself; releasing a cloud of grey-green
fog around itself; fleeing to the left, looking back.
```

### Ватажок зграї (бос) ✓ → `bosses/alpha/poses.png`

```
[Прикріпи heroes/warrior/reference.png і mobs/wolf/poses.png]
2D game sprite sheet, same style and wolf design as the attached wolf, but the pack leader:
half again as big, heavier, a thick pale mane, old scars, red eyes, darker brown-grey fur.
Three-quarter view, facing right, transparent background, no text. Grid 3 columns x 4 rows,
figures never touch, feet of a row on one line.
Row 1 — RUN, a heavy gallop, three clearly different frames: 1) front legs reaching forward,
back legs pushing behind; 2) all four legs gathered under the body; 3) front legs pushing back,
back legs reaching forward. Moderate reach, never stretched flat; all legs the same fur colour
in every frame.
Row 2 — DASH: crouched low before a dash; lunging forward low and long; skidding to a stop, claws in the earth.
Row 3 — LEAP: crouched before a leap; high in the air; slamming down, front paws hitting the ground.
Row 4 — howling, head raised; winded, tongue out, panting; hit, recoiling.
```

### Лісоруб (завдання «Порятунок») ✗ → `npc/lumberjack/poses.png`

```
[Прикріпи heroes/warrior/reference.png]
2D game sprite sheet, same style as the reference (bold dark outlines, simple shapes, flat
colours, one shadow tone, dark muted folk-fantasy mood, readable at 100 px). Three-quarter view,
facing right, transparent background, no text. Grid 3 columns x 2 rows, figures never touch,
feet of a row on one line.
Character: a frightened village woodcutter, middle-aged, bearded, simple linen shirt, dark vest,
wrapped boots, an axe. Warm muted colours (a friend, not an enemy) but less bright than the hero.
Row 1 — standing scared, looking around; waving one arm high to call for help; crouched with the axe ready.
Row 2 — WALK with the axe on the shoulder, 3 frames of a calm natural walk (not a run, not a lunge). The stride is
moderate: the feet at most about one shoulder-width apart, never a split or a wide V.
Both legs and both boots look exactly the same in every frame — the same colours, wraps,
length and thickness; only their position changes. (The far leg may be a touch darker as a
natural shadow — the same in every frame.)
1) CONTACT, left leg in front: the front leg almost straight, heel on the ground, toes up;
   the back leg slightly bent, only its toes on the ground; the opposite arm swings a little forward.
2) PASSING: one leg straight under the body carrying the weight; the other bent at the knee
   and passing it, its foot lifted just above the ground; the head a little higher than in 1 and 3.
3) CONTACT, right leg in front: the mirror of frame 1.
The three frames must be clearly different even at 100 px, but stay a normal walk.
```

### Земля Лісу ✓ → `locations/forest/ground.png`

```
Seamless tileable ground texture for a top-down 2D game, painted style matching bold-outline
cartoon sprites: dark green forest floor — grass tufts, moss, patches of bare earth, fallen
orange and brown oak leaves, a few small grey stones. Flat colours with one shadow tone, soft
and low contrast so characters stand out on it. Nothing that stands up, no shadows, no paths,
seamless on all four sides. Square image.
```

### Предмети Лісу ✓ → `locations/forest/obstacles.png`

```
[Прикріпи heroes/warrior/reference.png]
A sheet of separate 2D game props for a top-down three-quarter view forest, same style as the
reference (bold dark outlines, simple shapes, flat colours, one shadow tone, dark muted
folk-fantasy mood). Each object alone on a small grass-and-leaves base, wide empty space around
each one, objects never touch. Transparent background, no text.
Objects: three different tall fir trees; two old crooked leafy trees; a dead tree grown around a
stone; a huge ancient oak with roots, moss and mushrooms on the trunk (a landmark, twice as big);
three different bushes (one with red berries, one with autumn leaves); a big mossy boulder, a
medium rock, a small rock; FIVE single standing stones, each standing apart; a fallen mossy pine
log; a wolf den — a mound of earth and branches with a dark hole; a stone shrine with a glowing
blue crystal; a small stone altar with a lit candle; a wooden chest with an iron lock; a healing
herb with small glowing white bell flowers.
```

### Концепт Лісу ✓ → `locations/forest/concept.png`

```
Concept art of one location of a top-down action roguelite, three-quarter view from above:
a dark autumn Slavic folk-fantasy forest clearing — fir trees and crooked oaks, mossy boulders,
a ring of standing stones, a fallen pine, a glowing herb, a small stone shrine. A warm
hooded hero with a glowing gold sign on the chest fights a pack of grey wolves and red-capped
mushroom creatures. Bold outlines, flat colours, muted palette, the hero the warmest spot.
```

---

## 3. Локація 2 — «Глибина лісу»

Той самий набір дерев і каменів, але темніше й з павутинням (робить код). Нове — павуки й Прядуха.

### Павук ✗ → `mobs/spider/poses.png`

```
[Прикріпи heroes/warrior/reference.png]
2D game sprite sheet, same style as the reference (bold dark outlines, simple shapes, flat
colours, one shadow tone, dark muted folk-fantasy mood, readable at 100 px). Three-quarter view,
facing right, transparent background, no text. Grid 3 columns x 3 rows, figures never touch,
feet of a row on one line.
Enemy: a forest spider the size of a dog — round dark purple-grey body, eight long bent legs,
a small head with a cluster of glowing red eyes, a few pale hairs. Cold dark colours.
Row 1 — RUN, three clearly different frames of the leg cycle: 1) the front pairs reaching
forward, the back pairs pushing behind; 2) all eight legs gathered close around the body;
3) the front pairs pushing back, the back pairs reaching forward. Legs stay bent like a real
spider's, never spread flat; all legs the same colour in every frame.
Row 2 — rearing up, front legs raised; spitting a white web blob forward (the blob in the same
cell); landing back down.
Row 3 — hit, recoiling; flipped on its back, legs curling; dead, legs curled up.
```

### Прядуха (бос) ✗ → `bosses/spinner/poses.png`

```
[Прикріпи heroes/warrior/reference.png і mobs/spider/poses.png]
2D game sprite sheet, same style as the attached spider, but the boss: a giant spinner spider
three times bigger — long thin legs, a heavy dark body with a pale bone-coloured spindle mark on
the back, a crown of red eyes, silk threads trailing from her. The eyes and the back mark are the
brightest spots. Three-quarter view, facing right, transparent background, no text.
Grid 3 columns x 4 rows, figures never touch, feet of a row on one line.
Row 1 — SKITTER sideways, three clearly different frames of the leg cycle: 1) the near legs
reaching forward, the far legs back; 2) legs gathered close around the body; 3) the near legs
back, the far legs forward. Legs stay bent, never spread flat; all legs the same colour in every frame.
Row 2 — rearing up before a spit; spitting a big white cocoon blob forward; pulling threads
towards herself with the front legs (a few short thread lines).
Row 3 — exhausted, sagging low with legs spread (open to attack); raising her abdomen to release
small spiders; hit, recoiling.
Row 4 — legs buckling; fallen on her back; dead, legs curled up.
```

### Павутиння й кокони ✗ → `locations/deep-forest/webs.png`

```
[Прикріпи heroes/warrior/reference.png]
A sheet of separate 2D game objects for a top-down three-quarter view, same style as the
reference (bold dark outlines, simple shapes, muted colours). Each object alone with wide empty
space around it, never touching. Transparent background, no text.
Objects: a tall pale egg cocoon wrapped in silk with hanging threads, standing on the ground;
the same cocoon cracked with something moving inside; the same cocoon torn open and empty;
a flat round spider web lying on the ground, seen from above at an angle; two different cobwebs
stretched between branches (to hang in a tree crown); a small white web blob in flight;
a big white cocoon blob in flight.
```

### Земля Глибини лісу ○ → `locations/deep-forest/ground.png`

```
[Прикріпи locations/forest/ground.png]
Seamless tileable ground texture in exactly the same painted style as the attached forest
ground, but deeper in the forest: darker, less grass, more moss, black soil and roots, fewer
leaves, thin strands of old cobweb on the moss. Low contrast, nothing that stands up, no
shadows, seamless on all four sides. Square image.
```

---

## 4. Лігво — «Лігво Ената»

### Старий Енат (бос біому) ✗ → `bosses/enat/poses.png`

```
[Прикріпи heroes/warrior/reference.png і locations/forest/obstacles.png]
2D game sprite sheet, same style as the attached props (bold dark outlines, simple shapes, flat
colours, one shadow tone, dark muted folk-fantasy mood). Three-quarter view, facing right,
transparent background, no text. Grid 3 columns x 4 rows, figures never touch, the base of every
figure on one line in each row.
Boss: the Old Enat — an ancient giant oak spirit: a huge gnarled trunk with a stern old face in
the bark (deep eye hollows with a faint green glow), thick roots like legs, two long branch arms,
a heavy crown of dark leaves with moss and hanging lichen. He stands in place, he never walks.
Row 1 — STANDING, three frames of slow breathing (the crown rising and falling).
Row 2 — both branch arms raised high to slam; arms slammed into the ground; one long branch arm
stretched far forward to grab.
Row 3 — PHASE 2, petrified: bark turned to grey stone, leaves grey, eyes glowing; casting thorns,
arms spread, stone spikes on the bark; PHASE 3: the stone bark cracked open with glowing amber sap.
Row 4 — staggered and weak; collapsing; fallen, at peace, a few fresh green leaves on him.
```

### Примара Ената ✗ → `bosses/enat/ghost.png`

```
[Прикріпи bosses/enat/poses.png]
The ghost of the same Old Enat: a translucent pale green-white spirit of the ancient oak, the
face in the bark calm and sorrowful, the edges dissolving into mist, no hard shadows. One figure,
facing right, transparent background, no text.
```

### Коріння, колючки, брили ✗ → `bosses/enat/fx.png`

```
[Прикріпи heroes/warrior/reference.png]
A sheet of separate 2D game effect objects for a top-down three-quarter view, same style as the
reference (bold dark outlines, simple shapes, muted colours). Each object alone with wide empty
space around it, never touching. Transparent background, no text.
Objects: roots bursting out of the ground, three frames (cracks in the earth; roots breaking out;
roots fully up and curled); a stone thorn spike bursting from the ground, three frames (crack;
half out; a full tall spike); a row of three small stone thorns in a line; a long twisted
grabbing branch with claw-like twigs; two petrified mossy boulders.
```

### Земля лігва ✗ → `locations/lair/ground.png`

```
[Прикріпи locations/forest/ground.png]
Seamless tileable ground texture in the same painted style as the attached forest ground:
the floor of an ancient grove — thick old roots crossing dark earth, moss, dead leaves, a few
pale stones, faint amber glints of sap. Darker and older than the forest ground, low contrast,
nothing that stands up, no shadows, seamless on all four sides. Square image.
```

### Предмети лігва ✗ → `locations/lair/obstacles.png`

```
[Прикріпи locations/forest/obstacles.png]
A sheet of separate 2D game props in exactly the same style as the attached forest props, for
the lair of an ancient oak spirit. Each object alone on a small base of dark moss, wide empty
space around each, never touching. Transparent background, no text.
Objects: three huge old roots arching out of the ground; two hollow dead oak trunks; a ring of
three old cut stumps; two mossy boulders with carved old runes; a pile of bones and antlers
among roots; a dead tree with hanging lichen; a small bush with withered leaves.
```

---

## 5. Сцена точки Лісу ✗ → `locations/forest/scene.png`

Сцена при першому приході в біом (VISION: голос краю, біженці, натяк на твіст). Показується з текстом над картою.

```
A painted scene illustration in the same bold-outline muted folk-fantasy style as the attached
reference, wide 16:9: the edge of a dark autumn forest at dusk. A road leads into the trees; on
the road — village refugees with bundles and a cart, looking back at the forest in fear. Among
the trees — the faint glow of animal eyes. In the sky above the forest, barely visible, a thin
dark crack like a fissure in the air. In the foreground, seen from behind, the warm hooded
hero with a faint gold glow on his chest. No text.
```

---

## 6. За бажанням ○

### Підбирання й снаряди → `fx/items.png`

```
[Прикріпи heroes/warrior/reference.png]
A sheet of small separate game items, same style as the reference, each alone with wide space
around it, never touching. Transparent background, no text.
A small glowing green experience crystal; a gold coin with a simple rune; a fireball (round,
bright orange core, short flame tail); a wooden arrow; a throwing axe; a pink-red glowing spore
ball with a few sparks; a magic missile (small violet glowing bolt).
```

### Іконки скілів і пасивок → `fx/icons.png`

```
A sheet of 18 square game ability icons in a 6 x 3 grid, bold dark outlines, flat muted colours,
simple readable symbols, dark rounded-square background on each icon, no text:
whirlwind; ground slam; throwing axe; battle cry; fireball; frost ring; magic missiles; chain
lightning; multishot; arrow rain; piercing arrow; hunter trap;
amount (three arrows); area (expanding circle); cooldown (hourglass); health (heart);
swiftness (winged boot); magnet (horseshoe magnet).
```

---

## Виправити ходьбу (якщо кадри однакові)

У тому самому чаті:

```
Keep exactly the same character, the same style and every other row.
Redraw ONLY the walk row. The three frames are currently identical; they must be clearly
different poses, readable even when the image is shrunk to 100 px tall — but still a calm
normal walk: the feet at most about one shoulder-width apart, never a split.
Both legs and both boots look exactly the same in every frame — the same colours, wraps, length
and thickness; only their position changes.
frame 1: CONTACT — the left leg in front almost straight, heel on the ground, toes up; the right
leg behind slightly bent, only its toes on the ground; the right arm a little forward.
frame 2: PASSING — the left leg straight under the body carrying the weight; the right leg bent
at the knee passing it, its foot just above the ground; the head a little higher.
frame 3: CONTACT — the mirror of frame 1: right leg in front, left leg behind.
Same height, size and feet baseline in all three frames. Transparent background, no text.
```
