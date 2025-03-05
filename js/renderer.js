class Renderer {
    constructor(game) {
        this.game = game;
        this.highlightedTile = null;
        this.movementEffects = null;
        this.spriteColorCache = new Map();

        // 揺らぎのための変数
        this.flickerTime = 0;
        this.flickerValues = new Array(20).fill(0);  // 揺らぎ値を保持

        // 幻覚エフェクト用の変数
        this.psychedelicTurn = 0;  // サイケデリックエフェクトのターンカウンター

        // 画面フリーズエフェクト用の変数
        this.isScreenFrozen = false;
        this.freezeOverlay = null;

        // マップレンダリングのためのキャッシュを追加
        this.lastFloorLevel = null;   // 前回描画時のフロアレベル
        this.tileStateCache = {};     // タイル状態のキャッシュ
        this.exploredStateHash = '';  // 探索状態のハッシュ値（変更検出用）
        
        // レンダリング処理を最適化するためのフラグ
        this.pendingRender = false;   // レンダリングがスケジュールされているか
        this.fastRenderMode = false;  // 高速レンダリングモードかどうか
        this.forceFullRender = false; // 完全な再描画を強制するフラグ

        // エフェクトシステムを初期化
        this.effects = new RendererEffects(this);

        // ウィンドウリサイズ時のスケーリング処理を追加
        this.setupScaling();
        window.addEventListener('resize', () => this.setupScaling());

        this.monsterAnimations = new Map(); // アニメーション状態を追跡
    }

    setupScaling() {
        const container = document.querySelector('.container');
        if (!container) return;

        const baseWidth = 1780;
        const baseHeight = 1000;

        // ウィンドウサイズに基づいてスケール比を計算
        const scaleX = window.innerWidth / baseWidth;
        const scaleY = window.innerHeight / baseHeight;
        const scale = Math.min(scaleX, scaleY, 1); // 最大スケールを1に制限

        // CSSカスタムプロパティとしてスケール比を設定
        document.documentElement.style.setProperty('--scale-ratio', scale);
    }

    // 揺らぎ値を更新（ターンベース）
    updateFlickerValues() {
        this.effects.updateFlickerValues();
        this.flickerValues = this.effects.flickerValues;
        this.flickerTime = this.effects.flickerTime;
    }

    // 明るさの更新のみを行うメソッドを追加
    updateLightingOnly() {
        // 視界内のタイルを取得
        const visibleTiles = new Set(
            this.game.getVisibleTiles().map(({ x, y }) => `${x},${y}`)
        );

        const elements = document.querySelectorAll('#game span');
        elements.forEach(el => {
            const x = parseInt(el.dataset.x);
            const y = parseInt(el.dataset.y);

            // 視界内のタイルのみ処理
            if (visibleTiles.has(`${x},${y}`)) {
                const style = window.getComputedStyle(el);
                const currentOpacity = parseFloat(style.opacity);
                if (!isNaN(currentOpacity)) {
                    const { opacity, color } = this.calculateFlicker(currentOpacity, x, y);
                    el.style.opacity = opacity;
                    // 既存の色に灯りの色を重ねる
                    el.style.textShadow = `0 0 5px ${color}`;
                }
            }
        });
    }

    // 揺らぎ効果を計算する関数（明るさと色用）
    calculateFlicker(baseOpacity, x, y) {
        return this.effects.calculateFlicker(baseOpacity, x, y);
    }

    // サイケデリック効果を計算する関数（ターンベース）
    calculatePsychedelicEffect(x, y, baseChar, baseColor, forceOpacity = false) {
        return this.effects.calculatePsychedelicEffect(x, y, baseChar, baseColor, forceOpacity);
    }

    highlightTarget(x, y) {
        // プレイヤーの視界内のタイルを取得
        const visibleTiles = new Set(
            this.game.getVisibleTiles().map(({ x, y }) => `${x},${y}`)
        );

        // ランドマークターゲットモードの場合は視界チェックをスキップ
        if (this.game.inputHandler.landmarkTargetMode) {
            this.highlightedTile = { x, y };
            this.render();
            return true;
        }

        // 視界内チェックは不要になったので、以下は常に実行
        this.highlightedTile = { x, y };
        this.render();
        return true;
    }

    clearHighlight() {
        this.highlightedTile = null;
        this.render();
    }

    render() {
        // ターンカウンターを更新
        this.psychedelicTurn = (this.psychedelicTurn + 1) % 1000;

        // Initialize movement effects state
        if (!this.movementEffects) {
            this.movementEffects = new Set();
        }

        // 遠距離攻撃モード中はハイライトを維持
        const keepHighlight = this.game.player.rangedCombat.isActive;
        const currentHighlight = keepHighlight ? {...this.highlightedTile} : null;

        // 既にレンダリングがスケジュールされている場合は重複しない
        if (this.pendingRender) return;
        
        // レンダリングをブラウザの描画サイクルに同期させる
        this.pendingRender = true;
        requestAnimationFrame(() => {
            // exploredStateのハッシュをチェック（タイル忘却などの検出用）
            const currentHash = this.effects.calculateExploredHash();
            if (currentHash !== this.exploredStateHash) {
                console.log('Detected change in explored state. Performing full redraw.');
                this.forceFullRender = true;
                this.exploredStateHash = currentHash;
            }
            
            this.renderMap();
            this.renderStatus();

            // Apply meditation effect
            if (this.game.player.meditation && this.game.player.meditation.active) {
                this.showMeditationEffect(this.game.player.x, this.game.player.y);
            }

            // Apply next attack modifier effect if needed
            if (this.game.player.nextAttackModifiers && this.game.player.nextAttackModifiers.length > 0) {
                this.showNextAttackModifierEffect(this.game.player.x, this.game.player.y);
            }

            // Apply movement effects
            this.movementEffects.forEach(effect => {
                const tile = document.querySelector(`#game span[data-x="${effect.x}"][data-y="${effect.y}"]`);
                if (tile) {
                    tile.classList.add('movement-trail');
                }
            });

            // 遠距離攻撃モード中は再度ハイライトを表示
            if (keepHighlight && currentHighlight) {
                this.highlightTarget(currentHighlight.x, currentHighlight.y);
            }
            
            // レンダリング完了フラグをリセット
            this.pendingRender = false;
            this.fastRenderMode = false;
            this.forceFullRender = false;
        });
    }

    // 高速レンダリングメソッド - 移動やシンプルな更新用
    renderFast() {
        // 既にレンダリングがスケジュールされている場合は高速モードに設定して重複しない
        if (this.pendingRender) {
            this.fastRenderMode = true;
            return;
        }
        
        // forceFullRenderフラグが立っている場合は通常のrenderを呼び出す
        if (this.forceFullRender) {
            this.render();
            return;
        }
        
        this.fastRenderMode = true;
        this.pendingRender = true;
        
        // 高優先度でレンダリングをスケジュール
        requestAnimationFrame(() => {
            // 現在のフロアレベルが変わっていないか確認
            if (this.lastFloorLevel !== this.game.floorLevel) {
                console.log('Detected floor level change. Switching to normal rendering.');
                this.forceFullRender = true;
                this.renderMap();
            } else {
                this.renderMapFast();
            }
            
            this.renderStatus();
            
            // Apply meditation effect
            if (this.game.player.meditation && this.game.player.meditation.active) {
                this.showMeditationEffect(this.game.player.x, this.game.player.y);
            }

            // Apply next attack modifier effect if needed
            if (this.game.player.nextAttackModifiers && this.game.player.nextAttackModifiers.length > 0) {
                this.showNextAttackModifierEffect(this.game.player.x, this.game.player.y);
            }
            
            // レンダリング完了フラグをリセット
            this.pendingRender = false;
            this.fastRenderMode = false;
            this.forceFullRender = false;
        });
    }

    // 高速レンダリング用マップ描画 - プレイヤーとその周辺のみ更新
    renderMapFast() {
        const container = document.getElementById('game');
        if (!container) return;
        
        // プレイヤーとその周辺のタイルのみを更新
        const px = this.game.player.x;
        const py = this.game.player.y;
        const updateRadius = 8; // プレイヤーの周囲20マスを更新
        
        // 更新範囲内のタイルとそのキーを収集
        const tilesToUpdate = [];
        for (let y = Math.max(0, py - updateRadius); y <= Math.min(this.game.height - 1, py + updateRadius); y++) {
            for (let x = Math.max(0, px - updateRadius); x <= Math.min(this.game.width - 1, px + updateRadius); x++) {
                tilesToUpdate.push({x, y, key: `${x},${y}`});
            }
        }
        
        // 可視タイルを取得（更新範囲内のみ）
        const visibleTiles = new Set(
            this.game.getVisibleTiles()
                .filter(tile => Math.abs(tile.x - px) <= updateRadius && Math.abs(tile.y - py) <= updateRadius)
                .map(({x, y}) => `${x},${y}`)
        );
        
        // 既存の要素を取得
        const existingTiles = {};
        tilesToUpdate.forEach(({key}) => {
            const element = container.querySelector(`span[data-x="${key.split(',')[0]}"][data-y="${key.split(',')[1]}"]`);
            if (element) {
                existingTiles[key] = element;
            }
        });
        
        // 高速更新用のタイル状態を構築
        const tileState = {};
        const updatesToDo = [];
        
        // 重要なタイルのみ状態を構築
        tilesToUpdate.forEach(({x, y, key}) => {
            const isVisible = visibleTiles.has(key);
            const isExplored = this.game.explored[y] && this.game.explored[y][x];
            if (!isVisible && !isExplored) return;
            
            const isHighlighted = this.highlightedTile &&
                this.highlightedTile.x === x &&
                this.highlightedTile.y === y;
                
            // タイル状態を計算（完全版のrenderMapと同じロジック）
            // 簡略化のため、プレイヤーとモンスターのタイルのみを詳細に計算
            let content = '';
            let style = '';
            let classes = [];
            let backgroundColor = '';
            let opacity = 1.0;
            
            const isPlayerTile = (x === px && y === py);
            const monster = this.game.getMonsterAt(x, y);
            
            if (isVisible) {
                content = this.game.tiles[y][x];
                style = `color: ${this.game.colors[y][x]}`;
                
                if (isPlayerTile) {
                    content = this.game.player.char;
                    const healthStatus = this.game.player.getHealthStatus(this.game.player.hp, this.game.player.maxHp);
                    style = `color: ${healthStatus.color}; opacity: 1;`;
                    
                    // プレイヤーがポータル上にいる場合、特別なクラスを追加
                    if (this.game.tiles[y][x] === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                        classes.push('player-on-portal');
                    } else if (this.game.tiles[y][x] === GAME_CONSTANTS.PORTAL.VOID.CHAR) {
                        classes.push('player-on-void');
                    }
                } else if (monster) {
                    // モンスタータイル
                    let displayChar = monster.char;
                    style = `color: ${GAME_CONSTANTS.COLORS.MONSTER[monster.type]}; opacity: 1;`;
                    
                    if (monster.hasStartedFleeing) {
                        classes.push('fleeing-monster');
                        style += `; --char: '${monster.char}'`;
                    }
                    
                    if (monster.isSleeping) {
                        style += '; animation: sleeping-monster 1s infinite';
                    }
                    content = displayChar;
                }
                
                // 必要なスタイルと位置情報を追加
                style += `; grid-row: ${y + 1}; grid-column: ${x + 1};`;
                
                // キャッシュと比較して変更があるか確認
                const existingTile = existingTiles[key];
                const previousState = this.tileStateCache[key];
                
                // キャッシュに現在の状態を保存
                tileState[key] = {
                    content,
                    style,
                    classes,
                    isVisible: true
                };
                
                // 前回の状態と比較して変更があれば更新リストに追加
                if (existingTile) {
                    if (!previousState || 
                        previousState.content !== content || 
                        previousState.classes.join(' ') !== classes.join(' ')) {
                        updatesToDo.push({
                            element: existingTile,
                            content,
                            classes,
                            style
                        });
                    }
                }
            } else if (isExplored) {
                // 探索済みだが現在見えていないタイル
                content = this.game.tiles[y][x];
                opacity = 0.3;
                style = `color: ${this.game.colors[y][x]}; opacity: ${opacity}; grid-row: ${y + 1}; grid-column: ${x + 1};`;
                
                // キャッシュに現在の状態を保存
                tileState[key] = {
                    content,
                    style,
                    classes,
                    isVisible: true
                };
                
                // キャッシュと比較
                const existingTile = existingTiles[key];
                const previousState = this.tileStateCache[key];
                
                if (existingTile) {
                    // 探索済みタイルも更新
                    if (!previousState || previousState.content !== content) {
                        updatesToDo.push({
                            element: existingTile,
                            content,
                            classes,
                            style
                        });
                    }
                }
            }
        });
        
        // 更新が必要なタイルだけをバッチ処理で更新
        if (updatesToDo.length > 0) {
            // DOMの更新を一度に行う
            updatesToDo.forEach(update => {
                update.element.textContent = update.content;
                update.element.className = update.classes.join(' ');
                // スタイルは変更がある場合のみ更新（コストが高い）
                if (update.style !== update.element.getAttribute('style')) {
                    update.element.setAttribute('style', update.style);
                }
            });
        }
        
        // キャッシュを部分的に更新
        Object.assign(this.tileStateCache, tileState);
    }

    renderMap() {
        const container = document.getElementById('game');
        container.style.position = 'relative';
        
        // 高速モードが有効な場合は簡易更新のみ（forceFullRenderが立っている場合を除く）
        if (this.fastRenderMode && !this.forceFullRender) {
            this.renderMapFast();
            return;
        }
        
        // デバッグ用にゲームの高さを出力
        //console.log('Game height:', this.game.height, 'CONSTANTS height:', GAME_CONSTANTS.DIMENSIONS.HEIGHT);
        
        // フロア変更の検出
        const floorChanged = this.lastFloorLevel !== this.game.floorLevel || this.forceFullRender;
        this.lastFloorLevel = this.game.floorLevel;
        
        // マップ表示のためのCSSを設定
        container.style.display = 'grid';
        container.style.gridTemplateRows = `repeat(${GAME_CONSTANTS.DIMENSIONS.HEIGHT}, 1fr)`;
        container.style.gridTemplateColumns = `repeat(${GAME_CONSTANTS.DIMENSIONS.WIDTH}, 1fr)`;
        container.style.gap = '0';
        
        // 可視タイルを取得（キャッシュ化の候補）
        const visibleTiles = new Set(
            this.game.getVisibleTiles().map(({ x, y }) => `${x},${y}`)
        );

        const px = this.game.player.x;
        const py = this.game.player.y;
        const currentRoom = this.game.getCurrentRoom();

        // 既存の要素を再利用するための処理
        const existingTiles = {};
        const existingElements = container.querySelectorAll('span');
        
        // フロア変更時は強制的に全タイルを削除
        if (floorChanged) {
            console.log(`Floor changed: ${this.lastFloorLevel} or forced refresh. Rebuilding all tiles...`);
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            // タイル状態のキャッシュをクリア
            this.tileStateCache = {};
            // 探索状態のハッシュを更新
            this.exploredStateHash = this.effects.calculateExploredHash();
        } else {
            // 既存の要素をマップに登録
            existingElements.forEach(element => {
                const x = parseInt(element.dataset.x);
                const y = parseInt(element.dataset.y);
                existingTiles[`${x},${y}`] = element;
            });
        }
        
        // 現在の表示状態をキャッシュ
        const tileState = {};
        const isFirstRender = existingElements.length === 0 || floorChanged;
        
        // DOM操作を一括で行うためのコンテナ
        const fragment = document.createDocumentFragment();
        
        // レンダリングが必要なタイルの追跡
        let hasChanges = isFirstRender;
        
        // バッチ更新のための配列
        const updatesToApply = [];
        
        // タイルの状態を構築
        for (let y = 0; y < GAME_CONSTANTS.DIMENSIONS.HEIGHT; y++) {
            for (let x = 0; x < GAME_CONSTANTS.DIMENSIONS.WIDTH; x++) {
                const isVisible = visibleTiles.has(`${x},${y}`);
                const isExplored = this.game.explored[y][x];
                const isHighlighted = this.highlightedTile &&
                    this.highlightedTile.x === x &&
                    this.highlightedTile.y === y;

                // 表示するタイルのみ処理する（最適化）
                if (!isVisible && !isExplored) continue;

                let content = '';
                let style = '';
                let classes = [];
                let backgroundColor = '';
                let opacity = 1.0;
                let tileKey = `${x},${y}`;

                // ランドマークターゲットモードの場合、探索済みなら描画
                if (this.game.inputHandler.landmarkTargetMode && isExplored) {
                    content = this.game.tiles[y][x];
                    backgroundColor = isHighlighted ? 'rgba(0, 255, 0, 0.6)' : 'var(--dark-background)'; // 背景色
                    if (GAME_CONSTANTS.TILES.WALL.includes(content) || GAME_CONSTANTS.TILES.FLOOR.includes(content) ||
                        GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(content) || GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(content)) {
                        style = `color:rgba(0, 255, 0, 0.35);`; // 壁はコンソールっぽい緑
                        backgroundColor = 'var(--dark-background)';
                    }
                    
                    if (content === GAME_CONSTANTS.TILES.DOOR.CLOSED ||
                        content === GAME_CONSTANTS.TILES.DOOR.OPEN ||
                        content === GAME_CONSTANTS.STAIRS.CHAR ||
                        content === GAME_CONSTANTS.PORTAL.GATE.CHAR ||
                        content === GAME_CONSTANTS.PORTAL.VOID.CHAR ||
                        content === GAME_CONSTANTS.NEURAL_OBELISK.CHAR) {
                        style = `color: #00ff00; opacity: 0.5`; // ランドマークはコンソールっぽい緑
                    }
                } else if (this.game.player.rangedCombat.isActive && isVisible) {
                    content = this.game.tiles[y][x];
                    
                    // 遠距離攻撃モードの場合は射程範囲内かどうかをチェック
                    const isInRange = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                        this.game.player.x, 
                        this.game.player.y, 
                        x, 
                        y
                    ) <= this.game.player.rangedCombat.range;

                    // 射程範囲内の場合は明るい緑、範囲外は暗い緑
                    const highlightColor = isInRange ? 'rgba(0, 255, 0, 0.6)' : 'rgba(0, 100, 0, 0.3)';
                    backgroundColor = isHighlighted ? highlightColor : 'var(--dark-background)';

                    // プレイヤーの位置の場合は優先的に描画
                    if (x === this.game.player.x && y === this.game.player.y) {
                        content = '@';
                        style = 'color: #fff; opacity: 1';  // プレイヤーは常に白色で明るく表示
                    } else if (GAME_CONSTANTS.TILES.WALL.includes(content) || 
                        GAME_CONSTANTS.TILES.FLOOR.includes(content) ||
                        GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(content) || 
                        GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(content)) {
                        style = `color:rgba(0, 255, 0, ${isInRange ? 0.35 : 0.2});`; // 射程範囲内外で明るさを変える
                        backgroundColor = 'var(--dark-background)';
                    }
                    
                    // モンスターの場合は特別な表示
                    const monster = this.game.getMonsterAt(x, y);
                    if (monster) {
                        content = monster.char;
                        style = `color: ${isInRange ? '#ff4444' : '#662222'}`; // 射程範囲内は明るい赤、範囲外は暗い赤
                    }
                    
                    // ターゲットのハイライト
                    if (this.game.player.rangedCombat.target &&
                        x === this.game.player.rangedCombat.target.x && 
                        y === this.game.player.rangedCombat.target.y) {
                        classes.push('target-highlight');
                        if (monster) {
                            backgroundColor = 'rgba(255, 0, 128, 0.8)'; // ネオンピンク
                            style += '; text-shadow: 0 0 8px #ff0080'; // ネオングロー効果
                        }
                    }

                    // 射線のハイライト
                    if (this.game.player.rangedCombat.target) {
                        const linePoints = this.game.getLinePoints(
                            this.game.player.x,
                            this.game.player.y,
                            this.game.player.rangedCombat.target.x,
                            this.game.player.rangedCombat.target.y
                        );

                        // 射線上のポイントかどうかをチェック
                        const isOnLine = linePoints.some(point => point.x === x && point.y === y);
                        if (isOnLine) {
                            backgroundColor = backgroundColor || 'var(--dark-background)';
                            backgroundColor = 'rgba(0, 255, 255, 0.6)'; // サイバーブルー
                            style += '; text-shadow: 0 0 5px #00ffff'; // ネオングロー効果
                        }
                    }
                    
                    if (content === GAME_CONSTANTS.TILES.DOOR.CLOSED ||
                        content === GAME_CONSTANTS.TILES.DOOR.OPEN ||
                        content === GAME_CONSTANTS.STAIRS.CHAR ||
                        content === GAME_CONSTANTS.PORTAL.GATE.CHAR ||
                        content === GAME_CONSTANTS.PORTAL.VOID.CHAR ||
                        content === GAME_CONSTANTS.NEURAL_OBELISK.CHAR) {
                        style = `color: #00ff00; opacity: ${isInRange ? 0.5 : 0.3}`; // 射程範囲内外で明るさを変える
                    }
                } else if (isVisible) {
                    // タイルごとに部屋を判定する
                    const roomAtTile = this.game.getRoomAt(x, y);
                    const tileVisibility = (currentRoom && roomAtTile && roomAtTile === currentRoom) ? currentRoom.brightness : 3;

                    const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(x, y, px, py);

                    // 基本的な明るさを計算
                    let baseOpacity;
                    if (distance <= 1) {
                        baseOpacity = 1.0;
                    } else if (distance <= tileVisibility * 0.4) {
                        baseOpacity = 0.9;
                    } else if (distance <= tileVisibility * 0.7) {
                        baseOpacity = 0.7;
                    } else {
                        baseOpacity = 0.5;
                    }

                    // 灯りエフェクトの計算
                    const { opacity: tileOpacity, color: flickerColor } = this.calculateFlicker(baseOpacity, x, y);
                    opacity = tileOpacity;
                    backgroundColor = flickerColor;

                    content = this.game.tiles[y][x];
                    style = `color: ${this.game.colors[y][x]}`;

                    // プレイヤー、モンスター、エフェクトの場合は常に最大の明るさを使用
                    if (x === this.game.player.x && y === this.game.player.y ||
                        this.game.getMonsterAt(x, y) ||
                        isHighlighted ||
                        content === GAME_CONSTANTS.PORTAL.GATE.CHAR ||
                        content === GAME_CONSTANTS.PORTAL.VOID.CHAR ||
                        content === GAME_CONSTANTS.STAIRS.CHAR ||
                        Array.from(this.movementEffects).some(effect => effect.x === x && effect.y === y)) {
                        opacity = 1.0;
                    }

                    // プレイヤー、モンスター、ハイライトの場合は opacity を上書きする処理はそのまま
                    if (x === this.game.player.x && y === this.game.player.y) {
                        content = this.game.player.char;
                        const healthStatus = this.game.player.getHealthStatus(this.game.player.hp, this.game.player.maxHp);
                        style = `color: ${healthStatus.color}; opacity: 1; text-shadow: 0 0 5px ${backgroundColor}`;

                        // プレイヤーがポータル上にいる場合、特別なクラスを追加
                        if (this.game.tiles[y][x] === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                            classes.push('player-on-portal');
                        } else if (this.game.tiles[y][x] === GAME_CONSTANTS.PORTAL.VOID.CHAR) {
                            classes.push('player-on-void');
                        }
                    } else {
                        // 残像エフェクトの描画
                        const trailEffect = Array.from(this.movementEffects).find(effect => effect.x === x && effect.y === y);
                        if (trailEffect) {
                            content = this.game.player.char;
                            style = `color: ${GAME_CONSTANTS.COLORS.PLAYER}; opacity: ${trailEffect.opacity}; text-shadow: 0 0 5px ${backgroundColor}`;
                        } else {
                            const monster = this.game.getMonsterAt(x, y);
                            if (monster) {
                                // 逃走中のモンスターの場合、CSSクラスを追加
                                let displayChar = monster.char;
                                let monsterOpacity = 1;
                                style = `color: ${GAME_CONSTANTS.COLORS.MONSTER[monster.type]}; opacity: ${monsterOpacity}; text-shadow: 0 0 5px ${backgroundColor}`;

                                if (monster.hasStartedFleeing) {
                                    classes.push('fleeing-monster');
                                    // data-char属性に元の文字を保存
                                    style += `; --char: '${monster.char}'`;
                                }

                                if (monster.isSleeping) {
                                    style += '; animation: sleeping-monster 1s infinite';
                                }
                                
                                // モンスターが蜘蛛の巣に捕まっている場合、monster-caught-webクラスを追加
                                if (monster.caughtInWeb && monster.type !== 'G_SPIDER') {
                                    classes.push('monster-caught-web');
                                }
                                
                                content = displayChar; // 表示用の文字を content に設定
                            } else {
                                const psychedelicEffect = this.calculatePsychedelicEffect(x, y, content, this.game.colors[y][x], true);
                                content = psychedelicEffect.char;
                                style = `color: ${psychedelicEffect.color}; opacity: ${opacity}; text-shadow: 0 0 5px ${backgroundColor}`;

                                if (content === GAME_CONSTANTS.STAIRS.CHAR) {
                                    style = `color: ${GAME_CONSTANTS.STAIRS.COLOR}; opacity: ${opacity}; text-shadow: 0 0 5px ${backgroundColor}`;
                                }
                            }
                        }
                    }

                    if (isHighlighted) {
                        const targetDistance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(x, y, this.game.player.x, this.game.player.y);

                        if (this.game.inputHandler.targetingMode === 'look') {
                            backgroundColor = `linear-gradient(${backgroundColor || 'transparent'}, rgba(255, 255, 255, 1))`;
                        } else {
                            const skillId = this.game.inputHandler.targetingMode;
                            const skill = this.game.codexSystem.findSkillById(skillId);
                            const range = skill && skill.getRange 
                                ? skill.getRange(this.game.player) 
                                : (skill ? skill.range : 1);
                            const highlightColor = targetDistance <= range &&
                                !GAME_CONSTANTS.TILES.WALL.includes(this.game.tiles[y][x]) &&
                                !GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.game.tiles[y][x]) &&
                                this.game.tiles[y][x] !== GAME_CONSTANTS.TILES.DOOR.CLOSED &&
                                !GAME_CONSTANTS.TILES.SPACE.includes(this.game.tiles[y][x]) &&
                                !GAME_CONSTANTS.TILES.CYBER_WALL.includes(this.game.tiles[y][x])
                                ? 'rgba(46, 204, 113, 1)'  // 範囲内：緑
                                : 'rgba(231, 76, 60, 1)'; // 範囲外：赤
                            backgroundColor = `linear-gradient(${backgroundColor || 'transparent'}, ${highlightColor})`;
                        }
                    }

                    if (content === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                        style += '; opacity: ' + opacity;
                        classes.push('portal-tile');
                    } else if (content === GAME_CONSTANTS.PORTAL.VOID.CHAR) {
                        style += '; opacity: ' + opacity;
                        classes.push('void-tile');
                    } else if (content === GAME_CONSTANTS.NEURAL_OBELISK.CHAR) {
                        style += '; opacity: ' + opacity;
                        classes.push('neural-obelisk-tile');
                        
                        // ニューラルオベリスクのレベルに応じたクラスを追加
                        const obelisk = this.game.neuralObelisks && 
                            this.game.neuralObelisks.find(o => o.x === x && o.y === y);
                        
                        if (obelisk) {
                            classes.push(`neural-obelisk-level-${obelisk.level}`);
                        } else {
                            // デフォルトはレベル3（黄色）
                            classes.push('neural-obelisk-level-3');
                        }
                    }

                                    // 遠距離攻撃のターゲットハイライトを tileState に追加
                    if (this.game.player.rangedCombat.isActive && this.game.player.rangedCombat.target) {
                        const target = this.game.player.rangedCombat.target;
                        const tileKey = `${target.x},${target.y}`;
                        
                        if (tileState[tileKey]) {

                                            tileState[tileKey].classes.push('target-highlight');
                            // モンスターの場合は赤いハイライト
                            if (this.game.getMonsterAt(target.x, target.y)) {
                                tileState[tileKey].style += 'background-color: rgba(255, 100, 100, 0.3);';
                            }
                        }
                    }
                       
                    // 蜘蛛の巣の描画
                    const web = this.game.webs && this.game.webs.find(w => w.x === x && w.y === y);
                    if (web) {
                        // プレイヤーが捕まっている場合は特別なクラスを追加
                        if (this.game.player.caughtInWeb && 
                            this.game.player.caughtInWeb.x === x && 
                            this.game.player.caughtInWeb.y === y) {
                            classes.push('player-caught-web');
                        } else {
                            // モンスターが捕まっているかチェック
                            const monster = this.game.getMonsterAt(x, y);
                            if (monster && monster.caughtInWeb && monster.type !== 'G_SPIDER') {
                                classes.push('monster-caught-web');
                            } else {
                                classes.push('web-tile'); // 通常の蜘蛛の巣のアニメーションクラス
                            }
                        }
                        
                        // 蜘蛛の巣の文字を上書き
                        content = GAME_CONSTANTS.WEB.CHAR;
                        
                        // プレイヤーが捕まっている場合、プレイヤーの健康状態の色を使用
                        if (this.game.player.caughtInWeb && 
                            this.game.player.caughtInWeb.x === x && 
                            this.game.player.caughtInWeb.y === y) {
                            
                            // プレイヤーの健康状態を取得
                            const healthStatus = this.game.player.getHealthStatus(
                                this.game.player.hp, 
                                this.game.player.maxHp
                            );
                            
                            // 健康状態の色を直接使用
                            style = `color: ${healthStatus.color}; opacity: ${opacity}`;
                            console.log(`Web color set to player health: ${healthStatus.color}`); // デバッグログ
                        } else {
                            // 通常の蜘蛛の巣の色を設定
                            style = `color: ${GAME_CONSTANTS.WEB.COLOR}; opacity: ${opacity}`;
                        }
                        
                        if (backgroundColor) {
                            style += `; background: ${backgroundColor}`;
                        }
                        
                        // グリッド位置を指定
                        style += `; grid-row: ${y + 1}; grid-column: ${x + 1};`;
                    }
                } else if (isExplored) {
                    opacity = 0.3;
                    content = this.game.tiles[y][x];
                    style = `color: ${this.game.colors[y][x]}; opacity: ${opacity}`;
                }

                style += `; opacity: ${opacity}`;
                if (backgroundColor) {
                    style += `; background: ${backgroundColor}`;
                }

                // グリッド位置を指定
                style += `; grid-row: ${y + 1}; grid-column: ${x + 1};`;

                const isDoorKillTarget = this.game.lastDoorKillLocation &&
                    this.game.lastDoorKillLocation.x === x &&
                    this.game.lastDoorKillLocation.y === y;

                if (isDoorKillTarget) {
                    classes.push('door-kill');
                }

                const isAttackTarget = this.game.lastAttackLocation &&
                    this.game.lastAttackLocation.x === x &&
                    this.game.lastAttackLocation.y === y;

                // takeDamageの結果に基づいてエフェクトを表示
                if (isAttackTarget && this.game.lastAttackResult) {
                    if (this.game.lastAttackResult.damage >= 0) {
                        classes.push('damage');
                    }
                    if (this.game.lastAttackResult.killed) {
                        classes.push('killed');
                    }
                    if (this.game.lastAttackResult.newlyFled) {
                        classes.push('fled');
                    }
                }

                // タイルの状態をキャッシュする
                tileState[tileKey] = {
                    content,
                    style,
                    classes,
                    isVisible: isVisible || isExplored
                };
                
                // 変更があるかチェック（最初のレンダリング時やフロア変更時はスキップ）
                const existingTile = existingTiles[tileKey];
                const previousState = this.tileStateCache[tileKey];
                
                if (!isFirstRender && existingTile && previousState) {
                    // 前回のレンダリング状態と比較して変更を検出
                    const contentChanged = previousState.content !== content;
                    const classChanged = previousState.classes.join(' ') !== classes.join(' ');
                    const styleChanged = previousState.style !== style;
                    
                    if (contentChanged || classChanged || styleChanged) {
                        hasChanges = true;
                        
                        // 更新すべきタイルを記録
                        updatesToApply.push({
                            element: existingTile,
                            content,
                            classes,
                            style
                        });
                    }
                }
            }
        }

        // タイル状態をキャッシュに保存（次回のレンダリング比較用）
        this.tileStateCache = tileState;

        // 変更がなければ早期リターン（最初のレンダリング時やフロア変更時は必ず実行）
        if (!isFirstRender && !hasChanges) {
            return;
        }
        
        // 変更があった場合のみDOMを更新
        
        // 方法1: 既存の要素を更新し、新しい要素を追加（最も効率的）
        if (!isFirstRender) {
            // バッチ更新 - 既存の要素を更新
            if (updatesToApply.length > 0) {
                // アップデートを一度に適用（DOM操作を最小化）
                updatesToApply.forEach(update => {
                    update.element.textContent = update.content;
                    update.element.className = update.classes.join(' ');
                    update.element.setAttribute('style', update.style);
                });
            }
            
            // 新しい要素の作成
            for (let y = 0; y < GAME_CONSTANTS.DIMENSIONS.HEIGHT; y++) {
                for (let x = 0; x < GAME_CONSTANTS.DIMENSIONS.WIDTH; x++) {
                    const tileKey = `${x},${y}`;
                    const state = tileState[tileKey];
                    
                    // 表示するタイルのみ処理
                    if (!state || !state.isVisible) continue;
                    
                    // 既存のタイルがなく、新規作成が必要なもののみ処理
                    if (!existingTiles[tileKey]) {
                        // 新しい要素を作成
                        const tile = document.createElement('span');
                        tile.dataset.x = x;
                        tile.dataset.y = y;
                        tile.textContent = state.content;
                        tile.className = state.classes.join(' ');
                        tile.setAttribute('style', state.style);
                        fragment.appendChild(tile);
                    }
                }
            }
            
            // 新しい要素のみを追加
            if (fragment.childNodes.length > 0) {
                container.appendChild(fragment);
            }
        } else {
            // 初回レンダリング時やフロア変更時は一括でHTML生成（より高速）
            let display = '';
            for (let y = 0; y < GAME_CONSTANTS.DIMENSIONS.HEIGHT; y++) {
                for (let x = 0; x < GAME_CONSTANTS.DIMENSIONS.WIDTH; x++) {
                    const tileKey = `${x},${y}`;
                    const state = tileState[tileKey];
                    
                    // 表示するタイルのみ処理
                    if (!state || !state.isVisible) continue;
                    
                    const dataAttrs = `data-x="${x}" data-y="${y}"`;
                    const classString = state.classes.length > 0 ? `class="${state.classes.join(' ')}"` : '';
                    display += `<span ${dataAttrs} ${classString} style="${state.style}">${state.content}</span>`;
                }
            }
            container.innerHTML = display;
        }
    }

    getCurrentRoom(x, y) {
        return this.game.rooms.find(room =>
            x >= room.x && x < room.x + room.width &&
            y >= room.y && y < room.y + room.height
        );
    }

    getHighlightColor(x, y) {
        const monster = this.game.getMonsterAt(x, y);
        if (monster) {
            if (monster.isSleeping) {
                return 'rgba(100, 100, 255, 0.3)';  // Blueish background for sleeping monsters
            }
            return 'rgba(255, 100, 100, 0.3)';  // Reddish background for normal monsters
        }
        return 'rgba(255, 255, 255, 0.2)';  // Standard highlight
    }

    // renderer.js の renderStatus メソッド内を修正

renderStatus() {
    const player = this.game.player;
    const statusPanel = document.getElementById('status-panel');
    if (!statusPanel) return;

    // 既存の計算部分
    const surroundingMonsters = player.countSurroundingMonsters(this.game);
    const penaltyPerMonster = 15;
    const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

    // 既存のステータス計算
    const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[this.game.dangerLevel];
    const floorDisplay = this.game.floorLevel === 0 ? "< THE NEXUS >" : this.game.floorLevel;
    const healthStatus = player.getHealthStatus(player.hp, player.maxHp);
    const vigorStatus = GAME_CONSTANTS.VIGOR.getStatus(player.vigor, player.stats);
    const size = GAME_CONSTANTS.FORMULAS.SIZE(player.stats);
    const sizeInfo = GAME_CONSTANTS.COLORS.SIZE[size.value];
    const baseSpeed = GAME_CONSTANTS.FORMULAS.SPEED(player.stats);
    const speedInfo = GAME_CONSTANTS.COLORS.SPEED[baseSpeed.value];

    // 既存の計算を維持
    const hpBars = Math.ceil((player.hp / player.maxHp) * 20);
    const hpText = '|'.repeat(Math.max(0, hpBars)).padEnd(20, ' ');

    // Attack modifiers
    let attackText = `${player.attackPower.base}+${player.attackPower.diceCount}d${player.attackPower.diceSides}`;
    let totalDamageMod = 1;
    if (player.nextAttackModifiers?.length > 0) {
        for (const mod of player.nextAttackModifiers) {
            if (mod.damageMod) totalDamageMod *= mod.damageMod;
        }
        if (totalDamageMod !== 1) {
            const damageColor = totalDamageMod > 1 ? '#2ecc71' : '#e74c3c';
            attackText = `<span style="color: ${damageColor}">${player.attackPower.base}+${player.attackPower.diceCount}d${player.attackPower.diceSides} ×${totalDamageMod.toFixed(1)}</span>`;
        }
    }

    // Speed modifiers
    let speedText = `<span style="color: ${speedInfo.color}">${speedInfo.name}</span>`;
    if (player.nextAttackModifiers?.length > 0) {
        const speedTierMod = player.nextAttackModifiers.find(mod => mod.speedTier);
        if (speedTierMod) {
            const modInfo = GAME_CONSTANTS.COLORS.SPEED[speedTierMod.speedTier];
            speedText = `<span style="color: ${modInfo.color}">${modInfo.name}</span>`;
        }
    }

    // Accuracy calculation with penalties
    const baseAccuracy = Math.floor(player.accuracy * (1 - surroundingPenalty));
    let accText = surroundingPenalty > 0
        ? `<span style="color: #e74c3c">${baseAccuracy}%</span>`
        : `${baseAccuracy}%`;

    // 通常ステータスまたは遠距離攻撃ステータスを表示（モードによって切り替え）
    const combatStatsHTML = player.rangedCombat.isActive 
        ? this.createRangedCombatStats(player)
        : this.createNormalCombatStats(player, attackText, accText, speedText, sizeInfo);

    // 敵情報の取得
    const nearbyEnemiesHTML = this.getNearbyEnemiesHTML();

    statusPanel.innerHTML = `
        <div class="basic-info">
            <div class="section-title">STATUS</div>
            <div class="info-row">
                <span class="label">Name:</span>
                <span id="player-name">${player.name || 'Unknown'}</span>
            </div>
            <div class="info-row">
                <span class="label">Floor:</span>
                <span id="floor-level">${floorDisplay} <span style="color: ${dangerInfo.color}">[${dangerInfo.name}]</span></span>
            </div>
            <div class="info-row">
                <span class="label">Level:</span>
                <span id="level">${player.level}</span>
            </div>
        </div>

        <div class="vitals-section">
            <div class="hp-bar">
                <div class="hp-numbers">
                    HP: <span id="hp">${player.hp}</span>/<span id="max-hp">${player.maxHp}</span>
                </div>
                <span id="hp-text" class="bar ${healthStatus.name.toLowerCase().replace(' ', '-')}">${hpText}</span>
            </div>
            <div class="status-text">
                <div class="status-row">
                    <span class="label">Health:</span>
                    <span id="health-status" style="color: ${healthStatus.color}">${healthStatus.name}</span>
                </div>
                <div class="status-row">
                    <span class="label">Vigor:</span>
                    <span id="vigor-status">
                        <span style="color: ${vigorStatus.color}">[${vigorStatus.ascii}]</span>
                        <span class="bar ${vigorStatus.name.toLowerCase().replace(' ', '-')}"></span>
                    </span>
                </div>
            </div>
        </div>

        <div class="progress-section">
            <div class="xp-row">
                <span class="label">XP:</span>
                <span id="xp">${player.xp}/${player.xpToNextLevel}</span>
            </div>
            <div class="codex-row">
                <span class="label">CODEX:</span>
                <span id="codexPoints">${player.codexPoints}</span>
            </div>
        </div>

        ${combatStatsHTML}

        <div class="enemy-info">
            <div class="section-title">ENEMIES</div>
            ${nearbyEnemiesHTML}
        </div>
    `;

    // スキルリストの更新
    const skillsElement = document.getElementById('skills');
    if (skillsElement) {
        const skillsDisplay = player.skills.size > 0
            ? Array.from(player.skills.entries())
                .filter(([slot]) => /^[1-9]$/.test(slot))
                .map(([slot, skillData]) => {
                    const skill = this.game.codexSystem.findSkillById(skillData.id);
                    const cooldownText = skillData.remainingCooldown > 0
                        ? ` (CD: ${skillData.remainingCooldown})`
                        : '';
                    const effectText = skill.getEffectText(player);

                    // スキルカテゴリーの色を取得
                    let categoryColor;
                    for (let cat in this.game.codexSystem.categories) {
                        if (this.game.codexSystem.categories[cat].skills.some(s => s.id === skill.id)) {
                            categoryColor = GAME_CONSTANTS.COLORS.CODEX_CATEGORY[cat];
                            break;
                        }
                    }

                    // スロットの使用可否判定
                    const isAvailable = skillData.remainingCooldown === 0 &&
                        (skill.id !== 'meditation' || player.hp < player.maxHp || player.vigor < GAME_CONSTANTS.VIGOR.MAX);
                    const slotClass = isAvailable ? 'skill-slot available' : 'skill-slot';

                    return `[<span class="${slotClass}">${slot}</span>] ` +
                        `<span style="color: ${categoryColor}">${skill.name[0]}</span>${skill.name.slice(1)} ${effectText}${cooldownText}`;
                })
                .join('<br>')
            : 'NO SKILLS';
        skillsElement.innerHTML = skillsDisplay;
    }
}

// 通常戦闘ステータスセクションの作成（新規メソッド）
createNormalCombatStats(player, attackText, accText, speedText, sizeInfo) {
    // surroundingsペナルティの計算
    const surroundingMonsters = player.countSurroundingMonsters(this.game);
    const penaltyPerMonster = 15; // 1体につき15%のペナルティ
    const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

    // ペナルティ適用後のEVA値を計算
    const baseEvasion = player.evasion;
    const penalizedEvasion = Math.floor(baseEvasion * (1 - surroundingPenalty));
    const evaText = surroundingPenalty > 0
        ? `<span style="color: #e74c3c">${penalizedEvasion}%</span>`
        : `${baseEvasion}%`;

    return `
        <div class="stats-grid">
            <div class="stat-row">
                <span class="label">STR:</span>
                <span id="str">${player.stats.str}</span>
            </div>
            <div class="stat-row">
                <span class="label">DEX:</span>
                <span id="dex">${player.stats.dex}</span>
            </div>
            <div class="stat-row">
                <span class="label">CON:</span>
                <span id="con">${player.stats.con}</span>
            </div>
            <div class="stat-row">
                <span class="label">INT:</span>
                <span id="int">${player.stats.int}</span>
            </div>
            <div class="stat-row">
                <span class="label">WIS:</span>
                <span id="wis">${player.stats.wis}</span>
            </div>
            <div class="stat-row">
                <span class="label">SIZE:</span>
                <span id="size" style="color: ${sizeInfo.color}">${sizeInfo.name}</span>
            </div>
        </div>

        <div class="derived-stats-grid">
            <div class="stat-row">
                <span class="label">ATK:</span>
                <span id="attack">${attackText}</span>
            </div>
            <div class="stat-row">
                <span class="label">DEF:</span>
                <span id="defense">${player.defense.base}+${player.defense.diceCount}d${player.defense.diceSides}</span>
            </div>
            <div class="stat-row">
                <span class="label">ACC:</span>
                <span id="accuracy">${accText}</span>
            </div>
            <div class="stat-row">
                <span class="label">EVA:</span>
                <span id="evasion">${evaText}</span>
            </div>
            <div class="stat-row">
                <span class="label">PER:</span>
                <span id="perception">${player.perception}</span>
            </div>
            <div class="stat-row">
                <span class="label">SPD:</span>
                <span id="speed">${speedText}</span>
            </div>
        </div>
    `;
}

// 遠距離攻撃セクションの作成（新規メソッド）
createRangedCombatStats(player) {
    const rangedCombat = player.rangedCombat;
    if (!rangedCombat) return '';

    // エネルギーバーの計算
    const energyPercent = (rangedCombat.energy.current / rangedCombat.energy.max) * 100;

    // 命中率の計算（ターゲットがいる場合はサイズ補正を含める）
    let accuracyDisplay = `${rangedCombat.accuracy}%`;
    if (rangedCombat.isActive && rangedCombat.target) {
        const target = this.game.getMonsterAt(rangedCombat.target.x, rangedCombat.target.y);
        if (target) {
            // サイズ補正を計算
            const sizeModifier = GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.SIZE_ACCURACY_MODIFIER(target.stats);
            const finalAccuracy = Math.min(95, Math.max(5, rangedCombat.accuracy + sizeModifier));
            
            // サイズ補正に応じて色を変更
            if (sizeModifier !== 0) {
                accuracyDisplay = `<span style="color: ${sizeModifier > 0 ? '#2ecc71' : '#e74c3c'}">${finalAccuracy}%</span>`;
            } else {
                accuracyDisplay = `${finalAccuracy}%`;
            }
        }
    }

    // 速度情報の計算
    const baseSpeed = GAME_CONSTANTS.FORMULAS.SPEED(player.stats);
    const rangedSpeed = {
        value: Math.max(1, baseSpeed.value - 1),
        name: GAME_CONSTANTS.COLORS.SPEED[Math.max(1, baseSpeed.value - 1)].name
    };
    const speedInfo = GAME_CONSTANTS.COLORS.SPEED[rangedSpeed.value];

    // 速度表示の作成（基本速度→遠距離速度）
    const speedDisplay = `<span style="color: ${GAME_CONSTANTS.COLORS.SPEED[baseSpeed.value].color}">${baseSpeed.name}</span> → ` +
                           `<span style="color: ${speedInfo.color}">${rangedSpeed.name}</span> [Ranged]`;

    // 周囲のモンスターによるペナルティを計算
    const surroundingMonsters = player.countSurroundingMonsters(this.game);
    let penaltyText = '';
    if (surroundingMonsters > 1) {
        const penaltyPerMonster = 15;
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster));
    }

    // ターゲット情報
    let targetInfo = '';
    if (rangedCombat.isActive && rangedCombat.target) {
        const target = this.game.getMonsterAt(rangedCombat.target.x, rangedCombat.target.y);
        if (target) {
            const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                player.x, player.y,
                rangedCombat.target.x, rangedCombat.target.y
            );
            targetInfo = `<div class="target-info"><span style="color: #f1c40f">Target: ${target.name} (${distance} tiles away)</span></div>`;
        }
    }

    return `
        <div class="ranged-combat-section">
            <div class="energy-bar">
                <div class="energy-numbers">${Math.floor(rangedCombat.energy.current)}/${rangedCombat.energy.max}</div>
                <div class="bar-container">
                    <div class="bar" style="width: ${energyPercent}%"></div>
                </div>
            </div>
            <div class="ranged-stats-grid">
                <div class="ranged-info">ATK: <span class="value">${rangedCombat.attack.base}+${rangedCombat.attack.dice.count}d${rangedCombat.attack.dice.sides}</span></div>
                <div class="ranged-info">ACC: <span class="value">${accuracyDisplay}</span></div>
                <div class="ranged-info">Range: <span class="value">${rangedCombat.range}</span></div>
                <div class="ranged-info">Cost: <span class="value">${rangedCombat.energy.cost}/shot</span></div>
                <div class="ranged-info">SPD: <span class="value">${speedDisplay}</span></div>
            </div>
            <div class="ranged-info">Recharge: <span class="value">${rangedCombat.energy.rechargeRate}/turn</span></div>
            ${targetInfo}
            ${penaltyText}
        </div>
    `;
}

    getNearbyEnemiesHTML() {
        // 視界内のタイルを取得
        const visibleTiles = this.game.getVisibleTiles();
        const visibleTilesSet = new Set(visibleTiles.map(({ x, y }) => `${x},${y}`));

        // 視界内のモンスターのみをフィルタリング
        const visibleMonsters = this.game.monsters
            .filter(monster => {
                const monsterKey = `${monster.x},${monster.y}`;
                // モンスターが視界内のタイルにいるかどうかを判定
                return visibleTilesSet.has(monsterKey);
            })
            .map(monster => ({
                ...monster,
                distance: GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                    this.game.player.x,
                    this.game.player.y,
                    monster.x,
                    monster.y
                )
            }))
            .sort((a, b) => a.distance - b.distance);

        if (visibleMonsters.length === 0) {
            return '<div id="nearby-enemies">No monsters in sight</div>';
        }

        const monsterList = visibleMonsters.map(monster => {
            const hpPercentage = (monster.hp / monster.maxHp) * 100;
            const healthStatus = this.getMonsterHealthStatus(hpPercentage);
            const healthClass = healthStatus.name.toLowerCase().replace(' ', '-');

            const sleepStatus = monster.isSleeping ? 'Zzz' : '';
            const fleeingStatus = monster.hasStartedFleeing ? '>>' : '';
            const monsterSymbol = monster.char || 'M';
            const monsterColor = GAME_CONSTANTS.COLORS.MONSTER[monster.type];

            const dx = monster.x - this.game.player.x;
            const dy = monster.y - this.game.player.y;
            const direction = this.getDirectionIndicator(dx, dy);
            const directionColor = this.getDirectionColor(monster.distance);

            const hpBars = Math.ceil((monster.hp / monster.maxHp) * 20);
            const hpText = '|'.repeat(hpBars).padEnd(20, ' ');

            // ターゲット中のモンスターかどうかをチェック
            const isTargeted = this.game.player.rangedCombat.isActive && 
                this.game.player.rangedCombat.target &&
                monster.x === this.game.player.rangedCombat.target.x && 
                monster.y === this.game.player.rangedCombat.target.y;

            // ターゲット中のモンスターの場合、lookinfoに情報を表示
            if (isTargeted) {
                this.examineTarget(monster.x, monster.y);
            }

            // モンスターの名前を表示（ターゲット中の場合は黄色の[]で囲む）
            const monsterName = isTargeted ? 
                `<span style="color: #ffff00">[${monster.name}]</span>` : 
                monster.name;

            return `<span style="color: ${monsterColor}">` +
                `<span style="color: ${directionColor}; display: inline-block; width: 2em">${direction}</span>[${monsterSymbol}] </span>` +
                `<span style="color: ${monsterColor}">${monsterName}</span> ${sleepStatus}${fleeingStatus} <br>` +
                `<div class="hp-bar">` +
                    `<div class="hp-numbers">HP: ${monster.hp}/${monster.maxHp}</div>` +
                    `<span class="bar ${healthClass}">${hpText}</span>` +
                `</div>`;
        }).join('');

        return `<div id="nearby-enemies">${monsterList}</div>`;
    }

    // モンスターの体力状態を取得するヘルパーメソッド
    getMonsterHealthStatus(hpPercentage) {
        if (hpPercentage <= 25) {
            return { name: 'Near Death', color: '#e74c3c' };
        } else if (hpPercentage <= 50) {
            return { name: 'Badly Wounded', color: '#e67e22' };
        } else if (hpPercentage <= 75) {
            return { name: 'Wounded', color: '#f1c40f' };
        }
        return { name: 'Healthy', color: '#2ecc71' };
    }

    renderCodexMenu() {
        const display = this.game.codexSystem.getMenuDisplay(this.game.player);  // Pass the player object
        document.getElementById('available-skills').innerHTML = display.replace(/\n/g, '<br>');
    }

    // New: Method to clean up effects
    clearEffects() {
        if (this.game.lastAttackLocation) {
            this.game.lastAttackLocation = null;
            this.game.lastAttackHit = false;  // フラグをリセット
        }
        this.render();
        // Clean up skill usage effect
        const playerChar = document.querySelector('#game-container [data-player="true"]');
        if (playerChar) {
            playerChar.classList.remove('next-attack-modifier');
        }
    }

    flashStatusPanel() {
        this.effects.flashStatusPanel();
    }

    // New method for next attack modifier effect
    showNextAttackModifierEffect(x, y) {
        const playerChar = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        console.log('Player char element for next attack modifier:', playerChar); // デバッグログを追加
        if (playerChar) {
            playerChar.classList.add('next-attack-modifier');
            console.log('Added next-attack-modifier class'); // デバッグログを有効化
        } else {
            console.log(`Could not find player element at ${x},${y}`); // 要素が見つからない場合のログ
            // 遅延実行を試みる
            setTimeout(() => {
                const delayedPlayerChar = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
                console.log('Delayed player char element:', delayedPlayerChar);
                if (delayedPlayerChar) {
                    delayedPlayerChar.classList.add('next-attack-modifier');
                    console.log('Added next-attack-modifier class with delay');
                }
            }, 100);
        }
    }
    // New method for meditation effect
    showMeditationEffect(x, y) {
        const playerChar = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        if (playerChar && this.game.player.meditation && this.game.player.meditation.active) {
            playerChar.classList.add('meditation-effect');
        }
    }
    // New method for movement trail effect
    showMovementTrailEffect(fromX, fromY, toX, toY) {
        this.effects.showMovementTrailEffect(fromX, fromY, toX, toY);
    }

    // レベルアップエフェクトを表示するメソッド
    showLevelUpEffect(x, y) {
        this.effects.showLevelUpEffect(x, y);
    }

    // 光の柱エフェクトを表示するメソッド
    showLightPillarEffect(x, y) {
        this.effects.showLightPillarEffect(x, y);
    }

    // 死亡エフェクトを表示するメソッド
    showDeathEffect(x, y, color = '#9B2222') {
        this.effects.showDeathEffect(x, y, color);
    }

    // ミスエフェクトを表示するメソッド
    showMissEffect(x, y, type = 'miss') {
        this.effects.showMissEffect(x, y, type);
    }

    // クリティカルヒットエフェクトを表示するメソッド
    showCritEffect(x, y, isMonster = false) {
        this.effects.showCritEffect(x, y, isMonster);
    }

    updateStatusPanel(status) {
        const panel = document.getElementById('status-panel');

        // Update floor level element
        const floorLevelElement = document.getElementById('floor-level');
        if (floorLevelElement) {
            const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[this.game.dangerLevel];
            floorLevelElement.innerHTML = `${this.game.floorLevel} <span style="color: ${dangerInfo.color}">[${dangerInfo.name}]</span>`;
        }

        // Update level display
        const levelElement = document.getElementById('level');
        if (levelElement) {
            levelElement.textContent = status.level;
        }

        // Update HP and Health Status display
        const hpElement = document.getElementById('hp');
        const maxHpElement = document.getElementById('max-hp');
        const healthStatusElement = document.getElementById('health-status');
        if (hpElement && maxHpElement) {
            const [currentHp, maxHp] = status.hp.split('/');
            hpElement.textContent = currentHp;
            maxHpElement.textContent = maxHp;

            // HPの割合に基づいて色を設定
            const hpPercentage = ((parseInt(currentHp) / parseInt(maxHp)) * 100);
            let healthColor = '#ffffff'; // デフォルト白
            if (hpPercentage <= 25) {
                healthColor = '#e74c3c'; // Near Death（赤）
            } else if (hpPercentage <= 50) {
                healthColor = '#e67e22'; // Badly Wounded（オレンジ）
            } else if (hpPercentage <= 75) {
                healthColor = '#f1c40f'; // Wounded（黄色）
            }

            if (healthStatusElement) {
                healthStatusElement.innerHTML = `<span style="color: ${healthColor}">${status.healthStatus}</span>`;
            }
        }

        // Update base stats
        for (const [key, value] of Object.entries(status.stats)) {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = value;
            }
        }

        // Update derived stats (using innerHTML to allow HTML tags)
        for (const [key, value] of Object.entries(status.derived)) {
            const element = document.getElementById(key);
            if (element) {
                element.innerHTML = value;
            }
        }

        // Update XP display
        const xpElement = document.getElementById('xp');
        if (xpElement) {
            xpElement.textContent = status.xp;
        }

        // Update Codex points display
        const codexElement = document.getElementById('codexPoints');
        if (codexElement) {
            codexElement.textContent = this.game.player.codexPoints;
        }

        if (this.statusPanelFlashing) {
            panel.classList.add('flash');
        }
    }

    renderHelpMenu() {
        const display = this.getHelpDisplay();
        document.getElementById('available-skills').innerHTML = display;
    }

    getHelpDisplay() {
        // 左列と右列のコンテンツを別々に作成
        let leftColumn = '';
        let rightColumn = '';

        // 左列：コントロール
        leftColumn += `<div style="color: #ffd700; font-size: 15px; margin-bottom: 8px;">■ CONTROLS</div>\n`;
        const categories = Object.entries(GAME_CONSTANTS.CONTROLS);
        categories.forEach(([category, data]) => {
            leftColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● ${data.title}</div>\n`;
            data.keys.forEach(keyInfo => {
                leftColumn += `<div style="margin-left: 8px;">`;
                leftColumn += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[${keyInfo.key}]</span>`;  // 幅を広げて、説明と分離
                leftColumn += `<span style="color: #ecf0f1;">${keyInfo.desc}</span>`; // 説明をspanで囲む
                leftColumn += `</div>\n`;
            });
        });
        
        // 休息コマンドの説明を追加
        leftColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● RESTING</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[^]</span>`;
        leftColumn += `<span style="color: #ecf0f1;">Rest for 10 turns</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[~]</span>`;
        leftColumn += `<span style="color: #ecf0f1;">Rest until fully healed</span>`;
        leftColumn += `</div>\n`;
        
        // 遠距離攻撃の操作説明を追加
        leftColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● RANGED COMBAT</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[F]</span>`;
        leftColumn += `<span style="color: #ecf0f1;">Toggle ranged mode</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[Tab]</span>`;
        leftColumn += `<span style="color: #ecf0f1;">Next target</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[Shift+Tab]</span>`;
        leftColumn += `<span style="color: #ecf0f1;">Previous target</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[Enter]</span>`;
        leftColumn += `<span style="color: #ecf0f1;">Fire at target</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[Esc]</span>`;
        leftColumn += `<span style="color: #ecf0f1;">Exit ranged mode</span>`;
        leftColumn += `</div>\n`;
        
        // スキルスロット並べ替え機能の説明を追加
        leftColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● SKILL MANAGEMENT</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[1-9]</span>`;
        leftColumn += `<span style="color: #ecf0f1;">Use skill in slot</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[Ctrl/Alt+1-9]</span>`;
        leftColumn += `<span style="color: #ecf0f1;">Rearrange skills between slots</span>`;
        leftColumn += `</div>\n`;

        // 右列：ステータスと戦闘システム
        rightColumn += `<div style="color: #ffd700; font-size: 15px; margin-bottom: 8px;">■ STATUS SYSTEM</div>\n`;

        // Health Status の説明
        rightColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● HEALTH STATUS</div>\n`;
        rightColumn += `<div style="margin-left: 8px;">`;
        rightColumn += `<span style="color: #2ecc71;">Healthy</span>: 75-100% HP<br>`;
        rightColumn += `<span style="color: #f1c40f;">Wounded</span>: 50-75% HP<br>`;
        rightColumn += `<span style="color: #e67e22;">Badly Wounded</span>: 25-50% HP<br>`;
        rightColumn += `<span style="color: #e74c3c;">Near Death</span>: 0-25% HP`;
        rightColumn += `</div>\n`;

        // Vigor の説明
        rightColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● VIGOR SYSTEM</div>\n`;
        rightColumn += `<div style="margin-left: 8px;">`;
        rightColumn += `<span style="color: #2ecc71;">High</span>: 75-100% - Full potential<br>`;
        rightColumn += `<span style="color: #f1c40f;">Moderate</span>: 50-75% - Slight penalties<br>`;
        rightColumn += `<span style="color: #e67e22;">Low</span>: 25-50% - Moderate penalties<br>`;
        rightColumn += `<span style="color: #e74c3c;">Critical</span>: 0-25% - Severe penalties<br><br>`;
        rightColumn += `Vigor affects accuracy and evasion.<br>`;
        rightColumn += `Recovers through meditation or combat victories.<br>`;
        rightColumn += `Meditation: d(Level+WIS) recovery, but risk -d(WIS) on low roll.`;
        rightColumn += `</div>\n`;

        rightColumn += `<div style="color: #ffd700; font-size: 15px; margin-top: 12px;">■ COMBAT SYSTEM</div>\n`;

        // 戦闘システムの説明
        rightColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● BASE STATS</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `HP: (CON×2 + STR/4) × Size Mod × Level<br>`;
        rightColumn += `ATK: (STR×0.7 - DEX/4) × Size Mod + Dice<br>`;
        rightColumn += `DEF: (CON×0.5 - INT/5) × Size Mod + Dice<br>`;
        rightColumn += `Size Mod: 0.9~1.3 (by STR+CON)`;
        rightColumn += `</div>\n`;

        rightColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● DAMAGE ROLLS</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `ATK: √(DEX/2) × 1d(√STR×2)<br>`;
        rightColumn += `DEF: √(CON/3) × 1d(√CON×1.5)`;
        rightColumn += `</div>\n`;

        rightColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● COMBAT STATS</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `ACC: 50 + DEX×0.8 + WIS×0.4 - CON/4<br>`;
        rightColumn += `EVA: 8 + DEX×0.6 + WIS×0.3 - STR/5<br>`;
        rightColumn += `CRIT: 3% + (DEX-10)×0.15 + (INT-10)×0.1<br>`;
        rightColumn += `(Critical hits ignore EVA & DEF)`;
        rightColumn += `</div>\n`;

        rightColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● SIZE & SPEED</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `Size: Based on CON×0.7 + STR×0.3<br>`;
        rightColumn += `Tiny ≤7, Small ≤10, Medium ≤14<br>`;
        rightColumn += `Large ≤18, Huge >18<br><br>`;
        rightColumn += `Speed: Based on DEX vs (STR+CON)<br>`;
        rightColumn += `Very Slow: ≤-4, Slow: ≤-2<br>`;
        rightColumn += `Normal: ≤2, Fast: ≤4, Very Fast: >4`;
        rightColumn += `</div>\n`;

        rightColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● COMBAT FLOW</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `1. Speed Check<br>`;
        rightColumn += `2. Roll(100) vs ACC for hit<br>`;
        rightColumn += `3. Roll(100) vs EVA if not crit<br>`;
        rightColumn += `4. DMG = ATK - DEF (if not crit)<br>`;
        rightColumn += `5. DMG = ATK (if critical hit)`;
        rightColumn += `</div>\n`;

        rightColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● RANGED COMBAT</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `[F] Toggle ranged mode<br>`;
        rightColumn += `[Tab/Shift+Tab] Cycle targets<br>`;
        rightColumn += `[ENTER] Fire at target<br>`;
        rightColumn += `[ESC] Exit ranged mode<br><br>`;
        rightColumn += `Energy: DEX + INT×2 + 75<br>`;
        rightColumn += `Recharge: INT/3 + 5 per turn<br>`;
        rightColumn += `Cost: 30 - INT/4 per shot<br>`;
        rightColumn += `DMG: (DEX×0.5 + INT×0.3) + dice<br>`;
        rightColumn += `ACC: 50 + DEX×0.8 + INT×0.4<br>`;
        rightColumn += `Range: 4 + INT/3<br>`;
        rightColumn += `Speed: -1 tier in ranged mode`;
        rightColumn += `</div>\n`;

        rightColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● COMBAT PENALTIES</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `Surrounded: -15% ACC/EVA per enemy<br>`;
        rightColumn += `(Max: -60%)<br><br>`;
        rightColumn += `Opportunity Attack:<br>`;
        rightColumn += `-30% ACC, +50% DMG<br>`;
        rightColumn += `No counter-attack chance`;
        rightColumn += `</div>\n`;

        // ランドマークターゲットモードの説明は不要なので削除

        // レイアウトを調整してカラムを並べて表示、gapを50pxに
        return `<div style="display: flex; gap: 50px;">
                    <div style="flex: 1; padding-right: 20px;">${leftColumn}</div>
                    <div style="flex: 1;">${rightColumn}</div>
                </div>`;
    }

    drawMonsterSprite(canvas, monster, turnCount) {
        const ctx = canvas.getContext('2d');
        
        // スプライトデータを取得
        const spriteFrames = MONSTER_SPRITES[monster.type];
        if (!spriteFrames) return;

        // フレーム番号を決定（0, 1, 2 の循環）
        const frameIndex = Math.floor(turnCount / 1) % 3;
        const sprite = spriteFrames[frameIndex];
        
        if (!sprite) return;

        const spriteWidth = sprite[0].length;
        const spriteHeight = sprite.length;
        const pixelSize = 8;

        canvas.width = spriteWidth * pixelSize;
        canvas.height = spriteHeight * pixelSize;

        // キャッシュキーを単純化
        const cacheKey = `${monster.type}_${monster.id}`;

        if (!this.spriteColorCache.has(cacheKey)) {
            const colorMap = new Map();
            // 全てのフレームに対して同じ色を使用
            spriteFrames[0].forEach((row, y) => {
                [...row].forEach((pixel, x) => {
                    const key = `${x},${y}`;
                    const baseColor = SPRITE_COLORS[pixel];
                    colorMap.set(key, SPRITE_COLORS.getRandomizedColor(baseColor));
                });
            });
            this.spriteColorCache.set(cacheKey, colorMap);
        }

        const colorMap = this.spriteColorCache.get(cacheKey);
        sprite.forEach((row, y) => {
            [...row].forEach((pixel, x) => {
                if (pixel !== ' ') {
                    // 現在のフレームの文字に対応する色を取得
                    // もし存在しなければ、基本の色を使用
                    let color = colorMap.get(`${x},${y}`);
                    if (!color) {
                        const baseColor = SPRITE_COLORS[pixel];
                        color = SPRITE_COLORS.getRandomizedColor(baseColor);
                        colorMap.set(`${x},${y}`, color);
                    }
                    
                    if (color) {
                        ctx.fillStyle = color;
                        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                    }
                }
            });
        });

        // グリッチ効果（ピクセル単位）
        if (Math.random() < 0.1) {
            const glitchCount = Math.floor(Math.random() * 5) + 1;
            for (let i = 0; i < glitchCount; i++) {
                const x = Math.floor(Math.random() * spriteWidth);
                const y = Math.floor(Math.random() * spriteHeight);
                const randomColor = SPRITE_COLORS.getRandomizedColor("#FFF");
                ctx.fillStyle = randomColor;
                ctx.fillRect(
                    x * pixelSize,
                    y * pixelSize,
                    pixelSize,
                    pixelSize
                );
            }
        }

        // 線状グリッチ効果
        if (Math.random() < 0.2) {
            const glitchHeight = Math.floor(Math.random() * 2) + 1;
            const glitchY = Math.floor(Math.random() * (spriteHeight - glitchHeight + 1));
            const glitchX = Math.floor(Math.random() * spriteWidth);
            const glitchLength = Math.floor(Math.random() * (spriteWidth - glitchX + 1));
            const glitchColor = SPRITE_COLORS.getRandomizedColor("#FFF");

            for (let i = 0; i < glitchLength; i++){
                for(let j = 0; j < glitchHeight; j++){
                    ctx.fillStyle = glitchColor;
                    ctx.fillRect(
                        (glitchX + i) * pixelSize,
                        (glitchY + j) * pixelSize,
                        pixelSize,
                        pixelSize
                    );
                }
            }
        }
    }

    previewMonsterSprite(monsterType, containerId, pixelSize = 8) {
        const spriteFrames = MONSTER_SPRITES[monsterType];
        if (!spriteFrames) {
            return;
        }

        // モンスタータイプごとに最初のフレームを使用
        const sprite = spriteFrames[0];
        if (!sprite) return;

        // コンテナ要素を取得
        const container = document.getElementById(containerId);
        if (!container) {
            return;
        }
        container.style.display = 'block';

        // 既存のcanvasがあれば削除
        const existingCanvas = container.querySelector('canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        // canvas要素を作成
        const canvas = document.createElement('canvas');
        const spriteWidth = sprite[0].length;
        const spriteHeight = sprite.length;
        canvas.width = spriteWidth * pixelSize;
        canvas.height = spriteHeight * pixelSize;
        const ctx = canvas.getContext('2d');

        // スプライトの描画
        sprite.forEach((row, y) => {
            [...row].forEach((pixel, x) => {
                const color = SPRITE_COLORS[pixel];
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            });
        });

        // canvasをコンテナに追加
        container.appendChild(canvas);
    }

    examineTarget(targetX, targetY, lookMode = false) {
        // ターン毎にlookInfoをクリアするため、game.loggerのメソッドを呼び出す
        this.game.logger.clearLookInfo();

        let monster = this.game.getMonsterAt(targetX, targetY);
        
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'flex-start';
        container.style.gap = '50px';
        container.style.border = 'none';
        container.style.padding = '0';

        const infoDiv = document.createElement('div');
        infoDiv.style.border = 'none';
        infoDiv.style.padding = '0';
        infoDiv.style.width = '200px';
        infoDiv.style.flexShrink = '0';

        // モンスターの存在と生存状態を厳密にチェック
        if (monster && monster.hp > 0 && !monster.isRemoved) {
            // Fallback: compute attack and defense if undefined
            if (!monster.attackPower) {
                monster.attackPower = GAME_CONSTANTS.FORMULAS.ATTACK(monster.stats);
            }
            if (!monster.defense) {
                monster.defense = GAME_CONSTANTS.FORMULAS.DEFENSE(monster.stats);
            }

            const healthStatus = monster.getHealthStatus(monster.hp, monster.maxHp);
            let status = [];

            // --- Basic Information ---
            let lookInfo = [
                `${monster.name} (Level ${monster.level}):`,
                `HP: ${Math.max(0, monster.hp)}/${monster.maxHp} <span style="color: ${healthStatus.color}">${healthStatus.name}</span>`,
            ];

            // --- Status Effects ---
            if (monster.hasStartedFleeing) {
                status.push("Fleeing");
            }
            if (monster.isSleeping) {
                status.push("Sleeping");
            }

            if (status.length > 0) {
                lookInfo.push(`Status: ${status.join(", ")}`);
            }

            // --- Combat Details ---
            const speed = GAME_CONSTANTS.FORMULAS.SPEED(monster.stats);
            const size = GAME_CONSTANTS.FORMULAS.SIZE(monster.stats);
            const speedInfo = GAME_CONSTANTS.COLORS.SPEED[speed.value];
            const sizeInfo = GAME_CONSTANTS.COLORS.SIZE[size.value];

            lookInfo.push(
                `ATK: ${monster.attackPower.base}+${monster.attackPower.diceCount}d${monster.attackPower.diceSides}`,
                `DEF: ${monster.defense.base}+${monster.defense.diceCount}d${monster.defense.diceSides}`,
                `ACC: ${monster.accuracy}%`,
                `EVA: ${monster.evasion}%`,
                `PER: ${monster.perception}`,
                `SIZE: <span style="color: ${sizeInfo.color}">${sizeInfo.name}</span>`,
                `SPD: <span style="color: ${speedInfo.color}">${speedInfo.name}</span>`
            );

            infoDiv.innerHTML = lookInfo.join('\n');

            const spriteDiv = document.createElement('div');
            spriteDiv.style.border = 'none';
            spriteDiv.style.padding = '0';

            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            canvas.style.imageRendering = 'pixelated';
            canvas.style.background = 'transparent';
            canvas.style.display = 'block';

            spriteDiv.appendChild(canvas);
            this.drawMonsterSprite(canvas, monster, this.game.turn);

            container.appendChild(infoDiv);
            container.appendChild(spriteDiv);
        } else if (targetX === this.game.player.x && targetY === this.game.player.y) {
            infoDiv.innerHTML = "You see yourself here.";
            container.appendChild(infoDiv);
        } else {
            const tile = this.game.tiles[targetY][targetX];
            let lookInfo = '';

            // lastCombatMonsterとlastDoorKillLocationの両方をチェック
            if (this.game.lastDoorKillLocation && 
                this.game.lastDoorKillLocation.x === targetX && 
                this.game.lastDoorKillLocation.y === targetY) {
                // ドアキルの場合は特別な表示
                lookInfo = "You see the aftermath of a door crushing.";
            } else if (this.game.lastCombatMonster && 
                      !this.game.lastCombatMonster.isRemoved &&
                      targetX === this.game.lastCombatMonster.x && 
                      targetY === this.game.lastCombatMonster.y &&
                      this.game.turn - this.game.lastCombatMonster.lastSeenTurn <= 1 &&
                      GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                          this.game.player.x,
                          this.game.player.y,
                          targetX,
                          targetY
                      ) <= 1.5) {
                lookInfo = `You see signs of ${this.game.lastCombatMonster.name}'s recent presence here.`;
            } else {
                // 通常のタイル情報表示
                if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                    lookInfo = "You see a closed door here.";
                } else if (tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                    lookInfo = "You see an open door here.";
                } else if (tile === GAME_CONSTANTS.STAIRS.CHAR) {
                    lookInfo = "You see stairs leading down here.";
                } else if (GAME_CONSTANTS.TILES.FLOOR.includes(tile)) {
                    lookInfo = "You see a floor here.";
                } else if (GAME_CONSTANTS.TILES.WALL.includes(tile)) {
                    lookInfo = "You see a wall here.";
                } else if (GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(tile)) {
                    lookInfo = "You see a massive stone pillar blocking your view.";
                } else if (GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(tile)) {
                    lookInfo = "You see some decorative furniture.";
                } else if (GAME_CONSTANTS.TILES.SPACE.includes(tile)) {
                    lookInfo = "You see the vast expanse of space here.";
                } else if (tile === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                    lookInfo = "You see a shimmering portal gate here.";
                } else if (tile === GAME_CONSTANTS.PORTAL.VOID.CHAR) {
                    lookInfo = "You see a swirling void portal here.";
                } else if (tile === GAME_CONSTANTS.NEURAL_OBELISK.CHAR) {
                    // ニューラルオベリスクのレベル情報を取得
                    const obelisk = this.game.neuralObelisks && 
                        this.game.neuralObelisks.find(o => o.x === targetX && o.y === targetY);
                    
                    console.log('Looking at Neural Obelisk:', { targetX, targetY });
                    console.log('Found obelisk in neuralObelisks array:', obelisk);
                    console.log('All obelisks:', this.game.neuralObelisks);
                    
                    let level = 3; // デフォルトはレベル3
                    let colorName = "yellow";
                    
                    if (obelisk) {
                        level = obelisk.level;
                        
                        // 色の名前を設定
                        switch(level) {
                            case 1: colorName = "blue"; break;
                            case 2: colorName = "green"; break;
                            case 3: colorName = "yellow"; break;
                            case 4: colorName = "orange"; break;
                            case 5: colorName = "purple"; break;
                        }
                    }
                    
                    lookInfo = `There is a Neural Obelisk (Level ${level}) emitting a mysterious glow.<br>
                                It glows ${colorName} and can restore ${GAME_CONSTANTS.NEURAL_OBELISK.LEVELS[level].HEAL_PERCENT}% of your max HP/Vigor when touched.<br>
                                It will vanish after use.`;
                    
                    // フレーバーテキストを表示するために logger.updateRoomInfo を呼び出す
                    if (this.game.logger) {
                        const currentRoom = this.game.getCurrentRoom();
                        const monsterCount = currentRoom ? this.game.getMonstersInRoom(currentRoom).length : 0;
                        this.game.logger.updateRoomInfo(
                            currentRoom, 
                            monsterCount, 
                            false, 
                            false, 
                            { level: level }
                        );
                    }
                } else {
                    lookInfo = `You see ${tile} here.`;
                }
            }
            
            infoDiv.innerHTML = lookInfo;
            container.appendChild(infoDiv);
        }

        this.game.logger.updateLookInfo(container);
    }

    // 共通の位置計算ロジックを追加
    getTilePosition(x, y) {
        const tileElement = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        if (!tileElement) return null;

        // スケール比を取得
        const scale = parseFloat(getComputedStyle(document.documentElement)
            .getPropertyValue('--scale-ratio')) || 1;

        const gameContainer = document.getElementById('game-container');
        const containerRect = gameContainer ? gameContainer.getBoundingClientRect() : { left: 0, top: 0 };
        const tileRect = tileElement.getBoundingClientRect();

        // スケールを考慮した実際の位置を計算（タイルの中央を取得）
        return {
            x: (tileRect.left - containerRect.left + tileRect.width / 8) / scale,
            y: (tileRect.top - containerRect.top + tileRect.height / 9) / scale,
            width: tileRect.width / scale,
            height: tileRect.height / scale
        };
    }

    // ログパネルをフラッシュさせるメソッド
    flashLogPanel() {
        this.effects.flashLogPanel();
    }

    // 新しいメソッドを追加
    getDirectionIndicator(dx, dy) {
        if (Math.abs(dx) <= 0.5) {
            if (dy < 0) return 'N';  // スペース不要
            if (dy > 0) return 'S';  // スペース不要
        }
        if (Math.abs(dy) <= 0.5) {
            if (dx < 0) return 'W';  // スペース不要
            if (dx > 0) return 'E';  // スペース不要
        }
        if (dx < 0 && dy < 0) return 'NW';
        if (dx > 0 && dy < 0) return 'NE';
        if (dx < 0 && dy > 0) return 'SW';
        if (dx > 0 && dy > 0) return 'SE';
        return ' ';
    }

    // 新しいメソッドを追加
    getDirectionColor(distance) {
        if (distance <= 1.5) return '#ff4757';      // 隣接: 赤
        if (distance <= 3) return '#ffa502';        // 近距離: オレンジ
        if (distance <= 5) return '#7bed9f';        // 中距離: 緑
        return '#70a1ff';                           // 遠距離: 青
    }

    renderNamePrompt(currentInput) {
        const messageLogElement = document.getElementById('message-log');
        if (!messageLogElement) return;

        // ログパネルをクリア
        messageLogElement.innerHTML = '';

        // タイトルアートの後に追加するクレジット情報
        const credits = [
            "",
            "",
            "v0.1.0 alpha ©︎chikyuman-bros.",
            "",
            "",
            "Font: IBM EGA 9x8 & IBM VGA 8x16 || Source: The Ultimate Oldschool PC Font Pack by VileR",
            "Licensed under CC BY-SA 4.0",
            "https://int10h.org/oldschool-pc-fonts/",
        ];

        // バージョン表記とタイトルアートを表示
        const titleArt = [
            "  ▄████▄   ▒█████   ███▄ ▄███▓ ██▓███   ██▓    ▓█████ ▒██   ██▒",
            " ▒██▀ ▀█  ▒██▒  ██▒▓██▒▀█▀ ██▒▓██░  ██▒▓██▒    ▓█   ▀ ▒▒ █ █ ▒░",
            " ▒▓█    ▄ ▒██░  ██▒▓██    ▓██░▓██░ ██▓▒▒██░    ▒███   ░░  █   ░",
            " ▒▓▓▄ ▄██▒▒██   ██░▒██    ▒██ ▒██▄█▓▒ ▒▒██░    ▒▓█  ▄  ░ █ █ ▒ ",
            " ▒ ▓███▀ ░░ ████▓▒░▒██▒   ░██▒▒██▒ ░  ░░██████▒░▒████▒▒██▒ ▒██▒",
            " ░ ░▒ ▒  ░░ ▒░▒░▒░ ░ ▒░   ░  ░▒▓▒░ ░  ░░ ▒░▓  ░░░ ▒░ ░▒▒ ░ ░▓ ░",
            "   ░  ▒     ░ ▒ ▒░ ░  ░      ░░▒ ░     ░ ░ ▒  ░ ░ ░  ░░░   ░▒ ░",
            " ░        ░ ░ ░ ▒  ░      ░   ░░         ░ ░      ░    ░    ░  ",
            " ░ ░          ░ ░         ░                ░  ░   ░  ░ ░    ░  ",
        ];

        // 静的コンテンツ（タイトルアートとクレジット）用の別のコンテナを作成
        const staticContainer = document.createElement('div');
        staticContainer.style.animation = 'none';
        staticContainer.style.transition = 'none';
        staticContainer.className = 'static-content';
        staticContainer.style.display = 'block';
        staticContainer.style.visibility = 'visible';
        staticContainer.style.opacity = '1';
        messageLogElement.appendChild(staticContainer);
        
        // タイトルアート用のコンテナを作成
        const titleArtContainer = document.createElement('div');
        titleArtContainer.className = 'title-art-container';
        titleArtContainer.style.animation = 'none';
        titleArtContainer.style.transition = 'none';
        titleArtContainer.style.lineHeight = '0.5';
        titleArtContainer.style.margin = '5px';
        titleArtContainer.style.padding = '0';
        titleArtContainer.style.display = 'block';
        titleArtContainer.style.visibility = 'visible';
        titleArtContainer.style.opacity = '1';
        staticContainer.appendChild(titleArtContainer);
        
        // タイトルアートを表示
        titleArt.forEach(line => {
            const div = document.createElement('div');
            div.textContent = line;
            div.className = 'message title';
            div.style.animation = 'none';
            div.style.transition = 'none';
            div.style.whiteSpace = 'pre';
            div.style.lineHeight = '0.8';
            div.style.margin = '0';
            div.style.padding = '0';
            div.style.display = 'block';
            div.style.visibility = 'visible';
            div.style.opacity = '1';
            div.style.color = '#fffdd0'; // クリーム色で確実に表示
            div.style.fontSize = '20px';
            titleArtContainer.appendChild(div);
        });
        
        // 空行とクレジットを表示
        ['', ...credits].forEach(line => {
            const div = document.createElement('div');
            
            // URLを含む行の場合はアンカータグにする
            if (line.includes('http')) {
                div.innerHTML = line.replace(
                    /(https?:\/\/[^\s]+)/g, 
                    '<a href="$1" target="_blank" style="color: #66ccff; text-decoration: underline;">$1</a>'
                );
            } else {
                div.textContent = line;
            }
            
            div.className = 'message title';
            div.style.animation = 'none';
            div.style.transition = 'none';
            div.style.whiteSpace = 'pre';
            div.style.display = 'block';
            div.style.visibility = 'visible';
            div.style.color = '#fffdd0'; // クリーム色で確実に表示
            div.style.fontSize = '15px';
            div.style.opacity = '0.8';
            div.style.lineHeight = '0.8'; // 行間をさらに詰める
            div.style.margin = '5px'; // マージンを0に
            div.style.padding = '0.5px'; // パディングを0に
            staticContainer.appendChild(div);
        });

        // プロンプトメッセージ用の別のコンテナを作成
        const dynamicContainer = document.createElement('div');
        dynamicContainer.className = 'dynamic-content';
        messageLogElement.appendChild(dynamicContainer);

        // プロンプトメッセージを追加
        const messages = [
            { text: 'Enter your name:', style: 'important' },
            { text: `> ${currentInput}_`, style: 'system' },
            { text: '(Press Enter to confirm)', style: 'hint' }
        ];

        // タイプライターエフェクトを一時的に無効化
        dynamicContainer.classList.add('no-typewriter');

        messages.forEach(msg => {
            const div = document.createElement('div');
            div.textContent = msg.text;
            div.className = `message ${msg.style}`;
            dynamicContainer.appendChild(div);
        });

        // タイプライターエフェクトを再有効化
        setTimeout(() => {
            dynamicContainer.classList.remove('no-typewriter');
        }, 10);

        // 最新のメッセージが見えるようにスクロール
        messageLogElement.scrollTop = messageLogElement.scrollHeight;
    }

    animatePortal(duration, steps, callback) {
        let currentStep = 0;

        // オリジナルのマップ状態をバックアップ
        const originalTiles = this.game.tiles.map(row => [...row]);
        const originalColors = this.game.colors.map(row => [...row]);

        // ポータル遷移開始フラグを設定
        this.game.isPortalTransitioning = true;

        const animate = () => {
            if (currentStep >= steps) {
                // ポータル遷移終了フラグをリセット
                this.game.isPortalTransitioning = false;
                // サウンドのフェードアウトを開始
                this.game.soundManager.fadeOutPortalSound();

                // マップを元の状態に戻す
                this.game.tiles = originalTiles.map(row => [...row]);
                this.game.colors = originalColors.map(row => [...row]);

                callback();
                // 通常のレンダリングを再開
                this.render();
                return;
            }

            // マップ全体のタイルを宇宙空間のタイルと色に変更
            for (let y = 0; y < this.game.height; y++) {
                for (let x = 0; x < this.game.width; x++) {
                    // ポータルからの距離を計算
                    const distanceFromPortal = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                        x, y,
                        this.game.player.x,
                        this.game.player.y
                    );

                    // 距離に応じて変化の確率を調整
                    const changeThreshold = (currentStep / steps) * 15 - distanceFromPortal;

                    if (Math.random() < Math.max(0, changeThreshold / 15)) {
                        // SPACE配列からランダムにタイルを選択
                        this.game.tiles[y][x] = GAME_CONSTANTS.TILES.SPACE[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE.length)
                        ];

                        // SPACE_COLORSからランダムに色を選択
                        this.game.colors[y][x] = GAME_CONSTANTS.TILES.SPACE_COLORS[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE_COLORS.length)
                        ];
                    }
                }
            }

            currentStep++;
            this.render();
            setTimeout(() => requestAnimationFrame(animate), duration / steps);
        };

        animate();
    }

    startPortalTransition(callback) {
        this.effects.startPortalTransition(callback);
    }

    startShortPortalTransition(callback) {
        this.effects.startShortPortalTransition(callback);
    }

    showDamageFlash() {
        this.effects.showDamageFlash();
    }

    // 画面をフリーズさせる関数
    freezeScreen() {
        this.effects.freezeScreen();
    }
    
    // フリーズを解除する関数
    unfreezeScreen() {
        this.effects.unfreezeScreen();
    }

    // 完全な再描画を強制する（VigorEffectsなど特殊効果後に呼び出す）
    forceRefresh() {
        console.log('Forcing full redraw...');
        this.forceFullRender = true;
        this.tileStateCache = {}; // キャッシュをクリア
        this.exploredStateHash = this.effects.calculateExploredHash(); // 新しいハッシュを計算
        this.render(); // 再描画を実行
    }

    /**
     * ウェブ生成エフェクトを表示
     * @param {number} x - ウェブのX座標
     * @param {number} y - ウェブのY座標
     */
    showWebEffect(x, y) {
        this.effects.showWebEffect(x, y);
    }
    
    // 蜘蛛の巣を除去するエフェクトを表示するメソッド
    showWebRemoveEffect(x, y) {
        this.effects.showWebRemoveEffect(x, y);
    }
}