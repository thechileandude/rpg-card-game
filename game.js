const saveKey = "card-combat-rpg-v1";

// Range is Chebyshev distance on the grid, measured cell-to-cell.
// 1 = must be adjacent, 2 = one rank back, 3 = anywhere on the board.
const defaultRange = 3;
const maxRange = 3;

// Movement is a resource, not a free teleport. Each unit steps ONE square at a
// time (Chebyshev, diagonals included) and then waits out its own cadence.
// Both numbers are stats so utility gear can modify them.
const defaultMoveCooldown = 2.5;
const defaultMoveRange = 1;
const minMoveCooldown = 0.4;

const roles = {
  tank: {
    id: "tank",
    name: "Tank",
    maxHp: 170,
    rangeBand: "Melee",
    // Interceptor: uses both ally rows and repositions fastest, so it can drop
    // back and body-block for the healer instead of only holding the front.
    moveCooldown: 1.5,
    auto: { type: "damage", amount: 5, interval: 0.5, range: 1, description: "Auto Attack, 5 damage every 0.5s, melee range" },
    abilities: [
      // The Tank's whole loop: read the cast, land the interrupt, get rewarded for
      // it. The refund keeps the rhythm going, the brace turns good reads into
      // survivability so interrupting IS tanking rather than a side job.
      { id: "shieldSlam", name: "Shield Slam", type: "damage", amount: 16, interrupt: true, cooldown: 4, range: 2, interruptRefund: 1.5, interruptGuard: { duration: 3, mitigation: 0.55 }, text: "16 damage and interrupt, reaches one rank past melee. A landed interrupt refunds 1.5s of its cooldown and braces you for 45% less damage for 3s." },
      { id: "taunt", name: "Taunt", type: "taunt", amount: 8, cooldown: 6, range: 2, text: "8 damage and force enemies onto Tank, range 2" },
      { id: "bulwark", name: "Bulwark", type: "bulwark", heal: 18, cooldown: 10, range: 3, text: "Enemy target: Tank self-heals +18 HP. Ally target: Tank self-heals +18 HP and adds a shield link to that ally" },
      { id: "fortress", name: "Fortress", type: "healSelf", amount: 45, cooldown: 15, text: "+45 HP" }
    ]
  },
  healer: {
    id: "healer",
    name: "Healer",
    maxHp: 125,
    rangeBand: "Ranged",
    moveCooldown: 3,
    // 10/0.5s was 20 HP/s, which out-healed an entire party's damage on its own
    // once range gating meant less of that damage was landing. 5 keeps healers
    // strong without making a focused healer unkillable.
    auto: { type: "heal", amount: 5, interval: 0.5, range: 3, description: "Auto Heal, +5 HP every 0.5s, any range" },
    abilities: [
      { id: "mend", name: "Mend", type: "heal", amount: 28, cooldown: 4, range: 3, text: "+28 HP, instant" },
      { id: "interrupt", name: "Interrupt", type: "interrupt", cooldown: 8, range: 3, text: "Interrupt selected enemy cast, any range" },
      { id: "barrier", name: "Barrier", type: "barrier", cooldown: 10, castTime: 1.5, interruptible: true, duration: 5, range: 3, text: "1.5s cast. Ally: half damage for 5s. Enemy: cannot act for 5s, broken by damage" },
      { id: "renewal", name: "Renewal", type: "healAll", amount: 30, cooldown: 15, castTime: 1, interruptible: true, text: "1s cast, +30 HP to all allies" }
    ]
  },
  dps: {
    id: "dps",
    name: "Melee",
    maxHp: 140,
    rangeBand: "Melee",
    moveCooldown: 1.8,
    // Highest single-target damage on the team, but it has to get there.
    auto: { type: "damage", amount: 7, interval: 0.5, range: 1, description: "Auto Attack, 7 damage every 0.5s, melee range" },
    abilities: [
      // Dive window: land, hit, get ONE more ability off, then you are yanked home.
      // The cooldown does not start until you land back, so the window is the real cost.
      { id: "lunge", name: "Lunge", type: "dash", amount: 26, cooldown: 5, range: 3, followUpActions: 1, diveWindow: 4, noGcd: true, text: "Dive to any target and deal 26 damage, off the global cooldown. You get 1 more ability before snapping back to where you started. Cooldown begins on landing back." },
      { id: "interrupt", name: "Kick", type: "damage", amount: 10, interrupt: true, cooldown: 8, range: 1, text: "10 damage and interrupt, melee range" },
      { id: "guard", name: "Guard", type: "guard", cooldown: 10, duration: 4, mitigation: 0.5, text: "Take half damage for 4s" },
      { id: "whirlwind", name: "Whirlwind", type: "damageAll", amount: 24, cooldown: 15, range: 1, text: "24 damage to every ADJACENT enemy" }
    ]
  },
  caster: {
    id: "caster",
    name: "Caster",
    maxHp: 115,
    rangeBand: "Ranged",
    moveCooldown: 3,
    // Biggest hits in the game, but rooted mid-cast and the easiest to shut down.
    auto: { type: "damage", amount: 4, interval: 0.5, range: 3, description: "Auto Attack, 4 damage every 0.5s, any range" },
    abilities: [
      { id: "arcBolt", name: "Arc Bolt", type: "damage", amount: 32, cooldown: 5, castTime: 1.2, interruptible: true, range: 3, text: "1.2s cast, 32 damage. You cannot move while casting." },
      { id: "interrupt", name: "Interrupt", type: "interrupt", cooldown: 8, range: 3, text: "Interrupt selected enemy cast, any range" },
      { id: "focusWard", name: "Focus Ward", type: "healSelf", amount: 22, cooldown: 12, text: "+22 HP, instant" },
      { id: "emberWave", name: "Ember Wave", type: "damageAll", amount: 20, cooldown: 15, castTime: 1.4, interruptible: true, range: 3, text: "1.4s cast, 20 damage to every enemy" }
    ]
  },
  hunter: {
    id: "hunter",
    name: "Hunter",
    maxHp: 130,
    rangeBand: "Ranged",
    moveCooldown: 1.6,
    // Safest sustained damage on the board, as long as nothing gets next to it.
    // 0.5 plus 120 HP made it free food for any melee that closed; 0.6 and 130
    // leaves the penalty meaningful without making the role a liability.
    pointBlankPenalty: 0.6,
    auto: { type: "damage", amount: 6, interval: 0.5, range: 3, description: "Auto Shot, 6 damage every 0.5s, any range" },
    abilities: [
      { id: "aimedShot", name: "Aimed Shot", type: "damage", amount: 20, cooldown: 4, range: 3, text: "20 damage at any range" },
      { id: "interrupt", name: "Concussive Shot", type: "damage", amount: 8, interrupt: true, cooldown: 8, range: 3, text: "8 damage and interrupt, at ANY range" },
      { id: "disengage", name: "Disengage", type: "disengage", cooldown: 8, duration: 3, mitigation: 0.35, text: "Leap back one rank and take 35% less damage for 3s" },
      { id: "volley", name: "Volley", type: "damageAll", amount: 18, cooldown: 15, range: 3, text: "18 damage to every enemy" }
    ]
  }
};

const slots = ["Helm", "Chest", "Cape", "Hands", "Belt", "Legs", "Feet", "Ring", "Earring", "Trinket", "Main Weapon", "Offhand"];
const allRoles = ["tank", "healer", "dps", "caster", "hunter"];

const items = {
  ironHelm: {
    id: "ironHelm",
    name: "Iron Helm",
    slot: "Helm",
    rarity: "Common",
    stats: { maxHp: 10 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_tank"],
    tradeable: true,
    description: "+10 Max HP",
    artReference: "dented iron helm"
  },
  leatherGloves: {
    id: "leatherGloves",
    name: "Leather Gloves",
    slot: "Hands",
    rarity: "Common",
    stats: { abilityPower: 2 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_dps"],
    tradeable: true,
    description: "+2 Ability Power",
    artReference: "stitched leather gloves"
  },
  knightsCape: {
    id: "knightsCape",
    name: "Knight's Cape",
    slot: "Cape",
    rarity: "Uncommon",
    stats: { maxHp: 16 },
    abilityModifiers: [],
    allowedRoles: ["tank"],
    sourceEnemies: ["training_tank"],
    tradeable: true,
    description: "+16 Max HP",
    artReference: "blue field cape"
  },
  guardianRing: {
    id: "guardianRing",
    name: "Guardian Ring",
    slot: "Ring",
    rarity: "Rare",
    stats: { cooldownReduction: 0.08 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_healer"],
    tradeable: true,
    description: "+8% Cooldown Reduction",
    artReference: "silver ring with shield mark"
  },
  rustfangSword: {
    id: "rustfangSword",
    name: "Rustfang Sword",
    slot: "Main Weapon",
    rarity: "Common",
    stats: { autoDamage: 2 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_dps"],
    tradeable: true,
    description: "+2 Auto Damage",
    artReference: "notched iron sword"
  },
  dawnstaff: {
    id: "dawnstaff",
    name: "Dawnstaff",
    slot: "Main Weapon",
    rarity: "Uncommon",
    stats: { abilityPower: 3 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_healer"],
    tradeable: true,
    description: "+3 Ability Power",
    artReference: "pale wood staff"
  },
  woodenShield: {
    id: "woodenShield",
    name: "Wooden Shield",
    slot: "Offhand",
    rarity: "Common",
    stats: { maxHp: 12 },
    abilityModifiers: [],
    allowedRoles: ["tank"],
    sourceEnemies: ["training_tank"],
    tradeable: true,
    description: "+12 Max HP",
    artReference: "round wooden shield"
  },
  lanternOfEmbers: {
    id: "lanternOfEmbers",
    name: "Lantern of Embers",
    slot: "Offhand",
    rarity: "Common",
    stats: { abilityPower: 2 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_caster", "training_healer"],
    tradeable: true,
    description: "+2 Ability Power",
    artReference: "small ember lantern"
  },
  bucklerCharm: {
    id: "bucklerCharm",
    name: "Buckler Charm",
    slot: "Offhand",
    rarity: "Common",
    stats: { maxHp: 6, cooldownReduction: 0.02 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_tank", "training_hunter"],
    tradeable: true,
    description: "+6 Max HP and +2% Cooldown Reduction",
    artReference: "pocket buckler charm"
  },
  balancedTotem: {
    id: "balancedTotem",
    name: "Balanced Totem",
    slot: "Offhand",
    rarity: "Uncommon",
    stats: { autoDamage: 1, autoHealing: 1, abilityPower: 1 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_dps", "training_healer"],
    tradeable: true,
    description: "+1 Auto Damage, +1 Auto Healing, and +1 Ability Power",
    artReference: "carved balanced totem"
  },
  swiftBoots: {
    id: "swiftBoots",
    name: "Swift Boots",
    slot: "Feet",
    rarity: "Common",
    stats: { autoDamage: 1, abilityPower: 1 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_dps", "training_healer"],
    tradeable: true,
    description: "+1 Auto Damage and +1 Ability Power",
    artReference: "travel boots"
  },
  healerRing: {
    id: "healerRing",
    name: "Healer Ring",
    slot: "Ring",
    rarity: "Uncommon",
    stats: { autoHealing: 2 },
    abilityModifiers: [],
    allowedRoles: ["healer"],
    sourceEnemies: ["training_healer"],
    tradeable: true,
    description: "+2 Auto Healing",
    artReference: "green glass ring"
  },
  adventurersVest: {
    id: "adventurersVest",
    name: "Adventurer's Vest",
    slot: "Chest",
    rarity: "Common",
    stats: { maxHp: 8, abilityPower: 1 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_tank", "training_dps", "training_healer"],
    tradeable: true,
    description: "+8 Max HP and +1 Ability Power",
    artReference: "patched travel vest"
  },
  steadyBelt: {
    id: "steadyBelt",
    name: "Steady Belt",
    slot: "Belt",
    rarity: "Common",
    stats: { maxHp: 6, autoDamage: 1 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_dps"],
    tradeable: true,
    description: "+6 Max HP and +1 Auto Damage",
    artReference: "plain buckled belt"
  },
  focusCharm: {
    id: "focusCharm",
    name: "Focus Charm",
    slot: "Trinket",
    rarity: "Uncommon",
    stats: { abilityPower: 2, cooldownReduction: 0.03 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_healer", "training_caster"],
    tradeable: true,
    description: "+2 Ability Power and +3% Cooldown Reduction",
    artReference: "small brass charm"
  },
  quicksilverEarring: {
    id: "quicksilverEarring",
    name: "Quicksilver Earring",
    slot: "Earring",
    rarity: "Uncommon",
    stats: { cooldownReduction: 0.05 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_hunter"],
    tradeable: true,
    description: "+5% Cooldown Reduction",
    artReference: "bright silver earring"
  },
  balancedRing: {
    id: "balancedRing",
    name: "Balanced Ring",
    slot: "Ring",
    rarity: "Common",
    stats: { autoDamage: 1, autoHealing: 1 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_dps", "training_healer"],
    tradeable: true,
    description: "+1 Auto Damage and +1 Auto Healing",
    artReference: "simple bronze ring"
  },
  wanderersLeggings: {
    id: "wanderersLeggings",
    name: "Wanderer's Leggings",
    slot: "Legs",
    rarity: "Common",
    stats: { maxHp: 7, cooldownReduction: 0.02 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_tank", "training_hunter"],
    tradeable: true,
    description: "+7 Max HP and +2% Cooldown Reduction",
    artReference: "weathered cloth leggings"
  },
  emberPendant: {
    id: "emberPendant",
    name: "Ember Pendant",
    slot: "Trinket",
    rarity: "Rare",
    stats: { abilityPower: 4 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_caster"],
    tradeable: true,
    description: "+4 Ability Power",
    artReference: "warm red pendant"
  },
  oakheartCape: {
    id: "oakheartCape",
    name: "Oakheart Cape",
    slot: "Cape",
    rarity: "Uncommon",
    stats: { maxHp: 10, autoHealing: 1 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["training_tank", "training_healer"],
    tradeable: true,
    description: "+10 Max HP and +1 Auto Healing",
    artReference: "green cape with oak clasp"
  },
  brackenjawSigil: {
    id: "brackenjawSigil",
    name: "Brackenjaw Sigil",
    slot: "Trinket",
    rarity: "Rare",
    stats: { maxHp: 14, abilityPower: 2 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["brackenjaw_captain"],
    tradeable: true,
    description: "+14 Max HP and +2 Ability Power",
    artReference: "cracked captain sigil"
  },
  captainsBulwark: {
    id: "captainsBulwark",
    name: "Captain's Bulwark",
    slot: "Offhand",
    rarity: "Rare",
    stats: { maxHp: 16, cooldownReduction: 0.03 },
    abilityModifiers: [],
    allowedRoles: allRoles,
    sourceEnemies: ["brackenjaw_captain"],
    tradeable: true,
    description: "+16 Max HP and +3% Cooldown Reduction",
    artReference: "scarred command buckler"
  }
};

// --- Utility gear: the cards that grant MOVEMENT -----------------------------
// Nothing repositions on its own any more. If you want to move mid-fight, you
// equip a card that lets you. moveCooldown is additive and negative, moveRange
// is additive, so movement gear stacks with whatever grants the step.
items.striderBoots = {
  id: "striderBoots",
  name: "Strider Boots",
  slot: "Feet",
  rarity: "Uncommon",
  stats: { moveCooldown: -1.5 },
  abilityModifiers: [],
  allowedRoles: allRoles,
  sourceEnemies: ["training_dps"],
  tradeable: true,
  description: "Reposition abilities come back 1.5s sooner",
  artReference: "worn travelling boots"
};

items.vaultingCloak = {
  id: "vaultingCloak",
  name: "Vaulting Cloak",
  slot: "Cape",
  rarity: "Rare",
  stats: { moveRange: 1 },
  abilityModifiers: [],
  allowedRoles: allRoles,
  sourceEnemies: ["training_dps"],
  tradeable: true,
  description: "+1 range on reposition abilities",
  artReference: "billowing short cloak"
};

items.pathfindersBelt = {
  id: "pathfindersBelt",
  name: "Pathfinder's Belt",
  slot: "Belt",
  rarity: "Uncommon",
  stats: {},
  abilityModifiers: [],
  grantsAbility: {
    id: "reposition",
    name: "Step",
    type: "reposition",
    moveRange: 1,
    cooldown: 6,
    text: "Move one square. Stays inside your own half."
  },
  allowedRoles: allRoles,
  sourceEnemies: ["training_tank"],
  tradeable: true,
  description: "Grants Step: move one square, 6s cooldown",
  artReference: "traveller's belt hung with rope"
};

items.warddancersSigil = {
  id: "warddancersSigil",
  name: "Warddancer's Sigil",
  slot: "Trinket",
  rarity: "Rare",
  stats: {},
  abilityModifiers: [],
  grantsAbility: {
    id: "warddance",
    name: "Warddance",
    type: "reposition",
    moveRange: 2,
    cooldown: 10,
    text: "Move up to two squares. Stays inside your own half."
  },
  allowedRoles: allRoles,
  sourceEnemies: ["brackenjaw"],
  tradeable: true,
  description: "Grants Warddance: move up to two squares, 10s cooldown",
  artReference: "spinning brass sigil"
};

items.shadowstepCharm = {
  id: "shadowstepCharm",
  name: "Shadowstep Charm",
  slot: "Earring",
  rarity: "Legendary",
  stats: {},
  abilityModifiers: [],
  grantsAbility: {
    id: "shadowstep",
    name: "Shadowstep",
    type: "reposition",
    moveRange: 3,
    cooldown: 18,
    ignoreZones: true,
    text: "Step to ANY square on the board, ignoring the midline. 18s cooldown."
  },
  allowedRoles: allRoles,
  sourceEnemies: ["warren_king"],
  tradeable: true,
  description: "Grants Shadowstep: step to any square, ignoring zone rules",
  artReference: "smoke-wisped black stud"
};

const standardLootPool = Object.keys(items).filter((itemId) => !["brackenjawSigil", "captainsBulwark", "shadowstepCharm", "warddancersSigil"].includes(itemId));

const bossLootPool = ["brackenjawSigil", "captainsBulwark", "guardianRing", "emberPendant", "focusCharm", "dawnstaff", "warddancersSigil", "shadowstepCharm"];

// Room types drive the loot economy (spec section 10). Roll N, keep M.
const roomTypes = {
  trash: { id: "trash", label: "Mob Pull", rollCount: 3, keepCount: 1 },
  miniboss: { id: "miniboss", label: "Miniboss", rollCount: 4, keepCount: 2 },
  boss: { id: "boss", label: "Final Boss", rollCount: 6, keepCount: 3 }
};

// Encounter definitions are a library. The dungeon below decides which ones a run uses.
const encounterLibrary = {
  pull1: {
    id: "pull1",
    name: "Training Pull",
    enemyHpMultiplier: 1,
    lootPool: standardLootPool
  },
  pull2: {
    id: "pull2",
    name: "Four-Pack Ambush",
    enemyHpMultiplier: 0.88,
    enemyDamageMultiplier: 0.7,
    lootPool: standardLootPool,
    enemies: [
      { roleId: "caster", name: "Enemy Caster", slotKey: "enemyDamageA", positionKey: "enemyDamageBackA" },
      { roleId: "healer", name: "Enemy Healer", slotKey: "enemyHealer" },
      { roleId: "tank", name: "Enemy Tank", slotKey: "enemyTank" },
      { roleId: "hunter", name: "Enemy Hunter", slotKey: "enemyDamageB", positionKey: "enemyDamageFrontB" }
    ]
  },
  pull3: {
    id: "pull3",
    name: "Warren Skirmish",
    enemyHpMultiplier: 1.08,
    lootPool: standardLootPool,
    // Three enemies against a three-person party. Four-packs are the Ambush's job.
    enemies: [
      { roleId: "hunter", name: "Warren Archer", slotKey: "enemyDamageA", positionKey: "enemyDamageBackC" },
      { roleId: "healer", name: "Warren Ratcaller", slotKey: "enemyHealer" },
      { roleId: "tank", name: "Warren Brute", slotKey: "enemyTank" }
    ]
  },
  pull4: {
    id: "pull4",
    name: "Warren Press-gang",
    enemyHpMultiplier: 0.88,
    enemyDamageMultiplier: 0.7,
    lootPool: standardLootPool,
    enemies: [
      { roleId: "caster", name: "Warren Hexer", slotKey: "enemyDamageA", positionKey: "enemyDamageBackA" },
      { roleId: "healer", name: "Warren Ratcaller", slotKey: "enemyHealer" },
      { roleId: "tank", name: "Warren Brute", slotKey: "enemyTank" },
      { roleId: "dps", name: "Warren Cutter", slotKey: "enemyDamageB", positionKey: "enemyDamageFrontC" }
    ]
  },

  brackenjawCaptain: {
    id: "brackenjawCaptain",
    name: "Brackenjaw Captain",
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 0.85,
    lootPool: bossLootPool,
    squareAttack: { interval: 7, delay: 2.4, damage: 22, sourceName: "Brackenjaw", castName: "Brackenjaw Crush" },
    enemies: [
      { roleId: "caster", name: "Ashcaller", slotKey: "enemyDamageA", positionKey: "enemyDamageBackA", hpMultiplier: 1.05 },
      { roleId: "healer", name: "Dawn Acolyte", slotKey: "enemyHealer", hpMultiplier: 1.15 },
      { roleId: "tank", name: "Brackenjaw", slotKey: "enemyBoss", positionKey: "enemyBoss", width: 2, hpMultiplier: 1.35 }
    ]
  },
  hollowrootMatriarch: {
    id: "hollowrootMatriarch",
    name: "Hollowroot Matriarch",
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 0.85,
    lootPool: bossLootPool,
    squareAttack: { interval: 7, delay: 2.4, damage: 24, sourceName: "Hollowroot", castName: "Root Rupture" },
    respawnAdds: { delay: 17, sourceName: "Hollowroot" },
    enemies: [
      { roleId: "caster", name: "Rootcaller", slotKey: "enemyDamageA", positionKey: "enemyDamageBackA", hpMultiplier: 1.1 },
      { roleId: "healer", name: "Sap Tender", slotKey: "enemyHealer", hpMultiplier: 1.2 },
      { roleId: "tank", name: "Hollowroot", slotKey: "enemyBoss", positionKey: "enemyBoss", width: 2, hpMultiplier: 1.45 }
    ]
  },
  goblinTaskmaster: {
    id: "goblinTaskmaster",
    name: "Goblin Taskmaster",
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 0.85,
    lootPool: bossLootPool,
    squareAttack: { interval: 7, delay: 2.4, damage: 22, sourceName: "Taskmaster", castName: "Lash the Ground" },
    respawnAdds: { delay: 17, sourceName: "Taskmaster" },
    enemies: [
      { roleId: "hunter", name: "Pressgang Archer", slotKey: "enemyDamageA", positionKey: "enemyDamageBackC", hpMultiplier: 1.05 },
      { roleId: "healer", name: "Warren Ratcaller", slotKey: "enemyHealer", hpMultiplier: 1.15 },
      { roleId: "tank", name: "Taskmaster", slotKey: "enemyBoss", positionKey: "enemyBoss", width: 2, hpMultiplier: 1.45 }
    ]
  },
  warrenKing: {
    id: "warrenKing",
    name: "The Warren King",
    enemyHpMultiplier: 1,
    enemyDamageMultiplier: 0.7,
    lootPool: bossLootPool,
    squareAttack: { interval: 6.5, delay: 2.4, damage: 30, sourceName: "The Warren King", castName: "Throneshatter" },
    respawnAdds: { delay: 24, sourceName: "The Warren King" },
    // Hard cast. Let it finish and the King's damage doubles for the rest of the fight.
    enrage: { firstAt: 22, interval: 24, castTime: 2.8, castName: "Crown of Fury", multiplier: 2, sourceName: "The Warren King" },
    enemies: [
      { roleId: "caster", name: "Warren Vizier", slotKey: "enemyDamageA", positionKey: "enemyDamageBackA", hpMultiplier: 1.1 },
      { roleId: "healer", name: "Warren Bonemender", slotKey: "enemyHealer", hpMultiplier: 1.25 },
      { roleId: "hunter", name: "Kingsguard Archer", slotKey: "enemyDamageB", positionKey: "enemyDamageBackC", hpMultiplier: 1.05 },
      { roleId: "tank", name: "The Warren King", slotKey: "enemyBoss", positionKey: "enemyBoss", width: 2, hpMultiplier: 1.4 }
    ]
  }
};

// Run structure (spec section 11). Trash slots shuffle, boss slots are fixed.
// Each slot names its own pool, so a run can call for a specific SHAPE of fight
// (a three-pack, then a four-pack) rather than just "some trash".
const dungeons = {
  darkwoodWarren: {
    id: "darkwoodWarren",
    name: "Darkwood Warren",
    sequence: [
      { type: "trash", pool: "threePack" },
      { type: "miniboss", pool: "miniboss" },
      { type: "trash", pool: "fourPack" },
      { type: "boss", pool: "boss" }
    ],
    pools: {
      threePack: ["pull1", "pull3"],
      fourPack: ["pull2", "pull4"],
      miniboss: ["brackenjawCaptain", "goblinTaskmaster", "hollowrootMatriarch"],
      boss: ["warrenKing"]
    }
  }
};

const defaultDungeonId = "darkwoodWarren";

const allyFormation = [
  { roleId: "tank", name: "Ally Tank", slotKey: "allyTank" },
  { roleId: "dps", name: "Ally DPS", slotKey: "allyDps" },
  { roleId: "healer", name: "Ally Healer", slotKey: "allyHealer" }
];

const allyDpsVariants = [
  { roleId: "dps", name: "Ally Melee", positionKey: "allyDps" },
  { roleId: "caster", name: "Ally Caster", positionKey: "allyDpsRanged" },
  { roleId: "hunter", name: "Ally Hunter", positionKey: "allyDpsRanged" }
];

const enemyDpsVariants = [
  { roleId: "dps", name: "Enemy DPS", lane: "front" },
  { roleId: "caster", name: "Enemy Caster", lane: "back" },
  { roleId: "hunter", name: "Enemy Hunter", lane: "back" }
];

const enemyFormation = [
  { roleId: "healer", name: "Enemy Healer", slotKey: "enemyHealer" },
  { roleId: "tank", name: "Enemy Tank", slotKey: "enemyTank" },
  { roleId: "dps", name: "Enemy Damage", slotKey: "enemyDamageA" }
];

const gridRows = 4;
const gridCols = 4;

const positions = {
  enemyHealer: { row: 0, col: 1 },
  enemyTank: { row: 1, col: 0 },
  enemyBoss: { row: 1, col: 1 },
  enemyDamageBackA: { row: 0, col: 0 },
  enemyDamageBackB: { row: 0, col: 2 },
  enemyDamageBackC: { row: 0, col: 3 },
  enemyDamageFrontA: { row: 1, col: 1 },
  enemyDamageFrontB: { row: 1, col: 2 },
  enemyDamageFrontC: { row: 1, col: 3 },
  allyTank: { row: 2, col: 0 },
  allyDps: { row: 2, col: 1 },
  allyDpsFlank: { row: 2, col: 2 },
  allyDpsRanged: { row: 3, col: 2 },
  allyHealer: { row: 3, col: 1 }
};

const ui = {
  roleScreen: document.querySelector("#roleScreen"),
  battleScreen: document.querySelector("#battleScreen"),
  lootScreen: document.querySelector("#lootScreen"),
  equipScreen: document.querySelector("#equipScreen"),
  roleFormation: document.querySelector("#roleFormation"),
  rolePlayerStatsPanel: document.querySelector("#rolePlayerStatsPanel"),
  roleCards: document.querySelector("#roleCards"),
  enemyPreview: document.querySelector("#enemyPreview"),
  minibossButton: document.querySelector("#minibossButton"),
  battlefield: document.querySelector("#battlefield"),
  targetLines: document.querySelector("#targetLines"),
  countdownOverlay: document.querySelector("#countdownOverlay"),
  resultOverlay: document.querySelector("#resultOverlay"),
  currentTargetText: document.querySelector("#currentTargetText"),
  targetDetail: document.querySelector("#targetDetail"),
  abilityBar: document.querySelector("#abilityBar"),
  playerStatsPanel: document.querySelector("#playerStatsPanel"),
  meterList: document.querySelector("#meterList"),
  encounterLabel: document.querySelector("#encounterLabel"),
  battleTitle: document.querySelector("#battleTitle"),
  lootPlayerStatsPanel: document.querySelector("#lootPlayerStatsPanel"),
  lootChoices: document.querySelector("#lootChoices"),
  lootPrompt: document.querySelector("#lootPrompt"),
  lootConfirmButton: document.querySelector("#lootConfirmButton"),
  runScreen: document.querySelector("#runScreen"),
  runTrack: document.querySelector("#runTrack"),
  runTitle: document.querySelector("#runTitle"),
  runSummary: document.querySelector("#runSummary"),
  runCards: document.querySelector("#runCards"),
  returnToCampButton: document.querySelector("#returnToCampButton"),
  equipPlayerStatsPanel: document.querySelector("#equipPlayerStatsPanel"),
  equipSlots: document.querySelector("#equipSlots"),
  collectionCards: document.querySelector("#collectionCards"),
  modalEquipSlots: document.querySelector("#modalEquipSlots"),
  modalCharacterSheet: document.querySelector("#modalCharacterSheet"),
  modalCollectionCards: document.querySelector("#modalCollectionCards"),
  inventoryDialog: document.querySelector("#inventoryDialog"),
  closeInventory: document.querySelector("#closeInventory"),
  roleReadyButton: document.querySelector("#roleReadyButton"),
  newRunButton: document.querySelector("#newRunButton"),
  nextFightButton: document.querySelector("#nextFightButton"),
  replayButton: document.querySelector("#replayButton"),
  openInventoryFromRole: document.querySelector("#openInventoryFromRole"),
  openInventoryFromBattle: document.querySelector("#openInventoryFromBattle")
};

const state = {
  screen: "role",
  selectedRole: null,
  selectedTargetId: null,
  units: [],
  meters: {},
  playerUnitId: null,
  countdown: 0,
  combatActive: false,
  result: null,
  run: null,
  encounter: null,
  lootChoices: [],
  lootPicks: [],
  collection: [],
  equipped: {},
  lastTime: 0,
  renderAccumulator: 0,
  bulwarks: {},
  allyDpsVariant: null,
  enemyDpsVariants: null,
  pendingReposition: null,
  squareAttackTimer: 0,
  squareAttacks: [],
  respawnQueue: [],
  enrageTimer: 0,
  fightElapsed: 0,
  softEnrageStacks: 0
};

function loadSave() {
  const saved = JSON.parse(localStorage.getItem(saveKey) || "{}");
  state.collection = Array.isArray(saved.collection) ? saved.collection : [];
  state.equipped = saved.equipped || {};
  state.selectedRole = saved.selectedRole || null;
  state.run = isValidRun(saved.run) ? saved.run : null;
}

function saveGame() {
  localStorage.setItem(saveKey, JSON.stringify({
    collection: state.collection,
    equipped: state.equipped,
    selectedRole: state.selectedRole,
    run: state.run
  }));
}

// A saved run from an older build (or a renamed encounter) must not wedge the game.
function isValidRun(run) {
  if (!run || !dungeons[run.dungeonId] || !Array.isArray(run.sequence) || !run.sequence.length) return false;
  if (typeof run.roomIndex !== "number" || run.roomIndex < 0 || run.roomIndex >= run.sequence.length) return false;
  // A run saved under an older dungeon layout must not resume into the wrong shape.
  if (run.sequence.length !== dungeons[run.dungeonId].sequence.length) return false;
  return run.sequence.every((room) => roomTypes[room.type] && encounterLibrary[room.encounterId]);
}

function showScreen(name) {
  state.screen = name;
  [ui.roleScreen, ui.battleScreen, ui.lootScreen, ui.equipScreen, ui.runScreen].forEach((screen) => screen?.classList.add("hidden"));
  const key = `${name}Screen`;
  ui[key].classList.remove("hidden");
}

function buildRunSequence(dungeon) {
  const used = [];
  return dungeon.sequence.map((slot) => {
    const pool = dungeon.pools[slot.pool] || dungeon.pools[slot.type] || [];
    // Prefer something this run has not used yet, so a short dungeon still varies.
    const unused = pool.filter((id) => !used.includes(id));
    const encounterId = randomEntry(unused.length ? unused : pool) || pool[0];
    used.push(encounterId);
    return { type: slot.type, encounterId, cleared: false };
  });
}

function startRun(dungeonId = defaultDungeonId) {
  const dungeon = dungeons[dungeonId];
  state.run = {
    dungeonId,
    sequence: buildRunSequence(dungeon),
    roomIndex: 0,
    secured: [],
    roomsCleared: 0,
    wipes: 0,
    totals: { damage: 0, healing: 0, interrupts: 0, cc: 0 }
  };
  saveGame();
  enterRoom(0);
}

function currentRoom() {
  return state.run?.sequence[state.run.roomIndex] || null;
}

function currentRoomType() {
  return roomTypes[currentRoom()?.type] || roomTypes.trash;
}

function currentEncounter() {
  return state.encounter || encounterLibrary[currentRoom()?.encounterId] || encounterLibrary.pull1;
}

function isFinalRoom() {
  return !!state.run && state.run.roomIndex >= state.run.sequence.length - 1;
}

function rollAllyDpsVariant(previous = state.allyDpsVariant) {
  const choices = previous
    ? allyDpsVariants.filter((variant) => variant.roleId !== previous.roleId)
    : allyDpsVariants;
  return choices[Math.floor(Math.random() * choices.length)];
}

function rollEnemyDpsVariants() {
  return [enemyDpsVariants[Math.floor(Math.random() * enemyDpsVariants.length)]];
}

function currentAllyFormation() {
  const variant = state.allyDpsVariant || allyDpsVariants[0];
  return allyFormation.map((entry) => (entry.slotKey === "allyDps" ? { ...entry, roleId: variant.roleId, name: variant.name, positionKey: variant.positionKey } : entry));
}

function currentEnemyFormation(encounter = null) {
  if (encounter?.enemies) return encounter.enemies;
  const variants = state.enemyDpsVariants || [enemyDpsVariants[1]];
  let damageIndex = 0;
  return enemyFormation.map((entry) => {
    if (!entry.slotKey.startsWith("enemyDamage")) return entry;
    const variant = variants[damageIndex] || enemyDpsVariants[0];
    const suffix = damageIndex === 0 ? "A" : "B";
    damageIndex += 1;
    return {
      ...entry,
      roleId: variant.roleId,
      name: variant.name,
      positionKey: `enemyDamage${variant.lane === "back" ? "Back" : "Front"}${suffix}`
    };
  });
}

function roleStats(roleId, team) {
  const base = roles[roleId];
  const stats = {
    maxHp: base.maxHp,
    autoDamage: 0,
    autoHealing: 0,
    abilityPower: 0,
    cooldownReduction: 0,
    moveCooldown: 0,
    moveRange: defaultMoveRange
  };
  if (team !== "ally") return stats;
  Object.values(state.equipped).forEach((itemId) => {
    const item = items[itemId];
    if (!item || !item.allowedRoles.includes(roleId)) return;
    Object.entries(item.stats).forEach(([key, value]) => {
      const statKey = key === "healing" || key === "abilityDamage" ? "abilityPower" : key;
      stats[statKey] = (stats[statKey] || 0) + value;
    });
  });
  return stats;
}

function modifiedCooldown(unit, ability) {
  const base = ability.cooldown * Math.max(0.5, 1 - unit.stats.cooldownReduction);
  if (ability.type !== "reposition") return base;
  // moveCooldown is additive and negative on gear, so it shortens the step.
  return Math.max(minMoveCooldown, base + (unit.stats.moveCooldown || 0));
}

// Gear adds to moveCooldown, so a card grants a NEGATIVE value to make you faster.
function moveCooldownFor(unit) {
  const base = unit.stats?.moveCooldown ?? roles[unit.roleId].moveCooldown ?? defaultMoveCooldown;
  return Math.max(minMoveCooldown, base);
}

function moveRangeFor(unit) {
  return Math.max(1, Math.round(unit.stats?.moveRange ?? defaultMoveRange));
}

function moveReady(unit) {
  return (unit.moveTimer ?? 0) <= 0;
}

// Movement is no longer something every unit just does. It comes from utility
// gear that grants a reposition ability, which behaves like any other card:
// a button, a range, a cooldown.
function grantedAbilities(roleId, team) {
  if (team !== "ally") return [];
  const granted = [];
  Object.values(state.equipped).forEach((itemId) => {
    const item = items[itemId];
    if (!item || !item.grantsAbility) return;
    if (!item.allowedRoles.includes(roleId)) return;
    if (granted.some((ability) => ability.id === item.grantsAbility.id)) return;
    granted.push(item.grantsAbility);
  });
  return granted;
}

function unitAbilities(unit) {
  if (!unit) return [];
  return unit.abilities || roles[unit.roleId].abilities;
}

// Resolve by id with a fall back to the role kit, so a lookup can never silently
// miss and leave an ability without its cooldown.
function findAbility(unit, abilityId) {
  return unitAbilities(unit).find((a) => a.id === abilityId)
    || roles[unit.roleId]?.abilities.find((a) => a.id === abilityId)
    || null;
}

function repositionRange(unit, ability) {
  const bonus = (unit.stats?.moveRange ?? defaultMoveRange) - defaultMoveRange;
  return Math.max(1, (ability.moveRange ?? 1) + bonus);
}

// Every cell this unit could legally stand in with the given reposition ability.
function repositionTargets(unit, ability) {
  const cells = [];
  const reach = repositionRange(unit, ability);
  for (let row = 0; row < gridRows; row += 1) {
    for (let col = 0; col < gridCols; col += 1) {
      if (Math.max(Math.abs(row - unit.position.row), Math.abs(col - unit.position.col)) > reach) continue;
      if (row === unit.position.row && col === unit.position.col) continue;
      if (ability.ignoreZones) {
        if (!canOccupy(unit, row, col)) continue;
      } else if (!canOccupyForRole(unit, row, col)) continue;
      cells.push({ row, col });
    }
  }
  return cells;
}

function armReposition(unit, ability) {
  state.pendingReposition = { unitId: unit.id, abilityId: ability.id };
  renderBattle();
}

function resolvePendingReposition(row, col) {
  const pending = state.pendingReposition;
  state.pendingReposition = null;
  if (!pending) return false;
  const unit = unitById(pending.unitId);
  const ability = findAbility(unit, pending.abilityId);
  if (!unit || !ability) {
    renderBattle();
    return false;
  }
  const legal = repositionTargets(unit, ability).some((cell) => cell.row === row && cell.col === col);
  if (!legal) {
    showFloatingMessage(unit, "CAN'T GO THERE");
    renderBattle();
    return false;
  }
  unit.gcd = 1;
  unit.cooldowns[ability.id] = modifiedCooldown(unit, ability);
  unit.position = { row, col };
  showFloatingMessage(unit, ability.name.toUpperCase());
  renderBattle();
  return true;
}

function modifiedAutoIntervalFromStats(roleId, stats) {
  return roles[roleId].auto.interval * Math.max(0.5, 1 - stats.cooldownReduction);
}

function modifiedAutoInterval(unit) {
  return modifiedAutoIntervalFromStats(unit.roleId, unit.stats);
}


function formatStatValue(value, suffix = "") {
  if (suffix === "s") return Number(value.toFixed(2));
  if (suffix === "%") return Number(value.toFixed(1));
  return Number.isInteger(value) ? value : Number(value.toFixed(1));
}

function hasVisibleStatValue(value) {
  return Math.abs(value) > 0.0001;
}

function signedStatValue(value, suffix = "") {
  const rounded = formatStatValue(value, suffix);
  if (!hasVisibleStatValue(rounded)) return "";
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}${suffix}`;
}




// Derived from the role data rather than hand-written, so these can never drift
// out of sync with the actual kits again.
function roleChoiceLines(roleId) {
  const role = roles[roleId];
  const auto = role.auto;
  const reach = auto.range === undefined ? defaultRange : auto.range;
  const where = roleId === "dps"
    ? "Dives across the midline"
    : "Holds your half";
  const lines = [
    `${where} · ${role.rangeBand || (reach <= 1 ? "Melee" : "Ranged")} (range ${reach})`,
    `${auto.type === "heal" ? "Auto heal" : "Auto"} ${auto.type === "heal" ? "+" : ""}${auto.amount} / ${auto.interval}s`
  ];
  if (role.pointBlankPenalty !== undefined) {
    lines.push(`Point blank: x${role.pointBlankPenalty} damage`);
  }
  role.abilities.forEach((ability) => {
    const bits = [];
    if (ability.amount) bits.push(`${ability.type.includes("heal") ? "+" : ""}${ability.amount}`);
    if (ability.heal) bits.push(`+${ability.heal}`);
    if (ability.interrupt || ability.type === "interrupt") bits.push("INT");
    if (ability.type === "dash") bits.push("dive");
    if (ability.type === "disengage") bits.push("leap back");
    if (ability.castTime) bits.push(`${ability.castTime}s cast`);
    if (!isSelfTargeted(ability)) bits.push(`rng ${abilityRange(ability)}`);
    bits.push(`${ability.cooldown}s`);
    lines.push(`${ability.name} ${bits.join(" · ")}`);
  });
  return lines;
}

function roleChoiceCard(roleId, selectionRoleId = roleId, inParty = false) {
  const role = roles[roleId];
  const icons = { tank: "🛡️", healer: "✨", dps: "⚔️" };
  const isPlayerChoice = state.selectedRole === selectionRoleId;
  const ownerLabel = isPlayerChoice ? "You" : inParty ? "Ally" : "Available";
  const button = document.createElement("button");
  button.className = `role-choice-card ${isPlayerChoice ? "selected" : inParty ? "party-member" : "not-selected"}`;
  button.type = "button";
  button.innerHTML = `
    <div class="unit-card-owner">${ownerLabel}</div>
    <div class="role-choice-title">
      <span aria-hidden="true">${icons[roleId] || "✦"}</span>
      <strong>${role.name}</strong>
    </div>
  `;
  button.addEventListener("click", () => {
    state.selectedRole = selectionRoleId;
    if (["dps", "caster", "hunter"].includes(selectionRoleId)) {
      state.allyDpsVariant = allyDpsVariants.find((variant) => variant.roleId === selectionRoleId) || allyDpsVariants[0];
    }
    saveGame();
    renderRoleScreen();
  });
  return button;
}

function roleEnemyPreviewCard(entry) {
  const role = roles[entry.roleId];
  const article = document.createElement("article");
  article.className = "role-enemy-card";
  article.innerHTML = `
    <div class="unit-card-owner">Enemy</div>
    <div class="role-enemy-title">
      <span aria-hidden="true">◆</span>
      <div>
        <strong>${role.name}</strong>
      </div>
    </div>
    <ul>
      <li>${role.auto.type === "heal" ? "Auto Heal" : "Auto Attack"}</li>
      ${role.abilities.slice(0, 3).map((ability) => `<li>${ability.name}</li>`).join("")}
    </ul>
  `;
  return article;
}

function roleAbilityDetails(ability) {
  const parts = [];
  if (ability.amount) {
    const healingTypes = ["heal", "renewal", "divineIntervention", "shieldSelf", "allyBarrier"];
    parts.push(`${healingTypes.includes(ability.type) ? "Heal" : "Damage"} ${ability.amount}`);
  }
  if (ability.adjacentDamage) parts.push(`Adjacent ${ability.adjacentDamage}`);
  if (ability.interrupt || ability.type === "interrupt") parts.push("Interrupt");
  if (ability.stunDuration) parts.push(`Stun ${ability.stunDuration}s`);
  if (ability.rootDuration) parts.push(`Root ${ability.rootDuration}s`);
  if (ability.shield) parts.push(`Shield ${ability.shield}`);
  if (ability.redirectDamage) parts.push(`Redirect ${Math.round(ability.redirectDamage * 100)}%`);
  if (ability.damageReduction !== undefined) parts.push(`Reduce ${Math.round(ability.damageReduction * 100)}%`);
  if (ability.moveRange) parts.push(`Move ${ability.moveRange}`);
  if (ability.range !== undefined) parts.push(`Range ${ability.range}`);
  if (ability.castTime) parts.push(`Cast ${ability.castTime}s`);
  if (ability.duration) parts.push(`Lasts ${ability.duration}s`);
  parts.push(ability.cardSlot === "ultimate" ? "100 charge" : `${ability.cooldown || 0}s cooldown`);
  return parts.join(" · ");
}

function selectedRoleAbilityPanel(roleId) {
  const role = roles[roleId];
  const stats = roleStats(roleId, "ally");
  const autoRate = modifiedAutoIntervalFromStats(roleId, stats);
  const gear = equippedItemsForRole(roleId);
  const artifact = gear.find((item) => item.slot === "Artifact");
  const enchantment = gear.find((item) => item.slot === "Enchantment");
  const section = document.createElement("div");
  section.className = "selected-role-kit";
  section.innerHTML = `
    <div class="selected-role-kit-head"><span>Character Sheet</span><strong>${role.name}</strong></div>
    <div class="selected-character-stats">
      <div><span>HP</span><strong>${stats.maxHp}</strong></div>
      <div><span>Auto/Rate</span><strong>${role.auto.amount} / ${Number(autoRate.toFixed(2))}s</strong></div>
      <div><span>CDR</span><strong>${Math.round(stats.cooldownReduction * 100)}%</strong></div>
      <div><span>Ability Power</span><strong>${stats.abilityPower}</strong></div>
      <div><span>Haste</span><strong>${Math.round((stats.haste || 0) * 100)}%</strong></div>
      <div><span>Move Range</span><strong>${stats.moveRange}</strong></div>
    </div>
    <div class="selected-role-abilities">
      ${role.abilities.map((ability) => `<div><strong>${ability.name}</strong><small>${roleAbilityDetails(ability)}</small></div>`).join("")}
    </div>
    <div class="selected-role-passives">
      <div><span>Artifact</span><strong>${artifact?.name || "None equipped"}</strong><small>${artifact?.description || "No Artifact effect"}</small></div>
      <div><span>Enchantment</span><strong>${enchantment?.name || "None equipped"}</strong><small>${enchantment?.description || "No Enchantment effect"}</small></div>
    </div>
  `;
  return section;
}


function renderRoleScreen() {
  updateRoleScreenButtons();
  ui.roleFormation.innerHTML = "";
  ui.roleFormation.className = "role-lineups";
  renderStaticCharacterSheets();
  const rolledEnemy = state.enemyDpsVariants?.[0] || enemyDpsVariants[1];
  const enemyLineup = [
    { roleId: "tank", name: "Enemy Tank" },
    { roleId: "healer", name: "Enemy Healer" },
    { roleId: rolledEnemy.roleId, name: rolledEnemy.name }
  ];
  const enemySection = document.createElement("section");
  enemySection.className = "role-lineup-section enemy-lineup-section";
  enemySection.innerHTML = `<h2>Enemy Lineup</h2><div class="enemy-lineup"></div>`;
  enemyLineup.forEach((entry) => enemySection.querySelector(".enemy-lineup").append(roleEnemyPreviewCard(entry)));

  const playerDamageRole = ["dps", "caster", "hunter"].includes(state.selectedRole)
    ? state.selectedRole
    : (state.allyDpsVariant || allyDpsVariants[0]).roleId;
  const partyRoles = new Set(["tank", "healer", playerDamageRole]);
  const optionSection = document.createElement("section");
  optionSection.className = "role-lineup-section option-lineup-section";
  optionSection.innerHTML = `<h2>Your Side</h2><div class="role-option-lineup"></div>`;
  ["tank", "healer", "dps", "hunter", "caster"].forEach((roleId) => {
    optionSection.querySelector(".role-option-lineup").append(roleChoiceCard(roleId, roleId, partyRoles.has(roleId)));
  });
  optionSection.append(selectedRoleAbilityPanel(state.selectedRole || "tank"));
  ui.roleFormation.append(enemySection, optionSection);
}


function createUnit(roleId, team, name, slotKey, hpMultiplier = 1, positionKey = slotKey, encounterEntry = null, encounterDamageScale = 1) {
  const base = roles[roleId];
  const stats = roleStats(roleId, team);
  const maxHp = Math.round(stats.maxHp * hpMultiplier);
  return {
    id: `${team}-${slotKey}`,
    roleId,
    team,
    name,
    position: positions[positionKey],
    positionKey,
    width: encounterEntry?.width || 1,
    damageMultiplier: team === "enemy" ? (encounterDamageScale ?? 1) : 1,
    encounterEntry,
    isPlayer: team === "ally" && roleId === state.selectedRole,
    hp: maxHp,
    maxHp,
    stats,
    autoTimer: modifiedAutoIntervalFromStats(roleId, stats),
    gcd: 0,
    abilities: [...base.abilities, ...grantedAbilities(roleId, team)],
    cooldowns: Object.fromEntries([...base.abilities, ...grantedAbilities(roleId, team)]
      .map((ability) => [ability.id, 0])),
    cast: null,
    interruptMessage: "",
    interruptMessageTimer: 0,
    targetId: null,
    tauntTimer: 0,
    guardTimer: 0,
    guardMitigation: 0.5,
    moveTimer: 0,
    diveHome: null,
    diveActionsLeft: 0,
    diveTimer: 0,
    diveAbilityId: null,
    allyBarrierTimer: 0,
    enemyBarrierTimer: 0,
    dead: false
  };
}

function enterRoom(index = state.run?.roomIndex ?? 0) {
  if (!state.run) {
    startRun();
    return;
  }
  state.run.roomIndex = Math.max(0, Math.min(index, state.run.sequence.length - 1));
  const room = currentRoom();
  const encounter = encounterLibrary[room.encounterId];
  state.encounter = encounter;
  if (["dps", "caster", "hunter"].includes(state.selectedRole)) {
    state.allyDpsVariant = allyDpsVariants.find((variant) => variant.roleId === state.selectedRole) || allyDpsVariants[0];
  } else {
    state.allyDpsVariant = rollAllyDpsVariant();
  }
  if (!state.enemyDpsVariants) state.enemyDpsVariants = rollEnemyDpsVariants();
  const allies = currentAllyFormation();
  const enemies = currentEnemyFormation(encounter);
  state.units = [
    ...enemies.map((entry) => createUnit(entry.roleId, "enemy", entry.name, entry.slotKey, encounter.enemyHpMultiplier * (entry.hpMultiplier || 1), entry.positionKey || entry.slotKey, entry, encounter.enemyDamageMultiplier ?? 1)),
    ...allies.map((entry) => createUnit(entry.roleId, "ally", entry.name, entry.slotKey, 1, entry.positionKey || entry.slotKey, entry))
  ];
  state.playerUnitId = state.selectedRole === "dps" || state.selectedRole === "caster" || state.selectedRole === "hunter"
    ? "ally-allyDps"
    : state.units.find((unit) => unit.team === "ally" && unit.roleId === state.selectedRole)?.id || "ally-allyTank";
  state.units.forEach((unit) => {
    if (unit.id === state.playerUnitId) unit.name = `Player ${roles[unit.roleId].name}`;
  });
  state.meters = Object.fromEntries(state.units.map((unit) => [unit.id, { damage: 0, healing: 0, interrupts: 0, cc: 0 }]));
  state.selectedTargetId = living("enemy")[0]?.id || null;
  state.countdown = 5.2;
  state.combatActive = false;
  state.result = null;
  state.bulwarks = {};
  state.pendingReposition = null;
  state.squareAttacks = [];
  state.respawnQueue = [];
  state.squareAttackTimer = encounter.squareAttack ? encounter.squareAttack.interval * 0.55 : 0;
  state.enrageTimer = encounter.enrage ? encounter.enrage.firstAt : 0;
  state.fightElapsed = 0;
  state.softEnrageStacks = 0;
  ui.encounterLabel.textContent = `Room ${state.run.roomIndex + 1} of ${state.run.sequence.length} · ${roomTypes[room.type].label}`;
  ui.battleTitle.textContent = encounter.name;
  ui.resultOverlay.classList.add("hidden");
  saveGame();
  showScreen("battle");
  renderRunTrack();
  renderBattle();
}

// Kept so any stray caller lands somewhere sane.
function startFight(index = state.run?.roomIndex ?? 0) {
  if (!state.run) startRun();
  else enterRoom(index);
}

function unitById(id) {
  return state.units.find((unit) => unit.id === id) || null;
}

function living(team) {
  return state.units.filter((unit) => unit.team === team && !unit.dead);
}

function enemiesOf(unit) {
  return living(unit.team === "ally" ? "enemy" : "ally");
}

function alliesOf(unit) {
  return living(unit.team);
}

function activeBulwarkLinks() {
  return Object.values(state.bulwarks || {}).filter((link) => {
    const tank = unitById(link.tankId);
    const ally = unitById(link.allyId);
    return tank && ally && !tank.dead && !ally.dead;
  });
}

function bulwarkForTarget(targetId) {
  return activeBulwarkLinks().find((link) => link.allyId === targetId) || null;
}

function bulwarkForTank(tankId) {
  return activeBulwarkLinks().find((link) => link.tankId === tankId) || null;
}

function isRangedUnit(unit) {
  return (roles[unit.roleId].auto.range ?? defaultRange) > 1;
}

function isDamageRole(roleId) {
  return roleId === "dps" || roleId === "caster" || roleId === "hunter";
}

function enemyAutoDamageAmount(unit, auto) {
  if (unit.team !== "enemy" || auto.type !== "damage" || !isDamageRole(unit.roleId)) return auto.amount;
  const allyDpsCount = state.units.filter((candidate) => candidate.team === "ally" && isDamageRole(candidate.roleId)).length;
  const enemyDpsCount = state.units.filter((candidate) => candidate.team === "enemy" && isDamageRole(candidate.roleId)).length;
  if (enemyDpsCount <= allyDpsCount) return auto.amount;
  // Scale the unit's OWN auto by how badly it outnumbers you. The old version
  // replaced it with a melee-based number, which more than doubled a caster's
  // auto (4 -> 9) and made every four-pack unwinnable.
  return Math.ceil(auto.amount * (1 + (enemyDpsCount - allyDpsCount) * 0.12));
}

function selectedTarget() {
  const target = unitById(state.selectedTargetId);
  return target && !target.dead ? target : null;
}

function cellKey(row, col) {
  return `${row}-${col}`;
}

function unitWidth(unit) {
  return Math.max(1, unit?.width || 1);
}

// A unit anchors at position and extends right by its width. Bosses are 2 wide.
function unitCells(unit) {
  const cells = [];
  for (let i = 0; i < unitWidth(unit); i += 1) cells.push({ row: unit.position.row, col: unit.position.col + i });
  return cells;
}

function unitOccupies(unit, row, col) {
  return unit.position.row === row && col >= unit.position.col && col < unit.position.col + unitWidth(unit);
}

function unitAt(row, col) {
  return state.units.find((unit) => !unit.dead && unitOccupies(unit, row, col)) || null;
}

// Chebyshev ("king move") distance between the nearest cells of two units.
// Measuring cell-to-cell means a 2-wide boss is reachable from either half.
function unitDistance(a, b) {
  if (!a || !b) return Infinity;
  let best = Infinity;
  unitCells(a).forEach((ca) => {
    unitCells(b).forEach((cb) => {
      const d = Math.max(Math.abs(ca.row - cb.row), Math.abs(ca.col - cb.col));
      if (d < best) best = d;
    });
  });
  return best;
}

function abilityRange(ability) {
  return ability.range === undefined ? defaultRange : ability.range;
}

// Self-targeted effects never care about distance.
function isSelfTargeted(ability) {
  return ability.type === "guard" || ability.type === "healSelf" || ability.type === "disengage" || ability.type === "healAll";
}

function inAbilityRange(unit, ability, target) {
  if (isSelfTargeted(ability)) return true;
  if (!target) return false;
  return unitDistance(unit, target) <= abilityRange(ability);
}

function inAutoRange(unit, target) {
  const auto = roles[unit.roleId].auto;
  return !!target && unitDistance(unit, target) <= (auto.range === undefined ? defaultRange : auto.range);
}

// Hunters lose half their damage while anything is breathing on them.
function pointBlankMultiplier(unit) {
  const penalty = roles[unit.roleId].pointBlankPenalty;
  if (penalty === undefined) return 1;
  return enemiesOf(unit).some((enemy) => unitDistance(unit, enemy) <= 1) ? penalty : 1;
}

function isPointBlank(unit) {
  return roles[unit.roleId].pointBlankPenalty !== undefined
    && enemiesOf(unit).some((enemy) => unitDistance(unit, enemy) <= 1);
}

function anchorUnitAt(row, col) {
  const unit = unitAt(row, col);
  return unit && unit.position.row === row && unit.position.col === col ? unit : null;
}

// Layout-only lookup: dead units keep their footprint so the grid doesn't reflow mid-fight.
function occupantAt(row, col) {
  return state.units.find((unit) => unitOccupies(unit, row, col)) || null;
}

function cellIsCovered(row, col) {
  const unit = occupantAt(row, col);
  return !!unit && !(unit.position.row === row && unit.position.col === col);
}

function squareAttackAt(row, col) {
  return state.squareAttacks.find((attack) => attack.row === row && attack.col === col) || null;
}

function squareAttackSourceUnit() {
  const sourceName = currentEncounter().squareAttack?.sourceName || "Brackenjaw";
  return state.units.find((unit) => unit.team === "enemy" && unit.name === sourceName && !unit.dead) || null;
}

function activeBossAttack() {
  return state.squareAttacks.find((attack) => attack.sourceId === squareAttackSourceUnit()?.id) || null;
}

function respawnAt(row, col) {
  return state.respawnQueue.find((respawn) => respawn.row === row && respawn.col === col) || null;
}

function isRespawnableBossAdd(unit) {
  const mechanic = currentEncounter().respawnAdds;
  return !!mechanic && unit.team === "enemy" && unit.name !== mechanic.sourceName && !!unit.encounterEntry;
}

function randomEntry(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function respawnEntryFor(unit) {
  if (unit.roleId === "healer") {
    return { ...unit.encounterEntry, roleId: "healer", name: unit.encounterEntry.name || "Enemy Healer" };
  }
  if (isDamageRole(unit.roleId)) {
    const variant = randomEntry(enemyDpsVariants);
    return {
      ...unit.encounterEntry,
      roleId: variant.roleId,
      name: variant.name.replace("DPS", roles[variant.roleId].name),
      positionKey: variant.lane === "back" ? "enemyDamageBackA" : "enemyDamageFrontB"
    };
  }
  return { ...unit.encounterEntry };
}

function respawnPositionFor(entry, fallback) {
  if (entry.roleId === "healer") return positions.enemyHealer;
  if (isDamageRole(entry.roleId)) {
    return randomEntry([
      positions.enemyDamageBackA,
      positions.enemyDamageBackB,
      positions.enemyDamageFrontA,
      positions.enemyDamageFrontB
    ]);
  }
  return positions[entry.positionKey || entry.slotKey] || fallback;
}

// Where a unit is ALLOWED to stand, ignoring how far away it is and its cadence.
function canOccupyForRole(unit, row, col) {
  if (!unit || unit.dead || unit.cast) return false;
  if (row < 0 || row >= gridRows) return false;
  // Melee can walk into the enemy half and stay there, paying Exposed and pulling
  // the front line onto it. Lunge is the fast way in; this is the committed way in.
  // Without it melee's only reachable target is the enemy tank, which their healer
  // simply tops back up, and melee can never win a damage race.
  if (!isOwnHalf(unit, row) && !canLeaveOwnHalf(unit)) return false;
  if (col < 0 || col + unitWidth(unit) > gridCols) return false;
  for (let i = 0; i < unitWidth(unit); i += 1) {
    const blocker = unitAt(row, col + i);
    if (blocker && blocker.id !== unit.id) return false;
  }
  return true;
}




function incomingBarrierCaster(targetId) {
  return state.units.find((unit) => unit.cast?.abilityId === "barrier" && unit.cast.targetId === targetId && !unit.dead) || null;
}

function targetUnit(unit) {
  if (!unit || unit.dead) return;
  state.selectedTargetId = unit.id;
  const player = unitById(state.playerUnitId);
  if (player && !player.dead) player.targetId = unit.id;
  renderBattle();
}

function chooseEnemyTarget(unit) {
  const enemies = enemiesOf(unit);
  const activeEnemies = enemies.filter((enemy) => enemy.enemyBarrierTimer <= 0);
  const targetPool = activeEnemies.length ? activeEnemies : enemies;
  const forcedTank = enemies.find((enemy) => enemy.roleId === "tank" && enemy.tauntTimer > 0);
  if (forcedTank) return forcedTank;
  // Someone in our half turns the bruisers around — the front line notices the
  // person standing on top of it. Ranged attackers keep shooting what they were
  // already shooting, so a dive draws heat without collapsing the whole team onto
  // you. An allied Tank's Taunt still overrides this (checked above).
  const isBruiser = (roles[unit.roleId].auto.range ?? defaultRange) <= 1;
  if (isBruiser) {
    const intruder = targetPool.find((enemy) => isBehindEnemyLines(enemy));
    if (intruder) return intruder;
  }

  const priority = priorityTarget(unit, targetPool);
  if (priority && inAutoRange(unit, priority)) return priority;
  // The priority target is out of reach. Rather than each attacker drifting onto
  // whatever happens to be adjacent, everyone converges on the weakest thing they
  // CAN hit, so damage concentrates instead of smearing across the enemy team.
  const reachable = targetPool.filter((enemy) => inAutoRange(unit, enemy));
  if (reachable.length) {
    return reachable.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  }
  return priority || targetPool[0] || null;
}

// Who this unit WANTS to be hitting, ignoring whether it can reach them.
function priorityTarget(unit, pool = null) {
  const targetPool = pool || enemiesOf(unit);
  if (isDamageRole(unit.roleId)) return targetPool.find((enemy) => enemy.roleId === "healer") || targetPool[0] || null;
  return targetPool.find((enemy) => enemy.roleId === "tank") || targetPool[0] || null;
}

// excludeSelf is used by the auto-heal: a healer that trickles 20 HP/s into itself
// while the whole party focuses it is unkillable, and the fight deadlocks.
// Self-healing is what Mend is for.
function chooseHealTarget(unit, preferSelected = false, excludeSelf = false) {
  const allies = alliesOf(unit).filter((ally) => !excludeSelf || ally.id !== unit.id);
  const chosen = preferSelected ? selectedTarget() : null;
  if (chosen && chosen.team === unit.team && chosen.hp < chosen.maxHp && (!excludeSelf || chosen.id !== unit.id)) return chosen;
  return allies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || null;
}

function getPlayerActionTarget(unit) {
  const target = selectedTarget();
  if (unit.roleId === "healer") {
    if (target?.team === "ally") return target;
    return chooseHealTarget(unit, false);
  }
  if (target?.team === "enemy") return target;
  return chooseEnemyTarget(unit);
}

function setAiTargets() {
  state.units.forEach((unit) => {
    if (unit.dead || unit.isPlayer) return;
    if (unit.roleId === "healer") unit.targetId = chooseHealTarget(unit, false)?.id || null;
    else unit.targetId = chooseEnemyTarget(unit)?.id || null;
  });
}

function addMeter(unit, key, amount) {
  const meter = state.meters[unit.id];
  if (meter) meter[key] += amount;
}

function showFloatingMessage(unit, message) {
  unit.interruptMessage = message;
  unit.interruptMessageTimer = 0.9;
}

function heal(source, target, amount) {
  if (!source || !target || target.dead) return;
  const adjusted = Math.round(amount + source.stats.abilityPower);
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + adjusted);
  addMeter(source, "healing", target.hp - before);
}

function damage(source, target, amount) {
  if (!source || !target || target.dead) return;
  let adjusted = Math.round(amount + source.stats.abilityPower);
  if (roles[source.roleId].auto.amount === amount) adjusted = Math.round(amount + source.stats.autoDamage);
  if (source.damageMultiplier && source.damageMultiplier !== 1) adjusted = Math.round(adjusted * source.damageMultiplier);
  const enrageScale = softEnrageMultiplier(source);
  if (enrageScale !== 1) adjusted = Math.round(adjusted * enrageScale);
  const pointBlank = pointBlankMultiplier(source);
  if (pointBlank !== 1) adjusted = Math.round(adjusted * pointBlank);
  // Standing in the enemy half means everything hits you harder.
  if (isBehindEnemyLines(target)) adjusted = Math.round(adjusted * (1 + exposedDamageBonus));
  if (target.guardTimer > 0) adjusted = Math.round(adjusted * (target.guardMitigation ?? 0.5));
  if (target.allyBarrierTimer > 0) adjusted = Math.ceil(adjusted * 0.5);
  if (target.enemyBarrierTimer > 0 && adjusted > 0) target.enemyBarrierTimer = 0;

  const link = bulwarkForTarget(target.id);
  if (link) {
    const tank = unitById(link.tankId);
    if (tank && !tank.dead) {
      const split = Math.floor(adjusted * 0.5);
      applyDamage(source, tank, split);
      applyDamage(source, target, adjusted - split);
      return;
    }
  }
  applyDamage(source, target, adjusted);
}

function applyDamage(source, target, amount) {
  const before = target.hp;
  target.hp = Math.max(0, target.hp - amount);
  addMeter(source, "damage", before - target.hp);
  if (target.hp <= 0) {
    target.dead = true;
    target.cast = null;
    if (target.diveHome) endDive(target, true);
    if (isRespawnableBossAdd(target)) scheduleRespawn(target);
    if (state.selectedTargetId === target.id) state.selectedTargetId = living(target.team)[0]?.id || null;
    Object.entries(state.bulwarks).forEach(([tankId, link]) => {
      if (link.allyId === target.id || link.tankId === target.id) delete state.bulwarks[tankId];
    });
  }
}

function scheduleRespawn(unit) {
  const mechanic = currentEncounter().respawnAdds;
  const alreadyQueued = state.respawnQueue.some((respawn) => respawn.slotKey === unit.encounterEntry.slotKey);
  if (!mechanic || alreadyQueued) return;
  const entry = respawnEntryFor(unit);
  const position = respawnPositionFor(entry, unit.position);
  state.respawnQueue.push({
    slotKey: unit.encounterEntry.slotKey,
    entry,
    row: position.row,
    col: position.col,
    timer: mechanic.delay,
    maxTimer: mechanic.delay
  });
}

function interrupt(source, target) {
  const bossAttack = target?.id === squareAttackSourceUnit()?.id ? activeBossAttack() : null;
  if (!target?.cast?.interruptible && !bossAttack) return false;
  if (bossAttack) {
    bossAttack.interrupts = bossAttack.interrupts || [];
    if (!bossAttack.interrupts.includes(source.id)) bossAttack.interrupts.push(source.id);
    addMeter(source, "interrupts", 1);
    if (bossAttack.interrupts.length < 2) {
      target.interruptMessage = `INTERRUPT ${bossAttack.interrupts.length}/2`;
      target.interruptMessageTimer = 0.85;
      return false;
    }
    state.squareAttacks = state.squareAttacks.filter((attack) => attack !== bossAttack);
    target.cast = null;
    target.interruptMessage = "DOUBLE INTERRUPTED";
    target.interruptMessageTimer = 0.85;
    return true;
  }
  target.cast = null;
  target.interruptMessage = `INTERRUPTED BY ${roles[source.roleId].name.toUpperCase()}`;
  target.interruptMessageTimer = 0.85;
  addMeter(source, "interrupts", 1);
  return true;
}

function beginCast(source, ability, target) {
  source.cast = {
    abilityId: ability.id,
    name: ability.name,
    targetId: target?.id || null,
    elapsed: 0,
    castTime: ability.castTime,
    interruptible: ability.interruptible
  };
}

function finishCast(unit) {
  if (unit.cast?.abilityId === "squareAttack") {
    unit.cast = null;
    return;
  }
  if (unit.cast?.abilityId === "enrage") {
    const mechanic = currentEncounter().enrage;
    unit.cast = null;
    unit.damageMultiplier *= mechanic?.multiplier || 2;
    unit.enraged = true;
    showFloatingMessage(unit, "ENRAGED");
    return;
  }
  const ability = findAbility(unit, unit.cast.abilityId);
  const target = unitById(unit.cast.targetId);
  unit.cast = null;
  resolveAbility(unit, ability, target, true);
}

function useAbilityByIndex(index) {
  const player = unitById(state.playerUnitId);
  if (!player || player.dead) return;
  const ability = unitAbilities(player)[index];
  if (!ability) return;
  // Reposition arms a destination picker instead of resolving immediately.
  if (ability.type === "reposition") {
    if (!state.combatActive || player.cast || player.gcd > 0 || (player.cooldowns[ability.id] || 0) > 0) return;
    armReposition(player, ability);
    return;
  }
  useAbility(player, ability, getPlayerAbilityTarget(player, ability));
}

function getPlayerAbilityTarget(unit, ability) {
  const target = selectedTarget();
  if (ability.type === "bulwark") return target?.team === unit.team && target.id !== unit.id ? target : unit;
  if (ability.type === "barrier") return target || chooseEnemyTarget(unit);
  if (ability.type === "heal") return target?.team === "ally" ? target : unit;
  if (ability.type === "healAll" || ability.type === "healSelf" || ability.type === "guard") return unit;
  return target?.team === "enemy" ? target : chooseEnemyTarget(unit);
}

function useAbility(unit, ability, target) {
  if (!state.combatActive || unit.dead || unit.cast || unit.gcd > 0 || unit.cooldowns[ability.id] > 0) return false;
  // No chaining dives: while the window is open the dash is still off cooldown.
  if (ability.type === "dash" && unit.diveHome) return false;
  if (!inAbilityRange(unit, ability, target)) {
    if (unit.isPlayer) showFloatingMessage(unit, "OUT OF RANGE");
    return false;
  }
  if (ability.castTime) {
    unit.gcd = 1;
    unit.cooldowns[ability.id] = modifiedCooldown(unit, ability);
    beginCast(unit, ability, target);
    return true;
  }
  // A dash that skips the GCD lets the dive land and the follow-up fire in the
  // same beat, which is the only way melee can answer a 1.2s cast.
  if (!ability.noGcd) unit.gcd = 1;
  // A dash's cooldown is deliberately NOT started here — it starts when the diver lands back.
  if (ability.type !== "dash") unit.cooldowns[ability.id] = modifiedCooldown(unit, ability);
  resolveAbility(unit, ability, target, false);
  return true;
}

function resolveAbility(unit, ability, target) {
  if (ability.interrupt || ability.type === "interrupt") {
    const landed = interrupt(unit, target);
    // Reward good timing: a landed interrupt partly refunds its own cooldown,
    // so reading casts turns into a rhythm rather than a once-per-8s button.
    if (landed && ability.interruptRefund) {
      unit.cooldowns[ability.id] = Math.max(0, (unit.cooldowns[ability.id] || 0) - ability.interruptRefund);
    }
    if (landed && ability.interruptGuard) {
      unit.guardTimer = Math.max(unit.guardTimer, ability.interruptGuard.duration);
      unit.guardMitigation = Math.min(unit.guardMitigation ?? 1, ability.interruptGuard.mitigation);
      showFloatingMessage(unit, "BRACED");
    }
  }
  if (ability.type === "damage") damage(unit, target, ability.amount);
  if (ability.type === "taunt") {
    damage(unit, target, ability.amount);
    alliesOf(unit).filter((ally) => ally.roleId === "tank").forEach((tank) => {
      tank.tauntTimer = 3;
    });
    enemiesOf(unit).forEach((enemy) => {
      enemy.targetId = alliesOf(unit).find((ally) => ally.roleId === "tank")?.id || unit.id;
    });
  }
  if (ability.type === "bulwark") {
    heal(unit, unit, ability.heal);
    if (target?.team === unit.team && target.id !== unit.id) state.bulwarks[unit.id] = { tankId: unit.id, allyId: target.id };
  }
  if (ability.type === "healSelf") heal(unit, unit, ability.amount);
  if (ability.type === "heal") heal(unit, target || unit, ability.amount);
  if (ability.type === "healAll") alliesOf(unit).forEach((ally) => heal(unit, ally, ability.amount));
  if (ability.type === "guard") {
    unit.guardTimer = ability.duration;
    unit.guardMitigation = ability.mitigation;
  }
  if (ability.type === "dash") {
    const landing = findDashCell(unit, target);
    if (landing) {
      unit.diveHome = { ...unit.position };
      unit.diveActionsLeft = ability.followUpActions ?? 1;
      unit.diveTimer = ability.diveWindow ?? 4;
      unit.diveAbilityId = ability.id;
      unit.position = landing;
    } else {
      // Nowhere to land, so it was never a dive — just start the cooldown normally.
      unit.cooldowns[ability.id] = modifiedCooldown(unit, ability);
    }
    damage(unit, target, ability.amount);
  }
  if (ability.type === "disengage") {
    const retreat = findRetreatCell(unit);
    if (retreat) unit.position = retreat;
    unit.guardTimer = ability.duration;
    unit.guardMitigation = ability.mitigation;
  }
  if (ability.type === "barrier" && target) {
    if (target.team === unit.team) target.allyBarrierTimer = ability.duration;
    else {
      target.enemyBarrierTimer = ability.duration;
      target.cast = null;
      addMeter(unit, "cc", 1);
    }
  }
  // Whirlwind is range 1, so it only sweeps what you are standing next to.
  if (ability.type === "damageAll") {
    enemiesInAbilityRange(unit, ability).forEach((enemy) => damage(unit, enemy, ability.amount));
  }

  // Spending the follow-up action is what ends the dive.
  if (unit.diveHome && ability.type !== "dash") {
    unit.diveActionsLeft -= 1;
    if (unit.diveActionsLeft <= 0) endDive(unit);
  }
}

function isDiving(unit) {
  return !!unit?.diveHome;
}

// Snap the diver back where it launched from. If that cell got taken while it was
// away, drop it on the nearest free cell in its own half instead.
function findReturnCell(unit) {
  const home = unit.diveHome;
  if (!home) return null;
  if (canOccupy(unit, home.row, home.col)) return home;
  const options = [];
  for (let row = 0; row < gridRows; row += 1) {
    for (let col = 0; col < gridCols; col += 1) {
      if (!isOwnHalf(unit, row)) continue;
      if (!canOccupy(unit, row, col)) continue;
      options.push({ row, col });
    }
  }
  options.sort((a, b) => {
    const da = Math.max(Math.abs(a.row - home.row), Math.abs(a.col - home.col));
    const db = Math.max(Math.abs(b.row - home.row), Math.abs(b.col - home.col));
    return da - db;
  });
  return options[0] || null;
}

function endDive(unit, silent = false) {
  if (!unit.diveHome) return;
  const abilityId = unit.diveAbilityId;
  if (!unit.dead) {
    const home = findReturnCell(unit);
    if (home) unit.position = home;
  }
  unit.diveHome = null;
  unit.diveActionsLeft = 0;
  unit.diveTimer = 0;
  unit.diveAbilityId = null;
  // The whole point: the cooldown only starts once you are home.
  const ability = findAbility(unit, abilityId);
  if (ability && !unit.dead) unit.cooldowns[ability.id] = modifiedCooldown(unit, ability);
  if (!silent && !unit.dead) showFloatingMessage(unit, "PULLED BACK");
}

function enemiesInAbilityRange(unit, ability) {
  const reach = abilityRange(ability);
  return enemiesOf(unit).filter((enemy) => unitDistance(unit, enemy) <= reach);
}

// A dash lands you on a free cell touching the target, crossing into the enemy half
// if that is where they are. You do not come back on your own.
function findDashCell(unit, target) {
  if (!target) return null;
  const candidates = [];
  unitCells(target).forEach((cell) => {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dr && !dc) continue;
        candidates.push({ row: cell.row + dr, col: cell.col + dc });
      }
    }
  });
  const legal = candidates.filter((cell) => canOccupy(unit, cell.row, cell.col));
  if (!legal.length) return null;
  // Prefer the landing spot closest to where the diver started.
  legal.sort((a, b) => {
    const da = Math.max(Math.abs(a.row - unit.position.row), Math.abs(a.col - unit.position.col));
    const db = Math.max(Math.abs(b.row - unit.position.row), Math.abs(b.col - unit.position.col));
    return da - db;
  });
  return legal[0];
}

// Disengage hops one rank toward your own back line.
function findRetreatCell(unit) {
  const backward = unit.team === "ally" ? 1 : -1;
  const options = [
    { row: unit.position.row + backward, col: unit.position.col },
    { row: unit.position.row + backward, col: unit.position.col - 1 },
    { row: unit.position.row + backward, col: unit.position.col + 1 }
  ];
  return options.find((cell) => canOccupy(unit, cell.row, cell.col) && isOwnHalf(unit, cell.row)) || null;
}

function isOwnHalf(unit, row) {
  return unit.team === "ally" ? row >= 2 : row <= 1;
}

// The cost of diving. Tuned so one dive costs roughly a third of a melee's health
// rather than three quarters of it — a real trade, not a death sentence.
const exposedDamageBonus = 0.2;

function isBehindEnemyLines(unit) {
  return !!unit && !unit.dead && !isOwnHalf(unit, unit.position.row);
}

// Raw board legality: on the grid, and no other living unit in any cell we would cover.
function canOccupy(unit, row, col) {
  if (row < 0 || row >= gridRows) return false;
  if (col < 0 || col + unitWidth(unit) > gridCols) return false;
  for (let i = 0; i < unitWidth(unit); i += 1) {
    const blocker = unitAt(row, col + i);
    if (blocker && blocker.id !== unit.id) return false;
  }
  return true;
}

function processAuto(unit) {
  const auto = roles[unit.roleId].auto;
  if (unit.isPlayer) unit.targetId = getPlayerActionTarget(unit)?.id || null;
  let target = unitById(unit.targetId) || (auto.type === "heal" ? chooseHealTarget(unit, false, true) : chooseEnemyTarget(unit));
  // Auto-heal never lands on the healer itself.
  if (auto.type === "heal" && target?.id === unit.id) target = chooseHealTarget(unit, false, true);
  if (!unit.isPlayer && auto.type === "damage" && target?.enemyBarrierTimer > 0) {
    target = chooseEnemyTarget(unit);
  }
  // An AI whose target has walked out of reach swings at whatever it CAN hit,
  // rather than standing still. The player keeps their chosen target.
  if (!unit.isPlayer && target && !inAutoRange(unit, target)) {
    const pool = auto.type === "heal" ? alliesOf(unit).filter((a) => a.id !== unit.id) : enemiesOf(unit);
    const reachable = pool.filter((candidate) => inAutoRange(unit, candidate)
      && (auto.type === "heal" ? candidate.hp < candidate.maxHp : candidate.enemyBarrierTimer <= 0));
    if (reachable.length) target = reachable[0];
  }
  if (!target || !inAutoRange(unit, target)) return;
  unit.targetId = target.id;
  if (auto.type === "heal") heal(unit, target, auto.amount + unit.stats.autoHealing);
  else damage(unit, target, enemyAutoDamageAmount(unit, auto));
}

function dangerousCastTarget(unit) {
  return enemiesOf(unit).find((enemy) => enemy.cast?.interruptible && enemy.cast.abilityId !== "barrier" && !enemy.dead) || null;
}

function ccTarget(unit) {
  const candidates = enemiesOf(unit).filter((enemy) => !enemy.dead && enemy.enemyBarrierTimer <= 0);
  const notBeingAttacked = candidates.find((enemy) => !alliesOf(unit).some((ally) => ally.targetId === enemy.id));
  return notBeingAttacked || candidates.find((enemy) => enemy.roleId === "caster") || candidates.find((enemy) => enemy.roleId === "healer") || candidates[0] || null;
}

function aiTryAbilities(unit) {
  if (unit.isPlayer || unit.dead || unit.cast || unit.gcd > 0 || unit.enemyBarrierTimer > 0) return;
  const abilities = unitAbilities(unit);
  const ready = (id) => abilities.find((ability) => ability.id === id && unit.cooldowns[id] <= 0);
  if (unit.roleId === "healer") {
    const controlTarget = ccTarget(unit);
    if (controlTarget && ready("barrier") && useAbility(unit, ready("barrier"), controlTarget)) return;
  }
  // Gear-granted repositioning: close if our target is unreachable, break contact
  // if something is on top of us and we would rather be shooting.
  const step = abilities.find((ability) => ability.type === "reposition" && unit.cooldowns[ability.id] <= 0);
  if (step) {
    const want = priorityTarget(unit);
    const cornered = isPointBlank(unit) || (isRangedUnit(unit) && enemiesOf(unit).some((foe) => unitDistance(unit, foe) <= 1));
    if (cornered || (want && !inAutoRange(unit, want))) {
      const cells = repositionTargets(unit, step);
      let best = null;
      let bestScore = -Infinity;
      cells.forEach((cell) => {
        const probe = { position: cell, width: unitWidth(unit), team: unit.team, roleId: unit.roleId };
        const foes = enemiesOf(unit);
        const nearest = foes.reduce((min, foe) => Math.min(min, unitDistance(probe, foe)), Infinity);
        const toWant = want ? unitDistance(probe, want) : 0;
        const score = isRangedUnit(unit)
          ? Math.min(nearest, 3) * 14 - toWant * 4
          : -toWant * 20;
        if (score > bestScore) { bestScore = score; best = cell; }
      });
      const hereProbe = { position: unit.position, width: unitWidth(unit), team: unit.team, roleId: unit.roleId };
      const hereFoes = enemiesOf(unit);
      const hereNearest = hereFoes.reduce((min, foe) => Math.min(min, unitDistance(hereProbe, foe)), Infinity);
      const hereWant = want ? unitDistance(hereProbe, want) : 0;
      const hereScore = isRangedUnit(unit)
        ? Math.min(hereNearest, 3) * 14 - hereWant * 4
        : -hereWant * 20;
      if (best && bestScore > hereScore + 1) {
        unit.gcd = 1;
        unit.cooldowns[step.id] = modifiedCooldown(unit, step);
        unit.position = best;
        return;
      }
    }
  }

  const dangerous = dangerousCastTarget(unit);
  const interruptAbility = unit.roleId === "tank" ? ready("shieldSlam") : ready("interrupt");
  if (dangerous && interruptAbility && useAbility(unit, interruptAbility, dangerous)) return;

  if (unit.roleId === "tank") {
    const low = unit.hp / unit.maxHp < 0.55;
    const allyFocused = alliesOf(unit).find((ally) => ally.roleId !== "tank" && enemiesOf(unit).some((enemy) => enemy.targetId === ally.id));
    if (allyFocused && ready("bulwark") && useAbility(unit, ready("bulwark"), allyFocused)) return;
    if (allyFocused && ready("taunt") && useAbility(unit, ready("taunt"), chooseEnemyTarget(unit))) return;
    if (low && ready("fortress") && useAbility(unit, ready("fortress"), unit)) return;
    if (ready("shieldSlam")) useAbility(unit, ready("shieldSlam"), chooseEnemyTarget(unit));
  }

  if (unit.roleId === "healer") {
    const injured = alliesOf(unit).filter((ally) => ally.hp < ally.maxHp);
    const emergency = injured.find((ally) => ally.hp / ally.maxHp < 0.45);
    if (emergency && ready("mend") && useAbility(unit, ready("mend"), emergency)) return;
    if (injured.length >= 2 && ready("renewal") && useAbility(unit, ready("renewal"), unit)) return;
    const threatened = alliesOf(unit).find((ally) => enemiesOf(unit).some((enemy) => enemy.targetId === ally.id));
    if (threatened && ready("barrier") && useAbility(unit, ready("barrier"), threatened)) return;
    const mendTarget = injured.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (mendTarget && ready("mend")) useAbility(unit, ready("mend"), mendTarget);
  }

  if (unit.roleId === "dps") {
    // Whirlwind only hits adjacent enemies now, so only swing it when the pack is on you.
    const whirl = ready("whirlwind");
    if (whirl && enemiesInAbilityRange(unit, whirl).length >= 2 && useAbility(unit, whirl, chooseEnemyTarget(unit))) return;
    // Lunge exists to reach the back line. Spend it on the priority target when it
    // is out of reach, not on whatever is already standing in front of us.
    const priority = priorityTarget(unit);
    const diveWorthIt = priority && !inAutoRange(unit, priority) && unit.hp / unit.maxHp > 0.5;
    if (diveWorthIt && ready("lunge") && useAbility(unit, ready("lunge"), priority)) return;
    if (ready("lunge") && !priority && useAbility(unit, ready("lunge"), chooseEnemyTarget(unit))) return;
    if (unit.hp / unit.maxHp < 0.45 && ready("guard")) useAbility(unit, ready("guard"), unit);
  }

  if (unit.roleId === "hunter") {
    // Break contact first: a cornered Hunter is doing half damage.
    if (isPointBlank(unit) && ready("disengage") && useAbility(unit, ready("disengage"), unit)) return;
    const volley = ready("volley");
    if (volley && enemiesInAbilityRange(unit, volley).length >= 2 && useAbility(unit, volley, chooseEnemyTarget(unit))) return;
    if (ready("aimedShot") && useAbility(unit, ready("aimedShot"), chooseEnemyTarget(unit))) return;
    if (unit.hp / unit.maxHp < 0.45 && ready("disengage")) useAbility(unit, ready("disengage"), unit);
  }

  if (unit.roleId === "caster") {
    if (unit.hp / unit.maxHp < 0.5 && ready("focusWard") && useAbility(unit, ready("focusWard"), unit)) return;
    const wave = ready("emberWave");
    if (wave && enemiesInAbilityRange(unit, wave).length >= 2 && useAbility(unit, wave, chooseEnemyTarget(unit))) return;
    if (ready("arcBolt")) useAbility(unit, ready("arcBolt"), chooseEnemyTarget(unit));
  }
}

function spawnSquareAttack() {
  const mechanic = currentEncounter().squareAttack;
  const boss = squareAttackSourceUnit();
  if (!mechanic || !boss || boss.cast) return;
  const targets = living("ally");
  if (!targets.length) return;
  const target = targets[Math.floor(Math.random() * targets.length)];
  boss.cast = {
    abilityId: "squareAttack",
    name: mechanic.castName || "Crushing Ground",
    targetId: target.id,
    elapsed: 0,
    castTime: mechanic.delay,
    interruptible: true
  };
  state.squareAttacks.push({
    sourceId: boss.id,
    row: target.position.row,
    col: target.position.col,
    timer: mechanic.delay,
    maxTimer: mechanic.delay,
    damage: mechanic.damage,
    interrupts: []
  });
}

function updateSquareAttacks(dt) {
  const mechanic = currentEncounter().squareAttack;
  if (!mechanic || !state.combatActive) return;
  state.squareAttackTimer -= dt;
  if (state.squareAttackTimer <= 0) {
    spawnSquareAttack();
    state.squareAttackTimer += mechanic.interval;
  }
  state.squareAttacks.forEach((attack) => {
    attack.timer -= dt;
  });
  const resolving = state.squareAttacks.filter((attack) => attack.timer <= 0);
  state.squareAttacks = state.squareAttacks.filter((attack) => attack.timer > 0);
  resolving.forEach((attack) => {
    const target = unitAt(attack.row, attack.col);
    const attacker = unitById(attack.sourceId);
    if (attacker?.cast?.abilityId === "squareAttack") attacker.cast = null;
    if (attacker && target?.team === "ally") {
      damage(attacker, target, attack.damage);
      showFloatingMessage(target, "SQUARE HIT");
    }
  });
}

// --- Soft enrage --------------------------------------------------------
// Two healers can out-heal two damage dealers forever, which turns a bad pull
// into a fight that never ends. After this grace period the enemies escalate
// until something dies, so no encounter can run indefinitely.
const softEnrageAfter = 45;
const softEnrageStep = 8;
const softEnrageBonus = 0.15;

function updateSoftEnrage(dt) {
  if (!state.combatActive) return;
  state.fightElapsed = (state.fightElapsed || 0) + dt;
  const over = state.fightElapsed - softEnrageAfter;
  const stacks = over <= 0 ? 0 : Math.floor(over / softEnrageStep) + 1;
  if (stacks === state.softEnrageStacks) return;
  state.softEnrageStacks = stacks;
  if (stacks > 0) {
    living("enemy").forEach((unit) => showFloatingMessage(unit, `ENRAGE ${stacks}`));
  }
}

function softEnrageMultiplier(unit) {
  if (unit.team !== "enemy") return 1;
  return 1 + (state.softEnrageStacks || 0) * softEnrageBonus;
}

// --- AI movement --------------------------------------------------------
// Without this, range gating just makes out-of-reach units stand still forever.


// Melee crosses the midline to chase. Everyone else holds their own half —
// including the Tank, which now roams both ally rows but never past the middle.
function canLeaveOwnHalf(unit) {
  return unit.roleId === "dps";
}



// Score a prospective cell for this unit. Higher is better.


function enrageSourceUnit() {
  const mechanic = currentEncounter().enrage;
  if (!mechanic) return null;
  return state.units.find((unit) => unit.team === "enemy" && unit.name === mechanic.sourceName && !unit.dead) || null;
}

// The Warren King's climax: a long, obvious, interruptible cast. Miss it and he hits twice as hard.
function updateEnrage(dt) {
  const mechanic = currentEncounter().enrage;
  if (!mechanic || !state.combatActive) return;
  const boss = enrageSourceUnit();
  if (!boss) return;
  if (boss.cast?.abilityId === "enrage") return;
  state.enrageTimer -= dt;
  if (state.enrageTimer > 0) return;
  if (boss.cast || boss.enemyBarrierTimer > 0) return;
  boss.cast = {
    abilityId: "enrage",
    name: mechanic.castName || "Enrage",
    targetId: null,
    elapsed: 0,
    castTime: mechanic.castTime,
    interruptible: true
  };
  state.enrageTimer = mechanic.interval;
}

function updateRespawns(dt) {
  const mechanic = currentEncounter().respawnAdds;
  if (!mechanic || !state.combatActive) return;
  state.respawnQueue.forEach((respawn) => {
    respawn.timer -= dt;
  });
  const ready = state.respawnQueue.filter((respawn) => respawn.timer <= 0);
  state.respawnQueue = state.respawnQueue.filter((respawn) => respawn.timer > 0);
  ready.forEach((respawn) => {
    const entry = respawn.entry;
    if (unitAt(respawn.row, respawn.col)) {
      respawn.timer = 1;
      state.respawnQueue.push(respawn);
      return;
    }
    const encounter = currentEncounter();
    const unit = createUnit(entry.roleId, "enemy", entry.name, entry.slotKey, encounter.enemyHpMultiplier * (entry.hpMultiplier || 1), entry.positionKey || entry.slotKey, entry, encounter.enemyDamageMultiplier ?? 1);
    state.units = state.units.filter((existing) => existing.id !== unit.id);
    state.units.push(unit);
    state.meters[unit.id] = { damage: 0, healing: 0, interrupts: 0, cc: 0 };
    if (!selectedTarget()) state.selectedTargetId = unit.id;
  });
}

function updateCombat(dt) {
  if (state.countdown > 0) {
    state.countdown -= dt;
    if (state.countdown <= 0) {
      state.combatActive = true;
      state.countdown = 0;
    }
  }

  setAiTargets();
  if (!state.combatActive) return;
  updateSoftEnrage(dt);
  updateSquareAttacks(dt);
  updateEnrage(dt);
  updateRespawns(dt);

  state.units.forEach((unit) => {
    if (unit.dead) return;
    unit.enemyBarrierTimer = Math.max(0, unit.enemyBarrierTimer - dt);
    unit.allyBarrierTimer = Math.max(0, unit.allyBarrierTimer - dt);
    if (unit.enemyBarrierTimer > 0) {
      unit.cast = null;
      if (unit.interruptMessageTimer > 0) unit.interruptMessageTimer -= dt;
      return;
    }
    unit.gcd = Math.max(0, unit.gcd - dt);
    unit.moveTimer = Math.max(0, (unit.moveTimer ?? 0) - dt);
    unit.tauntTimer = Math.max(0, unit.tauntTimer - dt);
    unit.guardTimer = Math.max(0, unit.guardTimer - dt);
    // Dive window expires on its own if you never spend the follow-up.
    if (unit.diveHome) {
      unit.diveTimer -= dt;
      if (unit.diveTimer <= 0) endDive(unit);
    }
    if (unit.interruptMessageTimer > 0) unit.interruptMessageTimer -= dt;
    Object.keys(unit.cooldowns).forEach((key) => {
      unit.cooldowns[key] = Math.max(0, unit.cooldowns[key] - dt);
    });
    if (unit.cast) {
      unit.cast.elapsed += dt;
      if (unit.cast.elapsed >= unit.cast.castTime) finishCast(unit);
    }
    unit.autoTimer -= dt;
    if (unit.autoTimer <= 0 && !unit.cast) {
      processAuto(unit);
      unit.autoTimer += modifiedAutoInterval(unit);
    }
  });

  state.units.forEach(aiTryAbilities);

  const encounter = currentEncounter();
  const bossSourceName = encounter?.respawnAdds?.sourceName;
  const bossDead = bossSourceName && !state.units.some((unit) => unit.team === "enemy" && unit.name === bossSourceName && !unit.dead);
  const enemiesDead = bossDead || living("enemy").length === 0;
  const alliesDead = living("ally").length === 0;
  if (!state.result && (enemiesDead || alliesDead)) {
    state.combatActive = false;
    state.result = enemiesDead ? "PULL CLEARED" : "PARTY DEFEATED";
    renderResult();
  }
}

function renderBattle() {
  renderBattlefield();
  renderLines();
  renderAbilityBar();
  renderPlayerStatsPanel();
  renderMeters();
  const target = selectedTarget();
  const player = unitById(state.playerUnitId);
  let targetLine = "None";
  if (state.pendingReposition) targetLine = "Pick a square to move to";
  else if (target) {
    targetLine = `${target.name} (${roles[target.roleId].name})`;
    if (player && !player.dead && target.team === "enemy") {
      const gap = unitDistance(player, target);
      targetLine += inAutoRange(player, target)
        ? ` · range ${gap}`
        : ` · OUT OF RANGE (${gap})`;
    }
  }
  ui.currentTargetText.textContent = targetLine;
  renderTargetDetail(target);
  ui.currentTargetText.classList.toggle("out-of-range", !!target && !!player && !player.dead && target.team === "enemy" && !inAutoRange(player, target));
  if (player && isPointBlank(player)) ui.currentTargetText.classList.add("point-blank");
  else ui.currentTargetText.classList.remove("point-blank");
  if (state.countdown > 0) {
    ui.countdownOverlay.classList.remove("hidden");
    ui.countdownOverlay.textContent = state.countdown > 1 ? Math.ceil(state.countdown) : "FIGHT";
  } else {
    ui.countdownOverlay.classList.add("hidden");
  }
}

// Everything that used to be crammed onto every unit card now appears once,
// here, for whoever is selected.
function renderTargetDetail(target) {
  if (!ui.targetDetail) return;
  const unit = target || unitById(state.playerUnitId);
  if (!unit) {
    ui.targetDetail.innerHTML = "";
    return;
  }
  const its = unit.isPlayer ? selectedTarget() : unitById(unit.targetId);
  const rows = [];
  rows.push(`<div><span>Role</span><strong>${roles[unit.roleId].name} · ${unit.isPlayer ? "You" : unit.team === "ally" ? "Ally" : "Enemy"}</strong></div>`);
  rows.push(`<div><span>Health</span><strong>${Math.ceil(unit.hp)} / ${unit.maxHp}</strong></div>`);
  if (!unit.dead) {
    rows.push(`<div><span>Attacking</span><strong>${its && !its.dead ? its.name : "nothing"}</strong></div>`);
  }
  if (unit.cast) {
    rows.push(`<div><span>Casting</span><strong>${unit.cast.name}${unit.cast.interruptible ? " (interruptible)" : ""}</strong></div>`);
  }
  const statuses = unitStatuses(unit);
  if (statuses.length) {
    rows.push(`<div class="wide-row"><span>Status</span><strong>${statuses.join(" · ")}</strong></div>`);
  }
  ui.targetDetail.innerHTML = rows.join("");
}

function renderBattlefield() {
  ui.battlefield.innerHTML = "";
  const pending = state.pendingReposition;
  const pendingUnit = pending ? unitById(pending.unitId) : null;
  const pendingAbility = pendingUnit
    ? findAbility(pendingUnit, pending.abilityId)
    : null;
  const repositionCells = pendingUnit && pendingAbility
    ? repositionTargets(pendingUnit, pendingAbility)
    : [];
  for (let row = 0; row < gridRows; row += 1) {
    for (let col = 0; col < gridCols; col += 1) {
      // A wide unit's anchor cell spans its extra columns, so skip the covered ones.
      if (cellIsCovered(row, col)) continue;
      const cell = document.createElement("div");
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      const unit = state.units.find((candidate) => candidate.position.row === row && candidate.position.col === col) || null;
      const squareAttack = squareAttackAt(row, col);
      const respawn = respawnAt(row, col);
      const canMoveHere = !unit && repositionCells.some((c) => c.row === row && c.col === col);
      const wide = unit && unitWidth(unit) > 1;
      cell.className = `cell ${wide ? "cell-wide" : ""} ${squareAttack ? "danger-square" : ""} ${respawn ? "respawn-square" : ""} ${canMoveHere ? "move-square" : ""}`;
      if (squareAttack) {
        const progress = Math.max(0, Math.min(100, (squareAttack.timer / squareAttack.maxTimer) * 100));
        cell.style.setProperty("--danger-progress", `${progress}%`);
        cell.dataset.warning = `${squareAttack.timer.toFixed(1)}s`;
      }
      if (respawn) {
        const progress = Math.max(0, Math.min(100, (respawn.timer / respawn.maxTimer) * 100));
        cell.style.setProperty("--respawn-progress", `${progress}%`);
        cell.dataset.respawn = `${respawn.entry.name} ${respawn.timer.toFixed(1)}s`;
      }
      if (unit) cell.append(renderUnitCard(unit));
      ui.battlefield.append(cell);
    }
  }
}

// Units are tokens on a board, not information cards. A card is a thing you lay
// down; a token is a thing that stands somewhere. Gear cards are the only cards.
// Shapes and symbols follow the spec's prototype shape language (section 5).
const roleTokens = {
  tank: { symbol: "\u25C6", glyph: "shield", label: "Tank" },
  healer: { symbol: "\u271A", glyph: "cross", label: "Healer" },
  dps: { symbol: "\u2694", glyph: "sword", label: "Melee" },
  caster: { symbol: "\u2726", glyph: "staff", label: "Caster" },
  hunter: { symbol: "\u27B3", glyph: "bow", label: "Hunter" }
};

function unitStatuses(unit) {
  const barrierCaster = incomingBarrierCaster(unit.id);
  const statuses = [];
  if (unit.enemyBarrierTimer > 0) statuses.push(`Barriered ${unit.enemyBarrierTimer.toFixed(1)}s`);
  if (unit.allyBarrierTimer > 0) statuses.push(`Barrier ${unit.allyBarrierTimer.toFixed(1)}s`);
  if (barrierCaster && unit.enemyBarrierTimer <= 0 && unit.allyBarrierTimer <= 0) statuses.push(`Incoming CC: ${barrierCaster.name}`);
  if (unit.enraged) statuses.push("ENRAGED: double damage");
  if (isPointBlank(unit)) statuses.push("POINT BLANK: half damage");
  if (isBehindEnemyLines(unit)) statuses.push(`EXPOSED: +${Math.round(exposedDamageBonus * 100)}% damage taken`);
  if (unit.diveHome) statuses.push(`Dive: ${unit.diveActionsLeft} action left, ${unit.diveTimer.toFixed(1)}s`);
  if (unit.guardTimer > 0) statuses.push(`Guarded ${unit.guardTimer.toFixed(1)}s`);
  if (bulwarkForTarget(unit.id)) statuses.push("Bulwark: 50% to Tank");
  if (bulwarkForTank(unit.id)) statuses.push("Bulwark guarding");
  return statuses;
}

// Compact pips so a glance reads the board without a wall of text on every token.
function statusPips(unit) {
  const pips = [];
  const barrierCaster = incomingBarrierCaster(unit.id);
  if (unit.enraged) pips.push({ cls: "enraged", ch: "\u2191", title: "Enraged: double damage" });
  if (isPointBlank(unit)) pips.push({ cls: "pointblank", ch: "\u2716", title: "Point blank: half damage" });
  if (isBehindEnemyLines(unit)) pips.push({ cls: "exposed", ch: "\u26A0", title: "Exposed: extra damage taken" });
  if (unit.guardTimer > 0) pips.push({ cls: "guard", ch: "\u25CF", title: "Guarded" });
  if (unit.allyBarrierTimer > 0) pips.push({ cls: "barrier", ch: "\u25CB", title: "Barrier" });
  if (unit.enemyBarrierTimer > 0) pips.push({ cls: "cc", ch: "\u2739", title: "Controlled" });
  if (barrierCaster && unit.enemyBarrierTimer <= 0 && unit.allyBarrierTimer <= 0) pips.push({ cls: "incoming", ch: "\u25CC", title: "Incoming CC" });
  if (bulwarkForTarget(unit.id) || bulwarkForTank(unit.id)) pips.push({ cls: "bulwark", ch: "\u2b1f", title: "Bulwark link" });
  if (unit.diveHome) pips.push({ cls: "dive", ch: "\u21AF", title: "Diving" });
  return pips;
}

function renderUnitCard(unit) {
  const token = document.createElement("button");
  token.type = "button";
  token.dataset.unitId = unit.id;
  const barrierCaster = incomingBarrierCaster(unit.id);
  const isCastingCc = unit.cast?.abilityId === "barrier";
  const art = roleTokens[unit.roleId] || roleTokens.dps;
  const ultimatePct = Math.max(0, Math.min(100, unit.ultimateCharge || 0));
  token.className = `unit-card unit-token ${unit.team} ${art.glyph} ${unitWidth(unit) > 1 ? "wide" : ""} ${unit.isPlayer ? "player" : ""} ${unit.dead ? "dead" : ""} ${ultimatePct >= 100 ? "ultimate-ready" : ""} ${state.selectedTargetId === unit.id ? "selected" : ""} ${barrierCaster ? "incoming-cc" : ""} ${isCastingCc ? "casting-cc" : ""}`;
  token.title = `${unit.name} — ${art.label}${unit.dead ? " (down)" : ""}`;
  const castProgress = unit.cast ? Math.min(100, (unit.cast.elapsed / unit.cast.castTime) * 100) : 0;
  const bossAttack = unit.id === squareAttackSourceUnit()?.id ? activeBossAttack() : null;
  const castCounter = bossAttack ? ` ${bossAttack.interrupts.length}/2` : "";
  const castTarget = unit.cast ? unitById(unit.cast.targetId) : null;
  const castLabel = unit.interruptMessageTimer > 0
    ? unit.interruptMessage
    : unit.cast ? `${unit.cast.name}${castCounter}` : "";
  const hpPct = Math.max(0, (unit.hp / unit.maxHp) * 100);
  const pips = statusPips(unit);
  const conditions = unitStatuses(unit);
  const target = unitById(unit.targetId);
  const targetHpPct = target ? Math.max(0, (target.hp / target.maxHp) * 100) : 0;
  const owner = unit.isPlayer ? "You" : unit.team === "ally" ? "Ally" : "Enemy";
  token.innerHTML = `
    <svg class="ultimate-border" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true">
      <rect class="ultimate-border-track" x="1.5" y="1.5" width="97" height="117" rx="4" pathLength="100"></rect>
      <rect class="ultimate-border-fill" x="1.5" y="1.5" width="97" height="117" rx="4" pathLength="100" style="stroke-dasharray:${ultimatePct} 100"></rect>
    </svg>
    <div class="battle-card-head">
      <span>${owner}</span>
      <strong>${art.label}</strong>
      <small>${unit.name}</small>
    </div>
    <div class="battle-card-target ${target ? "has-target" : ""}">
      <span>Target</span>
      <strong>${target ? target.name : "None"}</strong>
      <div><i style="width:${targetHpPct}%"></i></div>
      <small>${target ? `${Math.ceil(target.hp)}/${target.maxHp}` : "-"}${target?.cast ? ` · ${target.cast.name}` : ""}</small>
    </div>
    <div class="battle-card-health">
      <span>Health</span><strong>${Math.ceil(unit.hp)}/${unit.maxHp}</strong>
      <div class="hp-bar"><i style="width:${hpPct}%"></i></div>
    </div>
    <div class="battle-card-conditions">
      <span>Conditions</span>
      <div>${conditions.length ? conditions.map((condition) => `<small>${condition}</small>`).join("") : `<small>None</small>`}</div>
    </div>
    <div class="token-pips">${pips.map((p) => `<i class="pip ${p.cls}" title="${p.title}">${p.ch}</i>`).join("")}</div>
    ${
      unit.cast || unit.interruptMessageTimer > 0
        ? `<div class="cast-track"><span style="width:${unit.interruptMessageTimer > 0 ? 100 : castProgress}%"></span><strong>${castLabel}</strong></div>`
        : ""
    }
  `;
  return token;
}

function cellCenter(unit) {
  const wrap = ui.battlefield.parentElement.getBoundingClientRect();
  const cell = ui.battlefield.querySelector(`.cell[data-row="${unit.position.row}"][data-col="${unit.position.col}"]`);
  if (cell) {
    const rect = cell.getBoundingClientRect();
    return {
      x: rect.left - wrap.left + rect.width / 2,
      y: rect.top - wrap.top + rect.height / 2
    };
  }
  const field = ui.battlefield.getBoundingClientRect();
  const styles = getComputedStyle(ui.battlefield);
  const cardWidth = Number.parseFloat(styles.getPropertyValue("--battle-cell-width")) || 100;
  const cardHeight = Number.parseFloat(styles.getPropertyValue("--battle-cell-height")) || 100;
  const gap = Number.parseFloat(styles.gap) || 0;
  return {
    x: field.left - wrap.left + unit.position.col * (cardWidth + gap) + cardWidth / 2,
    y: field.top - wrap.top + unit.position.row * (cardHeight + gap) + cardHeight / 2
  };
}

function renderLines() {
  const wrap = ui.targetLines.parentElement.getBoundingClientRect();
  ui.targetLines.setAttribute("viewBox", `0 0 ${wrap.width} ${wrap.height}`);
  const paths = [];
  const routePath = (source, target) => {
    const a = cellCenter(source);
    const b = cellCenter(target);
    const midX = (a.x + b.x) / 2;
    return `M ${a.x} ${a.y} H ${midX} V ${b.y} H ${b.x}`;
  };
  state.units.filter((unit) => unit.team === "enemy" && unit.roleId !== "healer" && !unit.dead).forEach((unit) => {
    const target = unitById(unit.targetId);
    if (!target || target.dead) return;
    paths.push(`<path d="${routePath(unit, target)}"></path>`);
  });
  state.units.filter((unit) => unit.roleId === "healer" && !unit.dead).forEach((unit) => {
    const target = unitById(unit.cast?.targetId || unit.targetId);
    if (!target || target.dead) return;
    const d = routePath(unit, target);
    if (unit.team === "enemy") {
      paths.push(`<path class="enemy-healer-line enemy-healer-line-red" d="${d}"></path>`);
      paths.push(`<path class="enemy-healer-line enemy-healer-line-green" d="${d}"></path>`);
    } else {
      paths.push(`<path class="ally-healer-line" d="${d}"></path>`);
    }
  });
  activeBulwarkLinks().forEach((link) => {
    const tank = unitById(link.tankId);
    const ally = unitById(link.allyId);
    if (tank && ally && !tank.dead && !ally.dead) {
      const a = cellCenter(tank);
      const b = cellCenter(ally);
      const midY = (a.y + b.y) / 2;
      const d = `M ${a.x} ${a.y} V ${midY} H ${b.x} V ${b.y}`;
      paths.push(`<path class="bulwark-line-glow" d="${d}"></path>`);
      paths.push(`<path class="bulwark-line" d="${d}"></path>`);
    }
  });
  (state.healingBolts || []).forEach((bolt) => {
    const source = unitById(bolt.sourceId);
    const target = unitById(bolt.targetId);
    if (!source || !target) return;
    const progress = Math.max(0, Math.min(1, 1 - bolt.remaining / bolt.duration));
    const offset = 112 - progress * 112;
    const d = routePath(source, target);
    paths.push(`<path class="healing-grid-pulse-glow" pathLength="100" stroke-dasharray="12 100" stroke-dashoffset="${offset}" d="${d}"></path>`);
    paths.push(`<path class="healing-grid-pulse" pathLength="100" stroke-dasharray="7 105" stroke-dashoffset="${offset}" d="${d}"></path>`);
  });
  ui.targetLines.innerHTML = paths.join("");
}

function renderAbilityBar() {
  const player = unitById(state.playerUnitId);
  if (!player) return;
  ui.abilityBar.innerHTML = "";
  unitAbilities(player).forEach((ability, index) => {
    const cooldown = player.cooldowns[ability.id] || 0;
    const maxCooldown = modifiedCooldown(player, ability);
    const isStep = ability.type === "reposition";
    const abilityTarget = isStep ? null : getPlayerAbilityTarget(player, ability);
    const outOfRange = isStep ? repositionTargets(player, ability).length === 0
                              : !inAbilityRange(player, ability, abilityTarget);
    const armed = state.pendingReposition?.abilityId === ability.id;
    const button = document.createElement("button");
    button.className = `ability-button ${outOfRange ? "out-of-range" : ""} ${armed ? "armed" : ""}`;
    button.type = "button";
    button.disabled = !state.combatActive || player.dead || cooldown > 0 || player.gcd > 0 || !!player.cast || !!state.result || outOfRange;
    const readyLabel = armed
      ? "Pick a square"
      : outOfRange
        ? (isStep ? "Nowhere to go" : `Out of range (${abilityRange(ability)})`)
        : ability.castTime ? `${ability.castTime}s cast` : isStep ? `Move ${repositionRange(player, ability)}` : "Ready";
    button.innerHTML = `
      <div class="cooldown-fill" style="height:${Math.min(100, (cooldown / maxCooldown) * 100)}%"></div>
      <strong>${index + 1}. ${ability.name}</strong>
      <small>${cooldown > 0 ? `${cooldown.toFixed(1)}s` : readyLabel}</small>
    `;
    button.addEventListener("click", () => useAbilityByIndex(index));
    ui.abilityBar.append(button);
  });
}

function equippedItemsForRole(roleId) {
  return slots
    .map((slot) => items[state.equipped[slot]])
    .filter((item) => item && item.allowedRoles.includes(roleId));
}

function statRowsForUnit(unit) {
  const role = roles[unit.roleId];
  const stats = roleStats(unit.roleId, "ally");
  const autoBonus = role.auto.type === "heal" ? stats.autoHealing + stats.abilityPower : stats.autoDamage;
  return [
    { label: "HP", base: role.maxHp, bonus: stats.maxHp - role.maxHp, suffix: "" },
    { label: role.auto.type === "heal" ? "Auto H" : "Auto D", base: role.auto.amount, bonus: autoBonus, suffix: "" },
    { label: "Auto CD", base: role.auto.interval, bonus: modifiedAutoIntervalFromStats(unit.roleId, stats) - role.auto.interval, suffix: "s" },
    { label: "AP", base: 0, bonus: stats.abilityPower, suffix: "" },
    { label: "CDR", base: 0, bonus: stats.cooldownReduction * 100, suffix: "%" },
    { label: "Haste", base: 0, bonus: (stats.haste || 0) * 100, suffix: "%" },
    { label: "Range", base: role.auto.range ?? defaultRange, bonus: 0, suffix: "" },
    { label: "Step CD", base: 0, bonus: stats.moveCooldown || 0, suffix: "s" },
    { label: "Step Rng", base: 0, bonus: (stats.moveRange ?? defaultMoveRange) - defaultMoveRange, suffix: "" }
  ];
}

function playerStatsHtml(roleId) {
  const unitLike = { roleId };
  const statRows = statRowsForUnit(unitLike);
  const gear = equippedItemsForRole(roleId);
  return `
    <div class="stat-mini-grid">
      <div class="stat-mini-row stat-mini-head"><strong>Stat</strong><span>Base</span><span>Gear</span><span>Now</span></div>
      ${statRows.map((row) => {
        const bonusText = signedStatValue(row.bonus, row.suffix);
        const baseText = `${formatStatValue(row.base, row.suffix)}${row.suffix}`;
        const finalText = `${formatStatValue(row.base + row.bonus, row.suffix)}${row.suffix}`;
        return `<div class="stat-mini-row"><strong>${row.label}</strong><span>${baseText}</span><span class="bonus-number">${bonusText || "-"}</span><span>${finalText}</span></div>`;
      }).join("")}
    </div>
    <div class="gear-mini-list">
      ${gear.length ? gear.map((item) => `<div><strong>${item.slot}</strong><span>${item.name}</span><b>${item.description}</b></div>`).join("") : `<div><strong>Gear</strong><span>None equipped</span><b>No bonuses</b></div>`}
    </div>
  `;
}

function renderPlayerStatsPanel() {
  const player = unitById(state.playerUnitId);
  if (!player) {
    ui.playerStatsPanel.innerHTML = "";
    return;
  }
  ui.playerStatsPanel.innerHTML = playerStatsHtml(player.roleId);
}

function selectedSheetRoleId() {
  const allies = currentAllyFormation();
  const selected = state.selectedRole === "dps"
    ? allies.find((entry) => entry.slotKey === "allyDps")
    : allies.find((entry) => entry.roleId === state.selectedRole);
  return selected?.roleId || state.selectedRole || allies[0]?.roleId || "tank";
}

function renderStaticCharacterSheets() {
  const html = playerStatsHtml(selectedSheetRoleId());
  [
    ui.rolePlayerStatsPanel,
    ui.lootPlayerStatsPanel,
    ui.equipPlayerStatsPanel,
    ui.modalCharacterSheet
  ]
    .filter(Boolean)
    .forEach((panel) => {
      panel.innerHTML = html;
    });
}

function currentSheetRoleId() {
  const player = unitById(state.playerUnitId);
  if (player) return player.roleId;
  const allies = currentAllyFormation();
  if (state.selectedRole === "dps") return allies.find((entry) => entry.slotKey === "allyDps")?.roleId || "dps";
  return state.selectedRole || "tank";
}

function renderMeters() {
  const order = ["ally-allyTank", "ally-allyHealer", "ally-allyDps", "enemy-enemyTank", "enemy-enemyHealer", "enemy-enemyDamageA", "enemy-enemyDamageB"];
  const units = order.map((id) => unitById(id)).filter(Boolean);
  ui.meterList.innerHTML = `
    <div class="meter-row meter-head">
      <strong>Unit</strong>
      <span>D</span>
      <span>H</span>
      <span>INT</span>
      <span>CC</span>
    </div>
    ${units.map((unit) => {
    const meter = state.meters[unit.id] || { damage: 0, healing: 0, interrupts: 0, cc: 0 };
    return `
      <div class="meter-row ${unit.team}">
        <strong>${unit.name}</strong>
        <span>${Math.round(meter.damage)}</span>
        <span>${Math.round(meter.healing)}</span>
        <span>${meter.interrupts}</span>
        <span>${meter.cc}</span>
      </div>
    `;
  }).join("")}
  `;
}

function renderResult() {
  ui.resultOverlay.classList.remove("hidden");
  if (state.result === "PULL CLEARED") {
    const room = currentRoom();
    if (room && !room.cleared) {
      room.cleared = true;
      state.run.roomsCleared += 1;
    }
    // Roll the run's meter totals up before the units are thrown away.
    const playerMeter = state.meters[state.playerUnitId];
    if (playerMeter && state.run) {
      Object.keys(state.run.totals).forEach((key) => {
        state.run.totals[key] += playerMeter[key] || 0;
      });
    }
    saveGame();
    renderRunTrack();
    ui.resultOverlay.innerHTML = `<div>${currentRoomType().label.toUpperCase()} CLEARED</div>`;
    setTimeout(showLoot, 850);
  } else {
    if (state.run) state.run.wipes += 1;
    saveGame();
    ui.resultOverlay.innerHTML = `<div>PARTY DEFEATED</div><p class="result-note">Loot you have already secured is safe. This room restarts.</p><button class="primary-button" type="button">Retry Room</button>`;
    ui.resultOverlay.querySelector("button").addEventListener("click", () => enterRoom(state.run?.roomIndex ?? 0));
  }
}

function renderRunTrack() {
  if (!ui.runTrack) return;
  if (!state.run) {
    ui.runTrack.innerHTML = "";
    return;
  }
  ui.runTrack.innerHTML = state.run.sequence
    .map((room, index) => {
      const status = index === state.run.roomIndex ? "current" : room.cleared ? "cleared" : "pending";
      const label = room.type === "boss" ? "B" : room.type === "miniboss" ? "M" : String(index + 1);
      return `<span class="run-pip ${room.type} ${status}" title="${encounterLibrary[room.encounterId].name}">${label}</span>`;
    })
    .join("");
}

function advanceRoom() {
  if (!state.run) {
    startRun();
    return;
  }
  if (isFinalRoom()) {
    showRunComplete();
    return;
  }
  enterRoom(state.run.roomIndex + 1);
}

function updateNextFightButton() {
  if (!state.run) {
    ui.nextFightButton.textContent = "Start Run";
    return;
  }
  if (isFinalRoom()) {
    ui.nextFightButton.textContent = "Finish Run";
    return;
  }
  const next = state.run.sequence[state.run.roomIndex + 1];
  const typeLabel = roomTypes[next.type].label;
  ui.nextFightButton.textContent = next.type === "trash"
    ? `Enter ${encounterLibrary[next.encounterId].name}`
    : `Enter ${typeLabel}: ${encounterLibrary[next.encounterId].name}`;
}

function showRunComplete() {
  const run = state.run;
  if (!run) {
    showScreen("role");
    return;
  }
  const dungeon = dungeons[run.dungeonId];
  const securedCounts = run.secured.reduce((acc, itemId) => {
    acc[itemId] = (acc[itemId] || 0) + 1;
    return acc;
  }, {});
  const cardList = Object.entries(securedCounts)
    .map(([itemId, quantity]) => {
      const item = items[itemId];
      return `<li class="run-card rarity-${item.rarity.toLowerCase()}"><strong>${item.name}</strong><span>${item.slot} · ${item.rarity}${quantity > 1 ? ` ×${quantity}` : ""}</span></li>`;
    })
    .join("");
  ui.runSummary.innerHTML = `
    <div class="run-stat"><span>Rooms Cleared</span><strong>${run.roomsCleared} / ${run.sequence.length}</strong></div>
    <div class="run-stat"><span>Cards Secured</span><strong>${run.secured.length}</strong></div>
    <div class="run-stat"><span>Damage Done</span><strong>${Math.round(run.totals.damage)}</strong></div>
    <div class="run-stat"><span>Healing Done</span><strong>${Math.round(run.totals.healing)}</strong></div>
    <div class="run-stat"><span>Interrupts</span><strong>${run.totals.interrupts}</strong></div>
    <div class="run-stat"><span>Wipes</span><strong>${run.wipes}</strong></div>
  `;
  ui.runTitle.textContent = `${dungeon.name} Cleared`;
  ui.runCards.innerHTML = cardList || `<li class="run-card empty">No cards secured.</li>`;
  state.run = null;
  saveGame();
  showScreen("run");
}

function rollLootChoices() {
  const pool = [...currentEncounter().lootPool];
  const rollCount = currentRoomType().rollCount;
  const choices = [];
  while (choices.length < rollCount && pool.length) {
    const index = Math.floor(Math.random() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

function renderLootSelection() {
  const keepCount = currentRoomType().keepCount;
  ui.lootPrompt.textContent = `Choose ${keepCount} of ${state.lootChoices.length} · ${state.lootPicks.length} selected`;
  ui.lootConfirmButton.disabled = state.lootPicks.length !== keepCount;
  ui.lootConfirmButton.textContent = keepCount === 1 ? "Secure Card" : `Secure ${keepCount} Cards`;
  Array.from(ui.lootChoices.children).forEach((button) => {
    button.classList.toggle("picked", state.lootPicks.includes(Number(button.dataset.choiceIndex)));
  });
}

function toggleLootPick(choiceIndex) {
  const keepCount = currentRoomType().keepCount;
  const at = state.lootPicks.indexOf(choiceIndex);
  if (at >= 0) state.lootPicks.splice(at, 1);
  else if (state.lootPicks.length < keepCount) state.lootPicks.push(choiceIndex);
  else {
    // At capacity: replace the oldest pick so a tap always does something.
    state.lootPicks.shift();
    state.lootPicks.push(choiceIndex);
  }
  renderLootSelection();
}

function showLoot() {
  state.lootChoices = rollLootChoices();
  state.lootPicks = [];
  ui.lootChoices.innerHTML = "";
  renderStaticCharacterSheets();
  state.lootChoices.forEach((itemId, choiceIndex) => {
    const item = items[itemId];
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.choiceIndex = String(choiceIndex);
    button.className = `loot-card rarity-${item.rarity.toLowerCase()}`;
    button.innerHTML = `
      <div class="card-rarity">${item.rarity}</div>
      <div class="card-art" aria-hidden="true">
        <span>${item.slot}</span>
        <strong>${item.name.slice(0, 2).toUpperCase()}</strong>
      </div>
      <div class="card-body">
        <h3>${item.name}</h3>
        <p class="stat-line">${item.slot}</p>
        ${item.keywords?.length ? `<strong class="card-keywords" title="${item.keywordHelp}">${item.keywords.join(" · ")}</strong>` : ""}
        <p class="card-rules">${item.description}</p>
      </div>
      <div class="card-footer">${item.allowedRoles.map((roleId) => roles[roleId].name).join(" / ")}</div>
    `;
    button.addEventListener("click", () => toggleLootPick(choiceIndex));
    ui.lootChoices.append(button);
  });
  renderLootSelection();
  showScreen("loot");
}

function confirmLoot() {
  const keepCount = currentRoomType().keepCount;
  if (state.lootPicks.length !== keepCount) return;
  state.lootPicks
    .map((choiceIndex) => state.lootChoices[choiceIndex])
    .forEach((itemId) => {
      const owned = state.collection.find((entry) => entry.itemId === itemId);
      if (owned) owned.quantity += 1;
      else state.collection.push({ itemId, quantity: 1 });
      if (state.run) state.run.secured.push(itemId);
    });
  state.lootPicks = [];
  saveGame();
  renderInventory(ui.equipSlots, ui.collectionCards);
  updateNextFightButton();
  showScreen("equip");
}

function renderInventory(slotRoot = ui.modalEquipSlots, cardRoot = ui.modalCollectionCards) {
  renderStaticCharacterSheets();
  slotRoot.innerHTML = "";
  slots.forEach((slot) => {
    const item = items[state.equipped[slot]];
    const div = document.createElement("div");
    div.className = "slot";
    div.innerHTML = `<span>${slot}</span><strong>${item ? item.name : "Empty"}</strong>`;
    slotRoot.append(div);
  });
  cardRoot.innerHTML = "";
  if (!state.collection.length) {
    cardRoot.innerHTML = `<p class="stat-line">No cards owned yet.</p>`;
    return;
  }
  state.collection.forEach((entry) => {
    const item = items[entry.itemId];
    if (!item) return;
    const article = document.createElement("article");
    article.className = `collection-card rarity-${item.rarity.toLowerCase()}`;
    article.innerHTML = `
      <div>
        <h3>${item.name} x${entry.quantity}</h3>
        <p>${item.slot} · ${item.description}</p>
      </div>
    `;
    const equip = document.createElement("button");
    equip.type = "button";
    equip.textContent = state.equipped[item.slot] === item.id ? "Equipped" : "Equip";
    equip.addEventListener("click", () => {
      state.equipped[item.slot] = item.id;
      saveGame();
      renderInventory(slotRoot, cardRoot);
    });
    const unequip = document.createElement("button");
    unequip.type = "button";
    unequip.textContent = "Unequip";
    unequip.disabled = state.equipped[item.slot] !== item.id;
    unequip.addEventListener("click", () => {
      delete state.equipped[item.slot];
      saveGame();
      renderInventory(slotRoot, cardRoot);
    });
    article.append(equip, unequip);
    cardRoot.append(article);
  });
}

function openInventory() {
  renderInventory();
  ui.inventoryDialog.showModal();
}

function frame(time) {
  const dt = Math.min(0.1, (time - state.lastTime) / 1000 || 0);
  state.lastTime = time;
  if (state.screen === "battle" && !state.result) updateCombat(dt);
  state.renderAccumulator += dt;
  if (state.renderAccumulator > 0.08) {
    state.renderAccumulator = 0;
    if (state.screen === "battle") renderBattle();
  }
  requestAnimationFrame(frame);
}

// A run in progress must announce itself. Previously the Ready button silently
// resumed a saved run, so anything that jumped mid-run (the Miniboss debug jump
// writes roomIndex to storage) stranded you there on every later launch with no
// way back to room 1.
function runInProgress() {
  return !!state.run && state.run.roomIndex > 0;
}

function updateRoleScreenButtons() {
  if (!ui.roleReadyButton) return;
  if (runInProgress()) {
    const room = state.run.sequence[state.run.roomIndex];
    ui.roleReadyButton.textContent = `Resume · Room ${state.run.roomIndex + 1} of ${state.run.sequence.length}`;
    ui.roleReadyButton.title = encounterLibrary[room.encounterId]?.name || "";
    ui.newRunButton?.classList.remove("hidden");
  } else {
    ui.roleReadyButton.textContent = "Ready";
    ui.roleReadyButton.title = "";
    ui.newRunButton?.classList.add("hidden");
  }
}

function ensureSelectedRole() {
  if (!state.selectedRole) {
    state.selectedRole = "tank";
    saveGame();
  }
}

function beginRunFromMenu() {
  ensureSelectedRole();
  if (runInProgress()) enterRoom(state.run.roomIndex);
  else startRun();
}

function beginFreshRun() {
  ensureSelectedRole();
  startRun();
}

ui.roleReadyButton.addEventListener("click", beginRunFromMenu);
ui.newRunButton?.addEventListener("click", beginFreshRun);
// Debug shortcut: jump a fresh run straight to its first miniboss.
ui.minibossButton.addEventListener("click", () => {
  startRun();
  const index = state.run.sequence.findIndex((room) => room.type === "miniboss");
  enterRoom(index >= 0 ? index : 0);
});
ui.nextFightButton.addEventListener("click", advanceRoom);
ui.lootConfirmButton.addEventListener("click", confirmLoot);
ui.returnToCampButton.addEventListener("click", () => {
  renderRoleScreen();
  showScreen("role");
});
ui.replayButton.addEventListener("click", () => enterRoom(state.run?.roomIndex ?? 0));
ui.openInventoryFromRole.addEventListener("click", openInventory);
ui.openInventoryFromBattle.addEventListener("click", openInventory);
ui.closeInventory.addEventListener("click", () => ui.inventoryDialog.close());
ui.battlefield.addEventListener("pointerdown", (event) => {
  const token = event.target.closest(".unit-card");
  const cell = event.target.closest(".cell");
  // A reposition ability is armed: the next cell you tap is the destination.
  if (state.pendingReposition) {
    if (cell) resolvePendingReposition(Number(cell.dataset.row), Number(cell.dataset.col));
    event.preventDefault();
    return;
  }
  if (token) targetUnit(unitById(token.dataset.unitId));
  event.preventDefault();
});

window.addEventListener("keydown", (event) => {
  if (["1", "2", "3", "4", "5", "6"].includes(event.key) && state.screen === "battle") {
    useAbilityByIndex(Number(event.key) - 1);
    event.preventDefault();
  }
});

loadSave();
state.allyDpsVariant = rollAllyDpsVariant();
state.enemyDpsVariants = rollEnemyDpsVariants();
renderRoleScreen();
renderInventory(ui.equipSlots, ui.collectionCards);
showScreen("role");
requestAnimationFrame(frame);
