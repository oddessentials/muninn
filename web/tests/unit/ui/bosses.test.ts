import { describe, expect, it } from 'vitest';
import {
  bossDayNote,
  bossDayTitle,
  bossEventLabel,
  bossStanding,
  bossTierEyebrow
} from '$lib/ui/bosses';

const seen = { since: '2026-07-25T19:20:00Z', day: 20, observed: true };
const saved = { since: '2026-09-11T03:31:56.391Z', day: 23, observed: false };

describe('boss standing', () => {
  it('calls a boss defeated whether or not the kill was seen', () => {
    expect(bossStanding({ defeat: seen, active: false })).toBe('defeated');
    expect(bossStanding({ defeat: saved, active: false })).toBe('defeated');
    expect(bossStanding({ defeat: null, active: true })).toBe('fighting now');
    expect(bossStanding({ defeat: null, active: false })).toBe('undefeated');
  });

  it('says by which day a boss fell before the log began', () => {
    const rest = { active: false, summons: 0, engaged: 0 };
    expect(bossDayNote({ ...rest, defeat: seen, kills: 1 })).toBe('day 20');
    expect(bossDayNote({ ...rest, defeat: seen, kills: 2 })).toBe('day 20, 2 kills');
    expect(bossDayNote({ ...rest, defeat: saved, kills: 0 })).toBe('by day 23');
    expect(bossDayNote({ ...rest, defeat: saved, kills: 3 })).toBe('by day 23, 3 kills');
    expect(bossDayNote({ ...rest, defeat: null, kills: 0, active: true })).toBe('fighting now');
    expect(bossDayNote({ ...rest, defeat: null, kills: 0, summons: 1 })).toBe(
      'summoned, not defeated'
    );
    expect(bossDayNote({ ...rest, defeat: null, kills: 0 })).toBe('not yet');
  });

  it('explains the unseen kill in a title and nothing otherwise', () => {
    expect(bossDayTitle({ defeat: saved })).toBe('Already defeated when the log began on day 23');
    expect(bossDayTitle({ defeat: seen })).toBeUndefined();
    expect(bossDayTitle({ defeat: null })).toBeUndefined();
  });
});

describe('boss tiers and phases', () => {
  it('names the tier in the eyebrow', () => {
    expect(bossTierEyebrow({ tier: 'forsaken', order: 8 })).toBe('Forsaken 8 of 8');
    expect(bossTierEyebrow({ tier: 'mini', order: 3 })).toBe('Mini-boss');
    expect(bossTierEyebrow({ tier: 'other', order: 1 })).toBe('Not one of the Forsaken');
  });

  it('labels timeline events by phase', () => {
    expect(bossEventLabel({ kind: 'summoned', phase: null })).toBe('Summoned');
    expect(bossEventLabel({ kind: 'summoned', phase: 1 })).toBe('Summoned');
    expect(bossEventLabel({ kind: 'summoned', phase: 2 })).toBe('Phase 2 begins');
    expect(bossEventLabel({ kind: 'engaged', phase: null })).toBe('Engaged');
    expect(bossEventLabel({ kind: 'engaged', phase: 3 })).toBe('Engaged in phase 3');
    expect(bossEventLabel({ kind: 'phase', phase: 1 })).toBe('Phase 1 broken');
    expect(bossEventLabel({ kind: 'defeated', phase: 3 })).toBe('Defeated');
  });
});
