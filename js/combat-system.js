class CombatSystem {
    // ... 既存のコード ...

    static resolveCombatAction(attacker, defender, game, context = {}) {
        if (!game) {
            console.error('Game object is undefined in resolveCombatAction');
            return { hit: false, evaded: false };
        }

        // 遠距離攻撃の場合の特別処理
        if (context.isRangedAttack) {
            return this.resolveRangedAttack(attacker, defender, game, context);
        }

        // 機会攻撃の場合の特別処理
        if (context.isOpportunityAttack) {
            // 機会攻撃用の修正を適用
            context.accuracyMod = 0.2;  // 20% 命中ボーナス
            context.damageMod = 1.5;    // 50% ダメージボーナス
            context.attackType = "Opportunity attack";
            game.logger.add("Opportunity Attack!", "playerInfo");
        }

        // 通常の攻撃として処理
        context.attackType = "attack";

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
            return game.lastAttackResult;
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
                return game.lastAttackResult;
            }
        }
        
        // ダメージ計算
        const damageResult = this.calculateDamage(attacker, defender, attackContext);
        
        // ダメージ適用
        const finalDamage = Math.min(defender.hp, damageResult.damage);
        const result = defender.takeDamage(finalDamage, {
            game: game,
            isCritical: attackContext.isCritical
        });
        
        if (!result) {
            console.error('takeDamage returned undefined result');
            return {
                hit: true,
                evaded: false,
                damage: finalDamage,
                killed: false
            };
        }
        
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
        
        // surroundingsペナルティの計算（プレイヤーとモンスターで処理を分ける）
        let surroundingPenalty = 0;
        if (context.isPlayer) {
            // プレイヤーが攻撃側の場合、モンスター（防御側）の周囲の味方モンスター数を数える
            const surroundingAllies = game.monsters.filter(m => 
                m !== defender && // 自分自身を除外
                GAME_CONSTANTS.DISTANCE.calculateChebyshev(m.x, m.y, defender.x, defender.y) <= 1
            ).length;
            const penaltyPerAlly = 15; // 1体につき15%のペナルティ
            surroundingPenalty = Math.min(60, Math.max(0, (surroundingAllies - 1) * penaltyPerAlly)) / 100;
        } else {
            // モンスターが攻撃側の場合、プレイヤー（防御側）の周囲のモンスター数を数える
            const surroundingMonsters = defender.countSurroundingMonsters(game);
            const penaltyPerMonster = 15; // 1体につき15%のペナルティ
            surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;
        }
        
        // ペナルティを適用した回避率を計算
        const baseEvadeChance = defender.evasion;
        const penalizedEvadeChance = Math.floor(baseEvadeChance * (1 - surroundingPenalty));
        
        if (evadeRoll < penalizedEvadeChance) {
            const logMessage = context.isPlayer
                ? `${defender.name} dodges your ${context.attackType}!`
                : `You dodge ${attacker.name}'s ${context.attackType}!`;
            
            game.logger.add(
                `${logMessage} (EVA: ${penalizedEvadeChance}% | Roll: ${evadeRoll})`,
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
            // プレイヤーが死亡した場合、死因を記録
            defender.deathCause = `Slain by ${attacker.name}`;
            return;
        }

        if (!result.evaded) {
            // 戦闘音の発生と伝播
            const combatNoiseIntensity = this.calculateCombatNoiseIntensity(result, context);
            game.lastCombatLocation = {
                x: defender.x,
                y: defender.y,
                intensity: combatNoiseIntensity,
                type: context.isRangedAttack ? 'ranged' : 'melee'
            };

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

    // 戦闘音の強度を計算する新しいメソッド
    static calculateCombatNoiseIntensity(result, context) {
        let baseIntensity = 100; // 基本の音量

        // クリティカルヒットの場合は音が大きくなる
        if (context.isCritical) {
            baseIntensity *= 1.5;
        }

        // ダメージ量に応じて音量が変化
        const damageScale = Math.min(2.0, 1.0 + (result.damage / 20));
        baseIntensity *= damageScale;

        // 遠距離攻撃は近接攻撃より音が小さい
        if (context.isRangedAttack) {
            baseIntensity *= 0.8;
        }

        return Math.floor(baseIntensity);
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

    // 遠距離攻撃の処理を行う新しいメソッド
    static resolveRangedAttack(attacker, defender, game, context = {}) {
        // エネルギーチェックを追加
        const energyCost = GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_COST(attacker.stats);
        if (attacker.rangedCombat.energy.current < energyCost) {
            game.logger.add("Not enough energy for ranged attack!", "warning");
            attacker.rangedCombat.isActive = false;  // モードを解除
            attacker.rangedCombat.target = null;     // ターゲットもクリア
            return { hit: false, evaded: false, damage: 0, killed: false };
        }

        // 射線上のモンスターをチェック
        const lineOfSightResult = this.checkLineOfSightMonsters(attacker, defender, game);
        if (lineOfSightResult.blocked) {
            // 射線が完全に遮られている場合
            game.logger.add("No clear line of sight to target!", "warning");
            return { hit: false, evaded: false, damage: 0, killed: false };
        }

        // 射線上にモンスターがいる場合、そのモンスターに攻撃が向けられる可能性をチェック
        if (lineOfSightResult.interferingMonsters.length > 0) {
            const newTarget = this.resolveInterferingMonsters(attacker, defender, lineOfSightResult.interferingMonsters, game);
            if (newTarget !== defender) {
                game.logger.add(`Your shot is intercepted by ${newTarget.name}!`, "warning");
                defender = newTarget;
            }
        }

        // 隣接チェック
        const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
            attacker.x, attacker.y,
            defender.x, defender.y
        );

        // 隣接している場合（距離が1以下）はイニシアチブ判定を行う
        if (distance <= 1) {
            const baseAttackerSpeed = GAME_CONSTANTS.FORMULAS.SPEED(attacker.stats);
            const defenderSpeed = GAME_CONSTANTS.FORMULAS.SPEED(defender.stats);
            
            // 遠距離攻撃時は速度を1段階下げる
            const attackerSpeed = {
                value: Math.max(1, baseAttackerSpeed.value - 1),
                name: GAME_CONSTANTS.COLORS.SPEED[Math.max(1, baseAttackerSpeed.value - 1)].name
            };
            
            // イニシアチブ判定のログを出力（遠距離攻撃による速度低下を表示）
            game.logger.add(`Speed Order: ${context.isPlayer ? "Player" : defender.name} (${baseAttackerSpeed.name} → ${attackerSpeed.name} [Ranged]) vs ${context.isPlayer ? defender.name : "you"} (${defenderSpeed.name})`);

            // 敵の方が速い場合は先制攻撃
            if (defenderSpeed.value > attackerSpeed.value) {
                game.logger.add(`${defender.name} acts preemptively!`, "monsterInfo");
                defender.attackPlayer(attacker, game);
                defender.hasActedThisTurn = true;

                // プレイヤーが死亡している場合は処理を中断
                if (attacker.hp <= 0) {
                    return { hit: false, evaded: false, damage: 0, killed: false };
                }
            }
        }

        // 命中判定（遠距離攻撃は回避不可）
        const roll = Math.floor(Math.random() * 100) + 1;
        const baseHitChance = GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ACCURACY(attacker.stats);

        // 周囲のモンスターによるペナルティを計算（先に乗算）
        const surroundingMonsters = attacker.countSurroundingMonsters(game);
        const penaltyPerMonster = 15; // 1体につき15%のペナルティ
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

        // ペナルティを基本命中率に適用
        const penalizedAccuracy = Math.floor(baseHitChance * (1 - surroundingPenalty));

        // サイズによる命中補正を適用（後から加算）
        const sizeModifier = GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.SIZE_ACCURACY_MODIFIER(defender.stats);

        // 最終的な命中率を計算（5%から95%の間に制限）
        const hitChance = Math.min(95, Math.max(5, penalizedAccuracy + sizeModifier));
        const isCritical = roll <= GAME_CONSTANTS.FORMULAS.CRITICAL_RANGE(attacker.stats);

        // ログ出力用のプレフィックス
        const logPrefix = context.isPlayer ? "You" : attacker.name;
        const logTarget = context.isPlayer ? defender.name : "you";

        // 命中判定のログを出力（サイズ補正とsurroundingsペナルティを含める）
        game.logger.add(
            `${logPrefix} fire at ${logTarget} (ACC: ${Math.floor(hitChance)}% | Roll: ${roll}${isCritical ? ' [CRITICAL HIT!]' : ''})`,
            isCritical ? "playerCrit" : "playerInfo"
        );

        // 弾道エフェクトを表示（命中判定の前に開始）
        game.renderer.effects.showProjectileEffect(
            attacker.x, attacker.y,
            defender.x, defender.y,
            isCritical || roll <= hitChance
        );

        // エネルギーを消費（命中判定の結果に関係なく）
        attacker.rangedCombat.energy.current = Math.max(0, 
            attacker.rangedCombat.energy.current - energyCost
        );

        // クリティカルヒットまたは通常命中の場合
        if (isCritical || roll <= hitChance) {
            // RANGED_COMBATの計算式を使用してダメージを計算
            const baseAttack = GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.BASE_ATTACK(attacker.stats);
            const attackDice = GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ATTACK_DICE(attacker.stats);
            
            // 基本攻撃力
            let damage = baseAttack;
            
            // ダイス攻撃力の計算
            const attackRolls = Array(attackDice.count).fill(0)
                .map(() => Math.floor(Math.random() * attackDice.sides) + 1);
            damage += attackRolls.reduce((sum, roll) => sum + roll, 0);

            // クリティカルの場合は防御を無視
            let finalDamage;
            let defenseRolls = [];
            if (isCritical) {
                finalDamage = damage;
                game.renderer.showCritEffect(defender.x, defender.y);
                game.playSound('critSound');
            } else {
                // 通常命中の場合は防御計算
                const defense = defender.defense;
                defenseRolls = Array(defense.diceCount).fill(0)
                    .map(() => Math.floor(Math.random() * defense.diceSides) + 1);
                const totalDefense = defense.base + defenseRolls.reduce((sum, roll) => sum + roll, 0);
                finalDamage = Math.max(1, damage - totalDefense);
            }

            // 攻撃結果を設定
            const damageResult = {
                attackRolls,
                defenseRolls,
                totalAttack: damage,
                totalDefense: isCritical ? 0 : defender.defense.base + defenseRolls.reduce((sum, roll) => sum + roll, 0),
                damage: finalDamage
            };

            // ダメージを適用
            const result = defender.takeDamage(finalDamage, {
                source: attacker,
                game: game,
                isCritical: isCritical
            });

            // 攻撃計算の詳細を表示
            const attackCalc = `ATK: ${baseAttack}+[${attackRolls.join(',')}]`;
            const defenseCalc = isCritical 
                ? '[DEF IGNORED]' 
                : `vs DEF: ${defender.defense.base}+[${defenseRolls.join(',')}]`;

            // ダメージログを表示
            const healthStatus = `HP: ${Math.max(0, defender.hp)}/${defender.maxHp}`;
            game.logger.add(
                `The shot hits for ${finalDamage} damage! (${attackCalc} ${defenseCalc}) (${healthStatus})`,
                isCritical ? "playerCrit" : "playerHit"
            );

            // ダメージエフェクトを表示
            game.playSound('rangedAttackSound');
            game.renderer.showDamageFlash();
            game.renderer.render();

            // 攻撃が命中した場合
            if (result.hit) {
                // 死亡処理（damageResultを含めて渡す）
                if (defender.hp <= 0) {
                    game.processMonsterDeath({
                        monster: defender,
                        result: {
                            damage: result.damage,
                            killed: true,
                            evaded: false
                        },
                        damageResult: result.damageResult,
                        context: {
                            isPlayer: true,
                            isCritical: isCritical,
                            isRangedAttack: true,
                            attackType: "Ranged attack",
                            damageMultiplier: 1
                        }
                    });

                    // 次のターゲットを探す
                    if (context.isPlayer) {
                        const nextTarget = attacker.findNearestTargetInRange();
                        if (nextTarget) {
                            attacker.rangedCombat.target = nextTarget;
                            game.logger.add(`Next target: ${nextTarget.x}, ${nextTarget.y}`, "playerInfo");
                        } else {
                            attacker.rangedCombat.isActive = false;
                            game.logger.add("No more targets in range.", "playerInfo");
                        }
                    }
                }
            }

            game.lastAttackResult = {
                hit: true,
                evaded: false,  // 遠距離攻撃は回避不可
                damage: finalDamage,
                killed: defender.hp <= 0,
                isCritical: isCritical,
                damageResult
            };
            game.lastAttackLocation = { x: defender.x, y: defender.y };

            // エネルギーが次の攻撃に不足する場合はモードを解除
            if (attacker.rangedCombat.energy.current < energyCost) {
                game.logger.add("Not enough energy for another shot. Ranged combat mode deactivated.", "warning");
                attacker.rangedCombat.isActive = false;
                attacker.rangedCombat.target = null;
            } else {
                // エネルギーは十分あるが、ターゲットが存在しない場合もモードを解除
                if (context.isPlayer && !attacker.findNearestTargetInRange()) {
                    attacker.rangedCombat.isActive = false;
                    attacker.rangedCombat.target = null;
                    game.logger.add("No valid targets in range. Ranged combat mode deactivated.", "playerInfo");
                }
            }

            return game.lastAttackResult;
        } else {
            // ミス時の処理
            game.lastAttackResult = {
                hit: false,
                evaded: false,  // 遠距離攻撃は回避不可
                damage: 0,
                killed: false
            };
            game.lastAttackLocation = { x: defender.x, y: defender.y };

            game.logger.add("The shot misses!", "playerMiss");
            game.renderer.showMissEffect(defender.x, defender.y, 'miss');
            game.playSound('missSound');
            game.renderer.render();

            // ミス時でも目覚める可能性をチェック
            if (defender.isSleeping) {
                const wakeupChance = 80; 
                if (Math.random() * 100 < wakeupChance) {
                    defender.isSleeping = false;
                    game.logger.add(`${defender.name} wakes up from the noise!`, "monsterInfo");
                    game.renderer.flashLogPanel();
                    game.playSound('cautionSound');
                }
            }
        }

        // エネルギーが次の攻撃に不足する場合はモードを解除
        if (attacker.rangedCombat.energy.current < energyCost) {
            game.logger.add("Not enough energy for another shot. Ranged combat mode deactivated.", "warning");
            attacker.rangedCombat.isActive = false;
            attacker.rangedCombat.target = null;
        } else {
            // エネルギーは十分あるが、ターゲットが存在しない場合もモードを解除
            if (context.isPlayer && !attacker.findNearestTargetInRange()) {
                attacker.rangedCombat.isActive = false;
                attacker.rangedCombat.target = null;
                game.logger.add("No valid targets in range. Ranged combat mode deactivated.", "playerInfo");
            }
        }

        return game.lastAttackResult;
    }

    // 射線上のモンスターをチェックするメソッド
    static checkLineOfSightMonsters(attacker, defender, game) {
        const points = game.getLinePoints(attacker.x, attacker.y, defender.x, defender.y);
        const interferingMonsters = [];
        let blocked = false;

        // 始点と終点を除いた中間地点をチェック
        for (let i = 1; i < points.length - 1; i++) {
            const point = points[i];
            const monster = game.getMonsterAt(point.x, point.y);
            
            if (monster) {
                // モンスターのサイズを取得
                const size = GAME_CONSTANTS.FORMULAS.SIZE(monster.stats);
                
                // サイズが4以上（Large以上）のモンスターは完全に射線を遮る
                if (size.value >= 4) {
                    blocked = true;
                    break;
                }
                
                interferingMonsters.push({
                    monster,
                    distance: i,  // 射手からの距離
                    size: size.value
                });
            }
        }

        return {
            blocked,
            interferingMonsters
        };
    }

    // 干渉するモンスターの解決メソッド
    static resolveInterferingMonsters(attacker, intendedTarget, interferingMonsters, game) {
        // 各モンスターの干渉確率を計算
        const totalWeight = interferingMonsters.reduce((sum, info) => {
            // サイズと距離に基づく重み付け
            const sizeWeight = (info.size - 1) * 20;  // サイズごとに20%ずつ増加
            const distanceWeight = (10 - info.distance) * 5;  // 距離が近いほど高確率（最大50%）
            return sum + Math.min(90, Math.max(10, sizeWeight + distanceWeight));
        }, 0);

        // ランダムロール
        const roll = Math.random() * (totalWeight + 50);  // +50は意図したターゲットにも確率を与える

        // 意図したターゲットに到達する確率
        if (roll > totalWeight) {
            return intendedTarget;
        }

        // どのモンスターに命中するかを決定
        let currentSum = 0;
        for (const info of interferingMonsters) {
            const sizeWeight = (info.size - 1) * 20;
            const distanceWeight = (10 - info.distance) * 5;
            currentSum += Math.min(90, Math.max(10, sizeWeight + distanceWeight));
            
            if (roll <= currentSum) {
                return info.monster;
            }
        }

        // フォールバック
        return intendedTarget;
    }
} 