// ========================== Monster Class ==========================
class Monster {
    static nextId = 1;  // クラス変数としてIDカウンターを追加

    // -------------------------- Constructor: Initialization --------------------------
    constructor(type, x, y, game) {
        if (!game) {
            console.error('Game object is undefined in Monster constructor');
        }
        this.game = game;
        this.id = Monster.nextId++;  // 一意のIDを割り当て
        // --- Template Initialization ---
        const template = MONSTERS[type];
        this.type = type;
        this.x = x;
        this.y = y;
        this.char = template.char;
        this.name = template.name;
        this.level = template.level;
        this.exp = template.exp;
        
        // --- Stat Variation ---
        // ステータスをコピーして変動を加える
        this.stats = {};
        for (const [stat, value] of Object.entries(template.stats)) {
            const minPercent = GAME_CONSTANTS.STATS.VARIATION.MIN_PERCENT;
            const maxPercent = GAME_CONSTANTS.STATS.VARIATION.MAX_PERCENT;
            const variation = value * (minPercent + Math.random() * (maxPercent - minPercent)) / 100;
            this.stats[stat] = Math.max(
                GAME_CONSTANTS.STATS.MIN_VALUE,
                Math.min(GAME_CONSTANTS.STATS.MAX_VALUE, Math.floor(value + variation))
            );
        }
        
        // --- Special Abilities Initialization ---
        // 特殊能力の初期化
        if (template.abilities) {
            this.abilities = JSON.parse(JSON.stringify(template.abilities)); // ディープコピー
            
            // ジャンプ能力の初期化
            if (this.abilities.canJump) {
                this.jumpCooldownRemaining = 0; // 初期状態ではクールダウンなし
            }
            
            // 蜘蛛の巣能力の初期化
            if (this.abilities.canCreateWeb) {
                this.webCooldownRemaining = 0; // 初期状態ではクールダウンなし
            }
            
            // 遠距離攻撃能力の初期化
            if (this.abilities.canUseRangedAttack) {
                this.rangedAttackCooldownRemaining = 0; // 初期状態ではクールダウンなし
            }
        } else {
            this.abilities = {}; // 空のオブジェクトを作成
        }
        
        // --- Codex Points Calculation ---
        // codexPointsを計算（一時的な計算式）
        const basePoints = 1;
        const wisBonus = 1 + Math.max(0, (this.stats.wis - 10) * 0.125);
        const levelBonus = 1 + ((this.level - 1) * 0.5);
        
        // --- Derived Parameters ---
        // maxHpを先に計算
        this.maxHp = GAME_CONSTANTS.FORMULAS.MAX_HP(this.stats, this.level);
        // hpをmaxHpに設定（モンスター生成時は満タン）
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
        
        // モンスター生成時に個体固有の色情報を生成
        this.spriteColors = {};
        const sprite = MONSTER_SPRITES[type];
        if (sprite) {
            // ステータス変動の総量を計算
            let totalVariation = 0;
            for (const [stat, value] of Object.entries(template.stats)) {
                const minPercent = GAME_CONSTANTS.STATS.VARIATION.MIN_PERCENT;
                const maxPercent = GAME_CONSTANTS.STATS.VARIATION.MAX_PERCENT;
                const baseVariation = value * (maxPercent - minPercent) / 100;
                const actualVariation = Math.abs(this.stats[stat] - value);
                totalVariation += actualVariation;
            }

            // スプライトで使用される各文字に対して固有の色を生成
            for (let row of sprite) {
                for (let char of row) {
                    if (char !== ' ' && !this.spriteColors[char]) {
                        const baseColor = SPRITE_COLORS[char];
                        this.spriteColors[char] = SPRITE_COLORS.getRandomizedColor(baseColor, totalVariation);
                    }
                }
            }
        }

        // デバッグ用のHP検証
        const calculatedMaxHp = GAME_CONSTANTS.FORMULAS.MAX_HP(this.stats, this.level);
        if (this.hp > calculatedMaxHp) {
            console.warn(`Monster HP validation failed: ${this.name}`, {
                hp: this.hp,
                maxHp: calculatedMaxHp,
                stats: this.stats,
                level: this.level
            });
        }

        // 蜘蛛の巣関連のプロパティを追加
        this.caughtInWeb = null;  // 蜘蛛の巣に捕まっている場合、そのwebオブジェクトを保持
        
        // Bleeding status effects
        this.bleedingEffects = [];  // Array to track multiple bleeding effects
    }

    // ========================== takeDamage Method ==========================
    takeDamage(amount, gameOrContext) {
        // gameOrContextがオブジェクトで、gameプロパティを持っている場合はコンテキスト
        const game = gameOrContext.game || gameOrContext;
        const context = gameOrContext.game ? gameOrContext : {};

        if (!game) {
            console.error('Game object is undefined in takeDamage');
            return { damage: amount, killed: false, evaded: false };
        }

        const damage = Math.max(1, amount);
        this.hp -= damage;

        // Check for bleeding chance if this is an organic monster
        if (this.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC) && !context.isBleedingDamage) {
            this.checkForBleeding(game, damage);
        }

        // 睡眠状態の解除判定を追加
        if (this.isSleeping) {
            const wakeupChance = 80;
            if (Math.random() * 100 < wakeupChance) {
                this.isSleeping = false;
                
                // プレイヤーの視界内にいる場合のみメッセージを表示
                const isVisibleToPlayer = game.getVisibleTiles()
                    .some(tile => tile.x === this.x && tile.y === this.y);
                
                if (isVisibleToPlayer) {
                    game.logger.add(`${this.name} wakes up!`, "monsterInfo");
                }
            }
        }

        // 派生パラメータの再計算
        this.updateStats();

        // HPの上限チェック
        if (this.hp > this.maxHp) {
            this.hp = this.maxHp;
        }

        const result = {
            damage: damage,
            killed: this.hp <= 0,
            evaded: false,
            newlyFled: false
        };

        if (!this.isSleeping && !this.hasStartedFleeing && this.shouldFlee()) {
            this.hasStartedFleeing = true;
            result.newlyFled = true;
        }

        if (this.hp <= 0) {
            // 死亡時の処理
            this.isSleeping = false;
            this.hasStartedFleeing = false;
            
            // Clear bleeding effects on death
            this.bleedingEffects = [];

            // 蜘蛛の巣に捕まっていた場合、蜘蛛の巣を除去
            if (this.caughtInWeb) {
                const webX = this.caughtInWeb.x;
                const webY = this.caughtInWeb.y;
                game.webs = game.webs.filter(w => !(w.x === webX && w.y === webY));
                
                // プレイヤーの視界内にいる場合のみメッセージを表示
                const isVisibleToPlayer = game.getVisibleTiles()
                    .some(tile => tile.x === this.x && tile.y === this.y);
                
                if (isVisibleToPlayer) {
                    game.logger.add(`The web breaks as ${this.name} dies.`, "monsterInfo");
                }
            }

            game.removeMonster(this);
        }

        return result;
    }

    // New method to handle bleeding chance and effect application
    checkForBleeding(game, damage) {
        // Get current health status
        const healthStatus = this.getHealthStatus(this.hp, this.maxHp);
        
        // Base bleeding chance determined by health status
        let bleedChance = 0;
        
        if (healthStatus.name === "Near Death") {
            bleedChance = 60;  // 60% chance when near death
        } else if (healthStatus.name === "Badly Wounded") {
            bleedChance = 40;  // 40% chance when badly wounded
        } else if (healthStatus.name === "Wounded") {
            bleedChance = 20;  // 20% chance when wounded
        } else {
            bleedChance = 10;  // 10% base chance when healthy
        }
        
        // Adjust chance based on damage relative to max HP
        const damageRatio = damage / this.maxHp;
        const damageFactor = Math.min(40, Math.floor(damageRatio * 100));
        bleedChance += damageFactor;
        
        // Roll for bleeding
        if (Math.random() * 100 < bleedChance) {
            const isVisibleToPlayer = game.getVisibleTiles()
                .some(tile => tile.x === this.x && tile.y === this.y);
            
            // Calculate bleeding duration based on damage and health status
            const baseDuration = 3;
            const healthFactor = healthStatus.name === "Near Death" ? 2 : 
                                healthStatus.name === "Badly Wounded" ? 1.5 : 
                                healthStatus.name === "Wounded" ? 1.2 : 1;
            
            const duration = Math.floor(baseDuration * healthFactor);
            
            // Calculate bleeding damage per turn based on max HP
            const baseDamage = Math.max(1, Math.floor(this.maxHp * 0.05));
            const damageFactor = Math.min(1.5, 1 + (damageRatio * 0.5));
            const damagePerTurn = Math.max(1, Math.floor(baseDamage * damageFactor));
            
            // Create and add the bleeding effect
            const bleedingEffect = {
                id: Date.now() + Math.floor(Math.random() * 1000),  // Unique ID for this bleeding instance
                remainingTurns: duration,
                damagePerTurn: damagePerTurn
            };
            
            this.bleedingEffects.push(bleedingEffect);
            
            // Show message if monster is visible to player
            if (isVisibleToPlayer) {
                game.logger.add(`${this.name} starts bleeding!`, "playerHit");
            }
        }
    }

    // Process all active bleeding effects
    processBleedingEffects(game) {
        if (this.bleedingEffects.length === 0) return;
        
        // Track total bleeding damage for this turn
        let totalDamage = 0;
        
        // Process each bleeding effect
        const remainingEffects = [];
        for (const effect of this.bleedingEffects) {
            if (effect.remainingTurns > 0) {
                // Apply damage
                totalDamage += effect.damagePerTurn;
                effect.remainingTurns--;
                
                // Keep this effect if it still has turns remaining
                if (effect.remainingTurns > 0) {
                    remainingEffects.push(effect);
                }
            }
        }
        
        // Update the bleeding effects array
        this.bleedingEffects = remainingEffects;
        
        // If there's damage to apply
        if (totalDamage > 0) {
            // プレイヤーの視界内にいるかチェック
            const isVisibleToPlayer = game.getVisibleTiles()
                .some(tile => tile.x === this.x && tile.y === this.y);
            
            // 現在のHP保存
            const oldHp = this.hp;
            
            // HPを直接減少させる（無限ループ回避のため、takeDamageを使用しない）
            this.hp = Math.max(0, this.hp - totalDamage);
            
            // 出血の重症度を取得
            const severity = this.getBleedingSeverity();
            
            // Add a bloodpool at the monster's position
            game.addBloodpool(this.x, this.y, severity);
            
            // ビジュアルエフェクトとメッセージは視界内の場合のみ
            if (isVisibleToPlayer) {
                // シンプルな出血メッセージのみ表示
                game.logger.add(`${this.name} takes ${totalDamage} bleeding damage! (HP: ${this.hp}/${this.maxHp})`, "playerHit");
            }
            
            // 死亡判定
            const killed = this.hp <= 0;
            
            if (killed) {
                // 死亡時の処理
                this.isSleeping = false;
                this.hasStartedFleeing = false;
                
                // 出血効果をクリア
                this.bleedingEffects = [];
                
                // 蜘蛛の巣に捕まっていた場合、蜘蛛の巣を除去
                if (this.caughtInWeb) {
                    const webX = this.caughtInWeb.x;
                    const webY = this.caughtInWeb.y;
                    game.webs = game.webs.filter(w => !(w.x === webX && w.y === webY));
                }
                
                // 死亡メッセージは視界内の場合のみ
                if (isVisibleToPlayer) {
                    game.logger.add(`${this.name} bleeds out!`, "playerHit");
                    // 通常の死亡エフェクトを使用
                    game.renderer.showDeathEffect(this.x, this.y);
                    
                    // lookパネルを更新（モンスター情報をクリア）
                    game.logger.clearLookInfo();
                    
                    // プレイヤーの視界内にいる場合のみ経験値・vigor変動処理を行う
                    // 死亡情報オブジェクトを作成
                    const deathInfo = {
                        monster: this,
                        killedByPlayer: true, // プレイヤーの攻撃が原因の出血なのでtrue
                        suppressMessage: true, // メッセージはすでに表示したので抑制
                        result: {
                            damage: totalDamage,
                            killed: true,
                            evaded: false
                        },
                        damageResult: {
                            totalAttack: totalDamage,
                            attackRolls: [], // 出血の場合はロールなし
                            defenseRolls: [] // 出血の場合は防御ロールなし
                        },
                        context: { 
                            source: 'bleeding',
                            attackType: 'Bleeding damage',
                            isPlayer: false,
                            isCritical: false,
                            damageMultiplier: 1
                        }
                    };
                    
                    // 経験値とvigor変動を処理
                    game.processMonsterDeath(deathInfo);
                } else {
                    // プレイヤーの視界外の場合は単にモンスターを削除
                    game.removeMonster(this);
                }
            }
        }
    }

    // ========================== updateStats Method ==========================
    // 新規: モンスターの派生ステータスを更新するメソッド
    updateStats() {
        // maxHpを先に再計算
        this.maxHp = GAME_CONSTANTS.FORMULAS.MAX_HP(this.stats, this.level);
        
        // HPの検証
        this.validateHP();
        
        // 他のステータス更新
        this.attackPower = GAME_CONSTANTS.FORMULAS.ATTACK(this.stats);
        this.defense = GAME_CONSTANTS.FORMULAS.DEFENSE(this.stats);
        this.accuracy = GAME_CONSTANTS.FORMULAS.ACCURACY(this.stats);
        this.evasion = GAME_CONSTANTS.FORMULAS.EVASION(this.stats);
        this.perception = GAME_CONSTANTS.FORMULAS.PERCEPTION(this.stats);
    }

    validateHP() {
        if (this.hp > this.maxHp) {
            console.warn(`Monster HP validation failed: ${this.name}`, {
                hp: this.hp,
                maxHp: this.maxHp,
                stats: this.stats,
                level: this.level
            });
            this.hp = this.maxHp;
        }
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

    // パス距離計算用の新メソッド
    getPathDistanceToPlayer(game) {
        const visited = new Set();
        const queue = [{
            x: this.x,
            y: this.y,
            distance: 0
        }];

        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.x},${current.y}`;

            if (visited.has(key)) continue;
            visited.add(key);

            if (current.x === game.player.x && current.y === game.player.y) {
                return current.distance;
            }

            const directions = [
                {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
                {dx: -1, dy: 0},                    {dx: 1, dy: 0},
                {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
            ];

            for (const dir of directions) {
                const newX = current.x + dir.dx;
                const newY = current.y + dir.dy;
                
                if (game.isValidPosition(newX, newY) && 
                    game.map[newY][newX] === 'floor' &&
                    game.tiles[newY][newX] !== GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                    const moveCost = (dir.dx !== 0 && dir.dy !== 0) ? Math.SQRT2 : 1;
                    queue.push({
                        x: newX,
                        y: newY,
                        distance: current.distance + moveCost
                    });
                }
            }

            queue.sort((a, b) => a.distance - b.distance);
        }

        return Infinity;
    }

    // ========================== act Method (Monster's Turn Actions) ==========================
    act(game) {
        // --- Action Reset ---
        if (this.hasActedThisTurn) {
            this.hasActedThisTurn = false;
            return;
        }

        // --- Web Entrapment Check ---
        // 蜘蛛の巣に捕まっている場合、まず脱出を試みる
        if (this.caughtInWeb) {
            if (!this.tryToBreakFreeFromWeb(game)) {
                // 脱出失敗時はターンを消費して終了
                return;
            }
            // 脱出成功の場合は通常の行動を続行
        }

        // --- Fleeing Action ---
        if (this.hasStartedFleeing) {
            this.flee(game);
            return;
        }

        // --- Sleep State Check ---
        if (this.isSleeping) {
            const dx = game.player.x - this.x;
            const dy = game.player.y - this.y;
            const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                game.player.x, game.player.y,
                this.x, this.y
            );
            
            let wakeupChance = 0;
            
            // プレイヤーが隣接している場合
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
                wakeupChance = 80 + this.perception * 2;
            } 
            // 音源による起床判定
            else {
                // 音源の確認
                const soundSources = [];
                
                // 戦闘音の確認
                if (game.lastCombatLocation) {
                    soundSources.push({
                        x: game.lastCombatLocation.x,
                        y: game.lastCombatLocation.y,
                        intensity: 100, // 戦闘は大きな音
                        type: 'combat'
                    });
                }
                
                // 遠距離攻撃音の確認
                if (game.lastRangedAttackLocation) {
                    soundSources.push({
                        x: game.lastRangedAttackLocation.x,
                        y: game.lastRangedAttackLocation.y,
                        intensity: 80, // 遠距離攻撃は中程度の音
                        type: 'ranged'
                    });
                }
                
                // ドアの開閉音の確認
                if (game.lastDoorActionLocation) {
                    soundSources.push({
                        x: game.lastDoorActionLocation.x,
                        y: game.lastDoorActionLocation.y,
                        intensity: 60, // ドアの開閉は小さめの音
                        type: 'door'
                    });
                }
                
                // 各音源からの影響を計算
                for (const source of soundSources) {
                    if (this.canHearSound(game, source)) {
                        const soundDistance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                            source.x, source.y,
                            this.x, this.y
                        );
                        
                        // 音の減衰を計算
                        const attenuation = this.calculateSoundAttenuation(game, source, soundDistance);
                        const soundIntensity = (source.intensity * attenuation) / 100;
                        
                        // 知覚による補正
                        const perceptionBonus = Math.max(0, (this.perception - 10) * 5);
                        
                        // 最終的な起床確率を計算
                        const sourceWakeupChance = Math.max(0, soundIntensity + perceptionBonus);
                        
                        // 最も高い起床確率を採用
                        wakeupChance = Math.max(wakeupChance, sourceWakeupChance);
                    }
                }
            }
            
            if (wakeupChance > 0 && Math.random() * 100 < wakeupChance) {
                this.isSleeping = false;

                // プレイヤーの視界内にいる場合のみメッセージを表示
                const isVisibleToPlayer = game.getVisibleTiles()
                    .some(tile => tile.x === this.x && tile.y === this.y);
                
                if (isVisibleToPlayer) {
                    game.logger.add(`${this.name} wakes up!`, "monsterInfo");
                    game.renderer.flashLogPanel();
                    game.playSound('cautionSound');
                    
                    // モンスターが起床したときも情報を表示
                    game.renderer.examineTarget(this.x, this.y);
                }

                this.hasSpottedPlayer = true;
                this.lastKnownPlayerX = game.player.x;
                this.lastKnownPlayerY = game.player.y;
                this.trackingTurns = this.maxTrackingTurns;

                // 周囲のモンスターの起床判定
                this.alertNearbyMonsters(game);
                return;
            }
            return;
        }

        // --- Player Detection and Pursuit ---
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const Distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
            game.player.x, game.player.y,
            this.x, this.y
        );
        const pathDistance = this.getPathDistanceToPlayer(game);

        const soundRange = Math.min(3, this.perception / 2);
        const hasDoorBetween = this.hasClosedDoorBetween(game, game.player.x, game.player.y);
        const effectiveSoundRange = hasDoorBetween ? soundRange / 2 : soundRange;

        // プレイヤーのサイズによる感知ボーナスを計算（プレイヤーの感知システムと同じ計算式）
        const playerSize = GAME_CONSTANTS.FORMULAS.SIZE(game.player.stats);
        const sizeBonus = (3 - playerSize.value) * 2;  // プレイヤーの感知システムと同じ計算式

        // サイズボーナスを考慮した感知判定
        if ((Distance <= (this.perception + sizeBonus) && this.hasLineOfSight(game)) || 
            (pathDistance <= effectiveSoundRange)) {
            if (!this.hasSpottedPlayer) {
                const isVisibleToPlayer = game.getVisibleTiles()
                    .some(tile => tile.x === this.x && tile.y === this.y);
                
                if (!isVisibleToPlayer) {
                    // プレイヤーからモンスターが見えない場合のみ知覚チェック
                    game.player.checkPerception(game);
                    // --- 知覚が成功した場合に cautionSound を再生 ---
                    if (game.player.perceptionChecked && game.player.perceptionSuccess) {
                        game.soundManager.playSound('cautionSound');
                    }
                } else {
                    // プレイヤーからモンスターが見える場合のみスポットメッセージ
                    // 修正: 視覚と聴覚を明確に区別
                    const isVisual = Distance <= (this.perception + sizeBonus) && this.hasLineOfSight(game);
                    const isAuditory = pathDistance <= effectiveSoundRange;
                    
                    // 視覚と聴覚の両方を考慮して判定
                    let spotType;
                    if (isVisual) {
                        spotType = "spots";
                    } else if (isAuditory) {
                        spotType = "hears";
                    } else {
                        spotType = "detects"; // フォールバック
                    }
                    
                    // プレイヤーの視界内にいる場合のみメッセージとサウンドを表示
                    if (isVisibleToPlayer) {
                        game.logger.add(`${this.name} ${spotType} you!`, "monsterInfo");
                        game.renderer.flashLogPanel();
                        game.soundManager.playSound('cautionSound');
                        
                        // モンスターがプレイヤーをスポットしたときも情報を表示
                        game.renderer.examineTarget(this.x, this.y);
                    }
                }
                
                this.hasSpottedPlayer = true;
            }
            this.lastKnownPlayerX = game.player.x;
            this.lastKnownPlayerY = game.player.y;
            this.trackingTurns = this.maxTrackingTurns;
            
            // 遠距離攻撃能力を持つモンスターの場合、遠距離攻撃を試みる
            if (this.abilities && this.abilities.canUseRangedAttack) {
                // 遠距離攻撃を試みる
                const attacked = this.tryRangedAttack(game);
                
                // 遠距離攻撃に成功した場合は、このターンの行動を終了
                if (attacked) {
                    return;
                }
            }
            
            // ジャンプ能力を持つモンスターの場合、ジャンプを試みる
            if (this.abilities && this.abilities.canJump) {
                // ジャンプを試みる
                const jumped = this.tryJump(game);
                
                // ジャンプに成功した場合は、このターンの行動を終了
                if (jumped) {
                    return;
                }
            }
            
            // 蜘蛛の巣能力を持つモンスターの場合、蜘蛛の巣生成を試みる
            if (this.abilities && this.abilities.canCreateWeb) {
                // 蜘蛛の巣生成を試みる
                const webCreated = this.tryCreateWeb(game);
                
                // 蜘蛛の巣生成に成功した場合でも、通常の移動や攻撃は行う
            }
            
            this.pursueTarget(game, game.player.x, game.player.y);
        } 
        else if (this.trackingTurns > 0 && this.lastKnownPlayerX !== null) {
            this.trackingTurns--;
            this.pursueTarget(game, this.lastKnownPlayerX, this.lastKnownPlayerY);
            
            if (this.trackingTurns === 0) {
                this.hasSpottedPlayer = false;
                this.lastKnownPlayerX = null;
                this.lastKnownPlayerY = null;
            }
        }
        else {
            this.hasSpottedPlayer = false;
            this.lastKnownPlayerX = null;
            this.lastKnownPlayerY = null;
            
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
        if (this.isSleeping) return { hit: false, evaded: false, damage: 0 };
        
        // 蜘蛛の巣に捕まっている場合は攻撃できない
        if (this.caughtInWeb) {
            const isVisibleToPlayer = game.getVisibleTiles()
                .some(tile => tile.x === this.x && tile.y === this.y);
            
            if (isVisibleToPlayer) {
                game.logger.add(`${this.name} struggles in the web and can't attack.`, "monsterInfo");
            }
            return { hit: false, evaded: false, damage: 0 };
        }
        
        game.lastCombatMonster = this;
        game.renderer.examineTarget(this.x, this.y);

        // Giant Spiderが蜘蛛の巣の上にいる場合の攻撃ボーナス
        let context = { isPlayer: false };
        if (this.type === 'G_SPIDER' && this.isOnWeb(game)) {
            context = {
                ...context,
                accuracyMod: 0.2,      // 命中率20%増加
                damageMod: 1.25,       // ダメージ25%増加
                effectDesc: " with web-enhanced precision"
            };
        }
        
        return CombatSystem.resolveCombatAction(this, player, game, context);
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
            const tile = game.tiles[point.y][point.x];
            
            // 床でない場合、障害物の種類をチェック
            if (game.map[point.y][point.x] !== 'floor') {
                // 透明な障害物、void portal、obeliskは視線を通す
                const isTransparentObstacle = GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(tile);
                const isVoidPortal = tile === GAME_CONSTANTS.PORTAL.VOID.CHAR;
                const isObelisk = tile === GAME_CONSTANTS.NEURAL_OBELISK.CHAR;
                if (!isTransparentObstacle && !isVoidPortal && !isObelisk) {
                    return false;
                }
            }
            
            // 閉じたドアは視線を遮る
            if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
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
        // Giant Spider専用の処理を追加
        if (this.type === 'G_SPIDER') {
            const distanceToPlayer = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                this.x, this.y,
                game.player.x, game.player.y
            );

            // 現在蜘蛛の巣の上にいる場合
            if (this.isOnWeb(game)) {
                // プレイヤーが隣接している場合のみ攻撃
                if (distanceToPlayer <= 1) {
                    this.attackPlayer(game.player, game);
                    return;
                }
                
                // プレイヤーが遠い場合は巣の上で待機（80%の確率）
                if (Math.random() < 0.8) {
                    // プレイヤーの視界内にいる場合のみメッセージを表示
                    const isVisibleToPlayer = game.getVisibleTiles()
                        .some(tile => tile.x === this.x && tile.y === this.y);
                    
                    if (isVisibleToPlayer) {
                        game.logger.add(`${this.name} waits patiently on its web.`, "monsterInfo");
                    }
                    return;
                }
            } 
            // 巣の上にいない場合
            else {
                const nearbyWeb = this.findNearestWeb(game, targetX, targetY);
                if (nearbyWeb) {
                    // プレイヤーとの距離が近すぎない場合、蜘蛛の巣に向かう
                    if (distanceToPlayer > 1) {
                        const moved = this.moveTowardsWeb(game, nearbyWeb);
                        if (moved) return;
                    }
                }
            }
        }

        // 以下、通常の追跡処理（巣がない場合や特別な状況の場合のフォールバック）
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
            // 移動先の厳密なチェック
            return this.canMoveTo(newX, newY, game) && 
                   !game.getMonsterAt(newX, newY) && 
                   game.tiles[newY][newX] !== GAME_CONSTANTS.TILES.DOOR.CLOSED;
        });

        let bestMove = null;
        let bestDistance = Infinity;

        for (const move of possibleMoves) {
            const newX = this.x + move.x;
            const newY = this.y + move.y;
            
            const newDistance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                newX, newY,
                targetX, targetY
            );
            if (newDistance < bestDistance) {
                bestDistance = newDistance;
                bestMove = move;
            }
        }

        if (bestMove) {
            const oldX = this.x;
            const oldY = this.y;
            const newX = this.x + bestMove.x;
            const newY = this.y + bestMove.y;

            // 移動前の位置を保存
            const wasTargeted = game.player.rangedCombat.target && 
                              game.player.rangedCombat.target.x === oldX && 
                              game.player.rangedCombat.target.y === oldY;

            // 蜘蛛の巣チェック
            const web = game.webs && game.webs.find(w => w.x === newX && w.y === newY);
            
            if (web) {
                // 蜘蛛の巣を生成したモンスター自身は影響を受けない
                if (web.createdBy === this.id) {
                    this.x = newX;
                    this.y = newY;
                } else {
                    // Giant Spiderは蜘蛛の巣の影響を受けない
                    const isSpider = this.type === 'G_SPIDER';
                    
                    if (isSpider) {
                        // 蜘蛛は通常移動（蜘蛛の巣に引っかからない）
                        this.x = newX;
                        this.y = newY;
                    } else {
                        // 蜘蛛の巣に引っかかるかチェック
                        const trapChance = web.trapChance || GAME_CONSTANTS.WEB.TRAP_CHANCE;
                        const roll = Math.random();
                        
                        if (roll < trapChance) {
                            // 蜘蛛の巣に引っかかった
                            this.x = newX;
                            this.y = newY;
                            
                            // 捕まり状態を設定
                            this.caughtInWeb = web;
                            
                            // プレイヤーの視界内にいる場合のみメッセージを表示
                            const isVisibleToPlayer = game.getVisibleTiles()
                                .some(tile => tile.x === newX && tile.y === newY);
                            
                            if (isVisibleToPlayer) {
                                game.logger.add(`${this.name} is caught in a web!`, "monsterInfo");
                                // 効果音を再生
                                game.playSound('webTrapSound');
                            }
                        } else {
                            // 蜘蛛の巣を避けた
                            this.x = newX;
                            this.y = newY;
                            
                            // プレイヤーの視界内にいる場合のみメッセージを表示
                            const isVisibleToPlayer = game.getVisibleTiles()
                                .some(tile => tile.x === newX && tile.y === newY);
                            
                            if (isVisibleToPlayer) {
                                game.logger.add(`${this.name} navigates through the web.`, "monsterInfo");
                            }
                        }
                    }
                }
            } else {
                // 通常の移動
                this.x = newX;
                this.y = newY;
            }

            // ターゲットの位置を更新
            if (wasTargeted) {
                game.player.rangedCombat.target = { x: this.x, y: this.y };
            }
        }
    }

    // ========================== spawnRandomMonster Static Method ==========================
    static spawnRandomMonster(x, y, floorLevel, dangerLevel = 'NORMAL', game) {
        const dangerData = GAME_CONSTANTS.DANGER_LEVELS[dangerLevel];
        const effectiveLevel = Math.max(1, floorLevel + dangerData.levelModifier);

        // MONSTERSを直接参照するように変更
        const availableTypes = Object.entries(MONSTERS)
            .filter(([_, data]) => data.level <= effectiveLevel)  // +1を削除
            .map(([type, _]) => type);

        const weightedTypes = availableTypes.map(type => {
            const levelDiff = Math.abs(MONSTERS[type].level - effectiveLevel);
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
        // プレイヤーとの距離を計算
        const currentDistance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
            game.player.x, game.player.y,
            this.x, this.y
        );

        // 移動候補を生成（斜め移動を含む8方向）
        const directions = [
            { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 0 },                      { dx: 1, dy: 0 },
            { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
        ];

        // 移動候補をシャッフル（より自然な逃走行動のため）
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }

        // 最適な逃走先を探す
        let bestMove = null;
        let bestDistance = currentDistance;
        let bestSafety = -1;  // 周囲の壁や障害物による安全度

        for (const dir of directions) {
            const newX = this.x + dir.dx;
            const newY = this.y + dir.dy;

            if (!this.canMoveTo(newX, newY, game) || 
                game.getMonsterAt(newX, newY) || 
                game.tiles[newY][newX] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                continue;
            }

            const newDistance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                game.player.x, game.player.y,
                newX, newY
            );

            // 安全度を計算（周囲の壁や障害物の数）
            let safety = 0;
            for (const checkDir of directions) {
                const checkX = newX + checkDir.dx;
                const checkY = newY + checkDir.dy;
                if (!this.canMoveTo(checkX, checkY, game)) safety++;
            }

            // より遠い位置、または同じ距離でもより安全な位置を選択
            if (newDistance > bestDistance || 
                (newDistance === bestDistance && safety > bestSafety)) {
                bestDistance = newDistance;
                bestSafety = safety;
                bestMove = dir;
            }
        }

        // 最適な移動先が見つかった場合、移動を実行
        if (bestMove) {
            this.x += bestMove.dx;
            this.y += bestMove.dy;
            return true;
        }

        // 逃げ場がない場合は、プレイヤーに背を向けて戦う
        this.hasStartedFleeing = false;
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
    
    // ========================== tryJump Method ==========================
    // 新規: ジャンプを試みるメソッド
    tryJump(game) {
        // ジャンプ能力がない場合は何もしない
        if (!this.abilities || !this.abilities.canJump) {
            return false;
        }
        
        // クールダウン中の場合は何もしない
        if (this.jumpCooldownRemaining > 0) {
            this.jumpCooldownRemaining--;
            return false;
        }
        
        // ジャンプを試みる確率チェック
        if (Math.random() > this.abilities.jumpChance) {
            return false;
        }
        
        // プレイヤーとの距離を計算
        const dx = game.player.x - this.x;
        const dy = game.player.y - this.y;
        const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
            game.player.x, game.player.y,
            this.x, this.y
        );
        
        // スキルのジャンプと同じ計算方法でジャンプ範囲を計算
        // DEXとCONの差を3で割って3を加えた値
        const jumpRange = Math.floor((this.stats.dex - this.stats.con) / 3) + 3;
        
        // 距離が近すぎる場合や遠すぎる場合はジャンプしない
        if (distance <= 2 || distance > jumpRange) {
            return false;
        }
        
        // プレイヤーが見えない場合はジャンプしない
        if (!this.hasLineOfSight(game)) {
            return false;
        }
        
        // ジャンプ先の候補を生成
        const jumpCandidates = [];
        
        // プレイヤーの周囲のタイルをチェック
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                // プレイヤーの位置自体は除外
                if (offsetX === 0 && offsetY === 0) continue;
                
                const targetX = game.player.x + offsetX;
                const targetY = game.player.y + offsetY;
                
                // 移動可能かチェック
                if (this.canMoveTo(targetX, targetY, game) && 
                    !game.getMonsterAt(targetX, targetY)) {
                    
                    // 距離を計算
                    const jumpDistance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                        this.x, this.y,
                        targetX, targetY
                    );
                    
                    // 最小距離と最大距離の両方をチェック
                    // 実質的な移動量を計算（現在位置からジャンプ先までの距離）
                    const effectiveMovement = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                        this.x, this.y,
                        targetX, targetY
                    );
                    
                    // 範囲内かつ実質的な移動量が2マス以上ならジャンプ候補に追加
                    if (jumpDistance <= jumpRange && effectiveMovement >= 2) {
                        jumpCandidates.push({
                            x: targetX,
                            y: targetY,
                            distance: jumpDistance
                        });
                    }
                }
            }
        }
        
        // ジャンプ候補がない場合は何もしない
        if (jumpCandidates.length === 0) {
            return false;
        }
        
        // プレイヤーに最も近い位置を選択
        jumpCandidates.sort((a, b) => {
            const distA = GAME_CONSTANTS.DISTANCE.calculateChebyshev(a.x, a.y, game.player.x, game.player.y);
            const distB = GAME_CONSTANTS.DISTANCE.calculateChebyshev(b.x, b.y, game.player.x, game.player.y);
            return distA - distB;
        });
        
        const jumpTarget = jumpCandidates[0];
        
        // ジャンプ実行
        const fromX = this.x;
        const fromY = this.y;
        
        // 移動エフェクトを表示
        game.renderer.showMovementTrailEffect(fromX, fromY, jumpTarget.x, jumpTarget.y);
        
        // 位置を更新
        this.x = jumpTarget.x;
        this.y = jumpTarget.y;
        
        // ログにジャンプメッセージを追加
        game.logger.add(`${this.name} leaps toward you!`, "monsterInfo");
        game.renderer.flashLogPanel();
        
        // ジャンプ効果音を再生
        game.playSound('jumpSound');
        
        // クールダウンを設定
        this.jumpCooldownRemaining = this.abilities.jumpCooldown;
        
        return true;
    }
    
    // ========================== tryCreateWeb Method ==========================
    // 新規: 蜘蛛の巣を生成するメソッドを追加
    tryCreateWeb(game) {
        // 蜘蛛の巣能力がない場合は何もしない
        if (!this.abilities || !this.abilities.canCreateWeb) {
            return false;
        }
        
        // クールダウン中の場合は何もしない
        if (this.webCooldownRemaining > 0) {
            this.webCooldownRemaining--;
            return false;
        }
        
        // 蜘蛛の巣を生成する確率チェック
        if (Math.random() > this.abilities.webChance) {
            return false;
        }
        
        // プレイヤーとの距離を計算
        const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
            game.player.x, game.player.y,
            this.x, this.y
        );
        
        // プレイヤーが近すぎる場合は蜘蛛の巣を生成しない（戦闘中は生成しない）
        if (distance <= 1.5) {
            return false;
        }
        
        // 蜘蛛の巣を生成する位置を決定
        // 現在位置または隣接する空きマスに生成
        const webPositions = [];
        
        // 現在位置を追加
        webPositions.push({ x: this.x, y: this.y });
        
        // 隣接する位置をチェック
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                // 自分の位置は除外（すでに追加済み）
                if (offsetX === 0 && offsetY === 0) continue;
                
                const targetX = this.x + offsetX;
                const targetY = this.y + offsetY;
                
                // 移動可能かチェック（壁や閉じたドアがない）
                if (this.canMoveTo(targetX, targetY, game) && 
                    !game.getMonsterAt(targetX, targetY) &&
                    !(targetX === game.player.x && targetY === game.player.y)) {
                    
                    webPositions.push({ x: targetX, y: targetY });
                }
            }
        }
        
        // 蜘蛛の巣を生成する位置がない場合は何もしない
        if (webPositions.length === 0) {
            return false;
        }
        
        // ランダムに位置を選択
        const webPos = webPositions[Math.floor(Math.random() * webPositions.length)];
        
        // 再度位置が有効か最終チェック
        if (!this.canMoveTo(webPos.x, webPos.y, game)) {
            return false;
        }
        
        // 蜘蛛の巣オブジェクトを生成
        const web = {
            x: webPos.x,
            y: webPos.y,
            char: GAME_CONSTANTS.WEB.CHAR,
            color: GAME_CONSTANTS.WEB.COLOR,
            type: 'web',
            createdBy: this.id,
            trapChance: this.abilities.webTrapChance || GAME_CONSTANTS.WEB.TRAP_CHANCE
        };
        
        // ゲームに蜘蛛の巣を追加
        if (!game.webs) {
            game.webs = [];
        }
        game.webs.push(web);
        
        // プレイヤーの視界内にいる場合のみメッセージを表示
        const isVisibleToPlayer = game.getVisibleTiles()
            .some(tile => tile.x === this.x && tile.y === this.y);
        
        if (isVisibleToPlayer) {
            // ログに蜘蛛の巣生成メッセージを追加
            game.logger.add(`${this.name} spins a web!`, "monsterInfo");
            
            // 効果音を再生
            game.playSound('webSound');
        }
        
        // クールダウンを設定
        this.webCooldownRemaining = this.abilities.webCooldown;
        
        return true;
    }

    // ========================== tryToBreakFreeFromWeb Method ==========================
    // 蜘蛛の巣からの脱出を試みるメソッドを追加
    tryToBreakFreeFromWeb(game) {
        if (!this.caughtInWeb) return true; // 捕まっていなければ成功とみなす
        
        // 脱出チャンスを計算（DEXが高いほど脱出しやすい）
        const baseChance = 0.2; // ベース確率を20%に設定
        const dexBonus = Math.max(0, (this.stats.dex - 10) * 0.02); // DEXボーナス
        const escapeChance = Math.min(0.75, baseChance + dexBonus); // 最大確率は75%
        
        const roll = Math.random();
        if (roll < escapeChance) {
            // 脱出成功
            // プレイヤーの視界内にいる場合のみメッセージを表示
            const isVisibleToPlayer = game.getVisibleTiles()
                .some(tile => tile.x === this.x && tile.y === this.y);
            
            if (isVisibleToPlayer) {
                game.logger.add(`${this.name} breaks free from the web!`, "monsterInfo");
                // 効果音を再生
                game.playSound('webBreakSound');
            }
            
            // webの位置情報を取得
            const webX = this.caughtInWeb.x;
            const webY = this.caughtInWeb.y;
            
            // 蜘蛛の巣を除去
            game.webs = game.webs.filter(w => !(w.x === webX && w.y === webY));
            
            // 捕まり状態を解除
            this.caughtInWeb = null;
            
            return true; // アクションを続行可能
        } else {
            // 脱出失敗
            // プレイヤーの視界内にいる場合のみメッセージを表示
            const isVisibleToPlayer = game.getVisibleTiles()
                .some(tile => tile.x === this.x && tile.y === this.y);
            
            if (isVisibleToPlayer) {
                game.logger.add(`${this.name} struggles in the web.`, "monsterInfo");
                // 効果音を再生
                game.playSound('webTrapSound');
            }
            
            return false; // アクション失敗
        }
    }

    // ========================== alertNearbyMonsters Method ==========================
    // 周囲のモンスターの起床判定を行うメソッド
    alertNearbyMonsters(game) {
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];

        for (const dir of directions) {
            const newX = this.x + dir[0];
            const newY = this.y + dir[1];

            if (game.isValidPosition(newX, newY) && 
                game.map[newY][newX] === 'floor' &&
                game.tiles[newY][newX] !== GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                const monster = game.getMonsterAt(newX, newY);
                if (monster && monster.isSleeping) {
                    monster.isSleeping = false;
                    
                    // プレイヤーの視界内にいる場合のみメッセージとサウンドを表示
                    const isVisibleToPlayer = game.getVisibleTiles()
                        .some(tile => tile.x === monster.x && tile.y === monster.y);
                    
                    if (isVisibleToPlayer) {
                        game.logger.add(`${monster.name} wakes up nearby!`, "monsterInfo");
                        game.renderer.flashLogPanel();
                        game.playSound('cautionSound');
                    }
                }
            }
        }
    }

    // ========================== Sound System Methods ==========================
    // 音を聞くことができるか判定するメソッド
    canHearSound(game, source) {
        const points = this.getLinePoints(this.x, this.y, source.x, source.y);
        let doorCount = 0;
        let wallCount = 0;
        
        // プレイヤーの位置を除く全ての点をチェック
        for (let i = 0; i < points.length - 1; i++) {
            const point = points[i];
            
            // 壁による遮断
            if (game.map[point.y][point.x] !== 'floor') {
                wallCount++;
                if (wallCount >= 2) return false; // 2枚以上の壁を通過する音は聞こえない
            }
            
            // ドアによる減衰
            if (game.tiles[point.y][point.x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                doorCount++;
                if (doorCount >= 3) return false; // 3枚以上のドアを通過する音は聞こえない
            }
        }
        
        return true;
    }
    
    // 音の減衰を計算するメソッド
    calculateSoundAttenuation(game, source, distance) {
        const points = this.getLinePoints(this.x, this.y, source.x, source.y);
        let attenuation = 100; // 初期値は100%
        
        // 距離による減衰（1マスごとに10%減衰）
        attenuation *= Math.max(0, 1 - (distance * 0.1));
        
        // 障害物による減衰
        for (let i = 0; i < points.length - 1; i++) {
            const point = points[i];
            
            // 壁による減衰（50%）
            if (game.map[point.y][point.x] !== 'floor') {
                attenuation *= 0.5;
            }
            
            // 閉じたドアによる減衰（30%）
            if (game.tiles[point.y][point.x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                attenuation *= 0.7;
            }
        }
        
        return Math.max(0, Math.min(100, attenuation));
    }

    // CombatSystemのresolveEvadeCheckメソッドで使用するための回避率取得メソッドを追加
    getEffectiveEvasion() {
        // 蜘蛛の巣に捕まっている場合は回避率0
        if (this.caughtInWeb) {
            return 0;
        }

        // Giant Spiderが蜘蛛の巣の上にいる場合のボーナス
        if (this.type === 'G_SPIDER' && this.isOnWeb(this.game)) {
            const webBonus = {
                evasion: Math.floor(this.evasion * 1.5),  // 回避率50%増加
                message: "The spider moves gracefully on its web!"
            };
            return webBonus.evasion;
        }

        return this.evasion;
    }

    // Monsterクラスに新しいメソッドを追加
    isOnWeb(game) {
        return game.webs && game.webs.some(web => web.x === this.x && web.y === this.y);
    }

    // 新規: 最も近い蜘蛛の巣を探すメソッド
    findNearestWeb(game, targetX, targetY) {
        if (!game.webs || game.webs.length === 0) return null;

        let nearestWeb = null;
        let bestScore = Infinity;

        for (const web of game.webs) {
            // 自分から蜘蛛の巣までの距離
            const distanceToWeb = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                this.x, this.y,
                web.x, web.y
            );

            // 蜘蛛の巣からプレイヤーまでの距離
            const webToTarget = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                web.x, web.y,
                targetX, targetY
            );

            // プレイヤーが近すぎる蜘蛛の巣は避ける
            if (webToTarget <= 1) continue;

            // スコアの計算（距離が近く、かつプレイヤーから適度な距離にある蜘蛛の巣を優先）
            // プレイヤーからの理想的な距離は2-3マス
            const idealPlayerDistance = Math.abs(webToTarget - 2.5);
            const score = distanceToWeb + (idealPlayerDistance * 2);

            if (score < bestScore) {
                bestScore = score;
                nearestWeb = web;
            }
        }

        return nearestWeb;
    }

    // 新規: 蜘蛛の巣に向かって移動するメソッド
    moveTowardsWeb(game, web) {
        const dx = web.x - this.x;
        const dy = web.y - this.y;

        // 可能な移動方向を生成
        const possibleMoves = [];
        
        // 水平・垂直移動
        if (dx > 0) possibleMoves.push({ x: 1, y: 0 });
        if (dx < 0) possibleMoves.push({ x: -1, y: 0 });
        if (dy > 0) possibleMoves.push({ x: 0, y: 1 });
        if (dy < 0) possibleMoves.push({ x: 0, y: -1 });
        
        // 斜め移動
        if (dx > 0 && dy > 0) possibleMoves.push({ x: 1, y: 1 });
        if (dx < 0 && dy > 0) possibleMoves.push({ x: -1, y: 1 });
        if (dx > 0 && dy < 0) possibleMoves.push({ x: 1, y: -1 });
        if (dx < 0 && dy < 0) possibleMoves.push({ x: -1, y: -1 });

        // 移動可能な方向をフィルタリング
        const validMoves = possibleMoves.filter(move => {
            const newX = this.x + move.x;
            const newY = this.y + move.y;
            return this.canMoveTo(newX, newY, game) && !game.getMonsterAt(newX, newY);
        });

        if (validMoves.length > 0) {
            // 蜘蛛の巣に最も近づく移動を選択
            const bestMove = validMoves.reduce((best, move) => {
                const newX = this.x + move.x;
                const newY = this.y + move.y;
                const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                    newX, newY,
                    web.x, web.y
                );
                if (!best || distance < best.distance) {
                    return { move, distance };
                }
                return best;
            }, null);

            if (bestMove) {
                this.x += bestMove.move.x;
                this.y += bestMove.move.y;

                // プレイヤーの視界内にいる場合のみメッセージを表示
                const isVisibleToPlayer = game.getVisibleTiles()
                    .some(tile => tile.x === this.x && tile.y === this.y);
                
                if (isVisibleToPlayer) {
                    game.logger.add(`${this.name} moves strategically towards its web.`, "monsterInfo");
                }
                return true;
            }
        }

        return false;
    }

    // ========================== tryRangedAttack Method ==========================
    // 新規: 遠距離攻撃を試みるメソッド
    tryRangedAttack(game) {
        // 遠距離攻撃能力がない場合は何もしない
        if (!this.abilities || !this.abilities.canUseRangedAttack) {
            return false;
        }
        
        // クールダウン中の場合は何もしない
        if (this.rangedAttackCooldownRemaining > 0) {
            this.rangedAttackCooldownRemaining--;
            return false;
        }
        
        // 遠距離攻撃を試みる確率チェック
        if (Math.random() > this.abilities.rangedAttackChance) {
            return false;
        }
        
        // プレイヤーとの距離を計算
        const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
            game.player.x, game.player.y,
            this.x, this.y
        );
        
        // 射程距離を超えている場合は攻撃しない
        if (distance > this.abilities.rangedAttackRange) {
            return false;
        }
        
        // 近すぎる場合は通常攻撃を優先
        if (distance <= 1) {
            return false;
        }
        
        // プレイヤーが見えない場合は攻撃しない
        if (!this.game.visionSystem.hasRangedAttackLineOfSight(this.x, this.y, game.player.x, game.player.y)) {
            return false;
        }

        // モンスター情報を表示
        game.renderer.examineTarget(this.x, this.y);
        
        // 射線上のモンスターをチェック
        const linePoints = this.getLinePoints(this.x, this.y, game.player.x, game.player.y);
        const monstersInLine = [];

        // プレイヤーの位置を除く全ての点をチェック
        for (let i = 0; i < linePoints.length - 1; i++) {
            const point = linePoints[i];
            const monsterAtPoint = game.getMonsterAt(point.x, point.y);
            
            // 自分自身は除外
            if (monsterAtPoint && monsterAtPoint.id !== this.id) {
                monstersInLine.push({
                    monster: monsterAtPoint,
                    distance: GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                        this.x, this.y,
                        monsterAtPoint.x, monsterAtPoint.y
                    )
                });
            }
        }

        // 距離順にソート
        monstersInLine.sort((a, b) => a.distance - b.distance);

        // 射線上の各モンスターについて、近いものから順にチェック
        for (const {monster} of monstersInLine) {
            // 50%の確率で誤射判定
            if (Math.random() < 0.5) {
                // プレイヤーの視界内にいる場合のみメッセージとエフェクトを表示
                const isVisibleToPlayer = game.getVisibleTiles()
                    .some(tile => tile.x === this.x && tile.y === this.y);
                
                if (isVisibleToPlayer) {
                    game.logger.add(`${this.name}'s energy beam hits ${monster.name} instead!`, "monsterInfo");
                    game.renderer.showRangedAttackEffect(this.x, this.y, monster.x, monster.y, '#00FFFF');
                    game.playSound('rangedAttackSound');
                }

                // ダメージ計算と適用
                const damage = this.calculateRangedDamage();
                
                // クリティカル判定を追加
                const isCritical = Math.random() * 100 <= GAME_CONSTANTS.FORMULAS.CRITICAL_RANGE(this.stats);
                
                let finalDamage;
                if (isCritical) {
                    // クリティカルヒットの場合は防御無視
                    finalDamage = damage.total;
                    if (isVisibleToPlayer) {
                        game.logger.add(`Critical hit!`, "monsterCrit");
                    }
                } else {
                    // 通常ヒットの場合は防御計算
                    const defense = monster.defense;
                    const defenseRolls = Array(defense.diceCount).fill(0)
                        .map(() => Math.floor(Math.random() * defense.diceSides) + 1);
                    const totalDefense = defense.base + defenseRolls.reduce((sum, roll) => sum + roll, 0);
                    finalDamage = Math.max(1, damage.total - totalDefense);
                }
                
                // ダメージ適用
                const result = monster.takeDamage(finalDamage, game);

                if (isVisibleToPlayer) {
                    const rollsStr = damage.rolls.join(', ');
                    if (isCritical) {
                        game.logger.add(`The beam hits ${monster.name} for ${result.damage} damage! (ATK: ${damage.base}+[${rollsStr}] vs DEF: [IGNORED]) (HP: ${monster.hp}/${monster.maxHp})`, "monsterCrit");
                    } else {
                        const defense = monster.defense;
                        const defenseRolls = Array(defense.diceCount).fill(0)
                            .map(() => Math.floor(Math.random() * defense.diceSides) + 1);
                        const defenseRollsStr = defenseRolls.join(', ');
                        game.logger.add(`The beam hits ${monster.name} for ${result.damage} damage! (ATK: ${damage.base}+[${rollsStr}] vs DEF: ${defense.base}+[${defenseRollsStr}]) (HP: ${monster.hp}/${monster.maxHp})`, "monsterInfo");
                    }
                    
                    // モンスターが死亡した場合
                    if (result.killed) {
                        game.logger.add(`${monster.name} is destroyed by the beam!`, "monsterInfo");
                        game.renderer.showDeathEffect(monster.x, monster.y);
                        game.playSound('deathSound');

                        // 死亡処理を適切に行う
                        game.processMonsterDeath({
                            monster: monster,
                            result: {
                                damage: finalDamage,
                                killed: true,
                                evaded: false
                            },
                            damageResult: {
                                totalAttack: damage.total,
                                attackRolls: damage.rolls,
                                defenseRolls: isCritical ? [] : defenseRolls
                            },
                            context: {
                                isPlayer: false,
                                isCritical: isCritical,
                                attackType: "Friendly fire",
                                damageMultiplier: 1,
                                killedByPlayer: false
                            }
                        });
                    }
                }

                // クールダウンを設定
                this.rangedAttackCooldownRemaining = this.abilities.rangedAttackCooldown;
                return true;
            }
        }

        // プレイヤーにダメージを与える
        const damage = this.calculateRangedDamage();
        const hitRoll = Math.floor(Math.random() * 100) + 1;
        const baseHitChance = this.accuracy;

        // 周囲のモンスターによるペナルティを計算
        const surroundingMonsters = this.countSurroundingMonsters(game);
        const penaltyPerMonster = 15;
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

        // ペナルティを基本命中率に適用
        const penalizedAccuracy = Math.floor(baseHitChance * (1 - surroundingPenalty));

        // サイズによる命中補正を適用
        const sizeModifier = GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.SIZE_ACCURACY_MODIFIER(game.player.stats);

        // 最終的な命中率を計算（5%から95%の間に制限）
        const hitChance = Math.min(95, Math.max(5, penalizedAccuracy + sizeModifier));
        const isCritical = hitRoll <= GAME_CONSTANTS.FORMULAS.CRITICAL_RANGE(this.stats);
        const hit = isCritical || hitRoll <= hitChance;

        // プレイヤーの視界内にいる場合のみメッセージとエフェクトを表示
        const isVisibleToPlayer = game.getVisibleTiles()
            .some(tile => tile.x === this.x && tile.y === this.y);

        if (isVisibleToPlayer) {
            // エフェクトを表示
            game.renderer.showRangedAttackEffect(this.x, this.y, game.player.x, game.player.y, '#00FFFF');
            game.playSound('rangedAttackSound');

            // 命中判定結果のログ表示
            game.logger.add(`${this.name} fires an energy beam at you! (ACC: ${Math.floor(hitChance)}% | Roll: ${hitRoll}${isCritical ? ' [CRITICAL HIT!]' : ''})`, "monsterInfo");
            
            if (hit) {
                let finalDamage = 0;
                let defenseRolls = [];
                
                if (isCritical) {
                    // クリティカルヒット時は防御無視
                    finalDamage = damage.total;
                    game.logger.add(`Critical hit!`, "monsterCrit");
                    
                    // ダメージを適用
                    const result = game.player.takeDamage(finalDamage, game);
                    
                    // ダメージエフェクト
                    game.renderer.showCritEffect(game.player.x, game.player.y);
                    game.renderer.showDamageFlash();
                    game.playSound('critSound');
                    
                    // ログメッセージ
                    const rollsStr = damage.rolls.join(', ');
                    game.logger.add(`The beam hits for ${result.damage} damage! (ATK: ${damage.base}+[${rollsStr}] vs DEF: [IGNORED]) (HP: ${game.player.hp}/${game.player.maxHp})`, "monsterCrit");
                } else {
                    // 通常命中の場合は防御計算
                    const defense = game.player.defense;
                    defenseRolls = Array(defense.diceCount).fill(0)
                        .map(() => Math.floor(Math.random() * defense.diceSides) + 1);
                    const totalDefense = defense.base + defenseRolls.reduce((sum, roll) => sum + roll, 0);
                    finalDamage = Math.max(1, damage.total - totalDefense);
                    
                    // ダメージを適用
                    const result = game.player.takeDamage(finalDamage, game);
                    
                    // ダメージエフェクト
                    game.renderer.showDamageFlash();
                    game.playSound('rangedAttackSound');
                    
                    // ログメッセージ
                    const rollsStr = damage.rolls.join(', ');
                    const defenseRollsStr = defenseRolls.join(', ');
                    game.logger.add(`The beam hits for ${result.damage} damage! (ATK: ${damage.base}+[${rollsStr}] vs DEF: ${defense.base}+[${defenseRollsStr}]) (HP: ${game.player.hp}/${game.player.maxHp})`, "monsterHit");
                }
            } else {
                game.logger.add(`The beam misses you!`, "monsterMiss");
                game.renderer.showMissEffect(game.player.x, game.player.y, 'miss');
                game.playSound('missSound');
            }
        }

        // 遠距離攻撃の位置を記録（音源として）
        game.lastRangedAttackLocation = { x: this.x, y: this.y };
        
        // クールダウンを設定
        this.rangedAttackCooldownRemaining = this.abilities.rangedAttackCooldown;
        
        return true;
    }
    
    // 遠距離攻撃のダメージを計算するメソッド
    calculateRangedDamage() {
        const damageData = this.abilities.rangedAttackDamage;
        let damage = damageData.base;
        
        // ダイスロール
        let rolls = [];
        for (let i = 0; i < damageData.diceCount; i++) {
            const roll = Math.floor(Math.random() * damageData.diceSides) + 1;
            rolls.push(roll);
            damage += roll;
        }
        
        return {
            total: damage,
            base: damageData.base,
            rolls: rolls,
            diceCount: damageData.diceCount,
            diceSides: damageData.diceSides
        };
    }

    // 周囲のモンスターの数を数えるメソッド
    countSurroundingMonsters(game) {
        let count = 0;
        
        // 周囲の8方向をチェック
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                // 自身の位置はスキップ
                if (dx === 0 && dy === 0) continue;
                
                const x = this.x + dx;
                const y = this.y + dy;
                
                // 範囲内かつ床であることを確認
                if (game.isValidPosition(x, y) && game.map[y][x] === 'floor') {
                    // その位置にモンスターがいるか確認
                    const monster = game.getMonsterAt(x, y);
                    if (monster) {
                        count++;
                    }
                }
            }
        }
        
        return count;
    }

    // モンスターのメインカテゴリを取得
    getMainCategory() {
        return MONSTERS[this.type].category?.primary || null;
    }

    // モンスターのサブカテゴリを取得
    getSubCategory() {
        return MONSTERS[this.type].category?.secondary || null;
    }

    // 特定のカテゴリに属しているかチェック
    isOfCategory(primaryCategory, secondaryCategory = null) {
        const mainCat = this.getMainCategory();
        const subCat = this.getSubCategory();
        
        if (!mainCat) return false;
        
        if (secondaryCategory) {
            return mainCat === primaryCategory && subCat === secondaryCategory;
        } else {
            return mainCat === primaryCategory;
        }
    }

    // ========================== isBleeding Method ==========================
    isBleeding() {
        return this.bleedingEffects && this.bleedingEffects.length > 0;
    }

    // ========================== getBleedingSeverity Method ==========================
    getBleedingSeverity() {
        if (!this.isBleeding()) return 0;
        
        // Calculate total damage per turn from all bleeding effects
        const totalDamagePerTurn = this.bleedingEffects.reduce((sum, effect) => sum + effect.damagePerTurn, 0);
        
        // Return severity based on damage as percentage of max HP
        const damagePercent = (totalDamagePerTurn / this.maxHp) * 100;
        
        if (damagePercent >= 10) return 3;  // Severe bleeding (>= 10% HP per turn)
        if (damagePercent >= 5) return 2;   // Moderate bleeding (>= 5% HP per turn)
        return 1;                           // Light bleeding (< 5% HP per turn)
    }
} 