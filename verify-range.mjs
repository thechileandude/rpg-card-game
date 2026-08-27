import { chromium } from 'playwright';
import path from 'node:path';

const url = 'file://' + path.resolve('index.html');
const log = [];
const fail = [];
const check = (ok, msg) => { (ok ? log : fail).push((ok ? 'PASS  ' : 'FAIL  ') + msg); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(url);
await page.waitForTimeout(300);

const startFresh = async (role = 'dps') => {
  await page.evaluate((r) => {
    localStorage.clear();
    state.collection = []; state.equipped = {}; state.selectedRole = r;
    startRun();
    enterRoom(0);
    state.countdown = 0; state.combatActive = true;
  }, role);
  await page.waitForTimeout(150);
};

// The rAF loop keeps running during these tests. Once a probe kills off units,
// updateCombat declares a winner and freezes combat, which breaks every later
// probe. Parking the screen stops frame() touching combat or the DOM.
const park = `state.screen = 'probe'; state.combatActive = true; state.result = null;`;

// --- distance math --------------------------------------------------------
await startFresh('dps');
const dist = await page.evaluate(() => {
  const mk = (row, col, width = 1) => ({ position: { row, col }, width });
  return {
    same: unitDistance(mk(2, 1), mk(2, 1)),
    orthogonal: unitDistance(mk(2, 1), mk(1, 1)),
    diagonalIsOne: unitDistance(mk(2, 1), mk(1, 2)),
    acrossBoard: unitDistance(mk(3, 0), mk(0, 3)),
    frontToBack: unitDistance(mk(2, 1), mk(0, 1)),
    wideLeft: unitDistance(mk(2, 0), mk(1, 1, 2)),
    wideRight: unitDistance(mk(2, 3), mk(1, 1, 2)),
    wideFar: unitDistance(mk(3, 3), mk(1, 0, 2))
  };
});
check(dist.same === 0, 'distance to self is 0');
check(dist.orthogonal === 1, 'adjacent rank is distance 1');
check(dist.diagonalIsOne === 1, 'diagonal counts as distance 1 (Chebyshev, not Manhattan)');
check(dist.acrossBoard === 3, `opposite corners are distance 3 (got ${dist.acrossBoard})`);
check(dist.frontToBack === 2, 'ally front row to enemy back row is distance 2');
check(dist.wideLeft === 1 && dist.wideRight === 1, 'a 2-wide boss is adjacent from either of its halves');
check(dist.wideFar === 2, `distance to a wide boss uses its nearest cell (got ${dist.wideFar})`);

// --- range gating ---------------------------------------------------------
const gating = await page.evaluate(() => {
  state.screen = 'probe'; state.combatActive = true; state.result = null;
  const melee = state.units.find((u) => u.team === 'ally' && u.roleId === 'dps')
    || state.units.find((u) => u.team === 'ally');
  melee.roleId = 'dps';
  melee.position = { row: 2, col: 1 };
  const front = { position: { row: 1, col: 1 }, width: 1, team: 'enemy', dead: false };
  const back = { position: { row: 0, col: 1 }, width: 1, team: 'enemy', dead: false };
  const kick = roles.dps.abilities.find((a) => a.id === 'interrupt');
  const lunge = roles.dps.abilities.find((a) => a.id === 'lunge');
  const guard = roles.dps.abilities.find((a) => a.id === 'guard');
  const shot = roles.hunter.abilities.find((a) => a.id === 'aimedShot');
  const ranged = { ...melee, roleId: 'hunter' };
  return {
    meleeFront: inAbilityRange(melee, kick, front),
    meleeBack: inAbilityRange(melee, kick, back),
    lungeBack: inAbilityRange(melee, lunge, back),
    guardNoTarget: inAbilityRange(melee, guard, null),
    hunterBack: inAbilityRange(ranged, shot, back),
    autoMeleeFront: inAutoRange(melee, front),
    autoMeleeBack: inAutoRange(melee, back),
    autoHunterBack: inAutoRange(ranged, back)
  };
});
check(gating.meleeFront === true, 'melee reaches the enemy front row from the ally front row');
check(gating.meleeBack === false, 'melee cannot reach the enemy back row');
check(gating.lungeBack === true, 'Lunge reaches the enemy back row (range 3)');
check(gating.guardNoTarget === true, 'self-targeted abilities ignore range entirely');
check(gating.hunterBack === true, 'Hunter reaches the enemy back row');
check(gating.autoMeleeFront === true && gating.autoMeleeBack === false, 'melee autos are gated the same way');
check(gating.autoHunterBack === true, 'Hunter autos reach the back row');

// --- useAbility actually refuses out-of-range -----------------------------
const refuse = await page.evaluate(() => {
  state.screen = 'probe'; state.combatActive = true; state.result = null;
  const melee = state.units.find((u) => u.team === 'ally');
  melee.roleId = 'dps';
  melee.cooldowns = { lunge: 0, interrupt: 0, guard: 0, whirlwind: 0 };
  melee.gcd = 0; melee.cast = null; melee.dead = false;
  melee.position = { row: 2, col: 0 };
  const far = state.units.find((u) => u.team === 'enemy');
  far.position = { row: 0, col: 3 };
  far.hp = far.maxHp;
  const kick = roles.dps.abilities.find((a) => a.id === 'interrupt');
  const used = useAbility(melee, kick, far);
  return { used, hp: far.hp, maxHp: far.maxHp, cd: melee.cooldowns.interrupt };
});
check(refuse.used === false, 'useAbility refuses an out-of-range cast');
check(refuse.hp === refuse.maxHp, 'a refused ability deals no damage');
check(refuse.cd === 0, 'a refused ability does not burn its cooldown');

// --- point-blank penalty --------------------------------------------------
const pb = await page.evaluate(() => {
  state.screen = 'probe'; state.combatActive = true; state.result = null;
  const hunter = state.units.find((u) => u.team === 'ally');
  hunter.roleId = 'hunter';
  hunter.position = { row: 3, col: 3 };
  const foe = state.units.find((u) => u.team === 'enemy');
  foe.dead = false;
  state.units.filter((u) => u.team === 'enemy' && u !== foe).forEach((u) => { u.dead = true; });

  // Keep the foe in its OWN half throughout, or it picks up the Exposed penalty
  // and stops being a clean measurement of the point-blank multiplier.
  hunter.position = { row: 2, col: 3 };
  foe.position = { row: 0, col: 0 };
  const farMult = pointBlankMultiplier(hunter);
  const farFlag = isPointBlank(hunter);
  foe.position = { row: 1, col: 3 };
  const nearMult = pointBlankMultiplier(hunter);
  const nearFlag = isPointBlank(hunter);

  // and confirm it actually lands in the damage pipeline
  foe.hp = 1000; foe.maxHp = 1000; foe.guardTimer = 0; foe.allyBarrierTimer = 0; foe.enemyBarrierTimer = 0;
  foe.position = { row: 0, col: 0 };
  damage(hunter, foe, 100);
  const farDealt = 1000 - foe.hp;
  foe.hp = 1000;
  foe.position = { row: 1, col: 3 };
  damage(hunter, foe, 100);
  const nearDealt = 1000 - foe.hp;

  const melee = { ...hunter, roleId: 'dps' };
  return { farMult, nearMult, farFlag, nearFlag, farDealt, nearDealt,
           meleeMult: pointBlankMultiplier(melee), configured: roles.hunter.pointBlankPenalty };
});
check(pb.farMult === 1 && pb.farFlag === false, 'Hunter at range takes no point-blank penalty');
check(pb.nearMult === pb.configured && pb.nearFlag === true, `Hunter with an adjacent enemy takes its configured point-blank penalty (x${pb.configured})`);
check(pb.nearDealt === Math.round(pb.farDealt * pb.configured), `the penalty reaches real damage (${pb.farDealt} -> ${pb.nearDealt}, x${pb.configured})`);
check(pb.meleeMult === 1, 'melee has no point-blank penalty');

// --- Lunge dive -----------------------------------------------------------
const dive = await page.evaluate(() => {
  state.screen = 'probe'; state.combatActive = true; state.result = null;
  const melee = state.units.find((u) => u.team === 'ally');
  melee.roleId = 'dps'; melee.dead = false; melee.cast = null; melee.gcd = 0;
  melee.cooldowns = { lunge: 0, interrupt: 0, guard: 0, whirlwind: 0 };
  melee.position = { row: 3, col: 0 };
  melee.width = 1;
  const healer = state.units.find((u) => u.team === 'enemy');
  healer.dead = false;
  healer.position = { row: 0, col: 2 };
  healer.hp = 500; healer.maxHp = 500; healer.guardTimer = 0;
  state.units.filter((u) => u.team === 'enemy' && u !== healer).forEach((u) => { u.dead = true; });

  const before = { ...melee.position };
  const lunge = roles.dps.abilities.find((a) => a.id === 'lunge');
  const used = useAbility(melee, lunge, healer);
  const after = { ...melee.position };
  const landedDistance = unitDistance(melee, healer);
  const damaged = 500 - healer.hp;
  // nothing walks any more: the dive window itself is what brings you home
  const homeRecorded = !!melee.diveHome;
  return { used, before, after, landedDistance, damaged, homeRecorded, crossedMidline: after.row <= 1 };
});
check(dive.used === true, 'Lunge fires at a back-row target from the ally back row');
check(dive.landedDistance === 1, `Lunge lands you adjacent to the target (got distance ${dive.landedDistance})`);
check(dive.crossedMidline === true, `Lunge crosses into the enemy half (landed row ${dive.after.row})`);
check(dive.damaged > 0, `Lunge deals its damage on landing (${dive.damaged})`);
check(dive.homeRecorded === true, 'the dive records the launch cell so the window can return you');

// a dive with nowhere to land must not teleport or crash
const blocked = await page.evaluate(() => {
  state.screen = 'probe'; state.combatActive = true; state.result = null;
  const melee = state.units.find((u) => u.team === 'ally');
  melee.position = { row: 3, col: 0 };
  melee.cooldowns.lunge = 0; melee.gcd = 0; melee.cast = null;
  const target = state.units.find((u) => u.team === 'enemy' && !u.dead);
  target.position = { row: 0, col: 0 };
  // wall every cell around the target with living bodies
  const fillers = [];
  [[0,1],[1,0],[1,1]].forEach(([row, col], i) => {
    const f = { ...melee, id: `filler-${i}`, team: 'enemy', dead: false, position: { row, col }, width: 1 };
    state.units.push(f); fillers.push(f);
  });
  const lunge = roles.dps.abilities.find((a) => a.id === 'lunge');
  const before = { ...melee.position };
  useAbility(melee, lunge, target);
  const after = { ...melee.position };
  state.units = state.units.filter((u) => !u.id.startsWith('filler-'));
  return { before, after };
});
check(blocked.before.row === blocked.after.row && blocked.before.col === blocked.after.col,
  'a dive with no free landing cell leaves the diver in place instead of stacking');

// --- Disengage ------------------------------------------------------------
const dis = await page.evaluate(() => {
  state.screen = 'probe'; state.combatActive = true; state.result = null;
  const hunter = state.units.find((u) => u.team === 'ally');
  hunter.roleId = 'hunter'; hunter.dead = false; hunter.cast = null; hunter.gcd = 0;
  hunter.cooldowns = { aimedShot: 0, interrupt: 0, disengage: 0, volley: 0 };
  hunter.position = { row: 2, col: 1 };
  hunter.guardTimer = 0;
  state.units.filter((u) => u !== hunter).forEach((u) => { u.dead = true; });
  const before = { ...hunter.position };
  const ability = roles.hunter.abilities.find((a) => a.id === 'disengage');
  const used = useAbility(hunter, ability, hunter);
  return { used, before, after: { ...hunter.position }, guard: hunter.guardTimer, mit: hunter.guardMitigation };
});
check(dis.used === true, 'Disengage fires');
check(dis.after.row === dis.before.row + 1, `Disengage retreats one rank (row ${dis.before.row} -> ${dis.after.row})`);
check(dis.guard > 0 && dis.mit === 0.35, 'Disengage applies its own 35% mitigation, not the melee Guard value');

// --- Whirlwind hits only adjacent ----------------------------------------
const ww = await page.evaluate(() => {
  state.screen = 'probe'; state.combatActive = true; state.result = null;
  const melee = state.units.find((u) => u.team === 'ally');
  melee.roleId = 'dps'; melee.dead = false; melee.cast = null; melee.gcd = 0;
  melee.position = { row: 2, col: 1 };
  melee.cooldowns = { lunge: 0, interrupt: 0, guard: 0, whirlwind: 0 };
  const mk = (row, col, id) => {
    const u = { ...melee, id, team: 'enemy', dead: false, position: { row, col }, width: 1,
                hp: 500, maxHp: 500, guardTimer: 0, allyBarrierTimer: 0, enemyBarrierTimer: 0 };
    state.units.push(u); state.meters[id] = { damage: 0, healing: 0, interrupts: 0, cc: 0 };
    return u;
  };
  state.units.filter((u) => u.team === 'enemy').forEach((u) => { u.dead = true; });
  const near = mk(1, 1, 'ww-near');
  const far = mk(0, 3, 'ww-far');
  const ability = roles.dps.abilities.find((a) => a.id === 'whirlwind');
  useAbility(melee, ability, near);
  const result = { nearHit: 500 - near.hp, farHit: 500 - far.hp };
  state.units = state.units.filter((u) => !u.id.startsWith('ww-'));
  return result;
});
check(ww.nearHit > 0, `Whirlwind hits the adjacent enemy (${ww.nearHit})`);
check(ww.farHit === 0, 'Whirlwind does NOT hit enemies across the board');

// --- AI movement ----------------------------------------------------------
// --- AI repositioning, which now only happens via granted cards -----------
const closing = await page.evaluate(() => {
  state.screen = 'probe'; state.combatActive = true; state.result = null;
  const melee = state.units.find((u) => u.team === 'enemy');
  melee.roleId = 'dps'; melee.dead = false; melee.isPlayer = false; melee.cast = null; melee.gcd = 0;
  melee.position = { row: 1, col: 0 }; melee.width = 1;
  const step = items.pathfindersBelt.grantsAbility;
  melee.abilities = [...roles.dps.abilities, step];
  melee.cooldowns = Object.fromEntries(melee.abilities.map((a) => [a.id, 0]));
  const prey = state.units.find((u) => u.team === 'ally');
  prey.dead = false; prey.position = { row: 3, col: 3 }; prey.width = 1; prey.isPlayer = true;
  state.units.filter((u) => u !== melee && u !== prey).forEach((u) => { u.dead = true; });
  melee.targetId = prey.id;
  const before = unitDistance(melee, prey);
  for (let i = 0; i < 12; i += 1) {
    melee.cooldowns[step.id] = 0; melee.gcd = 0; melee.targetId = prey.id;
    aiTryAbilities(melee);
  }
  return { before, after: unitDistance(melee, prey) };
});
check(closing.after < closing.before, `an enemy with a Step card closes the gap (${closing.before} -> ${closing.after})`);

const noCard = await page.evaluate(() => {
  state.screen = 'probe'; state.combatActive = true; state.result = null;
  const melee = state.units.find((u) => u.team === 'enemy');
  melee.roleId = 'dps'; melee.dead = false; melee.isPlayer = false; melee.cast = null; melee.gcd = 0;
  melee.position = { row: 1, col: 0 }; melee.width = 1;
  melee.abilities = [...roles.dps.abilities];
  melee.cooldowns = Object.fromEntries(melee.abilities.map((a) => [a.id, 0]));
  melee.cooldowns.lunge = 99;
  const prey = state.units.find((u) => u.team === 'ally');
  prey.dead = false; prey.position = { row: 3, col: 3 }; prey.width = 1; prey.isPlayer = true;
  state.units.filter((u) => u !== melee && u !== prey).forEach((u) => { u.dead = true; });
  const start = { ...melee.position };
  for (let i = 0; i < 12; i += 1) { melee.gcd = 0; melee.targetId = prey.id; aiTryAbilities(melee); }
  return { start, end: { ...melee.position } };
});
check(noCard.start.row === noCard.end.row && noCard.start.col === noCard.end.col,
  'without a movement card and without Lunge, nothing repositions on its own');

const fleeing = await page.evaluate(() => {
  state.screen = 'probe'; state.combatActive = true; state.result = null;
  const hunter = state.units.find((u) => u.team === 'enemy');
  hunter.roleId = 'hunter'; hunter.dead = false; hunter.isPlayer = false; hunter.cast = null; hunter.gcd = 0;
  hunter.position = { row: 1, col: 1 }; hunter.width = 1;
  const step = items.pathfindersBelt.grantsAbility;
  hunter.abilities = [...roles.hunter.abilities, step];
  hunter.cooldowns = Object.fromEntries(hunter.abilities.map((a) => [a.id, 0]));
  hunter.cooldowns.disengage = 99;
  const diver = state.units.find((u) => u.team === 'ally');
  diver.dead = false; diver.position = { row: 1, col: 0 }; diver.width = 1; diver.isPlayer = true;
  state.units.filter((u) => u !== hunter && u !== diver).forEach((u) => { u.dead = true; });
  hunter.targetId = diver.id;
  const before = unitDistance(hunter, diver);
  for (let i = 0; i < 12; i += 1) {
    hunter.cooldowns[step.id] = 0; hunter.gcd = 0; hunter.targetId = diver.id;
    aiTryAbilities(hunter);
  }
  return { before, after: unitDistance(hunter, diver), row: hunter.position.row,
           stillInRange: inAutoRange(hunter, diver) };
});
check(fleeing.before === 1, 'test setup: the Hunter starts cornered');
check(fleeing.after > fleeing.before, `a cornered Hunter with a Step card breaks contact (${fleeing.before} -> ${fleeing.after})`);
check(fleeing.row <= 1, 'the fleeing Hunter stays in its own half');
check(fleeing.stillInRange === true, 'the fleeing Hunter retreats but stays able to shoot');

// --- the big one: a real fight must actually resolve ----------------------
async function playOut(role, label) {
  await page.evaluate((r) => {
    localStorage.clear();
    state.collection = []; state.equipped = {}; state.selectedRole = r;
    startRun(); enterRoom(0);
    state.screen = 'probe';
    state.countdown = 0; state.combatActive = true; state.result = null;
  }, role);
  // Drive the sim at a fixed step, with a crude autopilot standing in for the
  // player. An idle player is not a real scenario and deadlocks on healer HP.
  return page.evaluate(() => {
    const startEnemies = living('enemy').length;
    const startAllies = living('ally').length;
    let ticks = 0;
    const moved = new Set();
    const autopilot = () => {
      const p = unitById(state.playerUnitId);
      if (!p || p.dead || p.cast || p.gcd > 0) return;
      const foes = living('enemy');
      if (!foes.length) return;
      // keep a live target selected
      if (!selectedTarget() || selectedTarget().team !== 'enemy') {
        state.selectedTargetId = (foes.find((f) => f.roleId === 'healer') || foes[0]).id;
      }
      for (const ability of roles[p.roleId].abilities) {
        if ((p.cooldowns[ability.id] || 0) > 0) continue;
        if (useAbility(p, ability, getPlayerAbilityTarget(p, ability))) return;
      }
    };
    while (!state.result && ticks < 4000) {
      state.units.forEach((u) => { if (!u.dead) moved.add(`${u.id}:${u.position.row},${u.position.col}`); });
      autopilot();
      updateCombat(0.05);
      ticks += 1;
    }
    return {
      result: state.result,
      seconds: +(ticks * 0.05).toFixed(1),
      startEnemies, startAllies,
      distinctPositions: moved.size,
      totalDamage: Object.values(state.meters).reduce((n, m) => n + m.damage, 0)
    };
  });
}

// Repositioning is asserted in aggregate, not per role: with per-role movement
// cadences a single short fight can legitimately end without anyone needing to
// move. The deterministic closing/fleeing probes above guard the behaviour itself.
let repositionedSomewhere = false;
for (const [role, label] of [['dps', 'Melee'], ['hunter', 'Hunter'], ['caster', 'Caster'], ['tank', 'Tank'], ['healer', 'Healer']]) {
  const out = await playOut(role, label);
  check(out.result !== null, `${label}: an unattended fight reaches a result instead of stalling (${out.result ?? 'STALLED'})`);
  check(out.seconds < 180, `${label}: the fight resolves in a sane time (${out.seconds}s)`);
  check(out.totalDamage > 0, `${label}: damage is actually being dealt (${Math.round(out.totalDamage)})`);
  if (out.distinctPositions > out.startEnemies + out.startAllies) repositionedSomewhere = true;
}
check(repositionedSomewhere, 'dives still move units during at least one of the five role fights');

// and the boss room, where a 2-wide boss plus adds could deadlock
const bossOut = await page.evaluate(() => {
  localStorage.clear();
  state.collection = []; state.equipped = {}; state.selectedRole = 'dps';
  startRun();
  enterRoom(state.run.sequence.findIndex((r) => r.type === 'boss'));
  state.screen = 'probe';
  state.countdown = 0; state.combatActive = true; state.result = null;
  let ticks = 0;
  while (!state.result && ticks < 8000) { updateCombat(0.05); ticks += 1; }
  return { result: state.result, seconds: +(ticks * 0.05).toFixed(1) };
});
check(bossOut.result !== null, `the Warren King fight resolves rather than deadlocking (${bossOut.result ?? 'STALLED'})`);

// --- UI feedback ----------------------------------------------------------
await startFresh('dps');
const ui = await page.evaluate(() => {
  state.screen = 'battle'; state.combatActive = true; state.result = null;
  const player = unitById(state.playerUnitId);
  player.position = { row: 3, col: 3 };
  const back = state.units.find((u) => u.team === 'enemy' && !u.dead);
  back.position = { row: 0, col: 0 };
  state.selectedTargetId = back.id;
  renderBattle();
  const kickButton = Array.from(document.querySelectorAll('.ability-button'))
    .find((b) => b.textContent.includes('Kick'));
  return {
    greyed: kickButton?.classList.contains('out-of-range'),
    disabled: kickButton?.disabled,
    label: kickButton?.querySelector('small')?.textContent,
    targetText: document.querySelector('#currentTargetText').textContent,
    targetFlagged: document.querySelector('#currentTargetText').classList.contains('out-of-range')
  };
});
check(ui.greyed === true && ui.disabled === true, 'an out-of-range ability button is greyed out and unclickable');
check(/Out of range/.test(ui.label || ''), `the button says why (got "${ui.label}")`);
check(/OUT OF RANGE/.test(ui.targetText), `the target panel warns you (got "${ui.targetText}")`);
check(ui.targetFlagged === true, 'the target panel is flagged for styling');

await page.screenshot({ path: 'shot-range.png' });
check(errors.length === 0, `no page errors (${errors.length}: ${errors.slice(0, 3).join(' | ')})`);

await browser.close();
console.log(log.join('\n'));
if (fail.length) { console.log('\n' + fail.join('\n')); process.exit(1); }
console.log(`\nAll ${log.length} range checks passed.`);
