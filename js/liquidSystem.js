/**
 * 液体システム
 * ゲーム内の液体（血液、水、毒、油など）の物理法則を管理するクラス
 */
class LiquidSystem {
    /**
     * コンストラクタ
     * @param {Game} game - ゲームインスタンス 
     */
    constructor(game) {
        this.game = game;
        this.liquids = {
            blood: [], // 血液
            oil: []    // オイル（メカニカルモンスターから漏れる可燃性液体）
            // 将来的に他の液体タイプを追加可能
            // water: [],  // 水
            // poison: [], // 毒
            // acid: []    // 酸
        };
    }

    /**
     * 液体を初期化（新しいフロア生成時など）
     * @param {string} type - 液体タイプ（デフォルトは全タイプ）
     */
    reset(type = null) {
        if (type) {
            // 特定の液体タイプのみリセット
            const lowerType = type.toLowerCase();
            if (this.liquids[lowerType]) {
                this.liquids[lowerType] = [];
            }
        } else {
            // すべての液体タイプをリセット
            for (const liquidType in this.liquids) {
                this.liquids[liquidType] = [];
            }
        }
    }

    /**
     * 液体を追加
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} type - 液体タイプ
     * @param {number} severity - 液体の深さ/重要度（1-3）
     * @param {number|null} volume - 液体の量（明示的に指定する場合）
     * @returns {boolean} - 追加に成功したかどうか
     */
    addLiquid(x, y, type, severity, volume = null) {
        // 液体タイプを小文字に変換
        const lowerType = type.toLowerCase();
        
        // マップが有効でない場合は処理しない
        if (!this.game.map || !this.game.map[y] || !this.game.map[y][x] || this.game.map[y][x] !== 'floor') {
            return false;
        }
        
        // 壁タイルには液体を置かない（追加のチェック）
        if (this.game.tiles && this.game.tiles[y] && 
            GAME_CONSTANTS.TILES.WALL.includes(this.game.tiles[y][x])) {
            return false;
        }
        
        // 階段の上には液体を置かない
        if (this.game.tiles && this.game.tiles[y] && this.game.tiles[y][x] === GAME_CONSTANTS.STAIRS.CHAR) {
            return false;
        }

        // 閉じたドアの上には液体を置かない
        if (this.game.tiles && this.game.tiles[y] && this.game.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
            return false;
        }

        // 液体タイプが存在するか確認
        if (!this.liquids[lowerType]) {
            console.error(`未定義の液体タイプ: ${lowerType}`);
            return false;
        }

        // 特定の液体タイプの相互作用を処理
        this.handleLiquidInteractions(x, y, lowerType);

        // 液体の量を決定
        let liquidAmount = this.calculateLiquidAmount(type, severity, volume);
        
        // 液体の設定を取得
        const liquidSettings = GAME_CONSTANTS.LIQUIDS[type.toUpperCase()];
        
        // 微量の液体は処理しない（最小値未満は無視）
        if (liquidAmount < liquidSettings.VOLUME.MINIMUM) {
            return false;
        }

        // 既存の液体を検索
        const existingLiquid = this.liquids[lowerType].find(l => l.x === x && l.y === y);

        if (existingLiquid) {
            // 既存の液体がある場合、液体量を追加して重症度を更新
            const oldVolume = existingLiquid.volume || 0;
            const newVolume = oldVolume + liquidAmount;
            
            // 新しい総量が最小値未満なら液体を削除して終了
            if (newVolume < liquidSettings.VOLUME.MINIMUM) {
                this.liquids[lowerType] = this.liquids[lowerType].filter(l => !(l.x === x && l.y === y));
                return false;
            }
            
            existingLiquid.volume = newVolume;

            // 液体量に応じて重症度を決定
            const newSeverity = this.calculateSeverityFromVolume(type, newVolume);
            if (newSeverity > existingLiquid.severity) {
                existingLiquid.severity = newSeverity;

                // 液体の重症度が上がったときにエフェクトを表示
                this.showLiquidEffect(type, x, y, newSeverity);
            }

            // 液体量が限界を超えた場合、周囲のタイルに溢れる
            this.handleOverflow(type, x, y, newVolume);
        } else {
            // 新しい液体を追加
            this.liquids[lowerType].push({
                x: x,
                y: y,
                severity: severity,
                volume: liquidAmount
            });

            // 液体量が限界を超えた場合、周囲のタイルに溢れる
            this.handleOverflow(type, x, y, liquidAmount);

            // 新しい液体が作成されたときにエフェクトを表示
            this.showLiquidEffect(type, x, y, severity);
        }

        return true;
    }

    /**
     * 液体の量を計算
     * @param {string} type - 液体タイプ
     * @param {number} severity - 液体の深さ/重要度（1-3）
     * @param {number|null} volume - 液体の量（明示的に指定する場合）
     * @returns {number} - 計算された液体量
     */
    calculateLiquidAmount(type, severity, volume = null) {
        if (volume !== null) {
            return volume;
        }

        // 液体タイプと重症度に基づいて量を取得
        const liquidSettings = GAME_CONSTANTS.LIQUIDS[type.toUpperCase()];
        if (!liquidSettings) {
            return 0;
        }

        switch (severity) {
            case 3:
                return liquidSettings.VOLUME.AMOUNT.HEAVY;
            case 2:
                return liquidSettings.VOLUME.AMOUNT.MEDIUM;
            case 1:
            default:
                return liquidSettings.VOLUME.AMOUNT.LIGHT;
        }
    }

    /**
     * 液体量から重症度を計算
     * @param {string} type - 液体タイプ
     * @param {number} volume - 液体の量
     * @returns {number} - 計算された重症度（1-3）
     */
    calculateSeverityFromVolume(type, volume) {
        const liquidSettings = GAME_CONSTANTS.LIQUIDS[type.toUpperCase()];
        if (!liquidSettings) {
            return 1;
        }

        if (volume >= liquidSettings.VOLUME.THRESHOLD.HEAVY) {
            return 3;
        } else if (volume >= liquidSettings.VOLUME.THRESHOLD.MEDIUM) {
            return 2;
        } else {
            return 1;
        }
    }

    /**
     * 液体のオーバーフロー処理
     * @param {string} type - 液体タイプ
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} totalVolume - 総液体量
     */
    handleOverflow(type, x, y, totalVolume) {
        const lowerType = type.toLowerCase();
        const liquidSettings = GAME_CONSTANTS.LIQUIDS[type.toUpperCase()];
        if (!liquidSettings) {
            return;
        }

        const capacity = liquidSettings.VOLUME.TILE_CAPACITY;

        // 容量を超えていない場合は何もしない
        if (totalVolume <= capacity) return;

        // 溢れる量を計算
        const excessVolume = totalVolume - capacity;
        const overflowVolume = excessVolume * liquidSettings.VOLUME.OVERFLOW_RATIO;

        // 現在のタイルの液体量を調整
        const liquid = this.liquids[lowerType].find(l => l.x === x && l.y === y);
        if (liquid) {
            liquid.volume = capacity - (excessVolume - overflowVolume);
        }

        // 周囲の床タイルを取得
        const adjacentTiles = this.getAdjacentFloorTiles(x, y);

        // 周囲のタイルがない場合は処理を終了
        if (adjacentTiles.length === 0) return;

        // 各タイルに均等に液体を分配
        const volumePerTile = overflowVolume / adjacentTiles.length;
        
        // 分配される液体量が最小値未満なら溢れない
        if (volumePerTile < liquidSettings.VOLUME.MINIMUM) {
            return;
        }

        // 液体を周囲のタイルに追加
        for (const tile of adjacentTiles) {
            const severity = this.calculateSeverityFromVolume(type, volumePerTile);
            this.addLiquid(tile.x, tile.y, type, severity, volumePerTile);
        }
    }

    /**
     * 通過による液体の移動
     * @param {string} type - 液体タイプ
     * @param {number} fromX - 移動元X座標
     * @param {number} fromY - 移動元Y座標
     * @param {number} toX - 移動先X座標
     * @param {number} toY - 移動先Y座標
     * @returns {boolean} - 移動が行われたかどうか
     */
    transferLiquid(type, fromX, fromY, toX, toY) {
        // 液体タイプを小文字に変換
        const lowerType = type.toLowerCase();
        
        // 移動元に液体があるかチェック
        const sourceLiquid = this.liquids[lowerType].find(l => l.x === fromX && l.y === fromY);
        if (!sourceLiquid) {
            return false; // 液体がなければ何もしない
        }

        // 移動先が有効な床タイルであることを確認
        if (!this.game.isValidPosition(toX, toY) || this.game.map[toY][toX] !== 'floor') {
            return false;
        }

        // 移動先が壁タイルでないことを確認
        if (this.game.tiles && GAME_CONSTANTS.TILES.WALL.includes(this.game.tiles[toY][toX])) {
            return false;
        }

        // 移動先が閉じたドアの場合は移動しない
        if (this.game.tiles && this.game.tiles[toY] && this.game.tiles[toY][toX] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
            return false;
        }

        // 液体の転移率を取得
        const liquidSettings = GAME_CONSTANTS.LIQUIDS[type.toUpperCase()];
        const transferRate = liquidSettings ? liquidSettings.TRANSFER_RATE : 0.3;

        // 移動元の液体の量を減らす
        const transferAmount = sourceLiquid.volume * transferRate;
        
        // 転移量が最小値未満なら転移しない
        if (transferAmount < liquidSettings.VOLUME.MINIMUM) {
            return false;
        }
        
        sourceLiquid.volume -= transferAmount;

        // 移動元の液体の量が少なくなりすぎたら消滅
        if (sourceLiquid.volume < liquidSettings.VOLUME.MINIMUM) {
            this.liquids[lowerType] = this.liquids[lowerType].filter(l => !(l.x === fromX && l.y === fromY));
        } else {
            // 重症度を再計算
            sourceLiquid.severity = this.calculateSeverityFromVolume(type, sourceLiquid.volume);
        }

        // 移動先に液体を追加（最小値チェックはaddLiquidメソッド内で行われる）
        const severity = this.calculateSeverityFromVolume(type, transferAmount);
        this.addLiquid(toX, toY, type, severity, transferAmount);

        return true;
    }

    /**
     * 液体による相互作用を処理
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} type - 液体タイプ
     */
    handleLiquidInteractions(x, y, type) {
        // 全ての液体タイプに対してwebとの相互作用を処理
        this.handleWebInteraction(x, y);
        
        // 液体タイプに基づいた追加の相互作用を処理
        switch (type) {
            case 'blood':
                // 血液固有の追加相互作用があれば処理
                break;
            // 将来的に他の液体タイプの相互作用を追加
            // case 'water':
            //    this.handleWaterInteractions(x, y);
            //    break;
            // case 'acid':
            //    this.handleAcidInteractions(x, y);
            //    break;
        }
    }

    /**
     * ウェブ（蜘蛛の巣）との相互作用を処理
     * @param {number} x - X座標
     * @param {number} y - Y座標 
     */
    handleWebInteraction(x, y) {
        // 蜘蛛の巣との相互作用
        if (!this.game.webs) {
            this.game.webs = [];
            return;
        }
        
        const webIndex = this.game.webs.findIndex(web => web.x === x && web.y === y);
        if (webIndex !== -1) {
            // 蜘蛛の巣を消去
            this.game.webs.splice(webIndex, 1);

            // プレイヤーが捕まっていた場合は解放
            if (this.game.player.caughtInWeb && 
                this.game.player.caughtInWeb.x === x && 
                this.game.player.caughtInWeb.y === y) {
                this.game.player.caughtInWeb = null;
                this.game.logger.add('The liquid dissolves the web, freeing you!', 'important');
            }

            // 捕まっていたモンスターを解放
            const monster = this.game.getMonsterAt(x, y);
            if (monster && monster.caughtInWeb) {
                monster.caughtInWeb = false;
                this.game.logger.add(`The liquid dissolves the web, freeing ${monster.name}!`, 'monsterInfo');
            }

            // エフェクトを表示
            const isVisible = this.game.getVisibleTiles().some(tile => tile.x === x && tile.y === y);
            if (isVisible) {
                this.game.logger.add('The liquid dissolves the web!', 'info');
            }
        }
    }

    /**
     * 液体効果の表示処理
     * @param {string} type - 液体タイプ
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} severity - 液体の深さ/重要度（1-3）
     */
    showLiquidEffect(type, x, y, severity) {
        const isVisible = this.game.getVisibleTiles().some(tile => tile.x === x && tile.y === y);
        if (!isVisible || !this.game.renderer) {
            return;
        }

        // 液体タイプに応じたエフェクト表示
        switch (type) {
            case 'blood':
                this.game.renderer.showBloodpoolEffect(x, y, severity);
                break;
            // 将来的に他の液体タイプのエフェクトを追加
            // case 'water':
            //    this.game.renderer.showWaterEffect(x, y, severity);
            //    break;
        }
    }

    /**
     * 隣接する床タイルを取得
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @returns {Array} - 隣接する床タイルの配列
     */
    getAdjacentFloorTiles(x, y) {
        const adjacentTiles = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue; // 自分自身は除外

                const nx = x + dx;
                const ny = y + dy;

                // マップ内で、床タイルであれば追加
                if (this.game.isValidPosition(nx, ny) && this.game.map[ny][nx] === 'floor') {
                    // 閉じたドアのタイルは除外
                    if (this.game.tiles && this.game.tiles[ny][nx] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                        continue;
                    }
                    
                    // 壁タイルも除外
                    if (this.game.tiles && GAME_CONSTANTS.TILES.WALL.includes(this.game.tiles[ny][nx])) {
                        continue;
                    }
                    
                    adjacentTiles.push({x: nx, y: ny});
                }
            }
        }
        return adjacentTiles;
    }

    /**
     * 液体の更新処理（ターン経過による変化など）
     * @param {string} type - 液体タイプ（デフォルトは全タイプ）
     */
    update(type = null) {
        if (type) {
            // 特定の液体タイプのみ更新
            const lowerType = type.toLowerCase();
            if (this.liquids[lowerType]) {
                this.updateLiquidType(lowerType);
            }
        } else {
            // すべての液体タイプを更新
            for (const liquidType in this.liquids) {
                this.updateLiquidType(liquidType);
            }
        }
    }

    /**
     * 特定タイプの液体の更新処理
     * @param {string} type - 液体タイプ
     */
    updateLiquidType(type) {
        // 液体タイプに固有の更新処理
        // 例：蒸発、凍結、化学反応など
        const liquidSettings = GAME_CONSTANTS.LIQUIDS[type.toUpperCase()];
        if (!liquidSettings || !liquidSettings.EVAPORATION_RATE) {
            return; // 設定がない場合は何もしない
        }

        // 液体の自然消滅の処理（必要な場合）
        // 例：あまり発生しない血液の自然消滅はコメントアウト
        /*
        this.liquids[type] = this.liquids[type].filter(liquid => {
            // remainingTurnsプロパティがない場合は初期化
            if (liquid.remainingTurns === undefined) {
                const baseDuration = liquidSettings.DURATION.BASE;
                let durationFactor = liquidSettings.DURATION.SEVERITY_FACTOR.LIGHT;
                
                if (liquid.severity === 3) {
                    durationFactor = liquidSettings.DURATION.SEVERITY_FACTOR.HEAVY;
                } else if (liquid.severity === 2) {
                    durationFactor = liquidSettings.DURATION.SEVERITY_FACTOR.MEDIUM;
                }
                
                liquid.remainingTurns = Math.round(baseDuration * durationFactor);
            }
            
            liquid.remainingTurns--;
            return liquid.remainingTurns > 0;
        });
        */
    }

    /**
     * 特定位置の液体を取得
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} type - 液体タイプ（指定しない場合は最初に見つかった液体）
     * @returns {Object|null} - 液体オブジェクトまたはnull
     */
    getLiquidAt(x, y, type = null) {
        if (type) {
            // 特定の液体タイプを検索
            const lowerType = type.toLowerCase();
            return this.liquids[lowerType] ? this.liquids[lowerType].find(l => l.x === x && l.y === y) : null;
        } else {
            // すべての液体タイプから検索
            for (const liquidType in this.liquids) {
                const liquid = this.liquids[liquidType].find(l => l.x === x && l.y === y);
                if (liquid) {
                    return { ...liquid, type: liquidType };
                }
            }
            return null;
        }
    }

    /**
     * 特定タイプの液体のリストを取得
     * @param {string} type - 液体タイプ
     * @returns {Array} - 液体オブジェクトの配列
     */
    getLiquids(type) {
        const lowerType = type.toLowerCase();
        return this.liquids[lowerType] || [];
    }

    /**
     * 液体による効果を適用
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {Object} entity - プレイヤーまたはモンスター
     */
    applyLiquidEffects(x, y, entity) {
        // 冷却液による移動速度減少効果
        const coolant = this.getLiquidAt(x, y, 'coolant');
        if (coolant) {
            this.applyCoolantEffects(entity, coolant);
        }
        
        // 他の液体効果もここに追加可能
        // 例：酸による継続ダメージ、油による滑り効果など
    }

    /**
     * オイルによる効果を適用
     * @param {Object} entity - プレイヤーまたはモンスター
     * @param {Object} oil - オイルオブジェクト
     */
    applyOilEffects(entity, oil) {
        // オイルによる移動速度減少と滑り効果を設定
        if (!entity.oilEffects) {
            entity.oilEffects = {
                movementSlow: true,
                severity: oil.severity,
                duration: 4 // 4ターン持続
            };
            
            // ログ表示
            if (entity === this.game.player) {
                this.game.logger.add('The oil makes you slip and slows your movement!', 'warning');
            } else {
                const isVisible = this.game.getVisibleTiles().some(tile => 
                    tile.x === entity.x && tile.y === entity.y);
                if (isVisible) {
                    this.game.logger.add(`${entity.name} is slowed by the oil!`, 'monsterInfo');
                }
            }
        } else {
            // 既存の効果を更新
            entity.oilEffects.severity = Math.max(entity.oilEffects.severity, oil.severity);
            entity.oilEffects.duration = 4; // 期間をリセット
        }
        
        // 滑り判定
        const slipChance = GAME_CONSTANTS.LIQUIDS.OIL.EFFECTS.SLIP_CHANCE * oil.severity;
        if (Math.random() < slipChance) {
            // 滑って移動がスキップされる可能性
            if (entity === this.game.player) {
                this.game.logger.add('You slip on the oil!', 'warning');
            } else {
                const isVisible = this.game.getVisibleTiles().some(tile => 
                    tile.x === entity.x && tile.y === entity.y);
                if (isVisible) {
                    this.game.logger.add(`${entity.name} slips on the oil!`, 'monsterInfo');
                }
            }
            return true; // 滑って移動失敗
        }
        return false; // 正常に移動
    }

    /**
     * 液体とガスの相互作用処理（拡張版）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    handleLiquidGasInteraction(x, y) {
        // オイルと火炎ガスの相互作用（発火）
        const oil = this.getLiquidAt(x, y, 'oil');
        const fireGas = this.game.gasSystem.getGasAt(x, y, 'fire_gas');
        
        if (oil && fireGas) {
            const oilSettings = GAME_CONSTANTS.LIQUIDS.OIL;
            const ignitionChance = oilSettings.INTERACTIONS.FIRE_GAS.IGNITION_CHANCE;
            
            if (Math.random() < ignitionChance) {
                // オイルが発火
                const amplification = oilSettings.INTERACTIONS.FIRE_GAS.AMPLIFICATION;
                
                // 火炎ガスを拡大
                fireGas.volume *= amplification;
                fireGas.density = this.game.gasSystem.calculateDensityFromVolume('fire_gas', fireGas.volume);
                
                // 周囲に追加の火炎ガスを発生
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const newX = x + dx;
                        const newY = y + dy;
                        if (newX >= 0 && newX < GAME_CONSTANTS.DIMENSIONS.WIDTH && 
                            newY >= 0 && newY < GAME_CONSTANTS.DIMENSIONS.HEIGHT) {
                            this.game.gasSystem.addGas(newX, newY, 'fire_gas', 1);
                        }
                    }
                }
                
                // オイルを消費
                oil.volume *= 0.3; // 70%消費
                if (oil.volume < GAME_CONSTANTS.LIQUIDS.OIL.VOLUME.MINIMUM) {
                    this.liquids.oil = this.liquids.oil.filter(l => !(l.x === x && l.y === y));
                } else {
                    // 重症度を再計算
                    oil.severity = this.calculateSeverityFromVolume('oil', oil.volume);
                }
                
                // エフェクト表示
                const isVisible = this.game.getVisibleTiles().some(tile => tile.x === x && tile.y === y);
                if (isVisible) {
                    this.game.logger.add('Oil ignites in a burst of flames!', 'warning');
                    this.game.playSound('caution');
                }
            }
        }
        
        // ★★★ 火炎ガスと瘴気の相互作用（瘴気爆発） ★★★
        this.game.gasSystem.checkFireMiasmaExplosion(x, y);
    }

} 