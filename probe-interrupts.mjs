import { chromium } from 'playwright';
import path from 'node:path';
const PILOT = `
  var pilot = function (p) {
    var foes = living('enemy');
    if (!foes.length) return;
    var ab = function (id) { return roles[p.roleId].abilities.find(function (a) { return a.id === id && (p.cooldowns[a.id] || 0) <= 0; }); };
    var priority = priorityTarget(p) || foes[0];
    var interruptAbility = ab('interrupt') || ab('shieldSlam');
    if (interruptAbility) {
      var casting = foes.find(function (f) { return f.cast && f.cast.interruptible && inAbilityRange(p, interruptAbility, f); });
      if (casting && useAbility(p, interruptAbility, casting)) return;
    }
    var lunge = ab('lunge');
    if (lunge && !inAutoRange(p, priority) && p.hp / p.maxHp > 0.55) {
      state.selectedTargetId = priority.id;
      if (useAbility(p, lunge, priority)) return;
    }
    var reachable = foes.filter(function (f) { return inAutoRange(p, f); });
    var focus = inAutoRange(p, priority) ? priority
      : (reachable.slice().sort(function (a, b) { return a.hp / a.maxHp - b.hp / b.maxHp; })[0] || priority);
    state.selectedTargetId = focus.id;
    var def = ab('guard') || ab('disengage') || ab('focusWard');
    if (p.hp / p.maxHp < 0.5 && def && useAbility(p, def, p)) return;
    for (var i = 0; i < roles[p.roleId].abilities.length; i++) {
      var a = roles[p.roleId].abilities[i];
      if ((p.cooldowns[a.id] || 0) > 0) continue;
      if (a.type === 'dash') continue;
      if (useAbility(p, a, getPlayerAbilityTarget(p, a))) return;
    }
  };
`;
const BODY = `
  var out = {};
  var roleList = ['dps', 'hunter', 'caster', 'tank', 'healer'];
  for (var ri = 0; ri < roleList.length; ri++) {
    var role = roleList[ri];
    var acc = { playerInt: 0, allyInt: 0, castsStarted: 0, castsFinished: 0, runs: 0,
                reachableWhenCasting: 0, castObservations: 0 };
    for (var i = 0; i < 60; i++) {
      localStorage.clear();
      state.selectedRole = role; state.collection = []; state.equipped = {};
      startRun(); enterRoom(0);
      state.screen = 'probe'; state.countdown = 0; state.combatActive = true; state.result = null;
      var seen = {};
      var t = 0;
      while (!state.result && t < 3000) {
        var p = unitById(state.playerUnitId);
        if (p && !p.dead && !p.cast && p.gcd <= 0) pilot(p);
        // sample whether the player COULD reach whatever is casting
        if (p && !p.dead) {
          var caster = living('enemy').find(function (f) { return f.cast && f.cast.interruptible; });
          if (caster) {
            acc.castObservations++;
            var ia = roles[p.roleId].abilities.find(function (a) { return a.id === 'interrupt' || a.id === 'shieldSlam'; });
            if (ia && inAbilityRange(p, ia, caster)) acc.reachableWhenCasting++;
          }
        }
        living('enemy').forEach(function (f) {
          if (f.cast && !seen[f.id + f.cast.abilityId + Math.round(f.cast.elapsed * 100)]) {}
        });
        updateCombat(0.05); t++;
      }
      acc.runs++;
      var pm = state.meters[state.playerUnitId];
      if (pm) acc.playerInt += pm.interrupts;
      Object.keys(state.meters).forEach(function (id) {
        var u = state.units.find(function (x) { return x.id === id; });
        if (u && u.team === 'ally' && id !== state.playerUnitId) acc.allyInt += state.meters[id].interrupts;
      });
    }
    out[role] = acc;
  }
  return out;
`;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.goto('file://' + path.resolve('index.html'));
await page.waitForTimeout(300);
const out = await page.evaluate(new Function(PILOT + BODY));
await browser.close();
console.log('role      player interrupts/fight   ally interrupts/fight   % of enemy casts in reach');
for (const [k, a] of Object.entries(out)) {
  const pct = a.castObservations ? (a.reachableWhenCasting / a.castObservations * 100).toFixed(0) : '-';
  console.log(`${k.padEnd(9)} ${(a.playerInt / a.runs).toFixed(2).padStart(19)} ${(a.allyInt / a.runs).toFixed(2).padStart(23)} ${String(pct + '%').padStart(24)}`);
}
