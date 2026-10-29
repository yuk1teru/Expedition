// Prompts for generating the sprites and textures (ROADMAP 19.2), made from the game data:
// the style, the sizes and the angle, the palettes of the lands, and one prompt per sprite id.
//
//   npm run art-prompts   — writes docs/ART_PROMPTS.md

import { writeFileSync } from 'node:fs';
import { ARENAS } from '../src/data/arenas';
import { BIOMES } from '../src/data/biomes';
import { BOSSES } from '../src/data/bosses';
import { CLASSES } from '../src/data/classes';
import { ENEMIES } from '../src/data/enemies';
import { ITEM_KINDS, ITEM_SLOTS } from '../src/data/items';
import { fillNames } from '../src/data/names';
import { PROMOTIONS } from '../src/data/promotions';
import { SPRITE_KINDS, type SpriteKind, spritePath } from '../src/data/sprites';

const STYLE =
  'top-down view (straight from above), hand-painted 2D game sprite, clean readable silhouette, soft shading, slight outline, transparent background, no text, no shadow on the ground';

const lines: string[] = [];
const out = (s = ''): void => void lines.push(s);

out('# Промпти для арту');
out('');
out('_Згенеровано з даних гри: `npm run art-prompts` (scripts/artPrompts.ts). Не правити руками — правити дані й перегенерувати._');
out('');
out('## Стиль');
out('');
out(`- Спільний хвіст кожного промпту: \`${STYLE}\`.`);
out('- Вид строго згори; те, що повертається в бою (герой, вороги, боси), — «обличчям праворуч».');
out('- PNG з прозорим фоном; файл кладеться в `public/sprites/<вид>/<id>.png` і записується в `public/sprites/index.json`.');
out('');
out('| Вид | Розмір | Повертається |');
out('|---|---|---|');
for (const [kind, k] of Object.entries(SPRITE_KINDS)) out(`| ${k.name} (\`${kind}\`) | ${k.size}×${k.size} | ${k.rotate ? 'так' : 'ні'} |`);
out('');
out('## Палітри країв');
out('');
for (const [id, b] of Object.entries(BIOMES)) out(`- **${b.name}** (\`${id}\`): земля ${b.palette.ground} / ${b.palette.groundDark}, акцент ${b.palette.accent}, декор ${b.palette.decor.join(', ')}.`);
out('');

const section = (kind: SpriteKind, title: string, describe: (id: string) => string): void => {
  const k = SPRITE_KINDS[kind];
  out(`## ${title}`);
  out('');
  for (const id of k.ids()) out(`- \`${spritePath(kind, id)}\` (${k.size}×${k.size}) — ${describe(id)}, ${STYLE}`);
  out('');
};

const landOf = (enemyId: string): string => {
  const b = Object.values(BIOMES).find((x) => x.enemies.includes(enemyId));
  return b ? `${b.name}, colours of ${b.palette.accent} and ${b.palette.ground}` : 'the dead of the rift, pale bone and violet';
};

section('hero', 'Герой', (id) => {
  const c = CLASSES[id];
  if (c) return `fantasy hero, class «${c.name}», ${id === 'warrior' ? 'pauldrons and a sword' : id === 'mage' ? 'wide hat and a staff with a glowing orb' : 'hood and a bow'}`;
  const p = PROMOTIONS[id];
  if (p) return `fantasy hero, branch «${p.name}» of «${CLASSES[p.classId]?.name ?? p.classId}»: ${p.description}, outline colour ${p.color}`;
  return 'a novice adventurer in plain clothes';
});
section('enemy', 'Вороги', (id) => {
  const e = ENEMIES[id]!;
  return `monster «${e.name}» (${e.archetype}), ${e.trait}, land: ${landOf(id)}`;
});
section('boss', 'Боси й мінібоси', (id) => {
  const b = BOSSES[id]!;
  return `${b.miniboss ? 'miniboss' : 'boss'} «${fillNames(b.name)}», land ${BIOMES[b.biome]?.name ?? b.biome}, big and imposing, attacks: ${b.attacks.map((a) => a.id).join(', ')}`;
});
section('item', 'Речі (іконки)', (id) => {
  const slot = ITEM_SLOTS.find((s) => ITEM_KINDS[s.id].some((k) => k.id === id));
  const name = slot ? ITEM_KINDS[slot.id].find((k) => k.id === id)!.name : id;
  return `inventory icon of «${name}» (${slot?.name ?? ''}), seen slightly from above, neutral grey-steel base colour (rarity is tinted in game)`;
});
section('obstacle', 'Перешкоди арен', (id) => {
  const where = [...new Set(Object.values(ARENAS).filter((a) => a.obstacles.some((o) => o.kind === id)).map((a) => a.id))].slice(0, 4).join(', ');
  return `arena obstacle «${id}» (a tree, rock, stump, pillar, dead tree, cactus, giant rib or ice block — as the id says), seen from above, used in: ${where}`;
});
section('prop', 'Предмети міст', (id) => `town prop «${id}» seen from above, standing on its base point (bottom centre)`);

out('## Текстури');
out('');
for (const [id, b] of Object.entries(BIOMES)) out(`- Земля арени «${b.name}» (\`textures/ground-${id}.png\`, 512×512, тайлиться): ground texture of ${b.name}, colours ${b.palette.ground} and ${b.palette.groundDark}, seamless, ${STYLE}`);
out('');

writeFileSync('docs/ART_PROMPTS.md', lines.join('\n'));
console.log(`docs/ART_PROMPTS.md: ${lines.length} рядків`);
