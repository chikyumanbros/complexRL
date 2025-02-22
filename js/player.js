class Player {
    // ===== Constructor and Initialization =====
    constructor(x = 0, y = 0, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.char = '@';
        this.level = 1;
        this.codexPoints = 100;  // codexポイントのみを使用
        this.xp = 14;                  // 経験値の初期化
        this.xpToNextLevel = this.calculateRequiredXP(1);  // レベル1から2への必要経験値
        this.stats = { ...GAME_CONSTANTS.STATS.DEFAULT_VALUES };

        // HPの計算
        this.maxHp = GAME_CONSTANTS.FORMULAS.MAX_HP(this.stats, this.level);
        this.hp = this.maxHp;
        
        // 他のパラメータ
        this.attackPower = GAME_CONSTANTS.FORMULAS.ATTACK(this.stats);
        this.defense = GAME_CONSTANTS.FORMULAS.DEFENSE(this.stats);
        this.accuracy = GAME_CONSTANTS.FORMULAS.ACCURACY(this.stats);
        this.evasion = GAME_CONSTANTS.FORMULAS.EVASION(this.stats);

        this.skills = new Map();  // スキルマップの初期化
        this.nextAttackModifiers = [];  // 攻撃修飾効果の初期化
        this.meditation = null;  // メディテーション状態を追加

        // vigorの初期化を確実に行う
        if (!Number.isFinite(GAME_CONSTANTS.VIGOR.DEFAULT)) {
            console.error('VIGOR.DEFAULT is not a valid number:', GAME_CONSTANTS.VIGOR.DEFAULT);
            this.vigor = 100; // フォールバック値
        } else {
            this.vigor = GAME_CONSTANTS.VIGOR.DEFAULT;
        }

        // 各種パラメータの計算
        this.updateDerivedStats();

        this.lastPosition = null;  // 前回の位置を記録するプロパティを追加
        this.autoExploring = false;  // 自動探索フラグを追加
        this.detectedPresences = new Set();  // 既に感知した存在を記録
        this.name = '';  // プレイヤー名を追加
    }

    // ===== Experience and Leveling Methods =====
    // 新規: 必要経験値を計算するメソッド
    calculateRequiredXP(level) {
        // 基本値を30に増加
        const baseXP = 10;
        // 成長率を2.0に増加（より急な曲線に）
        const growthRate = 1.75;
        // 追加の補正値を導入（レベルが上がるごとに必要量が更に増加）
        const additionalXP = Math.floor(Math.pow(level, 1.5) * 5);
        
        // 最終的な必要経験値を計算
        return Math.floor(baseXP * Math.pow(growthRate, level - 1) + additionalXP);
    }

    // 新規: 経験値を追加しレベルアップの判定を行うメソッド
    addExperience(amount) {
        this.xp += amount;
        while (this.xp >= this.xpToNextLevel) {
            this.xp -= this.xpToNextLevel;
            this.levelUp();
        }
    }

    // 新規: レベルアップ時の処理
    levelUp() {
        this.level++;
        this.xpToNextLevel = this.calculateRequiredXP(this.level);
        
        // レベルアップ時のログ出力とフラッシュエフェクト
        this.game.logger.add(`Level up! You are now level ${this.level}.`, "important");
        this.game.logger.add("Choose a stat to increase:", "playerInfo");
        this.game.logger.add("[S]trength | [D]exterity | [C]onstitution | [I]ntelligence | [W]isdom", "playerInfo");
        
        // エフェクトの表示
        this.game.renderer.showLevelUpEffect(this.x, this.y);
        this.game.renderer.showLightPillarEffect(this.x, this.y);
        this.game.renderer.flashLogPanel();
        
        this.game.setInputMode('statSelect', {
            callback: (stat) => {
                // 選択されたステータスを増加
                this.stats[stat] += 1;
                
                // ステータス名の取得を定数から行う
                const statNames = GAME_CONSTANTS.STATS.NAMES;
                this.game.logger.add(`${statNames[stat]} increased to ${this.stats[stat]}!`, "playerInfo");
                
                // 以前のmaxHpを保存
                const oldMaxHp = this.maxHp;
                
                // 派生パラメータの再計算
                this.maxHp = GAME_CONSTANTS.FORMULAS.MAX_HP(this.stats, this.level);
                
                // HPの増加分を計算
                const hpIncrease = Math.max(0, this.maxHp - oldMaxHp);
                
                // Wisdomに基づくvigor回復量を計算（NaNチェック追加）
                const vigorRecovery = !this.stats.WIS || isNaN(this.stats.WIS) 
                    ? 0 
                    : Math.floor(this.stats.WIS / 2);
                
                // 総回復量を計算（最大HPを超えない範囲で）
                const totalRecovery = Math.min(
                    this.maxHp - this.hp,  // 最大HPまでの残り
                    hpIncrease + vigorRecovery  // 総回復量
                );
                
                // HP回復を適用（NaNチェックと最大値制限を追加）
                if (isNaN(totalRecovery)) {
                    console.error('Total recovery was NaN:', {
                        maxHp: this.maxHp,
                        oldMaxHp,
                        hpIncrease,
                        vigorRecovery,
                        currentHp: this.hp,
                        stats: this.stats
                    });
                    this.hp = Math.min(this.hp + hpIncrease, this.maxHp);
                } else {
                    this.hp = Math.min(this.hp + totalRecovery, this.maxHp);
                }
                
                // vigor回復（NaNチェック追加）
                if (!isNaN(vigorRecovery) && vigorRecovery > 0) {
                    const oldVigor = this.vigor;
                    this.vigor = Math.min(GAME_CONSTANTS.VIGOR.MAX, this.vigor + vigorRecovery);
                    const vigorGained = this.vigor - oldVigor;
                    if (vigorGained > 0) {
                        this.game.logger.add(`Vigor restored by ${vigorGained} points!`, "playerInfo");
                    }
                }
                
                // 他のステータスの更新
                this.attackPower = GAME_CONSTANTS.FORMULAS.ATTACK(this.stats);
                this.defense = GAME_CONSTANTS.FORMULAS.DEFENSE(this.stats);
                this.accuracy = GAME_CONSTANTS.FORMULAS.ACCURACY(this.stats);
                this.evasion = GAME_CONSTANTS.FORMULAS.EVASION(this.stats);
                
                // HP増加と回復のログを表示
                this.game.logger.add(`Maximum HP increased by ${hpIncrease}!`, "playerInfo");
                if (totalRecovery > 0) {
                    this.game.logger.add(`You feel invigorated! (Recovered ${totalRecovery} HP)`, "playerInfo");
                }
                
                // 画面更新
                this.game.renderer.render();
                
                // 入力モードを通常に戻す
                this.game.setInputMode('normal');
            }
        });
    }

    // ===== Movement Methods =====
    move(dx, dy, map) {
        // 移動時にメディテーションを解除
        if (this.meditation && this.meditation.active) {
            this.game.logger.add(`Meditation cancelled. (Total healed: ${this.meditation.totalHealed})`, "playerInfo");
            this.meditation = null;
        }

        const newX = this.x + dx;
        const newY = this.y + dy;
        
        if (this.canMoveTo(newX, newY, map)) {
            // 移動前の位置を保存
            this.lastPosition = { x: this.x, y: this.y };
            this.x = newX;
            this.y = newY;

            // ポータルチェックを追加
            if (this.game.floorLevel === 0 && 
                this.game.tiles[this.y][this.x] === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                // ポータルの処理を直接ここで行う
                this.game.logger.add("Enter the portal? [y/n]", "important");
                this.game.setInputMode('confirm', {
                    callback: (confirmed) => {
                        if (confirmed) {
                            this.game.logger.add("You step into the portal...", "important");
                            // ポータル通過アニメーションを開始
                            this.game.renderer.startPortalTransition(() => {
                                this.game.floorLevel++;
                                this.game.generateNewFloor();
                            });
                        } else {
                            this.game.logger.add("You decide not to enter the portal.", "info");
                        }
                        this.game.setInputMode('normal');
                    }
                });
            } else if (this.game.tiles[this.y][this.x] === GAME_CONSTANTS.PORTAL.VOID.CHAR) {
                // VOIDポータルの処理
                this.game.logger.add("Enter the VOID portal? [y/n]", "important");
                this.game.setInputMode('confirm', {
                    callback: (confirmed) => {
                        if (confirmed) {
                            this.game.logger.add("You step into the VOID portal...", "important");
                            // ポータル通過アニメーションを開始
                            this.game.renderer.startPortalTransition(() => {
                                this.game.floorLevel = 0;  // ホームフロアに戻る
                                this.game.generateNewFloor();
                                
                                // プレイヤーをホームフロアのポータルの1マス下に配置
                                for (let y = 0; y < this.game.height; y++) {
                                    for (let x = 0; x < this.game.width; x++) {
                                        if (this.game.tiles[y][x] === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                                            this.x = x;
                                            this.y = y + 1;  // ポータルの1マス下
                                            return;
                                        }
                                    }
                                }
                            });
                        } else {
                            this.game.logger.add("You decide not to enter the VOID portal.", "info");
                        }
                        this.game.setInputMode('normal');
                    }
                });
            }

            return true;
        }
        return false;
    }

    canMoveTo(x, y, map) {
        // マップ範囲外のチェック
        if (x < 0 || x >= map[0].length || y < 0 || y >= map.length) {
            console.log('Out of bounds');
            return false;
        }
        
        // 追加: 閉じたドアの場合、移動不可
        if (this.game.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
            console.log('Blocked by a closed door');
            return false;
        }
        
        const isFloor = map[y][x] === 'floor';
        const isStairs = this.game.tiles[y][x] === GAME_CONSTANTS.STAIRS.CHAR;
        const isPortal = this.game.tiles[y][x] === GAME_CONSTANTS.PORTAL.GATE.CHAR;
        const isVoid = this.game.tiles[y][x] === GAME_CONSTANTS.PORTAL.VOID.CHAR;
        
        return isFloor || isStairs || isPortal || isVoid;
    }

    // ===== Skill Management Methods =====
    hasEmptySkillSlot() {
        return Array.from(this.skills.keys()).length < 10;
    }

    getEmptySlot() {
        for (let i = 0; i < 10; i++) {
            if (!this.skills.has(i)) return i;
        }
        return null;
    }

    assignSkill(skillId, slot) {
        this.skills.set(slot, {
            id: skillId,
            remainingCooldown: 0
        });
    }

    removeSkill(slot) {
        this.skills.delete(slot);
    }

    // ===== Damage Handling Methods =====
    takeDamage(amount, context = {}) {
        // mindカテゴリのスキルをチェック
        if (this.meditation && this.meditation.active) {
            const meditationSkill = this.game.codexSystem.findSkillById('meditation');
            if (meditationSkill && meditationSkill.cancelOnDamage) {
                this.game.logger.add(`Meditation cancelled. (Total healed: ${this.meditation.totalHealed})`, "playerInfo");
                this.meditation = null;
            }
        }

        // 元のevasion値を保持
        const baseEvasion = this.evasion;

        // 周囲のモンスター数によるペナルティを計算
        const surroundingMonsters = this.countSurroundingMonsters(this.game);
        const penaltyPerMonster = 15; // 1体につき15%のペナルティ
        // 2体以上からペナルティ適用（surroundingMonsters - 1）
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

        // 回避率にペナルティを一時的に適用
        this.evasion = Math.floor(baseEvasion * (1 - surroundingPenalty));

        // クリティカルヒットの場合、回避と防御を無視
        let damage;
        if (context.isCritical) {
            damage = amount;  // 防御計算なしで直接ダメージを適用
        } else {
            damage = Math.max(1, amount);
        }
        
        // HPが0未満にならないように制限
        this.hp = Math.max(0, this.hp - damage);
        
        // HPが0になった場合の処理
        if (this.hp === 0) {
            this.game.renderer.showDeathEffect(this.x, this.y);
            this.game.gameOver();
        }
        
        // ダメージを受けた時にステータスパネルをフラッシュ
        this.game.renderer.flashStatusPanel();
        this.game.renderer.render();

        // ダメージ結果を返す
        const result = {
            damage: damage,
            killed: this.hp === 0,
            evaded: false
        };

        if (surroundingPenalty > 0) {
            this.game.logger.add(`Surrounded! (-${Math.floor(surroundingPenalty * 100)}% evasion)`, "warning");
        }

        // evasionを元の値に戻す
        this.evasion = baseEvasion;

        return result;
    }

    // ===== Combat Resolution Methods =====
    attackMonster(monster, game) {
        // 機会攻撃の条件をチェック（逃走中で逃げ場がある場合）
        if (monster.hasStartedFleeing && monster.checkEscapeRoute(game)) {
            // 機会攻撃の場合は、イニシアチブ判定や反撃なしで直接攻撃を解決
            this.resolvePlayerAttack(monster, game);
            return;
        }

        // 通常の攻撃処理（イニシアチブ判定あり）
        const basePlayerSpeed = GAME_CONSTANTS.FORMULAS.SPEED(this.stats);
        let effectivePlayerSpeed = basePlayerSpeed;

        // 修飾効果がある場合（nextAttackModifiersの存在チェックを追加）
        if (this.nextAttackModifiers?.length > 0) {
            // speedTierが設定されている場合はそれを使用
            const speedTierMod = this.nextAttackModifiers.find(mod => mod.speedTier);
            if (speedTierMod) {
                // speedTierを適用した新しいスピードオブジェクトを作成
                const speedNames = ["Very Slow", "Slow", "Normal", "Fast", "Very Fast"];
                effectivePlayerSpeed = {
                    value: speedTierMod.speedTier,
                    name: speedNames[Math.min(4, speedTierMod.speedTier - 1)]
                };
            }
        }

        const monsterSpeed = GAME_CONSTANTS.FORMULAS.SPEED(monster.stats);
        
        // 修正されたスピード値でログを出力
        game.logger.add(`Speed Order: Player (${effectivePlayerSpeed.name}) vs ${monster.name} (${monsterSpeed.name})`);

        // イニシアチブ判定を修正：speedの値を直接比較
        if (effectivePlayerSpeed.value >= monsterSpeed.value) {
            // プレイヤーの攻撃が先行する場合
            const attackResult = this.resolvePlayerAttack(monster, game);
            if (monster.hp > 0 && !attackResult.killed) {  // 追加: killed チェック
                monster.attackPlayer(this, game);
                monster.hasActedThisTurn = true;
            }
        } else {
            // モンスターの攻撃が先行する場合（先制反撃）
            game.logger.add(`${monster.name} acts preemptively!`, "monsterInfo");
            monster.attackPlayer(this, game);
            monster.hasActedThisTurn = true;
            if (this.hp > 0) {
                this.resolvePlayerAttack(monster, game);
            }
        }

        this.updateCombatEffects(game, monster);
    }

    resolvePlayerAttack(monster, game) {
        const result = CombatSystem.resolveCombatAction(this, monster, game, {
            isPlayer: true,
            isOpportunityAttack: monster.hasStartedFleeing && monster.checkEscapeRoute(game),
            nextAttackModifiers: this.nextAttackModifiers
        });
        
        if (result.hit) {
            game.lastAttackHit = true;
            // nextAttackModifiersのクリアはCombatSystemで行われるため、ここでは不要
        }
        
        return result;
    }

    // ===== Utility and Status Methods =====
    getHealthStatus(currentHp, maxHp) {
        return GAME_CONSTANTS.HEALTH_STATUS.getStatus(currentHp, maxHp, this.stats);
    }

    useSkill(skillId, target, game) {
        // スキルスロットを見つける
        let skillSlot = null;
        for (const [slot, skill] of this.skills.entries()) {
            if (skill.id === skillId) {
                skillSlot = slot;
                break;
            }
        }

        if (skillSlot === null) {
            game.logger.add("You do not have that skill!", "warning");
            return false;
        }

        const skillData = this.skills.get(skillSlot);
        if (skillData.remainingCooldown > 0) {
            game.logger.add(`The skill is on cooldown! (${skillData.remainingCooldown} turns left)`, "warning");
            return false;
        }

        const skill = game.codexSystem.findSkillById(skillId);
        if (!skill) return false;

        // スキル効果の実行と結果の取得
        const effectResult = skill.effect(game, this, target);
        
        // スキルの実行が成功した場合のみ、以降の処理を行う
        if (effectResult === true || (typeof effectResult === 'object' && effectResult.success)) {
            // クールダウンの設定
            // フリーアクションの場合は+1しない
            skillData.remainingCooldown = skill.isFreeAction ? skill.cooldown : skill.cooldown + 1;

            // スキルがフリーアクションでない場合、かつ
            // effectResult.skipTurnProcess が true でない場合のみターンを消費
            if (!skill.isFreeAction && !(typeof effectResult === 'object' && effectResult.skipTurnProcess)) {
                game.processTurn();
            }
            game.renderer.renderStatus();
            return true;
        }

        return false;
    }

    updateDerivedStats() {
        this.validateVigor();  // Vigorの検証を追加
        // Calculate perception
        this.perception = GAME_CONSTANTS.FORMULAS.PERCEPTION(this.stats);
        
        // 他の派生パラメータの更新
        this.maxHp = GAME_CONSTANTS.FORMULAS.MAX_HP(this.stats, this.level);
        this.attackPower = GAME_CONSTANTS.FORMULAS.ATTACK(this.stats);
        this.defense = GAME_CONSTANTS.FORMULAS.DEFENSE(this.stats);
        this.accuracy = GAME_CONSTANTS.FORMULAS.ACCURACY(this.stats);
        this.evasion = GAME_CONSTANTS.FORMULAS.EVASION(this.stats);
    }

    getCodexPoints() {
        return this.codexPoints;
    }

    // 変更: 経験値情報を含むように getStatus を更新
    getStatus() {
        // 周囲のモンスター数によるペナルティを計算
        const surroundingMonsters = this.countSurroundingMonsters(this.game);
        const penaltyPerMonster = 15; // 1体につき15%のペナルティ
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

        // ペナルティ適用後の値を計算
        const penalizedAccuracy = Math.floor(this.accuracy * (1 - surroundingPenalty));
        const penalizedEvasion = Math.floor(this.evasion * (1 - surroundingPenalty));

        // ペナルティがある場合は赤色で表示
        const formatStat = (original, penalized) => {
            if (penalized < original) {
                return `<span style="color: #e74c3c">${penalized}</span>`;
            }
            return original;
        };

        return {
            name: "Player",
            level: this.level,
            xp: `${this.xp}/${this.xpToNextLevel}`,
            hp: `${this.hp}/${this.maxHp}`,
            stats: this.stats,
            derived: {
                attack: `${this.attackPower.base}+${this.attackPower.diceCount}d${this.attackPower.diceSides}`,
                defense: `${this.defense.base}+${this.defense.diceCount}d${this.defense.diceSides}`,
                speed: `${GAME_CONSTANTS.FORMULAS.SPEED(this.stats)}`,
                accuracy: formatStat(this.accuracy, penalizedAccuracy),
                evasion: formatStat(this.evasion, penalizedEvasion),
                perception: this.perception
            }
        };
    }

    // ===== Floor Navigation and Surroundings Methods =====
    descendStairs() {
        // ポータルの処理を追加
        if (this.game.floorLevel === 0 && 
            this.game.tiles[this.y][this.x] === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
            this.game.logger.add("Enter the portal? [y/n]", "important");
            this.game.setInputMode('confirm', {
                callback: (confirmed) => {
                    if (confirmed) {
                        this.game.logger.add("You step into the portal...", "important");
                        // ポータル通過アニメーションを開始
                        this.game.renderer.startPortalTransition(() => {
                            this.game.floorLevel++;
                            this.game.generateNewFloor();
                        });
                    } else {
                        this.game.logger.add("You decide not to enter the portal.", "info");
                    }
                    this.game.setInputMode('normal');
                }
            });
            return true;
        }
        
        // 通常の階段の処理
        if (this.game.tiles[this.y][this.x] === GAME_CONSTANTS.STAIRS.CHAR) {
            this.game.floorLevel++;
            this.game.logger.add(`You descend to floor ${this.game.floorLevel}...`, "important");
            this.game.generateNewFloor();
            return true;
        }
        return false;
    }

    // 新規メソッド: プレイヤーの周囲のモンスター数をカウント
    countSurroundingMonsters(game) {
        let count = 0;
        const directions = [
            {x: -1, y: -1}, {x: 0, y: -1}, {x: 1, y: -1},
            {x: -1, y: 0},                  {x: 1, y: 0},
            {x: -1, y: 1},  {x: 0, y: 1},  {x: 1, y: 1}
        ];

        for (const dir of directions) {
            const checkX = this.x + dir.x;
            const checkY = this.y + dir.y;
            if (game.getMonsterAt(checkX, checkY)) {
                count++;
            }
        }
        return count;
    }

    // 自動探索を開始
    startAutoExplore() {
        this.autoExploring = true;
        this.game.logger.add("Auto-exploring...", "playerInfo");
        this.continueAutoExplore();
    }

    // 自動探索を停止
    stopAutoExplore() {
        if (this.autoExploring) {
            this.autoExploring = false;
            this.game.logger.add("Auto-explore stopped.", "playerInfo");
        }
    }

    // 自動探索を継続
    continueAutoExplore() {
        if (!this.autoExploring) return;

        // 視界内の敵をチェック
        const visibleTiles = this.game.getVisibleTiles();
        const visibleTilesSet = new Set(visibleTiles.map(({x, y}) => `${x},${y}`));
        
        const visibleMonsters = this.game.monsters.filter(monster => {
            const monsterKey = `${monster.x},${monster.y}`;
            return visibleTilesSet.has(monsterKey);
        });

        if (visibleMonsters.length > 0) {
            this.stopAutoExplore();
            this.game.logger.add("Enemy spotted in range!", "warning");
            return;
        }

        // 未探索タイルへの方向を見つける
        const direction = this.findDirectionToUnexplored();
        if (!direction) {
            this.stopAutoExplore();
            this.game.logger.add("Auto-explore complete: No more areas to explore.", "playerInfo");
            return;
        }

        // 移動実行
        if (this.move(direction.dx, direction.dy, this.game.map)) {
            this.game.processTurn();
            // 次のターンの自動探索をスケジュール
            setTimeout(() => this.continueAutoExplore(), 50);
        } else {
            this.stopAutoExplore();
        }
    }

    // 未探索タイルへの方向を見つける
    findDirectionToUnexplored() {
        const directions = [
            {dx: 0, dy: -1},  // 上
            {dx: 1, dy: -1},  // 右上
            {dx: 1, dy: 0},   // 右
            {dx: 1, dy: 1},   // 右下
            {dx: 0, dy: 1},   // 下
            {dx: -1, dy: 1},  // 左下
            {dx: -1, dy: 0},  // 左
            {dx: -1, dy: -1}  // 左上
        ];

        const visited = new Set();
        const queue = [{
            x: this.x,
            y: this.y,
            distance: 0,
            firstStep: null
        }];

        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.x},${current.y}`;

            if (visited.has(key)) continue;
            visited.add(key);

            if (this.game.isValidPosition(current.x, current.y) && 
                !this.game.explored[current.y][current.x] && 
                this.game.map[current.y][current.x] === 'floor') {
                return current.firstStep;
            }

            for (const dir of directions) {
                const newX = current.x + dir.dx;
                const newY = current.y + dir.dy;
                
                if (this.game.isValidPosition(newX, newY) && 
                    this.game.map[newY][newX] === 'floor' &&
                    this.game.tiles[newY][newX] !== GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                    
                    // ユークリッド距離を使用
                    const newDistance = current.distance + GAME_CONSTANTS.DISTANCE.calculate(
                        current.x, current.y,
                        newX, newY
                    );
                    
                    queue.push({
                        x: newX,
                        y: newY,
                        distance: newDistance,
                        firstStep: current.firstStep || dir
                    });
                }
            }

            // キューを距離でソート（より近いタイルを優先）
            queue.sort((a, b) => a.distance - b.distance);
        }

        // マップ全体をスキャンして未探索のfloorタイルが残っているか確認
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                if (this.game.map[y][x] === 'floor' && !this.game.explored[y][x]) {
                    this.game.logger.add("Some areas are unreachable.", "warning");
                    return null;
                }
            }
        }

        return null;  // 完全に探索済み
    }

    // ステータス表示用のメソッドを追加
    getModifiedStats() {
        const stats = {
            damage: this.attackPower.base,
            accuracy: this.accuracy,
            speed: this.speed
        };

        if (this.nextAttackModifiers && this.nextAttackModifiers.length > 0) {
            let totalDamageMod = 1;
            let totalAccuracyMod = 0;
            let totalSpeedMod = 0;

            for (const modifier of this.nextAttackModifiers) {
                if (modifier.damageMod) totalDamageMod *= modifier.damageMod;
                if (modifier.accuracyMod) totalAccuracyMod += modifier.accuracyMod;
                if (modifier.speedMod) totalSpeedMod += modifier.speedMod;
            }

            stats.damage *= totalDamageMod;
            stats.accuracy += totalAccuracyMod;
            stats.speed += totalSpeedMod;
        }

        return stats;
    }


    // ----------------------
    // Auto Move to Stairs Methods
    // ----------------------
    findExploredStairs() {
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                if (this.game.explored[y][x] && 
                    this.game.tiles[y][x] === GAME_CONSTANTS.STAIRS.CHAR) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    startAutoMoveToStairs(stairLocation) {
        this.game.player.autoMovingToStairs = true;
        this.game.logger.add("Moving to stairs...", "playerInfo");
        this.continueAutoMoveToStairs(stairLocation);
    }

    continueAutoMoveToStairs(stairLocation) {
        const player = this.game.player;
        if (!player.autoMovingToStairs) return;

        // 視界内の敵をチェック
        const visibleTiles = this.game.getVisibleTiles();
        const visibleTilesSet = new Set(visibleTiles.map(({x, y}) => `${x},${y}`));
        
        const visibleMonsters = this.game.monsters.filter(monster => {
            const monsterKey = `${monster.x},${monster.y}`;
            return visibleTilesSet.has(monsterKey);
        });

        if (visibleMonsters.length > 0) {
            player.stopAutoMoveToStairs();
            this.game.logger.add("Enemy spotted in range!", "warning");
            return;
        }

        // 階段への方向を見つける
        const direction = this.findDirectionToStairs(stairLocation);
        if (!direction) {
            player.stopAutoMoveToStairs();
            this.game.logger.add("Cannot reach the stairs from here.", "warning");
            return;
        }

        // 移動実行
        if (player.move(direction.dx, direction.dy, this.game.map)) {
            this.game.processTurn();
            // 階段に到着したかチェック
            if (player.x === stairLocation.x && player.y === stairLocation.y) {
                player.stopAutoMoveToStairs();
                this.game.logger.add("You arrive at the stairs. Press '>' to descend.", "playerInfo");
            } else {
                // 次のターンの自動移動をスケジュール
                setTimeout(() => this.continueAutoMoveToStairs(stairLocation), 50);
            }
        } else {
            player.stopAutoMoveToStairs();
        }
    }

    findDirectionToStairs(stairLocation) {
        const player = this.game.player;
        const visited = new Set();
        const queue = [{
            x: player.x,
            y: player.y,
            firstStep: null
        }];

        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.x},${current.y}`;

            if (visited.has(key)) continue;
            visited.add(key);

            // 階段に到達したかチェック
            if (current.x === stairLocation.x && current.y === stairLocation.y) {
                return current.firstStep;
            }

            // 隣接マスの探索
            const directions = [
                {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
                {dx: -1, dy: 0},                    {dx: 1, dy: 0},
                {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
            ];

            for (const dir of directions) {
                const newX = current.x + dir.dx;
                const newY = current.y + dir.dy;
                
                if (this.game.isValidPosition(newX, newY) && 
                    this.game.map[newY][newX] === 'floor') {
                    queue.push({
                        x: newX,
                        y: newY,
                        firstStep: current.firstStep || dir
                    });
                }
            }
        }

        return null;  // 到達可能な経路が見つからない
    }

    // ----------------------
    // Auto Move to Stairs Methods
    // ----------------------
    stopAutoMoveToStairs() {
        if (this.autoMovingToStairs) {
            this.autoMovingToStairs = false;
            this.game.logger.add("Auto-move to stairs stopped.", "playerInfo");
        }
    }

    // 新規: プレイヤーの知覚チェックメソッド
    checkPerception(game) {
        if (game.hasDisplayedPresenceWarning) return;

        const playerPerception = GAME_CONSTANTS.FORMULAS.PERCEPTION(this.stats);
        
        // まだ感知していないモンスターのみをフィルタリング
        const newNearbyMonsters = game.monsters.filter(monster => {
            if (this.detectedPresences.has(monster.id)) return false;
            
            const distance = monster.getPathDistanceToPlayer(game);
            const size = GAME_CONSTANTS.FORMULAS.SIZE(monster.stats);
            const sizeBonus = (size.value - 3) * 2;
            
            return distance <= (playerPerception + sizeBonus) && 
                   !game.getVisibleTiles().some(tile => 
                       tile.x === monster.x && tile.y === monster.y
                   );
        });

        if (newNearbyMonsters.length === 0) return;

        // 新しく感知したモンスターを記録
        newNearbyMonsters.forEach(monster => {
            this.detectedPresences.add(monster.id);
        });

        // 感知した存在の大きさを考慮して脅威度を計算
        const effectivePresence = newNearbyMonsters.reduce((total, monster) => {
            const monsterSize = GAME_CONSTANTS.FORMULAS.SIZE(monster.stats);
            return total + Math.max(0.5, (monsterSize.value - 1) * 0.5);
        }, 0);

        // 最大サイズのモンスターを取得（メッセージの選択用）
        const largestMonster = newNearbyMonsters.reduce((largest, current) => {
            const currentSize = GAME_CONSTANTS.FORMULAS.SIZE(current.stats);
            const largestSize = GAME_CONSTANTS.FORMULAS.SIZE(largest.stats);
            return currentSize.value > largestSize.value ? current : largest;
        }, newNearbyMonsters[0]);

        const message = this.getPresenceMessage(effectivePresence, largestMonster);
        game.logger.add(message, "playerInfo");
        game.hasDisplayedPresenceWarning = true;
    }

    // 新規: 存在感知メッセージの生成
    getPresenceMessage(effectivePresence, largestMonster) {
        const size = GAME_CONSTANTS.FORMULAS.SIZE(largestMonster.stats);
        
        if (effectivePresence <= 1) {
            if (size.value >= 4) {
                return "You sense a massive presence lurking nearby...";
            } else if (size.value <= 2) {
                return "You sense something small scurrying in the shadows...";
            }
            return "You sense the presence of something nearby...";
        } else if (effectivePresence <= 2) {
            return "You sense multiple presences lurking in the shadows...";
        } else if (effectivePresence <= 4) {
            return "Several creatures are moving in the darkness around you...";
        } else if (effectivePresence <= 6) {
            return "Many creatures are stalking you from the shadows...";
        }
        return "You are surrounded by numerous hostile presences!";
    }

    updateCombatEffects(game, monster) {
        // 攻撃エフェクトの処理
        if (this.attackEffectTimer) {
            clearTimeout(this.attackEffectTimer);
            game.lastAttackLocation = null;
        }
        game.lastAttackLocation = { x: monster.x, y: monster.y };
        game.renderer.render();
        // 攻撃後にlook情報を更新
        game.renderer.examineTarget(monster.x, monster.y);
    }

    calculateSurroundingPenalty(surroundingMonsters) {
        const penaltyPerMonster = 15; // 1体につき15%のペナルティ
        // 2体以上からペナルティ適用（surroundingMonsters - 1）
        return Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;
    }

    validateVigor() {
        if (!Number.isFinite(this.vigor)) {
            console.warn('Vigor was invalid, resetting to default value');
            this.vigor = GAME_CONSTANTS.VIGOR.DEFAULT;
        }
        // 範囲内に収める
        this.vigor = Math.max(0, Math.min(GAME_CONSTANTS.VIGOR.MAX, this.vigor));
    }
} 