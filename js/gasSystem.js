/**
 * ガスシステム
 * ゲーム内のガス（瘴気、煙、毒ガスなど）の拡散と減衰を管理するクラス
 */
class GasSystem {
    /**
     * コンストラクタ
     * @param {Game} game - ゲームインスタンス 
     */
    constructor(game) {
        this.game = game;
        this.gases = {
            miasma: [],
            fire_gas: []        // 火炎ガス
            // 将来的に他のガスタイプを追加可能
            // smoke: [],
            // poison: [],
            // steam: [],
        };
    }

    /**
     * ガスを初期化（新しいフロア生成時など）
     * @param {string} type - ガスタイプ（デフォルトは全タイプ）
     */
    reset(type = null) {
        if (type) {
            // 特定のガスタイプのみリセット
            const lowerType = type.toLowerCase();
            if (this.gases[lowerType]) {
                this.gases[lowerType] = [];
            }
        } else {
            // すべてのガスタイプをリセット
            for (const gasType in this.gases) {
                this.gases[gasType] = [];
            }
        }
    }

    /**
     * ガスを追加する
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} type - ガスタイプ
     * @param {number} density - 密度
     * @param {number} volume - 量（省略可）
     */
    addGas(x, y, type, density, volume = null) {
        const lowerType = type.toLowerCase();
        
        if (!this.gases[lowerType]) {
            this.gases[lowerType] = [];
        }
        
        // 既存のガスがある場合は合成
        const existingGas = this.gases[lowerType].find(gas => gas.x === x && gas.y === y);
        if (existingGas) {
            existingGas.volume += volume || this.calculateVolumeFromDensity(lowerType, density);
            existingGas.density = Math.min(3, this.calculateDensityFromVolume(lowerType, existingGas.volume));
        } else {
            // 新しいガスを作成
            const newGas = {
                x: x,
                y: y,
                density: Math.min(3, density),
                volume: volume || this.calculateVolumeFromDensity(lowerType, density),
                duration: this.calculateDuration(lowerType, density)
            };
            
            this.gases[lowerType].push(newGas);
        }
        
        // ★★★ 火炎ガスの場合、隣接タイルにも軽微な火炎ガスを拡散 ★★★
        if (lowerType === 'fire_gas' && density >= 2) { // 密度2以上の場合のみ
            this.spreadFireGasToAdjacent(x, y, density);
        }
    }

    /**
     * ガスの量を計算
     * @param {string} type - ガスタイプ
     * @param {number} density - ガスの濃度（1-3）
     * @param {number|null} volume - ガスの量（明示的に指定する場合）
     * @returns {number} - 計算されたガス量
     */
    calculateGasAmount(type, density, volume = null) {
        if (volume !== null) {
            return volume;
        }

        // ガスタイプと濃度に基づいて量を取得
        const gasSettings = GAME_CONSTANTS.GASES[type.toUpperCase()];
        if (!gasSettings) {
            return 0;
        }

        switch (density) {
            case 3:
                return gasSettings.VOLUME.AMOUNT.HEAVY;
            case 2:
                return gasSettings.VOLUME.AMOUNT.MEDIUM;
            case 1:
            default:
                return gasSettings.VOLUME.AMOUNT.LIGHT;
        }
    }

    /**
     * 密度からガス量を計算
     * @param {string} type - ガスタイプ
     * @param {number} density - 密度
     * @returns {number} - ガス量
     */
    calculateVolumeFromDensity(type, density) {
        const gasSettings = GAME_CONSTANTS.GASES[type.toUpperCase()];
        if (!gasSettings) return 0.5;
        
        switch (density) {
            case 3: return gasSettings.VOLUME.AMOUNT.HEAVY;
            case 2: return gasSettings.VOLUME.AMOUNT.MEDIUM;
            case 1:
            default: return gasSettings.VOLUME.AMOUNT.LIGHT;
        }
    }

    /**
     * ガス量から濃度を計算
     * @param {string} type - ガスタイプ
     * @param {number} volume - ガスの量
     * @returns {number} - 計算された濃度（1-3）
     */
    calculateDensityFromVolume(type, volume) {
        const gasSettings = GAME_CONSTANTS.GASES[type.toUpperCase()];
        if (!gasSettings) {
            return 1;
        }

        if (volume >= gasSettings.VOLUME.THRESHOLD.HEAVY) {
            return 3;
        } else if (volume >= gasSettings.VOLUME.THRESHOLD.MEDIUM) {
            return 2;
        } else {
            return 1;
        }
    }

    /**
     * ガスの拡散処理
     * @param {string} type - ガスタイプ
     */
    diffuseGas(type) {
        const lowerType = type.toLowerCase();
        const gases = [...this.gases[lowerType]]; // 元の配列のコピーを作成
        const gasSettings = GAME_CONSTANTS.GASES[type.toUpperCase()];
        
        if (!gasSettings || gases.length === 0) {
            return;
        }
        
        // 各ガスについて拡散処理
        gases.forEach(gas => {
            // 濃度が高いほど拡散しやすい
            const diffusionChance = gasSettings.DIFFUSION.BASE_CHANCE * 
                gasSettings.DIFFUSION.DENSITY_FACTOR[`LEVEL_${gas.density}`];
            
            // 拡散するかどうかランダムに決定
            if (Math.random() < diffusionChance) {
                // 拡散量を計算
                const diffusionAmount = gas.volume * gasSettings.DIFFUSION.RATE;
                
                // 拡散先が十分なガス量を持てるかチェック
                if (diffusionAmount < gasSettings.VOLUME.MINIMUM) {
                    return; // 拡散量が少なすぎる場合はスキップ
                }
                
                // 元のガスの量を減らす
                gas.volume -= diffusionAmount;
                
                // ガス量が最小値未満になった場合は削除
                if (gas.volume < gasSettings.VOLUME.MINIMUM) {
                    this.gases[lowerType] = this.gases[lowerType].filter(g => 
                        !(g.x === gas.x && g.y === gas.y));
                    return;
                }
                
                // 拡散先を決定（隣接するランダムな床タイル）
                const adjacentTiles = this.getAdjacentFloorTiles(gas.x, gas.y);
                
                if (adjacentTiles.length === 0) {
                    return; // 拡散先がない場合はスキップ
                }
                
                // ランダムな隣接タイルを選択
                const targetTile = adjacentTiles[Math.floor(Math.random() * adjacentTiles.length)];
                
                // 選択したタイルにガスを拡散
                const newDensity = this.calculateDensityFromVolume(type, diffusionAmount);
                this.addGas(targetTile.x, targetTile.y, type, newDensity, diffusionAmount);
            }
        });
    }

    /**
     * ガスの更新処理（ターン経過による減衰と拡散）
     * @param {string} type - ガスタイプ（デフォルトは全タイプ）
     */
    update(type = null) {
        if (type) {
            // 特定のガスタイプのみ更新
            const lowerType = type.toLowerCase();
            if (this.gases[lowerType]) {
                this.updateGasType(lowerType);
                this.diffuseGas(lowerType);
            }
        } else {
            // すべてのガスタイプを更新
            for (const gasType in this.gases) {
                this.updateGasType(gasType);
                this.diffuseGas(gasType);
            }
        }
        
        // ★★★ 火炎ガスから隣接家具への延焼処理を追加 ★★★
        this.processFireGasIgnition();
        
        // ★★★ 燃焼家具の更新処理を追加 ★★★
        this.updateBurningFurniture();
    }

    /**
     * 特定タイプのガスの更新処理（減衰）
     * @param {string} type - ガスタイプ
     */
    updateGasType(type) {
        const gasSettings = GAME_CONSTANTS.GASES[type.toUpperCase()];
        if (!gasSettings) {
            return;
        }

        // ガスの減衰処理
        this.gases[type] = this.gases[type].filter(gas => {
            // 持続時間を減少
            gas.duration--;
            
            // 持続時間が0になったらガスを削除
            if (gas.duration <= 0) {
                return false;
            }
            
            // 自然減衰によるガス量の減少
            gas.volume *= (1 - gasSettings.DECAY_RATE);
            
            // 濃度を再計算
            gas.density = this.calculateDensityFromVolume(type, gas.volume);
            
            // 最小量未満になった場合は削除
            if (gas.volume < gasSettings.VOLUME.MINIMUM) {
                return false;
            }
            
            return true;
        });
    }

    /**
     * 血液からの瘴気発生処理
     */
    generateMiasmaFromBlood() {
        // 血液関連の設定を取得
        if (!this.game.liquidSystem || !GAME_CONSTANTS.GASES.MIASMA) {
            return;
        }
        
        const bloodPools = this.game.liquidSystem.getLiquids('blood');
        const miasmaSettings = GAME_CONSTANTS.GASES.MIASMA;
        
        // 各血液プールについて処理
        bloodPools.forEach(blood => {
            // 新しく追加：血液の「年齢」をチェック（何ターン経過したか）
            if (!blood.age) {
                blood.age = 1;
                return; // 新鮮な血液からは瘴気を発生させない
            } else {
                blood.age++;
                
                // 一定の年齢（例：5ターン）未満の血液は瘴気発生確率を低くする
                if (blood.age < 5) {
                    return; // 若すぎる血液からは瘴気を発生させない
                }
            }
            
            // 瘴気が発生する確率（血液の量と重症度に依存）
            const generationChance = (miasmaSettings.GENERATION.BASE_CHANCE * 0.5) * // 基本確率を半分に
                miasmaSettings.GENERATION.SEVERITY_FACTOR[`LEVEL_${blood.severity}`];
            
            // 瘴気を発生させるかランダムに決定
            if (Math.random() < generationChance) {
                // 発生する瘴気の量を計算（生成率を1/3に削減）
                const miasmaAmount = blood.volume * (miasmaSettings.GENERATION.RATE / 3);
                
                // 最小量以上の瘴気が発生する場合のみ処理
                if (miasmaAmount >= miasmaSettings.VOLUME.MINIMUM) {
                    // 瘴気の濃度を決定
                    const miasmaDensity = this.calculateDensityFromVolume('miasma', miasmaAmount);
                    
                    // 瘴気を追加
                    this.addGas(blood.x, blood.y, 'miasma', miasmaDensity, miasmaAmount);
                }
            }
        });
    }

    /**
     * ガス持続時間の計算
     * @param {string} type - ガスタイプ
     * @param {number} density - 密度
     * @returns {number} - 持続時間
     */
    calculateDuration(type, density) {
        try {
            const gasSettings = GAME_CONSTANTS.GASES[type.toUpperCase()];
            if (!gasSettings || !gasSettings.DURATION) {
                console.warn(`Gas settings not found for type: ${type}`);
                return 5; // デフォルト5ターン
            }
            
            const baseDuration = gasSettings.DURATION.BASE || 5;
            const densityLevel = Math.max(1, Math.min(3, Math.floor(density) || 1)); // 1-3の範囲に制限
            const factor = gasSettings.DURATION.DENSITY_FACTOR[`LEVEL_${densityLevel}`] || 1.0;
            
            const result = Math.floor(baseDuration * factor);
            return Math.max(1, result); // 最低1ターンは保証
        } catch (error) {
            console.warn(`Error calculating duration for ${type}:`, error);
            return 5; // エラー時のデフォルト値
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
     * 特定位置のガスを取得
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} type - ガスタイプ（指定しない場合は最初に見つかったガス）
     * @returns {Object|null} - ガスオブジェクトまたはnull
     */
    getGasAt(x, y, type = null) {
        if (type) {
            // 特定のガスタイプを検索
            const lowerType = type.toLowerCase();
            return this.gases[lowerType] ? this.gases[lowerType].find(g => g.x === x && g.y === y) : null;
        } else {
            // すべてのガスタイプから検索
            for (const gasType in this.gases) {
                const gas = this.gases[gasType].find(g => g.x === x && g.y === y);
                if (gas) {
                    return { ...gas, type: gasType };
                }
            }
            return null;
        }
    }
    
    /**
     * デバッグ用：プレイヤーの位置に瘴気を強制的に生成する
     */
    debugCreateMiasmaAtPlayer() {
        if (this.game.player) {
            const x = this.game.player.x;
            const y = this.game.player.y;
            
            // 高濃度の瘴気を生成
            this.addGas(x, y, 'miasma', 3, GAME_CONSTANTS.GASES.MIASMA.VOLUME.AMOUNT.HEAVY * 2);
            
            // 周囲のタイルにも中程度の瘴気を生成
            const adjacentTiles = this.getAdjacentFloorTiles(x, y);
            adjacentTiles.forEach(tile => {
                this.addGas(tile.x, tile.y, 'miasma', 2, GAME_CONSTANTS.GASES.MIASMA.VOLUME.AMOUNT.MEDIUM);
            });
            
            console.log('デバッグ：プレイヤー位置に瘴気を生成しました');
        }
    }

    /**
     * ガスによるダメージを適用
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {Object} entity - プレイヤーまたはモンスター
     */
    applyGasDamage(x, y, entity) {
        // 各ガスタイプについてダメージを計算
        for (const gasType in this.gases) {
            const gas = this.getGasAt(x, y, gasType);
            if (gas) {
                const gasSettings = GAME_CONSTANTS.GASES[gasType.toUpperCase()];
                if (gasSettings && gasSettings.DAMAGE_PER_TURN) {
                    const damage = gasSettings.DAMAGE_PER_TURN[`LEVEL_${gas.density}`];
                    if (damage > 0) {
                        // ダメージ適用
                        entity.takeDamage(damage, { 
                            game: this.game, 
                            type: gasType,
                            isGasDamage: true 
                        });
                        
                        // ログ表示
                        if (entity === this.game.player) {
                            const gasNames = {
                                fire_gas: 'fire gas',
                                miasma: 'miasma'
                            };
                            this.game.logger.add(`You are hurt by ${gasNames[gasType] || gasType}!`, 'playerDamage');
                        } else if (entity.name) {
                            // モンスターの場合
                            const gasNames = {
                                fire_gas: 'fire gas',
                                miasma: 'miasma'
                            };
                            const isVisible = this.game.getVisibleTiles().some(tile => 
                                tile.x === entity.x && tile.y === entity.y
                            );
                            if (isVisible) {
                                this.game.logger.add(`${entity.name} is hurt by ${gasNames[gasType] || gasType}! (${damage} damage)`, 'monsterInfo');
                            }
                        }

                        // ★★★ 火炎ガスによる蜘蛛の巣消去を追加 ★★★
                        if (gasType === 'fire_gas') {
                            this.handleFireWebInteraction(x, y);
                            this.handleFurnitureIgnition(x, y, gas.density);
                        }
                    }
                }
            }
        }
    }

    // ============================= 瘴気爆発システム =============================

    /**
     * 特定位置での瘴気爆発をチェック・実行
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} triggerType - 爆発要因（'ranged_attack', 'fire', 'explosion'）
     * @param {Object} triggerSource - 爆発要因の詳細情報
     * @returns {boolean} 爆発が発生したかどうか
     */
    checkMiasmaExplosion(x, y, triggerType = 'unknown', triggerSource = null) {
        const miasma = this.getGasAt(x, y, 'miasma');
        if (!miasma) {
            return false;
        }

        // 瘴気爆発を実行（新しい爆発セッションとして開始）
        return this.triggerMiasmaExplosion(x, y, miasma, triggerType, triggerSource, new Set(), 0);
    }

    /**
     * 瘴気爆発を実行
     * @param {number} x - 爆発中心X座標
     * @param {number} y - 爆発中心Y座標
     * @param {Object} miasma - 瘴気オブジェクト
     * @param {string} triggerType - 爆発要因
     * @param {Object} triggerSource - 爆発要因の詳細
     * @param {Set} explodedPositions - 既に爆発した位置（連鎖制御用）
     * @param {number} chainDepth - 連鎖の深度
     * @returns {boolean} 爆発成功
     */
    triggerMiasmaExplosion(x, y, miasma, triggerType, triggerSource, explodedPositions = new Set(), chainDepth = 0) {
        // 連鎖深度制限（最大3回まで）
        if (chainDepth > 3) {
            return false;
        }
        
        // 既に爆発した位置かチェック
        const posKey = `${x},${y}`;
        if (explodedPositions.has(posKey)) {
            return false;
        }
        
        // 爆発位置を記録
        explodedPositions.add(posKey);
        
        const explosionRadius = Math.min(1 + Math.floor(miasma.density / 2), 2); // 最大半径2
        const baseDamage = 6 + Math.floor(miasma.density * 2); // 濃度に応じたダメージ（8-12ダメージ）
        
        // 視覚エフェクト
        const isVisible = this.game.getVisibleTiles().some(tile => tile.x === x && tile.y === y);
        if (isVisible) {
            this.game.logger.add(`Miasma explodes in a burst of flames!`, 'important');
            this.game.renderer.showMiasmaExplosion(x, y, explosionRadius, miasma.density);
            this.game.playSound('caution');
        }

        // 爆発範囲内のダメージ処理
        const affectedPositions = [];
        for (let dx = -explosionRadius; dx <= explosionRadius; dx++) {
            for (let dy = -explosionRadius; dy <= explosionRadius; dy++) {
                const targetX = x + dx;
                const targetY = y + dy;
                
                if (!this.game.isValidPosition(targetX, targetY)) continue;
                
                const distance = Math.max(Math.abs(dx), Math.abs(dy)); // チェビシェフ距離
                if (distance > explosionRadius) continue;

                // 距離によるダメージ減衰
                const distanceFactor = 1 - (distance / (explosionRadius + 1)) * 0.8; // 最大80%減衰
                const adjustedDamage = Math.max(1, Math.floor(baseDamage * distanceFactor)); // 最低1ダメージ
                
                affectedPositions.push({x: targetX, y: targetY, damage: adjustedDamage});
                
                // プレイヤーへのダメージ
                if (this.game.player.x === targetX && this.game.player.y === targetY) {
                    this.game.player.takeDamage(adjustedDamage, { 
                        game: this.game, 
                        type: 'miasma_explosion',
                        isEnvironmentalDamage: true 
                    });
                    this.game.logger.add(`You are caught in the fiery explosion! (${adjustedDamage} damage)`, 'playerDamage');
                }
                
                // モンスターへのダメージ
                const monster = this.game.getMonsterAt(targetX, targetY);
                if (monster) {
                    monster.takeDamage(adjustedDamage, { 
                        game: this.game, 
                        type: 'miasma_explosion',
                        isEnvironmentalDamage: true 
                    });
                    
                    const isMonsterVisible = this.game.getVisibleTiles().some(tile => tile.x === targetX && tile.y === targetY);
                    if (isMonsterVisible) {
                        this.game.logger.add(`${monster.name} is caught in the fiery explosion!`, 'monsterInfo');
                    }
                }
                
                // 爆発後に火炎ガスが広がる（炎の爆発イメージ）
                if (distance <= explosionRadius && distance > 0) {
                    this.addGas(targetX, targetY, 'fire_gas', 1, 0.4); // 火炎ガスが広がる
                    
                    // ★★★ 爆発による家具燃焼チェックを追加 ★★★
                    this.handleFurnitureIgnition(targetX, targetY, 2.0); // 爆発の高熱で燃焼チェック
                }
            }
        }

        // 元の瘴気を削除
        this.removeGasAt(x, y, 'miasma');
        
        // 連鎖爆発のチェック（周囲の瘴気も爆発する可能性）
        if (chainDepth < 3) { // 深度制限内でのみ連鎖
            this.checkChainExplosion(x, y, Math.max(explosionRadius, 2), explodedPositions, chainDepth + 1);
        }
        
        return true;
    }

    /**
     * 連鎖爆発をチェック
     * @param {number} centerX - 爆発中心X座標
     * @param {number} centerY - 爆発中心Y座標
     * @param {number} chainRadius - 連鎖チェック範囲
     * @param {Set} explodedPositions - 既に爆発した位置
     * @param {number} chainDepth - 連鎖の深度
     */
    checkChainExplosion(centerX, centerY, chainRadius, explodedPositions, chainDepth) {
        const chainChance = 0.2; // 20%の確率で連鎖（爆発範囲縮小に合わせて調整）
        
        for (let dx = -chainRadius; dx <= chainRadius; dx++) {
            for (let dy = -chainRadius; dy <= chainRadius; dy++) {
                if (dx === 0 && dy === 0) continue;
                
                const x = centerX + dx;
                const y = centerY + dy;
                const posKey = `${x},${y}`;
                
                if (!this.game.isValidPosition(x, y)) continue;
                if (explodedPositions.has(posKey)) continue; // 既に爆発した場所はスキップ
                
                const miasma = this.getGasAt(x, y, 'miasma');
                if (miasma && Math.random() < chainChance) {
                    // 即座に連鎖爆発（遅延なし）
                    this.triggerMiasmaExplosion(x, y, miasma, 'chain_explosion', null, explodedPositions, chainDepth);
                }
            }
        }
    }

    /**
     * 特定位置の特定ガスタイプを削除
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} type - ガスタイプ
     */
    removeGasAt(x, y, type) {
        const lowerType = type.toLowerCase();
        if (this.gases[lowerType]) {
            this.gases[lowerType] = this.gases[lowerType].filter(gas => 
                !(gas.x === x && gas.y === y)
            );
        }
    }

    /**
     * 火炎ガスから隣接家具への延焼処理
     * 毎ターン実行される時間経過による延焼システム
     */
    processFireGasIgnition() {
        const fireGases = this.gases['fire_gas'] || [];
        
        if (fireGases.length === 0) {
            return;
        }
        
        // 各火炎ガスについて隣接タイルをチェック
        for (const fireGas of fireGases) {
            const directions = [
                [-1, -1], [0, -1], [1, -1],
                [-1,  0],          [1,  0],
                [-1,  1], [0,  1], [1,  1]
            ];
            
            // 隣接する8方向をチェック
            for (const [dx, dy] of directions) {
                const targetX = fireGas.x + dx;
                const targetY = fireGas.y + dy;
                
                if (!this.game.isValidPosition(targetX, targetY)) continue;
                
                // 既に燃えているかチェック
                const alreadyBurning = this.burningFurniture?.find(f => f.x === targetX && f.y === targetY);
                if (alreadyBurning) continue;
                
                const tile = this.game.tiles[targetY][targetX];
                const map = this.game.map[targetY][targetX];
                
                // 燃えやすい家具があるかチェック
                let furnitureType = null;
                let baseIgnitionChance = 0;
                
                // ドアの場合
                if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED || tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                    furnitureType = 'door';
                    baseIgnitionChance = GAME_CONSTANTS.FLAMMABLE_OBJECTS.DOOR.BURN_CHANCE || 0.7;
                }
                // 木製障害物の場合
                else if (map === 'obstacle' && GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(tile)) {
                    furnitureType = 'obstacle';
                    baseIgnitionChance = GAME_CONSTANTS.FLAMMABLE_OBJECTS.OBSTACLE.TRANSPARENT.BURN_CHANCE || 0.6;
                }
                
                if (furnitureType) {
                    // 燃えやすい家具がない場合、または設定値が異常な場合はスキップ
                    if (!furnitureType || baseIgnitionChance <= 0 || isNaN(baseIgnitionChance)) {
                        continue;
                    }
                    
                    // 火炎ガスの密度チェック
                    if (!fireGas.density || fireGas.density <= 0 || isNaN(fireGas.density)) {
                        continue;
                    }
                    
                    // 火炎ガスの密度に応じた延焼確率を計算
                    const densityFactor = fireGas.density * 0.3;
                    const adjacentPenalty = 0.5;
                    
                    // 火炎ガスの持続時間も考慮
                    let timeExposureFactor = 1.0;
                    
                    try {
                        if (fireGas.duration !== undefined && fireGas.density !== undefined) {
                            const maxDuration = this.calculateDuration('fire_gas', fireGas.density) || 6;
                            const burnTime = Math.max(0, maxDuration - fireGas.duration);
                            
                            if (maxDuration > 0) {
                                timeExposureFactor = 1 + (burnTime / maxDuration) * 0.5;
                            }
                        }
                    } catch (error) {
                        timeExposureFactor = 1.0;
                    }
                    
                    const ignitionChance = baseIgnitionChance * densityFactor * adjacentPenalty * timeExposureFactor;
                    
                    // 延焼判定
                    if (Math.random() < ignitionChance * 0.3) {
                        this.igniteFurniture(targetX, targetY, furnitureType);
                        
                        // 延焼メッセージ
                        const isVisible = this.game.getVisibleTiles().some(tile => tile.x === targetX && tile.y === targetY);
                        if (isVisible) {
                            const furnitureNames = { door: 'door', obstacle: 'furniture' };
                            const typeName = furnitureNames[furnitureType] || 'object';
                            this.game.logger.add(`The ${typeName} catches fire from nearby flames!`, 'warning');
                        }
                    }
                }
            }
        }
    }

    /**
     * 火炎ガスからの瘴気爆発のチェック（液体ガス相互作用から呼び出し）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    checkFireMiasmaExplosion(x, y) {
        const fireGas = this.getGasAt(x, y, 'fire_gas');
        const miasma = this.getGasAt(x, y, 'miasma');
        
        if (fireGas && miasma) {
            // 火炎ガスによる瘴気爆発（確実に発生）
            this.triggerMiasmaExplosion(x, y, miasma, 'fire', fireGas, new Set(), 0);
        }
    }

    /**
     * 火炎ガスと蜘蛛の巣の相互作用処理
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    handleFireWebInteraction(x, y) {
        if (!this.game.webs) {
            this.game.webs = [];
            return;
        }
        
        const webIndex = this.game.webs.findIndex(web => web.x === x && web.y === y);
        if (webIndex !== -1) {
            // 蜘蛛の巣を燃やして消去
            this.game.webs.splice(webIndex, 1);

            // プレイヤーが捕まっていた場合は解放
            if (this.game.player.caughtInWeb && 
                this.game.player.caughtInWeb.x === x && 
                this.game.player.caughtInWeb.y === y) {
                this.game.player.caughtInWeb = null;
                this.game.logger.add('The fire burns away the web, freeing you!', 'important');
            }

            // 捕まっていたモンスターを解放
            const monster = this.game.getMonsterAt(x, y);
            if (monster && monster.caughtInWeb) {
                monster.caughtInWeb = false;
                this.game.logger.add(`The fire burns the web, freeing ${monster.name}!`, 'monsterInfo');
            }

            // エフェクトを表示
            const isVisible = this.game.getVisibleTiles().some(tile => tile.x === x && tile.y === y);
            if (isVisible) {
                this.game.logger.add('The web catches fire and burns away!', 'info');
                this.game.playSound('caution'); // 燃焼音
            }
        }
    }

    /**
     * 家具の延焼処理
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} fireDensity - 火炎の濃度
     */
    handleFurnitureIgnition(x, y, fireDensity) {
        // 境界チェック
        if (!this.game.isValidPosition || !this.game.isValidPosition(x, y)) {
            return;
        }
        
        if (!this.game.tiles[y] || !this.game.map[y]) {
            return;
        }
        
        const tile = this.game.tiles[y][x];
        const map = this.game.map[y][x];
        
        if (!tile || !map) {
            return;
        }
        
        // ドアの燃焼判定
        if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED || tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
            const burnChance = GAME_CONSTANTS.FLAMMABLE_OBJECTS.DOOR.BURN_CHANCE * (fireDensity * 0.8);
            
            if (Math.random() < burnChance) {
                this.igniteFurniture(x, y, 'door');
            }
        }
        
        // 木製障害物の燃焼判定
        if (map === 'obstacle') {
            const isWoodenObstacle = GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(tile);
            
            if (isWoodenObstacle) {
                const burnChance = GAME_CONSTANTS.FLAMMABLE_OBJECTS.OBSTACLE.TRANSPARENT.BURN_CHANCE * (fireDensity * 0.6);
                
                if (Math.random() < burnChance) {
                    this.igniteFurniture(x, y, 'obstacle');
                }
            }
        }
    }

    /**
     * 家具を燃やす
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} furnitureType - 家具タイプ
     */
    igniteFurniture(x, y, furnitureType) {
        if (!this.burningFurniture) {
            this.burningFurniture = [];
        }
        
        // 既に燃えているかチェック
        const existingFire = this.burningFurniture.find(f => f.x === x && f.y === y);
        if (existingFire) {
            return;
        }
        
        let settings;
        if (furnitureType === 'door') {
            settings = GAME_CONSTANTS.FLAMMABLE_OBJECTS.DOOR;
        } else if (furnitureType === 'obstacle') {
            settings = GAME_CONSTANTS.FLAMMABLE_OBJECTS.OBSTACLE.TRANSPARENT;
        } else {
            return; // 不明な家具タイプは静かに終了
        }
        
        if (!settings) {
            return; // 設定が見つからない場合は静かに終了
        }
        
        // 燃焼オブジェクトを追加
        this.burningFurniture.push({
            x: x,
            y: y,
            type: furnitureType,
            duration: settings.BURN_DURATION,
            maxDuration: settings.BURN_DURATION, // 最大持続時間を記録
            originalTile: this.game.tiles[y][x],
            originalColor: this.game.colors[y][x]
        });
        
        // 見た目を変更（安全なフォールバック付き）
        if (furnitureType === 'door') {
            const charBurnt = settings.CHAR_BURNT || '#';
            const colorBurnt = settings.COLOR_BURNT || '#FF4444';
            
            this.game.tiles[y][x] = charBurnt;
            this.game.colors[y][x] = colorBurnt;
        } else if (furnitureType === 'obstacle') {
            const charBurnt = settings.CHAR_BURNT || '*';
            const colorBurnt = settings.COLOR_BURNT || '#FF6644';
            
            this.game.tiles[y][x] = charBurnt;
            this.game.colors[y][x] = colorBurnt;
        }
        
        // 周囲に火炎ガスを発生
        this.addGas(x, y, 'fire_gas', 2);
        
        // エフェクト表示
        const isVisible = this.game.getVisibleTiles().some(tile => tile.x === x && tile.y === y);
        if (isVisible) {
            const furnitureNames = { door: 'door', obstacle: 'furniture' };
            const typeName = furnitureNames[furnitureType] || 'object';
            this.game.logger.add(`The ${typeName} catches fire and burns fiercely!`, 'warning');
            this.game.playSound('caution');
            // 視覚エフェクトを追加
            this.game.renderer.showMalfunctionEffect(x, y, 'fire', 2);
        }
    }

    /**
     * メカニカル故障からのガス生成
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} malfunctionType - 故障タイプ
     * @param {number} severity - 重症度
     */
    generateGasFromMalfunction(x, y, malfunctionType, severity = 2) {
        switch (malfunctionType) {
            case 'fire':
                this.addGas(x, y, 'fire_gas', severity);
                break;
            // electrical は電気フィールドシステムに移行済み
        }
    }

    /**
     * 燃焼中の家具を更新
     */
    updateBurningFurniture() {
        if (!this.burningFurniture) {
            this.burningFurniture = [];
            return;
        }
        
        this.burningFurniture = this.burningFurniture.filter(furniture => {
            furniture.duration--;
            
            // 燃焼継続中の処理
            if (furniture.duration > 0) {
                const settings = furniture.type === 'door' 
                    ? GAME_CONSTANTS.FLAMMABLE_OBJECTS.DOOR
                    : GAME_CONSTANTS.FLAMMABLE_OBJECTS.OBSTACLE.TRANSPARENT;
                
                // 燃焼段階によるメッセージ表示
                const isVisible = this.game.getVisibleTiles().some(tile => 
                    tile.x === furniture.x && tile.y === furniture.y);
                
                if (isVisible) {
                    const burntPercent = 1 - (furniture.duration / furniture.maxDuration);
                    const furnitureNames = { door: 'door', obstacle: 'furniture' };
                    const typeName = furnitureNames[furniture.type] || `unknown furniture (${furniture.type})`;
                    
                    // 燃焼段階に応じたメッセージ（時々表示）
                    if (Math.random() < 0.15) { // 15%の確率で表示
                        if (burntPercent < 0.3) {
                            this.game.logger.add(`The ${typeName} burns brightly.`, 'info');
                        } else if (burntPercent < 0.7) {
                            this.game.logger.add(`The ${typeName} is half consumed by flames.`, 'info');
                        } else {
                            this.game.logger.add(`The ${typeName} is almost burnt to ashes.`, 'info');
                        }
                    }
                    
                    // 視覚エフェクト（時々表示）
                    if (Math.random() < 0.2) { // 20%の確率で炎エフェクト
                        this.game.renderer.showMalfunctionEffect(furniture.x, furniture.y, 'fire', 1);
                    }
                }
                
                // 隣接タイルへの延焼チェック
                if (settings && settings.SPREAD_CHANCE && Math.random() < settings.SPREAD_CHANCE * 0.8) {
                    this.spreadFireToAdjacent(furniture.x, furniture.y);
                }
                
                // 火炎ガスを継続発生（燃焼の激しさに応じて）
                const gasIntensity = Math.min(2, 0.5 + (furniture.maxDuration - furniture.duration) * 0.1);
                this.addGas(furniture.x, furniture.y, 'fire_gas', gasIntensity);
                
                return true; // 燃焼継続
            } else {
                // 🔍 燃え尽き時のundefined問題対策
                console.log(`🔥 Furniture burnout at (${furniture.x}, ${furniture.y}): Converting to floor...`);
                
                // 燃焼終了：燃え尽きて床になる
                this.game.map[furniture.y][furniture.x] = 'floor';
                
                // 床タイルと色を同時に設定（undefinedを防ぐ）
                const floorTiles = GAME_CONSTANTS.TILES.FLOOR;
                const floorColor = GAME_CONSTANTS.COLORS.FLOOR;
                
                // 安全に床タイルを設定
                if (floorTiles && floorTiles.length > 0) {
                    this.game.tiles[furniture.y][furniture.x] = floorTiles[Math.floor(Math.random() * floorTiles.length)];
                } else {
                    this.game.tiles[furniture.y][furniture.x] = '.';
                }
                
                // 安全に床色を設定
                if (floorColor !== undefined) {
                    this.game.colors[furniture.y][furniture.x] = floorColor;
                } else {
                    this.game.colors[furniture.y][furniture.x] = '#8B4513';
                }
                
                console.log(`🔥 Conversion complete: tile='${this.game.tiles[furniture.y][furniture.x]}', color='${this.game.colors[furniture.y][furniture.x]}'`);
                
                // メッセージ表示
                const isVisible = this.game.getVisibleTiles().some(tile => 
                    tile.x === furniture.x && tile.y === furniture.y);
                if (isVisible) {
                    const furnitureNames = { door: 'door', obstacle: 'furniture' };
                    const typeName = furnitureNames[furniture.type] || `unknown furniture (${furniture.type})`;
                    this.game.logger.add(`The ${typeName} has burned completely and crumbles to ash.`, 'warning');
                }
                
                return false; // 削除
            }
        });
    }

    /**
     * 隣接タイルへの火炎の拡散処理
     * @param {number} x - 拡散元のX座標
     * @param {number} y - 拡散元のY座標
     */
    spreadFireToAdjacent(x, y) {
        // 隣接する8方向をチェック
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];
        
        const flammableTargets = [];
        
        // 隣接する各タイルで燃えるものを探す
        for (const [dx, dy] of directions) {
            const targetX = x + dx;
            const targetY = y + dy;
            
            if (!this.game.isValidPosition(targetX, targetY)) continue;
            
            // 既に燃えているかチェック
            const alreadyBurning = this.burningFurniture?.find(f => f.x === targetX && f.y === targetY);
            if (alreadyBurning) continue;
            
            const tile = this.game.tiles[targetY][targetX];
            const map = this.game.map[targetY][targetX];
            
            // ドアの場合
            if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED || tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                flammableTargets.push({
                    x: targetX,
                    y: targetY,
                    type: 'door'
                });
            }
            
            // 木製障害物の場合
            if (map === 'obstacle' && GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(tile)) {
                flammableTargets.push({
                    x: targetX,
                    y: targetY,
                    type: 'obstacle'
                });
            }
        }
        
        // 延焼可能な対象がなければ終了
        if (flammableTargets.length === 0) {
            return;
        }

        // ランダムに対象を選んで延焼させる
        const target = flammableTargets[Math.floor(Math.random() * flammableTargets.length)];
        
        // 延焼確率を適用（高い火炎密度で延焼チェック）
        this.handleFurnitureIgnition(target.x, target.y, 2.0);
        
        // デバッグ情報
        const isVisible = this.game.getVisibleTiles().some(tile => tile.x === target.x && tile.y === target.y);
        if (isVisible) {
            console.log(`🔥 Fire spreads to ${target.type} at (${target.x}, ${target.y})`);
            const furnitureNames = { door: 'door', obstacle: 'furniture' };
            const typeName = furnitureNames[target.type] || 'object';
            this.game.logger.add(`Fire spreads to the nearby ${typeName}!`, 'warning');
        }
    }

    /**
     * 火炎ガスの隣接タイルへの拡散
     * @param {number} x - 中心X座標
     * @param {number} y - 中心Y座標
     * @param {number} sourceDensity - 元の火炎ガス密度
     */
    spreadFireGasToAdjacent(x, y, sourceDensity) {
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];
        
        // 拡散する火炎ガスの密度を計算（元の30%程度）
        const spreadDensity = Math.max(1, Math.floor(sourceDensity * 0.3));
        const spreadVolume = this.calculateVolumeFromDensity('fire_gas', spreadDensity) * 0.5;
        
        for (const [dx, dy] of directions) {
            const targetX = x + dx;
            const targetY = y + dy;
            
            if (!this.game.isValidPosition(targetX, targetY)) continue;
            
            // 床タイルのみに拡散
            if (this.game.map[targetY][targetX] !== 'floor') continue;
            
            // 壁や障害物には拡散しない
            const tile = this.game.tiles[targetY][targetX];
            if (GAME_CONSTANTS.TILES.WALL.includes(tile) || 
                GAME_CONSTANTS.TILES.CYBER_WALL.includes(tile) ||
                GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(tile)) {
                continue;
            }
            
            // 既存の火炎ガスがある場合はスキップ（重複を避ける）
            const existingFireGas = this.getGasAt(targetX, targetY, 'fire_gas');
            if (existingFireGas && existingFireGas.density >= spreadDensity) {
                continue;
            }
            
            // 30%の確率で拡散
            if (Math.random() < 0.3) {
                // 既存のガスに追加する形で拡散
                if (!this.gases['fire_gas']) {
                    this.gases['fire_gas'] = [];
                }
                
                this.gases['fire_gas'].push({
                    x: targetX,
                    y: targetY,
                    density: spreadDensity,
                    volume: spreadVolume,
                    duration: this.calculateDuration('fire_gas', spreadDensity) * 0.7 // 短い持続時間
                });
            }
        }
    }

    /**
     * 火炎の隣接タイルへの影響を処理
     * @param {Object} entity - プレイヤーまたはモンスター
     * @param {number} x - エンティティのX座標
     * @param {number} y - エンティティのY座標
     */
    processAdjacentFireEffects(entity, x, y) {
        let totalHeatDamage = 0;
        const heatSources = [];
        
        // 隣接する8方向をチェック
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];
        
        for (const [dx, dy] of directions) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (!this.game.isValidPosition(checkX, checkY)) continue;
            
            // 火炎ガスからの熱ダメージ
            const fireGas = this.getGasAt(checkX, checkY, 'fire_gas');
            if (fireGas) {
                const fireConfig = GAME_CONSTANTS.GASES.FIRE_GAS;
                const directDamage = fireConfig.DAMAGE_PER_TURN[`LEVEL_${fireGas.density}`];
                // 隣接タイルでは30%の熱ダメージ
                const heatDamage = Math.floor(directDamage * 0.3);
                if (heatDamage > 0) {
                    totalHeatDamage += heatDamage;
                    heatSources.push({
                        type: 'fire_gas',
                        x: checkX,
                        y: checkY,
                        damage: heatDamage,
                        density: fireGas.density
                    });
                }
            }
            
            // 燃焼中の家具からの熱ダメージ
            const burningFurniture = this.burningFurniture?.find(f => f.x === checkX && f.y === checkY);
            if (burningFurniture) {
                // 燃焼段階に応じたダメージ
                const burnProgress = 1 - (burningFurniture.duration / burningFurniture.maxDuration);
                const baseDamage = burningFurniture.type === 'door' ? 4 : 3; // ドアは少し強い
                const heatDamage = Math.floor(baseDamage * (0.5 + burnProgress * 0.5) * 0.4); // 40%の熱ダメージ
                if (heatDamage > 0) {
                    totalHeatDamage += heatDamage;
                    heatSources.push({
                        type: 'burning_furniture',
                        x: checkX,
                        y: checkY,
                        damage: heatDamage,
                        furnitureType: burningFurniture.type
                    });
                }
            }
        }
        
        // 熱ダメージを適用
        if (totalHeatDamage > 0) {
            // 最大値を制限（過度なダメージを防ぐ）
            totalHeatDamage = Math.min(totalHeatDamage, 8);
            
            entity.takeDamage(totalHeatDamage, { 
                game: this.game, 
                type: 'fire_heat',
                isEnvironmentalDamage: true 
            });
            
            // メッセージ表示
            if (entity === this.game.player) {
                this.game.logger.add(`You feel the intense heat from nearby flames! (${totalHeatDamage} damage)`, 'playerDamage');
            } else if (entity.name) {
                const isVisible = this.game.getVisibleTiles().some(tile => 
                    tile.x === entity.x && tile.y === entity.y
                );
                if (isVisible) {
                    this.game.logger.add(`${entity.name} is affected by intense heat! (${totalHeatDamage} damage)`, 'monsterInfo');
                }
            }
            
            // 視覚エフェクト（隣接する火炎源の中で最も強いもの）
            const strongestSource = heatSources.reduce((max, source) => 
                source.damage > max.damage ? source : max, heatSources[0]);
            
            if (strongestSource && this.game.getVisibleTiles().some(tile => tile.x === x && tile.y === y)) {
                // 熱の波動エフェクト
                this.game.renderer.showMalfunctionEffect(x, y, 'fire', 1);
            }
        }
    }
} 