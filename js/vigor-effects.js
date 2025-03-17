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
                    //{ type: 'forceDescend', weight: 10 },
                    { type: 'forgetAllTiles', weight: 25 },
                    //{ type: 'randomTeleport', weight: 10 },
                    { type: 'pauseAndShift', weight: 40},
                    { type: 'forgetSomeTiles', weight: 35 }
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
                { type: 'forgetSomeTiles', weight: 40 },
                //{ type: 'randomTeleport', weight: 10 },
                { type: 'pauseAndShift', weight: 40 },
                { type: 'forgetAllTiles', weight: 20 },
            ],
            'Critical': [
                { type: 'forgetAllTiles', weight: 25 },
                { type: 'forgetSomeTiles', weight: 35 },
                //{ type: 'randomTeleport', weight: 10 },
                //{ type: 'forceDescend', weight: 5},
                { type: 'pauseAndShift', weight: 40}
            ]
        };

        // severityが'positive'の場合は常にnullを返す
        if (severity === 'positive') {
            console.log("Positive vigor effects have been disabled.");
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

        // vigor効果発生の通知
        if (this.game && typeof this.game.onVigorEffectOccurred === 'function') {
            this.game.onVigorEffectOccurred();
        }

        // エフェクト適用時のコンソールログを追加
        console.log(`Applying vigor effect: ${effect.type}`);

        // エフェクト適用時に入力状態をリセット
        this.game.player.stopAllAutoMovement();

        // 入力を無効化するフラグを設定
        this.game.inputDisabled = true;
        
        // エフェクト発動前に1秒のフリーズを追加
        this.game.logger.add("A strange sensation washes over you...", "warning");
        
        // 1秒後にエフェクトを実際に適用
        setTimeout(() => {
            // 入力を再度有効化
            this.game.inputDisabled = false;
            
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
                
                // 一時的な瞑想状態
                this.game.player.meditation = {
                    active: true,
                    soundStarted: false,
                    healPerTurn: Math.floor(this.game.player.stats.wis / 3),
                    turnsRemaining: 1,  // 1ターンだけ
                    totalHealed: 0,
                    vigorEffectMeditation: true,  // vigorエフェクトによる瞑想であることを示すフラグ
                    cannotCancelByInput: true     // 入力によるキャンセルを防止するフラグ
                };
                
                this.game.logger.add("You enter a brief meditative state.", "warning");
                
                // 瞑想処理を呼び出す
                this.game.processMeditation();
                
                // サウンド再生前に少し遅延を入れる
                setTimeout(() => {
                    console.log('Starting meditation sound for pauseAndShift effect');
                    this.game.soundManager.playSound('meditationSound', false, true);
                    
                    // 再生開始時刻を記録
                    const soundStartTime = Date.now();
                    
                    // 2秒後に瞑想サウンドを停止する
                    setTimeout(() => {
                        // 実際の経過時間を計算
                        const elapsedTime = (Date.now() - soundStartTime) / 1000;
                        console.log(`Actual meditation sound duration: ${elapsedTime.toFixed(2)} seconds`);
                        
                        // 瞑想状態が終了していない場合でも、サウンドを停止する
                        this.game.soundManager.stopSound('meditationSound');
                        console.log('Stopping meditation sound after pauseAndShift effect (2 seconds)');
                        
                        // 瞑想状態が残っている場合は明示的にnullに設定
                        if (this.game.player.meditation && this.game.player.meditation.vigorEffectMeditation) {
                            this.game.player.meditation = null;
                            this.game.logger.add("The strange sensation passes.", "playerInfo");
                            this.game.renderer.render();
                        }
                    }, 2000); // 2秒後に確実に停止
                }, 100); // サウンド再生前に100ms遅延
                this.game.processTurn();
                break;

            case 'forceDescend':
                console.log('Executing forceDescend effect');
                this.game.logger.add("Your exhaustion forces you downward!", "warning");
                this.game.renderer.startPortalTransition(() => {
                    this.game.floorLevel++;
                    this.game.generateNewFloor();
                    this.game.soundManager.updateBGM();
                    this.game.logger.add(`You descend to floor ${this.game.floorLevel}...`, "warning");
                });
                this.game.soundManager.playPortalSound();
                this.game.processTurn();
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
                            // 6. 階段ではない
                            // 7. ポータルではない
                            // 8. ニューラルオベリスクではない（追加）
                            if (this.game.map[ty][tx] === 'floor' && 
                                !this.game.getMonsterAt(tx, ty) &&
                                !(tx === this.game.player.x && ty === this.game.player.y) &&
                                !GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.game.tiles[ty][tx]) &&
                                !GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(this.game.tiles[ty][tx]) &&
                                this.game.tiles[ty][tx] !== GAME_CONSTANTS.STAIRS.CHAR &&
                                this.game.tiles[ty][tx] !== GAME_CONSTANTS.PORTAL.GATE.CHAR &&
                                this.game.tiles[ty][tx] !== GAME_CONSTANTS.NEURAL_OBELISK.CHAR) { // ニューラルオベリスクを避ける
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
                            GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.game.tiles[y][x]) ||
                            this.game.tiles[y][x] === GAME_CONSTANTS.NEURAL_OBELISK.CHAR); // ニューラルオベリスクを避ける
                    }

                    this.game.player.x = x;
                    this.game.player.y = y;
                    this.game.renderer.render();
                });
                this.game.soundManager.playPortalSound();
                this.game.processTurn();
                break;

            case 'forgetAllTiles':
                console.log('Executing forgetAllTiles effect');
                this.game.logger.add("Your memory fades completely...", "warning");
                
                for (let y = 0; y < this.game.height; y++) {
                    for (let x = 0; x < this.game.width; x++) {
                        if (!this.game.getVisibleTiles().some(({ x: visibleX, y: visibleY }) => visibleX === x && visibleY === y)) {
                            this.game.explored[y][x] = false;
                        }
                    }
                }
                this.game.playSound('vigorDownSound');
                this.game.processTurn();
                if (this.game.renderer && this.game.renderer.effects) {
                    this.game.renderer.effects.refreshAfterVigorEffect();
                }
                break;

            case 'forgetSomeTiles':
                console.log('Executing forgetSomeTiles effect');
                this.game.logger.add("Your memory becomes hazy...", "warning");
                
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
                this.game.processTurn();
                if (this.game.renderer && this.game.renderer.effects) {
                    this.game.renderer.effects.refreshAfterVigorEffect();
                }
                break;

            default:
                console.warn(`Unknown vigor effect type: ${effect.type}`);
                break;
        }
        this.game.renderer.render();
    }
}

// グローバルオブジェクトにクラスを登録
window.VigorEffects = VigorEffects; 