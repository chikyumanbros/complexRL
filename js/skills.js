/*
 * スキルシステムは部分的に削除されました。
 * 一部のスキル（meditation、jumpなど）は標準アクションとして残されています。
 * モンスターが使用するスキルも保持されています。
 */

// スキルデータを定義
const SKILLS = {
    // ---- Acrobatics Skills ----
    acrobatics: {
        key: 'a',
        name: 'ACROBATICS',
        skills: [
            {
                id: 'jump',
                name: 'Jump',
                desc: 'Jump over enemies. Range based on DEX/CON. (Base: 3, +1 per 3 DEX over CON)',
                isFreeAction: false,
                requiresTarget: true,
                getRange: (player) => {
                    const jumpRange = Math.floor((player.stats.dex - player.stats.con) / 3) + 3;
                    return jumpRange;
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
                    const jumpRange = Math.floor((player.stats.dex - player.stats.con) / 3) + 3;
                    const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                        player.x, player.y,
                        target.x, target.y
                    );
                    
                    if (distance > jumpRange) {
                        game.logger.add(`Too far to jump! (Range: ${jumpRange})`, "warning");
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

                    // ターンを消費
                    return { success: true, skipTurnProcess: false };
                }
            }
        ]
    },
    // ---- Mind Skills ----
    mind: {
        key: 'm',
        name: 'MIND',
        skills: [
            {
                id: 'meditation',
                name: 'Meditation',
                desc: 'Meditate to recover HP and Vigor. Move or take damage to cancel. (HP: WIS/3 per turn, Vigor: d(Level+WIS) with risk, Max turns: WIS/2)',
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

                    const healPerTurn = Math.floor(player.stats.wis / 3);
                    const turnsRemaining = Math.floor(player.stats.wis / 2);
                    const maxVigorRoll = player.level + player.stats.wis;

                    player.meditation = {
                        active: true,
                        soundStarted: false,
                        healPerTurn: healPerTurn,
                        turnsRemaining: turnsRemaining,
                        totalHealed: 0,
                        maxVigorRoll: maxVigorRoll
                    };

                    game.logger.add(`Started meditating... (HP: ${healPerTurn}/turn, Max turns: ${turnsRemaining})`, "playerInfo");
                    game.renderer.render();

                    // 瞑想開始時に効果音をループ再生
                    game.playSound('meditationSound', true); // 第二引数にtrueを渡してループ再生

                    return { success: true, skipTurnProcess: true };
                }
            }
        ]
    }
};