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

// --- start a run -------------------------------------------------------
await page.click('#roleReadyButton');
await page.waitForTimeout(200);

const seq = await page.evaluate(() => state.run.sequence.map((r) => `${r.type}:${r.encounterId}`));
check(seq.length === 4, `run sequence has 4 rooms (got ${seq.length})`);
check(seq[0].startsWith('trash') && seq[1].startsWith('miniboss') && seq[2].startsWith('trash') && seq[3].startsWith('boss'),
  `the dungeon runs three-pack, miniboss, four-pack, boss (got ${seq.map((s) => s.split(':')[0]).join(', ')})`);
check(seq[3] === 'boss:warrenKing', `final room is The Warren King (got ${seq[3]})`);
check(true, 'single miniboss slot');
const trashIds = seq.filter((s) => s.startsWith('trash'));
let backToBack = false;
for (let i = 1; i < trashIds.length; i += 1) if (trashIds[i] === trashIds[i - 1]) backToBack = true;
check(trashIds.length === 2, `two trash rooms, one three-pack and one four-pack (got ${trashIds.length})`);

// --- grid ---------------------------------------------------------------
const cols = await page.evaluate(() => getComputedStyle(document.querySelector('#battlefield')).gridTemplateColumns.split(' ').length);
check(cols === 4, `battlefield renders 4 columns (got ${cols})`);
const rows = await page.evaluate(() => getComputedStyle(document.querySelector('#battlefield')).gridTemplateRows.split(' ').length);
check(rows === 4, `battlefield renders 4 rows (got ${rows})`);

// --- helper: clear the current room by zeroing enemy hp ------------------
async function clearRoom() {
  await page.evaluate(() => {
    state.countdown = 0;
    state.combatActive = true;
    state.units.filter((u) => u.team === 'enemy').forEach((u) => { u.hp = 0; u.dead = true; });
    state.respawnQueue = [];
    // give the player some meter so run totals are non-zero
    const m = state.meters[state.playerUnitId];
    if (m) { m.damage += 100; m.healing += 20; m.interrupts += 1; }
  });
  await page.waitForFunction(() => state.screen === 'loot', null, { timeout: 5000 });
}

async function confirmLootScreen(expectRoll, expectKeep, label) {
  const info = await page.evaluate(() => ({
    choices: state.lootChoices.length,
    keep: currentRoomType().keepCount,
    prompt: document.querySelector('#lootPrompt').textContent,
    disabled: document.querySelector('#lootConfirmButton').disabled
  }));
  check(info.choices === expectRoll, `${label}: rolls ${expectRoll} cards (got ${info.choices})`);
  check(info.keep === expectKeep, `${label}: keeps ${expectKeep} (got ${info.keep})`);
  check(info.disabled === true, `${label}: confirm is disabled before picking`);
  check(new Set(await page.evaluate(() => state.lootChoices)).size === expectRoll, `${label}: rolled cards are unique`);

  const cards = page.locator('#lootChoices .loot-card');
  for (let i = 0; i < expectKeep; i += 1) await cards.nth(i).click();
  const nowDisabled = await page.evaluate(() => document.querySelector('#lootConfirmButton').disabled);
  check(nowDisabled === false, `${label}: confirm enables at exactly ${expectKeep} picks`);

  // clicking a 5th/extra card must not exceed the cap
  if (expectRoll > expectKeep) {
    await cards.nth(expectKeep).click();
    const picks = await page.evaluate(() => state.lootPicks.length);
    check(picks === expectKeep, `${label}: cannot select more than ${expectKeep} (got ${picks})`);
  }
  const before = await page.evaluate(() => state.collection.reduce((n, e) => n + e.quantity, 0));
  await page.click('#lootConfirmButton');
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => state.collection.reduce((n, e) => n + e.quantity, 0));
  check(after - before === expectKeep, `${label}: ${expectKeep} card(s) added to collection (got ${after - before})`);
}

// --- walk the whole run --------------------------------------------------
for (let room = 0; room < 4; room += 1) {
  // Persistence: reload mid-run at the start of room 2 and resume.
  if (room === 1) {
    const before = await page.evaluate(() => ({
      index: state.run.roomIndex,
      cards: state.collection.reduce((n, e) => n + e.quantity, 0),
      seq: state.run.sequence.map((r) => r.encounterId).join(',')
    }));
    await page.reload();
    await page.waitForTimeout(250);
    const resumed = await page.evaluate(() => ({
      hasRun: !!state.run,
      index: state.run?.roomIndex,
      cards: state.collection.reduce((n, e) => n + e.quantity, 0),
      seq: state.run?.sequence.map((r) => r.encounterId).join(','),
      screen: state.screen
    }));
    check(resumed.hasRun === true, 'the run survives a page reload');
    check(resumed.index === before.index, `reload resumes on the room you were on (${before.index})`);
    check(resumed.seq === before.seq, 'the reloaded run keeps the same room sequence');
    check(resumed.cards === before.cards, 'secured cards survive a reload');
    check(resumed.screen === 'role', 'a reload drops you at the role screen, not mid-fight');
    await page.click('#roleReadyButton');
    await page.waitForTimeout(250);
    const idx = await page.evaluate(() => state.run.roomIndex);
    check(idx === before.index, 'resuming re-enters the saved room rather than restarting the run');
  }

  const type = await page.evaluate(() => currentRoom().type);
  const expect = { trash: [3, 1], miniboss: [4, 2], boss: [6, 3] }[type];

  if (room === 1) {
    // boss occupancy check on the miniboss
    const wide = await page.evaluate(() => {
      const boss = state.units.find((u) => u.team === 'enemy' && u.width === 2);
      if (!boss) return null;
      const cell = document.querySelector('.cell.cell-wide');
      const covered = unitAt(boss.position.row, boss.position.col + 1);
      return {
        name: boss.name,
        hasWideCell: !!cell,
        cardWide: !!document.querySelector('.unit-card.wide'),
        coveredByBoss: covered?.id === boss.id,
        cellCount: document.querySelectorAll('#battlefield .cell').length
      };
    });
    check(!!wide, 'miniboss room has a 2-wide boss unit');
    if (wide) {
      check(wide.hasWideCell && wide.cardWide, `${wide.name} renders as a wide cell + card`);
      check(wide.coveredByBoss, `${wide.name} occupies its second square`);
      check(wide.cellCount === 15, `wide boss consumes a grid slot (15 cells, got ${wide.cellCount})`);
    }
    // a wide unit must not be movable into a spot where it would overflow the grid
    const overflow = await page.evaluate(() => {
      const boss = state.units.find((u) => u.width === 2);
      const fake = { ...boss, id: 'test-wide', team: 'ally', roleId: 'dps', dead: false, cast: null };
      // Clear the back ally row so the "both squares free" case is unambiguous.
      state.units.filter((u) => u.team === 'ally').forEach((u) => { u.position = { row: 2, col: 0 }; });
      // Occupancy only. canMoveUnitTo now also enforces step distance and the
      // movement cooldown, which are separate rules tested in movetest.mjs.
      return {
        atEdge: canOccupyForRole(fake, 3, 3),
        inside: canOccupyForRole(fake, 3, 1),
        blocked: canOccupyForRole({ ...fake, position: { row: 2, col: 2 } }, 2, 0)
      };
    });
    check(overflow.atEdge === false, 'a 2-wide unit cannot anchor on the last column');
    check(overflow.inside === true, 'a 2-wide unit can anchor where both squares are free');
    check(overflow.blocked === false, 'a 2-wide unit is blocked when only its second square is occupied');
  }

  if (room === 3) {
    // enrage mechanic on the Warren King
    const enrage = await page.evaluate(async () => {
      state.countdown = 0;
      state.combatActive = true;
      state.enrageTimer = 0;
      updateEnrage(0.1);
      const king = enrageSourceUnit();
      const before = king.damageMultiplier;
      const casting = king?.cast?.abilityId === 'enrage';
      // let it finish
      for (let i = 0; i < 60; i += 1) { if (king.cast) { king.cast.elapsed += 0.1; if (king.cast.elapsed >= king.cast.castTime) finishCast(king); } }
      return { casting, before, multiplier: king.damageMultiplier, enraged: !!king.enraged };
    });
    check(enrage.casting, 'Warren King begins the enrage cast when its timer expires');
    check(enrage.multiplier === enrage.before * 2, `unchecked enrage doubles the King's damage (${enrage.before}x -> ${enrage.multiplier}x)`);

    // and that interrupting it prevents the buff
    const interrupted = await page.evaluate(() => {
      const king = enrageSourceUnit();
      const baseline = king.damageMultiplier; king.enraged = false; king.cast = null;
      state.enrageTimer = 0;
      updateEnrage(0.1);
      const player = unitById(state.playerUnitId);
      const stopped = interrupt(player, king);
      return { stopped, cast: king.cast, multiplier: king.damageMultiplier, baseline };
    });
    check(interrupted.stopped === true && interrupted.cast === null, 'the enrage cast is interruptible');
    check(interrupted.multiplier === interrupted.baseline, 'an interrupted enrage leaves damage unbuffed');
  }

  // wipe recovery, tested once mid-run
  if (room === 2) {
    const before = await page.evaluate(() => ({
      cards: state.collection.reduce((n, e) => n + e.quantity, 0),
      roomIndex: state.run.roomIndex,
      cleared: state.run.roomsCleared
    }));
    await page.evaluate(() => {
      state.countdown = 0; state.combatActive = true;
      state.units.filter((u) => u.team === 'ally').forEach((u) => { u.hp = 0; u.dead = true; });
    });
    await page.waitForFunction(() => state.result === 'PARTY DEFEATED', null, { timeout: 5000 });
    await page.click('#resultOverlay button');
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => ({
      cards: state.collection.reduce((n, e) => n + e.quantity, 0),
      roomIndex: state.run.roomIndex,
      cleared: state.run.roomsCleared,
      wipes: state.run.wipes,
      alive: state.units.filter((u) => u.team === 'ally' && !u.dead).length
    }));
    check(after.cards === before.cards, 'a wipe costs no already-secured loot');
    check(after.roomIndex === before.roomIndex, 'a wipe restarts the same room, not the run');
    check(after.cleared === before.cleared, 'a wipe does not change rooms-cleared');
    check(after.wipes === 1, 'the wipe is recorded on the run');
    check(after.alive === 3, 'the party is restored on retry');
  }

  await clearRoom();
  await confirmLootScreen(expect[0], expect[1], `room ${room + 1} (${type})`);

  const trackState = await page.evaluate(() => ({
    pips: document.querySelectorAll('.run-pip').length,
    cleared: document.querySelectorAll('.run-pip.cleared').length,
    current: document.querySelectorAll('.run-pip.current').length
  }));
  if (room === 0) {
    check(trackState.pips === 4, `run track shows 4 pips (got ${trackState.pips})`);
    check(trackState.current === 1, 'run track marks exactly one current room');
  }

  const label = await page.evaluate(() => document.querySelector('#nextFightButton').textContent);
  if (room === 3) check(label === 'Finish Run', `final room's button reads "Finish Run" (got "${label}")`);
  await page.click('#nextFightButton');
  await page.waitForTimeout(250);
}

// --- run complete ---------------------------------------------------------
const done = await page.evaluate(() => ({
  screen: state.screen,
  run: state.run,
  title: document.querySelector('#runTitle').textContent,
  stats: Array.from(document.querySelectorAll('.run-stat')).map((n) => n.textContent.replace(/\s+/g, ' ').trim()),
  cards: document.querySelectorAll('#runCards .run-card').length
}));
check(done.screen === 'run', `boss clear lands on the run-complete screen (got "${done.screen}")`);
check(done.run === null, 'the run is cleared out after completion');
check(done.title.includes('Darkwood Warren'), `completion screen names the dungeon (got "${done.title}")`);
check(done.stats.some((s) => s.startsWith('Rooms Cleared4')), `completion shows 4/4 rooms cleared (got ${JSON.stringify(done.stats[0])})`);
check(done.cards > 0, 'completion screen lists the cards secured this run');

await page.screenshot({ path: 'shot-run-complete.png', fullPage: true });
await page.click('#returnToCampButton');
await page.waitForTimeout(200);
check(await page.evaluate(() => state.screen === 'role'), 'Return to Camp goes back to the role screen');

// total loot across a full run should be 5*1 + 2*2 + 3 = 12
const total = await page.evaluate(() => state.collection.reduce((n, e) => n + e.quantity, 0));
check(total >= 7, `a full run yields at least 7 cards (2 trash + 2 miniboss + 3 boss); got ${total}`);

// screenshot a miniboss room for the wide-boss look
await page.evaluate(() => {
  startRun();
  const index = state.run.sequence.findIndex((room) => room.type === 'miniboss');
  enterRoom(index);
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'shot-miniboss.png' });
const bossRoom = await page.evaluate(() => ({
  type: currentRoom().type,
  wide: document.querySelectorAll('.unit-card.wide').length,
  cells: document.querySelectorAll('#battlefield .cell').length
}));
check(bossRoom.type === 'miniboss', 'the miniboss shortcut lands on a miniboss room');
check(bossRoom.wide === 1, `the miniboss renders one wide card (got ${bossRoom.wide})`);
check(bossRoom.cells === 15, `wide boss consumes a grid slot (got ${bossRoom.cells} cells)`);

// --- entering a run must never strand you mid-dungeon ---------------------
// Regression: the Miniboss debug jump writes roomIndex to storage, and Ready
// silently resumed it, so every later launch dropped you at the miniboss with
// no way back to room 1.
await page.evaluate(() => { localStorage.clear(); state.run = null; state.collection = []; state.equipped = {}; });
await page.reload();
await page.waitForTimeout(300);

const freshMenu = await page.evaluate(() => ({
  label: document.querySelector('#roleReadyButton').textContent.trim(),
  newRunHidden: document.querySelector('#newRunButton').classList.contains('hidden')
}));
check(freshMenu.label === 'Ready', `with no run in progress the button reads "Ready" (got "${freshMenu.label}")`);
check(freshMenu.newRunHidden === true, 'New Run stays hidden when there is nothing to abandon');

await page.click('#roleReadyButton');
await page.waitForTimeout(250);
check(await page.evaluate(() => state.run.roomIndex === 0), 'Ready starts you in room 1');

// jump to a miniboss the way the debug button does, then come back to the menu
await page.evaluate(() => {
  const i = state.run.sequence.findIndex((r) => r.type === 'miniboss');
  enterRoom(i);
  renderRoleScreen();
  showScreen('role');
});
await page.waitForTimeout(200);
const midRunMenu = await page.evaluate(() => ({
  index: state.run.roomIndex,
  label: document.querySelector('#roleReadyButton').textContent.trim(),
  newRunShown: !document.querySelector('#newRunButton').classList.contains('hidden')
}));
check(midRunMenu.index > 0, 'test setup: a run is parked mid-dungeon');
check(/^Resume · Room \d+ of \d+$/.test(midRunMenu.label), `the button admits it will resume (got "${midRunMenu.label}")`);
check(midRunMenu.newRunShown === true, 'New Run appears once a run is in progress');

// the whole point: there is a way back to room 1
await page.click('#newRunButton');
await page.waitForTimeout(250);
check(await page.evaluate(() => state.run.roomIndex === 0), 'New Run puts you back in room 1');

// and resume still works after a reload
await page.evaluate(() => {
  const i = state.run.sequence.findIndex((r) => r.type === 'miniboss');
  enterRoom(i);
});
const parkedAt = await page.evaluate(() => state.run.roomIndex);
await page.reload();
await page.waitForTimeout(300);
await page.click('#roleReadyButton');
await page.waitForTimeout(250);
check(await page.evaluate(() => state.run.roomIndex) === parkedAt, `Resume still returns to the saved room (${parkedAt})`);

check(errors.length === 0, `no page errors (${errors.length}: ${errors.slice(0, 3).join(' | ')})`);

await browser.close();
console.log(log.join('\n'));
if (fail.length) { console.log('\n' + fail.join('\n')); process.exit(1); }
console.log(`\nAll ${log.length} checks passed.`);
