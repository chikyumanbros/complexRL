class Renderer {
    constructor(game) {
        this.game = game;
        this.highlightedTile = null;
        this.movementEffects = null;
        this.spriteRenderer = new SpriteRenderer();
        this.statusRenderer = new StatusRenderer(game);
        this.menuRenderer = new MenuRenderer(game);
        
        // StatusRendererからメソッドを呼び出せるようにする
        this.statusRenderer.examineTarget = this.examineTarget.bind(this);
        this.statusRenderer.getDirectionIndicator = this.getDirectionIndicator.bind(this);
        this.statusRenderer.getDirectionColor = this.getDirectionColor.bind(this);

        // 揺らぎのための変数
        this.flickerTime = 0;
        this.flickerValues = new Array(20).fill(0);  // 揺らぎ値を保持

        // 幻覚エフェクト用の変数
        this.psychedelicTurn = 0;  // サイケデリックエフェクトのターンカウンター

        // マップレンダリングのためのキャッシュを追加
        this.lastFloorLevel = null;   // 前回描画時のフロアレベル
        this.tileStateCache = {};     // タイル状態のキャッシュ
        this.exploredStateHash = '';  // 探索状態のハッシュ値（変更検出用）
        
        // レンダリング処理を最適化するためのフラグ
        this.pendingRender = false;   // レンダリングがスケジュールされているか
        this.fastRenderMode = false;  // 高速レンダリングモードかどうか
        this.forceFullRender = false; // 完全な再描画を強制するフラグ
        
        // レンダリングスロットリング用の変数
        this.lastRenderTime = 0;      // 最後のレンダリング時間
        this.renderThrottleDelay = 50; // 最小レンダリング間隔（ミリ秒）

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
        if (this.game.floorLevel === 0 || !this.effects.lightingEffectsEnabled) return;
        
        // キャッシュされた視界データを使用する
        const visibleTiles = this.game.visibleTilesCache 
            ? new Set(this.game.visibleTilesCache.map(({x, y}) => `${x},${y}`))
            : new Set(this.game.getVisibleTiles().map(({x, y}) => `${x},${y}`));
        
        // 一度にDOMを操作する要素をまとめる
        const updates = [];
        
        document.querySelectorAll('#game span').forEach(el => {
            const x = parseInt(el.dataset.x);
            const y = parseInt(el.dataset.y);

            if (visibleTiles.has(`${x},${y}`)) {
                const style = window.getComputedStyle(el);
                const currentOpacity = parseFloat(style.opacity);
                if (!isNaN(currentOpacity)) {
                    const { opacity, color } = this.calculateFlicker(currentOpacity, x, y);
                    updates.push({ element: el, opacity, color });
                }
            }
        });
        
        // 一括でDOMを更新
        requestAnimationFrame(() => {
            updates.forEach(update => {
                update.element.style.opacity = update.opacity;
                update.element.style.textShadow = `0 0 5px ${update.color}`;
            });
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
        // ターンカウンターを更新（毎回減少させるのではなく、ゲームのターン処理で減少させる）
        // this.psychedelicTurn = Math.max(0, this.psychedelicTurn - 0.1); // 時間経過で徐々に減少

        // Initialize movement effects state
        if (!this.movementEffects) {
            this.movementEffects = new Set();
        }

        // 遠距離攻撃モード中はハイライトを維持
        const keepHighlight = this.game.player.rangedCombat.isActive;
        const currentHighlight = keepHighlight ? {...this.highlightedTile} : null;

        // 既にレンダリングがスケジュールされている場合は重複しない
        if (this.pendingRender) return;
        
        // スロットリングを適用（前回のレンダリングから一定時間経過していない場合はスケジュールのみ）
        const now = performance.now();
        const timeSinceLastRender = now - this.lastRenderTime;
        
        if (timeSinceLastRender < this.renderThrottleDelay) {
            // 短時間に連続して呼ばれた場合は、最新の1回だけをスケジュール
            this.pendingRender = true;
            setTimeout(() => {
                this._performRender();
            }, this.renderThrottleDelay - timeSinceLastRender);
            return;
        }
        
        // 通常のレンダリングをスケジュール
        this.pendingRender = true;
        requestAnimationFrame(() => {
            this._performRender();
        });
    }

    // 実際のレンダリング処理を行うプライベートメソッド
    _performRender() {
        // exploredStateのハッシュをチェック（タイル忘却などの検出用）
        const currentHash = this.effects.calculateExploredHash();
        if (currentHash !== this.exploredStateHash) {
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

        // レンダリング完了フラグをリセット
        this.pendingRender = false;
        this.forceFullRender = false;
        
        // 最後のレンダリング時間を更新
        this.lastRenderTime = performance.now();
    }

    // 高速レンダリングメソッドも同様に最適化
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
        
        // スロットリングを適用
        const now = performance.now();
        const timeSinceLastRender = now - this.lastRenderTime;
        
        if (timeSinceLastRender < this.renderThrottleDelay) {
            // 短時間に連続して呼ばれた場合は、最新の1回だけをスケジュール
            this.fastRenderMode = true;
            this.pendingRender = true;
            setTimeout(() => {
                this._performFastRender();
            }, this.renderThrottleDelay - timeSinceLastRender);
            return;
        }
        
        this.fastRenderMode = true;
        this.pendingRender = true;
        
        // 高優先度でレンダリングをスケジュール
        requestAnimationFrame(() => {
            this._performFastRender();
        });
    }

    // 実際の高速レンダリング処理を行うプライベートメソッド
    _performFastRender() {
        // 現在のフロアレベルが変わっていないか確認
        if (this.lastFloorLevel !== this.game.floorLevel) {
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
        
        // 最後のレンダリング時間を更新
        this.lastRenderTime = performance.now();
    }

    // 高速レンダリング用マップ描画 - プレイヤーとその周辺のみ更新
    renderMapFast() {
        const container = document.getElementById('game');
        if (!container) return;
        
        // ホームフロアかどうかを判定
        const isHomeFloor = this.game.floorLevel === 0;
        
        // プレイヤーとその周辺のタイルのみを更新
        const px = this.game.player.x;
        const py = this.game.player.y;
        const updateRadius = 10;
        
        // 更新範囲内のタイルとそのキーを収集
        const tilesToUpdate = [];
        for (let y = Math.max(0, py - updateRadius); y <= Math.min(this.game.height - 1, py + updateRadius); y++) {
            for (let x = Math.max(0, px - updateRadius); x <= Math.min(this.game.width - 1, px + updateRadius); x++) {
                // チェビシェフ距離を使用して円形の更新範囲にする（パフォーマンス向上）
                const distance = Math.max(Math.abs(x - px), Math.abs(y - py));
                if (distance <= updateRadius) {
                    tilesToUpdate.push({x, y, key: `${x},${y}`});
                }
            }
        }
        
        // 可視タイルを取得（更新範囲内のみ）
        // 可視タイルの計算を最適化（毎回計算せず、キャッシュを使用）
        let visibleTiles;
        if (this.game.visibleTilesCache) {
            visibleTiles = new Set(
                this.game.visibleTilesCache
                    .filter(tile => Math.abs(tile.x - px) <= updateRadius && Math.abs(tile.y - py) <= updateRadius)
                    .map(({x, y}) => `${x},${y}`)
            );
        } else {
            visibleTiles = new Set(
                this.game.getVisibleTiles()
                    .filter(tile => Math.abs(tile.x - px) <= updateRadius && Math.abs(tile.y - py) <= updateRadius)
                    .map(({x, y}) => `${x},${y}`)
            );
            // キャッシュを保存
            this.game.visibleTilesCache = this.game.getVisibleTiles();
        }
        
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
        
        // バッチ処理のためのグループ化
        const visibleUpdates = [];
        const exploredUpdates = [];
        
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
                
                // 🔍 UNDEFINED チェック・修復
                if (content === undefined) {
                    console.log(`❌ UNDEFINED TILE at (${x}, ${y}) in renderMapFast - repairing...`);
                    content = '.'; // 安全なフォールバック
                    this.game.tiles[y][x] = '.';
                }
                
                if (this.game.colors[y][x] === undefined) {
                    console.log(`❌ UNDEFINED COLOR at (${x}, ${y}) in renderMapFast - repairing...`);
                    this.game.colors[y][x] = '#333'; // 安全なフォールバック
                }
                
                style = `color: ${this.game.colors[y][x]}`;
                
                // ホームフロアでは照明エフェクトを省略
                if (!isHomeFloor && !isPlayerTile && !monster) {
                    const distance = Math.max(Math.abs(x - px), Math.abs(y - py));
                    let baseOpacity = distance <= 1 ? 1.0 : 
                                     distance <= 3 ? 0.9 : 
                                     distance <= 5 ? 0.7 : 0.5;
                    
                    // 灯りエフェクトの計算（高速版）
                    // 距離が遠いタイルは簡易計算
                    if (distance > 3) {
                        opacity = Math.max(0.4, Math.min(0.8, baseOpacity - (distance / 40)));
                        backgroundColor = 'rgba(255, 200, 150, 0.1)';
                    } else {
                        const { opacity: tileOpacity, color: flickerColor } = this.effects.calculateFlicker(baseOpacity, x, y);
                        opacity = tileOpacity;
                        backgroundColor = flickerColor;
                    }
                }
                
                // 瞑想効果の適用（サイケデリックエフェクト）
                if (this.game.player.meditation?.active) {
                    const { char, color } = this.effects.calculatePsychedelicEffect(x, y, content, this.game.colors[y][x]);
                    content = char;
                    style = `color: ${color}`;
                }
                
                // スタイル文字列を構築
                style = `color: ${this.game.colors[y][x]}; opacity: ${opacity}; grid-row: ${y + 1}; grid-column: ${x + 1};`;
                if (backgroundColor) {
                    style += ` background-color: ${backgroundColor};`;
                }
                
                // ハイライト状態を適用
                if (isHighlighted) {
                    classes.push('highlighted');
                    const highlightColor = this.getHighlightColor(x, y);
                    style += ` color: ${highlightColor};`;
                }
                
                // 移動残像エフェクトを適用
                if (this.movementEffects) {
                    for (const effect of this.movementEffects) {
                        if (effect.x === x && effect.y === y) {
                            classes.push('movement-trail');
                            break;
                        }
                    }
                }
                
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
                
                // 前回の状態と比較して変更があれば更新リストに追加
                if (existingTile) {
                    if (!previousState || 
                        previousState.content !== content || 
                        previousState.classes.join(' ') !== classes.join(' ')) {
                        visibleUpdates.push({
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
                
                // 🔍 UNDEFINED チェック・修復
                if (content === undefined) {
                    console.log(`❌ UNDEFINED TILE at (${x}, ${y}) in renderMap (explored) - repairing...`);
                    content = '.'; // 安全なフォールバック
                    this.game.tiles[y][x] = '.';
                }
                
                if (this.game.colors[y][x] === undefined) {
                    console.log(`❌ UNDEFINED COLOR at (${x}, ${y}) in renderMap (explored) - repairing...`);
                    this.game.colors[y][x] = '#333'; // 安全なフォールバック
                }
                
                opacity = 0.3;
                style = `color: ${this.game.colors[y][x]}; opacity: ${opacity}`;
                
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
                        exploredUpdates.push({
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
        // 可視タイルを優先的に更新
        if (visibleUpdates.length > 0) {
            // DOMの更新を一度に行う
            visibleUpdates.forEach(update => {
                update.element.textContent = update.content;
                update.element.className = update.classes.join(' ');
                // スタイルは変更がある場合のみ更新（コストが高い）
                if (update.style !== update.element.getAttribute('style')) {
                    update.element.setAttribute('style', update.style);
                }
            });
        }
        
        // 探索済みタイルを更新（可視タイルの後に処理）
        if (exploredUpdates.length > 0) {
            exploredUpdates.forEach(update => {
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
        
        // 一定時間後にキャッシュをクリア（メモリリーク防止）
        if (!this.cacheCleanupScheduled) {
            this.cacheCleanupScheduled = true;
            setTimeout(() => {
                this.game.visibleTilesCache = null;
                this.cacheCleanupScheduled = false;
            }, 5000); // 5秒後にキャッシュをクリア
        }
    }

    renderMap() {
        const container = document.getElementById('game');
        container.style.position = 'relative';
        
        // Ensure mapContainer exists
        if (!this.mapContainer) {
            this.mapContainer = document.getElementById('game');
        }
        
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
        
        // ホームフロアかどうかを判定
        const isHomeFloor = this.game.floorLevel === 0;
        
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
            //console.log(`Floor changed: ${this.lastFloorLevel} or forced refresh. Rebuilding all tiles...`);
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

                    // ホームフロアでは照明エフェクトを省略
                    if (isHomeFloor) {
                        opacity = baseOpacity;
                        backgroundColor = 'transparent';
                    } else {
                        // 灯りエフェクトの計算
                        const { opacity: tileOpacity, color: flickerColor } = this.calculateFlicker(baseOpacity, x, y);
                        opacity = tileOpacity;
                        backgroundColor = flickerColor;
                    }

                    content = this.game.tiles[y][x];
                    style = `color: ${this.game.colors[y][x]}`;

                    // 🔍 UNDEFINED チェック・修復
                    if (content === undefined) {
                        console.log(`❌ UNDEFINED TILE at (${x}, ${y}) in renderMap - repairing...`);
                        content = '.'; // 安全なフォールバック
                        this.game.tiles[y][x] = '.';
                    }
                    
                    if (this.game.colors[y][x] === undefined) {
                        console.log(`❌ UNDEFINED COLOR at (${x}, ${y}) in renderMap - repairing...`);
                        this.game.colors[y][x] = '#333'; // 安全なフォールバック
                    }
                    
                    style = `color: ${this.game.colors[y][x]}`;

                    // サイケデリックエフェクトの適用（psychedelicTurnが0より大きい場合）
                    if (this.psychedelicTurn > 0) {
                        const { char: psychChar, color: psychColor } = this.calculatePsychedelicEffect(x, y, content, this.game.colors[y][x]);
                        content = psychChar;
                        style = `color: ${psychColor}`;
                    }

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
                            classes.push('movement-trail');
                            style = `opacity: ${trailEffect.opacity};`;
                        } else {
                            const monster = this.game.getMonsterAt(x, y);
                            if (monster) {
                                // 逃走中のモンスターの場合、CSSクラスを追加
                                let displayChar = monster.char;
                                let monsterOpacity = 1;
                                style = `color: ${GAME_CONSTANTS.COLORS.MONSTER[monster.type]}; opacity: ${monsterOpacity}; text-shadow: 0 0 5px ${backgroundColor}`;

                                // ★★★ 故障エフェクトの追加 ★★★
                                if (monster.isOfCategory && monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.MECHANICAL)) {
                                    // メカニカルモンスターの基本クラス
                                    classes.push('mechanical-monster');
                                    
                                    // HP に応じた損傷表示
                                    const hpPercent = monster.hp / monster.maxHp;
                                    if (hpPercent < 0.3) {
                                        classes.push('mechanical-damaged');
                                    }
                                    
                                    // 故障状態のクラス追加
                                    if (monster.malfunctions) {
                                        if (monster.malfunctions.fire) {
                                            classes.push('fire-malfunction');
                                        }
                                        if (monster.malfunctions.electrical) {
                                            classes.push('electrical-malfunction');
                                        }
                                                                if (monster.malfunctions.oil_leak) {
                            classes.push('oil-leak');
                        }
                                        
                                        // 複数故障の場合
                                        const malfunctionCount = Object.keys(monster.malfunctions).filter(key => monster.malfunctions[key]).length;
                                        if (malfunctionCount > 1) {
                                            classes.push('multiple-malfunction');
                                        }
                                    }
                                }
                                // ★★★ 故障エフェクト追加終了 ★★★

                                if (monster.hasStartedFleeing) {
                                    classes.push('fleeing-monster');
                                    style += `; --char: '${monster.char}'`;
                                }

                                if (monster.isSleeping) {
                                    style += '; animation: sleeping-monster 1s infinite';
                                }
                                
                                if (monster.caughtInWeb && monster.type !== 'G_SPIDER') {
                                    classes.push('monster-caught-web');
                                }
                                
                                content = displayChar;
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
                            const skill = SKILLS[Object.keys(SKILLS).find(category => 
                                SKILLS[category].skills.some(s => s.id === skillId)
                            )]?.skills.find(s => s.id === skillId);
                            
                            const range = skill && skill.getRange 
                                ? skill.getRange(this.game.player) 
                                : 3; // デフォルト値
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
                    const webIndex = this.game.webs ? this.game.webs.findIndex(web => web.x === x && web.y === y) : -1;
                    if (webIndex !== -1) {
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
                    
                    // 液体の描画
                    const bloodpool = this.game.bloodpools && this.game.bloodpools.find(bp => bp.x === x && bp.y === y);
                    if (bloodpool) {
                        // 重症度に基づいてクラスとスタイルを設定
                        if (bloodpool.severity === 3) {
                            classes.push('bloodpool-heavy');
                            content = GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.HEAVY.CHAR;
                            style = `color: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.HEAVY.COLOR}; opacity: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.HEAVY.OPACITY}`;
                        } else if (bloodpool.severity === 2) {
                            classes.push('bloodpool-medium');
                            content = GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.MEDIUM.CHAR;
                            style = `color: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.MEDIUM.COLOR}; opacity: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.MEDIUM.OPACITY}`;
                        } else {
                            classes.push('bloodpool-light');
                            content = GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.LIGHT.CHAR;
                            style = `color: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.LIGHT.COLOR}; opacity: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.LIGHT.OPACITY}`;
                        }
                        
                        // 開いたドアの上に血痕がある場合は、ドアの文字を保持
                        if (this.game.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                            content = GAME_CONSTANTS.TILES.DOOR.OPEN;
                            // 血痕の色とスタイルを適用
                            if (bloodpool.severity === 3) {
                                style = `color: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.HEAVY.COLOR}; opacity: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.HEAVY.OPACITY}`;
                            } else if (bloodpool.severity === 2) {
                                style = `color: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.MEDIUM.COLOR}; opacity: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.MEDIUM.OPACITY}`;
                            } else {
                                style = `color: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.LIGHT.COLOR}; opacity: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.LIGHT.OPACITY}`;
                            }
                        }
                        // 閉じたドアの上に血痕がある場合も、同様にドアの文字を保持して血痕の色を適用
                        else if (this.game.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                            content = GAME_CONSTANTS.TILES.DOOR.CLOSED;
                            // 血痕の色とスタイルを適用
                            if (bloodpool.severity === 3) {
                                style = `color: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.HEAVY.COLOR}; opacity: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.HEAVY.OPACITY}`;
                            } else if (bloodpool.severity === 2) {
                                style = `color: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.MEDIUM.COLOR}; opacity: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.MEDIUM.OPACITY}`;
                            } else {
                                style = `color: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.LIGHT.COLOR}; opacity: ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.LIGHT.OPACITY}`;
                            }
                        }
                        
                        // プレイヤーやモンスターが血痕の上にいる場合は、そのキャラクターを優先表示
                        if (x === this.game.player.x && y === this.game.player.y) {
                            content = this.game.player.char;
                            const healthStatus = this.game.player.getHealthStatus(this.game.player.hp, this.game.player.maxHp);
                            style = `color: ${healthStatus.color}; opacity: 1; text-shadow: 0 0 5px ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.HEAVY.COLOR}`;
                        } else {
                            const monster = this.game.getMonsterAt(x, y);
                            if (monster) {
                                content = monster.char;
                                style = `color: ${GAME_CONSTANTS.COLORS.MONSTER[monster.type]}; opacity: 1; text-shadow: 0 0 5px ${GAME_CONSTANTS.LIQUIDS.BLOOD.SEVERITY.HEAVY.COLOR}`;
                            }
                        }
                        
                        // 背景があれば適用
                        if (backgroundColor) {
                            style += `; background: ${backgroundColor}`;
                        }
                        
                        // グリッド位置を指定
                        style += `; grid-row: ${y + 1}; grid-column: ${x + 1};`;
                    }
                    
                    // ガスの描画
                    if (this.game.gasSystem) {
                        const gas = this.game.gasSystem.getGasAt(x, y);
                        if (gas) {
                            const gasSettings = GAME_CONSTANTS.GASES[gas.type.toUpperCase()];
                            if (gasSettings) {
                                // 濃度に応じた表示文字を取得
                                const gasChar = gasSettings.CHARS[`LEVEL_${gas.density}`];
                                const gasColor = gasSettings.COLOR;
                                
                                // ★★★ ガス優先表示システム ★★★
                                // ガスがある場所では常にガスの文字を表示
                                content = gasChar;
                                
                                // ガスの濃度に応じた不透明度を設定
                                const baseOpacity = 0.5 + (gas.density * 0.25); // 濃度1: 0.75, 濃度2: 1.0, 濃度3: 1.25（上限1.0）
                                style = `color: ${gasColor}; opacity: ${Math.min(baseOpacity, 1.0)};`;
                                
                                // プレイヤーやモンスターがいるかチェック
                                const isPlayerAtPosition = (x === this.game.player.x && y === this.game.player.y);
                                const monsterAtPosition = this.game.getMonsterAt(x, y);
                                
                                if (isPlayerAtPosition || monsterAtPosition) {
                                    // ★★★ 蜘蛛の巣チェック：蜘蛛の巣に捕まっている場合はガス効果を適用しない ★★★
                                    const playerCaughtInWeb = isPlayerAtPosition && this.game.player.caughtInWeb;
                                    const monsterCaughtInWeb = monsterAtPosition && monsterAtPosition.caughtInWeb;
                                    
                                    if (!playerCaughtInWeb && !monsterCaughtInWeb) {
                                        // キャラクターがいる場合は背景で存在を示す
                                        const shadowSize = 3 + gas.density * 2;
                                        const bgOpacity = 0.15 + (gas.density * 0.05);
                                        
                                        // 16進数カラーをRGBAに変換
                                        const hex = gasColor.replace('#', '');
                                        const r = parseInt(hex.substr(0, 2), 16);
                                        const g = parseInt(hex.substr(2, 2), 16);
                                        const b = parseInt(hex.substr(4, 2), 16);
                                        
                                        if (isPlayerAtPosition) {
                                            // プレイヤーの場合：暖色系の背景とパルス効果
                                            style += `; background-color: rgba(255, 255, 100, ${bgOpacity});`;
                                            style += `; text-shadow: 0 0 ${shadowSize}px rgba(255, 255, 100, 0.9);`;
                                            classes.push('player-in-gas');
                                        } else if (monsterAtPosition) {
                                            // モンスターの場合：赤系の背景と点滅効果
                                            style += `; background-color: rgba(255, 100, 100, ${bgOpacity});`;
                                            style += `; text-shadow: 0 0 ${shadowSize}px rgba(255, 100, 100, 0.8);`;
                                            classes.push('monster-in-gas');
                                        }
                                        
                                        // ガス中にいることを示すクラスを追加
                                        classes.push('in-gas');
                                        classes.push(`gas-density-${gas.density}`);
                                    }
                                }
                                
                                // ガスエフェクトクラスを追加
                                classes.push(`gas-${gas.type.toLowerCase()}`);
                            }
                        }
                    }
                    
                    // 電気フィールドの描画
                    const electricalField = this.game.getElectricalFieldAt(x, y);
                    if (electricalField) {
                        const fieldSettings = GAME_CONSTANTS.GASES.ELECTRICAL_FIELDS;
                        
                        // レベルに応じた表示文字を取得
                        const fieldChar = fieldSettings.CHARS[`LEVEL_${electricalField.level}`];
                        const fieldColor = fieldSettings.COLORS[`LEVEL_${electricalField.level}`];
                        
                        // プレイヤーやモンスターがいない場合のみフィールドを表示
                        const isPlayerAtPosition = (x === this.game.player.x && y === this.game.player.y);
                        const monsterAtPosition = this.game.getMonsterAt(x, y);
                        
                        if (!isPlayerAtPosition && !monsterAtPosition) {
                            content = fieldChar;
                            style = `color: ${fieldColor}; opacity: 0.7;`;
                        } else {
                            // プレイヤーやモンスターがいる場合は背景色で表示
                            style += `; text-shadow: 0 0 8px ${fieldColor};`;
                        }
                        
                        // 電気フィールドエフェクトを追加
                        classes.push('electrical-field');
                    }

                    // ★★★ ガス優先システム：ガスがない場所でのみキャラクター表示 ★★★
                    // ただし、蜘蛛の巣がある場合は蜘蛛の巣を優先
                    const hasGas = this.game.gasSystem && this.game.gasSystem.getGasAt(x, y);
                    const hasWeb = this.game.webs && this.game.webs.findIndex(web => web.x === x && web.y === y) !== -1;
                    
                    if (!hasGas && !hasWeb) {
                        if (x === this.game.player.x && y === this.game.player.y) {
                            content = this.game.player.char;
                            const healthStatus = this.game.player.getHealthStatus(this.game.player.hp, this.game.player.maxHp);
                            // 既存のtext-shadowを保持しつつ、プレイヤーの色を確保
                            const shadowMatch = style.match(/text-shadow: [^;]+/);
                            const existingShadow = shadowMatch ? `; ${shadowMatch[0]}` : '';
                            style = `color: ${healthStatus.color}; opacity: 1${existingShadow}`;
                        } else {
                            const monster = this.game.getMonsterAt(x, y);
                            if (monster) {
                                content = monster.char;
                                // 既存のエフェクトを保持しつつ、モンスターの色を確保
                                const shadowMatch = style.match(/text-shadow: [^;]+/);
                                const existingShadow = shadowMatch ? `; ${shadowMatch[0]}` : '';
                                
                                const animationMatch = style.match(/animation: [^;]+/);
                                const existingAnimation = animationMatch ? `; ${animationMatch[0]}` : '';
                                
                                style = `color: ${GAME_CONSTANTS.COLORS.MONSTER[monster.type]}; opacity: 1${existingShadow}${existingAnimation}`;
                                
                                // 睡眠状態のアニメーションを再適用
                                if (monster.isSleeping && !existingAnimation) {
                                    style += '; animation: sleeping-monster 1s infinite';
                                }
                            }
                        }
                    }
                    
                } else if (isExplored) {
                    opacity = 0.3;
                    content = this.game.tiles[y][x];
                    
                    // 🔍 UNDEFINED チェック・修復
                    if (content === undefined) {
                        console.log(`❌ UNDEFINED TILE at (${x}, ${y}) in renderMap (explored) - repairing...`);
                        content = '.'; // 安全なフォールバック
                        this.game.tiles[y][x] = '.';
                    }
                    
                    if (this.game.colors[y][x] === undefined) {
                        console.log(`❌ UNDEFINED COLOR at (${x}, ${y}) in renderMap (explored) - repairing...`);
                        this.game.colors[y][x] = '#333'; // 安全なフォールバック
                    }
                    
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
                    // 🔍 UNDEFINED チェック・修復
                    let safeContent = update.content;
                    if (safeContent === undefined) {
                        console.log(`❌ UNDEFINED in update batch - fixing to '.'`);
                        safeContent = '.';
                    }
                    
                    update.element.textContent = safeContent;
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
                        // 🔍 UNDEFINED チェック・修復
                        let safeContent = state.content;
                        if (safeContent === undefined) {
                            console.log(`❌ UNDEFINED in DOM update at (${x}, ${y}) - fixing to '.'`);
                            safeContent = '.';
                        }
                        
                        tile.textContent = safeContent;
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
                    // 🔍 UNDEFINED チェック・修復
                    let safeContent = state.content;
                    if (safeContent === undefined) {
                        console.log(`❌ UNDEFINED in HTML output at (${x}, ${y}) - fixing to '.'`);
                        safeContent = '.';
                    }
                    
                    display += `<span ${dataAttrs} ${classString} style="${state.style}">${safeContent}</span>`;
                }
            }
            container.innerHTML = display;
        }

        // Clear bleeding indicators before re-rendering
        // 出血インジケーターは使用しないため削除
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
        this.statusRenderer.renderStatus();
    }

    createNormalCombatStats(player, attackText, accText, speedText, sizeInfo) {
        return this.statusRenderer.createNormalCombatStats(player, attackText, accText, speedText, sizeInfo);
    }

    createRangedCombatStats(player) {
        return this.statusRenderer.createRangedCombatStats(player);
    }

    getNearbyEnemiesHTML() {
        return this.statusRenderer.getNearbyEnemiesHTML();
    }

    getMonsterHealthStatus(hpPercentage) {
        return this.statusRenderer.getMonsterHealthStatus(hpPercentage);
    }

    renderCodexMenu() {
        this.menuRenderer.renderCodexMenu();
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

    // 遠距離攻撃エフェクトを表示するメソッド
    showRangedAttackEffect(fromX, fromY, toX, toY, color = '#00FFFF') {
        this.effects.showRangedAttackEffect(fromX, fromY, toX, toY, color);
    }

    // 出血エフェクトを表示するメソッド - エフェクトなし、状態表示のみ
    showBleedingEffect(x, y) {
        // 実装なし - エフェクトはいらないとのこと
        // モンスターの状態はrenderMapの出血インジケーターで表示する
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


        if (this.statusPanelFlashing) {
            panel.classList.add('flash');
        }
    }

    renderHelpMenu() {
        this.menuRenderer.renderHelpMenu();
    }

    getHelpDisplay() {
        return this.menuRenderer.getHelpDisplay();
    }

    drawMonsterSprite(canvas, monster, turnCount) {
        this.spriteRenderer.drawMonsterSprite(canvas, monster, turnCount);
    }

    previewMonsterSprite(monsterType, containerId, pixelSize = 8) {
        this.spriteRenderer.previewMonsterSprite(monsterType, containerId, pixelSize);
    }

    examineTarget(targetX, targetY, lookMode = false) {
        // ターン毎にlookInfoをクリアするため、game.loggerのメソッドを呼び出す
        this.game.logger.clearLookInfo();

        // プレイヤーの視界内にあるかチェック（lookModeが有効な場合、または明示的に視界チェックをスキップする場合を除く）
        const isVisible = lookMode || this.game.getVisibleTiles().some(tile => tile.x === targetX && tile.y === targetY);
        
        // 視界内にない場合は何も表示しない
        if (!isVisible) {
            return;
        }

        let monster = this.game.getMonsterAt(targetX, targetY);
        
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'flex-start';
        container.style.gap = '80px'; // 間隔を50pxから80pxに増加
        container.style.border = 'none';
        container.style.padding = '0';

        const infoDiv = document.createElement('div');
        infoDiv.style.border = 'none';
        infoDiv.style.padding = '0';
        infoDiv.style.width = '300px'; // 幅を200pxから300pxに増加
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
            
            // 出血状態の表示を追加
            if (monster.isBleeding && monster.isBleeding()) {
                const severity = monster.getBleedingSeverity();
                let bleedingText = "Bleeding";
                
                // 重症度に応じたテキスト
                switch(severity) {
                    case 3:
                        bleedingText = "Severely Bleeding";
                        break;
                    case 2:
                        bleedingText = "Moderately Bleeding";
                        break;
                    case 1:
                        bleedingText = "Lightly Bleeding";
                        break;
                }
                
                // 合計ダメージを計算
                const totalDamagePerTurn = monster.bleedingEffects.reduce((sum, effect) => sum + effect.damagePerTurn, 0);
                const damagePercentage = ((totalDamagePerTurn / monster.maxHp) * 100).toFixed(1);
                
                // 出血ステータスをカラーテキストで表示
                status.push(`<span style="color: #FF0000">${bleedingText}</span>`);
            }

            if (status.length > 0) {
                lookInfo.push(`Status: ${status.join(", ")}`);
            }

            // --- Combat Details ---
            const speed = GAME_CONSTANTS.FORMULAS.SPEED(monster.stats);
            const size = GAME_CONSTANTS.FORMULAS.SIZE(monster.stats);
            const speedInfo = GAME_CONSTANTS.COLORS.SPEED[speed.value];
            const sizeInfo = GAME_CONSTANTS.COLORS.SIZE[size.value];

            // カテゴリ情報を追加
            const mainCategory = monster.getMainCategory();
            const subCategory = monster.getSubCategory();
            
            lookInfo.push(
                `ATK: ${monster.attackPower.base}+${monster.attackPower.diceCount}d${monster.attackPower.diceSides}`,
                `DEF: ${monster.defense.base}+${monster.defense.diceCount}d${monster.defense.diceSides}`,
                `ACC: ${monster.accuracy}%`,
                `EVA: ${monster.evasion}%`,
                `PER: ${monster.perception}`,
                `SIZE: <span style="color: ${sizeInfo.color}">${sizeInfo.name}</span>`,
                `SPD: <span style="color: ${speedInfo.color}">${speedInfo.name}</span>`,
                `CATEGORY: ${mainCategory} / ${subCategory}`
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
        this.menuRenderer.renderNamePrompt(currentInput);
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

    forceRefresh() {
        this.forceFullRender = true;
        this.render();
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

    // 照明エフェクトの有効/無効を切り替えるメソッド
    toggleLightingEffects(enabled) {
        this.effects.toggleLightingEffects(enabled);
    }

    /**
     * ウェブ消滅エフェクトを表示
     * @param {number} x - ウェブのX座標
     * @param {number} y - ウェブのY座標
     */
    showWebRemoveEffect(x, y) {
        this.effects.showWebRemoveEffect(x, y);
    }
    
    /**
     * 血痕生成エフェクトを表示
     * @param {number} x - 血痕のX座標
     * @param {number} y - 血痕のY座標
     * @param {number} severity - 出血の重症度 (1=軽度, 2=中度, 3=重度)
     */
    showBloodpoolEffect(x, y, severity) {
        this.effects.showBloodpoolEffect(x, y, severity);
    }

    /**
     * 液体エフェクトの表示
     * @param {string} type - 液体の種類
     * @param {number} x - 液体のX座標
     * @param {number} y - 液体のY座標
     * @param {number} severity - 液体の重症度 (1=軽度, 2=中度, 3=重度)
     */
    showLiquidEffect(type, x, y, severity) {
        // 現在は血液と同じエフェクトを使用
        this.effects.showBloodpoolEffect(x, y, severity);
    }

    /**
     * 照明エフェクトの切り替え
     * @param {boolean} enabled - 照明エフェクトが有効かどうか
     */

    /**
     * 故障エフェクトを表示する
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} type - 故障タイプ ('fire', 'electrical', 'oil_leak')
     * @param {number} severity - エフェクトの強度 (1-3)
     */
    showMalfunctionEffect(x, y, type, severity = 1) {
        const gameContainer = document.getElementById('game');
        if (!gameContainer) return;

        // パーティクルの数を重症度に応じて調整
        const particleCount = severity * 3;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('span');
            
            if (type === 'fire') {
                particle.textContent = '●';
                particle.className = 'fire-particle';
                particle.style.color = '#FF4444';
                particle.style.setProperty('--spark-dx', `${(Math.random() - 0.5) * 30}px`);
                particle.style.setProperty('--spark-dy', `${(Math.random() - 0.5) * 30}px`);
            } else if (type === 'electrical') {
                particle.textContent = '※';
                particle.className = 'electrical-spark';
                particle.style.color = '#44FFFF';
                particle.style.setProperty('--spark-dx', `${(Math.random() - 0.5) * 20}px`);
                particle.style.setProperty('--spark-dy', `${(Math.random() - 0.5) * 20}px`);
            }
            
            // 位置設定（実際のメソッドを使用）
            const position = this.getTilePosition(x, y);
            if (position) {
                particle.style.position = 'absolute';
                particle.style.left = `${position.x + position.width / 2}px`;
                particle.style.top = `${position.y + position.height / 2}px`;
                particle.style.zIndex = '1000';
                particle.style.pointerEvents = 'none';
                
                gameContainer.appendChild(particle);
                
                // アニメーション終了後に削除
                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }, 600);
            }
        }
    }

    /**
     * 感電範囲エフェクトを表示する
     * @param {number} x - 中心X座標
     * @param {number} y - 中心Y座標
     * @param {number} range - 感電範囲
     */
    showElectricalFieldEffect(x, y, intensity = 1) {
        if (!this.mapContainer) return;
        
        const effectDuration = 300;
        
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const sparkElement = document.createElement('div');
                sparkElement.className = 'electrical-spark';
                sparkElement.textContent = '※';
                
                const tileSize = 16;
                const left = x * tileSize + (Math.random() - 0.5) * tileSize * intensity;
                const top = y * tileSize + (Math.random() - 0.5) * tileSize * intensity;
                
                sparkElement.style.position = 'absolute';
                sparkElement.style.left = `${left}px`;
                sparkElement.style.top = `${top}px`;
                sparkElement.style.color = '#44FFFF';
                sparkElement.style.fontSize = '12px';
                sparkElement.style.pointerEvents = 'none';
                sparkElement.style.zIndex = '1000';
                sparkElement.style.setProperty('--spark-dx', `${(Math.random() - 0.5) * 30}px`);
                sparkElement.style.setProperty('--spark-dy', `${(Math.random() - 0.5) * 30}px`);
                
                this.mapContainer.appendChild(sparkElement);
                
                setTimeout(() => {
                    if (sparkElement.parentNode) {
                        sparkElement.parentNode.removeChild(sparkElement);
                    }
                }, effectDuration);
            }, i * 30);
        }
    }

    /**
     * 線形電気放電の視覚エフェクトを表示
     * @param {Array} dischargeLines - 放電線の配列
     * @param {number} baseDamage - 基本ダメージ（エフェクトの強度に影響）
     */
    showLinearElectricalDischarge(dischargeLines, baseDamage = 4) {
        if (!this.mapContainer) return;
        
        const effectDuration = 600; // 0.6秒
        const intensity = Math.min(baseDamage / 4, 3); // ダメージに応じた強度
        
        dischargeLines.forEach((line, lineIndex) => {
            // 各線を順次表示（稲妻が走るように）
            const lineDelay = lineIndex * 50;
            
            line.forEach((point, pointIndex) => {
                const pointDelay = lineDelay + pointIndex * 20; // 線が進むように遅延
                
                setTimeout(() => {
                    // 稲妻のメイン効果
                    const lightningElement = document.createElement('div');
                    lightningElement.className = 'lightning-discharge';
                    lightningElement.textContent = ['⚡', '※', '✦'][Math.floor(Math.random() * 3)];
                    
                    const tileSize = 16;
                    const left = point.x * tileSize;
                    const top = point.y * tileSize;
                    
                    lightningElement.style.position = 'absolute';
                    lightningElement.style.left = `${left}px`;
                    lightningElement.style.top = `${top}px`;
                    lightningElement.style.color = '#FFFFFF';
                    lightningElement.style.textShadow = '0 0 8px #44FFFF, 0 0 16px #66FFFF';
                    lightningElement.style.fontSize = '14px';
                    lightningElement.style.fontWeight = 'bold';
                    lightningElement.style.pointerEvents = 'none';
                    lightningElement.style.zIndex = '1000';
                    lightningElement.style.animation = 'lightning-flash 0.3s ease-out forwards';
                    
                    this.mapContainer.appendChild(lightningElement);
                    
                    // スパーク効果を追加
                    for (let i = 0; i < Math.floor(intensity); i++) {
                        const sparkElement = document.createElement('div');
                        sparkElement.className = 'lightning-spark';
                        sparkElement.textContent = '※';
                        
                        const sparkLeft = left + (Math.random() - 0.5) * tileSize;
                        const sparkTop = top + (Math.random() - 0.5) * tileSize;
                        
                        sparkElement.style.position = 'absolute';
                        sparkElement.style.left = `${sparkLeft}px`;
                        sparkElement.style.top = `${sparkTop}px`;
                        sparkElement.style.color = '#44FFFF';
                        sparkElement.style.fontSize = '10px';
                        sparkElement.style.pointerEvents = 'none';
                        sparkElement.style.zIndex = '999';
                        sparkElement.style.animation = 'spark-fade 0.4s ease-out forwards';
                        
                        this.mapContainer.appendChild(sparkElement);
                        
                        // スパークを削除
                        setTimeout(() => {
                            if (sparkElement.parentNode) {
                                sparkElement.parentNode.removeChild(sparkElement);
                            }
                        }, 400);
                    }
                    
                    // メイン稲妻を削除
                    setTimeout(() => {
                        if (lightningElement.parentNode) {
                            lightningElement.parentNode.removeChild(lightningElement);
                        }
                    }, effectDuration);
                }, pointDelay);
            });
        });
    }

    /**
     * 故障フラッシュエフェクトを表示する
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    showMalfunctionFlash(x, y) {
        const span = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        if (span) {
            span.classList.add('malfunction-flash');
            setTimeout(() => {
                span.classList.remove('malfunction-flash');
            }, 800);
        }
    }

    /**
     * 瘴気爆発の視覚エフェクトを表示
     * @param {number} x - 爆発中心X座標
     * @param {number} y - 爆発中心Y座標
     * @param {number} radius - 爆発半径
     * @param {number} density - 瘴気の濃度
     */
    showMiasmaExplosion(x, y, radius, density = 2) {
        if (!this.mapContainer) return;
        
        const intensity = Math.min(density, 3); // 最大濃度3
        const effectDuration = 800; // 0.8秒
        
        // 爆発の中心エフェクト
        const centerExplosion = document.createElement('div');
        centerExplosion.className = 'miasma-explosion-center';
        centerExplosion.textContent = '*';
        
        const tileSize = 16;
        const centerLeft = x * tileSize;
        const centerTop = y * tileSize;
        
        centerExplosion.style.position = 'absolute';
        centerExplosion.style.left = `${centerLeft}px`;
        centerExplosion.style.top = `${centerTop}px`;
        centerExplosion.style.color = '#FF6644';
        centerExplosion.style.textShadow = '0 0 16px #FF6644, 0 0 32px #FF8844';
        centerExplosion.style.fontSize = '16px';
        centerExplosion.style.fontWeight = 'bold';
        centerExplosion.style.pointerEvents = 'none';
        centerExplosion.style.zIndex = '1000';
        centerExplosion.style.animation = 'miasma-explosion-center 0.8s ease-out forwards';
        
        this.mapContainer.appendChild(centerExplosion);
        
        // 放射状の毒雲エフェクト（小さな爆発に合わせて数を調整）
        const cloudCount = Math.max(4, radius * 2); // 最小4個、半径に応じて増加
        const angleStep = 360 / cloudCount;
        for (let angle = 0; angle < 360; angle += angleStep) {
            const radian = (angle * Math.PI) / 180;
            const distance = radius * tileSize * 0.8;
            
            const cloudElement = document.createElement('div');
            cloudElement.className = 'miasma-explosion-cloud';
            cloudElement.textContent = ['%', '&', '#'][Math.floor(Math.random() * 3)];
            
            const cloudLeft = centerLeft + Math.cos(radian) * distance;
            const cloudTop = centerTop + Math.sin(radian) * distance;
            
            cloudElement.style.position = 'absolute';
            cloudElement.style.left = `${cloudLeft}px`;
            cloudElement.style.top = `${cloudTop}px`;
            cloudElement.style.color = '#CC4422';
            cloudElement.style.textShadow = '0 0 12px #CC4422, 0 0 24px #FF6644';
            cloudElement.style.fontSize = '12px';
            cloudElement.style.pointerEvents = 'none';
            cloudElement.style.zIndex = '999';
            cloudElement.style.animation = `miasma-explosion-cloud 1s ease-out forwards`;
            cloudElement.style.animationDelay = `${angle * 2}ms`;
            
            this.mapContainer.appendChild(cloudElement);
            
            // 毒雲を削除
            setTimeout(() => {
                if (cloudElement.parentNode) {
                    cloudElement.parentNode.removeChild(cloudElement);
                }
            }, 1000 + (angle * angleStep / 45));
        }
        
        // 範囲内のパーティクル散布（小さな爆発に合わせて調整）
        const particleCount = Math.max(4, radius * 4); // 最小4個、半径に応じて増加
        for (let i = 0; i < particleCount; i++) {
            const particleElement = document.createElement('div');
            particleElement.className = 'miasma-explosion-particle';
            particleElement.textContent = '.';
            
            const particleAngle = Math.random() * 360;
            const particleDistance = Math.random() * radius * tileSize;
            const particleRadian = (particleAngle * Math.PI) / 180;
            
            const particleLeft = centerLeft + Math.cos(particleRadian) * particleDistance;
            const particleTop = centerTop + Math.sin(particleRadian) * particleDistance;
            
            particleElement.style.position = 'absolute';
            particleElement.style.left = `${particleLeft}px`;
            particleElement.style.top = `${particleTop}px`;
            particleElement.style.color = '#CC4422';
            particleElement.style.fontSize = '8px';
            particleElement.style.pointerEvents = 'none';
            particleElement.style.zIndex = '998';
            particleElement.style.animation = 'miasma-explosion-particle 1.2s ease-out forwards';
            particleElement.style.animationDelay = `${i * 30}ms`;
            
            this.mapContainer.appendChild(particleElement);
            
            // パーティクルを削除
            setTimeout(() => {
                if (particleElement.parentNode) {
                    particleElement.parentNode.removeChild(particleElement);
                }
            }, 1200 + (i * 30));
        }
        
        // 中心爆発を削除
        setTimeout(() => {
            if (centerExplosion.parentNode) {
                centerExplosion.parentNode.removeChild(centerExplosion);
            }
        }, effectDuration);
    }
}