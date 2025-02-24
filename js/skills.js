// スキルデータを定義
const SKILLS = {
    // ---- Combat Skills ----
    combat: {
        key: 'c',
        name: 'COMBAT',
        skills: [
            { 
                // --- Power Strike Skill ---
                id: 'powerStrike',
                name: 'Power Strike',
                desc: 'Channel STR for power, sacrificing DEX accuracy (Base: DMG +50%, ACC -30%, scales with STR/DEX)',
                cost: 25,
                cooldown: 8,
                isFreeAction: true,  // フリーアクションとして設定
                requiresTarget: false,
                learned: false,  // スキルの習得状態を追加
                getEffectText: (player) => {
                    // STRとDEXの比率でスケーリング
                    const strRatio = player.stats.str / player.stats.dex;
                    // ダメージボーナスは40-80%の範囲
                    const damageBonus = Math.min(0.8, Math.max(0.4, 0.5 * strRatio));
                    // 命中ペナルティは20-40%の範囲
                    const accuracyPenalty = Math.min(0.4, Math.max(0.2, 0.3 * strRatio));
                    
                    return `[DMG: +${Math.floor(damageBonus * 100)}%, ACC: -${Math.floor(accuracyPenalty * 100)}%]`;
                },
                effect: (game, player) => {
                    const strRatio = player.stats.str / player.stats.dex;
                    const damageBonus = Math.min(0.8, Math.max(0.4, 0.5 * strRatio));
                    const accuracyPenalty = -Math.min(0.4, Math.max(0.2, 0.3 * strRatio));

                    // 配列が未初期化の場合は初期化
                    if (!player.nextAttackModifiers) {
                        player.nextAttackModifiers = [];
                    }

                    player.nextAttackModifiers.push({
                        name: 'Power Strike',
                        damageMod: 1 + damageBonus,
                        accuracyMod: accuracyPenalty,
                        duration: 1
                    });
                    
                    game.logger.add(
                        `You prepare a powerful strike! ${game.codexSystem.findSkillById('powerStrike').getEffectText(player)}`, 
                        "playerInfo"
                    );
                    game.renderer.render();
                    game.renderer.showNextAttackModifierEffect(player.x, player.y);

                    // 効果音を再生
                    game.playSound('nextAttackModifierSound');

                    return true;
                }
            },
            { 
                // --- Quick Slash Skill ---
                id: 'quick', 
                name: 'Quick Slash', 
                cost: 20, 
                cooldown: 12,
                desc: 'Swift attack that improves accuracy and speed. (Base: ACC +20%, temporarily increases speed tier)',
                getEffectText: (player) => {
                    const currentSpeed = GAME_CONSTANTS.FORMULAS.SPEED(player.stats);
                    const speedNames = ["Very Slow", "Slow", "Normal", "Fast", "Very Fast"];
                    const newSpeedIndex = Math.min(4, speedNames.indexOf(currentSpeed.name) + 1);
                    return `[ACC: +20%, SPD: ${currentSpeed.name} > ${speedNames[newSpeedIndex]}]`;
                },
                isFreeAction: true,
                requiresTarget: false,
                learned: false,
                effect: (game, player) => {
                    // 配列が未初期化の場合は初期化
                    if (!player.nextAttackModifiers) {
                        player.nextAttackModifiers = [];
                    }

                    const currentSpeed = GAME_CONSTANTS.FORMULAS.SPEED(player.stats);
                    const speedNames = ["Very Slow", "Slow", "Normal", "Fast", "Very Fast"];
                    const newSpeedIndex = Math.min(4, speedNames.indexOf(currentSpeed.name) + 1);
                    const speedBoost = Math.min(5, currentSpeed.value + 1);

                    player.nextAttackModifiers.push({
                        name: 'Quick Slash',
                        damageMod: 1,
                        accuracyMod: 0.2,
                        speedTier: speedBoost,
                        duration: 1
                    });
                    
                    game.logger.add(
                        `You prepare a quick strike! ${game.codexSystem.findSkillById('quick').getEffectText(player)}`, 
                        "playerInfo"
                    );
                    game.renderer.render();
                    game.renderer.showNextAttackModifierEffect(player.x, player.y);

                    // 効果音を再生
                    game.playSound('nextAttackModifierSound');

                    return true;
                }
            }
        ]
    },
    // ---- Acrobatics Skills ----
    acrobatics: {
        key: 'a',
        name: 'ACROBATICS',
        skills: [
            {
                // --- Jump Skill ---
                id: 'jump',
                name: 'Jump',
                desc: 'Jump over enemies. Range based on DEX/CON. (Base: 3, +1 per 3 DEX over CON)',
                cost: 30,
                cooldown: 30,
                isFreeAction: false,
                requiresTarget: true,
                getRange: (player) => {
                    return Math.floor((player.stats.dex - player.stats.con) / 3) + 3;
                },
                getEffectText: (player) => {
                    const jumpRange = Math.floor((player.stats.dex - player.stats.con) / 3) + 3;
                    return `[Range: ${jumpRange}]`;
                },
                effect: (game, player, target) => {
                    // ---- Visibility Check ----
                    const visibleTiles = game.getVisibleTiles();
                    const isVisible = visibleTiles.some(tile =>
                        tile.x === target.x && tile.y === target.y
                    );

                    if (!isVisible) {
                        game.logger.add("Can't jump to unseen location!", "warning");
                        return false;
                    }

                    // ---- Distance Check ----
                    const distance = GAME_CONSTANTS.SKILL_DISTANCE.calculate(
                        player.x, player.y, target.x, target.y
                    );

                    // ジャンプの有効範囲を計算
                    const jumpRange = Math.floor((player.stats.dex - player.stats.con) / 3) + 3;

                    if (distance > jumpRange) {
                        game.logger.add("Too far to jump!", "warning");
                        return false;
                    }

                    // ---- Check Destination Validity ----
                    const targetTile = game.tiles[target.y][target.x];
                    // 閉じたドアへのジャンプを禁止
                    if (targetTile === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                        game.logger.add("Can't jump through closed doors!", "warning");
                        return false;
                    }
                    // 壁、スペース、cyberwallへのジャンプを禁止
                    if (
                        GAME_CONSTANTS.TILES.WALL.includes(targetTile) ||
                        targetTile === 'space' ||
                        targetTile === 'cyberwall'
                    ) {
                        game.logger.add("Can't jump there!", "warning");
                        return false;
                    }

                    // ---- Monster Presence Check ----
                    if (game.getMonsterAt(target.x, target.y)) {
                        game.logger.add("Can't jump onto a monster!", "warning");
                        return false;
                    }

                    // ---- Save Current Position ----
                    const fromX = player.x;
                    const fromY = player.y;

                    // ---- Show Movement Effect ----
                    game.renderer.showMovementTrailEffect(fromX, fromY, target.x, target.y);

                    // ---- Execute Jump ----
                    player.x = target.x;
                    player.y = target.y;

                    game.logger.add("Jump!", "playerAction");

                    // ジャンプの効果音を再生
                    game.playSound('jumpSound');

                    return { success: true, skipTurnProcess: true };  // ターン処理をスキップするフラグを追加
                }
            }
        ]
    },
    // ---- Defense Skills ----
    defense: {
        key: 'd',
        name: 'DEFENSE',
        skills: [
            { 
                // --- Shield Block Skill ---
                id: 'block', 
                name: 'Shield Block', 
                cost: 20, 
                desc: 'Passive defense boost',
                getEffectText: (player) => {
                    return `[DEF: +20%]`;
                },
                isFreeAction: true,
                requiresTarget: false,
                learned: false
            },
            { 
                // --- Armor Master Skill ---
                id: 'armor', 
                name: 'Armor Master', 
                cost: 35, 
                desc: 'Improved defense from all sources',
                getEffectText: (player) => {
                    return `[DEF: +35%]`;
                },
                isFreeAction: true,
                requiresTarget: false,
                learned: false
            }
        ]
    },
    // ---- Mind Skills ----
    mind: {
        key: 'm',
        name: 'MIND',
        skills: [
            {
                // --- Meditation Skill ---
                id: 'meditation',
                name: 'Meditation',
                desc: 'Meditate to recover HP and Vigor. Move or take damage to cancel. (HP: WIS/3 per turn, Vigor: d(Level+WIS) with risk, Max turns: WIS/2)',
                cost: 30,
                cooldown: 100,
                isFreeAction: false,
                requiresTarget: false,
                cancelOnDamage: true,
                getEffectText: (player) => {
                    const healPerTurn = Math.floor(player.stats.wis / 3);
                    const maxTurns = Math.floor(player.stats.wis / 2);
                    const maxVigorRoll = player.level + player.stats.wis;
                    return `[HP: ${healPerTurn}/turn, Vigor: d${maxVigorRoll}, ${maxTurns} turns]`;
                },
                effect: (game, player) => {
                    // ---- Status Check ----
                    if (player.hp >= player.maxHp && player.vigor >= GAME_CONSTANTS.VIGOR.MAX) {
                        game.logger.add("Cannot meditate as both HP and Vigor are full.", "warning");
                        return false;
                    }

                    if (player.meditation && player.meditation.active) {
                        game.logger.add("Already meditating！", "warning");
                        return false;
                    }

                    player.meditation = {
                        active: true,
                        initialDelay: true,
                        healPerTurn: Math.floor(player.stats.wis / 3),
                        turnsRemaining: Math.floor(player.stats.wis / 2),
                        totalHealed: 0
                    };

                    game.logger.add("Started meditating...", "playerInfo");
                    game.renderer.render();

                    // 瞑想開始時に効果音をループ再生
                    game.playSound('meditationSound', true); // 第二引数にtrueを渡してループ再生

                    return { success: true, skipTurnProcess: true };
                }
            }
        ]
    },
};