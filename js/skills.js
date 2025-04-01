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
                desc: 'Jump over enemies. Range based on DEX/CON. (Base: 3, +1 per 3 DEX over CON) Costs 10 energy per tile.',
                isFreeAction: false,
                requiresTarget: true,
                getRange: (player) => {
                    const jumpRange = Math.floor((player.stats.dex - player.stats.con) / 3) + 3;
                    return jumpRange;
                },
                getEffectText: (player) => {
                    const jumpRange = Math.floor((player.stats.dex - player.stats.con) / 3) + 3;
                    return `[Range: ${jumpRange}, Cost: 10/tile]`;
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

                    // ---- Energy Check ----
                    const energyCost = distance * 10;
                    if (!player.rangedCombat || player.rangedCombat.energy.current < energyCost) {
                        game.logger.add(`Not enough energy to jump! (Need: ${energyCost})`, "warning");
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

                    // ---- Consume Energy ----
                    player.rangedCombat.energy.current -= energyCost;
                    
                    game.logger.add(`Jump! (${energyCost} energy used)`, "playerAction");

                    // ジャンプの効果音を再生
                    game.playSound('jumpSound');

                    // ---- Check if landed on web ----
                    const web = game.webs && game.webs.find(w => w.x === target.x && w.y === target.y);
                    if (web) {
                        game.logger.add("You land on a web and become entangled!", "warning");
                        player.caughtInWeb = web;
                        game.playSound('webTrapSound');
                    }

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
                desc: 'Meditate to recover HP. Move or take damage to cancel. (HP: WIS/3 per turn, Max turns: WIS/2, Cost: 10 energy/turn)',
                isFreeAction: false,
                requiresTarget: false,
                cancelOnDamage: true,
                getEffectText: (player) => {
                    const healPerTurn = Math.floor(player.stats.wis / 2) + 1;
                    const maxTurns = 10;
                    return `[HP: ${healPerTurn}/turn, ${maxTurns} turns, Energy: 10/turn]`;
                },
                effect: (game, player) => {
                    // ---- Status Check ----
                    if (player.hp >= player.maxHp) {
                        game.logger.add("Cannot meditate as HP is full.", "warning");
                        return false;
                    }

                    if (player.meditation && player.meditation.active) {
                        game.logger.add("Already meditating！", "warning");
                        return false;
                    }
                    
                    // ---- Energy Check ----
                    if (!player.rangedCombat || player.rangedCombat.energy.current < 10) {
                        game.logger.add("Not enough energy to meditate! (Need: 10)", "warning");
                        return false;
                    }

                    const healPerTurn = Math.floor(player.stats.wis / 2) + 1;
                    const turnsRemaining = 10;

                    player.meditation = {
                        active: true,
                        soundStarted: false,
                        healPerTurn: healPerTurn,
                        turnsRemaining: turnsRemaining,
                        totalHealed: 0
                    };

                    // ---- Consume Energy ----
                    player.rangedCombat.energy.current -= 10;

                    // サイケデリックエフェクトを追加
                    game.renderer.psychedelicTurn += 5;

                    game.logger.add(`Started meditating... (HP: ${healPerTurn}/turn, Max turns: ${turnsRemaining}, Energy: 10/turn)`, "playerInfo");
                    game.renderer.render();

                    // 瞑想開始時に効果音をループ再生
                    game.playSound('meditationSound', true); // 第二引数にtrueを渡してループ再生

                    return { success: true, skipTurnProcess: true };
                }
            }
        ]
    }
};