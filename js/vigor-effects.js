// グローバルオブジェクトに先に空のオブジェクトを登録
window.VigorEffects = {};

class VigorEffects {
    constructor(game) {
        this.game = game;
    }

    static getVigorPenaltyEffect(severity, playerVigorState = null) {
        if (severity === 'High' || !severity) {
            return null;
        }

        // Exhaustedの場合は、ネガティブな効果のみを選択
        if (severity === 'Exhausted') {
            const effects = {
                'Exhausted': [
                    { type: 'forceDescend', weight: 20 },
                    { type: 'forgetAllTiles', weight: 20 },
                    { type: 'randomTeleport', weight: 20 },
                    { type: 'pauseAndShift', weight: 20 },
                    { type: 'forgetSomeTiles', weight: 20 }
                ]
            };

            return VigorEffects.weightedRandomChoice(effects['Exhausted']);
        }

        const effects = {
            'Moderate': [
                { type: 'forgetSomeTiles', weight: 50 },
                { type: 'pauseAndShift', weight: 50 }
            ],
            'Low': [
                { type: 'forgetSomeTiles', weight: 30 },
                { type: 'randomTeleport', weight: 20 },
                { type: 'pauseAndShift', weight: 30 },
                { type: 'forgetAllTiles', weight: 20 },
            ],
            'Critical': [
                { type: 'forgetAllTiles', weight: 25 },
                { type: 'randomTeleport', weight: 25 },
                { type: 'forceDescend', weight: 20 },
                { type: 'pauseAndShift', weight: 30 }
            ],
            'positive': [
                { type: 'revealAll', weight: 5 },
                { type: 'fullRestore', weight: 3 },
                { type: 'levelUp', weight: 2 }
            ]
        };

        // severityが'positive'で、かつプレイヤーがexhaustedまたはcritical状態の場合は良い効果を返さない
        if (severity === 'positive' && (playerVigorState === 'Exhausted' || playerVigorState === 'Critical')) {
            console.log(`Player is ${playerVigorState}. No positive effects will be applied.`);
            return null;
        }

        const effectList = effects[severity];
        if (!effectList) {
            console.warn(`Unknown vigor severity: ${severity}`);
            return null;
        }

        return VigorEffects.weightedRandomChoice(effectList);
    }

    static weightedRandomChoice(options) {
        if (!options || !Array.isArray(options) || options.length === 0) {
            return null;
        }
        const totalWeight = options.reduce((sum, opt) => sum + (opt.weight || 0), 0);
        if (totalWeight <= 0) {
            return options[0];
        }
        let random = Math.random() * totalWeight;

        for (const option of options) {
            random -= (option.weight || 0);
            if (random <= 0) {
                return option;
            }
        }
        return options[0];
    }

    applyVigorEffect(effect) {
        if (!effect) {
            return;
        }

        // エフェクト適用時のコンソールログを追加
        console.log(`Applying vigor effect: ${effect.type}`);

        // エフェクト適用時に入力状態をリセット
        this.game.player.stopAllAutoMovement();

        // 入力を無効化するフラグを設定
        this.game.inputDisabled = true;
        
        // エフェクト発動前に1秒のフリーズを追加
        this.game.logger.add("A strange sensation washes over you...", "warning");
        
        // 画面をフリーズさせる視覚効果を追加（オプション）
        if (this.game.renderer.freezeScreen) {
            this.game.renderer.freezeScreen();
        }
        
        // 1秒後にエフェクトを実際に適用
        setTimeout(() => {
            // 入力を再度有効化
            this.game.inputDisabled = false;
            
            // フリーズ効果を解除（オプション）
            if (this.game.renderer.unfreezeScreen) {
                this.game.renderer.unfreezeScreen();
            }
            
            // 実際のエフェクト処理を実行
            this._executeVigorEffect(effect);
        }, 1000);
    }
    
    // 実際のエフェクト処理を別メソッドに分離
    _executeVigorEffect(effect) {
        switch (effect.type) {
            case 'pauseAndShift':
                console.log('Executing pauseAndShift effect');
                this.game.logger.add("Your exhaustion forces you to pause, and the world shifts...", "warning");
                
                // 幻覚エフェクトを適用
                this.game.renderer.psychedelicTurn += 7;
                
                // 一時的な瞑想状態（音声なし）
                this.game.player.meditation = {
                    active: true,
                    soundStarted: false,
                    healPerTurn: Math.floor(this.game.player.stats.wis / 3),
                    turnsRemaining: 1,  // 1ターンだけ
                    totalHealed: 0,
                };
                
                this.game.logger.add("You enter a brief meditative state.", "warning");
                // 瞑想開始時に効果音をループ再生
                this.game.playSound('meditationSound', true); // 第二引数にtrueを渡してループ再生
                this.game.player.processTurn('wait');
                break;

            case 'forceDescend':
                console.log('Executing forceDescend effect');
                this.game.logger.add("Your exhaustion forces you downward!", "warning");
                // 幻覚エフェクトを適用
                this.game.renderer.psychedelicTurn += 12;
                this.game.renderer.startPortalTransition(() => {
                    this.game.floorLevel++;
                    this.game.generateNewFloor();
                    this.game.soundManager.updateBGM();
                    this.game.logger.add(`You descend to floor ${this.game.floorLevel}...`, "warning");
                });
                this.game.soundManager.playPortalSound();
                break;

            case 'randomTeleport':
                console.log('Executing randomTeleport effect');
                this.game.logger.add("Your mind wanders, and so does your body...", "warning");
                // 幻覚エフェクトを適用
                this.game.renderer.psychedelicTurn += 10;
                this.game.renderer.startShortPortalTransition(() => {
                    let x, y;
                    let validFloorTiles = [];
                    
                    // 有効なfloorタイルをすべて収集
                    for (let ty = 0; ty < this.game.height; ty++) {
                        for (let tx = 0; tx < this.game.width; tx++) {
                            // 以下の条件を満たすタイルのみを有効とする:
                            // 1. floorタイル
                            // 2. モンスターがいない
                            // 3. プレイヤーの現在位置ではない
                            // 4. ブロッキング障害物がない
                            // 5. 透過障害物もない
                            if (this.game.map[ty][tx] === 'floor' && 
                                !this.game.getMonsterAt(tx, ty) &&
                                !(tx === this.game.player.x && ty === this.game.player.y) &&
                                !GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.game.tiles[ty][tx]) &&
                                !GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(this.game.tiles[ty][tx]) &&
                                this.game.tiles[ty][tx] !== GAME_CONSTANTS.STAIRS.CHAR &&
                                this.game.tiles[ty][tx] !== GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                                validFloorTiles.push({x: tx, y: ty});
                            }
                        }
                    }
                    
                    // 有効なタイルが見つかった場合はランダムに選択
                    if (validFloorTiles.length > 0) {
                        const randomTile = validFloorTiles[Math.floor(Math.random() * validFloorTiles.length)];
                        x = randomTile.x;
                        y = randomTile.y;
                    } else {
                        // フォールバック: 元の方法で試行（これは起こりにくいはず）
                        do {
                            x = Math.floor(Math.random() * this.game.width);
                            y = Math.floor(Math.random() * this.game.height);
                        } while (this.game.map[y][x] !== 'floor' || this.game.getMonsterAt(x, y) ||
                            (x === this.game.player.x && y === this.game.player.y) ||
                            GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.game.tiles[y][x]));
                    }

                    this.game.player.x = x;
                    this.game.player.y = y;
                    this.game.renderer.render();
                });
                this.game.soundManager.playPortalSound();
                break;

            case 'forgetAllTiles':
                console.log('Executing forgetAllTiles effect');
                this.game.logger.add("Your memory fades completely...", "warning");
                
                // 一時的な瞑想状態（ビジュアルエフェクトのみ）
                this.game.player.meditation = {
                    active: false,
                    soundStarted: false,
                    healPerTurn: 0,
                    turnsRemaining: 1,
                    totalHealed: 0,
                    skipSound: true,
                    visualOnly: true
                };
                
                // 瞑想エフェクトを表示
                this.game.renderer.showMeditationEffect(this.game.player.x, this.game.player.y);
                
                for (let y = 0; y < this.game.height; y++) {
                    for (let x = 0; x < this.game.width; x++) {
                        if (!this.game.getVisibleTiles().some(({ x: visibleX, y: visibleY }) => visibleX === x && visibleY === y)) {
                            this.game.explored[y][x] = false;
                        }
                    }
                }
                this.game.playSound('vigorDownSound');
                
                // 次のターンで瞑想状態をリセット
                setTimeout(() => {
                    this.game.player.meditation = null;
                    this.game.renderer.render();
                }, 500);
                break;

            case 'forgetSomeTiles':
                console.log('Executing forgetSomeTiles effect');
                this.game.logger.add("Your memory becomes hazy...", "warning");
                // 幻覚エフェクトを適用
                this.game.renderer.psychedelicTurn += 3;
                
                // 一時的な瞑想状態（ビジュアルエフェクトのみ）
                this.game.player.meditation = {
                    active: false,
                    soundStarted: false,
                    healPerTurn: 0,
                    turnsRemaining: 1,
                    totalHealed: 0,
                    skipSound: true,
                    visualOnly: true
                };
                
                // 瞑想エフェクトを表示
                this.game.renderer.showMeditationEffect(this.game.player.x, this.game.player.y);
                
                const exploredTiles = [];
                for (let y = 0; y < this.game.height; y++) {
                    for (let x = 0; x < this.game.width; x++) {
                        if (this.game.explored[y][x] && !this.game.getVisibleTiles().some(({ x: visibleX, y: visibleY }) => visibleX === x && visibleY === y)) {
                            exploredTiles.push({ x, y });
                        }
                    }
                }
                const tilesToForget = Math.floor(exploredTiles.length * 0.3);
                for (let i = 0; i < tilesToForget; i++) {
                    if (exploredTiles.length === 0) break;
                    const index = Math.floor(Math.random() * exploredTiles.length);
                    const tile = exploredTiles.splice(index, 1)[0];
                    this.game.explored[tile.y][tile.x] = false;
                }
                this.game.playSound('vigorDownSound');
                
                // 次のターンで瞑想状態をリセット
                setTimeout(() => {
                    this.game.player.meditation = null;
                    this.game.renderer.render();
                }, 500);
                break;

            case 'revealAll':
                console.log('Executing revealAll effect');
                this.game.logger.add("A moment of clarity reveals all!", "important");
                // 幻覚エフェクトを適用
                this.game.renderer.psychedelicTurn += 10;
                
                // 一時的な瞑想状態（ビジュアルエフェクトのみ）
                this.game.player.meditation = {
                    active: true,
                    soundStarted: false,
                    healPerTurn: 0,
                    turnsRemaining: 1,
                    totalHealed: 0,
                    skipSound: true,
                    visualOnly: true
                };
                
                // 瞑想エフェクトを表示
                this.game.renderer.showMeditationEffect(this.game.player.x, this.game.player.y);
                
                for (let y = 0; y < GAME_CONSTANTS.DIMENSIONS.HEIGHT; y++) {
                    for (let x = 0; x < GAME_CONSTANTS.DIMENSIONS.WIDTH; x++) {
                        this.game.explored[y][x] = true;
                    }
                }
                this.game.playSound('vigorUpSound');
                
                // 次のターンで瞑想状態をリセット
                setTimeout(() => {
                    this.game.player.meditation = null;
                    this.game.renderer.render();
                }, 500);
                break;

            case 'fullRestore':
                console.log('Executing fullRestore effect');
                this.game.logger.add("A surge of energy restores you!", "important");
                // 幻覚エフェクトを適用
                this.game.renderer.psychedelicTurn += 8;
                
                // 一時的な瞑想状態（ビジュアルエフェクトのみ）
                this.game.player.meditation = {
                    active: true,
                    soundStarted: false,
                    healPerTurn: 0,
                    turnsRemaining: 1,
                    totalHealed: 0,
                    skipSound: true,
                    visualOnly: true
                };
                
                // 瞑想エフェクトを表示
                this.game.renderer.showMeditationEffect(this.game.player.x, this.game.player.y);
                
                const hpRestored = this.game.player.maxHp - this.game.player.hp;
                this.game.player.hp = this.game.player.maxHp;
                const oldVigor = this.game.player.vigor;
                const vigorChange = GAME_CONSTANTS.VIGOR.MAX - oldVigor;
                const newVigor = Math.max(0, Math.min(GAME_CONSTANTS.VIGOR.MAX, oldVigor + vigorChange));
                this.game.player.vigor = newVigor;
                this.game.player.validateVigor();
                if (hpRestored > 0) {
                    this.game.logger.add(`Restored ${hpRestored} HP!`, "important");
                }
                this.game.logger.add("Vigor fully restored!", "important");
                this.game.playSound('levelUpSound', true);
                
                // 次のターンで瞑想状態をリセット
                setTimeout(() => {
                    this.game.player.meditation = null;
                    this.game.renderer.render();
                }, 500);
                break;

            case 'levelUp':
                console.log('Executing levelUp effect');
                this.game.logger.add("A mysterious force empowers you!", "important");
                this.game.player.levelUp();
                this.game.playSound('levelUpSound');
                break;
        }
        this.game.renderer.render();
    }
}

// グローバルオブジェクトにクラスを登録
window.VigorEffects = VigorEffects; 