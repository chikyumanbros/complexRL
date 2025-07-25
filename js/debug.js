// デバッグモード用のユーティリティクラス
class DebugUtils {
    constructor(game) {
        this.game = game;
        this.enabled = false;
        
        // デバッグモード中に追加する要素を格納するオブジェクト
        this.debugElements = {
            panel: null,
            messagePanel: null
        };
        
        // ステータス編集モード用の変数
        this.currentStatMode = null;
        
        // マップ生成モード用の変数
        this.mapGenerationMode = false;
        this.selectedFloorLevel = 1;
        this.selectedDangerLevel = 'NORMAL';
        
        // 自動アップデート用のインターバル
        this.updateInterval = null;
        
        // デバッグモードのトグル (Ctrl+Shift+D)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                this.toggleDebugMode();
            }
        });
        
        // デバッグモード有効時のキー操作
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            
            // ステータス操作モード
            if (e.key === 's') {
                // 's'キーを押したらステータス編集モード
                this.toggleStatEditMode();
            }
            
            // マップ生成モード
            if (e.key === 'm') {
                // 'm'キーを押したらマップ生成モード
                this.toggleMapGenerationMode();
                return;
            }
            
            // マップ生成モード中の操作
            if (this.mapGenerationMode) {
                this.handleMapGenerationKeys(e);
                return;
            }
            
            // ステータス操作モード中の操作
            if (this.currentStatMode) {
                this.handleStatEditKeys(e);
                return;
            }
        });
        
        // デバッグ用コマンドをグローバルに登録
        window.debugCreateMiasma = this.debugCreateMiasma.bind(this);
        window.debugCreateFire = this.debugCreateFire.bind(this);
        window.debugTestFurniture = this.debugTestFurniture.bind(this);
        window.debugForceBurn = this.debugForceBurn.bind(this);
        
        // デバッグコマンドの説明
        console.log('デバッグコマンド一覧:');
        console.log('debugCreateMiasma() - プレイヤーの位置に瘴気を生成');
        console.log('debugCreateFire() - プレイヤーの位置に火炎ガスを生成');
        console.log('debugTestFurniture() - 周囲の家具延焼をテスト');
        console.log('debugForceBurn() - 周囲の家具を強制燃焼（100%確率）');
    }
    
    // 自動更新のセットアップ
    setupAutoUpdate() {
        // オリジナルのレンダリングメソッドを保存
        const originalRenderMethod = this.game.renderer.render;
        
        // レンダリングメソッドをオーバーライド
        this.game.renderer.render = () => {
            // オリジナルのレンダリング処理を実行
            originalRenderMethod.call(this.game.renderer);
            
            // レンダリング後にデバッグパネルを更新
            if (this.enabled) {
                this.updateDebugPanel();
            }
        };
        
        // ターン処理後にも更新するようにフック
        const originalProcessTurn = this.game.processTurn;
        if (originalProcessTurn) {
            this.game.processTurn = () => {
                originalProcessTurn.call(this.game);
                if (this.enabled) {
                    this.updateDebugPanel();
                }
            };
        }
        
        // 定期的な更新も設定（バックアップとして）
        this.autoUpdateInterval = setInterval(() => {
            if (this.enabled) {
                this.updateDebugPanel();
            }
        }, 1000); // 1秒ごとに更新
    }
    
    // デバッグモードの切り替え
    toggleDebugMode() {
        this.enabled = !this.enabled;
        console.log(`Debug Mode: ${this.enabled ? 'ON' : 'OFF'}`);
        
        if (this.enabled) {
            this.showDebugPanel();
            this.game.logger.add("Debug Mode Enabled", "important");
            this.game.logger.add("Ctrl+Shift+D: Toggle Debug Mode", "important");
            this.game.logger.add("s: Stat Edit Mode", "important");
            this.game.logger.add("m: Map Generation Mode", "important");
        } else {
            this.hideDebugPanel();
            this.game.logger.add("Debug Mode Disabled", "important");
            this.currentStatMode = null;
            this.mapGenerationMode = false;
        }
    }
    
    // ステータス編集モードの切り替え
    toggleStatEditMode() {
        if (this.currentStatMode) {
            // 既にステータス編集モードの場合は解除
            this.currentStatMode = null;
            this.game.logger.add("Stat Edit Mode Exited", "important");
        } else {
            // ステータス編集モードをアクティブにする
            this.currentStatMode = 'str'; // 最初は筋力から
            this.showStatEditControls();
        }
        this.updateDebugPanel();
    }
    
    // ステータス編集キー操作の処理
    handleStatEditKeys(e) {
        // 1-5でステータスを選択
        if (e.key >= '1' && e.key <= '5') {
            const statKeys = ['str', 'dex', 'con', 'int', 'wis'];
            const index = parseInt(e.key) - 1;
            if (index >= 0 && index < statKeys.length) {
                this.currentStatMode = statKeys[index];
                this.game.logger.add(`Now Editing: ${this.currentStatMode.toUpperCase()}`, "important");
                this.updateDebugPanel();
            }
            return;
        }
        
        // x, c, lキーでレベル、経験値、コデックスを選択
        if (e.key === 'x') {
            this.currentStatMode = 'xp';
            this.game.logger.add(`Now Editing: XP (Experience Points)`, "important");
            this.updateDebugPanel();
            return;
        }
        
        if (e.key === 'c') {
            this.currentStatMode = 'codex';
            this.updateDebugPanel();
            return;
        }
        
        if (e.key === 'l') {
            this.currentStatMode = 'level';
            this.game.logger.add(`Now Editing: LEVEL`, "important");
            this.updateDebugPanel();
            return;
        }
        
        // プラス/マイナスでステータスを変更
        if (e.key === '+' || e.key === '=') {
            if (this.currentStatMode === 'xp' || this.currentStatMode === 'codex' || this.currentStatMode === 'level') {
                this.modifySpecialStat(this.currentStatMode, this.currentStatMode === 'xp' ? 50 : 1);
            } else {
                this.modifyStat(this.currentStatMode, 1);
            }
            return;
        }
        
        if (e.key === '-' || e.key === '_') {
            if (this.currentStatMode === 'xp' || this.currentStatMode === 'codex' || this.currentStatMode === 'level') {
                this.modifySpecialStat(this.currentStatMode, this.currentStatMode === 'xp' ? -50 : -1);
            } else {
                this.modifyStat(this.currentStatMode, -1);
            }
            return;
        }
        
        // ESCキーでステータス編集モードを終了
        if (e.key === 'Escape') {
            this.currentStatMode = null;
            this.game.logger.add("Stat Edit Mode Exited", "important");
            this.updateDebugPanel();
        }
    }
    
    // 特殊ステータス（XP, レベル, コデックス）の修正
    modifySpecialStat(statKey, amount) {
        const player = this.game.player;
        
        if (statKey === 'xp') {
            const oldValue = player.xp;
            player.xp = Math.max(0, oldValue + amount);
            console.log(`XP: ${oldValue} -> ${player.xp}`);
            this.game.logger.add(`XP changed from ${oldValue} to ${player.xp}`, "important");
        } 
        else if (statKey === 'level') {
            const oldValue = player.level;
            player.level = Math.max(1, Math.min(20, oldValue + amount)); // レベルは1-20で制限
            console.log(`Level: ${oldValue} -> ${player.level}`);
            this.game.logger.add(`Level changed from ${oldValue} to ${player.level}`, "important");
            
            // レベル変更後はHP上限などを更新
            player.updateDerivedStats();
        }
        else if (statKey === 'codex') {
            const oldValue = player.codexPoints;
            player.codexPoints = Math.max(0, oldValue + amount);
            console.log(`Codex Points: ${oldValue} -> ${player.codexPoints}`);
            this.game.logger.add(`Codex Points changed from ${oldValue} to ${player.codexPoints}`, "important");
        }
        
        this.game.renderer.render();
        this.updateDebugPanel();
    }
    
    // ステータスを変更
    modifyStat(statKey, amount) {
        if (!statKey || !this.game.player.stats[statKey]) return;
        
        const oldValue = this.game.player.stats[statKey];
        const newValue = Math.max(1, Math.min(20, oldValue + amount)); // ステータスは1-20の範囲内
        
        if (oldValue === newValue) return; // 変更なし
        
        this.game.player.stats[statKey] = newValue;
        console.log(`${statKey.toUpperCase()}: ${oldValue} -> ${newValue}`);
        this.game.logger.add(`${statKey.toUpperCase()} changed from ${oldValue} to ${newValue}`, "important");
        
        // ステータス変更後の処理
        this.game.player.updateDerivedStats();
        this.game.renderer.render();
        this.updateDebugPanel();
    }
    
    // ステータス編集ガイドの表示
    showStatEditControls() {
        this.game.logger.add("--- STAT EDIT MODE ---", "important");
        this.game.logger.add("1: STR (Strength)", "important");
        this.game.logger.add("2: DEX (Dexterity)", "important");
        this.game.logger.add("3: CON (Constitution)", "important");
        this.game.logger.add("4: INT (Intelligence)", "important");
        this.game.logger.add("5: WIS (Wisdom)", "important");
        this.game.logger.add("x: XP (Experience)", "important");
        this.game.logger.add("l: LEVEL", "important");
        this.game.logger.add("+/-: Increase/Decrease value", "important");
        this.game.logger.add("ESC: Exit Edit Mode", "important");
        this.game.logger.add(`Currently Editing: ${this.currentStatMode ? this.currentStatMode.toUpperCase() : 'None'}`, "important");
    }
    
    // デバッグパネルの表示
    showDebugPanel() {
        let panel = document.getElementById('debug-panel');
        
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'debug-panel';
            panel.style.position = 'fixed';
            panel.style.top = '10px';
            panel.style.right = '10px';
            panel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            panel.style.color = '#fff';
            panel.style.padding = '10px';
            panel.style.borderRadius = '5px';
            panel.style.zIndex = '1000';
            panel.style.fontFamily = 'monospace';
            panel.style.fontSize = '14px';
            document.body.appendChild(panel);
        } else {
            // 既存のパネルが見つかった場合は表示状態に戻す
            panel.style.display = 'block';
        }
        
        this.debugElements.panel = panel;
        this.updateDebugPanel();
    }
    
    // デバッグパネルを非表示
    hideDebugPanel() {
        const panel = document.getElementById('debug-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }
    
    // デバッグパネルの更新
    updateDebugPanel() {
        if (!this.enabled || !this.debugElements.panel) return;
        
        const player = this.game.player;
        const stats = player.stats;
        
        let statHTML = '';
        const statKeys = ['str', 'dex', 'con', 'int', 'wis'];
        statKeys.forEach(key => {
            const isActive = this.currentStatMode === key;
            statHTML += `<div ${isActive ? 'style="color: yellow;"' : ''}>
                <strong>${key.toUpperCase()}:</strong> ${stats[key]}
            </div>`;
        });
        
        // 特殊ステータスのHTML
        const isXpActive = this.currentStatMode === 'xp';
        const isLevelActive = this.currentStatMode === 'level';
        const isCodexActive = this.currentStatMode === 'codex';
        
        const specialStatsHTML = `
            <div ${isXpActive ? 'style="color: yellow;"' : ''}>
                <strong>XP:</strong> ${player.xp}/${player.xpToNextLevel}
            </div>
            <div ${isLevelActive ? 'style="color: yellow;"' : ''}>
                <strong>LEVEL:</strong> ${player.level}
            </div>
        `;
        
        // マップ情報HTML
        const mapInfoHTML = `
            <div ${this.mapGenerationMode ? 'style="color: yellow;"' : ''}>
                <strong>Floor:</strong> ${this.game.floorLevel} 
                (${this.mapGenerationMode ? this.selectedFloorLevel : this.game.floorLevel})
            </div>
            <div ${this.mapGenerationMode ? 'style="color: yellow;"' : ''}>
                <strong>Danger:</strong> ${this.game.currentDangerLevel || 'NORMAL'}
                (${this.mapGenerationMode ? this.selectedDangerLevel : (this.game.currentDangerLevel || 'NORMAL')})
            </div>
        `;
        
        this.debugElements.panel.innerHTML = `
            <h3>Debug Panel</h3>
            <div>
                <strong>Base Stats:</strong><br>
                ${statHTML}
            </div>
            <div>
                <strong>Player Info:</strong><br>
                ${specialStatsHTML}
            </div>
            <div>
                <strong>Map Info:</strong><br>
                ${mapInfoHTML}
            </div>
            <div>
                <strong>Controls:</strong><br>
                s: Stat Edit<br>
                m: Map Generation
            </div>
        `;
    }
    
    // マップ生成モードの切り替え
    toggleMapGenerationMode() {
        this.mapGenerationMode = !this.mapGenerationMode;
        
        if (this.mapGenerationMode) {
            this.selectedFloorLevel = this.game.floorLevel;
            this.showMapGenerationControls();
        } else {
            this.game.logger.add("Map Generation Mode Exited", "important");
        }
        
        this.updateDebugPanel();
    }
    
    // マップ生成キー操作の処理
    handleMapGenerationKeys(e) {
        // 1-9キーでフロアレベルを設定
        if (e.key >= '1' && e.key <= '9') {
            this.selectedFloorLevel = parseInt(e.key);
            this.game.logger.add(`Floor Level: ${this.selectedFloorLevel}`, "important");
            this.updateDebugPanel();
            return;
        }
        
        // 0キーでフロアレベル10
        if (e.key === '0') {
            this.selectedFloorLevel = 10;
            this.game.logger.add(`Floor Level: ${this.selectedFloorLevel}`, "important");
            this.updateDebugPanel();
            return;
        }
        
        // 危険度の選択
        if (e.key === 'q') {
            this.selectedDangerLevel = 'SAFE';
            this.game.logger.add("Danger Level: SAFE", "important");
            this.updateDebugPanel();
            return;
        }
        
        if (e.key === 'w') {
            this.selectedDangerLevel = 'NORMAL';
            this.game.logger.add("Danger Level: NORMAL", "important");
            this.updateDebugPanel();
            return;
        }
        
        if (e.key === 'e') {
            this.selectedDangerLevel = 'DANGEROUS';
            this.game.logger.add("Danger Level: DANGEROUS", "important");
            this.updateDebugPanel();
            return;
        }
        
        if (e.key === 'r') {
            this.selectedDangerLevel = 'DEADLY';
            this.game.logger.add("Danger Level: DEADLY", "important");
            this.updateDebugPanel();
            return;
        }
        
        // Enterキーでマップ生成
        if (e.key === 'Enter') {
            this.generateNewMap();
            return;
        }
        
        // ESCキーでマップ生成モードを終了
        if (e.key === 'Escape') {
            this.mapGenerationMode = false;
            this.game.logger.add("Map Generation Mode Exited", "important");
            this.updateDebugPanel();
        }
    }
    
    // マップ生成
    generateNewMap() {
        this.game.logger.add(`Generating map with Floor ${this.selectedFloorLevel}, Danger Level ${this.selectedDangerLevel}...`, "important");
        
        // フロアレベルを設定
        this.game.floorLevel = this.selectedFloorLevel;
        
        // 危険度を設定
        this.game.currentDangerLevel = this.selectedDangerLevel;
        
        // ポータル遷移エフェクト付きでマップ再生成
        this.game.renderer.startPortalTransition(() => {
            this.game.generateNewFloor();
            this.game.soundManager.updateBGM();
            this.game.logger.add(`Generated Floor ${this.game.floorLevel} (${this.selectedDangerLevel})`, "important");
        });
        
        this.game.soundManager.playPortalSound();
        
        // マップ生成モードを終了
        this.mapGenerationMode = false;
        this.updateDebugPanel();
    }
    
    // マップ生成ガイドの表示
    showMapGenerationControls() {
        this.game.logger.add("--- MAP GENERATION MODE ---", "important");
        this.game.logger.add("1-9, 0: Select Floor Level", "important");
        this.game.logger.add("q: SAFE Danger Level", "important");
        this.game.logger.add("w: NORMAL Danger Level", "important");
        this.game.logger.add("e: DANGEROUS Danger Level", "important");
        this.game.logger.add("r: DEADLY Danger Level", "important");
        this.game.logger.add("Enter: Generate Map with Selected Parameters", "important");
        this.game.logger.add("ESC: Exit Map Generation Mode", "important");
        this.game.logger.add(`Current Selection: Floor ${this.selectedFloorLevel}, Danger Level ${this.selectedDangerLevel}`, "important");
    }
    
    /**
     * プレイヤーの位置に瘴気を生成する
     */
    debugCreateMiasma() {
        if (this.game.gasSystem) {
            this.game.gasSystem.debugCreateMiasmaAtPlayer();
            this.game.renderer.render();
            return "瘴気を生成しました。";
        }
        return "ガスシステムが初期化されていません。";
    }

    /**
     * プレイヤーの位置に火炎ガスを生成する
     */
    debugCreateFire() {
        if (this.game.gasSystem) {
            const player = this.game.player;
            this.game.gasSystem.addGas(player.x, player.y, 'fire_gas', 3);
            
            // 周囲にも火炎ガスを配置
            const adjacent = [
                {x: player.x-1, y: player.y}, {x: player.x+1, y: player.y},
                {x: player.x, y: player.y-1}, {x: player.x, y: player.y+1}
            ];
            
            adjacent.forEach(pos => {
                if (this.game.isValidPosition && this.game.isValidPosition(pos.x, pos.y)) {
                    this.game.gasSystem.addGas(pos.x, pos.y, 'fire_gas', 2);
                }
            });
            
            this.game.renderer.render();
            return "火炎ガスを生成しました。";
        }
        return "ガスシステムが初期化されていません。";
    }

    /**
     * 周囲の家具延焼をテストする
     */
    debugTestFurniture() {
        if (!this.game.gasSystem) {
            return "ガスシステムが初期化されていません。";
        }

        const player = this.game.player;
        let furnitureFound = false;
        let testResults = [];

        // プレイヤー周囲8マスをチェック
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const x = player.x + dx;
                const y = player.y + dy;
                
                if (!this.game.isValidPosition(x, y)) continue;
                
                const tile = this.game.tiles[y] && this.game.tiles[y][x];
                const map = this.game.map[y] && this.game.map[y][x];
                
                // ドアまたは木製障害物をチェック
                if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED || 
                    tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                    furnitureFound = true;
                    // 火炎ガスを配置
                    this.game.gasSystem.addGas(x, y, 'fire_gas', 3);
                    testResults.push(`Door at (${x}, ${y}) - Fire applied`);
                } else if (map === 'obstacle' && 
                    GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(tile)) {
                    furnitureFound = true;
                    // 火炎ガスを配置
                    this.game.gasSystem.addGas(x, y, 'fire_gas', 3);
                    testResults.push(`Wooden obstacle at (${x}, ${y}) - Fire applied`);
                }
            }
        }

        this.game.renderer.render();
        
        if (furnitureFound) {
            console.log('家具延焼テスト結果:');
            testResults.forEach(result => console.log('- ' + result));
            return `家具延焼テストを実行しました。コンソールで詳細を確認してください。`;
        } else {
            return "周囲に燃焼可能な家具が見つかりませんでした。";
        }
    }

    /**
     * 周囲の家具を強制的に燃やす（100%確率）
     */
    debugForceBurn() {
        if (!this.game.gasSystem) {
            return "ガスシステムが初期化されていません。";
        }
        
        const player = this.game.player;
        let burnCount = 0;
        
        // 周囲9マスをチェック
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const x = player.x + dx;
                const y = player.y + dy;
                
                if (!this.game.isValidPosition(x, y)) continue;
                
                const tile = this.game.tiles[y][x];
                const map = this.game.map[y][x];
                
                // ドアの場合
                if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED || tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                    console.log(`🔥 Force burning door at (${x},${y})`);
                    this.game.gasSystem.igniteFurniture(x, y, 'door');
                    burnCount++;
                }
                // 木製障害物の場合
                else if (map === 'obstacle' && 
                         GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(tile)) {
                    console.log(`🔥 Force burning obstacle at (${x},${y})`);
                    this.game.gasSystem.igniteFurniture(x, y, 'obstacle');
                    burnCount++;
                }
            }
        }
        
        this.game.renderer.render();
        return `${burnCount}箇所の家具を強制燃焼させました。`;
    }
}

// グローバルオブジェクトとして登録
window.DebugUtils = DebugUtils; 