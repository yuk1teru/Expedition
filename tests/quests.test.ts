import { describe, expect, it } from 'vitest';
import { getNpc } from '../src/data/npcs';
import { QUESTS } from '../src/data/quests';
import { createBattle } from '../src/systems/battle';
import { startConversation, chooseOption, currentNode } from '../src/systems/town';
import {
  currentObjective,
  npcMark,
  questPlayable,
  questState,
  questsAfterBattle,
  questsOffered,
  startQuest,
  withQuests,
} from '../src/systems/quests';
import { completeBattle, createGameState, teleport } from '../src/systems/run';
import { fromSave, readSave, toSave, writeSave } from '../src/systems/save';
import type { GameState } from '../src/core/state';

/** Talks to an NPC and picks the option starting with `prefix`; then follows the first option of each node. */
function talk(s: GameState, npcId: string, prefix: string): void {
  const conv = startConversation(withQuests(getNpc(npcId), s));
  const i = currentNode(conv).options.findIndex((o) => o.text.startsWith(prefix));
  expect(i, `${npcId}: ${prefix}`).toBeGreaterThanOrEqual(0);
  let res = chooseOption(conv, i);
  while (!res.ended && !res.action) res = chooseOption(conv, 0);
}

function win(s: GameState, nodeId: string): void {
  teleport(s, nodeId);
  const b = createBattle(s, nodeId);
  b.outcome = 'won';
  completeBattle(s, b);
}

describe('quests', () => {
  it('the prologue chain: take it, clear the road, reach the capital, report to the guard; the next one opens', () => {
    const s = createGameState(1);
    expect(questsOffered(s, 'portFisher').map((q) => q.id)).toContain('mainShore');
    expect(npcMark(s, 'portFisher')).toBe('!');
    talk(s, 'portFisher', '❗');
    expect(questState(s, 'mainShore')?.step).toBe(0);
    win(s, 'coastRoad');
    expect(currentObjective(questState(s, 'mainShore')!)?.kind).toBe('reach');
    teleport(s, 'capital');
    expect(currentObjective(questState(s, 'mainShore')!)?.kind).toBe('talk');
    expect(npcMark(s, 'capitalGuard')).toBe('?');
    const gold = s.gold;
    talk(s, 'capitalGuard', '💬');
    expect(s.quests.done).toContain('mainShore');
    expect(questState(s, 'mainShore')).toBeUndefined();
    expect(s.gold).toBe(gold + QUESTS.mainShore!.reward.gold!);
    expect(questsOffered(s, 'capitalGuard').map((q) => q.id)).toContain('mainAudience');
  });

  it('kill objectives count kills of that enemy in that place only', () => {
    const s = createGameState(1);
    startQuest(s, 'forestWolves');
    const base = { won: true, transit: false, isBoss: false, minibossKills: 0 };
    questsAfterBattle(s, { ...base, nodeId: 'quietGrove', killsById: { wolf: 10 } });
    expect(questState(s, 'forestWolves')!.count).toBe(0);
    questsAfterBattle(s, { ...base, nodeId: 'wolfTrail', killsById: { wolf: 9, mushroom: 5 } });
    expect(questState(s, 'forestWolves')!.count).toBe(9);
    questsAfterBattle(s, { ...base, nodeId: 'wolfTrail', killsById: { wolf: 9 } });
    expect(currentObjective(questState(s, 'forestWolves')!)).toBeUndefined();
    expect(npcMark(s, 'forestHunter')).toBe('?');
    talk(s, 'forestHunter', '✔');
    expect(s.quests.done).toContain('forestWolves');
  });

  it('quests that need special acts are not offered yet (trophies are, since ROADMAP 14.1)', () => {
    const s = createGameState(1);
    for (const q of Object.values(QUESTS)) {
      if (q.objectives.some((o) => o.kind === 'special' && o.target !== 'amulet')) {
        expect(questPlayable(q), q.id).toBe(false);
        expect(questsOffered(s, q.giver).map((x) => x.id)).not.toContain(q.id);
      }
    }
  });

  it('requirements: earlier quests and the level', () => {
    const s = createGameState(1);
    expect(questsOffered(s, 'capitalGuard').map((q) => q.id)).not.toContain('mainAudience');
    const leveled = Object.values(QUESTS).find((q) => q.requires?.level && !q.requires.quests && questPlayable(q));
    if (leveled) {
      expect(questsOffered(s, leveled.giver).map((q) => q.id)).not.toContain(leveled.id);
      s.hero.level = leveled.requires!.level!;
      if (leveled.classId) s.hero.classId = leveled.classId;
      expect(questsOffered(s, leveled.giver).map((q) => q.id)).toContain(leveled.id);
    }
  });

  it('quests are saved', () => {
    const s = createGameState(1);
    startQuest(s, 'forestWolves');
    s.quests.done.push('mainShore');
    s.talentPoints = 2;
    const l = fromSave(readSave(writeSave(toSave(s)))!);
    expect(l.quests.active.map((q) => q.id)).toEqual(['forestWolves']);
    expect(l.quests.done).toEqual(['mainShore']);
    expect(l.talentPoints).toBe(2);
  });
});
