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

        // 初期の揺らぎ値を生成
        this.updateFlickerValues();

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

    // フリッカー値を更新（ターンベース）
    updateFlickerValues() {
        this.flickerTime = (this.flickerTime + 1) % 60;

        // より不規則な揺らぎ値を生成
        for (let i = 0; i < this.flickerValues.length; i++) {
            // 複数の周期の異なるノイズを組み合わせる
            const noise1 = Math.sin(this.flickerTime * 0.1 + i * 0.7) * 0.5;
            const noise2 = Math.sin(this.flickerTime * 0.05 + i * 1.3) * 0.3;
            const noise3 = Math.sin(this.flickerTime * 0.15 + i * 0.4) * 0.1;

            // ランダム性を追加
            const randomNoise = (Math.random() - 0.5) * 0.1;

            // 複数のノイズを組み合わせて最終的な揺らぎを生成
            this.flickerValues[i] = (noise1 + noise2 + noise3 + randomNoise) * 0.8;
        }
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
        // ホームフロアでは灯りのエフェクトを無効化
        if (this.game.floorLevel === 0) {
            return {
                opacity: baseOpacity,
                color: 'transparent'  // 灯りの色も無効化
            };
        }

        // 通常フロアの場合は既存の処理
        const index1 = ((x * 3 + y * 2 + this.flickerTime) % this.flickerValues.length);
        const index2 = ((x * 7 + y * 5 + this.flickerTime * 3) % this.flickerValues.length);
        const index3 = ((x * 2 + y * 7 + this.flickerTime * 2) % this.flickerValues.length);

        const flicker = (
            this.flickerValues[index1] * 0.5 +
            this.flickerValues[index2] * 0.3 +
            this.flickerValues[index3] * 0.2
        );

        // 近隣タイルをチェックして影効果を追加する
        let shadowAdjustment = 0;
        const neighborOffsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        neighborOffsets.forEach(offset => {
            const nx = x + offset[0], ny = y + offset[1];
            if (this.game.map[ny] && this.game.map[ny][nx]) {
                // 壁や遮蔽物に隣接していれば、影として明るさを少し下げる
                if (this.game.map[ny][nx] === 'wall' ||
                    (this.game.map[ny][nx] === 'obstacle' &&
                        GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.game.tiles[ny][nx]))) {
                    shadowAdjustment -= 0.05;
                }
            }
        });

        // 最終的なタイルの明るさ（影効果を加味）
        const opacity = Math.max(0.4, Math.min(0.8, baseOpacity + flicker * 0.3 + shadowAdjustment));

        // 灯りの色の計算
        const warmth1 = Math.sin(this.flickerTime * 0.07 + x * 0.23 + y * 0.31) * 0.1;
        const warmth2 = Math.sin(this.flickerTime * 0.13 + x * 0.17 + y * 0.19) * 0.05;
        const warmthTotal = (warmth1 + warmth2) * 0.7 + 0.1;

        const lightColor = `rgba(255, ${170 + Math.floor(warmthTotal * 85)}, ${100 + Math.floor(warmthTotal * 155)}, 0.12)`;

        return {
            opacity,
            color: lightColor
        };
    }

    // サイケデリック効果を計算する関数（ターンベース）
    calculatePsychedelicEffect(x, y, baseChar, baseColor, forceOpacity = false) {
        if (!this.game.player.meditation?.active) {
            return { char: baseChar, color: baseColor };
        }

        const distance = GAME_CONSTANTS.DISTANCE.calculate(
            x, y,
            this.game.player.x, this.game.player.y
        );

        const effectRange = Math.max(1, Math.min(8,
            Math.floor(this.game.player.stats.wis - Math.floor(this.game.player.stats.int / 2)) * 2
        ));

        if (distance <= effectRange) {
            // ターンカウンターを使用してシード値を生成
            const seed = this.psychedelicTurn * 1000 + x * 100 + y;
            const rand = Math.abs(Math.sin(seed));

            if (rand < 0.5) {
                const possibleChars = GAME_CONSTANTS.TILES.SPACE;
                const possibleColors = GAME_CONSTANTS.TILES.SPACE_COLORS;

                const charIndex = Math.floor(Math.abs(Math.sin(seed * 0.3)) * possibleChars.length);
                const colorIndex = Math.floor(Math.abs(Math.cos(seed * 0.4)) * possibleColors.length);

                return {
                    char: possibleChars[charIndex] || baseChar,
                    color: possibleColors[colorIndex] || baseColor
                };
            }
        }

        return { char: baseChar, color: baseColor };
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

        // 既にレンダリングがスケジュールされている場合は重複しない
        if (this.pendingRender) return;
        
        // レンダリングをブラウザの描画サイクルに同期させる
        this.pendingRender = true;
        requestAnimationFrame(() => {
            // exploredStateのハッシュをチェック（タイル忘却などの検出用）
            const currentHash = this.calculateExploredHash();
            if (currentHash !== this.exploredStateHash) {
                console.log('探索状態の変更を検出しました。完全再描画を実行します。');
                this.forceFullRender = true;
                this.exploredStateHash = currentHash;
            }
            
            this.renderMap();
            this.renderStatus();

            // Apply meditation effect
            if (this.game.player.meditation && this.game.player.meditation.active) {
                this.showMeditationEffect(this.game.player.x, this.game.player.y);
            }

            // Apply movement effects
            this.movementEffects.forEach(effect => {
                const tile = document.querySelector(`#game span[data-x="${effect.x}"][data-y="${effect.y}"]`);
                if (tile) {
                    tile.classList.add('movement-trail');
                }
            });
            
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
                console.log('フロアレベルの変更を検出しました。通常描画に切り替えます。');
                this.forceFullRender = true;
                this.renderMap();
            } else {
                this.renderMapFast();
            }
            
            this.renderStatus();
            
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
        const updateRadius = 20; // プレイヤーの周囲20マスを更新
        
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
        console.log('Game height:', this.game.height, 'CONSTANTS height:', GAME_CONSTANTS.DIMENSIONS.HEIGHT);
        
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
            console.log(`フロアが変更されました: ${this.lastFloorLevel} または強制リフレッシュ。タイルを全て再構築します`);
            while (container.firstChild) {
                container.removeChild(container.firstChild);
            }
            // タイル状態のキャッシュをクリア
            this.tileStateCache = {};
            // 探索状態のハッシュを更新
            this.exploredStateHash = this.calculateExploredHash();
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
                        content === GAME_CONSTANTS.PORTAL.VOID.CHAR) {
                        style = `color: #00ff00; opacity: 0.5`; // ランドマークはコンソールっぽい緑
                    }
                } else if (isVisible) {
                    // タイルごとに部屋を判定する
                    const roomAtTile = this.game.getRoomAt(x, y);
                    const tileVisibility = (currentRoom && roomAtTile && roomAtTile === currentRoom) ? currentRoom.brightness : 2;

                    const distance = GAME_CONSTANTS.DISTANCE.calculate(x, y, px, py);

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
                        const targetDistance = GAME_CONSTANTS.SKILL_DISTANCE.calculate(x, y, this.game.player.x, this.game.player.y);

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
                    if (this.game.lastAttackResult.damage > 0) {
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

    renderStatus() {
        const player = this.game.player;
        const statusPanel = document.getElementById('status-panel');
        if (!statusPanel) return;

        // Calculate penalty based on surrounding monsters count
        const surroundingMonsters = player.countSurroundingMonsters(this.game);
        const penaltyPerMonster = 15;
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

        // Generate status panel HTML
        const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[this.game.dangerLevel];
        const floorDisplay = this.game.floorLevel === 0 ? "< THE NEXUS >" : this.game.floorLevel;
        const healthStatus = player.getHealthStatus(player.hp, player.maxHp);
        const vigorStatus = GAME_CONSTANTS.VIGOR.getStatus(player.vigor, player.stats);
        const size = GAME_CONSTANTS.FORMULAS.SIZE(player.stats);
        const sizeInfo = GAME_CONSTANTS.COLORS.SIZE[size.value];
        const baseSpeed = GAME_CONSTANTS.FORMULAS.SPEED(player.stats);
        const speedInfo = GAME_CONSTANTS.COLORS.SPEED[baseSpeed.value];

        // HP bar calculation
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
        let totalAccuracyMod = 0;
        if (player.nextAttackModifiers?.length > 0) {
            for (const mod of player.nextAttackModifiers) {
                if (mod.accuracyMod) totalAccuracyMod += mod.accuracyMod;
            }
            if (totalAccuracyMod !== 0) {
                const modifiedAcc = Math.floor(baseAccuracy * (1 + totalAccuracyMod));
                accText = `<span style="color: ${totalAccuracyMod > 0 ? '#2ecc71' : '#e74c3c'}">${modifiedAcc}%</span>`;
            }
        }

        // Evasion calculation
        const baseEvasion = Math.floor(player.evasion * (1 - surroundingPenalty));
        const evaText = surroundingPenalty > 0
            ? `<span style="color: #e74c3c">${baseEvasion}%</span>`
            : `${baseEvasion}%`;

        // Get nearby enemies HTML
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

            <div class="enemy-info">
                <div class="section-title">ENEMIES</div>
                ${nearbyEnemiesHTML}
            </div>
        `;
        // Update skill list display (only slots 1-9)
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

                        // スキルが属するカテゴリーを見つける
                        let categoryColor;
                        for (let cat in this.game.codexSystem.categories) {
                            if (this.game.codexSystem.categories[cat].skills.some(s => s.id === skill.id)) {
                                categoryColor = GAME_CONSTANTS.COLORS.CODEX_CATEGORY[cat];
                                break;
                            }
                        }

                        // スロット番号の使用可否判定
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

    getNearbyEnemiesHTML() {
        const visibleTiles = new Set(
            this.game.getVisibleTiles().map(({ x, y }) => `${x},${y}`)
        );

        const visibleMonsters = this.game.monsters
            .filter(monster => visibleTiles.has(`${monster.x},${monster.y}`))
            .map(monster => ({
                ...monster,
                distance: GAME_CONSTANTS.DISTANCE.calculate(
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

            // 元のHTML構造に可能な限り近づける
            return `<span style="color: ${monsterColor}">` +
                `<span style="color: ${directionColor}; display: inline-block; width: 2em">${direction}</span>[${monsterSymbol}] </span>` +
                `<span style="color: ${monsterColor}">${monster.name}</span> ${sleepStatus}${fleeingStatus} <br>` +
                `<div class="hp-bar">` +
                    `<div class="hp-numbers">HP: ${monster.hp}/${monster.maxHp}</div>` +
                    `<span class="bar ${healthClass}">${hpText}</span>` +
                `</div>`;
        }).join(''); // 各モンスター情報を<br>で区切る

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
        const statusPanel = document.getElementById('status-panel');
        if (statusPanel) {
            statusPanel.classList.add('damage-flash');
            statusPanel.addEventListener('animationend', () => {
                statusPanel.classList.remove('damage-flash');
            });
        }
    }

    // New method for next attack modifier effect
    showNextAttackModifierEffect(x, y) {
        const playerChar = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        //console.log('Player char element:', playerChar); // Debug log
        if (playerChar) {
            playerChar.classList.add('next-attack-modifier');
            //console.log('Added next-attack-modifier class'); // Debug log
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
        // 既存のエフェクトをクリア
        this.movementEffects = new Set();

        // 移動方向を計算
        const dx = toX - fromX;
        const dy = toY - fromY;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));

        // 残像の数（少なめにして見やすくする）
        const trailCount = Math.min(3, steps);

        // 各残像ポイントを計算
        for (let i = 1; i <= trailCount; i++) {
            const x = Math.round(fromX + (dx * i / (trailCount + 1)));
            const y = Math.round(fromY + (dy * i / (trailCount + 1)));
            this.movementEffects.add({
                x,
                y,
                opacity: 1 - (i / (trailCount + 1)) // 徐々に薄くなる
            });

            // 各残像を時間差で消す
            setTimeout(() => {
                this.movementEffects.delete({ x, y, opacity: 1 - (i / (trailCount + 1)) });
                this.render();
            }, 100 + (i * 50));
        }

        // 強制再描画
        this.render();

        // 全エフェクトを一定時間後にクリア
        setTimeout(() => {
            this.movementEffects.clear();
            this.render();
        }, 200);
    }

    showLevelUpEffect(x, y) {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        const pos = this.getTilePosition(x, y);
        if (!pos) return;

        const centerX = pos.x;
        const centerY = pos.y;

        const particleCount = 50;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('levelup-particle');
            particle.style.left = centerX + "px";
            particle.style.top = centerY + "px";

            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 30;
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance;
            particle.style.setProperty('--dx', dx + "px");
            particle.style.setProperty('--dy', dy + "px");

            particleLayer.appendChild(particle);
            particle.addEventListener('animationend', () => {
                particle.remove();
            });
        }
    }

    showLightPillarEffect(x, y) {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        const pos = this.getTilePosition(x, y);
        if (!pos) return;

        const centerX = pos.x;
        const centerY = pos.y;
        const bottomValue = particleLayer.offsetHeight - centerY;

        const pillar = document.createElement('div');
        pillar.classList.add('light-pillar');
        pillar.style.left = centerX + "px";
        pillar.style.bottom = bottomValue + "px";

        particleLayer.appendChild(pillar);

        pillar.addEventListener('animationend', () => {
            pillar.remove();
        });
    }

    showDeathEffect(x, y, color = '#9B2222') {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        const pos = this.getTilePosition(x, y);
        if (!pos) return;

        const centerX = pos.x;
        const centerY = pos.y;

        const particleCount = 50;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('death-particle');
            particle.style.left = centerX + "px";
            particle.style.top = centerY + "px";
            particle.style.backgroundColor = color;

            const angle = Math.random() * Math.PI * 2;
            const distance = 15 + Math.random() * 25;
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance;
            particle.style.setProperty('--dx', dx + "px");
            particle.style.setProperty('--dy', dy + "px");

            particleLayer.appendChild(particle);

            particle.addEventListener('animationend', () => {
                particle.remove();
            });
        }
    }

    showMissEffect(x, y, type = 'miss') {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        const pos = this.getTilePosition(x, y);
        if (!pos) return;

        const centerX = pos.x;
        const centerY = pos.y;

        // エフェクトの設定
        const config = {
            miss: {
                color: '#ffff00',
                size: 10,
                duration: '0.4s'
            },
            evade: {
                color: '#00FFFF',
                size: 10,
                duration: '0.4s'
            }
        };

        const settings = config[type];

        // リングエフェクトの生成
        const ring = document.createElement('div');
        ring.classList.add('miss-ring');

        // リングのスタイル設定
        ring.style.left = centerX + "px";
        ring.style.top = centerY + "px";
        ring.style.width = (settings.size * 2) + "px";
        ring.style.height = (settings.size * 2) + "px";
        ring.style.borderColor = settings.color;
        ring.style.animationDuration = settings.duration;

        particleLayer.appendChild(ring);

        // アニメーション終了時に要素を削除
        ring.addEventListener('animationend', () => {
            ring.remove();
        });
    }

    showCritEffect(x, y, isMonster = false) {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        const pos = this.getTilePosition(x, y);
        if (!pos) return;

        const popup = document.createElement('div');
        popup.className = 'crit-popup';
        popup.textContent = 'CRIT!';

        // モンスターとプレイヤーで色を分ける
        if (isMonster) {
            popup.style.color = '#ff4444';  // モンスターのクリティカル: 赤色
        } else {
            popup.style.color = '#44ff44';  // プレイヤーのクリティカル: 緑色
        }

        // 位置を設定 - y座標を下に調整
        popup.style.left = pos.x + 'px';
        popup.style.top = (pos.y + pos.height / 8) + 'px';  // タイルの中央に表示するよう調整

        particleLayer.appendChild(popup);

        // アニメーション終了時に要素を削除
        popup.addEventListener('animationend', () => {
            popup.remove();
        });
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

        rightColumn += `<div style="color: #66ccff; font-size: 15px; margin-top: 6px;">● DISTANCE & RANGE</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `Uses Euclidean distance for<br>`;
        rightColumn += `natural line of sight and range<br>`;
        rightColumn += `calculations`;
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
                      GAME_CONSTANTS.DISTANCE.calculate(
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
        const logPanel = document.getElementById('status-panel');
        if (logPanel) {
            // クラスを追加する前に既存のアニメーションを削除
            logPanel.classList.remove('log-panel-flash');
            // 強制的なリフロー（再描画）を発生させる
            void logPanel.offsetWidth;
            // 新しいアニメーションを開始
            logPanel.classList.add('log-panel-flash');
            // アニメーション終了時にクラスを削除
            setTimeout(() => {
                logPanel.classList.remove('log-panel-flash');
            }, 200); // アニメーションの長さと同じ200ms
        }
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
            "v0.1.0 alpha || Ditch the mouse, embrace the VI!", 
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
        titleArtContainer.style.letterSpacing = '-0.05em';
        titleArtContainer.style.margin = '0';
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
            div.textContent = line;
            div.className = 'message title';
            div.style.animation = 'none';
            div.style.transition = 'none';
            div.style.whiteSpace = 'pre';
            div.style.display = 'block';
            div.style.visibility = 'visible';
            div.style.color = '#fffdd0'; // クリーム色で確実に表示
            div.style.fontSize = '12px';
            div.style.opacity = '1';
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
                    const distanceFromPortal = Math.sqrt(
                        Math.pow(x - this.game.player.x, 2) +
                        Math.pow(y - this.game.player.y, 2)
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
        this.animatePortal(1000, 120, callback);
    }

    startShortPortalTransition(callback) {
        this.animatePortal(500, 25, callback);
    }

    showDamageFlash() {
        const gameElement = document.getElementById('game');
        if (gameElement) {
            gameElement.classList.add('damage-flash');
            setTimeout(() => {
                gameElement.classList.remove('damage-flash');
            }, 200);
        }
    }

    // 画面をフリーズさせる関数
    freezeScreen() {
        console.log('Freezing screen for vigor effect');
        this.isScreenFrozen = true;
        
        // フリーズオーバーレイを作成または再利用
        if (!this.freezeOverlay) {
            this.freezeOverlay = document.createElement('div');
            this.freezeOverlay.className = 'freeze-overlay';
            this.freezeOverlay.style.position = 'fixed';
            this.freezeOverlay.style.left = '0';
            this.freezeOverlay.style.width = '100%';
            this.freezeOverlay.style.height = '100%';
            this.freezeOverlay.style.backgroundColor = 'rgba(11, 15, 11, 0.1)'; // ゲームの背景色に合わせた色
            this.freezeOverlay.style.pointerEvents = 'none';
            this.freezeOverlay.style.zIndex = '9999';
            document.body.appendChild(this.freezeOverlay);
            
            // グリッチキャンバスを作成
            this.glitchCanvas = document.createElement('canvas');
            this.glitchCanvas.style.position = 'fixed';
            this.glitchCanvas.style.top = '0';
            this.glitchCanvas.style.left = '0';
            this.glitchCanvas.style.width = '100%';
            this.glitchCanvas.style.height = '100%';
            this.glitchCanvas.style.pointerEvents = 'none';
            this.glitchCanvas.style.zIndex = '10000';
            this.glitchCanvas.style.mixBlendMode = 'screen'; // ブレンドモードを追加
            document.body.appendChild(this.glitchCanvas);
        }
        
        // 既存のオーバーレイとキャンバスを表示状態に設定
        this.freezeOverlay.style.display = 'block';
        this.freezeOverlay.style.opacity = '1';
        this.glitchCanvas.style.display = 'block';
        
        // キャンバスサイズを更新（ウィンドウサイズが変わっている可能性があるため）
        this.glitchCanvas.width = window.innerWidth;
        this.glitchCanvas.height = window.innerHeight;
        
        // グリッチエフェクトを描画
        this._drawGlitchEffect();
        
        // 画面を少し揺らす効果を追加（揺れを抑える）
        document.body.classList.remove('screen-shake'); // 一度クラスを削除して再適用
        void document.body.offsetWidth; // リフロー強制
        
        // CSSアニメーションではなく、軽微な変形を適用
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.transition = 'transform 0.1s ease-in-out';
            gameContainer.style.transform = `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px)`;
            
            // 短時間で元に戻す
            setTimeout(() => {
                gameContainer.style.transform = '';
            }, 150);
        }
        
        // 効果音を再生（オプション）
        if (this.game.playSound) {
            this.game.playSound('vigorEffectSound');
        }
    }
    
    // フリーズを解除する関数
    unfreezeScreen() {
        console.log('Unfreezing screen');
        this.isScreenFrozen = false;
        
        // グリッチキャンバスをクリア
        if (this.glitchCanvas) {
            const ctx = this.glitchCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.glitchCanvas.width, this.glitchCanvas.height);
            
            // フェードアウト効果を追加
            this.glitchCanvas.style.transition = 'opacity 0.3s ease-out';
            this.glitchCanvas.style.opacity = '0';
            
            // 完全に非表示にする前に少し待つ
            setTimeout(() => {
                this.glitchCanvas.style.display = 'none';
                this.glitchCanvas.style.opacity = '1'; // 次回のために戻しておく
                this.glitchCanvas.style.transition = '';
            }, 300);
        }
        
        // オーバーレイを非表示
        if (this.freezeOverlay) {
            this.freezeOverlay.style.transition = 'opacity 0.3s ease-out';
            this.freezeOverlay.style.opacity = '0';
            
            // 完全に非表示にする前に少し待つ
            setTimeout(() => {
                this.freezeOverlay.style.display = 'none';
                this.freezeOverlay.style.opacity = '1'; // 次回のために戻しておく
                this.freezeOverlay.style.transition = '';
            }, 300);
        }
        
        // 揺れ効果を解除
        document.body.classList.remove('screen-shake');
        
        // ゲームコンテナの変形をリセット
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
            gameContainer.style.transform = '';
        }
        
        // vigor effectsによる瞑想がキャンセルされた場合、音を停止
        if (this.game.player.meditation && this.game.player.meditation.vigorEffectMeditation) {
            // 瞑想状態がキャンセルされた場合に音を停止
            if (this.game.player.meditation.soundStarted) {
                this.game.stopSound('meditationSound');
                console.log('Stopping meditation sound due to vigor effect cancellation');
            }
        }
    }
    
    // グリッチエフェクトを描画する関数
    _drawGlitchEffect() {
        if (!this.glitchCanvas) return;
        
        const ctx = this.glitchCanvas.getContext('2d');
        const width = this.glitchCanvas.width;
        const height = this.glitchCanvas.height;
        
        // キャンバスをクリア
        ctx.clearRect(0, 0, width, height);
        
        // 水平グリッチライン（より角張った形状に）
        const horizontalGlitchCount = Math.floor(Math.random() * 6) + 3;
        for (let i = 0; i < horizontalGlitchCount; i++) {
            const y = Math.floor(Math.random() * height);
            const glitchHeight = Math.floor(Math.random() * 5) + 1;
            
            // 線を分断して不規則にする
            const segmentCount = Math.floor(Math.random() * 4) + 2;
            for (let j = 0; j < segmentCount; j++) {
                const segmentWidth = Math.floor(Math.random() * (width / 3)) + 20;
                const startX = Math.floor(Math.random() * (width - segmentWidth));
                
                // より毒々しい色のパレットに変更
                const colors = [
                    'rgba(0, 255, 0, 0.25)',      // 放射性緑
                    'rgba(117, 0, 156, 0.3)',     // 暗い紫
                    'rgba(160, 220, 50, 0.2)',    // 毒々しい黄緑
                    'rgba(0, 124, 120, 0.2)',     // 暗いシアン
                    'rgba(75, 0, 130, 0.25)',     // インディゴ
                    'rgba(216, 0, 115, 0.2)',     // 不気味なマゼンタ
                    'rgba(226, 17, 0, 0.2)',      // 血のような赤
                    'rgba(124, 80, 1, 0.2)',      // 汚れたブラウン
                    'rgba(10, 200, 180, 0.2)'     // 毒々しいターコイズ
                ];
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                ctx.fillStyle = color;
                
                // 角張ったエフェクト（直角だけでなく、ギザギザも追加）
                if (Math.random() < 0.5) {
                    // 直角パターン - そのまま維持
                    const subSegments = Math.floor(Math.random() * 3) + 2;
                    const subSegmentWidth = segmentWidth / subSegments;
                    
                    for (let k = 0; k < subSegments; k++) {
                        const subX = startX + (k * subSegmentWidth);
                        const subWidth = subSegmentWidth;
                        const offset = (k % 2 === 0) ? 0 : Math.floor(Math.random() * 10) - 5;
                        
                        // 直角型のグリッチ
                        ctx.fillRect(subX, y + offset, subWidth, glitchHeight);
                        
                        // 時々垂直方向の小さなブロックを追加 - 長さのばらつきを大きく
                        if (Math.random() < 0.4) {
                            const blockHeight = Math.floor(Math.random() * 25) + 5;
                            const blockWidth = Math.max(1, Math.floor(Math.random() * 3));
                            ctx.fillRect(
                                subX + Math.floor(subWidth / 2), 
                                y + offset - blockHeight, 
                                blockWidth, 
                                blockHeight
                            );
                        }
                    }
                } else if (Math.random() < 0.7) {
                    // 基本の矩形
                    ctx.fillRect(startX, y, segmentWidth, glitchHeight);
                    
                    // 時々近くにブロックノイズを追加 - ノイズを増加
                    if (Math.random() < 0.6) {
                        const blockSize = Math.floor(Math.random() * 6) + 1;
                        const blockCount = Math.floor(Math.random() * 8) + 3;
                        
                        for (let n = 0; n < blockCount; n++) {
                            const blockX = startX + Math.floor(Math.random() * segmentWidth);
                            const blockY = y + (Math.random() < 0.5 ? -blockSize - 2 : glitchHeight + 2);
                            ctx.fillRect(blockX, blockY, blockSize, blockSize);
                        }
                    }
                } else {
                    // ギザギザパターン（より不気味なノイズ）
                    ctx.beginPath();
                    const zigHeight = Math.max(1, Math.floor(Math.random() * 8));
                    const zigCount = Math.floor(segmentWidth / Math.max(2, Math.floor(Math.random() * 6)));
                    ctx.moveTo(startX, y);
                    
                    for (let k = 0; k < zigCount; k++) {
                        const zigX = startX + (k + 1) * (segmentWidth / zigCount);
                        // より鋭角的に
                        const zigY = y + ((k % 2) ? zigHeight : -zigHeight);
                        ctx.lineTo(zigX, zigY);
                    }
                    
                    ctx.lineTo(startX + segmentWidth, y);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        }
        
        // 垂直グリッチライン（より角張った形状に）
        const verticalGlitchCount = Math.floor(Math.random() * 5) + 2;
        for (let i = 0; i < verticalGlitchCount; i++) {
            const x = Math.floor(Math.random() * width);
            const glitchWidth = Math.floor(Math.random() * 3) + 1;
            
            // 線を分断して不規則にする
            const segmentCount = Math.floor(Math.random() * 3) + 2;
            for (let j = 0; j < segmentCount; j++) {
                const segmentHeight = Math.floor(Math.random() * (height / 3)) + 20;
                const startY = Math.floor(Math.random() * (height - segmentHeight));
                
                // より毒々しい色のパレットに変更
                const colors = [
                    'rgba(0, 255, 0, 0.2)',       // 放射性緑
                    'rgba(117, 0, 156, 0.25)',    // 暗い紫
                    'rgba(160, 220, 50, 0.15)',   // 毒々しい黄緑
                    'rgba(0, 124, 120, 0.15)',    // 暗いシアン
                    'rgba(75, 0, 130, 0.2)',      // インディゴ
                    'rgba(216, 0, 115, 0.15)',    // 不気味なマゼンタ
                    'rgba(226, 17, 0, 0.15)',     // 血のような赤
                    'rgba(124, 80, 1, 0.15)',     // 汚れたブラウン
                    'rgba(10, 200, 180, 0.15)'    // 毒々しいターコイズ
                ];
                const color = colors[Math.floor(Math.random() * colors.length)];
                
                ctx.fillStyle = color;
                
                // 角張った効果を強調 - そのまま維持
                if (Math.random() < 0.5) {
                    // 段階的な矩形
                    const steps = Math.floor(Math.random() * 3) + 2;
                    const stepHeight = segmentHeight / steps;
                    
                    for (let k = 0; k < steps; k++) {
                        const stepY = startY + (k * stepHeight);
                        const xOffset = (k % 2 === 0) ? 
                            Math.floor(Math.random() * 8) : 
                            -Math.floor(Math.random() * 8);
                        
                        ctx.fillRect(x + xOffset, stepY, glitchWidth + Math.abs(xOffset/2), stepHeight);
                    }
                } else {
                    // ずれた線を描画
                    const offsetX = Math.floor(Math.random() * 10) - 5;
                    ctx.fillRect(x + offsetX, startY, glitchWidth, segmentHeight);
                    
                    // たまに水平方向のノイズを追加 - 確率増加
                    if (Math.random() < 0.5) {
                        const horizontalWidth = Math.floor(Math.random() * 20) + 5;
                        const horizontalHeight = Math.max(1, Math.floor(Math.random() * 3));
                        ctx.fillRect(
                            x + offsetX + glitchWidth, 
                            startY + Math.floor(segmentHeight / 2), 
                            horizontalWidth, 
                            horizontalHeight
                        );
                    }
                }
            }
        }
        
        // 明滅するノイズブロック（新しく追加）
        const flickerCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < flickerCount; i++) {
            // 画面の端に配置することが多い
            const isEdgeX = Math.random() < 0.6;
            const isEdgeY = Math.random() < 0.6;
            
            const blockWidth = Math.floor(Math.random() * 80) + 20;
            const blockHeight = Math.floor(Math.random() * 20) + 10;
            
            const blockX = isEdgeX ? 
                (Math.random() < 0.5 ? 0 : width - blockWidth) :
                Math.floor(Math.random() * (width - blockWidth));
                
            const blockY = isEdgeY ? 
                (Math.random() < 0.5 ? 0 : height - blockHeight) :
                Math.floor(Math.random() * (height - blockHeight));
            
            // 明滅効果（透明度を変える）
            const opacity = Math.random() * 0.2 + 0.1;
            
            // 毒々しい半透明色
            ctx.fillStyle = `rgba(0, 255, 0, ${opacity})`;
            ctx.fillRect(blockX, blockY, blockWidth, blockHeight);
            
            // ブロック内のノイズパターン
            const noiseCount = Math.floor(Math.random() * 20) + 10;
            for (let j = 0; j < noiseCount; j++) {
                const noiseX = blockX + Math.floor(Math.random() * blockWidth);
                const noiseY = blockY + Math.floor(Math.random() * blockHeight);
                const noiseSize = Math.max(1, Math.floor(Math.random() * 3));
                
                // 暗めのノイズポイント
                ctx.fillStyle = `rgba(0, 0, 0, ${opacity * 2})`;
                ctx.fillRect(noiseX, noiseY, noiseSize, noiseSize);
            }
        }
        
        // ピクセルノイズ（クラスター化 + 角張り強調）
        const noiseClusters = Math.floor(Math.random() * 4) + 2;
        for (let c = 0; c < noiseClusters; c++) {
            const clusterX = Math.floor(Math.random() * width);
            const clusterY = Math.floor(Math.random() * height);
            const clusterRadius = Math.floor(Math.random() * 50) + 20;
            const noiseCount = Math.floor(Math.random() * 30) + 10;
            
            // ノイズタイプ（角張った形状を多めに）
            const noiseType = Math.random();
            
            for (let i = 0; i < noiseCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * clusterRadius;
                const x = clusterX + Math.cos(angle) * distance;
                const y = clusterY + Math.sin(angle) * distance;
                
                // より毒々しい色のパレットに変更
                const colors = [
                    'rgba(0, 255, 0, 0.3)',       // 放射性緑
                    'rgba(117, 0, 156, 0.35)',    // 暗い紫
                    'rgba(160, 220, 50, 0.25)',   // 毒々しい黄緑
                    'rgba(0, 124, 120, 0.25)',    // 暗いシアン
                    'rgba(75, 0, 130, 0.3)',      // インディゴ
                    'rgba(216, 0, 115, 0.25)',    // 不気味なマゼンタ
                    'rgba(226, 17, 0, 0.3)',      // 血のような赤
                    'rgba(124, 80, 1, 0.25)',     // 汚れたブラウン
                    'rgba(10, 200, 180, 0.25)'    // 毒々しいターコイズ
                ];
                const color = colors[Math.floor(Math.random() * colors.length)];
                ctx.fillStyle = color;
                
                if (noiseType < 0.6) {
                    // 角張った四角形のノイズ
                    const size = Math.floor(Math.random() * 4) + 1;
                    ctx.fillRect(x, y, size, size);
                    
                    // 時々十字型のノイズを追加
                    if (Math.random() < 0.2) {
                        ctx.fillRect(x - size, y, size * 3, 1);
                        ctx.fillRect(x, y - size, 1, size * 3);
                    }
                } else if (noiseType < 0.8) {
                    // L字型のノイズ
                    const size = Math.floor(Math.random() * 3) + 2;
                    ctx.fillRect(x, y, size, 1);
                    ctx.fillRect(x, y, 1, size);
                } else {
                    // H字型ノイズ（新しく追加）
                    const size = Math.floor(Math.random() * 3) + 2;
                    ctx.fillRect(x, y, 1, size);
                    ctx.fillRect(x, y + Math.floor(size/2), size, 1);
                    ctx.fillRect(x + size - 1, y, 1, size);
                }
            }
        }
        
        // テキストのグリッチ効果（より不気味なスタイルに）
        const textCount = Math.floor(Math.random() * 3) + 2;
        
        // 提供された文字セットから選択
        const chars = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂¡¢£¤¥¦§¨©ª«¬-®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ∂∆∈∏∑−∕∙√∞∟∩∫≈≠≡≤≥⊙⌀⌂⌐⌠⌡─│┌┐└┘├┤┬┴┼═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬▀▁▄█▌▐░▒▓■□▪▫▬▲►▼◄◊○●◘◙◦";
        
        // グリッチらしいテキストパターン
        const glitchTexts = [
            "ERROR", "SYSTEM FAILURE", "BUFFER OVERFLOW", "SEGFAULT", "MEMORY LEAK",
            "STACK TRACE", "NULL POINTER", "EXCEPTION", "FATAL ERROR", "CORE DUMP",
            "SYNTAX ERROR", "RUNTIME ERROR", "DIVIDE BY ZERO", "OVERFLOW", "UNDERFLOW",
            "DEADLOCK", "TIMEOUT", "CONNECTION LOST", "DATA CORRUPT", "CHECKSUM FAIL"
        ];
        
        // 原始仏教用語（英語）
        const buddhistTerms = [
            "DUKKHA", "ANATTA", "ANICCA", "SAMSARA", "NIRVANA", 
            "DHARMA", "KARMA", "SUNYATA", "TANHA", "BODHI",
            "METTA", "SAMADHI", "SILA", "PANNA", "JHANA",
            "VIPASSANA", "UPEKKHA", "MUDITA", "KARUNA", "SKANDHA",
            "PRATITYASAMUTPADA", "BODHICITTA", "TATHATA", "SATORI", "KENSHO"
        ];
        
        // 組み合わせたテキストパターン
        const combinedTexts = [...glitchTexts, ...buddhistTerms];
        
        for (let i = 0; i < textCount; i++) {
            const x = Math.floor(Math.random() * width);
            const y = Math.floor(Math.random() * height);
            const fontSize = Math.floor(Math.random() * 14) + 8;
            
            let text = '';
            const textType = Math.random();
            
            if (textType < 0.4) {
                // 原始仏教用語を使用
                text = buddhistTerms[Math.floor(Math.random() * buddhistTerms.length)];
                
                // ランダムに一部の文字を特殊文字に置き換え - 確率増加
                const textArray = text.split('');
                const replaceCount = Math.floor(text.length * 0.4);
                
                for (let j = 0; j < replaceCount; j++) {
                    const pos = Math.floor(Math.random() * text.length);
                    textArray[pos] = chars.charAt(Math.floor(Math.random() * chars.length));
                }
                
                text = textArray.join('');
            } else if (textType < 0.7) {
                // グリッチテキストを使用
                text = glitchTexts[Math.floor(Math.random() * glitchTexts.length)];
                
                // ランダムに一部の文字を特殊文字に置き換え - 確率増加
                const textArray = text.split('');
                const replaceCount = Math.floor(text.length * 0.4);
                
                for (let j = 0; j < replaceCount; j++) {
                    const pos = Math.floor(Math.random() * text.length);
                    textArray[pos] = chars.charAt(Math.floor(Math.random() * chars.length));
                }
                
                text = textArray.join('');
            } else if (textType < 0.85) {
                // 仏教用語とエラーメッセージを組み合わせる
                const buddhistTerm = buddhistTerms[Math.floor(Math.random() * buddhistTerms.length)];
                const errorTerm = glitchTexts[Math.floor(Math.random() * glitchTexts.length)];
                
                // 組み合わせ方をランダムに選択
                if (Math.random() < 0.5) {
                    text = `${buddhistTerm}_${errorTerm}`;
                } else {
                    text = `${errorTerm}_${buddhistTerm}`;
                }
                
                // ランダムに一部の文字を特殊文字に置き換え
                const textArray = text.split('');
                const replaceCount = Math.floor(text.length * 0.3);
                
                for (let j = 0; j < replaceCount; j++) {
                    const pos = Math.floor(Math.random() * text.length);
                    textArray[pos] = chars.charAt(Math.floor(Math.random() * chars.length));
                }
                
                text = textArray.join('');
            } else {
                // 完全にランダムな文字列
                const textLength = Math.floor(Math.random() * 8) + 3;
                for (let j = 0; j < textLength; j++) {
                    text += chars.charAt(Math.floor(Math.random() * chars.length));
                }
            }
            
            ctx.font = `${fontSize}px 'IBM EGA 9x8', monospace`;
            
            // より毒々しい色のパレットに変更
            const textColors = [
                'rgba(0, 255, 0, 0.8)',       // 放射性緑
                'rgba(117, 0, 156, 0.7)',     // 暗い紫
                'rgba(160, 220, 50, 0.6)',    // 毒々しい黄緑
                'rgba(0, 124, 120, 0.7)',     // 暗いシアン
                'rgba(75, 0, 130, 0.7)',      // インディゴ
                'rgba(216, 0, 115, 0.7)',     // 不気味なマゼンタ
                'rgba(226, 17, 0, 0.7)',      // 血のような赤
                'rgba(124, 80, 1, 0.6)',      // 汚れたブラウン
                'rgba(10, 200, 180, 0.6)'     // 毒々しいターコイズ
            ];
            ctx.fillStyle = textColors[Math.floor(Math.random() * textColors.length)];
            
            // テキストエフェクト（角張った形状）
            if (Math.random() < 0.4) {
                // 角張った枠で囲むか、シャドウをつける
                if (Math.random() < 0.5) {
                    // 枠線を追加 - より強調
                    const boxPadding = 2;
                    const textWidth = ctx.measureText(text).width;
                    ctx.strokeStyle = ctx.fillStyle;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(
                        x - boxPadding, 
                        y - fontSize + boxPadding, 
                        textWidth + (boxPadding * 2), 
                        fontSize + (boxPadding * 2)
                    );
                    ctx.fillText(text, x, y);
                } else {
                    // シャドウエフェクト - より不気味に
                    const shadowColor = textColors[Math.floor(Math.random() * textColors.length)];
                    const shadowX = Math.random() < 0.5 ? 2 : -2;
                    const shadowY = Math.random() < 0.5 ? 2 : -2;
                    
                    ctx.fillStyle = shadowColor;
                    ctx.fillText(text, x + shadowX, y + shadowY);
                    
                    ctx.fillStyle = textColors[Math.floor(Math.random() * textColors.length)];
                    ctx.fillText(text, x, y);
                }
            } else if (Math.random() < 0.6) {
                // 文字化けエフェクト（新しく追加）
                for (let j = 0; j < text.length; j++) {
                    const charX = x + ctx.measureText(text.substring(0, j)).width;
                    const offsetY = Math.random() < 0.3 ? (Math.random() * 6) - 3 : 0;
                    
                    // ランダムに文字の大きさを変える
                    const sizeVariation = 1 + (Math.random() * 0.4 - 0.2);
                    ctx.font = `${Math.floor(fontSize * sizeVariation)}px 'IBM EGA 9x8', monospace`;
                    
                    ctx.fillText(text[j], charX, y + offsetY);
                }
            } else {
                // 通常のテキスト
                ctx.fillText(text, x, y);
            }
        }
        
        // 断片的なブロックグリッチ（より複雑に、角張った形状で）
        const blockCount = Math.floor(Math.random() * 3) + 1;
        for (let i = 0; i < blockCount; i++) {
            const blockWidth = Math.floor(Math.random() * 150) + 30;
            const blockHeight = Math.floor(Math.random() * 30) + 5;
            const x = Math.floor(Math.random() * (width - blockWidth));
            const y = Math.floor(Math.random() * (height - blockHeight));
            
            // ソース位置をランダムにずらす
            const sourceX = Math.floor(Math.random() * (width - blockWidth));
            const sourceY = Math.floor(Math.random() * (height - blockHeight));
            
            // 画面の一部を別の場所にコピー
            try {
                const imageData = ctx.getImageData(sourceX, sourceY, blockWidth, blockHeight);
                
                // ピクセルデータを加工 - 確率増加
                if (Math.random() < 0.8) {
                    const data = imageData.data;
                    
                    // 矩形領域内での角張った加工効果
                    const effectType = Math.random();
                    
                    if (effectType < 0.33) {
                        // 縞模様効果 - ノイズ多め
                        const stripeWidth = Math.floor(Math.random() * 4) + 1;
                        for (let j = 0; j < data.length; j += 4) {
                            const pixelIndex = j / 4;
                            const x = pixelIndex % blockWidth;
                            
                            if (x % (stripeWidth * 2) < stripeWidth) {
                                // RGBのいずれかを強調または抑制
                                const channel = Math.floor(Math.random() * 3);
                                data[j + channel] = Math.min(255, data[j + channel] * 3);
                            }
                        }
                    } else if (effectType < 0.66) {
                        // ブロックノイズ効果 - より鮮やか
                        const blockSize = Math.floor(Math.random() * 8) + 1;
                        const blockStartX = Math.floor(Math.random() * (blockWidth - blockSize));
                        const blockStartY = Math.floor(Math.random() * (blockHeight - blockSize));
                        
                        for (let y = blockStartY; y < blockStartY + blockSize && y < blockHeight; y++) {
                            for (let x = blockStartX; x < blockStartX + blockSize && x < blockWidth; x++) {
                                const index = (y * blockWidth + x) * 4;
                                if (index + 3 < data.length) {
                                    // 毒々しい緑色の要素を多く含む色に置き換え
                                    data[index] = Math.random() < 0.2 ? 255 : 0;       // R
                                    data[index + 1] = Math.random() < 0.7 ? 255 : 0;   // G - 緑色を多め
                                    data[index + 2] = Math.random() < 0.3 ? 255 : 0;   // B
                                }
                            }
                        }
                    } else {
                        // チャンネルシフト効果（より不気味に）
                        const shiftAmount = Math.floor(Math.random() * 10) + 5;
                        const shiftChannel = Math.floor(Math.random() * 3); // R, G, Bのいずれかをシフト
                        
                        for (let y = 0; y < blockHeight; y++) {
                            for (let x = 0; x < blockWidth - shiftAmount; x++) {
                                const sourceIndex = (y * blockWidth + x) * 4;
                                const targetIndex = (y * blockWidth + x + shiftAmount) * 4;
                                
                                if (targetIndex + 2 < data.length && sourceIndex + 2 < data.length) {
                                    // 指定チャンネルをシフト
                                    data[targetIndex + shiftChannel] = data[sourceIndex + shiftChannel];
                                }
                            }
                        }
                    }
                }
                
                ctx.putImageData(imageData, x, y);
                
                // ブロックの上に薄い色をオーバーレイ（毒々しい色に）
                const overlayColors = [
                    'rgba(0, 255, 0, 0.1)',       // 放射性緑
                    'rgba(117, 0, 156, 0.1)',     // 暗い紫
                    'rgba(160, 220, 50, 0.07)',   // 毒々しい黄緑
                    'rgba(0, 124, 120, 0.08)',    // 暗いシアン
                    'rgba(75, 0, 130, 0.1)',      // インディゴ
                    'rgba(216, 0, 115, 0.07)',    // 不気味なマゼンタ
                    'rgba(226, 17, 0, 0.09)',     // 血のような赤
                    'rgba(124, 80, 1, 0.06)',     // 汚れたブラウン
                    'rgba(10, 200, 180, 0.07)'    // 毒々しいターコイズ
                ];
                ctx.fillStyle = overlayColors[Math.floor(Math.random() * overlayColors.length)];
                ctx.fillRect(x, y, blockWidth, blockHeight);
                
                // 角張った枠線を追加 - より強調
                if (Math.random() < 0.7) {
                    ctx.strokeStyle = `rgba(0, 255, 0, ${Math.random() * 0.3 + 0.2})`;  // 毒々しい緑
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, blockWidth, blockHeight);
                    
                    // コーナーマークを追加（確率増加）
                    if (Math.random() < 0.7) {
                        const cornerSize = Math.floor(Math.random() * 5) + 3;
                        // 左上
                        ctx.fillRect(x, y, cornerSize, 1);
                        ctx.fillRect(x, y, 1, cornerSize);
                        // 右上
                        ctx.fillRect(x + blockWidth - cornerSize, y, cornerSize, 1);
                        ctx.fillRect(x + blockWidth - 1, y, 1, cornerSize);
                        // 左下
                        ctx.fillRect(x, y + blockHeight - 1, cornerSize, 1);
                        ctx.fillRect(x, y + blockHeight - cornerSize, 1, cornerSize);
                        // 右下
                        ctx.fillRect(x + blockWidth - cornerSize, y + blockHeight - 1, cornerSize, 1);
                        ctx.fillRect(x + blockWidth - 1, y + blockHeight - cornerSize, 1, cornerSize);
                    }
                }
            } catch (e) {
                // クロスオリジンエラーなどを防止
                console.log("グリッチブロック描画エラー:", e);
            }
        }
        
        // アニメーションを継続（ちらつきを多めに）
        if (this.isScreenFrozen) {
            setTimeout(() => this._drawGlitchEffect(), Math.floor(Math.random() * 150) + 150);
        }
    }

    // exploredStateの変更を検出するためのハッシュを計算
    calculateExploredHash() {
        if (!this.game.explored) return '';
        
        // サンプリングでハッシュを作成（すべてのタイルを計算すると重い）
        let hash = '';
        const sampleSize = 20; // サンプリング数を適切に設定
        
        for (let i = 0; i < sampleSize; i++) {
            const y = Math.floor(Math.random() * this.game.height);
            const x = Math.floor(Math.random() * this.game.width);
            if (this.game.explored[y] && typeof this.game.explored[y][x] === 'boolean') {
                hash += this.game.explored[y][x] ? '1' : '0';
            }
        }
        
        // フロアレベルもハッシュに含める
        hash += `-${this.game.floorLevel}`;
        
        return hash;
    }

    // 完全な再描画を強制する（VigorEffectsなど特殊効果後に呼び出す）
    forceRefresh() {
        console.log('強制的に完全再描画を実行します');
        this.forceFullRender = true;
        this.tileStateCache = {}; // キャッシュをクリア
        this.exploredStateHash = this.calculateExploredHash(); // 新しいハッシュを計算
        this.render(); // 再描画を実行
    }

    // VigorEffectsのforgetTilesなどの後に呼び出すためのメソッドを追加
    refreshAfterVigorEffect() {
        // 強制的に完全再描画フラグを立てる
        this.forceRefresh();
    }
}