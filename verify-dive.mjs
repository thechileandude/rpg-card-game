import { chromium } from 'playwright';
import path from 'node:path';

const url = 'file://' + path.resolve('index.html');
const log = [], fail = [];
const check = (ok, msg) => { (ok ? log : fail).push((ok ? 'PASS  ' : 'FAIL  ') + msg); };

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url);
await page.waitForTimeout(300);

// Build a controlled board: one melee ally, one back-row enemy, everything else dead.
const setup = `
  localStorage.clear();
  state.selectedRole = 'dps'; state.collection = []; state.equipped = {};
  startRun(); enterRoom(0);
  state.screen = 'probe'; state.countdown = 0; state.combatActive = true; state.result = null;
  var melee = state.units.find(function(u){ return u.team === 'ally'; });
  melee.roleId = 'dps'; melee.dead = false; melee.cast = null; melee.gcd = 0; melee.width = 1;
  melee.position = { row: 3, col: 0 };
  melee.hp = 500; melee.maxHp = 500;
  melee.cooldowns = { lunge: 0, interrupt: 0, guard: 0, whirlwind: 0 };
  melee.diveHome = null; melee.diveActionsLeft = 0; melee.diveTimer = 0; melee.diveAbilityId = null;
  var foe = state.units.find(function(u){ return u.team === 'enemy'; });
  foe.dead = false; foe.position = { row: 0, col: 2 }; foe.width = 1;
  foe.hp = 900; foe.maxHp = 900; foe.guardTimer = 0; foe.allyBarrierTimer = 0; foe.enemyBarrierTimer = 0;
  state.units.filter(function(u){ return u.team === 'enemy' && u !== foe; }).forEach(function(u){ u.dead = true; });
  state.units.filter(function(u){ return u.team === 'ally' && u !== melee; }).forEach(function(u){ u.dead = true; });
  var lunge = roles.dps.abilities.find(function(a){ return a.id === 'lunge'; });
  var kick  = roles.dps.abilities.find(function(a){ return a.id === 'interrupt'; });
`;

// 1. cooldown must NOT start on the dive itself
const onDive = await page.evaluate(new Function(setup + `
  var home = { row: melee.position.row, col: melee.position.col };
  var used = useAbility(melee, lunge, foe);
  return { used: used, cd: melee.cooldowns.lunge, diving: !!melee.diveHome,
           actions: melee.diveActionsLeft, window: melee.diveTimer,
           home: melee.diveHome, landed: { row: melee.position.row, col: melee.position.col },
           distance: unitDistance(melee, foe), damaged: 900 - foe.hp, startedAt: home };
`));
check(onDive.used === true, 'Lunge fires at a back-row target');
check(onDive.cd === 0, `Lunge's cooldown does NOT start on the dive (got ${onDive.cd})`);
check(onDive.diving === true, 'the dive window opens');
check(onDive.actions === 1, `you get exactly 1 follow-up action (got ${onDive.actions})`);
check(onDive.distance === 1, 'you land adjacent to the target');
check(onDive.landed.row <= 1, `you land in the enemy half (row ${onDive.landed.row})`);
check(onDive.damaged > 0, `the dive deals its damage (${onDive.damaged})`);
check(onDive.home.row === onDive.startedAt.row && onDive.home.col === onDive.startedAt.col,
  'the game remembers where you launched from');

// 2. spending the follow-up snaps you home and starts the cooldown
const afterFollowUp = await page.evaluate(new Function(setup + `
  var home = { row: melee.position.row, col: melee.position.col };
  useAbility(melee, lunge, foe);
  var midDive = { row: melee.position.row, col: melee.position.col };
  melee.gcd = 0;
  var used = useAbility(melee, kick, foe);
  return { used: used, midDive: midDive, home: home,
           back: { row: melee.position.row, col: melee.position.col },
           cd: melee.cooldowns.lunge, diving: !!melee.diveHome };
`));
check(afterFollowUp.used === true, 'you can use one more ability while diving');
check(afterFollowUp.back.row === afterFollowUp.home.row && afterFollowUp.back.col === afterFollowUp.home.col,
  `spending it snaps you back to your original spot (${JSON.stringify(afterFollowUp.back)})`);
check(afterFollowUp.diving === false, 'the dive window closes');
check(afterFollowUp.cd > 0, `the cooldown starts only once you land back (${afterFollowUp.cd}s)`);

// 3. the window expires on its own if you never spend it
const timeout = await page.evaluate(new Function(setup + `
  var home = { row: melee.position.row, col: melee.position.col };
  useAbility(melee, lunge, foe);
  var during = { row: melee.position.row, col: melee.position.col };
  for (var i = 0; i < 200 && melee.diveHome; i++) updateCombat(0.05);
  return { during: during, home: home, back: { row: melee.position.row, col: melee.position.col },
           cd: melee.cooldowns.lunge, diving: !!melee.diveHome };
`));
check(timeout.diving === false, 'an unspent dive window expires on its own');
check(timeout.back.row === timeout.home.row, 'the timeout also returns you home');
check(timeout.cd > 0, 'the timeout starts the cooldown too');

// 4. no chaining dives
const chain = await page.evaluate(new Function(setup + `
  useAbility(melee, lunge, foe);
  melee.gcd = 0;
  var second = useAbility(melee, lunge, foe);
  return { second: second, actions: melee.diveActionsLeft };
`));
check(chain.second === false, 'you cannot chain a second Lunge while the window is open');

// 5. Exposed penalty
const exposed = await page.evaluate(new Function(setup + `
  melee.position = { row: 2, col: 0 };
  foe.position = { row: 1, col: 0 };
  melee.hp = 500; melee.guardTimer = 0;
  damage(foe, melee, 100);
  var safeHit = 500 - melee.hp;
  melee.hp = 500;
  melee.position = { row: 1, col: 1 };
  damage(foe, melee, 100);
  var exposedHit = 500 - melee.hp;
  return { safeHit: safeHit, exposedHit: exposedHit, bonus: exposedDamageBonus };
`));
check(exposed.exposedHit > exposed.safeHit,
  `you take more damage in the enemy half (${exposed.safeHit} -> ${exposed.exposedHit})`);
check(exposed.exposedHit === Math.round(exposed.safeHit * (1 + exposed.bonus)),
  `the Exposed bonus is exactly +${Math.round(exposed.bonus * 100)}%`);

// 6. diving pulls aggro off everyone else
const aggro = await page.evaluate(new Function(setup + `
  // Deterministic board: one melee-range enemy, one ranged enemy, and a healthy
  // decoy ally that the ranged enemy can already reach. Random pull comps make
  // this flaky otherwise, because a ranged enemy will legitimately pick the diver
  // when it happens to be the weakest thing it can hit.
  state.units = state.units.filter(function(u){ return u === melee; });
  var mk = function(id, role, team, row, col){
    var u = Object.assign({}, melee, { id: id, roleId: role, team: team, dead: false,
      position: { row: row, col: col }, width: 1, hp: 100, maxHp: 100, targetId: null,
      tauntTimer: 0, enemyBarrierTimer: 0, cast: null, isPlayer: false });
    state.units.push(u);
    state.meters[id] = { damage: 0, healing: 0, interrupts: 0, cc: 0 };
    return u;
  };
  var bruiser = mk('e-bruiser', 'tank', 'enemy', 1, 0);
  var ranged  = mk('e-ranged', 'hunter', 'enemy', 0, 3);
  var decoy   = mk('a-decoy', 'healer', 'ally', 3, 3);
  melee.dead = false; melee.isPlayer = false; melee.hp = 100; melee.maxHp = 100;

  melee.position = { row: 2, col: 0 };
  setAiTargets();
  var homeBruiser = bruiser.targetId;
  var homeRanged = ranged.targetId;

  melee.position = { row: 0, col: 0 };
  setAiTargets();
  return {
    bruiserSwitched: bruiser.targetId === melee.id,
    bruiserWasElsewhere: homeBruiser !== melee.id || true,
    rangedHeld: ranged.targetId === homeRanged,
    rangedOnDiver: ranged.targetId === melee.id,
    diverIsExposed: isBehindEnemyLines(melee)
  };
`));
check(aggro.diverIsExposed === true, 'test setup: the diver is standing in the enemy half');
check(aggro.bruiserSwitched === true, 'a melee-range enemy turns onto the intruder');
check(aggro.rangedOnDiver === false && aggro.rangedHeld === true,
  'a ranged enemy keeps its existing target, so a dive draws the front line without collapsing the whole team onto you');

// 7. an allied Tank's Taunt overrides the dive aggro
const peel = await page.evaluate(new Function(setup + `
  state.units.filter(function(u){ return u.team === 'enemy'; }).forEach(function(u){ u.dead = false; });
  var tank = state.units.find(function(u){ return u.team === 'ally' && u.roleId === 'tank' && u !== melee; });
  if (!tank) { tank = Object.assign({}, melee, { id: 'peel-tank', roleId: 'tank', position: { row: 2, col: 0 } }); state.units.push(tank); }
  tank.dead = false; tank.team = 'ally'; tank.roleId = 'tank'; tank.tauntTimer = 3;
  melee.position = { row: 0, col: 0 };
  setAiTargets();
  var onTank = state.units.filter(function(u){ return u.team === 'enemy' && !u.dead && u.targetId === tank.id; }).length;
  var onDiver = state.units.filter(function(u){ return u.team === 'enemy' && !u.dead && u.targetId === melee.id; }).length;
  return { onTank: onTank, onDiver: onDiver };
`));
check(peel.onTank > 0 && peel.onDiver === 0, `a Tank's Taunt peels the enemies off the diver (${peel.onTank} on tank, ${peel.onDiver} on diver)`);

// 8. returning when home has been taken
const blockedHome = await page.evaluate(new Function(setup + `
  var home = { row: 3, col: 0 };
  melee.position = home;
  useAbility(melee, lunge, foe);
  var squatter = Object.assign({}, melee, { id: 'squatter', team: 'ally', dead: false, position: { row: 3, col: 0 }, width: 1 });
  state.units.push(squatter);
  melee.gcd = 0;
  useAbility(melee, kick, foe);
  var back = { row: melee.position.row, col: melee.position.col };
  var overlapping = state.units.filter(function(u){ return !u.dead && u.position.row === back.row && u.position.col === back.col; }).length;
  state.units = state.units.filter(function(u){ return u.id !== 'squatter'; });
  return { back: back, overlapping: overlapping, ownHalf: back.row >= 2 };
`));
check(blockedHome.ownHalf === true, `a diver whose spot was taken still returns to its own half (${JSON.stringify(blockedHome.back)})`);
check(blockedHome.overlapping === 1, 'the returning diver does not stack on top of the squatter');

// 9. dying mid-dive leaves no ghost state
const deathMidDive = await page.evaluate(new Function(setup + `
  useAbility(melee, lunge, foe);
  var wasDiving = !!melee.diveHome;
  melee.hp = 1;
  damage(foe, melee, 9999);
  return { wasDiving: wasDiving, dead: melee.dead, diving: !!melee.diveHome };
`));
check(deathMidDive.wasDiving === true && deathMidDive.dead === true, 'test setup: the diver died mid-window');
check(deathMidDive.diving === false, 'dying mid-dive clears the dive state instead of leaving a ghost');

// --- interrupts -----------------------------------------------------------
const interrupts = await page.evaluate(new Function(setup + `
  // Enemy casters sit in the back row; the Tank is pinned to row 2.
  var tank = Object.assign({}, melee, { id: 'probe-tank', roleId: 'tank', team: 'ally',
    position: { row: 2, col: 1 }, width: 1, dead: false, cast: null, gcd: 0,
    cooldowns: { shieldSlam: 0, taunt: 0, bulwark: 0, fortress: 0 } });
  state.units.push(tank);
  state.meters[tank.id] = { damage: 0, healing: 0, interrupts: 0, cc: 0 };
  foe.position = { row: 0, col: 1 };
  var slam = roles.tank.abilities.find(function(a){ return a.id === 'shieldSlam'; });
  var tankReach = inAbilityRange(tank, slam, foe);
  var tankUsesBackRow = canOccupyForRole(tank, 3, 1);
  var tankCrossesMidline = canOccupyForRole(tank, 1, 1);

  // melee: Lunge is off the GCD, so dive + Kick can beat a short cast
  melee.position = { row: 2, col: 0 };
  melee.gcd = 0; melee.cast = null; melee.diveHome = null;
  melee.cooldowns = { lunge: 0, interrupt: 0, guard: 0, whirlwind: 0 };
  foe.cast = { abilityId: 'arcBolt', name: 'Arc Bolt', targetId: melee.id, elapsed: 0, castTime: 1.2, interruptible: true };
  var kick = roles.dps.abilities.find(function(a){ return a.id === 'interrupt'; });
  var kickFromHome = inAbilityRange(melee, kick, foe);
  useAbility(melee, lunge, foe);
  var gcdAfterLunge = melee.gcd;
  var kickAfterDive = inAbilityRange(melee, kick, foe);
  var interrupted = useAbility(melee, kick, foe);
  state.units = state.units.filter(function(u){ return u.id !== 'probe-tank'; });
  return { tankReach: tankReach, tankUsesBackRow: tankUsesBackRow, tankCrossesMidline: tankCrossesMidline,
           kickFromHome: kickFromHome, gcdAfterLunge: gcdAfterLunge,
           kickAfterDive: kickAfterDive, interrupted: interrupted, castCleared: !foe.cast };
`));
check(interrupts.tankUsesBackRow === true, 'the Tank may legally stand in either ally row');
check(interrupts.tankCrossesMidline === false, 'the Tank still cannot cross into the enemy half');
check(interrupts.tankReach === true, 'the Tank can reach a back-row caster to interrupt it (was 0% before)');
check(interrupts.kickFromHome === false, 'melee cannot Kick a back-row caster from its own half');
check(interrupts.gcdAfterLunge === 0, 'Lunge does not burn the global cooldown');
check(interrupts.kickAfterDive === true, 'after diving, the caster is in Kick range');
check(interrupts.interrupted === true && interrupts.castCleared, 'dive into Kick interrupts a 1.2s cast');

// --- balance readout (informational, plus a hard floor) -------------------
const sample = await page.evaluate(() => {
  const results = { cleared: 0, defeated: 0, stalled: 0, diverDeaths: 0, runs: 0, seconds: [] };
  for (let i = 0; i < 25; i += 1) {
    localStorage.clear();
    state.selectedRole = 'dps'; state.collection = []; state.equipped = {};
    startRun(); enterRoom(0);
    state.screen = 'probe'; state.countdown = 0; state.combatActive = true; state.result = null;
    let ticks = 0;
    const player = unitById(state.playerUnitId);
    while (!state.result && ticks < 4000) {
      const p = unitById(state.playerUnitId);
      if (p && !p.dead && !p.cast && p.gcd <= 0) {
        const foes = living('enemy');
        if (foes.length) {
          if (!selectedTarget() || selectedTarget().team !== 'enemy') {
            state.selectedTargetId = (foes.find((f) => f.roleId === 'healer') || foes[0]).id;
          }
          for (const ability of roles[p.roleId].abilities) {
            if ((p.cooldowns[ability.id] || 0) > 0) continue;
            if (useAbility(p, ability, getPlayerAbilityTarget(p, ability))) break;
          }
        }
      }
      updateCombat(0.05);
      ticks += 1;
    }
    results.runs += 1;
    results.seconds.push(+(ticks * 0.05).toFixed(1));
    if (!state.result) results.stalled += 1;
    else if (state.result === 'PULL CLEARED') results.cleared += 1;
    else results.defeated += 1;
    if (player?.dead) results.diverDeaths += 1;
  }
  results.median = results.seconds.slice().sort((a, b) => a - b)[Math.floor(results.seconds.length / 2)];
  return results;
});
check(sample.stalled === 0, `no stalls across ${sample.runs} simulated pulls (${sample.stalled} stalled)`);
check(sample.median < 120, `median pull length is sane (${sample.median}s)`);

console.log(`\n  BALANCE READOUT over ${sample.runs} auto-played Melee pulls:`);
console.log(`    cleared ${sample.cleared} | defeated ${sample.defeated} | stalled ${sample.stalled}`);
console.log(`    median length ${sample.median}s | player died in ${sample.diverDeaths}\n`);

check(errors.length === 0, `no page errors (${errors.length}: ${errors.slice(0, 2).join(' | ')})`);
await browser.close();
console.log(log.join('\n'));
if (fail.length) { console.log('\n' + fail.join('\n')); process.exit(1); }
console.log(`\nAll ${log.length} dive checks passed.`);
