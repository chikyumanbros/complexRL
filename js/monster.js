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
        this.codexPoints = template.codexPoints;

        // ステータスをコピー
        this.stats = { ...template.stats };

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
         // 睡眠状態チェック
         if (this.isSleeping) {
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            // プレイヤーが隣接している場合は起床
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
                this.isSleeping = false;
                game.logger.add(`${this.name} wakes up!`, "monsterInfo");
            }
            return; // 睡眠中は行動しない
        }

        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // プレイヤーが視界内にいるか、近距離で音が聞こえる場合
        if ((distance <= this.perception && this.hasLineOfSight(game)) || 
            (distance <= Math.min(3, this.perception / 2))) {  // 近距離なら壁越しでも気付く
            if (!this.hasSpottedPlayer) {
                const spotType = distance <= Math.min(3, this.perception / 2) ? "hears" : "spots";
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
                    if (this.canMoveTo(this.x + moveX, this.y + moveY, game.map)) {
                        this.x += moveX;
                        this.y += moveY;
                    }
                }
            }
        }
    }

    canMoveTo(x, y, map) {
        return x >= 0 && x < map[0].length &&
               y >= 0 && y < map.length &&
               map[y][x] === 'floor';
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
            mp: `${this.mp}/${this.maxMp}`,
            stats: this.stats,
            derived: {
                attack: `${this.attackPower.base}+${this.attackPower.diceCount}d${this.attackPower.diceSides}`,
                defense: this.defense,
                accuracy: this.accuracy,
                evasion: this.evasion
            }
        };
    }

    // 視線チェックメソッドを追加
    hasLineOfSight(game) {
        const points = this.getLinePoints(this.x, this.y, game.player.x, game.player.y);
        
        // プレイヤーの位置を除く全ての点をチェック
        for (let i = 0; i < points.length - 1; i++) {
            const point = points[i];
            if (game.map[point.y][point.x] !== 'floor') {
                return false;  // 壁があったら視線が通らない
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
        ];

        let bestMove = null;
        let bestDistance = Infinity;

        for (const move of possibleMoves) {
            const newX = this.x + move.x;
            const newY = this.y + move.y;
            
            if (this.canMoveTo(newX, newY, game.map) && !game.getMonsterAt(newX, newY)) {
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

    static spawnRandomMonster(x, y, floorLevel) {
        const monsterTypes = Object.keys(GAME_CONSTANTS.MONSTERS);
        const weightedTypes = [];
        
        // フロア階層に応じて出現モンスターを制限
        monsterTypes.forEach(type => {
            const level = GAME_CONSTANTS.MONSTERS[type].level;
            if (level <= Math.floor(floorLevel + 2)) {  // 現在のフロア+2までのレベルのモンスターを許可
                const weight = Math.max(0, 10 - (level - floorLevel));  // レベル差が小さいほど出現率が高い
                weightedTypes.push(...Array(weight).fill(type));
            }
        });

        const selectedType = weightedTypes[
            Math.floor(Math.random() * weightedTypes.length)
        ];
        return new Monster(selectedType, x, y);
    }
} 