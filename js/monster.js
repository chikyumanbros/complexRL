class Monster {
    constructor(type, x, y) {
        const template = GAME_CONSTANTS.MONSTERS[type];
        this.type = type;
        this.x = x;
        this.y = y;
        this.char = template.char;
        this.name = template.name;
        this.level = template.level;
        this.exp = template.exp;
        
        // ステータスをコピーして変動を加える
        this.stats = {};
        for (const [stat, value] of Object.entries(template.stats)) {
            // 基本値の±10%の範囲でランダムに変動
            const variation = Math.floor(value * 0.2 * (Math.random() - 0.5));
            this.stats[stat] = Math.max(1, value + variation);
        }
        
        // codexPointsを計算（一時的な計算式）
        const basePoints = 1;
        const wisBonus = 1 + Math.max(0, (this.stats.wis - 10) * 0.125);
        const levelBonus = 1 + ((this.level - 1) * 0.5);
        this.codexPoints = Math.max(1, Math.floor(basePoints * wisBonus * levelBonus));
        
        // 派生パラメータを計算
        this.maxHp = GAME_CONSTANTS.FORMULAS.MAX_HP(this.stats, this.level);
        this.hp = this.maxHp;
        this.attackPower = GAME_CONSTANTS.FORMULAS.ATTACK(this.stats);
        this.defense = GAME_CONSTANTS.FORMULAS.DEFENSE(this.stats);
        this.accuracy = GAME_CONSTANTS.FORMULAS.ACCURACY(this.stats);
        this.evasion = GAME_CONSTANTS.FORMULAS.EVASION(this.stats);
        this.perception = GAME_CONSTANTS.FORMULAS.PERCEPTION(this.stats);
        
        // 追跡関連のパラメータを追加
        this.hasSpottedPlayer = false;
        this.lastKnownPlayerX = null;
        this.lastKnownPlayerY = null;
        this.trackingTurns = 0;  // 追跡継続ターン数
        this.maxTrackingTurns = 5;  // 最大追跡ターン数
                // 睡眠状態の初期化（知能が低いほど眠りやすい）
                const sleepChance = GAME_CONSTANTS.FORMULAS.SLEEP_CHANCE(this.stats);
        this.isSleeping = Math.random() * 100 < sleepChance;
        
        // 逃走関連のパラメータを追加
        this.fleeThreshold = 0.3; // HPが30%以下になったら逃走を検討
        this.hasStartedFleeing = false;

        // 回復関連のパラメータを追加
        this.healingDice = GAME_CONSTANTS.FORMULAS.HEALING_DICE(this.stats);
        this.healModifier = GAME_CONSTANTS.FORMULAS.HEAL_MODIFIER(this.stats);
    }

    takeDamage(amount) {
        const damage = Math.max(1, amount);
        this.hp -= damage;
        return {
            damage: damage,
            killed: this.hp <= 0,
            evaded: false,
            codexPoints: this.hp <= 0 ? this.codexPoints : 0
        };
    }

    act(game) {
        // もしこのターン中に既に行動済みなら、処理をスキップする
        if (this.hasActedThisTurn) {
            delete this.hasActedThisTurn;
            return;
        }
        // ここから通常の自然回復、睡眠状態、追跡・攻撃処理などを実行
        // 自然回復の処理（flee状態でも回復するように修正）
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
                        
                        // If HP exceeds 30%, cancel fleeing state
                        if (this.hasStartedFleeing && (this.hp / this.maxHp) > this.fleeThreshold) {
                            this.hasStartedFleeing = false;
                        }
                    }
                }
            }
        }

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

        // 逃走判定を追加
        if (this.shouldFlee()) {
            if (!this.hasStartedFleeing) {
                game.logger.add(`${this.name} has fled!`, "monsterInfo");
                this.hasStartedFleeing = true;
            }
            this.flee(game);
            return;
        }

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
                const spotType = distance <= effectiveSoundRange ? "hears" : "spots";
                game.logger.add(`${this.name} ${spotType} you!`, "monsterInfo");
                this.hasSpottedPlayer = true;
            }
            this.lastKnownPlayerX = game.player.x;
            this.lastKnownPlayerY = game.player.y;
            this.trackingTurns = this.maxTrackingTurns;
            
            this.pursueTarget(game, game.player.x, game.player.y);
        } 
        // プレイヤーが視界外だが追跡中の場合
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
        // 通常の徘徊
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

    canMoveTo(x, y, game) {
        return x >= 0 && x < game.map[0].length &&
               y >= 0 && y < game.map.length &&
               game.map[y][x] === 'floor' &&
               game.tiles[y][x] !== GAME_CONSTANTS.TILES.DOOR.CLOSED;
    }

    attackPlayer(player, game) {
        // 命中判定
        const roll = Math.random() * 100;
        game.logger.add(`${this.name} attacks! (ACC: ${this.accuracy}% | Roll: ${Math.floor(roll)})`, "monsterInfo");

        if (roll >= this.accuracy) {
            game.logger.add(`${this.name} misses you!`, "monsterMiss");
            return;
        }

        // 回避判定
        const evadeRoll = Math.random() * 100;
        const evadeChance = player.evasion;
        
        if (evadeRoll < evadeChance) {
            game.logger.add(`You evade the ${this.name}'s attack! (EVA: ${Math.floor(evadeChance)}% | Roll: ${Math.floor(evadeRoll)})`, "playerEvade");
            return;
        }

        // ダメージ計算
        const damage = GAME_CONSTANTS.FORMULAS.rollDamage(this.attackPower, player.defense);
        const result = player.takeDamage(damage);
        
        // ダメージログの詳細化
        const attackRoll = this.attackPower.base + 
            `+${this.attackPower.diceCount}d${this.attackPower.diceSides}`;
        const defenseRoll = player.defense.base + 
            `+${player.defense.diceCount}d${player.defense.diceSides}`;
            
        game.logger.add(
            `${this.name} hits you for ${result.damage} damage! ` +
            `(ATK: ${attackRoll} vs DEF: ${defenseRoll})`, 
            "monsterHit"
        );
        
        if (player.hp <= 0) {
            game.logger.add("You have been killed!", "death");
        }
    }

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

        // より賢い経路選択
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

        // 移動できない場合はその場で待機（ログ追加）
        if (!bestMove) {
            return;
        }

        this.x += bestMove.x;
        this.y += bestMove.y;
    }

    static spawnRandomMonster(x, y, floorLevel, dangerLevel = 'NORMAL') {
        // 危険度に基づくレベル修正
        const dangerData = GAME_CONSTANTS.DANGER_LEVELS[dangerLevel];
        const effectiveLevel = Math.max(1, floorLevel + dangerData.levelModifier);

        // 出現可能なモンスターの種類をフィルタリング
        const availableTypes = Object.entries(GAME_CONSTANTS.MONSTERS)
            .filter(([_, data]) => data.level <= effectiveLevel + 2)  // 効果レベル+2までのモンスターを許可
            .map(([type, _]) => type);

        // レベルに近いモンスターが出やすいように重み付け
        const weightedTypes = availableTypes.map(type => {
            const levelDiff = Math.abs(GAME_CONSTANTS.MONSTERS[type].level - effectiveLevel);
            const weight = Math.max(0, 10 - levelDiff * 2);  // レベル差が大きいほど重みが小さく
            return { type, weight };
        });

        // 重み付けに基づいてモンスターを選択
        const totalWeight = weightedTypes.reduce((sum, { weight }) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const { type, weight } of weightedTypes) {
            random -= weight;
            if (random <= 0) {
                return new Monster(type, x, y);
            }
        }

        // フォールバック（通常は実行されない）
        return new Monster(availableTypes[0], x, y);
    }

    // 逃走すべきか判断するメソッド
    shouldFlee() {
        return (this.hp / this.maxHp) <= this.fleeThreshold;
    }

    // 逃走行動を実行するメソッド
    flee(game) {
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        
        // プレイヤーが隣接している場合は攻撃
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            this.attackPlayer(game.player, game);
            return true;
        }
        
        // プレイヤーの反対方向に移動
        const moveDirections = [];
        
        // X方向の移動を決定
        if (dx > 0) moveDirections.push({x: -1, y: 0});
        else if (dx < 0) moveDirections.push({x: 1, y: 0});
        
        // Y方向の移動を決定
        if (dy > 0) moveDirections.push({x: 0, y: -1});
        else if (dy < 0) moveDirections.push({x: 0, y: 1});
        
        // 斜め方向の移動も追加
        if (dx > 0 && dy > 0) moveDirections.push({x: -1, y: -1});
        if (dx < 0 && dy > 0) moveDirections.push({x: 1, y: -1});
        if (dx > 0 && dy < 0) moveDirections.push({x: -1, y: 1});
        if (dx < 0 && dy < 0) moveDirections.push({x: 1, y: 1});

        // ランダムに移動方向を選択して移動を試みる
        for (const dir of moveDirections.sort(() => Math.random() - 0.5)) {
            const newX = this.x + dir.x;
            const newY = this.y + dir.y;
            
            if (this.canMoveTo(newX, newY, game) && !game.getMonsterAt(newX, newY)) {
                this.x = newX;
                this.y = newY;
                return true; // 逃走成功
            }
        }

        return false; // 逃走失敗
    }

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
} 