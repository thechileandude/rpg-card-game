import { chromium } from 'playwright';
import path from 'node:path';

// A competent-player stand-in, injected into the page as source.
const PILOT = `
  var pilot = function (p) {
    var foes = living('enemy');
    if (!foes.length) return;
    var ab = function (id) {
      return roles[p.roleId].abilities.find(function (a) {
        return a.id === id && (p.cooldowns[a.id] || 0) <= 0;
      });
    };
    var priority = priorityTarget(p) || foes[0];

    var lunge = ab('lunge');
    if (lunge && !inAutoRange(p, priority) && p.hp / p.maxHp > 0.55) {
      state.selectedTargetId = priority.id;
      if (useAbility(p, lunge, priority)) return;
    }

    var reachable = foes.filter(function (f) { return inAutoRange(p, f); });
    var focus = inAutoRange(p, priority)
      ? priority
      : (reachable.slice().sort(function (a, b) { return a.hp / a.maxHp - b.hp / b.maxHp; })[0] || priority);
    state.selectedTargetId = focus.id;

    var def = ab('guard') || ab('disengage') || ab('focusWard');
    if (p.hp / p.maxHp < 0.5 && def && useAbility(p, def, p)) return;

    // Tanks: Taunt is for pulling heat OFF someone, not a damage button. Firing
    // it on cooldown drags the whole enemy team onto you and you die.
    if (p.roleId === 'tank') {
      if (p.hp / p.maxHp < 0.5 && ab('fortress') && useAbility(p, ab('fortress'), p)) return;
      var focused = alliesOf(p).filter(function (a) {
        return a.id !== p.id && foes.some(function (f) { return f.targetId === a.id; });
      });
      if (focused.length && ab('bulwark') && useAbility(p, ab('bulwark'), focused[0])) return;
      if (focused.length >= 2 && ab('taunt') && useAbility(p, ab("taunt"), priority)) return;
      if (ab('shieldSlam') && useAbility(p, ab("shieldSlam"), priority)) return;
      return;
    }

    // Healers: actually heal. Without this the healer row is meaningless noise.
    if (p.roleId === 'healer') {
      var hurt = alliesOf(p).filter(function (a) { return a.hp < a.maxHp; })
        .sort(function (a, b) { return a.hp / a.maxHp - b.hp / b.maxHp; });
      if (hurt.length >= 2 && ab('renewal') && useAbility(p, ab('renewal'), p)) return;
      if (hurt[0] && hurt[0].hp / hurt[0].maxHp < 0.75 && ab('mend') && useAbility(p, ab('mend'), hurt[0])) return;
      var threat = foes.find(function (f) { return f.cast && f.cast.interruptible; });
      if (threat && ab('barrier') && useAbility(p, ab('barrier'), threat)) return;
      if (hurt[0] && ab('mend') && useAbility(p, ab('mend'), hurt[0])) return;
      return;
    }

    var interruptAbility = ab('interrupt') || ab('shieldSlam');
    if (interruptAbility) {
      var casting = foes.find(function (f) {
        return f.cast && f.cast.interruptible && inAbilityRange(p, interruptAbility, f);
      });
      if (casting && useAbility(p, interruptAbility, casting)) return;
    }
    for (var i = 0; i < roles[p.roleId].abilities.length; i++) {
      var a = roles[p.roleId].abilities[i];
      if ((p.cooldowns[a.id] || 0) > 0) continue;
      if (a.type === 'dash') continue;
      if (useAbility(p, a, getPlayerAbilityTarget(p, a))) return;
    }

  };
`;

const BODY = `
  var N = 100;
  var results = {};
  var roleList = ['dps', 'hunter', 'caster', 'tank', 'healer'];
  var diag = { allyDmg: 0, enemyDmg: 0, allyHeal: 0, enemyHeal: 0, time: 0, exposed: 0, comps: {} };

  for (var ri = 0; ri < roleList.length; ri++) {
    var role = roleList[ri];
    var r = { cleared: 0, defeated: 0, stalled: 0, secs: [], playerDmg: 0, playerDied: 0 };
    for (var i = 0; i < N; i++) {
      localStorage.clear();
      state.selectedRole = role; state.collection = []; state.equipped = {};
      startRun(); enterRoom(0);
      state.screen = 'probe'; state.countdown = 0; state.combatActive = true; state.result = null;
      if (role === 'dps') {
        var comp = living('enemy').map(function (u) { return u.roleId; }).sort().join('+');
        diag.comps[comp] = (diag.comps[comp] || 0) + 1;
      }
      var t = 0, exposed = 0;
      while (!state.result && t < 3000) {
        var p = unitById(state.playerUnitId);
        if (p && !p.dead && !p.cast && p.gcd <= 0) pilot(p);
        if (p && isBehindEnemyLines(p)) exposed++;
        updateCombat(0.05); t++;
      }
      r.secs.push(t * 0.05);
      r.playerDmg += (state.meters[state.playerUnitId] || {}).damage || 0;
      var pl = unitById(state.playerUnitId);
      if (pl && pl.dead) r.playerDied++;
      if (!state.result) r.stalled++;
      else if (state.result === 'PULL CLEARED') r.cleared++;
      else r.defeated++;
      if (role === 'dps') {
        diag.time += t * 0.05; diag.exposed += exposed * 0.05;
        Object.keys(state.meters).forEach(function (id) {
          var m = state.meters[id];
          var u = state.units.find(function (x) { return x.id === id; });
          if (!u) return;
          if (u.team === 'ally') { diag.allyDmg += m.damage; diag.allyHeal += m.healing; }
          else { diag.enemyDmg += m.damage; diag.enemyHeal += m.healing; }
        });
      }
    }
    r.secs.sort(function (a, b) { return a - b; });
    r.median = r.secs[Math.floor(N / 2)].toFixed(1);
    r.avgDmg = Math.round(r.playerDmg / N);
    results[role] = r;
  }
  return { results: results, diag: diag, N: N };
`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.goto('file://' + path.resolve('index.html'));
await page.waitForTimeout(300);
const out = await page.evaluate(new Function(PILOT + BODY));
await browser.close();

console.log('role      cleared   defeated  stalled   median   avg dmg   died');
for (const [k, r] of Object.entries(out.results)) {
  console.log(`${k.padEnd(9)} ${String(r.cleared + '/' + out.N).padStart(7)} ${String(r.defeated).padStart(10)} ${String(r.stalled).padStart(8)} ${String(r.median + 's').padStart(8)} ${String(r.avgDmg).padStart(9)} ${String(r.playerDied).padStart(6)}`);
}
const d = out.diag;
console.log(`\nMelee-run throughput over ${d.time.toFixed(0)}s of combat:`);
console.log(`  ALLY  ${(d.allyDmg / d.time).toFixed(1)} dps / ${(d.allyHeal / d.time).toFixed(1)} hps   net vs enemy healing: ${(d.allyDmg / d.time - d.enemyHeal / d.time).toFixed(1)}`);
console.log(`  ENEMY ${(d.enemyDmg / d.time).toFixed(1)} dps / ${(d.enemyHeal / d.time).toFixed(1)} hps   net vs ally healing:  ${(d.enemyDmg / d.time - d.allyHeal / d.time).toFixed(1)}`);
console.log(`  player exposed ${(d.exposed / d.time * 100).toFixed(0)}% of combat time`);
console.log('  comps:', JSON.stringify(d.comps));
