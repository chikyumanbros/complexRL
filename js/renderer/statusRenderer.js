class StatusRenderer {
    constructor(game) {
        this.game = game;
    }

    renderStatus() {
        const player = this.game.player;
        const statusPanel = document.getElementById('status-panel');
        if (!statusPanel) return;

        // 既存の計算部分
        const surroundingMonsters = player.countSurroundingMonsters(this.game);
        const penaltyPerMonster = 15;
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

        // 既存のステータス計算
        const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[this.game.dangerLevel];
        const floorDisplay = this.game.floorLevel === 0 ? "< THE NEXUS >" : this.game.floorLevel;
        const healthStatus = player.getHealthStatus(player.hp, player.maxHp);
        const vigorStatus = GAME_CONSTANTS.VIGOR.getStatus(player.vigor, player.stats);
        const size = GAME_CONSTANTS.FORMULAS.SIZE(player.stats);
        const sizeInfo = GAME_CONSTANTS.COLORS.SIZE[size.value];
        const baseSpeed = GAME_CONSTANTS.FORMULAS.SPEED(player.stats);
        const speedInfo = GAME_CONSTANTS.COLORS.SPEED[baseSpeed.value];

        // 既存の計算を維持
        const hpBars = Math.ceil((player.hp / player.maxHp) * 20);
        const hpText = '|'.repeat(Math.max(0, hpBars)).padEnd(20, ' ');

        // Attack modifiers
        let attackText = `${player.attackPower.base}+${player.attackPower.diceCount}d${player.attackPower.diceSides}`;
        let totalDamageMod = 1;
        if (player.nextAttackModifiers?.length > 0) {
            for (const mod of player.nextAttackModifiers) {
                if (mod.damageMod) totalDamageMod *= mod.damageMod;
            }
            if (totalDamageMod !== 1) {
                const damageColor = totalDamageMod > 1 ? '#2ecc71' : '#e74c3c';
                attackText = `<span style="color: ${damageColor}">${player.attackPower.base}+${player.attackPower.diceCount}d${player.attackPower.diceSides} ×${totalDamageMod.toFixed(1)}</span>`;
            }
        }

        // Speed modifiers
        let speedText = `<span style="color: ${speedInfo.color}">${speedInfo.name}</span>`;
        if (player.nextAttackModifiers?.length > 0) {
            const speedTierMod = player.nextAttackModifiers.find(mod => mod.speedTier);
            if (speedTierMod) {
                const modInfo = GAME_CONSTANTS.COLORS.SPEED[speedTierMod.speedTier];
                speedText = `<span style="color: ${modInfo.color}">${modInfo.name}</span>`;
            }
        }

        // Accuracy calculation with penalties and skill modifiers
        let baseAccuracy = player.accuracy;
        let totalAccuracyMod = 0;

        // Apply skill modifiers
        if (player.nextAttackModifiers?.length > 0) {
            for (const mod of player.nextAttackModifiers) {
                if (mod.accuracyMod) {
                    totalAccuracyMod += mod.accuracyMod;
                }
            }
        }

        // Apply surrounding penalty
        const penalizedAccuracy = Math.floor(baseAccuracy * (1 + totalAccuracyMod) * (1 - surroundingPenalty));
        let accText = '';

        if (totalAccuracyMod !== 0 || surroundingPenalty > 0) {
            const color = penalizedAccuracy > baseAccuracy ? '#2ecc71' : '#e74c3c';
            accText = `<span style="color: ${color}">${penalizedAccuracy}%</span>`;
        } else {
            accText = `${baseAccuracy}%`;
        }

        // 通常ステータスまたは遠距離攻撃ステータスを表示（モードによって切り替え）
        const combatStatsHTML = player.rangedCombat.isActive 
            ? this.createRangedCombatStats(player)
            : this.createNormalCombatStats(player, attackText, accText, speedText, sizeInfo);

        // 敵情報の取得
        const nearbyEnemiesHTML = this.getNearbyEnemiesHTML();

        statusPanel.innerHTML = `
            <div class="basic-info">
                <div class="section-title">STATUS</div>
                <div class="info-row" style="justify-content: flex-start; gap: 10px;">
                    <span class="label">Name:</span>
                    <span id="player-name" style="text-align: left; width: auto;">${player.name || 'Unknown'}</span>
                </div>
                <div class="info-row" style="justify-content: flex-start; gap: 10px;">
                    <span class="label">Floor:</span>
                    <span id="floor-level" style="text-align: left; width: auto;">${floorDisplay} <span style="color: ${dangerInfo.color}">[${dangerInfo.name}]</span></span>
                </div>
                <div class="info-row" style="justify-content: flex-start; gap: 10px;">
                    <span class="label">Level:</span>
                    <span id="level" style="text-align: left; width: auto;">${player.level}</span>
                    <span class="label" style="margin-left: 20px;">XP:</span>
                    <span id="xp" style="text-align: left; width: auto;">${player.xp}/${player.xpToNextLevel}</span>
                </div>
            </div>

            <div class="vitals-section">
                <div class="hp-bar">
                    <div class="hp-numbers">
                        HP: <span id="hp">${player.hp}</span>/<span id="max-hp">${player.maxHp}</span>
                    </div>
                    <span id="hp-text" class="bar ${healthStatus.name.toLowerCase().replace(' ', '-')}">${hpText}</span>
                </div>
                <div class="status-text">
                    <div class="status-row">
                        <span class="label">Health:</span>
                        <span id="health-status" style="color: ${healthStatus.color}">${healthStatus.name}</span>
                    </div>
                    <div class="status-row">
                        <span class="label">Vigor:</span>
                        <span id="vigor-status">
                            <span style="color: ${vigorStatus.color}">[${vigorStatus.ascii}]</span>
                            <span class="bar ${vigorStatus.name.toLowerCase().replace(' ', '-')}"></span>
                        </span>
                    </div>
                </div>
            </div>

            ${combatStatsHTML}

            <div class="enemy-info">
                <div class="section-title">ENEMIES</div>
                ${nearbyEnemiesHTML}
            </div>
        `;
    }

    createNormalCombatStats(player, attackText, accText, speedText, sizeInfo) {
        // surroundingsペナルティの計算
        const surroundingMonsters = player.countSurroundingMonsters(this.game);
        const penaltyPerMonster = 15; // 1体につき15%のペナルティ
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

        // ペナルティ適用後のEVA値を計算
        const baseEvasion = player.evasion;
        const penalizedEvasion = Math.floor(baseEvasion * (1 - surroundingPenalty));
        const evaText = surroundingPenalty > 0
            ? `<span style="color: #e74c3c">${penalizedEvasion}%</span>`
            : `${baseEvasion}%`;

        // エネルギーバーの計算（追加）
        let energyBarHTML = '';
        if (player.rangedCombat) {
            const energyPercent = (player.rangedCombat.energy.current / player.rangedCombat.energy.max) * 100;
            const barColor = player.rangedCombat.energy.current === player.rangedCombat.energy.max ? '#2ecc71' :
                            player.rangedCombat.energy.current >= player.rangedCombat.energy.cost ? '#3498db' : '#e74c3c';
            energyBarHTML = `
                <div class="energy-bar">
                    <div class="energy-numbers">Eg: ${Math.floor(player.rangedCombat.energy.current)}/${player.rangedCombat.energy.max}</div>
                    <div class="bar-container">
                        <div class="bar" style="width: ${energyPercent}%; background-color: ${barColor}"></div>
                    </div>
                </div>
            `;
        }

        return `
            ${energyBarHTML}
            <div class="stats-grid">
                <div class="stat-row">
                    <span class="label">STR:</span>
                    <span id="str">${player.stats.str}</span>
                </div>
                <div class="stat-row">
                    <span class="label">DEX:</span>
                    <span id="dex">${player.stats.dex}</span>
                </div>
                <div class="stat-row">
                    <span class="label">CON:</span>
                    <span id="con">${player.stats.con}</span>
                </div>
                <div class="stat-row">
                    <span class="label">INT:</span>
                    <span id="int">${player.stats.int}</span>
                </div>
                <div class="stat-row">
                    <span class="label">WIS:</span>
                    <span id="wis">${player.stats.wis}</span>
                </div>
                <div class="stat-row">
                    <span class="label">SIZE:</span>
                    <span id="size" style="color: ${sizeInfo.color}">${sizeInfo.name}</span>
                </div>
            </div>

            <div class="derived-stats-grid">
                <div class="stat-row">
                    <span class="label">ATK:</span>
                    <span id="attack">${attackText}</span>
                </div>
                <div class="stat-row">
                    <span class="label">DEF:</span>
                    <span id="defense">${player.defense.base}+${player.defense.diceCount}d${player.defense.diceSides}</span>
                </div>
                <div class="stat-row">
                    <span class="label">ACC:</span>
                    <span id="accuracy">${accText}</span>
                </div>
                <div class="stat-row">
                    <span class="label">EVA:</span>
                    <span id="evasion">${evaText}</span>
                </div>
                <div class="stat-row">
                    <span class="label">PER:</span>
                    <span id="perception">${player.perception}</span>
                </div>
                <div class="stat-row">
                    <span class="label">SPD:</span>
                    <span id="speed">${speedText}</span>
                </div>
            </div>
        `;
    }

    createRangedCombatStats(player) {
        const rangedCombat = player.rangedCombat;
        if (!rangedCombat) return '';

        // エネルギーバーの計算
        const energyPercent = (rangedCombat.energy.current / rangedCombat.energy.max) * 100;
        const barColor = rangedCombat.energy.current === rangedCombat.energy.max ? '#2ecc71' :
                        rangedCombat.energy.current >= rangedCombat.energy.cost ? '#3498db' : '#e74c3c';

        // 命中率の計算（ターゲットがいる場合はサイズ補正を含める）
        const baseHitChance = GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ACCURACY(player.stats);
        let accuracyDisplay = `${baseHitChance}%`;
        if (rangedCombat.isActive && rangedCombat.target) {
            const target = this.game.getMonsterAt(rangedCombat.target.x, rangedCombat.target.y);
            if (target) {
                // 周囲のモンスターによるペナルティを先に計算
                const surroundingMonsters = player.countSurroundingMonsters(this.game);
                const penaltyPerMonster = 15;
                const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

                // ペナルティを基本命中率に適用
                const penalizedAccuracy = Math.floor(baseHitChance * (1 - surroundingPenalty));  // baseHitChanceを使用

                // サイズ補正を後から加算
                const sizeModifier = GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.SIZE_ACCURACY_MODIFIER(target.stats);
                const finalAccuracy = Math.min(95, Math.max(5, penalizedAccuracy + sizeModifier));
                
                // サイズ補正に応じて色を変更
                if (sizeModifier !== 0) {
                    accuracyDisplay = `<span style="color: ${sizeModifier > 0 ? '#2ecc71' : '#e74c3c'}">${finalAccuracy}%</span>`;
                } else {
                    accuracyDisplay = `${finalAccuracy}%`;
                }
            }
        }

        // 速度情報の計算
        const baseSpeed = GAME_CONSTANTS.FORMULAS.SPEED(player.stats);
        const rangedSpeed = {
            value: Math.max(1, baseSpeed.value - 1),
            name: GAME_CONSTANTS.COLORS.SPEED[Math.max(1, baseSpeed.value - 1)].name
        };
        const speedInfo = GAME_CONSTANTS.COLORS.SPEED[rangedSpeed.value];

        // 速度表示の作成（基本速度→遠距離速度）
        const speedDisplay = `<span style="color: ${speedInfo.color}">${rangedSpeed.name}</span>`;

        // 周囲のモンスターによるペナルティを計算
        const surroundingMonsters = player.countSurroundingMonsters(this.game);
        let penaltyText = '';
        if (surroundingMonsters > 1) {
            const penaltyPerMonster = 15;
            const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster));
        }

        // ターゲット情報
        let targetInfo = '';
        if (rangedCombat.isActive && rangedCombat.target) {
            const target = this.game.getMonsterAt(rangedCombat.target.x, rangedCombat.target.y);
            if (target) {
                const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                    player.x, player.y,
                    rangedCombat.target.x, rangedCombat.target.y
                );
                targetInfo = `<div class="target-info"><span style="color: #f1c40f">Target: ${target.name} (${distance} tiles away)</span></div>`;
            }
        }

        return `
            <div class="ranged-combat-section">
                <div class="energy-bar">
                    <div class="energy-numbers">Eg: ${Math.floor(rangedCombat.energy.current)}/${rangedCombat.energy.max}</div>
                    <div class="bar-container">
                        <div class="bar" style="width: ${energyPercent}%; background-color: ${barColor}"></div>
                    </div>
                </div>
                <div class="stats-grid">
                    <div class="stat-row">
                        <span class="label">ATK:</span>
                        <span id="attack">${rangedCombat.attack.base}+${rangedCombat.attack.dice.count}d${rangedCombat.attack.dice.sides}</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">ACC:</span>
                        <span id="accuracy">${accuracyDisplay}</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">Range:</span>
                        <span id="range">${rangedCombat.range}</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">Cost:</span>
                        <span id="cost">${rangedCombat.energy.cost}/shot</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">Re.C:</span>
                        <span id="recharge">${rangedCombat.energy.rechargeRate}/turn</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">SPD:</span>
                        <span id="speed">${speedDisplay}</span>
                    </div>
                </div>
                ${targetInfo}
                ${penaltyText}
            </div>
        `;
    }

    getNearbyEnemiesHTML() {
        // 視界内のタイルを取得
        const visibleTiles = this.game.getVisibleTiles();
        const visibleTilesSet = new Set(visibleTiles.map(({ x, y }) => `${x},${y}`));

        // 視界内のモンスターのみをフィルタリング
        const visibleMonsters = this.game.monsters
            .filter(monster => {
                const monsterKey = `${monster.x},${monster.y}`;
                // モンスターが視界内のタイルにいるかどうかを判定
                return visibleTilesSet.has(monsterKey);
            })
            .map(monster => ({
                ...monster,
                distance: GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                    this.game.player.x,
                    this.game.player.y,
                    monster.x,
                    monster.y
                )
            }))
            .sort((a, b) => a.distance - b.distance);

        if (visibleMonsters.length === 0) {
            return '<div id="nearby-enemies">No monsters in sight</div>';
        }

        const monsterList = visibleMonsters.map(monster => {
            const hpPercentage = (monster.hp / monster.maxHp) * 100;
            const healthStatus = this.getMonsterHealthStatus(hpPercentage / 100);
            const healthClass = healthStatus.name ? healthStatus.name.toLowerCase().replace(' ', '-') : '';

            const sleepStatus = monster.isSleeping ? 'Zzz' : '';
            const fleeingStatus = monster.hasStartedFleeing ? '>>' : '';
            
            // 出血状態の確認とデバッグ情報
            let bleedingStatus = '';
            if (monster.bleedingEffects && monster.bleedingEffects.length > 0) {
                bleedingStatus = '<span style="color: #ff0000">♥</span>';
            }
            
            const monsterSymbol = monster.char || 'M';
            const monsterColor = GAME_CONSTANTS.COLORS.MONSTER[monster.type];

            const dx = monster.x - this.game.player.x;
            const dy = monster.y - this.game.player.y;
            const direction = this.getDirectionIndicator(dx, dy);
            const directionColor = this.getDirectionColor(monster.distance);

            const hpBars = Math.ceil((monster.hp / monster.maxHp) * 20);
            const hpText = '|'.repeat(hpBars).padEnd(20, ' ');

            // ターゲット中のモンスターかどうかをチェック
            const isTargeted = this.game.player.rangedCombat.isActive && 
                this.game.player.rangedCombat.target &&
                monster.x === this.game.player.rangedCombat.target.x && 
                monster.y === this.game.player.rangedCombat.target.y;

            // モンスターの名前を表示（ターゲット中の場合は黄色の[]で囲む）
            const monsterName = isTargeted ? 
                `<span style="color: #ffff00">[${monster.name}]</span>` : 
                monster.name;

            return `<span style="color: ${monsterColor}">` +
                `<span style="color: ${directionColor}; display: inline-block; width: 2em">${direction}</span>[${monsterSymbol}] </span>` +
                `<span style="color: ${monsterColor}">${monsterName}</span> ${sleepStatus}${fleeingStatus}${bleedingStatus} <br>` +
                `<div class="hp-bar">` +
                    `<div class="hp-numbers">HP: ${monster.hp}/${monster.maxHp}</div>` +
                    `<span class="bar ${healthClass}">${hpText}</span>` +
                `</div>`;
        }).join('');

        return `<div id="nearby-enemies">${monsterList}</div>`;
    }

    getDirectionIndicator(dx, dy) {
        if (dx === 0 && dy === 0) return '@';
        
        // 方向を8方向に単純化
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        // 角度を8方向に変換
        if (angle >= -22.5 && angle < 22.5) return '→';
        if (angle >= 22.5 && angle < 67.5) return '↘';
        if (angle >= 67.5 && angle < 112.5) return '↓';
        if (angle >= 112.5 && angle < 157.5) return '↙';
        if (angle >= 157.5 || angle < -157.5) return '←';
        if (angle >= -157.5 && angle < -112.5) return '↖';
        if (angle >= -112.5 && angle < -67.5) return '↑';
        if (angle >= -67.5 && angle < -22.5) return '↗';
        
        return '?'; // 万が一の場合
    }

    getDirectionColor(distance) {
        if (distance <= 1) return '#e74c3c'; // 赤（隣接）
        if (distance <= 3) return '#e67e22'; // オレンジ（近い）
        if (distance <= 6) return '#f1c40f'; // 黄色（中距離）
        return '#2ecc71'; // 緑（遠い）
    }

    getMonsterHealthStatus(hpPercentage) {
        if (hpPercentage <= 0.25) {
            return { name: 'Near Death', color: '#e74c3c' };
        } else if (hpPercentage <= 0.5) {
            return { name: 'Badly Wounded', color: '#e67e22' };
        } else if (hpPercentage <= 0.75) {
            return { name: 'Wounded', color: '#f1c40f' };
        }
        return { name: 'Healthy', color: '#2ecc71' };
    }
} 