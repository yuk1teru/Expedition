// Wiki: the talent trees (ROADMAP 12.10) — every class tree row by row with prices, the
// branch, how much of the tree a hero can afford, and a rough "value per point" of each
// skill rank (damage per second of cooldown, in shares of the hero's attack).

import { PROGRESSION, RANKS } from '../data/balance';
import { CLASS_ORDER, CLASSES } from '../data/classes';
import { ELEMENTS } from '../data/elements';
import { classPromotions } from '../data/promotions';
import { describePassive, getPassive, getSkill, skillParams } from '../data/skills';
import { TALENTS, TALENT_TREES, TEACHERS } from '../data/talents';
import { pointsUpTo, treeCost } from '../systems/talents';
import { type Section, esc, link, table, v } from './html';

/**
 * Rough damage per second of a skill at a rank, in shares of the hero's attack: damage ×
 * hits / cooldown. Hits: count, pulses, jumps or duration / tick — whatever the skill has.
 */
export function skillDps(id: string, rank: number): number {
  const p = skillParams(id, rank);
  const dmg = p.damage ?? 0;
  if (!dmg || !p.cooldown) return 0;
  const hits = p.count ?? p.pulses ?? p.jumps ?? (p.duration && p.tick ? p.duration / p.tick : 1);
  return (dmg * hits) / p.cooldown;
}

function skillRow(id: string): string[] {
  const s = getSkill(id);
  const dps = Array.from({ length: RANKS.max }, (_, i) => skillDps(id, i + 1));
  const perPoint = dps.slice(1).map((d, i) => (d - dps[i]!) / (TALENTS.rankCost[i + 1] ?? 1));
  const fork = s.forks?.map((f) => `ранг ${f.rank}: ${f.options.map((o) => `«${esc(o.name)}»${o.element ? ` (${esc(ELEMENTS[o.element].name)})` : ''}`).join(' / ')}`).join('; ');
  return [
    link('skill', id, s.name),
    dps[0] ? dps.map((d) => d.toFixed(2)).join(' → ') : '<span class="dim">не шкода</span>',
    dps[0] ? perPoint.map((d) => d.toFixed(2)).join(' · ') : '—',
    fork ? `<span class="small">${fork}</span>` : '—',
  ];
}

export function talentsSection(): Section {
  const total = pointsUpTo(PROGRESSION.maxLevel);
  const classes = CLASS_ORDER.filter((c) => TALENT_TREES[c])
    .map((c) => {
      const rows = TALENT_TREES[c]!.map((r, i) => {
        const skills = r.skills.map(skillRow);
        const passives = r.passives.map((id) => [esc(getPassive(id).name), esc(describePassive(id)), `до ×${getPassive(id).maxStacks}`, '—']);
        const arrows = (r.arrows ?? []).map((e) => [`Стріли: ${esc(ELEMENTS[e].name)}`, '—', `${TALENTS.arrowCost} очк.`, '—']);
        return `<h4>Ряд ${i + 1}${i ? ` — від ${TALENTS.rowUnlock[i]} очок у дереві` : ' — одразу'}</h4>${table(['Вузол', 'Шкода/с за рангами (× атака)', 'Цінність за очко', 'Розвилки'], [...skills, ...passives, ...arrows], 'wide')}`;
      }).join('');
      const branches = classPromotions(c)
        .map((p) => `${esc(p.name)}: ${link('skill', p.signature, getSkill(p.signature).name)} (рівень ${PROGRESSION.promotionLevel}), ${link('skill', p.signature2, getSkill(p.signature2).name)} (рівень ${PROGRESSION.promotion2Level}, ${esc(p.bonus2.text)}; посилення на вибір: ${p.forks22.map((f) => `<b>${esc(f.name)}</b> — ${esc(f.text)}`).join(' або ')}); пасивки — ${p.passives.map((id) => esc(getPassive(id).name)).join(', ')}`)
        .join('<br>');
      return `<h3 class="group">${esc(CLASSES[c]!.name)} <small class="dim">(усе дерево — ${treeCost(c)} очок)</small></h3>${rows}<p class="small"><b>Гілки:</b><br>${branches}</p>`;
    })
    .join('');
  return {
    id: 'talents',
    title: 'Дерева талантів',
    html: `<p>Очки таланту: ${v(TALENTS.pointsFrom, ['TALENTS', 'pointsFrom'])}-й рівень і далі — по 1 очку, кожен ${v(TALENTS.bonusEvery, ['TALENTS', 'bonusEvery'])}-й — ще 1 (усього ${total} до ${PROGRESSION.maxLevel} рівня), плюс квести. Ціни рангів: ${TALENTS.rankCost.map((x, i) => v(x, ['TALENTS', 'rankCost', i])).join(' / ')}; стак пасивки — ${v(TALENTS.passiveCost, ['TALENTS', 'passiveCost'])}, тип стріл — ${v(TALENTS.arrowCost, ['TALENTS', 'arrowCost'])}. Ряди відкриваються після ${v(TALENTS.rowUnlock[1]!, ['TALENTS', 'rowUnlock', 1])} і ${v(TALENTS.rowUnlock[2]!, ['TALENTS', 'rowUnlock', 2])} вкладених очок. На панелі — ${v(TALENTS.classSlots, ['TALENTS', 'classSlots'])} скілів класу й 2 скіли гілки.</p>
<p>Вчитель класу скидає дерево за ${v(TEACHERS.resetBase, ['TEACHERS', 'resetBase'])} + ${v(TEACHERS.resetPerLevel, ['TEACHERS', 'resetPerLevel'])} × рівень золота.</p>
<p class="dim small">«Цінність за очко» — наскільки зростає шкода за секунду (у частках атаки героя) від наступного рангу, поділена на його ціну. Це груба оцінка: контроль, захист і особливі ранги в ній не враховано.</p>
${classes}`,
  };
}
