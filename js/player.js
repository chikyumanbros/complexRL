class Player {
    // ===== Constructor and Initialization =====
    constructor(x = 0, y = 0, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.char = '@';
        this.level = 1;
        this.codexPoints = 100;  // codexポイントのみを使用
        this.xp = 10;                  // 経験値の初期化
        this.xpToNextLevel = this.calculateRequiredXP(1);  // レベル1から2への必要経験値
        this.stats = {
            str: 8,
            dex: 8,
            con: 8,
            int: 8,
            wis: 8
        };

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

        // 治療関連のパラメータを定数ファイルから取得
        this.healingDice = GAME_CONSTANTS.FORMULAS.HEALING_DICE(this.stats);
        this.healModifier = GAME_CONSTANTS.FORMULAS.HEAL_MODIFIER(this.stats);

        // 各種パラメータの計算
        this.updateDerivedStats();

        this.lastPosition = null;  // 前回の位置を記録するプロパティを追加
        this.autoExploring = false;  // 自動探索フラグを追加
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
        this.game.logger.add(`Gained ${amount} XP! (Current: ${this.xp}/${this.xpToNextLevel})`, "playerInfo");
        while (this.xp >= this.xpToNextLevel) {
            this.xp -= this.xpToNextLevel;
            this.levelUp();
        }
    }

    // 新規: レベルアップ時の処理
    levelUp() {
        this.level++;
        this.xpToNextLevel = this.calculateRequiredXP(this.level);
        
        // レベルアップ時のログ出力
        this.game.logger.add(`Level up! You are now level ${this.level}.`, "important");
        this.game.logger.add("Choose a stat to increase:", "playerInfo");
        this.game.logger.add("[S]trength | [D]exterity | [C]onstitution | [I]ntelligence | [W]isdom", "playerInfo");
        
        // 常に最新のプレイヤーの座標からエフェクト発生
        this.game.renderer.showLevelUpEffect(this.game.player.x, this.game.player.y);
        this.game.renderer.showLightPillarEffect(this.game.player.x, this.game.player.y);
        
        this.game.setInputMode('statSelect', {
            callback: (stat) => {
                // 選択されたステータスを増加
                this.stats[stat] += 1;
                
                const statNames = {
                    str: "Strength",
                    dex: "Dexterity",
                    con: "Constitution",
                    int: "Intelligence",
                    wis: "Wisdom"
                };
                this.game.logger.add(`${statNames[stat]} increased to ${this.stats[stat]}!`, "playerInfo");
                
                // 派生パラメータの再計算
                this.maxHp = GAME_CONSTANTS.FORMULAS.MAX_HP(this.stats, this.level);
                this.hp = this.maxHp;
                this.attackPower = GAME_CONSTANTS.FORMULAS.ATTACK(this.stats);
                this.defense = GAME_CONSTANTS.FORMULAS.DEFENSE(this.stats);
                this.accuracy = GAME_CONSTANTS.FORMULAS.ACCURACY(this.stats);
                this.evasion = GAME_CONSTANTS.FORMULAS.EVASION(this.stats);
                
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
        
        return isFloor || isStairs;
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
    takeDamage(amount) {
        // 周囲のモンスター数によるペナルティを計算
        const surroundingMonsters = this.countSurroundingMonsters(this.game);
        const penaltyPerMonster = 15; // 1体につき15%のペナルティ
        // 2体以上からペナルティ適用（surroundingMonsters - 1）
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

        // 回避率にペナルティを適用
        this.evasion = Math.floor(this.evasion * (1 - surroundingPenalty));

        const damage = Math.max(1, amount);
        this.hp -= damage;
        
        // HPが0以下になった場合は0に設定
        if (this.hp <= 0) {
            this.hp = 0;
            this.game.renderer.showDeathEffect(this.x, this.y);
        }
        
        // ダメージを受けた時にステータスパネルをフラッシュ
        this.game.renderer.flashStatusPanel();
        this.game.renderer.render();

        // ダメージ結果を返す
        const result = {
            damage: damage,
            killed: this.hp <= 0,
            evaded: false
        };

        if (surroundingPenalty > 0) {
            this.game.logger.add(`Surrounded! (-${Math.floor(surroundingPenalty * 100)}% evasion)`, "warning");
        }

        // HPが0の場合、少し待ってからゲームオーバー処理
        if (result.killed) {
            setTimeout(() => {
                this.game.gameOver();
            }, 100);
        }

        return result;
    }

    // ===== Combat Resolution Methods =====
    // プレイヤーの攻撃処理をまとめるためのヘルパーメソッド
    resolvePlayerAttack(monster, game) {
        // 戦闘開始時に最後の戦闘対象を更新
        game.lastCombatMonster = monster;
        
        // 周囲のモンスター数によるペナルティを計算
        const surroundingMonsters = this.countSurroundingMonsters(game);
        const penaltyPerMonster = 15; // 1体につき15%のペナルティ
        // 2体以上からペナルティ適用（surroundingMonsters - 1）
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

        // 機会攻撃の判定
        const isOpportunityAttack = monster.hasStartedFleeing && monster.checkEscapeRoute(game);
        
        // 攻撃タイプの名前を設定
        const attackType = this.nextAttackModifiers && this.nextAttackModifiers.length > 0 
            ? (this.nextAttackModifiers.length > 1 
                ? "Combined Attack" 
                : this.nextAttackModifiers[0].name)
            : "attack";

        let hitChance = Math.floor(this.accuracy * (1 - surroundingPenalty));
        let damageMultiplier = 1;
        
        // 全ての修飾効果を累積
        let totalDamageMod = 1;
        let totalAccuracyMod = 0;
        let totalSpeedMod = 0;

        // 効果の説明文を生成
        let effectDesc = "";
        if (this.nextAttackModifiers && this.nextAttackModifiers.length > 0) {
            const effects = [];
            for (const modifier of this.nextAttackModifiers) {
                if (modifier.damageMod) {
                    totalDamageMod *= modifier.damageMod;
                    effects.push(`DMG: ${((modifier.damageMod - 1) * 100).toFixed(0)}%`);
                }
                if (modifier.accuracyMod) {
                    totalAccuracyMod += modifier.accuracyMod;
                    effects.push(`ACC: ${(modifier.accuracyMod * 100).toFixed(0)}%`);
                }
                if (modifier.speedMod) {
                    totalSpeedMod += modifier.speedMod;
                    effects.push(`SPD: ${(modifier.speedMod * 100).toFixed(0)}%`);
                }
            }
            effectDesc = ` [${effects.join(', ')}]`;
        }

        // 修飾効果を適用
        damageMultiplier *= totalDamageMod;
        hitChance += totalAccuracyMod;

        // 機会攻撃時は命中率-30%とダメージ1.5倍
        if (isOpportunityAttack) {
            hitChance *= 0.7;  // 30%減少
            damageMultiplier = 1.5;  // ダメージ1.5倍
            game.logger.add(`Opportunity attack! (-30% accuracy, +50% damage)`, "playerInfo");
        }

        if (surroundingPenalty > 0) {
            game.logger.add(`Surrounded by ${surroundingMonsters} enemies! (-${Math.floor(surroundingPenalty * 100)}% accuracy)`, "warning");
        }
        
        const roll = Math.floor(Math.random() * 100);
        game.logger.add(`You ${attackType}${effectDesc} ${monster.name} (ACC: ${Math.floor(hitChance)}% | Roll: ${roll})`, "playerInfo");
        
        if (roll >= hitChance) {
            game.logger.add(`Your ${attackType} misses!`, "playerMiss");
            game.lastAttackHit = false;  // 攻撃が外れた
            // 攻撃が外れた場合もnextAttackModifiersをクリア
            this.nextAttackModifiers = [];
            return;
        }

        // 逃走中のモンスターは機会攻撃を受けた場合、回避判定をスキップ
        if (!monster.hasStartedFleeing) {
            // 通常の回避判定
            const evadeRoll = Math.random() * 100;
            const evadeChance = monster.evasion || 0;
            if (evadeRoll < evadeChance) {
                game.logger.add(`${monster.name} dodges your ${attackType}! (EVA: ${Math.floor(evadeChance)}% | Roll: ${Math.floor(evadeRoll)})`, "monsterEvade");
                game.lastAttackHit = false;  // 攻撃が回避された
                // 回避された場合もnextAttackModifiersをクリア
                this.nextAttackModifiers = [];
                return;
            }
        }

        // ダメージが通った場合
        game.lastAttackHit = true;

        // ダメージロール処理を詳細に記録
        let attackRolls = [];
        let damage = this.attackPower.base;
        for (let i = 0; i < this.attackPower.diceCount; i++) {
            const diceRoll = Math.floor(Math.random() * this.attackPower.diceSides) + 1;
            attackRolls.push(diceRoll);
            damage += diceRoll;
        }

        let defenseRolls = [];
        let defense = monster.defense.base;
        for (let i = 0; i < monster.defense.diceCount; i++) {
            const diceRoll = Math.floor(Math.random() * monster.defense.diceSides) + 1;
            defenseRolls.push(diceRoll);
            defense += diceRoll;
        }

        const finalDamage = Math.floor((damage - defense) * damageMultiplier);
        const result = monster.takeDamage(finalDamage, game);
        const healthStatus = `HP: ${monster.hp}/${monster.maxHp}`;
        const attackRollStr = this.attackPower.base + `+${this.attackPower.diceCount}d${this.attackPower.diceSides}` +
            (damageMultiplier !== 1 ? ` ×${damageMultiplier.toFixed(1)}` : '');
        const defenseRollStr = monster.defense.base + `+${monster.defense.diceCount}d${monster.defense.diceSides}`;

        if (result.isOpportunityAttack) {
            game.logger.add(`Opportunity attack hits! ${monster.name} takes ${result.damage} damage! (ATK: ${attackRollStr} vs DEF: ${defenseRollStr})`, "playerCrit");
        }

        if (result.killed) {
            game.logger.add(
                `You killed the ${monster.name} with ${result.damage} damage! ` +
                `(ATK: ${this.attackPower.base}+[${attackRolls.join(',')}]${damageMultiplier !== 1 ? ` ×${damageMultiplier.toFixed(1)}` : ''} ` +
                `vs DEF: ${monster.defense.base}+[${defenseRolls.join(',')}])`,
                "kill"
            );
            game.removeMonster(monster);
            game.renderer.showDeathEffect(monster.x, monster.y);

            // codexPointsを加算
            this.codexPoints += result.codexPoints;
            game.logger.add(`Gained ${result.codexPoints} codex points!`, "playerInfo");

            // 経験値計算と表示
            const levelDiff = monster.level - this.level;
            const baseXP = Math.floor(monster.level);
            const levelMultiplier = levelDiff > 0 
                ? 1 + (levelDiff * 0.2)
                : Math.max(0.1, 1 + (levelDiff * 0.1));
            const intBonus = 1 + Math.max(0, (this.stats.int - 10) * 0.03);
            const xpGained = Math.max(1, Math.floor(baseXP * levelMultiplier * intBonus));
            if (intBonus > 1) {
                game.logger.add(`Intelligence bonus: ${Math.floor((intBonus - 1) * 100)}% more XP!`, "playerInfo");
            }
            this.addExperience(xpGained);

            // nextAttackModifiersをクリア
            this.nextAttackModifiers = [];
        } else if (!result.isOpportunityAttack) {
            game.logger.add(
                `${attackType} hits! ${monster.name} takes ${result.damage} damage! ` +
                `(ATK: ${this.attackPower.base}+[${attackRolls.join(',')}]${damageMultiplier !== 1 ? ` ×${damageMultiplier.toFixed(1)}` : ''} ` +
                `vs DEF: ${monster.defense.base}+[${defenseRolls.join(',')}])  (${healthStatus})`,
                "playerHit"
            );

            // nextAttackModifiersをクリア
            this.nextAttackModifiers = [];
        }

        // 戦闘後にlook情報を更新
        game.inputHandler.examineTarget();
    }

    // プレイヤーの攻撃にSPEEDによる処理順序を組み込む
    attackMonster(monster, game) {
        // 機会攻撃の条件をチェック（逃走中で逃げ場がある場合）
        if (monster.hasStartedFleeing && monster.checkEscapeRoute(game)) {
            // 機会攻撃の場合は、イニシアチブ判定や反撃なしで直接攻撃を解決
            this.resolvePlayerAttack(monster, game);
            return;
        }

        // 通常の攻撃処理（イニシアチブ判定あり）
        const basePlayerSpeed = GAME_CONSTANTS.FORMULAS.SPEED(this.stats);
        const effectivePlayerSpeed = (this.nextAttackModifiers.length > 0 && this.nextAttackModifiers[0].speedMod)
            ? Math.floor(basePlayerSpeed * (1 + this.nextAttackModifiers[0].speedMod))
            : basePlayerSpeed;
        const monsterSpeed = GAME_CONSTANTS.FORMULAS.SPEED(monster.stats);
        game.logger.add(`Speed Order: Player (${effectivePlayerSpeed}) vs ${monster.name} (${monsterSpeed})`);

        if (effectivePlayerSpeed >= monsterSpeed) {
            // プレイヤーの攻撃が先行する場合
            this.resolvePlayerAttack(monster, game);
            if (monster.hp > 0) {
                game.logger.add(`${monster.name} attempts a counterattack!`, "monsterInfo");
                monster.attackPlayer(this, game);
                monster.hasActedThisTurn = true;
            }
        } else {
            // モンスターの攻撃が先行する場合（先制反撃）
            game.logger.add(`${monster.name} acts preemptively!`, "monsterInfo");
            monster.attackPlayer(this, game);
            monster.hasActedThisTurn = true;
            if (this.hp > 0 && monster.hp > 0) {
                this.resolvePlayerAttack(monster, game);
            }
        }

        // 攻撃エフェクトの処理
        if (this.attackEffectTimer) {
            clearTimeout(this.attackEffectTimer);
            game.lastAttackLocation = null;
        }
        game.lastAttackLocation = { x: monster.x, y: monster.y };
        game.renderer.render();
        this.attackEffectTimer = setTimeout(() => {
            game.lastAttackLocation = null;
            game.renderer.render();
            this.attackEffectTimer = null;
        }, 200);

        // 攻撃後にlook情報を更新
        game.inputHandler.examineTarget();
    }

    // ===== Utility and Status Methods =====
    getHealthStatus(currentHp, maxHp) {
        const percentage = (currentHp / maxHp) * 100;
        if (percentage > 75) return "Healthy";
        if (percentage > 50) return "Wounded";
        if (percentage > 25) return "Badly Wounded";
        return "Near Death";
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
        if (effectResult === true) {
            // クールダウンの設定
            // フリーアクションの場合は+1しない
            skillData.remainingCooldown = skill.isFreeAction ? skill.cooldown : skill.cooldown + 1;

            // スキルがフリーアクションでない場合はターンを消費
            if (!skill.isFreeAction) {
                game.processTurn();
            }
            game.renderer.renderStatus();
            return true;
        }

        return false;
    }

    processTurn() {
        // HPが0以下の場合は何もしない
        if (this.hp <= 0) {
            return;
        }

        // ターン開始時に前回の位置を更新
        if (!this.lastPosition) {
            this.lastPosition = { x: this.x, y: this.y };
        }
        
        // スキルのクールダウンを処理
        for (const [_, skill] of this.skills) {
            if (skill.remainingCooldown > 0) {
                skill.remainingCooldown--;
            }
        }

        // メディテーション状態の処理
        if (this.meditation && this.meditation.active) {
            if (this.meditation.initialDelay) {
                delete this.meditation.initialDelay;
                this.game.logger.add("Meditation begins... (Healing starts next turn)", "playerInfo");
                return;
            }

            const beforeHeal = this.hp;
            this.hp = Math.min(this.maxHp, this.hp + this.meditation.healPerTurn);
            const actualHeal = this.hp - beforeHeal;

            if (actualHeal > 0) {
                this.meditation.totalHealed += actualHeal;
                this.game.logger.add(`Meditation heals ${actualHeal} HP (+${this.meditation.totalHealed} total)`, "heal");
            }

            this.meditation.turnsRemaining--;

            if (this.hp >= this.maxHp || this.meditation.turnsRemaining <= 0) {
                const endMessage = this.hp >= this.maxHp 
                    ? `HP fully restored! Meditation complete.`
                    : `Meditation complete. (Total healed: ${this.meditation.totalHealed})`;
                
                this.game.logger.add(endMessage, "playerInfo");
                this.meditation = null;
            }
        }

        // 自然回復処理
        if (!this.meditation && this.hp < this.maxHp) {
            const successChance = 20 + Math.floor(this.stats.con / 5);
            const successRoll = Math.floor(Math.random() * 100);
            
            if (successRoll > successChance) {
                return;
            }

            let healAmount = 0;
            for (let i = 0; i < this.healingDice.count; i++) {
                healAmount += Math.floor(Math.random() * this.healingDice.sides) + 1;
            }
            healAmount = Math.max(0, healAmount + this.healModifier);

            if (healAmount > 0) {
                const oldHp = this.hp;
                this.hp = Math.min(this.maxHp, this.hp + healAmount);
                const actualHeal = this.hp - oldHp;
                this.game.logger.add(
                    `Natural healing: ${this.healingDice.count}d${this.healingDice.sides}` +
                    `${this.healModifier >= 0 ? '+' : ''}${this.healModifier} → +${actualHeal} HP`, 
                    "heal"
                );
            }
        }
    }

    updateDerivedStats() {
        // Calculate perception
        this.perception = GAME_CONSTANTS.FORMULAS.PERCEPTION(this.stats);
        
        // 必要に応じた派生ステータスの更新処理
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
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const checkX = this.x + dx;
                const checkY = this.y + dy;
                if (game.getMonsterAt(checkX, checkY)) {
                    count++;
                }
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
            {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
            {dx: -1, dy: 0},                    {dx: 1, dy: 0},
            {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
        ];

        // 訪問済みの座標を記録するSet
        const visited = new Set();
        // 探索キュー（座標と、その地点までの最初の移動方向を保持）
        const queue = [{
            x: this.x,
            y: this.y,
            firstStep: null
        }];

        while (queue.length > 0) {
            const current = queue.shift();
            const key = `${current.x},${current.y}`;

            if (visited.has(key)) continue;
            visited.add(key);

            // 未探索タイルの判定を厳密に行う
            if (this.game.isValidPosition(current.x, current.y) && 
                !this.game.explored[current.y][current.x] && 
                this.game.map[current.y][current.x] === 'floor') {
                return current.firstStep;
            }

            // 隣接マスの探索
            for (const dir of directions) {
                const newX = current.x + dir.dx;
                const newY = current.y + dir.dy;
                
                // マップ範囲内かつ床タイルのみを対象とする
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

        return null;  // 到達可能な未探索タイルが見つからない
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
} 