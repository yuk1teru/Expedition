// Wiki: the procedural sounds (ROADMAP 13.5) — what plays when, and the recipe of each.

import { SOUNDS } from '../data/sounds';
import { THEMES } from '../data/music';
import { type Section, esc, t, table, v } from './html';

const WAVE_NAMES: Record<string, string> = { sine: 'синус', square: 'квадрат', triangle: 'трикутник', sawtooth: 'пила', noise: 'шум' };

export function soundsSection(): Section {
  const rows = Object.entries(SOUNDS).map(([id, s]) => [
    t(s.name, ['SOUNDS', id, 'name']),
    t(s.when, ['SOUNDS', id, 'when']),
    `${esc(WAVE_NAMES[s.wave] ?? s.wave)}, ${v(s.freq, ['SOUNDS', id, 'freq'])}${s.freqEnd !== undefined ? `→${v(s.freqEnd, ['SOUNDS', id, 'freqEnd'])}` : ''} Гц${s.notes ? `, ${s.notes.length} ноти` : ''}`,
    v(s.dur, ['SOUNDS', id, 'dur'], 's'),
  ]);
  return {
    id: 'sounds',
    title: 'Звуки',
    html: `<p>Усі звуки гри синтезуються в браузері (WebAudio) з коротких рецептів — без аудіофайлів. Гучність — у налаштуваннях (Esc → Налаштування). Браузер вмикає звук лише після першого натискання клавіші чи кліку.</p>
${table(['Звук', 'Коли', 'Рецепт', 'Тривалість'], rows)}
<h3>Музика</h3>
<p>Музика теж процедурна: кожна тема — рецепт (темп, лад, акорди, тембри), а програвач грає її як довгі акорди, бас і мінливе арпеджіо — щоразу трохи інакше. Тема залежить від екрана й бою: місто, карта, свій край у бою, бос, облога, вежа, смуток над надгробком. Гучність музики — окремо в налаштуваннях.</p>
${table(['Тема', 'Темп', 'Акорди (ступені)'], Object.entries(THEMES).map(([id, th]) => [t(th.name, ['THEMES', id, 'name']), v(th.bpm, ['THEMES', id, 'bpm']), esc(th.chords.map((c) => c + 1).join(' – '))]))}`,
  };
}
