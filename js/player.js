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
        this.remainingStatPoints = 12;  // 追加: 残りのステータスポイント
        this.deathCause = null;  // 死亡原因を記録

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

        // Vigorの初期化を条件付きで行う
        this.vigor = undefined;  // 初期値をundefinedに
        this.validateVigor();    // validateVigor内で適切な初期値を設定

        // 各種パラメータの計算
        this.updateDerivedStats();

        this.lastPosition = null;  // 前回の位置を記録するプロパティを追加
        this.autoExploring = false;  // 自動探索フラグを追加
        this.detectedPresences = new Set();  // 既に感知した存在を記録
        this.name = '';  // プレイヤー名を追加
        
        // 蜘蛛の巣関連のプロパティを追加
        this.caughtInWeb = null;  // 蜘蛛の巣に捕まっている場合、そのwebオブジェクトを保持

        // 遠距離攻撃システムの初期化
        this.rangedCombat = {
            energy: {
                current: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_MAX(this.stats),
                max: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_MAX(this.stats),
                rechargeRate: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_RECHARGE(this.stats),
                cost: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_COST(this.stats)
            },
            attack: {
                base: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.BASE_ATTACK(this.stats),
                dice: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ATTACK_DICE(this.stats)
            },
            accuracy: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ACCURACY(this.stats),
            range: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.RANGE(this.stats),
            isActive: false  // 遠距離攻撃モードのフラグ
        };
    }

    validateVigor() {
        //console.log('Validating Vigor:', {
        //    currentVigor: this.vigor,
        //    maxVigor: GAME_CONSTANTS.VIGOR.MAX,
        //    isFinite: Number.isFinite(this.vigor),
        //    type: typeof this.vigor
        //});

        // 値が未定義またはNaNの場合のみ最大値を設定
        if (this.vigor === undefined || this.vigor === null || Number.isNaN(this.vigor)) {
            //console.log(`Initializing vigor to max value (${GAME_CONSTANTS.VIGOR.MAX})`);
            this.vigor = GAME_CONSTANTS.VIGOR.MAX;
            return;
        }

        // 数値に変換
        this.vigor = Number(this.vigor);

        // 値の範囲チェック（0から100の間）
        if (this.vigor < 0) {
            //console.warn(`Vigor value (${this.vigor}) below 0, setting to 0`);
            this.vigor = 0;
        } else if (this.vigor > GAME_CONSTANTS.VIGOR.MAX) {
            //console.warn(`Vigor value (${this.vigor}) above ${GAME_CONSTANTS.VIGOR.MAX}, setting to max`);
            this.vigor = GAME_CONSTANTS.VIGOR.MAX;
        }
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
        
        // レベルアップ時にSEを再生
        this.game.playSound('levelUpSound');
        
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
                    this.validateVigor();  // Add validation after changing vigor
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

                // 遠距離攻撃パラメータの更新
                this.rangedCombat = {
                    ...this.rangedCombat,
                    energy: {
                        current: Math.min(
                            this.rangedCombat?.energy?.current ?? GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_MAX(this.stats),
                            GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_MAX(this.stats)
                        ),
                        max: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_MAX(this.stats),
                        rechargeRate: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_RECHARGE(this.stats),
                        cost: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_COST(this.stats)
                    },
                    attack: {
                        base: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.BASE_ATTACK(this.stats),
                        dice: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ATTACK_DICE(this.stats)
                    },
                    accuracy: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ACCURACY(this.stats),
                    range: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.RANGE(this.stats),
                    isActive: this.rangedCombat?.isActive ?? false,
                    target: this.rangedCombat?.target ?? null
                };
                
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
        // 蜘蛛の巣に捕まっている場合、まず脱出を試みる
        if (this.caughtInWeb) {
            if (!this.tryToBreakFreeFromWeb()) {
                // 脱出失敗時はターンを消費して終了
                this.game.logger.add("You're stuck in the web and can't move.", "warning");
                return true; // ターンは消費するが移動はしない
            }
            // 脱出成功の場合は通常の移動処理を続行
        }

        // 以下、通常の移動処理（既存コード）
        if (this.meditation && this.meditation.active) {
            if (!this.meditation.cannotCancelByInput) {
                this.game.logger.add(`Meditation cancelled. (Total healed: ${this.meditation.totalHealed})`, "playerInfo");
                this.game.stopSound('meditationSound');
                this.meditation = null;
            } else {
                //console.log('Meditation cannot be cancelled by movement due to vigor effect');
            }
        }

        const newX = this.x + dx;
        const newY = this.y + dy;
        
        if (this.canMoveTo(newX, newY, map)) {
            // まず移動を実行
            this.lastPosition = { x: this.x, y: this.y };
            this.x = newX;
            this.y = newY;
            
            // 移動効果音を再生
            const moveSoundKeys = Object.keys(this.game.soundManager.moveSounds);
            const randomIndex = Math.floor(Math.random() * moveSoundKeys.length);
            const soundName = moveSoundKeys[randomIndex];
            this.game.playSound(soundName);
            
            // 蜘蛛の巣チェック - 移動後に判定
            const web = this.game.webs.find(web => web.x === this.x && web.y === this.y);
            if (web) {
                // 蜘蛛の巣に引っかかるかチェック - 捕捉確率を高く
                const trapChance = web.trapChance || GAME_CONSTANTS.WEB.TRAP_CHANCE;
                // ここで捕捉確率を調整（もしGAME_CONSTANTSで定義されていない場合は直接値を使用）
                const adjustedTrapChance = Math.min(0.9, trapChance * 1.5); // 50%増しに
                const roll = Math.random();
                
                // 蜘蛛の巣を生成したモンスターを探す
                const createdBySpider = this.game.monsters.find(monster => monster.id === web.createdBy);
                
                if (roll < adjustedTrapChance) {
                    // 蜘蛛の巣に引っかかった
                    this.game.logger.add("You are caught in a sticky web!", "warning");
                    
                    // 移動したらほぼ確実に捕まるように - 同一ターン内の脱出確率を大幅に下げる
                    const immediateEscapeChance = 0.15; // 15%の確率でのみ即時脱出可能に
                    const escapeRoll = Math.random();
                    
                    if (escapeRoll < immediateEscapeChance) {
                        // 脱出成功（同一ターン内）- まれなケース
                        this.game.logger.add("By sheer luck, you manage to break free immediately!", "playerInfo");
                        
                        // 蜘蛛の巣を除去
                        this.game.webs = this.game.webs.filter(w => !(w.x === this.x && w.y === this.y));
                        
                        // 効果音を再生
                        this.game.playSound('webBreakSound');
                    } else {
                        // 脱出失敗 - 捕まり状態をセット（ほとんどのケース）
                        this.game.logger.add("You struggle but can't break free this turn.", "warning");
                        
                        // 効果音を再生
                        this.game.playSound('webTrapSound');
                        
                        // 蜘蛛がいる場合は警告メッセージ
                        if (createdBySpider) {
                            this.game.logger.add(`The ${createdBySpider.name} watches you struggle!`, "warning");
                        }
                        
                        // 移動は成功しているが、捕まり状態を設定
                        this.caughtInWeb = web;

                        // プレイヤーの健康状態の色を蜘蛛の巣に適用
                        const healthStatus = this.getHealthStatus(this.hp, this.maxHp);
                        web.playerColor = healthStatus.color;  // ここで色を設定
                    }
                } else {
                    // 蜘蛛の巣を避けた
                    this.game.logger.add("You carefully navigate through the web.", "playerInfo");
                }
            }

            // ポータルチェックを追加
            if (this.game.floorLevel === 0 && 
                this.game.tiles[this.y][this.x] === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                this.game.logger.add("Enter the portal? [y/n]", "important");
                this.game.setInputMode('confirm', {
                    callback: (confirmed) => {
                        if (confirmed) {
                            this.game.logger.add("You step into the portal...", "important");
                            this.game.processTurn();  // 先にターンを消費
                            this.game.renderer.startPortalTransition(() => {
                                this.game.floorLevel++;
                                this.game.generateNewFloor();
                                this.game.soundManager.updateBGM();  // ポータルアニメーション完了後にBGMを更新
                            });
                            this.game.soundManager.playPortalSound();  // 新しいメソッドを使用
                        } else {
                            this.game.logger.add("You decide not to enter the portal.", "playerInfo");
                        }
                        this.game.setInputMode('normal');
                    },
                });
            } else if (this.game.tiles[this.y][this.x] === GAME_CONSTANTS.PORTAL.VOID.CHAR) {
                // 自動移動中はVOIDポータルの確認をスキップ
                if (this.autoExploring || this.autoMovingToLandmark || this.autoMovingToStairs) {
                    // 自動移動中はポータルを無視して通過
                    return true;
                }
                
                // 通常の移動時は確認を表示
                this.game.logger.add("Enter the VOID portal? [y/n]", "important");
                this.game.setInputMode('confirm', {
                    callback: (confirmed) => {
                        if (confirmed) {
                            this.game.logger.add("You step into the VOID portal...", "important");
                            this.game.processTurn();  // 先にターンを消費
                            this.game.renderer.startPortalTransition(() => {
                                this.game.floorLevel = 0;  // ホームフロアに戻る
                                this.game.generateNewFloor();
                                this.game.soundManager.updateBGM();  // BGMを更新
                                
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
                            this.game.soundManager.playPortalSound();  // 新しいメソッドを使用
                        } else {
                            this.game.logger.add("You decide not to enter the VOID portal.", "playerInfo");
                        }
                        this.game.setInputMode('normal');
                    },
                });
            }
            
            // ニューラルオベリスクチェック
            if (this.game.tiles[this.y][this.x] === GAME_CONSTANTS.NEURAL_OBELISK.CHAR) {
                this.game.touchNeuralObelisk(this.x, this.y);
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
                this.game.stopSound('meditationSound');
                this.meditation = null;
            }
        }

        // 休憩状態もキャンセル
        if (this.resting && this.resting.active) {
            const healedAmount = this.hp - this.resting.startHp;
            this.game.logger.add(`You were attacked! Rest interrupted. (Healed: ${healedAmount} HP)`, "warning");
            this.resting.active = false;
        }

        // 元のevasion値を保持
        const baseEvasion = this.evasion;
        
        // surroundingPenaltyの宣言をif-elseブロックの外に移動
        let surroundingPenalty = 0;
        
        // 蜘蛛の巣に捕まっている場合は回避率を0にする
        if (this.caughtInWeb) {
            this.evasion = 0;
            this.game.logger.add("Caught in web! Cannot evade!", "warning");
        } else {
            // 通常の回避率計算
            // 周囲のモンスター数によるペナルティを計算
            const surroundingMonsters = this.countSurroundingMonsters(this.game);
            const penaltyPerMonster = 15; // 1体につき15%のペナルティ
            surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

            // 回避率にペナルティを一時的に適用
            this.evasion = Math.floor(baseEvasion * (1 - surroundingPenalty));
        }

        // クリティカルヒットの場合、回避と防御を無視
        let damage;
        if (context.isCritical) {
            damage = amount;  // 防御計算なしで直接ダメージを適用
        } else {
            damage = Math.max(1, amount);
        }
        
        // HPが0未満にならないように制限
        this.hp = Math.max(0, this.hp - damage);

        // ダメージ結果を作成
        const result = {
            damage: damage,
            killed: this.hp === 0,
            evaded: false
        };
        
        // HPが0になった場合の処理
        if (this.hp === 0) {
            // 死因を設定
            let cause = 'Exhaustion';  // デフォルトの死因
            if (context.source) {
                if (context.source instanceof Monster) {
                    cause = `Killed by ${context.source.name}`;
                } else if (context.source === 'exhaustion') {
                    cause = 'Succumbed to exhaustion';
                }
            }
            this.deathCause = cause;
            
            // エフェクトと効果音を再生
            this.game.renderer.showDeathEffect(this.x, this.y);
            this.game.playSound('playerDeathSound');
            
            // 画面の更新
            this.game.renderer.render();
            
            // 結果を返してからゲームオーバー処理を実行
            setTimeout(() => {
                this.game.gameOver();
            }, 0);
            
            return result;
        }

        this.game.renderer.render();
        // ダメージが1以上の場合のみ、SEとフラッシュエフェクトを再生
        if (damage > 0) {
            this.game.renderer.flashStatusPanel();
            this.game.playSound('takeDamageSound');
        }

        if (surroundingPenalty > 0) {
            this.game.logger.add(`Surrounded! (-${Math.floor(surroundingPenalty * 100)}% evasion)`, "warning");
        }

        // evasionを元の値に戻す
        this.evasion = baseEvasion;

        // 蜘蛛の巣に捕まっている場合、色を更新
        if (this.caughtInWeb) {
            const healthStatus = this.getHealthStatus(this.hp, this.maxHp);
            this.caughtInWeb.playerColor = healthStatus.color;
        }

        return result;
    }

    // ===== Combat Resolution Methods =====
    attackMonster(monster, game) {
        // 蜘蛛の巣に捕まっている場合、まず脱出を試みる
        if (this.caughtInWeb) {
            if (!this.tryToBreakFreeFromWeb()) {
                // 脱出失敗時はターンを消費して終了
                game.processTurn();
                return;
            }
            // 脱出成功の場合は通常の攻撃処理を続行
        }

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
        // 蜘蛛の巣に捕まっている場合、まず脱出を試みる
        if (this.caughtInWeb) {
            if (!this.tryToBreakFreeFromWeb()) {
                // 脱出失敗時はターンを消費して終了
                game.processTurn();
                return false;
            }
            // 脱出成功の場合は通常のスキル処理を続行
        }

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
        // Calculate perception
        this.perception = GAME_CONSTANTS.FORMULAS.PERCEPTION(this.stats);
        
        // 他の派生パラメータの更新
        this.maxHp = GAME_CONSTANTS.FORMULAS.MAX_HP(this.stats, this.level);
        this.attackPower = GAME_CONSTANTS.FORMULAS.ATTACK(this.stats);
        this.defense = GAME_CONSTANTS.FORMULAS.DEFENSE(this.stats);
        this.accuracy = GAME_CONSTANTS.FORMULAS.ACCURACY(this.stats);
        this.evasion = GAME_CONSTANTS.FORMULAS.EVASION(this.stats);

        // 遠距離攻撃パラメータの更新
        this.rangedCombat = {
            ...this.rangedCombat,
            energy: {
                current: Math.min(
                    this.rangedCombat?.energy?.current ?? GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_MAX(this.stats),
                    GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_MAX(this.stats)
                ),
                max: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_MAX(this.stats),
                rechargeRate: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_RECHARGE(this.stats),
                cost: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_COST(this.stats)
            },
            attack: {
                base: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.BASE_ATTACK(this.stats),
                dice: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ATTACK_DICE(this.stats)
            },
            accuracy: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ACCURACY(this.stats),
            range: GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.RANGE(this.stats),
            isActive: this.rangedCombat?.isActive ?? false,
            target: this.rangedCombat?.target ?? null
        };
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

        // 遠距離攻撃のターゲットがいる場合、サイズ補正を計算
        let rangedAccuracyText = `${this.rangedCombat.accuracy}`;
        if (this.rangedCombat.isActive && this.rangedCombat.target) {
            const target = this.game.getMonsterAt(this.rangedCombat.target.x, this.rangedCombat.target.y);
            if (target) {
                const sizeModifier = GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.SIZE_ACCURACY_MODIFIER(target.stats);
                const finalAccuracy = Math.min(95, Math.max(5, this.rangedCombat.accuracy + sizeModifier));
                
                // サイズ補正に応じて色を変更
                if (sizeModifier !== 0) {
                    rangedAccuracyText = `<span style="color: ${sizeModifier > 0 ? '#2ecc71' : '#e74c3c'}">${finalAccuracy}</span>`;
                } else {
                    rangedAccuracyText = `${finalAccuracy}`;
                }
            }
        }

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
                perception: this.perception,
                rangedAccuracy: rangedAccuracyText
            }
        };
    }

    // ===== Floor Navigation and Surroundings Methods =====
    descendStairs() {
        if (this.game.tiles[this.y][this.x] === GAME_CONSTANTS.STAIRS.CHAR) {
            this.game.logger.add(`You descend to floor ${this.game.floorLevel + 1}...`, "important");
            this.game.processTurn();  // 先にターンを消費
            this.game.floorLevel++;
            this.game.generateNewFloor();
            this.game.soundManager.updateBGM();  // BGMを更新
            this.game.playSound('descendStairsSound');
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
        // 瞑想中は自動探索を開始できないように修正
        if (this.meditation && this.meditation.active) {
            this.game.logger.add("Cannot auto-explore while meditating.", "warning");
            return;
        }
        
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

        // 隣接する蜘蛛の巣をチェック
        if (this.checkForAdjacentWebs()) {
            this.stopAutoExplore();
            this.game.logger.add("Spider web detected nearby!", "warning");
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
                    
                    // チェビシェフ距離を使用
                    const newDistance = current.distance + GAME_CONSTANTS.DISTANCE.calculateChebyshev(
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

        // 隣接する蜘蛛の巣をチェック
        if (this.checkForAdjacentWebs()) {
            player.stopAutoMoveToStairs();
            this.game.logger.add("Spider web detected nearby!", "warning");
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
        const visited = new Set();
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
                
                // 探索済みのタイルのみを使用するように変更
                if (this.game.isValidPosition(newX, newY) && 
                    this.game.map[newY][newX] === 'floor' &&
                    this.game.explored[newY][newX]) {
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

        // ここで caution2Sound を再生
        game.soundManager.playSound('caution2Sound');
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

    startAutoMoveToLandmark(landmark) {
        this.autoMovingToLandmark = true;
        this.game.logger.add("Moving to landmark...", "playerInfo");
        this.continueAutoMoveToLandmark(landmark);
    }

    continueAutoMoveToLandmark(landmark) {
        if (!this.autoMovingToLandmark) return;

        // 視界内の敵をチェック
        const visibleTiles = this.game.getVisibleTiles();
        const visibleTilesSet = new Set(visibleTiles.map(({x, y}) => `${x},${y}`));
        
        const visibleMonsters = this.game.monsters.filter(monster => {
            const monsterKey = `${monster.x},${monster.y}`;
            return visibleTilesSet.has(monsterKey);
        });

        if (visibleMonsters.length > 0) {
            this.stopAutoMoveToLandmark();
            this.game.logger.add("Enemy spotted in range!", "warning");
            return;
        }

        // 隣接する蜘蛛の巣をチェック
        if (this.checkForAdjacentWebs()) {
            this.stopAutoMoveToLandmark();
            this.game.logger.add("Spider web detected nearby!", "warning");
            return;
        }

        // ランドマークに隣接しているかチェック（斜めも含む）
        const isAdjacent = Math.abs(this.x - landmark.x) <= 1 && Math.abs(this.y - landmark.y) <= 1;
        if (isAdjacent) {
            this.stopAutoMoveToLandmark();
            this.game.logger.add("You arrive at your destination.", "playerInfo");
            return;
        }

        // ランドマークへの方向を見つける
        const direction = this.findDirectionToLandmark(landmark);
        if (!direction) {
            this.stopAutoMoveToLandmark();
            this.game.logger.add("Cannot reach the landmark from here.", "warning");
            return;
        }

        // 移動実行
        if (this.move(direction.dx, direction.dy, this.game.map)) {
            this.game.processTurn();
            // 次のターンの自動移動をスケジュール
            setTimeout(() => this.continueAutoMoveToLandmark(landmark), 50);
        } else {
            this.stopAutoMoveToLandmark();
        }
    }

    stopAutoMoveToLandmark() {
        if (this.autoMovingToLandmark) {
            this.autoMovingToLandmark = false;
            this.game.logger.add("Auto-move to landmark stopped.", "playerInfo");
        }
    }

    findDirectionToLandmark(landmark) {
        const visited = new Set();
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

            if (current.x === landmark.x && current.y === landmark.y) {
                return current.firstStep;
            }

            const directions = [
                {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
                {dx: -1, dy: 0},                    {dx: 1, dy: 0},
                {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
            ];

            for (const dir of directions) {
                const newX = current.x + dir.dx;
                const newY = current.y + dir.dy;
                
                // 探索済みのタイルのみを使用するように変更
                if (this.game.isValidPosition(newX, newY) && 
                    this.game.explored[newY][newX] &&
                    (this.game.map[newY][newX] === 'floor' ||
                     this.game.tiles[newY][newX] === GAME_CONSTANTS.PORTAL.VOID.CHAR)) {
                    queue.push({
                        x: newX,
                        y: newY,
                        firstStep: current.firstStep || dir
                    });
                }
            }
        }

        return null;
    }

    // 新規: 全ての自動移動を停止するメソッド
    stopAllAutoMovement() {
        if (this.autoExploring) {
            this.stopAutoExplore();
        }
        if (this.autoMovingToStairs) {
            this.stopAutoMoveToStairs();
        }
        if (this.autoMovingToLandmark) {
            this.stopAutoMoveToLandmark();
        }
        
        // 休憩も停止
        if (this.resting && this.resting.active) {
            this.resting.active = false;
            this.game.logger.add("Rest interrupted.", "warning");
        }
    }

    // 蜘蛛の巣が隣接しているかをチェックする新しいメソッド
    checkForAdjacentWebs() {
        const directions = [
            {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
            {dx: -1, dy: 0},                    {dx: 1, dy: 0},
            {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
        ];
        
        for (const dir of directions) {
            const checkX = this.x + dir.dx;
            const checkY = this.y + dir.dy;
            
            // マップ範囲内かチェック
            if (checkX < 0 || checkX >= this.game.width || checkY < 0 || checkY >= this.game.height) {
                continue;
            }
            
            // 蜘蛛の巣があるかチェック
            const web = this.game.webs.find(web => web.x === checkX && web.y === checkY);
            if (web) {
                return true;
            }
        }
        
        return false;
    }

    // 新規: A*アルゴリズムによる共通経路探索メソッド
    findPath(startX, startY, isGoalFunc, options = {}) {
        const {
            mustBeExplored = true,     // 探索済みタイルのみを使用するか
            diagonalMovement = true,   // 斜め移動を許可するか
            avoidEnemies = true,       // 敵の近くを避けるか
            maxPathLength = 1000       // 最大探索距離
        } = options;

        // 方向の定義（斜め移動の有無で変更）
        const directions = diagonalMovement ?
            [
                {dx: 0, dy: -1, cost: 1},    // 上
                {dx: 1, dy: -1, cost: 1.414}, // 右上
                {dx: 1, dy: 0, cost: 1},     // 右
                {dx: 1, dy: 1, cost: 1.414},  // 右下
                {dx: 0, dy: 1, cost: 1},     // 下
                {dx: -1, dy: 1, cost: 1.414}, // 左下
                {dx: -1, dy: 0, cost: 1},    // 左
                {dx: -1, dy: -1, cost: 1.414} // 左上
            ] :
            [
                {dx: 0, dy: -1, cost: 1}, // 上
                {dx: 1, dy: 0, cost: 1},  // 右
                {dx: 0, dy: 1, cost: 1},  // 下
                {dx: -1, dy: 0, cost: 1}  // 左
            ];

        // A*アルゴリズムの実装
        const openSet = [];
        const closedSet = new Set();
        const gScore = {};
        const fScore = {};
        const cameFrom = {};
        
        // 開始点の設定
        const startKey = `${startX},${startY}`;
        gScore[startKey] = 0;
        fScore[startKey] = 0; // 初期ヒューリスティック値
        
        openSet.push({
            x: startX,
            y: startY,
            key: startKey,
            g: 0,
            f: 0
        });
        
        while (openSet.length > 0) {
            // fスコアが最小のノードを取得
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            
            // 目標に到達したか確認
            if (isGoalFunc(current.x, current.y)) {
                // 最初の一歩を特定して返す
                return this.reconstructFirstStep(cameFrom, current.key, startKey);
            }
            
            // 閉じたセットに追加
            closedSet.add(current.key);
            
            // 最大パス長のチェック
            if (current.g >= maxPathLength) continue;
            
            // 各方向をチェック
            for (const dir of directions) {
                const newX = current.x + dir.dx;
                const newY = current.y + dir.dy;
                const newKey = `${newX},${newY}`;
                
                // 既に調査済みならスキップ
                if (closedSet.has(newKey)) continue;
                
                // 有効な位置かチェック
                if (!this.game.isValidPosition(newX, newY)) continue;
                
                // 通行可能かチェック（床またはドアなど）
                if (!this.isValidPathTile(newX, newY)) continue;
                
                // 探索済みかチェック（オプション）
                if (mustBeExplored && !this.game.explored[newY][newX]) continue;
                
                // 敵を避ける（オプション）
                let enemyPenalty = 0;
                if (avoidEnemies) {
                    const surroundingEnemies = this.countSurroundingEnemies(newX, newY);
                    if (surroundingEnemies > 0) {
                        enemyPenalty = surroundingEnemies * 5; // 敵1体につき5コスト追加
                    }
                }
                
                // 新しいgスコアを計算
                const tentativeGScore = current.g + dir.cost + enemyPenalty;
                
                // 既に計算済みで、新しい経路の方が悪い場合はスキップ
                if (newKey in gScore && tentativeGScore >= gScore[newKey]) continue;
                
                // この経路が最良なので記録
                cameFrom[newKey] = current.key;
                gScore[newKey] = tentativeGScore;
                
                // ヒューリスティック値を計算（目標への直線距離の推定）
                const heuristic = this.calculateHeuristic(newX, newY, isGoalFunc);
                fScore[newKey] = gScore[newKey] + heuristic;
                
                // 既にオープンセットにある場合は更新、なければ追加
                const existingIndex = openSet.findIndex(node => node.key === newKey);
                if (existingIndex !== -1) {
                    openSet[existingIndex].g = gScore[newKey];
                    openSet[existingIndex].f = fScore[newKey];
                } else {
                    openSet.push({
                        x: newX,
                        y: newY,
                        key: newKey,
                        g: gScore[newKey],
                        f: fScore[newKey]
                    });
                }
            }
        }
        
        // 経路が見つからなかった
        return null;
    }
    
    // 経路から最初の一歩を再構築
    reconstructFirstStep(cameFrom, currentKey, startKey) {
        // ゴールから開始位置まで遡る
        const path = [currentKey];
        
        while (path[path.length - 1] !== startKey) {
            path.push(cameFrom[path[path.length - 1]]);
        }
        
        // 最初の一歩を特定
        const firstStepKey = path[path.length - 2]; // 開始点の次のステップ
        const [firstStepX, firstStepY] = firstStepKey.split(',').map(Number);
        
        // 方向ベクトルを計算
        return {
            dx: firstStepX - this.x,
            dy: firstStepY - this.y
        };
    }
    
    // ヒューリスティック関数（目標への推定距離）
    calculateHeuristic(x, y, isGoalFunc) {
        // 目標が単一の座標の場合
        if (typeof isGoalFunc === 'object' && 'x' in isGoalFunc && 'y' in isGoalFunc) {
            // チェビシェフ距離を使用
            return GAME_CONSTANTS.DISTANCE.calculateChebyshev(x, y, isGoalFunc.x, isGoalFunc.y);
        }
        
        // 複数の目標を持つ場合（未探索タイルなど）
        // マップ全体をスキャンして最も近い目標を見つける
        let minDistance = Infinity;
        
        for (let ty = 0; ty < this.game.height; ty++) {
            for (let tx = 0; tx < this.game.width; tx++) {
                if (isGoalFunc(tx, ty)) {
                    const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(x, y, tx, ty);
                    minDistance = Math.min(minDistance, distance);
                }
            }
        }
        
        return minDistance === Infinity ? 0 : minDistance;
    }
    
    // タイルが経路として有効かチェック
    isValidPathTile(x, y) {
        // 床タイルは常に有効
        if (this.game.map[y][x] === 'floor') return true;
        
        // 特殊タイル（階段、ポータル、ニューラルオベリスクなど）の場合
        const tileChar = this.game.tiles[y][x];
        return tileChar === GAME_CONSTANTS.STAIRS.CHAR ||
               tileChar === GAME_CONSTANTS.PORTAL.GATE.CHAR ||
               tileChar === GAME_CONSTANTS.PORTAL.VOID.CHAR ||
               tileChar === GAME_CONSTANTS.NEURAL_OBELISK.CHAR;  // ニューラルオベリスクを追加
    }
    
    // 指定座標周辺の敵の数をカウント
    countSurroundingEnemies(x, y) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const checkX = x + dx;
                const checkY = y + dy;
                if (this.game.getMonsterAt(checkX, checkY)) {
                    count++;
                }
            }
        }
        return count;
    }

     // 未探索タイルへの方向を見つける（改善版）
     findDirectionToUnexplored() {
        // 目標関数: 未探索の床タイル
        const isUnexploredGoal = (x, y) => {
            return this.game.isValidPosition(x, y) && 
                   !this.game.explored[y][x] && 
                   this.game.map[y][x] === 'floor';
        };
        
        // A*アルゴリズムで経路を探索（未探索タイルへの移動なので探索済み条件は緩める）
        const direction = this.findPath(this.x, this.y, isUnexploredGoal, {
            mustBeExplored: false,  // 未探索タイルも経路に含める
            diagonalMovement: true,
            avoidEnemies: true
        });
        
        if (!direction) {
            // マップ全体をスキャンして未探索の床タイルが残っているか確認
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
        
        return direction;
    }

    // 階段への方向を見つける（改善版）
    findDirectionToStairs(stairLocation) {
        // 目標関数: 階段の位置
        const isStairsGoal = (x, y) => x === stairLocation.x && y === stairLocation.y;
        
        // A*アルゴリズムで経路を探索
        return this.findPath(this.x, this.y, isStairsGoal, {
            mustBeExplored: true,  // 探索済みタイルのみ使用
            diagonalMovement: true,
            avoidEnemies: true
        });
    }

    // ランドマークへの方向を見つける（改善版）
    findDirectionToLandmark(landmark) {
        // 目標関数: ランドマークの位置
        const isLandmarkGoal = (x, y) => x === landmark.x && y === landmark.y;
        
        // A*アルゴリズムで経路を探索
        return this.findPath(this.x, this.y, isLandmarkGoal, {
            mustBeExplored: true,  // 探索済みタイルのみ使用
            diagonalMovement: true,
            avoidEnemies: true
        });
    }

    // 新しいメソッド: 蜘蛛の巣からの脱出を試みる
    tryToBreakFreeFromWeb() {
        if (!this.caughtInWeb) return true; // 捕まっていなければ成功とみなす
        
        // 脱出チャンスを計算（DEXが高いほど脱出しやすいが、ベース確率を下げる）
        const baseChance = 0.2; // ベース確率を20%に下げる（元の値より低く）
        const dexBonus = Math.max(0, (this.stats.dex - 10) * 0.02); // DEXボーナスも減少（3%→2%）
        const escapeChance = Math.min(0.75, baseChance + dexBonus); // 最大確率も75%に制限
        
        const roll = Math.random();
        if (roll < escapeChance) {
            // 脱出成功
            this.game.logger.add("You break free from the web!", "playerInfo");
            
            // webの位置情報を取得
            const webX = this.caughtInWeb.x;
            const webY = this.caughtInWeb.y;
            
            // 蜘蛛の巣を除去
            this.game.webs = this.game.webs.filter(w => !(w.x === webX && w.y === webY));
            
            // 捕まり状態を解除
            this.caughtInWeb = null;
            
            // 効果音を再生
            this.game.playSound('damageSound');
            
            return true; // アクションを続行可能
        } else {
            // 脱出失敗のメッセージをより厳しく
            const messages = [
                "You struggle but remain caught in the web.",
                "The sticky strands cling to you, preventing escape.",
                "Your movements only entangle you further in the web.",
                "The web tightens around you as you struggle."
            ];
            const randomMessage = messages[Math.floor(Math.random() * messages.length)];
            this.game.logger.add(randomMessage, "warning");
            
            // 効果音を再生
            this.game.playSound('missSound');
            
            // プレイヤーの健康状態の色を更新
            const healthStatus = this.getHealthStatus(this.hp, this.maxHp);
            this.caughtInWeb.playerColor = healthStatus.color;
            
            return false; // アクション失敗
        }
    }

    // プレイヤークラスに新しいメソッドを追加
    findNearestTargetInRange() {
        if (!this.rangedCombat.isActive) return null;

        const visibleTiles = this.game.getVisibleTiles();
        const visibleTilesSet = new Set(visibleTiles.map(({x, y}) => `${x},${y}`));
        
        let nearestTarget = null;
        let minDistance = Infinity;

        this.game.monsters.forEach(monster => {
            const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(this.x, this.y, monster.x, monster.y);
            const monsterKey = `${monster.x},${monster.y}`;

            if (distance <= this.rangedCombat.range && visibleTilesSet.has(monsterKey)) {
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestTarget = { x: monster.x, y: monster.y };
                }
            }
        });

        return nearestTarget;
    }

    cycleTarget(direction) {
        if (!this.rangedCombat.isActive || !this.rangedCombat.target) return;

        const visibleTiles = this.game.getVisibleTiles();
        const visibleTilesSet = new Set(visibleTiles.map(({x, y}) => `${x},${y}`));
        
        // 射程範囲内の有効なターゲットをすべて取得
        const validTargets = this.game.monsters
            .filter(monster => {
                const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(this.x, this.y, monster.x, monster.y);
                const monsterKey = `${monster.x},${monster.y}`;
                return distance <= this.rangedCombat.range && visibleTilesSet.has(monsterKey);
            })
            .map(monster => ({ x: monster.x, y: monster.y }));

        if (validTargets.length === 0) return;

        // 現在のターゲットのインデックスを見つける
        const currentIndex = validTargets.findIndex(t => 
            t.x === this.rangedCombat.target.x && t.y === this.rangedCombat.target.y
        );

        // 次のターゲットを選択
        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % validTargets.length;
        } else {
            nextIndex = (currentIndex - 1 + validTargets.length) % validTargets.length;
        }

        this.rangedCombat.target = validTargets[nextIndex];
    }

    // 遠距離攻撃を実行するメソッド
    performRangedAttack(target, game) {
        // エネルギーが不足している場合は攻撃できない
        if (this.rangedCombat.energy.current < this.rangedCombat.energy.cost) {
            game.logger.add("Not enough energy for ranged attack!", "warning");
            return false;
        }

        // 射程範囲外の場合は攻撃できない（チェビシェフ距離を使用）
        const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
            this.x, this.y,
            target.x, target.y
        );
        if (distance > this.rangedCombat.range) {
            game.logger.add("Target is out of range!", "warning");
            return false;
        }

        // 視線が通っているかチェック
        if (!game.hasLineOfSight(this.x, this.y, target.x, target.y)) {
            game.logger.add("No clear line of sight to target!", "warning");
            return false;
        }

        // 遠距離攻撃の実行
        const result = CombatSystem.resolveRangedAttack(this, target, game, { isPlayer: true });

        // 攻撃が命中した場合
        if (result.hit) {
            // 死亡処理（damageResultを含めて渡す）
            if (target.hp <= 0) {
                game.processMonsterDeath({
                    monster: target,
                    result: {
                        damage: result.damage,
                        killed: true,
                        evaded: false
                    },
                    damageResult: result.damageResult,
                    context: {
                        isPlayer: true,
                        isCritical: result.isCritical,
                        isRangedAttack: true,
                        attackType: "Ranged attack",
                        damageMultiplier: 1
                    }
                });

                // 次のターゲットを探す
                const nextTarget = this.findNearestTargetInRange();
                if (nextTarget) {
                    this.rangedCombat.target = nextTarget;
                    game.logger.add(`Targeting next enemy at (${nextTarget.x}, ${nextTarget.y})`, "playerInfo");
                } else {
                    this.rangedCombat.isActive = false;
                    game.logger.add("No more targets in range.", "playerInfo");
                }
            }
        }

        return true;
    }

    // エネルギー回復処理を追加
    processEnergyRecharge() {
        if (!this.rangedCombat) return;

        // 隣接するモンスターをチェック
        const surroundingMonsters = this.countSurroundingMonsters(this.game);
        if (surroundingMonsters > 0) {
            // モンスターが隣接している場合は回復しない
            return;
        }

        const oldEnergy = this.rangedCombat.energy.current;
        this.rangedCombat.energy.current = Math.min(
            this.rangedCombat.energy.max,
            this.rangedCombat.energy.current + this.rangedCombat.energy.rechargeRate
        );
    }
} 