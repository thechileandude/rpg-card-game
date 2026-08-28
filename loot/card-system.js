(async () => {
  const [set, secondSet, thirdSet, passiveSet] = await Promise.all([
    fetch("loot/first-set.json").then((response) => response.json()),
    fetch("loot/second-set.json").then((response) => response.json()),
    fetch("loot/third-set.json").then((response) => response.json()),
    fetch("loot/passive-cards.json").then((response) => response.json())
  ]);
  const allCards = [...set.cards, ...secondSet.cards, ...thirdSet.cards, ...passiveSet.cards];
  const cards = Object.fromEntries(allCards.map((card) => [card.id, card]));
  const roleToCard = { tank: "tank", healer: "healer", dps: "melee", caster: "caster", hunter: "hunter" };
  const cardToRole = { tank: "tank", healer: "healer", melee: "dps", caster: "caster", hunter: "hunter" };
  const slotLabels = { mainWeapon: "Main Weapon", offhand: "Offhand", utility: "Utility", ultimate: "Ultimate", artifact: "Artifact", enchantment: "Enchantment" };
  const liveSlots = ["Main Weapon", "Offhand", "Utility", "Ultimate", "Artifact", "Enchantment"];
  const rarityOrder = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
  const keywordRules = {
    Advance: "Move toward an enemy as part of this ability.",
    Hold: "Prevent, redirect, or absorb incoming damage.",
    Expose: "The marked enemy takes increased damage.",
    Interrupt: "Stop an ability currently being cast.",
    Root: "The target cannot move for the listed duration.",
    Cleanse: "Remove a harmful condition from an ally.",
    Rescue: "Move an ally adjacent to the user.",
    Revive: "Return a defeated ally to battle.",
    Cleave: "Also damage enemies adjacent to the target.",
    Counter: "Deal damage after blocking an attack.",
    Retreat: "Move away from the nearest enemy.",
    Teleport: "Move directly to a valid empty square.",
    Volley: "Hit every enemy in the targeted row.",
    Area: "Hit every enemy in the targeted 2x2 area."
  };
  const interactionRules = {
    "iron-mace": "Combo — Crushing Blow stuns an Exposed target for 2s.",
    charge: "Setup — Charge applies Exposed for 5s.",
    "guard-shield": "Choice — Shield links an ally or bashes an adjacent enemy.",
    "dawn-staff": "Payoff — Mend heals 8 more on a protected ally.",
    "acolytes-tome": "Trigger — Purify gains 10 Ultimate charge when it removes a condition.",
    rescue: "Rescue — Also removes Root and Stun from the moved ally.",
    "soldiers-sword": "Combo — Lunge gains 8 damage on Marked targets; Cleave consumes Exposed to hit twice.",
    "parrying-dagger": "Counter — Riposte applies Exposed to the attacker for 4s.",
    "warren-bow": "Combo — Aimed Shot gains 6 damage and extends Hunter's Mark by 2s.",
    disengage: "Setup — Disengage empowers the next damaging ability by 8.",
    "apprentice-spellbook": "Trigger — A successful Spellbreak gains 15 Ultimate charge.",
    blink: "Setup — Blink makes the next cast uninterruptible."
  };

  function keywordsFor(card) {
    const found = new Set();
    card.abilities.forEach((ability) => {
      if (ability.id === "charge") found.add("Advance");
      if (ability.damageReduction !== undefined || ability.redirectDamage !== undefined || ability.shield !== undefined) found.add("Hold");
      if (ability.damageBonus !== undefined) found.add("Expose");
      if (ability.interrupt) found.add("Interrupt");
      if (ability.rootDuration) found.add("Root");
      if (ability.cleanse) found.add("Cleanse");
      if (ability.moveTargetAdjacent) found.add("Rescue");
      if (ability.reviveCount) found.add("Revive");
      if (ability.adjacentDamage) found.add("Cleave");
      if (ability.counterDamage) found.add("Counter");
      if (ability.id === "disengage") found.add("Retreat");
      if (ability.id === "blink") found.add("Teleport");
      if (ability.target === "enemyRow") found.add("Volley");
      if (ability.target === "area2x2") found.add("Area");
    });
    return [...found];
  }

  const cardsForRole = (roleId) => allCards.filter((card) => card.role === roleToCard[roleId]);
  const baseLoadout = (roleId) => Object.fromEntries(set.cards.filter((card) => card.role === roleToCard[roleId]).map((card) => [card.slot, card.id]));
  const starterLoadout = (roleId) => roleId === "tank" ? baseLoadout(roleId) : {};
  const normalizedLoadouts = (saved = {}) => Object.fromEntries(allRoles.map((roleId) => [roleId, { ...starterLoadout(roleId), ...(saved[roleId] || {}) }]));
  const loadoutCardIds = (roleId, team = "ally") => {
    const loadout = team === "ally" ? state.cardEquipped[roleId] : baseLoadout(roleId);
    return ["mainWeapon", "offhand", "utility", "ultimate", "artifact", "enchantment"].map((slot) => loadout?.[slot]).filter(Boolean);
  };
  const loadoutCards = (roleId, team = "ally") => loadoutCardIds(roleId, team).map((id) => cards[id]).filter(Boolean);

  function toAbility(raw, card) {
    const typeMap = {
      "crushing-blow": "damage", "concussive-strike": "damage", "shield-wall": "guard", protect: "protect",
      charge: "charge", "last-bastion": "lastBastion", mend: "heal", renewal: "renewal",
      barrier: "allyBarrier", purify: "purify", rescue: "rescue", "divine-intervention": "divineIntervention",
      lunge: "damage", cleave: "cleave", pummel: "damage", riposte: "riposte", pursuit: "pursuit",
      whirlwind: "whirlwind", "aimed-shot": "damage", volley: "rowDamage", "pinning-shot": "damage",
      "hunters-mark": "huntersMark", disengage: "disengage", "rain-of-arrows": "rainOfArrows",
      "arc-bolt": "damage", "ember-wave": "damageAll", spellbreak: "interrupt", "focus-ward": "shieldSelf",
      blink: "reposition", meteor: "meteor"
    };
    const ability = {
      ...raw,
      type: typeMap[raw.id] || "damage",
      amount: raw.damage ?? raw.healing ?? 0,
      cooldown: raw.cooldown || 0,
      cardId: card.id,
      cardSlot: card.slot
    };
    if (raw.damageReduction !== undefined) ability.mitigation = 1 - raw.damageReduction;
    if (raw.evasion !== undefined) ability.mitigation = 1 - raw.evasion;
    if (raw.range !== undefined) ability.range = raw.range;
    if (raw.moveRange !== undefined) ability.moveRange = raw.moveRange;
    if (raw.moveRange !== undefined && raw.target === "enemy") ability.range = raw.moveRange;
    if (["damage", "cleave"].includes(ability.type) && ability.range === undefined) ability.range = ["tank", "melee"].includes(card.role) ? 1 : 3;
    if (ability.type === "reposition") {
      ability.moveRange = 3;
      ability.ignoreZones = false;
    }
    return ability;
  }

  const abilitiesFromCards = (cardList) => cardList.flatMap((card) => card.abilities.map((ability) => toAbility(ability, card)));
  const autoFromCards = (roleId, cardList) => {
    const main = cardList.find((card) => card.slot === "mainWeapon");
    const old = roles[roleId].auto;
    return main?.auto ? { type: main.auto.type === "healing" ? "heal" : "damage", amount: main.auto.amount, interval: main.auto.rate, range: old.range } : old;
  };
  const abilitiesFor = (roleId, team = "ally") => abilitiesFromCards(loadoutCards(roleId, team));
  const autoFor = (roleId, team = "ally") => autoFromCards(roleId, loadoutCards(roleId, team));

  Object.assign(items, Object.fromEntries(allCards.map((card) => {
    const profile = set.acquisitionProfiles[card.acquisitionProfile];
    const keywords = keywordsFor(card);
    return [card.id, {
      ...card,
      slot: slotLabels[card.slot],
      allowedRoles: card.role === "all" ? allRoles : [cardToRole[card.role]],
      stats: card.stats || {},
      sourceEnemies: profile.sourceEnemies,
      sourceEncounters: profile.sourceEncounters,
      tradeable: true,
      keywords,
      keywordHelp: keywords.map((keyword) => `${keyword}: ${keywordRules[keyword]}`).join(" "),
      description: card.rulesText || `${card.auto ? `Auto/Rate ${card.auto.amount} / ${card.auto.rate}s · ` : ""}${card.abilities.map((ability) => ability.name).join(" / ")}${interactionRules[card.id] ? ` · ${interactionRules[card.id]}` : ""}`
    }];
  })));

  const saved = JSON.parse(localStorage.getItem(saveKey) || "{}");
  const permanentCollectionKey = `${saveKey}-permanent-collection`;
  const permanentCollection = JSON.parse(localStorage.getItem(permanentCollectionKey) || "null");
  const collectionVersion = 2;
  state.cardEquipped = normalizedLoadouts(saved.cardEquipped || {});
  state.ultimateChargeByRole = saved.ultimateChargeByRole || {};
  state.craftingCurrency = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0, ...(saved.craftingCurrency || {}) };
  const oldCollection = Array.isArray(permanentCollection)
    ? permanentCollection
    : Array.isArray(saved.collection) ? saved.collection : [];
  const starterCards = new Set(["iron-mace", "guard-shield", "charge", "last-bastion"]);
  state.collection = allCards.map((card) => {
    const owned = oldCollection.find((entry) => entry.itemId === card.id);
    return { itemId: card.id, quantity: Math.max(starterCards.has(card.id) ? 1 : 0, owned?.quantity || 0) };
  }).filter((entry) => entry.quantity > 0);

  saveGame = function saveCardGame() {
    localStorage.setItem(permanentCollectionKey, JSON.stringify(state.collection));
    localStorage.setItem(saveKey, JSON.stringify({
      collection: state.collection,
      equipped: state.equipped,
      cardEquipped: state.cardEquipped,
      ultimateChargeByRole: state.ultimateChargeByRole,
      craftingCurrency: state.craftingCurrency,
      cardCollectionVersion: collectionVersion,
      selectedRole: state.selectedRole,
      run: state.run
    }));
  };

  allRoles.forEach((roleId) => {
    roles[roleId].maxHp = set.healthScale.standard;
    roles[roleId].auto = autoFor(roleId, "enemy");
    roles[roleId].abilities = abilitiesFor(roleId, "enemy");
  });

  const originalRoleChoiceLines = roleChoiceLines;
  roleChoiceLines = function cardRoleChoiceLines(roleId) {
    const ultimate = roles[roleId].abilities.find((ability) => ability.cardSlot === "ultimate");
    return originalRoleChoiceLines(roleId).map((line) => ultimate && line.startsWith(ultimate.name) ? line.replace(/0s$/, "100 charge") : line);
  };

  roleStats = function cardRoleStats(roleId) {
    const stats = { maxHp: set.healthScale.standard, autoDamage: 0, autoHealing: 0, abilityPower: 0, cooldownReduction: 0, haste: 0, moveCooldown: 0, moveRange: defaultMoveRange };
    const loadout = state.cardEquipped?.[roleId] || {};
    [loadout.artifact, loadout.enchantment].map((id) => cards[id]).filter(Boolean).forEach((card) => {
      Object.entries(card.stats || {}).forEach(([key, value]) => { stats[key] = (stats[key] || 0) + value; });
    });
    stats.haste = Math.min(0.3, stats.haste);
    return stats;
  };

  const hasPassive = (unit, cardId) => unit?.cardIds?.includes(cardId);

  const originalBeginCast = beginCast;
  beginCast = function passiveCast(source, ability, target) {
    const passiveSpeed = source.stats?.haste || 0;
    const momentumSpeed = source.nextCastSpeed || 0;
    const adjusted = { ...ability, castTime: ability.castTime * Math.max(0.5, 1 - passiveSpeed - momentumSpeed) };
    source.nextCastSpeed = 0;
    originalBeginCast(source, adjusted, target);
  };

  const originalCreateUnit = createUnit;
  createUnit = function createCardUnit(roleId, team, name, slotKey, hpMultiplier = 1, positionKey = slotKey, encounterEntry = null) {
    const unit = originalCreateUnit(roleId, team, name, slotKey, 1, positionKey, encounterEntry);
    const type = currentRoomType();
    const isWideBoss = team === "enemy" && (encounterEntry?.width || 1) > 1;
    unit.maxHp = type.id === "boss" && team === "enemy" ? set.healthScale.boss
      : type.id === "miniboss" && isWideBoss ? set.healthScale.miniboss
        : set.healthScale.standard;
    const isPlayerSlot = team === "ally" && (
      (state.selectedRole === "tank" && slotKey === "allyTank") ||
      (state.selectedRole === "healer" && slotKey === "allyHealer") ||
      (["dps", "caster", "hunter"].includes(state.selectedRole) && slotKey === "allyDps")
    );
    if (isPlayerSlot) unit.maxHp = unit.stats.maxHp;
    unit.hp = unit.maxHp;
    unit.cardIds = isPlayerSlot ? loadoutCardIds(roleId, "ally") : Object.values(baseLoadout(roleId));
    const unitCards = unit.cardIds.map((id) => cards[id]).filter(Boolean);
    unit.abilities = abilitiesFromCards(unitCards);
    unit.cooldowns = Object.fromEntries(unit.abilities.map((ability) => [ability.id, 0]));
    unit.auto = autoFromCards(roleId, unitCards);
    unit.autoTimer = unit.auto.interval;
    unit.ultimateCharge = team === "ally" ? (state.ultimateChargeByRole[roleId] || 0) : 0;
    unit.stunTimer = 0;
    unit.rootTimer = 0;
    unit.markTimer = 0;
    unit.markedBy = null;
    unit.shield = 0;
    unit.castingLockoutTimer = 0;
    unit.secondWindUsed = false;
    return unit;
  };

  unitAbilities = (unit) => unit?.abilities || [];
  findAbility = (unit, abilityId) => unitAbilities(unit).find((ability) => ability.id === abilityId) || null;
  modifiedAutoIntervalFromStats = (roleId, stats) => roles[roleId].auto.interval * Math.max(0.7, 1 - (stats.haste || 0));
  modifiedAutoInterval = (unit) => (unit.auto?.interval || roles[unit.roleId].auto.interval) * Math.max(0.7, 1 - (unit.stats.haste || 0));

  const chargeUltimate = (unit, amount) => {
    if (!unit || unit.resolvingUltimate || amount <= 0) return;
    unit.ultimateCharge = Math.min(set.rules.ultimateChargeRequired, (unit.ultimateCharge || 0) + amount);
    if (unit.team === "ally") state.ultimateChargeByRole[unit.roleId] = unit.ultimateCharge;
  };

  const originalHeal = heal;
  heal = function cardHeal(source, target, amount) {
    const before = target?.hp || 0;
    originalHeal(source, target, amount);
    const restored = Math.max(0, (target?.hp || 0) - before);
    const excess = Math.max(0, amount - restored);
    if (excess > 0 && hasPassive(source, "overflowing-light")) target.shield += excess;
    const link = target ? bulwarkForTarget(target.id) : null;
    if (restored > 0 && link && hasPassive(source, "shared-burden")) {
      const tank = unitById(link.tankId);
      if (tank && !tank.dead) originalHeal(source, tank, restored * 0.25);
    }
    if (restored > 0) {
      if (source) {
        state.healingBolts ||= [];
        state.healingBolts.push({ sourceId: source.id, targetId: target.id, remaining: 0.45, duration: 0.45 });
        state.healingBolts = state.healingBolts.slice(-8);
      }
    }
    if (source?.roleId === "healer") chargeUltimate(source, restored);
  };

  const originalDamage = damage;
  damage = function cardDamage(source, target, amount) {
    if (!source || !target) return;
    const before = target.hp;
    const redirectLink = bulwarkForTarget(target.id);
    const redirectTank = redirectLink ? unitById(redirectLink.tankId) : null;
    const redirectTankHp = redirectTank?.hp || 0;
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, amount);
      target.shield -= absorbed;
      amount -= absorbed;
      if (target.roleId === "tank") chargeUltimate(target, absorbed);
    }
    if (target.markedBy === source.id && target.markTimer > 0) amount = Math.round(amount * 1.25);
    originalDamage(source, target, amount);
    const dealt = Math.max(0, before - target.hp);
    if (isDamageRole(source.roleId)) chargeUltimate(source, dealt);
    if (target.roleId === "tank") chargeUltimate(target, dealt);
    if (redirectTank && !redirectTank.dead) {
      const redirected = Math.max(0, redirectTankHp - redirectTank.hp);
      chargeUltimate(redirectTank, redirected * (hasPassive(redirectTank, "oath-of-protection") ? 1.5 : 1));
    }
    if (target.hp <= 30 && !target.dead && !target.secondWindUsed && hasPassive(target, "second-wind")) {
      target.secondWindUsed = true;
      originalHeal(target, target, 15);
    }
    if (target.riposteDamage && unitDistance(source, target) <= 1) {
      const counter = target.riposteDamage;
      target.riposteDamage = 0;
      originalDamage(target, source, counter);
      source.exposedTimer = Math.max(source.exposedTimer || 0, 4);
    }
  };

  const originalGetTarget = getPlayerAbilityTarget;
  getPlayerAbilityTarget = function cardTarget(unit, ability) {
    const target = selectedTarget();
    if (ability.type === "protect") return target || unit;
    if (["allyBarrier", "purify", "rescue"].includes(ability.type)) return target?.team === unit.team ? target : unit;
    if (["guard", "renewal", "lastBastion", "whirlwind", "divineIntervention", "riposte", "shieldSelf", "disengage"].includes(ability.type)) return unit;
    return originalGetTarget(unit, ability);
  };

  const originalIsSelfTargeted = isSelfTargeted;
  isSelfTargeted = (ability) => ["guard", "renewal", "lastBastion", "whirlwind", "divineIntervention", "riposte", "shieldSelf", "disengage"].includes(ability.type) || originalIsSelfTargeted(ability);

  const originalInAbilityRange = inAbilityRange;
  inAbilityRange = function cardAbilityRange(unit, ability, target) {
    if (ability.type !== "protect") return originalInAbilityRange(unit, ability, target);
    if (!target) return false;
    if (target.team === unit.team) return true;
    return unitDistance(unit, target) <= (ability.enemyRange ?? 1);
  };

  const originalResolvePendingReposition = resolvePendingReposition;
  resolvePendingReposition = function cardReposition(row, col) {
    const pending = state.pendingReposition;
    const unit = pending ? unitById(pending.unitId) : null;
    const ability = unit && pending ? findAbility(unit, pending.abilityId) : null;
    const moved = originalResolvePendingReposition(row, col);
    if (moved && unit.gcd > 0) unit.gcd *= Math.max(0.7, 1 - (unit.stats.haste || 0));
    if (moved && ability?.id === "blink") unit.nextCastUninterruptible = true;
    return moved;
  };

  const originalUseAbility = useAbility;
  useAbility = function useCardAbility(unit, ability, target) {
    if (unit.stunTimer > 0) return false;
    if (unit.rootTimer > 0 && ["reposition", "charge", "pursuit", "disengage"].includes(ability.type)) return false;
    if (ability.cardSlot === "ultimate" && (unit.ultimateCharge || 0) < set.rules.ultimateChargeRequired) return false;
    if (ability.cardSlot === "ultimate") {
      unit.ultimateCharge = 0;
      if (unit.team === "ally") state.ultimateChargeByRole[unit.roleId] = 0;
      unit.resolvingUltimate = true;
    }
    const used = originalUseAbility(unit, ability, target);
    if (used && unit.gcd > 0) unit.gcd *= Math.max(0.7, 1 - (unit.stats.haste || 0));
    if (used && ability.castTime && unit.nextCastUninterruptible && unit.cast) {
      unit.cast.interruptible = false;
      unit.nextCastUninterruptible = false;
    }
    if (!used && ability.cardSlot === "ultimate") {
      unit.ultimateCharge = set.rules.ultimateChargeRequired;
      if (unit.team === "ally") state.ultimateChargeByRole[unit.roleId] = unit.ultimateCharge;
      unit.resolvingUltimate = false;
    }
    return used;
  };

  const originalResolveAbility = resolveAbility;
  resolveAbility = function resolveCardAbility(unit, ability, target) {
    const finish = () => { unit.resolvingUltimate = false; };
    if (ability.type === "damage") {
      let resolvedAbility = ability;
      let bonus = unit.nextDamageBonus || 0;
      if (ability.id === "aimed-shot" && target?.markTimer > 0) {
        bonus += 6;
        target.markTimer += 2;
      }
      if (ability.id === "lunge" && target?.markTimer > 0) bonus += 8;
      if (bonus > 0) {
        resolvedAbility = { ...ability, amount: ability.amount + bonus };
        unit.nextDamageBonus = 0;
      }
      originalResolveAbility(unit, resolvedAbility, target);
      if (ability.id === "crushing-blow" && target?.exposedTimer > 0) target.stunTimer = Math.max(target.stunTimer || 0, 2);
      if (ability.stunDuration && target) target.stunTimer = ability.stunDuration;
      if (ability.rootDuration && target) target.rootTimer = ability.rootDuration;
      finish();
      return;
    }
    if (ability.type === "guard") {
      unit.guardTimer = ability.duration;
      unit.guardMitigation = ability.mitigation;
    } else if (ability.type === "protect" && target?.team === unit.team) {
      if (target.id !== unit.id) state.bulwarks[unit.id] = { tankId: unit.id, allyId: target.id };
      target.shield += ability.shield || 0;
    } else if (ability.type === "protect" && target?.team !== unit.team) {
      if (ability.interrupt) interrupt(unit, target);
      damage(unit, target, ability.amount || 0);
    } else if (ability.type === "charge" && target) {
      const landing = findDashCell(unit, target);
      if (landing) unit.position = landing;
      damage(unit, target, ability.amount);
      target.targetId = unit.id;
      target.exposedTimer = Math.max(target.exposedTimer || 0, 5);
    } else if (ability.type === "lastBastion") {
      unit.shield += ability.temporaryHp || 0;
      unit.guardTimer = ability.duration;
      unit.guardMitigation = ability.mitigation;
      enemiesOf(unit).forEach((enemy) => { enemy.targetId = unit.id; });
    } else if (ability.type === "heal") {
      const protectedBonus = bulwarkForTarget(target?.id) ? 8 : 0;
      heal(unit, target || unit, ability.amount + protectedBonus);
    } else if (ability.type === "renewal") {
      alliesOf(unit).forEach((ally) => { ally.hot = { sourceId: unit.id, remaining: ability.healDuration || 4, tickTimer: 1, amount: ability.amount / (ability.healDuration || 4) }; });
    } else if (ability.type === "allyBarrier" && target?.team === unit.team) {
      target.guardTimer = ability.duration;
      target.guardMitigation = ability.mitigation;
    } else if (ability.type === "purify" && target?.team === unit.team) {
      const removedCondition = target.stunTimer > 0 || target.rootTimer > 0 || target.markTimer > 0 || target.exposedTimer > 0;
      target.stunTimer = 0; target.rootTimer = 0; target.markTimer = 0; heal(unit, target, ability.amount);
      target.exposedTimer = 0;
      if (removedCondition) chargeUltimate(unit, 10);
    } else if (ability.type === "rescue" && target?.team === unit.team) {
      for (let dr = -1; dr <= 1; dr += 1) for (let dc = -1; dc <= 1; dc += 1) {
        const row = unit.position.row + dr; const col = unit.position.col + dc;
        if ((dr || dc) && canOccupy(target, row, col) && isOwnHalf(target, row)) { target.position = { row, col }; dr = 2; break; }
      }
      target.stunTimer = 0;
      target.rootTimer = 0;
      target.shield += ability.shield || 0;
    } else if (ability.type === "divineIntervention") {
      alliesOf(unit).filter((ally) => !ally.dead).forEach((ally) => heal(unit, ally, ability.amount));
      const fallen = state.units.find((ally) => ally.team === unit.team && ally.dead);
      if (fallen) { fallen.dead = false; fallen.hp = Math.min(fallen.maxHp, ability.reviveHp || 35); }
    } else if (ability.type === "cleave" && target) {
      damage(unit, target, ability.amount);
      enemiesOf(unit).filter((enemy) => enemy.id !== target.id && unitDistance(enemy, target) <= 1).forEach((enemy) => damage(unit, enemy, ability.adjacentDamage || 0));
      if (target.exposedTimer > 0) {
        target.exposedTimer = 0;
        damage(unit, target, ability.amount);
      }
    } else if (ability.type === "riposte") {
      unit.guardTimer = ability.duration; unit.guardMitigation = ability.mitigation; unit.riposteDamage = ability.counterDamage;
    } else if (ability.type === "pursuit" && target) {
      const landing = findDashCell(unit, target); if (landing) unit.position = landing; target.rootTimer = ability.duration;
    } else if (ability.type === "whirlwind") {
      for (let hit = 0; hit < (ability.hits || 1); hit += 1) enemiesOf(unit).filter((enemy) => unitDistance(unit, enemy) <= ability.radius).forEach((enemy) => damage(unit, enemy, ability.amount));
    } else if (ability.type === "rowDamage" && target) {
      enemiesOf(unit).filter((enemy) => unitCells(enemy).some((cell) => cell.row === target.position.row)).forEach((enemy) => damage(unit, enemy, ability.amount));
    } else if (ability.type === "huntersMark" && target) {
      target.markedBy = unit.id; target.markTimer = ability.duration;
    } else if (ability.type === "disengage") {
      originalResolveAbility(unit, ability, target);
      unit.nextDamageBonus = 8;
    } else if (ability.type === "interrupt" && target) {
      const wasCasting = !!target.cast;
      originalResolveAbility(unit, ability, target);
      if (wasCasting && !target.cast) {
        chargeUltimate(unit, 15);
        if (hasPassive(unit, "arcane-momentum")) unit.nextCastSpeed = 0.25;
      }
    } else if (["rainOfArrows", "meteor"].includes(ability.type) && target) {
      const area = enemiesOf(unit).filter((enemy) => unitCells(enemy).some((cell) => Math.abs(cell.row - target.position.row) <= 1 && Math.abs(cell.col - target.position.col) <= 1));
      for (let hit = 0; hit < (ability.hits || 1); hit += 1) area.forEach((enemy) => damage(unit, enemy, ability.amount));
    } else if (ability.type === "shieldSelf") {
      unit.shield += ability.shield || 0;
    } else {
      originalResolveAbility(unit, ability, target);
    }
    finish();
  };

  const originalUpdateCombat = updateCombat;
  updateCombat = function updateCardCombat(dt) {
    state.healingBolts = (state.healingBolts || [])
      .map((bolt) => ({ ...bolt, remaining: bolt.remaining - dt }))
      .filter((bolt) => bolt.remaining > 0);
    Object.entries(state.bulwarks || {}).forEach(([tankId, link]) => {
      if (link.duration !== undefined && (link.duration -= dt) <= 0) delete state.bulwarks[tankId];
    });
    state.units.forEach((unit) => {
      unit.stunTimer = Math.max(0, (unit.stunTimer || 0) - dt);
      unit.rootTimer = Math.max(0, (unit.rootTimer || 0) - dt);
      unit.markTimer = Math.max(0, (unit.markTimer || 0) - dt);
      unit.exposedTimer = Math.max(0, (unit.exposedTimer || 0) - dt);
      if (unit.hot) {
        unit.hot.remaining -= dt; unit.hot.tickTimer -= dt;
        if (unit.hot.tickTimer <= 0) { const source = unitById(unit.hot.sourceId); if (source) heal(source, unit, unit.hot.amount); unit.hot.tickTimer += 1; }
        if (unit.hot.remaining <= 0) unit.hot = null;
      }
      if (unit.stunTimer > 0) unit.cast = null;
    });
    originalUpdateCombat(dt);
  };

  const originalUnitStatuses = unitStatuses;
  unitStatuses = function cardUnitStatuses(unit) {
    const statuses = originalUnitStatuses(unit);
    if (unit.exposedTimer > 0) statuses.push(`EXPOSED combo ${unit.exposedTimer.toFixed(1)}s`);
    if (unit.nextDamageBonus > 0) statuses.push(`EMPOWERED +${unit.nextDamageBonus}`);
    if (unit.nextCastUninterruptible) statuses.push("FOCUSED: next cast cannot be interrupted");
    return statuses;
  };

  aiTryAbilities = function cardAi(unit) {
    if (unit.isPlayer || unit.dead || unit.cast || unit.stunTimer > 0 || unit.gcd > 0 || unit.enemyBarrierTimer > 0) return;
    const ready = unitAbilities(unit).filter((ability) => (unit.cooldowns[ability.id] || 0) <= 0);
    const dangerous = dangerousCastTarget(unit);
    const interruptAbility = ready.find((ability) => ability.interrupt || ability.type === "interrupt");
    if (dangerous && interruptAbility && useAbility(unit, interruptAbility, dangerous)) return;
    if (unit.roleId === "healer") {
      const injured = alliesOf(unit).filter((ally) => ally.hp < ally.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      const healAbility = ready.find((ability) => ability.type === "heal");
      if (injured[0] && healAbility && useAbility(unit, healAbility, injured[0])) return;
    }
    const ultimate = ready.find((ability) => ability.cardSlot === "ultimate");
    if (ultimate && unit.ultimateCharge >= set.rules.ultimateChargeRequired && useAbility(unit, ultimate, isSelfTargeted(ultimate) ? unit : chooseEnemyTarget(unit))) return;
    const target = chooseEnemyTarget(unit);
    const offensive = ready.find((ability) => !["reposition", "protect", "rescue", "purify", "allyBarrier", "ultimate"].includes(ability.type));
    if (offensive) useAbility(unit, offensive, isSelfTargeted(offensive) ? unit : target);
  };

  const originalRenderAbilityBar = renderAbilityBar;
  renderAbilityBar = function renderCardAbilityBar() {
    originalRenderAbilityBar();
    const player = unitById(state.playerUnitId);
    if (!player) return;
    unitAbilities(player).forEach((ability, index) => {
      if (ability.cardSlot !== "ultimate") return;
      const button = ui.abilityBar.children[index];
      const ready = player.ultimateCharge >= set.rules.ultimateChargeRequired;
      if (!ready) {
        button.disabled = true;
        const small = button.querySelector("small");
        if (small) small.textContent = `Charge ${Math.floor(player.ultimateCharge || 0)} / ${set.rules.ultimateChargeRequired}`;
      }
    });
  };

  rollLootChoices = function rollCardLoot() {
    const enemyRoles = new Set(state.units.filter((unit) => unit.team === "enemy").map((unit) => roleToCard[unit.roleId]));
    const eligible = allCards.filter((card) => card.role === "all" || enemyRoles.has(card.role));
    const rates = set.dropRates[currentRoom().type];
    const choices = [];
    while (choices.length < currentRoomType().rollCount && choices.length < eligible.length) {
      const roll = Math.random() * 100;
      let sum = 0; let rarity = "Common";
      for (const name of rarityOrder) { sum += rates[name]; if (roll <= sum) { rarity = name; break; } }
      let pool = eligible.filter((card) => card.rarity === rarity && !choices.includes(card.id));
      if (!pool.length) pool = eligible.filter((card) => !choices.includes(card.id));
      if (!pool.length) break;
      choices.push(pool[Math.floor(Math.random() * pool.length)].id);
    }
    return choices;
  };

  equippedItemsForRole = (roleId) => loadoutCards(roleId).map((card) => items[card.id]);

  renderInventory = function renderCardInventory(slotRoot = ui.modalEquipSlots, cardRoot = ui.modalCollectionCards) {
    renderStaticCharacterSheets();
    const roleId = currentSheetRoleId();
    const cardRole = roleToCard[roleId];
    const loadout = state.cardEquipped[roleId];
    slotRoot.innerHTML = "";
    liveSlots.forEach((label) => {
      const slotKey = Object.keys(slotLabels).find((key) => slotLabels[key] === label);
      const item = items[loadout[slotKey]];
      const div = document.createElement("div");
      div.className = "slot";
      div.innerHTML = `<span>${label}</span><strong>${item?.name || "Empty"}</strong>`;
      slotRoot.append(div);
    });
    cardRoot.innerHTML = "";
    state.collection.forEach((entry) => {
      const card = cards[entry.itemId]; const item = items[entry.itemId];
      if (!card || !item) return;
      const article = document.createElement("article");
      article.className = `collection-card rarity-${item.rarity.toLowerCase()}`;
      article.innerHTML = `<div><h3>${item.name} x${entry.quantity}</h3>${item.keywords.length ? `<strong class="card-keywords" title="${item.keywordHelp}">${item.keywords.join(" · ")}</strong>` : ""}<p>${item.slot} · ${item.rarity} · ${item.description}</p></div>`;
      const toggle = document.createElement("button");
      const equipped = loadout[card.slot] === card.id;
      toggle.type = "button";
      toggle.textContent = equipped ? "Unequip" : "Equip";
      toggle.disabled = card.role !== "all" && card.role !== cardRole;
      toggle.addEventListener("click", () => {
        if (equipped) delete state.cardEquipped[roleId][card.slot];
        else state.cardEquipped[roleId][card.slot] = card.id;
        saveGame();
        renderInventory(slotRoot, cardRoot);
      });
      article.append(toggle);
      cardRoot.append(article);
    });
  };

  Object.values(encounterLibrary).forEach((encounter) => { encounter.lootPool = allCards.map((card) => card.id); });
  if (encounterLibrary.brackenjawCaptain) encounterLibrary.brackenjawCaptain.squareAttack.damage = 24;
  if (encounterLibrary.hollowrootMatriarch) encounterLibrary.hollowrootMatriarch.squareAttack.damage = 28;
  if (encounterLibrary.goblinTaskmaster) encounterLibrary.goblinTaskmaster.squareAttack.damage = 25;
  if (encounterLibrary.warrenKing) encounterLibrary.warrenKing.squareAttack.damage = 30;

  saveGame();
  renderRoleScreen();
  renderInventory(ui.equipSlots, ui.collectionCards);
})();
