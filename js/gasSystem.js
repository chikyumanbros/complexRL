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
            miasma: [], // 瘴気（腐敗から発生するガス）
            // 将来的に他のガスタイプを追加可能
            // smoke: [],  // 煙
            // poison: [], // 毒ガス
            // steam: [],  // 蒸気
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
     * ガスを追加
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} type - ガスタイプ
     * @param {number} density - ガスの濃度（1-3）
     * @param {number|null} volume - ガスの量（明示的に指定する場合）
     * @returns {boolean} - 追加に成功したかどうか
     */
    addGas(x, y, type, density, volume = null) {
        // ガスタイプを小文字に変換
        const lowerType = type.toLowerCase();
        
        // マップが有効でない場合は処理しない
        if (!this.game.map || !this.game.map[y] || !this.game.map[y][x] || this.game.map[y][x] !== 'floor') {
            return false;
        }
        
        // 壁タイルにはガスを置かない
        if (this.game.tiles && this.game.tiles[y] && 
            GAME_CONSTANTS.TILES.WALL.includes(this.game.tiles[y][x])) {
            return false;
        }
        
        // 階段の上にはガスを置かない
        if (this.game.tiles && this.game.tiles[y] && this.game.tiles[y][x] === GAME_CONSTANTS.STAIRS.CHAR) {
            return false;
        }

        // 閉じたドアの上にはガスを置かない
        if (this.game.tiles && this.game.tiles[y] && this.game.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
            return false;
        }

        // ガスタイプが存在するか確認
        if (!this.gases[lowerType]) {
            console.error(`未定義のガスタイプ: ${lowerType}`);
            return false;
        }

        // ガスの量を決定
        let gasAmount = this.calculateGasAmount(type, density, volume);
        
        // ガスの設定を取得
        const gasSettings = GAME_CONSTANTS.GASES[type.toUpperCase()];
        
        // 微量のガスは処理しない（最小値未満は無視）
        if (gasAmount < gasSettings.VOLUME.MINIMUM) {
            return false;
        }

        // 既存のガスを検索
        const existingGas = this.gases[lowerType].find(g => g.x === x && g.y === y);

        if (existingGas) {
            // 既存のガスがある場合、ガス量を追加して濃度を更新
            const oldVolume = existingGas.volume || 0;
            const newVolume = oldVolume + gasAmount;
            
            // 新しい総量が最小値未満ならガスを削除して終了
            if (newVolume < gasSettings.VOLUME.MINIMUM) {
                this.gases[lowerType] = this.gases[lowerType].filter(g => !(g.x === x && g.y === y));
                return false;
            }
            
            existingGas.volume = newVolume;

            // ガス量に応じて濃度を決定
            const newDensity = this.calculateDensityFromVolume(type, newVolume);
            existingGas.density = newDensity;
            
            // 残りターン数を更新（最大値に制限）
            existingGas.remainingTurns = Math.min(
                existingGas.remainingTurns + Math.floor(gasSettings.DURATION.BASE / 2),
                gasSettings.DURATION.BASE * gasSettings.DURATION.DENSITY_FACTOR[`LEVEL_${newDensity}`]
            );
        } else {
            // 新しいガスを追加
            // 持続時間を計算
            const baseDuration = gasSettings.DURATION.BASE;
            const durationFactor = gasSettings.DURATION.DENSITY_FACTOR[`LEVEL_${density}`];
            const remainingTurns = Math.floor(baseDuration * durationFactor);
            
            this.gases[lowerType].push({
                x: x,
                y: y,
                density: density,
                volume: gasAmount,
                remainingTurns: remainingTurns
            });
        }

        return true;
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
            // 残りターン数を減少
            gas.remainingTurns--;
            
            // 残りターン数が0になったらガスを削除
            if (gas.remainingTurns <= 0) {
                return false;
            }
            
            // 自然減衰によるガス量の減少
            gas.volume *= (1 - gasSettings.DECAY_RATE);
            
            // 濃度を再計算
            gas.density = this.calculateDensityFromVolume(type, gas.volume);
            
            // 最小量未満になった場合はガスを削除
            return gas.volume >= gasSettings.VOLUME.MINIMUM;
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
} 