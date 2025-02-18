class Player {
    // ===== Constructor and Initialization =====
    constructor(x = 0, y = 0, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.char = '@';
        this.level = 1;
        this.codexPoints = 0;  // codexポイントのみを使用
        this.xp = 0;                  // 経験値の初期化
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
                
                // ステータス名の取得を定数から行う
                const statNames = GAME_CONSTANTS.STATS.NAMES;
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

        // evasionを元の値に戻す
        this.evasion = baseEvasion;

        return result;
    }

    // ===== Combat Resolution Methods =====
    // プレイヤーの攻撃処理をまとめるためのヘルパーメソッド
    resolvePlayerAttack(monster, game) {
        game.lastCombatMonster = monster;
        
        const attackContext = this.prepareAttackContext(monster, game);
        
        // 命中判定
        if (!this.resolveHitCheck(attackContext, game)) {
            return;
        }
        
        // 回避判定
        if (!this.resolveEvadeCheck(attackContext, game)) {
            return;
        }
        
        // ダメージ計算
        const damageResult = this.calculateDamage(attackContext, monster);
        
        // モンスターにダメージを与える
        const result = monster.takeDamage(damageResult.damage, game);
        
        // 命中した場合の処理
        if (!result.evaded) {
            this.processHit(result, damageResult, attackContext, monster, game);
            game.lastAttackHit = true;
        }
        
        // 戦闘後の処理
        this.finalizeCombat(monster, game);
    }

    prepareAttackContext(monster, game) {
        const surroundingMonsters = this.countSurroundingMonsters(game);
        const surroundingPenalty = this.calculateSurroundingPenalty(surroundingMonsters);
        
        // 基本命中率を取得
        let baseAccuracy = this.accuracy;
        let totalAccuracyMod = 0;
        let totalDamageMod = 1;
        let totalSpeedMod = 0;
        let effectDesc = [];
        
        // スキル効果の集計
        if (this.nextAttackModifiers?.length > 0) {
            // Combined Attackの場合は修正値をまとめる
            if (this.nextAttackModifiers.length > 1) {
                for (const mod of this.nextAttackModifiers) {
                    if (mod.accuracyMod) totalAccuracyMod += mod.accuracyMod;
                    if (mod.damageMod) totalDamageMod *= mod.damageMod;
                    if (mod.speedMod) totalSpeedMod += mod.speedMod;
                    if (mod.speedTier) effectDesc.push(`SPD: ${mod.speedTier}`);
                }
                // まとめた修正値を一つの文字列にする
                effectDesc = [
                    `DMG: ${((totalDamageMod - 1) * 100).toFixed(0)}%`,
                    `ACC: ${(totalAccuracyMod * 100).toFixed(0)}%`,
                    totalSpeedMod !== 0 ? `SPD: ${(totalSpeedMod * 100).toFixed(0)}%` : null
                ].filter(Boolean);
            } else {
                // 単一スキルの場合
                for (const mod of this.nextAttackModifiers) {
                    if (mod.accuracyMod) {
                        totalAccuracyMod += mod.accuracyMod;
                        effectDesc.push(`ACC: ${(mod.accuracyMod * 100).toFixed(0)}%`);
                    }
                    if (mod.damageMod) {
                        totalDamageMod *= mod.damageMod;
                        effectDesc.push(`DMG: ${((mod.damageMod - 1) * 100).toFixed(0)}%`);
                    }
                    if (mod.speedTier) {
                        effectDesc.push(`SPD: ${GAME_CONSTANTS.FORMULAS.SPEED(this.stats)} → ${mod.speedTier}`);
                    } else if (mod.speedMod) {
                        totalSpeedMod += mod.speedMod;
                        effectDesc.push(`SPD: ${(mod.speedMod * 100).toFixed(0)}%`);
                    }
                }
            }
        }
        
        // 周囲ペナルティの適用
        let finalAccuracy = Math.floor(baseAccuracy * (1 + totalAccuracyMod) * (1 - surroundingPenalty));
        
        const attackType = this.nextAttackModifiers?.length > 0
            ? (this.nextAttackModifiers.length > 1 ? "Combined Attack" : this.nextAttackModifiers[0].name)
            : "attack";

        // 機会攻撃の処理
        const isOpportunityAttack = monster.hasStartedFleeing && monster.checkEscapeRoute(game);
        if (isOpportunityAttack) {
            finalAccuracy *= 0.7;  // 30% 命中ペナルティ
            totalDamageMod *= 1.5; // 50% ダメージボーナス
        }

        return {
            attackType,
            effectDesc: effectDesc.length ? ` [${effectDesc.join(', ')}]` : "",
            hitChance: finalAccuracy,
            damageMultiplier: totalDamageMod,
            speedModifier: totalSpeedMod,
            isOpportunityAttack,
            surroundingPenalty
        };
    }

    resolveHitCheck(context, game) {
        const roll = Math.floor(Math.random() * 100);
        game.logger.add(
            `You ${context.attackType}${context.effectDesc} ${game.lastCombatMonster.name} ` +
            `(ACC: ${Math.floor(context.hitChance)}% | Roll: ${roll})`,
            "playerInfo"
        );
        
        if (roll >= context.hitChance) {
            game.logger.add(`Your ${context.attackType} misses!`, "playerMiss");
            game.renderer.showMissEffect(game.lastCombatMonster.x, game.lastCombatMonster.y, 'miss');
            game.lastAttackHit = false;
            this.nextAttackModifiers = [];
            return false;
        }
        return true;
    }

    resolveEvadeCheck(context, game) {
        const monster = game.lastCombatMonster;
        if (monster.hasStartedFleeing) return true;
        
        const evadeRoll = Math.random() * 100;
        const evadeChance = monster.evasion || 0;
        
        if (evadeRoll < evadeChance) {
            game.logger.add(
                `${monster.name} dodges your ${context.attackType}! ` +
                `(EVA: ${Math.floor(evadeChance)}% | Roll: ${Math.floor(evadeRoll)})`,
                "monsterEvade"
            );
            game.renderer.showMissEffect(monster.x, monster.y, 'evade');
            game.lastAttackHit = false;
            this.nextAttackModifiers = [];
            return false;
        }
        return true;
    }

    calculateDamage(context, monster) {
        const attack = this.attackPower;
        const defense = monster.defense;
        
        // 攻撃ロールの実行
        let attackRolls = [];
        for (let i = 0; i < attack.diceCount; i++) {
            attackRolls.push(Math.floor(Math.random() * attack.diceSides) + 1);
        }
        
        // 防御ロールの実行
        let defenseRolls = [];
        for (let i = 0; i < defense.diceCount; i++) {
            defenseRolls.push(Math.floor(Math.random() * defense.diceSides) + 1);
        }
        
        // 基本攻撃力とロール値の合計を計算
        const totalAttack = attack.base + attackRolls.reduce((sum, roll) => sum + roll, 0);
        
        // 合計値にダメージ修正を適用
        const modifiedAttack = Math.floor(totalAttack * context.damageMultiplier);
        
        // 防御力の合計を計算
        const totalDefense = defense.base + defenseRolls.reduce((sum, roll) => sum + roll, 0);
        
        // 最終ダメージを計算（最小1）
        const finalDamage = Math.max(1, modifiedAttack - totalDefense);
        
        return {
            damage: finalDamage,
            attackRolls: attackRolls,
            defenseRolls: defenseRolls,
            totalAttack: modifiedAttack,
            totalDefense: totalDefense
        };
    }

    processHit(result, damageResult, context, monster, game) {
        // モンスターを倒した場合は、processKillのみを呼び出す
        if (result.killed) {
            this.processKill(result, damageResult, context, monster, game);
            return;
        }

        // 倒していない場合のみ、通常の命中ログを表示
        const healthStatus = `HP: ${monster.hp}/${monster.maxHp}`;
        
        if (context.isOpportunityAttack) {
            game.logger.add(
                `Opportunity attack hits! ${monster.name} takes ${result.damage} damage! ` +
                `(ATK: ${this.attackPower.base}+[${damageResult.attackRolls.join(',')}] ` +
                `×${context.damageMultiplier.toFixed(1)} ` +
                `vs DEF: ${monster.defense.base}+[${damageResult.defenseRolls.join(',')}]) (${healthStatus})`,
                "playerCrit"
            );
        } else {
            game.logger.add(
                `${context.attackType} hits! ${monster.name} takes ${result.damage} damage! ` +
                `(ATK: ${this.attackPower.base}+[${damageResult.attackRolls.join(',')}] ` +
                `${context.damageMultiplier !== 1 ? `×${context.damageMultiplier.toFixed(1)} ` : ''}` +
                `vs DEF: ${monster.defense.base}+[${damageResult.defenseRolls.join(',')}]) (${healthStatus})`,
                "playerHit"
            );
        }

        // 攻撃修正をクリア
        this.nextAttackModifiers = [];
    }

    finalizeCombat(monster, game) {
        game.renderer.examineTarget(monster.x, monster.y);
    }

    calculateSurroundingPenalty(surroundingMonsters) {
        const penaltyPerMonster = 15; // 1体につき15%のペナルティ
        // 2体以上からペナルティ適用（surroundingMonsters - 1）
        return Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;
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
        let effectivePlayerSpeed = basePlayerSpeed;

        // 修飾効果がある場合
        if (this.nextAttackModifiers && this.nextAttackModifiers.length > 0) {
            // speedTierが設定されている場合はそれを使用
            const speedTierMod = this.nextAttackModifiers.find(mod => mod.speedTier);
            if (speedTierMod) {
                effectivePlayerSpeed = speedTierMod.speedTier;
            } else if (this.nextAttackModifiers[0].speedMod) {
                // 従来のspeedMod処理
                effectivePlayerSpeed = Math.floor(basePlayerSpeed * (1 + this.nextAttackModifiers[0].speedMod));
            }
        }

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
        game.renderer.examineTarget(monster.x, monster.y);
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

    processTurn() {
        // HPが0以下の場合は何もしない
        if (this.hp <= 0) {
            return;
        }

        // ターン開始時に前回の位置を更新
        if (!this.lastPosition) {
            this.lastPosition = { x: this.x, y: this.y };
        }
        
        // next attack modifierをクリア
        if (this.nextAttackModifiers && this.nextAttackModifiers.length > 0) {
            this.nextAttackModifiers = [];
            this.game.logger.add("Attack modifiers expired.", "playerInfo");
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
            const successChance = GAME_CONSTANTS.FORMULAS.NATURAL_HEALING.getSuccessChance(this.stats);
            const successRoll = Math.floor(Math.random() * 100);
            
            if (successRoll <= successChance) {
                const healResult = GAME_CONSTANTS.FORMULAS.NATURAL_HEALING.calculateHeal(
                    this.healingDice,
                    this.healModifier
                );

                if (healResult.amount > 0) {
                    const actualHeal = GAME_CONSTANTS.FORMULAS.NATURAL_HEALING.applyHeal(this, healResult.amount);
                    
                    if (actualHeal > 0) {
                        this.game.logger.add(
                            `Natural healing: [${healResult.rolls.join(',')}]` +
                            `${this.healModifier >= 0 ? '+' : ''}${this.healModifier} → +${actualHeal} HP`, 
                            "heal"
                        );
                    }
                }
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
        return this.game.monsters.filter(monster => {
            const distance = GAME_CONSTANTS.DISTANCE.calculate(
                monster.x, monster.y,
                this.x, this.y
            );
            return distance <= 1.5;
        }).length;
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

    processKill(result, damageResult, context, monster, game) {
        // 機会攻撃とキルのログを1行にまとめる
        const attackDesc = context.isOpportunityAttack ? "Opportunity attack" : context.attackType;
        const damageCalc = `(ATK: ${this.attackPower.base}+[${damageResult.attackRolls.join(',')}]` +
            `${context.damageMultiplier !== 1 ? ` ×${context.damageMultiplier.toFixed(1)}` : ''} ` +
            `vs DEF: ${monster.defense.base}+[${damageResult.defenseRolls.join(',')}])`;
        
        game.logger.add(
            `${attackDesc} kills ${monster.name} with ${result.damage} damage! ${damageCalc}`,
            "kill"
        );
        
        // モンスターを削除し、死亡エフェクトを表示
        game.removeMonster(monster);
        game.renderer.showDeathEffect(monster.x, monster.y);

        // 経験値の計算と付与
        const levelDiff = monster.level - this.level;
        const baseXP = Math.floor(monster.baseXP || monster.level);
        const levelMultiplier = levelDiff > 0 
            ? 1 + (levelDiff * 0.2)
            : Math.max(0.1, 1 + (levelDiff * 0.1));
        const intBonus = 1 + Math.max(0, (this.stats.int - 10) * 0.03);
        const xpGained = Math.max(1, Math.floor(baseXP * levelMultiplier * intBonus));

        // 経験値とCodexポイントの獲得ログをまとめる
        let rewardText = `Gained ${xpGained} XP!`;
        if (monster.codexPoints) {
            rewardText += ` and ${monster.codexPoints} codex points!`;
        }
        game.logger.add(rewardText, "playerInfo");

        // 知力ボーナスがある場合は別行で表示
        if (intBonus > 1) {
            game.logger.add(`Intelligence bonus: +${Math.floor((intBonus - 1) * 100)}% XP!`, "playerInfo");
        }

        this.addExperience(xpGained);
        if (monster.codexPoints) {
            this.codexPoints += monster.codexPoints;
        }
    }
} 