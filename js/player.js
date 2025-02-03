class Player {
    constructor(x = 0, y = 0, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.char = '@';
        this.level = 1;
        this.codexPoints = 20;  // codexポイントのみを使用
        this.xp = 0;                  // 経験値の初期化
        this.xpToNextLevel = this.calculateRequiredXP(1);  // レベル1から2への必要経験値
        this.stats = {
            str: 10,
            dex: 10,
            con: 10,
            int: 10,
            wis: 10
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
        this.nextAttackModifier = null;  // 次の攻撃の修正値
        this.meditation = null;  // メディテーション状態を追加

        // 治療関連のパラメータを定数ファイルから取得
        this.healingDice = GAME_CONSTANTS.FORMULAS.HEALING_DICE(this.stats);
        this.healModifier = GAME_CONSTANTS.FORMULAS.HEAL_MODIFIER(this.stats);

        // 各種パラメータの計算
        this.updateDerivedStats();

        this.lastPosition = null;  // 前回の位置を記録するプロパティを追加
    }

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

    move(dx, dy, map) {
        // 移動時にメディテーションを解除
        if (this.meditation && this.meditation.active) {
            this.game.logger.add(`Meditation cancelled. (Total healed: ${this.meditation.totalHealed})`, "playerInfo");
            this.meditation = null;
        }

        const newX = this.x + dx;
        const newY = this.y + dy;
        
        if (this.canMoveTo(newX, newY, map)) {
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

    takeDamage(amount) {
        const damage = Math.max(1, amount);
        this.hp -= damage;
        
        // ダメージを受けた時にステータスパネルをフラッシュ
        this.game.renderer.flashStatusPanel();
        
        if (this.hp <= 0) {
            this.hp = 0;
            // レンダリングを先に行い、HPが0の状態を表示
            this.game.renderer.render();
            // その後でゲームオーバー処理
            this.game.gameOver();
        }

        return {
            damage: damage,
            killed: this.hp <= 0,
            evaded: false
        };
    }

    // プレイヤーの攻撃処理をまとめるためのヘルパーメソッド
    resolvePlayerAttack(monster, game) {
        const attackType = this.nextAttackModifier ? this.nextAttackModifier.name : "attack";
        let hitChance = this.accuracy;
        if (this.nextAttackModifier && this.nextAttackModifier.accuracyMod) {
            hitChance *= (1 + this.nextAttackModifier.accuracyMod);
        }
        const roll = Math.floor(Math.random() * 100);
        game.logger.add(`You ${attackType} ${monster.name} (ACC: ${Math.floor(hitChance)}% | Roll: ${roll})`, "playerInfo");
        if (roll >= hitChance) {
            game.logger.add(`Your ${attackType} misses!`, "playerMiss");
            return;
        }

        // 回避判定
        const evadeRoll = Math.random() * 100;
        const evadeChance = monster.evasion || 0;
        if (evadeRoll < evadeChance) {
            game.logger.add(`${monster.name} dodges your ${attackType}! (EVA: ${Math.floor(evadeChance)}% | Roll: ${Math.floor(evadeRoll)})`, "monsterEvade");
            return;
        }

        let damageMultiplier = 1;
        if (this.nextAttackModifier && this.nextAttackModifier.damageMod) {
            damageMultiplier = this.nextAttackModifier.damageMod;
        }

        const baseDamage = GAME_CONSTANTS.FORMULAS.rollDamage(this.attackPower, monster.defense);
        const damage = Math.floor(baseDamage * damageMultiplier);
        const result = monster.takeDamage(damage);
        const healthStatus = `HP: ${monster.hp}/${monster.maxHp}`;
        const attackRollStr = this.attackPower.base + `+${this.attackPower.diceCount}d${this.attackPower.diceSides}` +
            (damageMultiplier !== 1 ? ` ×${damageMultiplier.toFixed(1)}` : '');
        const defenseRollStr = monster.defense.base + `+${monster.defense.diceCount}d${monster.defense.diceSides}`;

        if (result.killed) {
            game.logger.add(`Critical ${attackType}! ${monster.name} takes ${result.damage} damage!`, "playerCrit");
            game.logger.add(`You killed the ${monster.name}!`, "kill");
            game.removeMonster(monster);

            // 経験値計算
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
        } else {
            game.logger.add(`${attackType} hits! ${monster.name} takes ${result.damage} damage! (ATK: ${attackRollStr} vs DEF: ${defenseRollStr})  (${healthStatus})`, "playerHit");
        }
        this.nextAttackModifier = null;
    }

    // プレイヤーの攻撃にSPEEDによる処理順序を組み込む
    attackMonster(monster, game) {
        // 基本のSPDを定数から計算
        const basePlayerSpeed = GAME_CONSTANTS.FORMULAS.SPEED(this.stats);
        // 次の攻撃修正値に speedMod がある場合、それを反映した有効速度を計算する
        const effectivePlayerSpeed = (this.nextAttackModifier && this.nextAttackModifier.speedMod)
            ? Math.floor(basePlayerSpeed * (1 + this.nextAttackModifier.speedMod))
            : basePlayerSpeed;
        const monsterSpeed = GAME_CONSTANTS.FORMULAS.SPEED(monster.stats);
        game.logger.add(`Speed Order: Player (${effectivePlayerSpeed}) vs ${monster.name} (${monsterSpeed})`);

        if (effectivePlayerSpeed >= monsterSpeed) {
            // プレイヤーの攻撃が先行する場合
            this.resolvePlayerAttack(monster, game);
            if (monster.hp > 0) {
                game.logger.add(`${monster.name} attempts a counterattack!`, "monsterInfo");
                monster.attackPlayer(this, game);
                // このターン内での通常行動をスキップするためフラグをセット
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

        // 攻撃エフェクトの処理（少しのタイマー後に画面更新）
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
    }

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
            
            return true;
        }

        return false;
    }

    processTurn() {
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
        // 必要に応じた派生ステータスの更新処理
    }

    getCodexPoints() {
        return this.codexPoints;
    }

    // 変更: 経験値情報を含むように getStatus を更新
    getStatus() {
        return {
            name: "Player",
            level: this.level,
            xp: `${this.xp}/${this.xpToNextLevel}`,
            hp: `${this.hp}/${this.maxHp}`,
            stats: this.stats,
            derived: {
                attack: `${this.attackPower.base}+${this.attackPower.diceCount}d${this.attackPower.diceSides}`,
                defense: `${this.defense.base}+${this.defense.diceCount}d${this.defense.diceSides}`,
                accuracy: this.accuracy,
                evasion: this.evasion
            }
        };
    }

    descendStairs() {
        if (this.game.tiles[this.y][this.x] === GAME_CONSTANTS.STAIRS.CHAR) {
            this.game.floorLevel++;
            this.game.logger.add(`You descend to floor ${this.game.floorLevel}...`, "important");
            this.game.generateNewFloor();
            return true;
        }
        return false;
    }
} 