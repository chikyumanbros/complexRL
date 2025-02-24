class CombatSystem {
    // ... 既存のコード ...

    static resolveCombatAction(attacker, defender, game, context = {}) {
        if (!game) {
            console.error('Game object is undefined in resolveCombatAction');
            return { hit: false };
        }
        // 機会攻撃の場合の特別処理
        if (context.isOpportunityAttack) {
            // 機会攻撃用の修正を適用
            context.accuracyMod = 0.2;  // 20% 命中ボーナス
            context.damageMod = 1.5;    // 50% ダメージボーナス
            context.attackType = "Opportunity attack";
            game.logger.add("Opportunity Attack!", "playerInfo");
        }

        // 攻撃修飾子のチェック（プレイヤーの場合）
        if (context.isPlayer && attacker.nextAttackModifiers && attacker.nextAttackModifiers.length > 0) {
            const mods = attacker.nextAttackModifiers;
            
            // 速度修正の適用
            const speedMod = mods.find(mod => mod.speedTier);
            if (speedMod) {
                context.speedTier = speedMod.speedTier;
            }
            
            // 攻撃タイプの設定
            context.attackType = mods.map(mod => mod.name).join(' + ');
            
            // 攻撃修飾子の効果をログに表示
            if (mods.length > 1) {
                game.logger.add("Combined Attack!", "playerInfo");
            }
            
            // 修飾子の効果を適用（乗算的なダメージ修正、加算的な命中修正）
            context.accuracyMod = mods.reduce((total, mod) => total + (mod.accuracyMod || 0), 0);
            context.damageMod = mods.reduce((total, mod) => total * (mod.damageMod || 1), 1);
            
            // 効果の説明をログに表示
            const effects = [];
            if (context.damageMod !== 1) effects.push(`DMG: ${((context.damageMod - 1) * 100).toFixed(0)}%`);
            if (context.accuracyMod) effects.push(`ACC: ${(context.accuracyMod * 100).toFixed(0)}%`);
            if (context.speedTier) effects.push(`Speed Tier: ${context.speedTier}`);
            
            if (effects.length > 0) {
                game.logger.add(`Attack modifiers: [${effects.join(', ')}]`, "playerInfo");
            }

            // 攻撃修飾子をクリア（ログ出力なし）
            attacker.nextAttackModifiers = [];
        } else {
            // 通常攻撃として処理
            context.attackType = "attack";
        }

        // 攻撃コンテキストの準備
        const attackContext = this.prepareAttackContext(attacker, defender, game, context);
        
        // スピード情報の更新（Quick Slashなどの効果を反映）
        if (context.speedTier) {
            const speedNames = ["Very Slow", "Slow", "Normal", "Fast", "Very Fast"];
            attackContext.speedName = speedNames[Math.min(4, context.speedTier - 1)];
        }

        // 命中判定（修正された命中率を使用）
        if (!this.resolveHitCheck(attacker, defender, attackContext, game)) {
            // 命中失敗時は hit: false で結果を返す
            game.lastAttackResult = {
                hit: false,
                evaded: false,
                damage: 0,
                context: attackContext
            };
            return { hit: false };
        }

        // 回避判定（クリティカルまたは機会攻撃の場合はスキップ）
        if (!attackContext.isCritical && !context.isOpportunityAttack) {
            if (!this.resolveEvadeCheck(attacker, defender, attackContext, game)) {
                // 回避成功時は evaded: true で結果を返す
                game.lastAttackResult = {
                    hit: true,
                    evaded: true,
                    damage: 0,
                    context: attackContext
                };
                return { hit: true, evaded: true };
            }
        }
        
        // ダメージ計算
        const damageResult = this.calculateDamage(attacker, defender, attackContext);
        
        // ダメージ適用
        const finalDamage = Math.min(defender.hp, damageResult.damage);
        const result = defender.takeDamage(finalDamage, game);
        
        // 結果の処理
        this.processCombatResult(attacker, defender, result, damageResult, attackContext, game);
        
        // 戦闘後の処理
        if (context.isPlayer) {
            // 攻撃修飾子を静かにクリア
            if (attacker.nextAttackModifiers?.length > 0) {
                attacker.nextAttackModifiers = [];
            }
        }

        // 攻撃結果を保存
        game.lastAttackResult = {
            hit: true,
            evaded: false,
            damage: finalDamage,
            ...result,
            damageResult,
            context: attackContext
        };

        return game.lastAttackResult;
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
        const roll = Math.floor(Math.random() * 100) + 1;
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
            game.playSound('critSound');
            game.playSound('damageSound');
            return true;
        }

        if (roll >= context.hitChance) {
            game.logger.add(
                `${context.attackType} misses!`,
                context.isPlayer ? "playerMiss" : "monsterMiss"
            );
            game.renderer.showMissEffect(defender.x, defender.y, 'miss');

            // ミス効果音を再生（プレイヤー、モンスター両方）
            game.playSound('missSound');

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

            // 回避成功時に効果音を再生（プレイヤー、モンスター両方）
            game.playSound('missSound');

            return false;
        }
        return true;
    }

    static processCombatResult(attacker, defender, result, damageResult, context, game) {
        // プレイヤーが死亡している場合は処理を中断
        if (!context.isPlayer && defender.hp <= 0) {
            return;
        }

        if (!result.evaded) {
            // killed フラグが true の場合は即座に死亡処理を実行
            if (result.killed) {
                game.processMonsterDeath({
                    monster: defender,
                    result,
                    damageResult,
                    context
                });
                return;
            }

            // 通常のダメージログ処理（死亡していない場合）
            const healthStatus = context.isPlayer 
                ? `HP: ${defender.hp}/${defender.maxHp}`
                : `HP: ${defender.hp}/${defender.maxHp}`;
            
            const logPrefix = context.isPlayer ? "" : `${attacker.name} `;
            const logTarget = context.isPlayer ? defender.name : "you";
            
            // 攻撃修飾子の効果を表示に含める
            const modifierText = context.effectDesc || "";
            const damageText = `${logPrefix}hits ${logTarget}${modifierText} for ${result.damage} damage!`;
            
            // 攻撃計算の詳細を表示
            const attackCalc = `ATK: ${attacker.attackPower.base}+[${damageResult.attackRolls.join(',')}]` +
                (context.damageMultiplier !== 1 ? ` ×${context.damageMultiplier.toFixed(1)}` : '');
            
            const defenseCalc = context.isCritical 
                ? '[DEF IGNORED]' 
                : `vs DEF: ${defender.defense.base}+[${damageResult.defenseRolls.join(',')}]`;
            
            // Combined Attackの場合は特別なメッセージを追加
            if (context.isCombinedAttack) {
                game.logger.add("Combined Attack!", "playerInfo");
            }
            
            game.logger.add(
                `${damageText} (${attackCalc} ${defenseCalc}) (${healthStatus})`,
                context.isCritical 
                    ? (context.isPlayer ? "playerCrit" : "monsterCrit")
                    : (context.isPlayer ? "playerHit" : "monsterHit")
            );

            // プレイヤーがダメージを与えた場合に効果音を再生
            if (context.isPlayer) {
                game.playSound('damageSound');
            }
        }
    }

    static preparePlayerAttackContext(attacker, defender, game, baseContext) {
        // プレイヤーが死亡している場合は処理を中断
        if (attacker.hp <= 0) {
            return baseContext;
        }

        const surroundingMonsters = attacker.countSurroundingMonsters(game);
        const surroundingPenalty = attacker.calculateSurroundingPenalty(surroundingMonsters);
        
        // 基本命中率に修飾子の効果を適用（パーセンテージで計算）
        const modifiedAccuracy = baseContext.hitChance * (1 + (baseContext.accuracyMod || 0));
        const finalAccuracy = Math.floor(modifiedAccuracy * (1 - surroundingPenalty));
        
        // 機会攻撃の場合はペナルティを無視
        if (baseContext.isOpportunityAttack && surroundingPenalty > 0) {
            game.logger.add("Opportunity attack ignores surrounding penalty!", "playerInfo");
        } else if (surroundingPenalty > 0) {
            game.logger.add(`Surrounded! (-${Math.floor(surroundingPenalty * 100)}% accuracy)`, "warning");
        }

        return {
            ...baseContext,
            hitChance: baseContext.isOpportunityAttack ? modifiedAccuracy : finalAccuracy,
            damageMultiplier: baseContext.damageMod || 1,
            speedTier: baseContext.speedTier,
            effectDesc: baseContext.effectDesc || ""
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
                if (mod.desc) effectDesc.push(mod.desc);
            }
            effectDesc = [
                `Combined: ${effectDesc.join(' + ')}`,
                `DMG: ${((totalDamageMod - 1) * 100).toFixed(0)}%`,
                `ACC: ${(totalAccuracyMod * 100).toFixed(0)}%`
            ];
        } else {
            // 単一スキルの処理
            const mod = modifiers[0];
            if (mod.desc) effectDesc.push(mod.desc);
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