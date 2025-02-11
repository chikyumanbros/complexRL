// ========================== Monster Class ==========================
class Monster {
    static nextId = 1;  // クラス変数としてIDカウンターを追加

    // -------------------------- Constructor: Initialization --------------------------
    constructor(type, x, y, game) {
        this.id = Monster.nextId++;  // 一意のIDを割り当て
        // --- Template Initialization ---
        const template = GAME_CONSTANTS.MONSTERS[type];
        this.type = type;
        this.x = x;
        this.y = y;
        this.game = game;
        this.char = template.char;
        this.name = template.name;
        this.level = template.level;
        this.exp = template.exp;
        
        // --- Stat Variation ---
        // ステータスをコピーして変動を加える
        this.stats = {};
        for (const [stat, value] of Object.entries(template.stats)) {
            // 基本値の±10%の範囲でランダムに変動
            const variation = Math.floor(value * 0.2 * (Math.random() - 0.5));
            this.stats[stat] = Math.max(1, value + variation);
        }
        
        // --- Codex Points Calculation ---
        // codexPointsを計算（一時的な計算式）
        const basePoints = 1;
        const wisBonus = 1 + Math.max(0, (this.stats.wis - 10) * 0.125);
        const levelBonus = 1 + ((this.level - 1) * 0.5);
        this.codexPoints = Math.max(1, Math.floor(basePoints * wisBonus * levelBonus));
        
        // --- Derived Parameters ---
        // 派生パラメータを計算
        this.maxHp = GAME_CONSTANTS.FORMULAS.MAX_HP(this.stats, this.level);
        this.hp = this.maxHp;
        this.attackPower = GAME_CONSTANTS.FORMULAS.ATTACK(this.stats);
        this.defense = GAME_CONSTANTS.FORMULAS.DEFENSE(this.stats);
        this.accuracy = GAME_CONSTANTS.FORMULAS.ACCURACY(this.stats);
        this.evasion = GAME_CONSTANTS.FORMULAS.EVASION(this.stats);
        this.perception = GAME_CONSTANTS.FORMULAS.PERCEPTION(this.stats);
        
        // --- Tracking Parameters ---
        // 追跡関連のパラメータを追加
        this.hasSpottedPlayer = false;
        this.lastKnownPlayerX = null;
        this.lastKnownPlayerY = null;
        this.trackingTurns = 0;  // 追跡継続ターン数
        this.maxTrackingTurns = 5;  // 最大追跡ターン数
        // 睡眠状態の初期化（知能が低いほど眠りやすい）
        const sleepChance = GAME_CONSTANTS.FORMULAS.SLEEP_CHANCE(this.stats);
        this.isSleeping = Math.random() * 100 < sleepChance;
        
        // --- Fleeing Parameters ---
        // 逃走関連のパラメータを追加
        // 知能が高いほど早めに逃走、力が高いほど粘り強く戦う
        const baseThreshold = 0.3; // 基本閾値30%
        const wisModifier = (this.stats.wis - 10) * 0.02; // 知能による修正（±2%ずつ）
        const strModifier = (10 - this.stats.str) * 0.01; // 力による修正（±1%ずつ）
        this.fleeThreshold = Math.min(0.8, Math.max(0.1, baseThreshold + wisModifier + strModifier));
        this.hasStartedFleeing = false;
        
        // --- Healing Parameters ---
        // 回復関連のパラメータを追加
        this.healingDice = GAME_CONSTANTS.FORMULAS.HEALING_DICE(this.stats);
        this.healModifier = GAME_CONSTANTS.FORMULAS.HEAL_MODIFIER(this.stats);
        
        // モンスター生成時に個体固有の色情報を生成
        this.spriteColors = {};
        const sprite = GAME_CONSTANTS.MONSTER_SPRITES[type];
        if (sprite) {
            // スプライトで使用される各文字に対して固有の色を生成
            for (let row of sprite) {
                for (let char of row) {
                    if (char !== ' ' && !this.spriteColors[char]) {
                        const baseColor = GAME_CONSTANTS.SPRITE_COLORS[char];
                        this.spriteColors[char] = GAME_CONSTANTS.SPRITE_COLORS.getRandomizedColor(baseColor);
                    }
                }
            }
        }
    }

    // ========================== takeDamage Method ==========================
    takeDamage(amount, game) {
        const damage = Math.max(1, amount);
        this.hp -= damage;

        // 睡眠状態の解除判定を追加
        if (this.isSleeping) {
            const wakeupChance = 80;  // 攻撃を受けた時は高確率で起床
            if (Math.random() * 100 < wakeupChance) {
                this.isSleeping = false;
                game.logger.add(`${this.name} wakes up!`, "monsterInfo");
            }
        }

        // 派生パラメータの再計算
        this.updateStats();

        const result = {
            damage: damage,
            killed: this.hp <= 0,
            evaded: false,
            codexPoints: this.hp <= 0 ? this.codexPoints : 0,
            newlyFled: false
        };

        // 睡眠状態でない場合のみ、逃走判定を行う
        if (!this.isSleeping && !this.hasStartedFleeing && this.shouldFlee()) {
            this.hasStartedFleeing = true;
            result.newlyFled = true;
        }

        return result;
    }

    // ========================== updateStats Method ==========================
    // 新規: モンスターの派生ステータスを更新するメソッド
    updateStats() {
        // HPの最大値を超えないように制限
        this.hp = Math.min(this.hp, this.maxHp);
        
        // 攻撃力の再計算
        this.attackPower = GAME_CONSTANTS.FORMULAS.ATTACK(this.stats);
        
        // 防御力の再計算
        this.defense = GAME_CONSTANTS.FORMULAS.DEFENSE(this.stats);
        
        // 命中率の再計算
        this.accuracy = GAME_CONSTANTS.FORMULAS.ACCURACY(this.stats);
        
        // 回避率の再計算
        this.evasion = GAME_CONSTANTS.FORMULAS.EVASION(this.stats);
        
        // 知覚の再計算
        this.perception = GAME_CONSTANTS.FORMULAS.PERCEPTION(this.stats);
    }

    // ========================== checkEscapeRoute Method ==========================
    // 逃げ場があるかチェックする新しいメソッド
    checkEscapeRoute(game) {
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        
        const moveDirections = [];
        if (dx > 0) moveDirections.push({x: -1, y: 0});
        else if (dx < 0) moveDirections.push({x: 1, y: 0});
        if (dy > 0) moveDirections.push({x: 0, y: -1});
        else if (dy < 0) moveDirections.push({x: 0, y: 1});
        if (dx > 0 && dy > 0) moveDirections.push({x: -1, y: -1});
        if (dx < 0 && dy > 0) moveDirections.push({x: 1, y: -1});
        if (dx > 0 && dy < 0) moveDirections.push({x: -1, y: 1});
        if (dx < 0 && dy < 0) moveDirections.push({x: 1, y: 1});

        for (const dir of moveDirections) {
            const newX = this.x + dir.x;
            const newY = this.y + dir.y;
            if (this.canMoveTo(newX, newY, game) && !game.getMonsterAt(newX, newY)) {
                return true;
            }
        }
        return false;
    }

    // ========================== act Method (Monster's Turn Actions) ==========================
    act(game) {
        // --- Action Reset ---
        // 既に行動済みの場合はスキップ
        if (this.hasActedThisTurn) {
            this.hasActedThisTurn = false;  // 次のターンのために状態をリセット
            return;
        }
        
        // --- Natural Healing ---
        // 自然回復の処理を最初に実行
        if (this.hp < this.maxHp) {
            const successChance = 20 + Math.floor(this.stats.con / 5);
            const successRoll = Math.floor(Math.random() * 100);
            
            if (successRoll <= successChance) {
                let healAmount = 0;
                for (let i = 0; i < this.healingDice.count; i++) {
                    healAmount += Math.floor(Math.random() * this.healingDice.sides) + 1;
                }
                healAmount = Math.max(0, healAmount + this.healModifier);

                if (healAmount > 0) {
                    const oldHp = this.hp;
                    this.hp = Math.min(this.maxHp, this.hp + healAmount);
                    const actualHeal = this.hp - oldHp;
                    if (actualHeal > 0) {
                        // HPが閾値を超えた場合、即座にflee状態を解除
                        if (this.hasStartedFleeing && (this.hp / this.maxHp) > this.fleeThreshold) {
                            this.hasStartedFleeing = false;
                        }
                    }
                }
            }
        }

        // --- Fleeing Action ---
        // flee状態の場合は逃走処理を実行して終了
        if (this.hasStartedFleeing) {
            this.flee(game);
            return;
        }

        // --- Sleep State Check ---
        // 睡眠状態チェック
        if (this.isSleeping) {
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            let wakeupChance = 0;
            
            // プレイヤーが隣接している場合は高確率で起床
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
                wakeupChance = 80 + this.perception * 2;
            } 
            // 近くで戦闘が行われた場合
            else if (game.lastCombatLocation && distance <= this.perception) {
                const combatDx = game.lastCombatLocation.x - this.x;
                const combatDy = game.lastCombatLocation.y - this.y;
                const combatDistance = Math.sqrt(combatDx * combatDx + combatDy * combatDy);
                wakeupChance = Math.max(0, (this.perception - combatDistance) * 15);
            }
            
            if (wakeupChance > 0 && Math.random() * 100 < wakeupChance) {
                this.isSleeping = false;
                game.logger.add(`${this.name} wakes up!`, "monsterInfo");
            }
            return; // 睡眠中は行動しない
        }

        // --- Player Detection and Pursuit ---
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // プレイヤーが視界内にいるか、近距離で音が聞こえる場合
        // 閉じた扉越しの場合は音の伝達距離を半減
        const soundRange = Math.min(3, this.perception / 2);
        const hasDoorBetween = this.hasClosedDoorBetween(game, game.player.x, game.player.y);
        const effectiveSoundRange = hasDoorBetween ? soundRange / 2 : soundRange;

        if ((distance <= this.perception && this.hasLineOfSight(game)) || 
            (distance <= effectiveSoundRange)) {
            if (!this.hasSpottedPlayer) {
                // --- Player Spotted ---
                // プレイヤーの視界内にいる場合
                const isVisibleToPlayer = game.getVisibleTiles()
                    .some(tile => tile.x === this.x && tile.y === this.y);
                
                if (isVisibleToPlayer) {
                    const spotType = distance <= effectiveSoundRange ? "hears" : "spots";
                    game.logger.add(`${this.name} ${spotType} you!`, "monsterInfo");
                } else {
                    // プレイヤーのperceptionが高い場合、気配を感じ取る
                    const playerPerception = GAME_CONSTANTS.FORMULAS.PERCEPTION(game.player.stats);
                    if (distance <= playerPerception) {
                        game.logger.add(`You sense the presence of something nearby...`, "playerInfo");
                    }
                }
                this.hasSpottedPlayer = true;
            }
            this.lastKnownPlayerX = game.player.x;
            this.lastKnownPlayerY = game.player.y;
            this.trackingTurns = this.maxTrackingTurns;
            
            this.pursueTarget(game, game.player.x, game.player.y);
        } 
        // --- Pursuing When Player Out of Sight ---
        else if (this.trackingTurns > 0 && this.lastKnownPlayerX !== null) {
            this.trackingTurns--;
            this.pursueTarget(game, this.lastKnownPlayerX, this.lastKnownPlayerY);
            
            // 追跡終了時
            if (this.trackingTurns === 0) {
                this.hasSpottedPlayer = false;
                this.lastKnownPlayerX = null;
                this.lastKnownPlayerY = null;
            }
        }
        // --- Wandering Behavior ---
        else {
            this.hasSpottedPlayer = false;
            this.lastKnownPlayerX = null;
            this.lastKnownPlayerY = null;
            
            // ランダムな方向に移動（20%の確率）
            if (Math.random() < 0.2) {
                const directions = [
                    [-1, -1], [0, -1], [1, -1],
                    [-1,  0],          [1,  0],
                    [-1,  1], [0,  1], [1,  1]
                ];
                const [moveX, moveY] = directions[Math.floor(Math.random() * directions.length)];
                
                if (!game.getMonsterAt(this.x + moveX, this.y + moveY)) {
                    if (this.canMoveTo(this.x + moveX, this.y + moveY, game)) {
                        this.x += moveX;
                        this.y += moveY;
                    }
                }
            }
        }
    }

    // ========================== canMoveTo Utility Method ==========================
    canMoveTo(x, y, game) {
        // --- Map Boundary Check ---
        if (x < 0 || x >= game.map[0].length || y < 0 || y >= game.map.length) {
            return false;
        }
        
        // --- Closed Door Check ---
        if (game.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
            return false;
        }
        
        return game.map[y][x] === 'floor';
    }

    // ========================== attackPlayer Method ==========================
    attackPlayer(player, game) {
        // 睡眠中は攻撃できない
        if (this.isSleeping) {
            return;
        }

        // --- Combat Setup ---
        game.lastCombatMonster = this;
        game.renderer.examineTarget(this.x, this.y);

        const hitChance = this.accuracy;
        const roll = Math.floor(Math.random() * 100);
        game.logger.add(`${this.name} attacks! (ACC: ${Math.floor(hitChance)}% | Roll: ${roll})`, "monsterInfo");
        
        if (roll >= hitChance) {
            game.logger.add(`${this.name}'s attack misses!`, "monsterMiss");
            return;
        }

        // --- Evade Check ---
        const evadeRoll = Math.random() * 100;
        const evadeChance = player.evasion;
        if (evadeRoll < evadeChance) {
            game.logger.add(`You dodge ${this.name}'s attack! (EVA: ${Math.floor(evadeChance)}% | Roll: ${Math.floor(evadeRoll)})`, "playerEvade");
            return;
        }

        // --- Damage Roll Calculation ---
        let attackRolls = [];
        let damage = this.attackPower.base;
        for (let i = 0; i < this.attackPower.diceCount; i++) {
            const diceRoll = Math.floor(Math.random() * this.attackPower.diceSides) + 1;
            attackRolls.push(diceRoll);
            damage += diceRoll;
        }

        let defenseRolls = [];
        let defense = player.defense.base;
        for (let i = 0; i < player.defense.diceCount; i++) {
            const diceRoll = Math.floor(Math.random() * player.defense.diceSides) + 1;
            defenseRolls.push(diceRoll);
            defense += diceRoll;
        }

        const finalDamage = Math.max(1, damage - defense);
        const result = player.takeDamage(finalDamage);
        
        // --- Damage Logging ---
        game.logger.add(
            `${this.name} hits you for ${result.damage} damage! ` +
            `(ATK: ${this.attackPower.base}+[${attackRolls.join(',')}] ` +
            `vs DEF: ${player.defense.base}+[${defenseRolls.join(',')}])`,
            "monsterHit"
        );
    }

    // ========================== getStatus Method ==========================
    getStatus() {
        return {
            name: this.name,
            level: this.level,
            hp: `${this.hp}/${this.maxHp}`,
            stats: this.stats,
            derived: {
                attack: `${this.attackPower.base}+${this.attackPower.diceCount}d${this.attackPower.diceSides}`,
                defense: `${this.defense.base}+${this.defense.diceCount}d${this.defense.diceSides}`,
                speed: `${GAME_CONSTANTS.FORMULAS.SPEED(this.stats)}`,
                accuracy: Math.floor(this.accuracy),
                evasion: Math.floor(this.evasion)
            }
        };
    }

    // ========================== hasLineOfSight Method ==========================
    // 視線チェックメソッドを追加
    hasLineOfSight(game) {
        const points = this.getLinePoints(this.x, this.y, game.player.x, game.player.y);
        
        // プレイヤーの位置を除く全ての点をチェック
        for (let i = 0; i < points.length - 1; i++) {
            const point = points[i];
            // 壁または閉じた扉があれば視線が通らない
            if (game.map[point.y][point.x] !== 'floor' || 
                game.tiles[point.y][point.x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                return false;
            }
        }
        return true;
    }

    // ========================== getLinePoints Utility Method ==========================
    // 2点間の経路上の全ての点を取得
    getLinePoints(x0, y0, x1, y1) {
        const points = [];
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let x = x0;
        let y = y0;

        while (true) {
            points.push({x: x, y: y});
            
            if (x === x1 && y === y1) break;
            
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        return points;
    }

    // ========================== pursueTarget Method ==========================
    // 目標に向かって移動するメソッド
    pursueTarget(game, targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;

        // プレイヤーに隣接している場合は攻撃
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && 
            targetX === game.player.x && targetY === game.player.y) {
            this.attackPlayer(game.player, game);
            return;
        }

        // --- Better Path Selection ---
        const possibleMoves = [
            { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
            { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }
        ].filter(move => {
            const newX = this.x + move.x;
            const newY = this.y + move.y;
            return !game.getMonsterAt(newX, newY);
        });

        let bestMove = null;
        let bestDistance = Infinity;

        for (const move of possibleMoves) {
            const newX = this.x + move.x;
            const newY = this.y + move.y;
            
            if (this.canMoveTo(newX, newY, game)) {
                const newDistance = Math.abs(targetX - newX) + Math.abs(targetY - newY);
                if (newDistance < bestDistance) {
                    bestDistance = newDistance;
                    bestMove = move;
                }
            }
        }

        if (bestMove) {
            this.x += bestMove.x;
            this.y += bestMove.y;
        }
    }

    // ========================== spawnRandomMonster Static Method ==========================
    static spawnRandomMonster(x, y, floorLevel, dangerLevel = 'NORMAL', game) {
        // --- Level Adjustment Based on Danger ---
        // 危険度に基づくレベル修正
        const dangerData = GAME_CONSTANTS.DANGER_LEVELS[dangerLevel];
        const effectiveLevel = Math.max(1, floorLevel + dangerData.levelModifier);

        // --- Filter Available Monster Types ---
        // 出現可能なモンスターの種類をフィルタリング
        const availableTypes = Object.entries(GAME_CONSTANTS.MONSTERS)
            .filter(([_, data]) => data.level <= effectiveLevel + 2)
            .map(([type, _]) => type);

        // --- Weighting Based on Level Difference ---
        // レベルに近いモンスターが出やすいように重み付け
        const weightedTypes = availableTypes.map(type => {
            const levelDiff = Math.abs(GAME_CONSTANTS.MONSTERS[type].level - effectiveLevel);
            const weight = Math.max(0, 10 - levelDiff * 2);
            return { type, weight };
        });

        // --- Random Selection Based on Weight ---
        const totalWeight = weightedTypes.reduce((sum, { weight }) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const { type, weight } of weightedTypes) {
            random -= weight;
            if (random <= 0) {
                return new Monster(type, x, y, game);
            }
        }

        // フォールバック（通常は実行されない）
        return new Monster(availableTypes[0], x, y, game);
    }

    // ========================== shouldFlee Method ==========================
    // 逃走すべきか判断するメソッド
    shouldFlee() {
        return (this.hp / this.maxHp) <= this.fleeThreshold;
    }

    // ========================== flee Method ==========================
    // 逃走行動を実行するメソッド
    flee(game) {
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        
        // --- Evaluate All Directions ---
        // 全方向の移動候補を評価
        const candidates = [];
        
        // 8方向の移動を評価
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                if (x === 0 && y === 0) continue;
                
                const newX = this.x + x;
                const newY = this.y + y;
                
                if (this.canMoveTo(newX, newY, game) && !game.getMonsterAt(newX, newY)) {
                    const newDx = game.player.x - newX;
                    const newDy = game.player.y - newY;
                    const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);
                    
                    // プレイヤーから遠ざかる移動のみを候補とする
                    if (newDistance > currentDistance) {
                        candidates.push({
                            x: x,
                            y: y,
                            distance: newDistance
                        });
                    }
                }
            }
        }
        
        // --- Sorting Candidates by Distance ---
        // 距離でソート
        candidates.sort((a, b) => b.distance - a.distance);
        
        // --- Fallback Attack if No Escape ---
        // 逃げ場がない場合のみ攻撃
        if (candidates.length === 0 && Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            this.attackPlayer(game.player, game);
            return false;
        }
        
        // --- Execute Best Escape Move ---
        // 最も遠ざかる移動を実行
        if (candidates.length > 0) {
            const best = candidates[0];
            this.x += best.x;
            this.y += best.y;
            return true;
        }
        
        return false;
    }

    // ========================== hasClosedDoorBetween Method ==========================
    // 新規: プレイヤーとの間に閉じた扉があるかチェックするメソッド
    hasClosedDoorBetween(game, targetX, targetY) {
        const points = this.getLinePoints(this.x, this.y, targetX, targetY);
        
        for (let i = 0; i < points.length - 1; i++) {
            const point = points[i];
            if (game.tiles[point.y][point.x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                return true;
            }
        }
        return false;
    }

    getHealthStatus(currentHp, maxHp) {
        return GAME_CONSTANTS.HEALTH_STATUS.getStatus(currentHp, maxHp, this.stats);
    }
} 