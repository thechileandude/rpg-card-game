# RPG WITH COLLECTIBLE LOOT — CODEX PROTOTYPE 0.2 HANDOFF

## 1. Goal
Build a mobile-first isometric 3-player co-op dungeon crawler prototype centered on short procedural mini-dungeons and collectible, permanent, tradeable gear cards.

The core fantasy is:

> Every enemy is a booster pack you can fight.

Players enter short dungeons in 3-player parties, defeat tactical enemy groups, choose loot cards after each pull, equip those cards, and use their gear to create different combat builds.

This is an MVP. Do not add systems that are not specified here unless they are required technically.

Prototype 0.2 replaces earlier broad MMO assumptions with a focused co-op dungeon crawler architecture:
- 3-player parties.
- 5–10 minute procedural mini-dungeons.
- Tactical mob compositions.
- Personal loot.
- Rewards are kept immediately and never lost.
- Permanent, tradeable gear-card collection.
- Gear creates builds; there are no classes or trait cards.
- Main-hand weapon determines the combat kit.
- First playable target is the generic triangle training pull plus loot/equipment loop.

---

## 2. Core Game Loop

1. Player selects a dungeon.
2. Match into a 3-player party.
3. Enter a small procedurally assembled isometric dungeon.
4. Fight tactical mob pulls.
5. After each completed pull, each player receives a personal loot choice.
6. Player chooses one card and it becomes permanently owned immediately.
7. Continue through two minibosses and one final boss.
8. Keep all loot even if the party later wipes.
9. Return to loadout/collection screen.
10. Equip new gear, trade later, and run another dungeon.

Target run length: approximately 5–10 minutes.

---

## 3. Camera and Platform

- Mobile-first.
- Isometric perspective.
- Touch controls.
- Landscape orientation preferred for the prototype.
- Keep UI readable on a phone screen.

---

## 4. Party Structure

- 3 players per dungeon.
- No traditional character classes.
- No forced Tank / Healer / DPS selection.
- A player's equipped gear determines what role they naturally perform.
- Possible emergent roles include damage, defense, healing/support, crowd control, interruption, or hybrids.

For the first prototype, multiplayer networking may be replaced by 1 human player + 2 simple AI party members if needed to get gameplay working first.

---

## 5. Combat Style

Real-time 3-player co-op dungeon crawler combat.

### Prototype Shape Language
Early prototypes should use simple geometry to make combat roles readable before final art exists.
- Player hero: sphere/circle.
- Fighter archetype: sturdy triangle.
- Ranged archetype: long-range triangle.
- Healer/support archetype: support triangle.
- Melee DPS archetype: aggressive triangle.
- Ranged DPS / hunter archetype: ranged pressure triangle.
- Generic prototype enemy names should be used until final creature theming is chosen: Tank, Healer, Wizard, Ranger, Fighter.
- Archetype symbols: healer cross, tank shield, fighter sword, wizard staff, ranger bow.

These are combat-role silhouettes, not character classes. Gear still determines builds.
Not every enemy action is interruptible. Hunter-style ranged pressure enemies can be intentionally non-interruptible unless a specific casted ability says otherwise.
For combat testing, the first room should contain a Tank, a Healer, and one random DPS archetype.

### Controls
- Direct movement.
- Prototype keyboard movement uses Q/W/E/S as cardinal directions: Q = west, W = up, E = east, S = down.
- Phone/touch movement may replace or reinterpret keyboard controls later.
- Tap an enemy to target it.
- Basic attacks happen automatically against the current target when in range.
- Tap another enemy to switch targets.
- Main-hand weapon provides:
  - Auto attack
  - Ability 1
  - Ability 2
  - Ability 3
  - Ultimate
- Abilities use cooldowns.

### Core Timing Rules
- Auto-attacks occur every 0.5 seconds while the player has a valid target in range.
- A 1-second global cooldown applies after ability use.
- Attack Speed affects only auto-attacks.
- Cooldown Reduction affects only ability cooldowns.
- Cooldown Reduction does not reduce the global cooldown unless explicitly stated by a future card.

### Communication
- Hold-tap enemy to mark it as the team's focus target.
- Marked enemy displays a clear visible target icon to the whole party.
- Future quick-ping wheel may contain: Focus, CC, Retreat, Boss.
- Quick-ping wheel is NOT required for MVP.

### Tactical Combat Requirement
Enemy groups must be designed as compositions rather than random piles of enemies.

Players should sometimes need to:
- Focus a priority target.
- Interrupt dangerous casts.
- Crowd control an enemy.
- Position away from danger.
- Protect or support teammates.

---

## 6. Gear / Card System

All collectible loot is represented as gear cards.

There are NO:
- Character classes.
- Trait cards.
- Separate ability cards.

### Equipment Slots
- Head
- Earring
- Cape
- Chest
- Hands
- Ring
- Belt
- Legs
- Feet
- Trinket
- Main Hand
- Off Hand

Only one item can be equipped in each slot.

### Main-Hand Rule
The main-hand weapon determines the player's primary combat kit:
- Auto attack
- Ability 1
- Ability 2
- Ability 3
- Ultimate

Other equipped gear can modify stats, abilities, cooldowns, movement, defenses, healing, CC, or other combat behaviors.

### Off-Hand
Off-hand design is currently UNDECIDED.

Do not build a deep off-hand system yet.
For MVP, treat off-hand as a passive modifier item only.
The architecture should allow the off-hand system to be expanded later.

---

## 7. Loot Philosophy

Loot is:
- Permanent.
- Tradeable.
- Personally rolled for each player.
- Kept immediately after the player chooses it.
- Never lost because the party wipes later.

Duplicate cards are allowed.

Example inventory:
- Widowstep Boots x3
- Goblin Fangblade x1
- Dragon Helm x2

Only one copy can be equipped in the appropriate slot.

Trading does NOT need to be implemented in the first gameplay prototype, but inventory data should be structured so individual item instances or stack quantities can eventually be traded.

---

## 8. Rarity System

Five rarity tiers:

1. Common
2. Uncommon
3. Rare
4. Epic
5. Legendary

Higher rarity does not have to mean only larger numbers.
Rare cards should often create more specialized or build-defining effects.

---

## 9. Loot Pools

Do not create a completely unique large loot table for every creature.

Cards may belong to shared pools.

### Pool Types
- Region pool
  - Example: Forest, Desert, Swamp
- Creature-family pool
  - Example: Beast, Goblin, Undead, Dragon
- Creature-specific signature pool

A normal creature should usually have only about 2–4 unique signature cards.

Example:

Bramble Rat loot eligibility =
- Forest shared pool
- Beast shared pool
- Bramble Rat signature pool

This keeps the system scalable.

---

## 10. Loot Reward Rules

### Normal Mob Pull
When the entire pull is defeated:
- Each player independently rolls 3 cards.
- Each player chooses 1.
- The chosen card is permanently secured immediately.
- The other 2 disappear.

There is ONE loot event per completed pull, NOT one loot event per individual enemy.

### Miniboss
Initial rule:
- Roll 4 cards.
- Keep 2.

### Final Boss
Initial rule:
- Roll 6 cards.
- Keep 3.

These values should be data-driven so they can be changed easily.

---

## 11. Dungeon Structure

Use short procedural mini-dungeons.

Base structure:

1. Mob Pull
2. Mob Pull
3. Miniboss #1
4. Mob Pull
5. Mob Pull
6. Miniboss #2
7. Mob Pull
8. Final Boss

The exact number of rooms/pulls should be data-driven.

Procedural generation does NOT need to generate complex terrain for MVP.
It can assemble handcrafted combat rooms/modules in randomized order.

### Room Collision and LOS
Prototype combat rooms should have small visible perimeter walls that prevent players, allies, and enemies from leaving the arena.
Rooms may include simple pillars or blockers.
For the current training room, generate 1–3 LOS pillars randomly in the center area on each replay.
Pillars should:
- Block character movement.
- Block line of sight for ranged attacks.
- Block line of sight for enemy casts where appropriate.
- Create tactical positioning choices without requiring complex terrain generation.

Characters should have body collision:
- Player, allies, and enemies cannot stack on top of each other.
- Defeated enemies stop blocking movement so players and allies can walk over them.
- Movement should slide when partially blocked where practical.
- Collision should never prevent a character from moving away from another character they are overlapping.
- Dash/gap-closer abilities such as Lunge should respect walls, pillars, and character bodies.

---

## 12. Death / Wipe Rules

Players never lose already-selected loot.

For MVP:
- If the whole party dies, restart the current encounter or current room.
- Previously secured cards remain owned.
- No permanent inventory penalty.

Avoid punishing loss systems until the combat loop is proven fun.

---

## 13. First Prototype Dungeon

### Name
Darkwood Warren

### Theme
Forest creatures and goblins.

### Intended purpose
Teach:
- Target selection.
- Focus fire.
- Interrupts.
- Enemy priority.
- Basic loot selection.

### Suggested Flow

Pull 1 — Generic role training pull
Pull 2 — Rats + Ratcaller
Miniboss 1 — Brambleback
Pull 3 — Goblin Guards + Archer
Pull 4 — Guard + Shaman + Bomber
Miniboss 2 — Goblin Taskmaster
Pull 5 — Mixed rats/goblins
Final Boss — The Warren King

Only Pull 1 must be fully implemented for the first vertical slice.

---

## 14. Pull #1 — Fully Defined MVP Encounter

### Encounter
Prototype 0.2 uses three generic role enemies before returning to themed Darkwood creatures:
- Tank
- Healer
- One random DPS: Fighter, Wizard, or Ranger

#### Tank
Role: durable melee pressure
- Prototype silhouette: sturdy triangle.
- Runs toward nearest/current target.
- Uses slower basic melee attacks.

#### Healer
Role: priority support enemy
- Prototype silhouette: healer/support triangle.
- Casts interruptible healing on wounded enemies.

#### Wizard
Role: priority spell enemy
- Prototype silhouette: wizard triangle with staff symbol.
- Casts interruptible high-damage spells.

#### Ranger
Role: ranged pressure
- Prototype silhouette: ranged DPS / hunter triangle with bow symbol.
- Keeps distance when practical.
- Fires projectile attacks.
- Does not currently use interruptible casts.

#### Fighter
Role: fast melee pressure
- Prototype silhouette: aggressive triangle.
- Runs toward nearest/current target.
- Uses faster basic melee attacks.

### Friendly AI Healer
Prototype 0.2 includes one allied AI healer.
- Primary behavior: stay as far from the player as possible while remaining inside the range needed to use all of its spells.
- Secondary positioning behavior: bias that max-range position away from nearby enemies.
- If the player moves beyond the healer's spell range, the healer should prioritize following until the player is back in range.
- If the player needs healing but LOS is blocked, the healer should prioritize repositioning until healing is possible.
- Spell priority 1: heal the player when health drops.
- Spell priority 2: interrupt nearby enemy casts when interrupt is available.
- Spell priority 3: crowd-control a nearby threat when CC is available.

### Intended Player Lesson
Players should learn to identify enemy roles, focus priority targets, and interrupt Wizard/Healer casts.

### Basic Flow
1. Party enters room.
2. Three generic enemies aggro: Tank, Healer, and one random DPS.
3. Player can mark a priority target.
4. Wizard or Healer begins a visible cast.
5. Player or allied healer uses an interrupt-capable ability.
6. If interrupted, display clear INTERRUPTED feedback.
7. Kill all enemies.
8. Trigger personal loot screen.

---

## 15. Pull #1 Triangle Training Loot

Each player independently rolls 3 cards and chooses 1.

Prototype 0.2 should roll 3 unique card choices from a larger triangle-themed training pool.

### Triangle Fighter Gloves
- Rarity: Common
- Slot: Hands
- Effect: +2% Attack Speed
- Pool: Training shared pool

### Triangle Skirmisher Boots
- Rarity: Common
- Slot: Feet
- Effect: +3% Movement Speed
- Pool: Training shared pool

### Triangle Interrupter's Earring
- Rarity: Uncommon
- Slot: Earring
- Effect: Successful interrupts grant +10% Attack Speed for 4 seconds.
- Pool: Training signature pool

### Triangle Bulwark Helm
- Rarity: Common
- Slot: Head
- Effect: +8 Max Health
- Pool: Tank / Training shared pool

### Triangle Guard Cape
- Rarity: Uncommon
- Slot: Cape
- Effect: Guard lasts 1 second longer.
- Pool: Tank / Training shared pool

### Triangle Mender Ring
- Rarity: Common
- Slot: Ring
- Effect: +5 Max Health
- Pool: Healer / Training shared pool

### Triangle Focus Belt
- Rarity: Uncommon
- Slot: Belt
- Effect: +5% Cooldown Reduction
- Pool: Wizard / Training shared pool

### Triangle Ranger Leggings
- Rarity: Common
- Slot: Legs
- Effect: +2% Movement Speed and +1% Attack Speed
- Pool: Ranger / Training shared pool

### Triangle Momentum Trinket
- Rarity: Rare
- Slot: Trinket
- Effect: Lunge deals +4 damage.
- Pool: Fighter / Training shared pool

### Triangle Breaker Hands
- Rarity: Rare
- Slot: Hands
- Effect: Kick deals +4 damage.
- Pool: Wizard / Training shared pool

---

## 16. Prototype Starting Weapon

Create one starting main-hand weapon so the player can test the combat system.

### Recruit's Blade
Slot: Main Hand
Rarity: Common

Auto Attack — Slash
- Basic melee damage.
- Attacks every 0.5 seconds.

Ability 1 — Lunge
- Dash a short distance to target and deal damage.
- Cooldown: 4 seconds.
- Actually moves the player toward the targeted enemy, stopping short of blocked terrain or character collision.

Ability 2 — Kick
- Low damage.
- INTERRUPTS enemy casting.
- Cooldown: 8 seconds.
- Prototype range should be forgiving enough to use intentionally during short enemy casts.
- If the current target is not casting, Kick may prioritize a nearby casting enemy.

Ability 3 — Guard
- Reduce incoming damage for a short duration.
- Cooldown: 10 seconds.

Ultimate — Whirlwind
- Damage nearby enemies.
- Cooldown: 30 seconds.

Cooldown and damage values should be easy to change in data/configuration.

---

## 17. UI Needed for MVP

### Combat HUD
- Player health.
- Current target health/name.
- Player auto-attack indicator may live in the HUD; do not draw a player auto bar under the character unless reintroduced deliberately.
- Auto-attacks should show clear hit feedback, such as a quick slash and damage number.
- Live combat numbers should show damage done and healing done per player, ally, and enemy during the fight.
- Ability 1 button + cooldown.
- Ability 2 button + cooldown.
- Ability 3 button + cooldown.
- Ultimate button + cooldown/resource if used.
- Visible enemy cast bar under the character doing the casting.
- Visible auto-attack cooldown bar under Fighter, Ranger, and Tank enemies so incoming basic attacks are readable.
- Focus target marker.

### Loot Screen
After encounter completion:
- Pause or safely suspend combat.
- Show 3 large card choices.
- Card shows name, rarity, slot, effect.
- Tap card to select.
- Confirm selection.
- Add chosen card to permanent inventory.
- Continue dungeon.

### Loadout / Collection Screen
For MVP:
- Show owned cards.
- Show equipped gear slots.
- Allow equipping compatible cards into their slots.
- Show duplicate quantity.

---

## 18. Data-Driven Architecture

Do not hard-code each card/monster directly into combat logic.

Use data definitions for:

### Card
Suggested fields:
- id
- name
- rarity
- slot
- description
- statModifiers
- passiveEffects
- sourcePools
- icon

### Weapon
Additional fields:
- autoAttack
- ability1
- ability2
- ability3
- ultimate

### Ability
Suggested fields:
- id
- name
- damage
- cooldown
- range
- castTime
- interruptPower / canInterrupt
- crowdControlType
- duration
- targetingType

### Enemy
Suggested fields:
- id
- name
- family
- region
- health
- attackPower
- movementSpeed
- abilities
- lootPools
- AI behavior / role

### Encounter
Suggested fields:
- id
- enemy composition
- spawn positions
- reward type

### Dungeon
Suggested fields:
- id
- room pool
- encounter sequence rules
- miniboss encounters
- final boss
- reward settings

Use JSON, ScriptableObjects, Resources, data tables, or equivalent depending on engine.

---

## 19. Recommended Build Order

Codex should implement in this order:

### Milestone 1 — Combat Sandbox
- Isometric room.
- One controllable player.
- Tap-to-target enemy.
- Auto attack.
- Recruit's Blade abilities.
- Cooldowns.
- Enemy health/death.

### Milestone 2 — Tactical Pull
- Tank.
- Healer.
- One random DPS chosen from Fighter, Wizard, or Ranger.
- Allied AI healer.
- Enemy cast bar.
- Interrupt mechanic.
- AI healer support, CC, and interrupt behavior.
- Focus-target marker.
- Encounter completion detection.

### Milestone 3 — Loot
- 3-card loot screen.
- Choose 1.
- Save chosen card permanently.
- Inventory screen.
- Equip card into valid slot.
- Card effects actually modify gameplay.

### Milestone 4 — Party Prototype
- Add 2 AI allies OR networking if appropriate.
- Shared combat encounter.
- Personal independent loot rolls.

### Milestone 5 — Dungeon Run
- Modular rooms.
- Encounter sequence.
- One miniboss placeholder.
- Final boss placeholder.
- Run completion screen.
- Keep all secured loot through wipes/restarts.

Do NOT build trading, large procedural generation, dozens of cards, crafting, PvP, guilds, monetization, story campaign, or open-world exploration before the core loop is fun.

---

## 20. Technical Priorities

Prioritize:
- Fast mobile performance.
- Clean data-driven systems.
- Easy creation of new cards and enemies.
- Easy tuning of damage/cooldowns/drop rates.
- Persistent inventory/save system.
- Combat readable on a small screen.
- Modular encounter design.

Avoid:
- Overengineering.
- Giant inheritance trees.
- Building speculative systems before needed.
- Hard-coding content.

---

## 21. Definition of the First Playable Vertical Slice

The prototype is successful when a player can:

1. Launch the game.
2. Enter one isometric combat room.
3. Fight Tank + Healer + one random DPS: Fighter, Wizard, or Ranger.
4. Tap targets and auto attack.
5. Use Recruit's Blade abilities.
6. See enemy cast bars.
7. Interrupt Wizard or Healer casts with Kick.
8. Kill the full mob pull.
9. Receive 3 loot cards.
10. Choose 1 card.
11. Permanently save that card.
12. Open inventory.
13. Equip the card.
14. Replay the encounter and feel the equipped card's effect.

That is the first goal.

Do not expand the game until this loop works and feels good.

---

## 22. Decisions Explicitly Left Open

Do not invent permanent answers to these yet:
- Final off-hand mechanics.
- Exact multiplayer networking architecture.
- Trading interface/economy.
- Monetization.
- Long-term progression.
- PvP.
- Crafting.
- Character cosmetics.
- Exact dungeon procedural-generation algorithm.
- Exact rarity drop percentages.

Build the architecture so these can be added later without redesigning the entire game.
