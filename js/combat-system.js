class CombatSystem {
    // ... 既存のコード ...

    static resolveCombatAction(attacker, defender, game, context = {}) {
        // 攻撃修飾子のチェック（プレイヤーの場合）
        if (context.isPlayer && (!attacker.nextAttackModifiers || attacker.nextAttackModifiers.length === 0)) {
            // 通常攻撃として処理
            context.attackType = "attack";
        }

        // 攻撃コンテキストの準備
        const attackContext = this.prepareAttackContext(attacker, defender, game, context);
        
        // 命中判定
        if (!this.resolveHitCheck(attacker, defender, attackContext, game)) {
            return { hit: false };
        }
        
        // 回避判定（クリティカルまたは機会攻撃の場合はスキップ）
        if (!attackContext.isCritical && !context.isOpportunityAttack) {
            if (!this.resolveEvadeCheck(attacker, defender, attackContext, game)) {
                return { hit: false, evaded: true };
            }
        }
        
        // ダメージ計算
        const damageResult = this.calculateDamage(attacker, defender, attackContext);
        
        // ダメージ適用（HPが0未満にならないように制限）
        const finalDamage = Math.min(defender.hp, damageResult.damage);
        const result = defender.takeDamage(finalDamage, { 
            isCritical: attackContext.isCritical,
            ...context 
        });
        
        // 結果の処理
        this.processCombatResult(attacker, defender, result, damageResult, attackContext, game);
        
        // 戦闘後の処理
        if (context.isPlayer) {
            // 攻撃修飾子をクリア（ターン処理と整合性を取る）
            attacker.nextAttackModifiers = [];
        }

        return {
            hit: true,
            evaded: false,
            ...result,
            damageResult,
            context: attackContext
        };
    }

    static prepareAttackContext(attacker, defender, game, context = {}) {
        const baseContext = {
            isPlayer: attacker instanceof Player,
            attackType: "attack",
            hitChance: attacker.accuracy,
            damageMultiplier: 1,
            effectDesc: "",
            ...context
        };

        // プレイヤーの場合の特別な処理
        if (baseContext.isPlayer) {
            return this.preparePlayerAttackContext(attacker, defender, game, baseContext);
        }

        // モンスターの場合の処理
        return this.prepareMonsterAttackContext(attacker, defender, game, baseContext);
    }

    static calculateDamage(attacker, defender, context) {
        const attack = attacker.attackPower;
        const defense = defender.defense;
        
        // 攻撃ロールの実行
        const attackRolls = Array(attack.diceCount).fill(0)
            .map(() => Math.floor(Math.random() * attack.diceSides) + 1);
        
        // 基本攻撃力とロール値の合計を計算
        const totalAttack = attack.base + attackRolls.reduce((sum, roll) => sum + roll, 0);
        const modifiedAttack = Math.floor(totalAttack * context.damageMultiplier);
        
        // クリティカルヒットの場合、防御力を無視
        let defenseRolls = [];
        let totalDefense = 0;
        
        if (!context.isCritical) {
            defenseRolls = Array(defense.diceCount).fill(0)
                .map(() => Math.floor(Math.random() * defense.diceSides) + 1);
            totalDefense = defense.base + defenseRolls.reduce((sum, roll) => sum + roll, 0);
        }
        
        return {
            damage: Math.max(1, modifiedAttack - totalDefense),
            attackRolls,
            defenseRolls,
            totalAttack: modifiedAttack,
            totalDefense
        };
    }

    static resolveHitCheck(attacker, defender, context, game) {
        const roll = Math.floor(Math.random() * 100) + 1;  // 1-100
        const criticalRange = GAME_CONSTANTS.FORMULAS.CRITICAL_RANGE(attacker.stats);
        const isCritical = roll <= criticalRange;
        
        const logPrefix = context.isPlayer ? "You" : attacker.name;
        const logTarget = context.isPlayer ? defender.name : "you";
        
        game.logger.add(
            `${logPrefix} ${context.attackType}${context.effectDesc} ${logTarget} ` +
            `(ACC: ${Math.floor(context.hitChance)}% | Roll: ${roll}${isCritical ? ' [CRITICAL HIT!]' : ''})`,
            isCritical ? (context.isPlayer ? "playerCrit" : "monsterCrit") : (context.isPlayer ? "playerInfo" : "monsterInfo")
        );

        if (isCritical) {
            context.isCritical = true;
            game.renderer.showCritEffect(defender.x, defender.y, !context.isPlayer);
            return true;
        }
        
        if (roll >= context.hitChance) {
            game.logger.add(
                `${context.attackType} misses!`,
                context.isPlayer ? "playerMiss" : "monsterMiss"
            );
            game.renderer.showMissEffect(defender.x, defender.y, 'miss');
            return false;
        }

        context.isCritical = false;
        return true;
    }

    static resolveEvadeCheck(attacker, defender, context, game) {
        const evadeRoll = Math.floor(Math.random() * 100) + 1;
        const evadeChance = defender.evasion;
        
        if (evadeRoll < evadeChance) {
            const logMessage = context.isPlayer
                ? `${defender.name} dodges your ${context.attackType}!`
                : `You dodge ${attacker.name}'s ${context.attackType}!`;
            
            game.logger.add(
                `${logMessage} (EVA: ${Math.floor(evadeChance)}% | Roll: ${evadeRoll})`,
                context.isPlayer ? "monsterEvade" : "playerEvade"
            );
            game.renderer.showMissEffect(defender.x, defender.y, 'evade');
            return false;
        }
        return true;
    }

    static processCombatResult(attacker, defender, result, damageResult, context, game) {
        if (!result.evaded) {
            // killed フラグが true の場合に死亡処理キューに追加
            if (result.killed) {
                game.pendingMonsterDeaths.push({
                    monster: defender,
                    result,
                    damageResult,
                    context
                });
                return; // 死亡時は通常のダメージログをスキップ
            }

            // 通常のダメージログ処理（死亡していない場合）
            const healthStatus = context.isPlayer 
                ? `HP: ${defender.hp}/${defender.maxHp}`
                : `HP: ${defender.hp}/${defender.maxHp}`;
            
            const logPrefix = context.isPlayer ? "" : `${attacker.name} `;
            const logTarget = context.isPlayer ? defender.name : "you";
            const damageText = `${logPrefix}hits ${logTarget} for ${result.damage} damage!`;
            
            const attackCalc = `ATK: ${attacker.attackPower.base}+[${damageResult.attackRolls.join(',')}]` +
                (context.damageMultiplier !== 1 ? ` ×${context.damageMultiplier.toFixed(1)}` : '');
            
            const defenseCalc = context.isCritical 
                ? '[DEF IGNORED]' 
                : `vs DEF: ${defender.defense.base}+[${damageResult.defenseRolls.join(',')}]`;
            
            game.logger.add(
                `${damageText} (${attackCalc} ${defenseCalc}) (${healthStatus})`,
                context.isCritical 
                    ? (context.isPlayer ? "playerCrit" : "monsterCrit")
                    : (context.isPlayer ? "playerHit" : "monsterHit")
            );
        }
    }

    static preparePlayerAttackContext(attacker, defender, game, baseContext) {
        const surroundingMonsters = attacker.countSurroundingMonsters(game);
        const surroundingPenalty = attacker.calculateSurroundingPenalty(surroundingMonsters);
        
        let totalAccuracyMod = 0;
        let totalDamageMod = 1;
        let effectDesc = [];
        
        if (attacker.nextAttackModifiers?.length > 0) {
            const mods = this.processAttackModifiers(attacker.nextAttackModifiers);
            totalAccuracyMod = mods.accuracyMod;
            totalDamageMod = mods.damageMod;
            effectDesc = mods.effectDesc;
        }
        
        const finalAccuracy = Math.floor(baseContext.hitChance * (1 + totalAccuracyMod) * (1 - surroundingPenalty));
        
        if (surroundingPenalty > 0) {
            game.logger.add(`Surrounded! (-${Math.floor(surroundingPenalty * 100)}% evasion)`, "warning");
        }

        return {
            ...baseContext,
            hitChance: finalAccuracy,
            damageMultiplier: totalDamageMod,
            effectDesc: effectDesc.length ? ` [${effectDesc.join(', ')}]` : "",
            surroundingPenalty
        };
    }

    static prepareMonsterAttackContext(attacker, defender, game, baseContext) {
        return {
            ...baseContext,
            hitChance: attacker.accuracy,
            damageMultiplier: 1,
            effectDesc: ""
        };
    }

    static processAttackModifiers(modifiers) {
        let totalAccuracyMod = 0;
        let totalDamageMod = 1;
        let effectDesc = [];

        if (modifiers.length > 1) {
            // Combined Attack の処理
            for (const mod of modifiers) {
                if (mod.accuracyMod) totalAccuracyMod += mod.accuracyMod;
                if (mod.damageMod) totalDamageMod *= mod.damageMod;
            }
            effectDesc = [
                `DMG: ${((totalDamageMod - 1) * 100).toFixed(0)}%`,
                `ACC: ${(totalAccuracyMod * 100).toFixed(0)}%`
            ];
        } else {
            // 単一スキルの処理
            const mod = modifiers[0];
            if (mod.accuracyMod) {
                totalAccuracyMod = mod.accuracyMod;
                effectDesc.push(`ACC: ${(mod.accuracyMod * 100).toFixed(0)}%`);
            }
            if (mod.damageMod) {
                totalDamageMod = mod.damageMod;
                effectDesc.push(`DMG: ${((mod.damageMod - 1) * 100).toFixed(0)}%`);
            }
        }

        return { accuracyMod: totalAccuracyMod, damageMod: totalDamageMod, effectDesc };
    }
} 