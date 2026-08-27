import { chromium } from 'playwright';
import path from 'node:path';
const log = [], fail = [];
const check = (ok, m) => { (ok ? log : fail).push((ok ? 'PASS  ' : 'FAIL  ') + m); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 428, height: 926 } });
const errs = []; page.on('pageerror', e => errs.push(String(e)));
await page.goto('file://' + path.resolve('/home/claude/rpg/index.html'));
await page.waitForTimeout(300);

const setup = (equipped = '{}') => `
  localStorage.clear();
  state.selectedRole='dps'; state.collection=[]; state.equipped=${equipped};
  startRun(); enterRoom(0);
  state.screen='probe'; state.countdown=0; state.combatActive=true; state.result=null;
  state.pendingReposition=null;
  var p = unitById(state.playerUnitId);
  p.dead=false; p.cast=null; p.gcd=0; p.width=1;
  state.units.filter(function(u){return u!==p && u.team==='ally';}).forEach(function(u){u.dead=true;});
`;

// 1. nothing moves without a card
const bare = await page.evaluate(new Function(setup() + `
  var ids = unitAbilities(p).map(function(a){return a.id;});
  var steps = unitAbilities(p).filter(function(a){return a.type==='reposition';});
  var start = { row:p.position.row, col:p.position.col };
  resolvePendingReposition(3,3);
  return { ids:ids, steps:steps.length, start:start, end:{row:p.position.row,col:p.position.col},
           free: typeof window.canMoveUnitTo };
`));
check(bare.steps === 0, 'a unit with no movement gear has no reposition ability');
check(bare.free === 'undefined', 'free tap-to-move is gone from the game entirely');
check(bare.start.row === bare.end.row && bare.start.col === bare.end.col, 'tapping a square moves nothing on its own');

// 2. a card grants the ability
const belted = await page.evaluate(new Function(setup("{ Belt: 'pathfindersBelt' }") + `
  var steps = unitAbilities(p).filter(function(a){return a.type==='reposition';});
  return { count:steps.length, name: steps[0] && steps[0].name, range: steps[0] && steps[0].moveRange,
           cd: steps[0] && steps[0].cooldown, onBar: unitAbilities(p).length };
`));
check(belted.count === 1, "Pathfinder's Belt grants exactly one reposition ability");
check(belted.name === 'Step', `the granted ability is named (${belted.name})`);
check(belted.onBar === 5, `it appears on the ability bar as a fifth button (got ${belted.onBar})`);

// 3. using it: arm, pick, cooldown
const used = await page.evaluate(new Function(setup("{ Belt: 'pathfindersBelt' }") + `
  p.position = { row:3, col:0 };
  var step = unitAbilities(p).find(function(a){return a.type==='reposition';});
  var idx = unitAbilities(p).indexOf(step);
  useAbilityByIndex(idx);
  var armed = !!state.pendingReposition;
  var legal = repositionTargets(p, step).length;
  var farCell = repositionTargets(p, step).some(function(c){return c.row===3 && c.col===3;});
  var moved = resolvePendingReposition(2,1);
  var cd = p.cooldowns[step.id];
  useAbilityByIndex(idx);
  var rearmedWhileOnCd = !!state.pendingReposition;
  return { armed:armed, legal:legal, farCell:farCell, moved:moved, pos:p.position, cd:cd,
           rearmedWhileOnCd:rearmedWhileOnCd };
`));
check(used.armed === true, 'pressing the ability arms a destination picker instead of firing');
check(used.farCell === false, 'range 1 does not offer a square three away');
check(used.moved === true && used.pos.row === 2 && used.pos.col === 1, 'picking a legal square moves you there');
check(used.cd > 0, `using it starts its cooldown (${used.cd}s)`);
check(used.rearmedWhileOnCd === false, 'you cannot arm it again while it is on cooldown');

// 4. zones still hold, and the legendary breaks them
const zones = await page.evaluate(new Function(setup("{ Belt: 'pathfindersBelt' }") + `
  p.roleId='healer'; p.position={row:2,col:1};
  state.units.filter(function(u){return u!==p;}).forEach(function(u){u.dead=true;});
  var step = items.pathfindersBelt.grantsAbility;
  var healerCross = repositionTargets(p, step).some(function(c){return c.row<2;});
  var shadow = items.shadowstepCharm.grantsAbility;
  var shadowCross = repositionTargets(p, shadow).some(function(c){return c.row<2;});
  var shadowAnywhere = repositionTargets(p, shadow).length;
  return { healerCross:healerCross, shadowCross:shadowCross, shadowAnywhere:shadowAnywhere };
`));
check(zones.healerCross === false, 'a normal Step card still cannot take a healer across the midline');
check(zones.shadowCross === true, 'Shadowstep ignores zone rules, which is what makes it legendary');
check(zones.shadowAnywhere > 8, `Shadowstep reaches most of the board (${zones.shadowAnywhere} squares)`);

// 5. movement stats stack onto granted abilities
const stats = await page.evaluate(new Function(setup("{ Belt: 'pathfindersBelt' }") + `
  var step = unitAbilities(p).find(function(a){return a.type==='reposition';});
  p.stats = roleStats(p.roleId, 'ally');
  var baseCd = modifiedCooldown(p, step);
  var baseRange = repositionRange(p, step);
  state.equipped = { Belt:'pathfindersBelt', Feet:'striderBoots', Cape:'vaultingCloak' };
  p.stats = roleStats(p.roleId, 'ally');
  return { baseCd:baseCd, baseRange:baseRange,
           gearedCd: modifiedCooldown(p, step), gearedRange: repositionRange(p, step) };
`));
check(stats.gearedCd < stats.baseCd, `Strider Boots shorten the step cooldown (${stats.baseCd}s -> ${stats.gearedCd}s)`);
check(stats.gearedRange === stats.baseRange + 1, `Vaulting Cloak extends step range (${stats.baseRange} -> ${stats.gearedRange})`);

// 6. fights still resolve with nobody walking
const sim = await page.evaluate(() => {
  let stalled = 0;
  for (let i = 0; i < 20; i += 1) {
    localStorage.clear();
    state.selectedRole = 'dps'; state.collection = []; state.equipped = {};
    startRun(); enterRoom(0);
    state.screen = 'probe'; state.countdown = 0; state.combatActive = true; state.result = null;
    let t = 0;
    while (!state.result && t < 4000) { updateCombat(0.05); t++; }
    if (!state.result) stalled++;
  }
  return stalled;
});
check(sim === 0, `no stalls now that nothing walks (${sim}/20 stalled)`);
check(errs.length === 0, `no page errors (${errs.slice(0, 2).join(' | ')})`);
await browser.close();
console.log(log.join('\n'));
if (fail.length) { console.log('\n' + fail.join('\n')); process.exit(1); }
console.log(`\nAll ${log.length} movement-card checks passed.`);
