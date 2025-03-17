/**
 * RendererEffects - レンダリングエフェクトを管理するクラス
 * Rendererから分離されたビジュアルエフェクト関連のメソッドを含む
 */
class RendererEffects {
    /**
     * @param {Renderer} renderer - 親となるRendererインスタンス
     */
    constructor(renderer) {
        this.renderer = renderer;
        
        // 揺らぎのための変数
        this.flickerTime = 0;
        this.flickerValues = new Array(20).fill(0);
        
        // 照明エフェクトの有効/無効フラグ
        this.lightingEffectsEnabled = true;
        
        // 初期の揺らぎ値を生成
        this.updateFlickerValues();
    }

    /**
     * フリッカー値を更新（ターンベース）
     */
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

    /**
     * 照明エフェクトの有効/無効を切り替える
     * @param {boolean} enabled - 有効にする場合はtrue、無効にする場合はfalse
     */
    toggleLightingEffects(enabled) {
        this.lightingEffectsEnabled = enabled;
        
        // 照明エフェクトが無効化された場合、すべてのタイルの照明エフェクトをリセット
        if (!enabled) {
            const elements = document.querySelectorAll('#game span');
            elements.forEach(el => {
                // 元の不透明度を保持
                const style = window.getComputedStyle(el);
                const currentOpacity = parseFloat(style.opacity);
                if (!isNaN(currentOpacity)) {
                    // 照明エフェクトをリセット（テキストシャドウを削除）
                    el.style.textShadow = 'none';
                }
            });
        } else {
            // 照明エフェクトが再有効化された場合、レンダリングを強制更新
            this.renderer.forceFullRender = true;
            this.renderer.render();
        }
        
        // ステータスメッセージを表示
        if (this.renderer.game && this.renderer.game.logger) {
            const message = enabled ? 
                "Lighting effects have been enabled." : 
                "Lighting effects have been disabled.";
            this.renderer.game.logger.add(message, "info");
        }
    }

    /**
     * 揺らぎ効果を計算する関数（明るさと色用）
     * @param {number} baseOpacity - 基本の不透明度
     * @param {number} x - タイルのX座標
     * @param {number} y - タイルのY座標
     * @returns {Object} - 計算された不透明度と色
     */
    calculateFlicker(baseOpacity, x, y) {
        // 照明エフェクトが無効化されている場合、または
        // ホームフロアでは灯りのエフェクトを無効化し、計算を省略
        if (!this.lightingEffectsEnabled || this.renderer.game.floorLevel === 0) {
            return {
                opacity: baseOpacity,
                color: 'transparent'  // 灯りの色も無効化
            };
        }

        // プレイヤーからの距離を計算
        const px = this.renderer.game.player.x;
        const py = this.renderer.game.player.y;
        const distance = Math.max(Math.abs(x - px), Math.abs(y - py));
        
        // 距離が遠い場合は簡易計算（パフォーマンス向上）
        if (distance > 10) {
            // 距離に応じて暗くする簡易計算
            const simplifiedOpacity = Math.max(0.4, Math.min(0.8, baseOpacity - (distance / 40)));
            return {
                opacity: simplifiedOpacity,
                color: 'rgba(255, 200, 150, 0.1)'  // 標準的な灯りの色
            };
        }

        // 通常フロアの場合は既存の処理（近い場所のみ詳細計算）
        const index1 = ((x * 3 + y * 2 + this.flickerTime) % this.flickerValues.length);
        const index2 = ((x * 7 + y * 5 + this.flickerTime * 3) % this.flickerValues.length);

        // 計算を簡略化（3つのインデックスから2つに減らす）
        const flicker = (
            this.flickerValues[index1] * 0.6 +
            this.flickerValues[index2] * 0.4
        );

        // 近隣タイルをチェックして影効果を追加する
        // パフォーマンス改善のため、プレイヤーから一定距離内のタイルのみ詳細な影計算を行う
        let shadowAdjustment = 0;
        
        // プレイヤーから近い場合のみ詳細な影計算を行う（距離5以内に縮小）
        if (distance <= 5) {
            const neighborOffsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            // 隣接タイルのチェックを最適化（全方向ではなく、ランダムに2方向のみ）
            const checkCount = Math.min(2, neighborOffsets.length);
            for (let i = 0; i < checkCount; i++) {
                const randomIndex = Math.floor(Math.random() * neighborOffsets.length);
                const offset = neighborOffsets[randomIndex];
                const nx = x + offset[0], ny = y + offset[1];
                if (this.renderer.game.map[ny] && this.renderer.game.map[ny][nx]) {
                    // 壁や遮蔽物に隣接していれば、影として明るさを少し下げる
                    if (this.renderer.game.map[ny][nx] === 'wall' ||
                        (this.renderer.game.map[ny][nx] === 'obstacle' &&
                            GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.renderer.game.tiles[ny][nx]))) {
                        shadowAdjustment -= 0.05;
                    }
                }
            }
        } else {
            // 遠いタイルは簡易計算（距離に応じて暗くする）
            shadowAdjustment = -0.05 * (distance / 20);
        }

        // 最終的なタイルの明るさ（影効果を加味）
        const opacity = Math.max(0.4, Math.min(0.8, baseOpacity + flicker * 0.3 + shadowAdjustment));

        // 灯りの色の計算を簡略化
        const warmthTotal = Math.sin(this.flickerTime * 0.1 + x * 0.2 + y * 0.3) * 0.1 + 0.1;
        const lightColor = `rgba(255, ${170 + Math.floor(warmthTotal * 85)}, ${100 + Math.floor(warmthTotal * 155)}, 0.12)`;

        return {
            opacity,
            color: lightColor
        };
    }

    /**
     * サイケデリック効果を計算する関数（ターンベース）
     * @param {number} x - タイルのX座標
     * @param {number} y - タイルのY座標
     * @param {string} baseChar - 基本の文字
     * @param {string} baseColor - 基本の色
     * @param {boolean} forceOpacity - 強制的に不透明度を設定するかどうか
     * @returns {Object} - 計算された文字と色
     */
    calculatePsychedelicEffect(x, y, baseChar, baseColor, forceOpacity = false) {
        if (!this.renderer.game.player.meditation?.active) {
            return { char: baseChar, color: baseColor };
        }

        const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
            x, y,
            this.renderer.game.player.x, this.renderer.game.player.y
        );

        const effectRange = Math.max(1, Math.min(8,
            Math.floor(this.renderer.game.player.stats.wis - Math.floor(this.renderer.game.player.stats.int / 2)) * 2
        ));

        if (distance <= effectRange) {
            // ターンカウンターを使用してシード値を生成
            const seed = this.renderer.psychedelicTurn * 1000 + x * 100 + y;
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

    /**
     * exploredStateの変更を検出するためのハッシュを計算
     * @returns {string} - 探索状態のハッシュ値
     */
    calculateExploredHash() {
        if (!this.renderer.game.explored) return '';
        
        // サンプリングでハッシュを作成（すべてのタイルを計算すると重い）
        let hash = '';
        const sampleSize = 20; // サンプリング数を適切に設定
        
        for (let i = 0; i < sampleSize; i++) {
            const y = Math.floor(Math.random() * this.renderer.game.height);
            const x = Math.floor(Math.random() * this.renderer.game.width);
            if (this.renderer.game.explored[y] && typeof this.renderer.game.explored[y][x] === 'boolean') {
                hash += this.renderer.game.explored[y][x] ? '1' : '0';
            }
        }
        
        // フロアレベルもハッシュに含める
        hash += `-${this.renderer.game.floorLevel}`;
        
        return hash;
    }

    /**
     * 完全な再描画を強制する（VigorEffectsなど特殊効果後に呼び出す）
     */
    forceRefresh() {
        //console.log('RendererEffects: 強制再描画を要求します');
        this.renderer.forceRefresh();
    }

    /**
     * VigorEffectsのforgetTilesなどの後に呼び出すためのメソッド
     */
    refreshAfterVigorEffect() {
        // forceRefreshを呼び出さずに、直接必要な処理を行う
        //console.log('RendererEffects: VigorEffect後の再描画を実行します');
        // タイル状態のキャッシュをクリア
        this.renderer.tileStateCache = {};
        // 探索状態のハッシュを更新
        this.renderer.exploredStateHash = this.calculateExploredHash();
        // 再描画を実行
        this.renderer.render();
    }

    /**
     * ダメージフラッシュエフェクトを表示
     */
    showDamageFlash() {
        const gameElement = document.getElementById('game');
        if (gameElement) {
            gameElement.classList.add('damage-flash');
            setTimeout(() => {
                gameElement.classList.remove('damage-flash');
            }, 200);
        }
    }

    /**
     * ログパネルをフラッシュさせるメソッド
     */
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

    /**
     * ステータスパネルをフラッシュさせる
     */
    flashStatusPanel() {
        const statusPanel = document.getElementById('status-panel');
        if (statusPanel) {
            statusPanel.classList.add('damage-flash');
            statusPanel.addEventListener('animationend', () => {
                statusPanel.classList.remove('damage-flash');
            });
        }
    }

    /**
     * 移動時の残像エフェクトを表示する
     * @param {number} fromX - 開始X座標
     * @param {number} fromY - 開始Y座標
     * @param {number} toX - 終了X座標
     * @param {number} toY - 終了Y座標
     */
    showMovementTrailEffect(fromX, fromY, toX, toY) {
        // 既存のエフェクトをクリア
        this.renderer.movementEffects = new Set();

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
            this.renderer.movementEffects.add({
                x,
                y,
                opacity: 1 - (i / (trailCount + 1)), // 徐々に薄くなる
                isTrail: true // 残像であることを示すフラグを追加
            });

            // 各残像を時間差で消す
            setTimeout(() => {
                this.renderer.movementEffects.delete({ x, y, opacity: 1 - (i / (trailCount + 1)), isTrail: true });
                this.renderer.render();
            }, 100 + (i * 50));
        }

        // 強制再描画
        this.renderer.render();

        // 全エフェクトを一定時間後にクリア
        setTimeout(() => {
            this.renderer.movementEffects.clear();
            this.renderer.render();
        }, 200);
    }

    /**
     * レベルアップエフェクトを表示する
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    showLevelUpEffect(x, y) {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        const pos = this.renderer.getTilePosition(x, y);
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

    /**
     * 光の柱エフェクトを表示する
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    showLightPillarEffect(x, y) {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        const pos = this.renderer.getTilePosition(x, y);
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

    /**
     * 死亡エフェクトを表示する
     * @param {number} x - X座標 
     * @param {number} y - Y座標
     * @param {string} color - エフェクトの色（デフォルト：'#9B2222'）
     */
    showDeathEffect(x, y, color = '#9B2222') {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        const pos = this.renderer.getTilePosition(x, y);
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

    /**
     * ミスまたは回避エフェクトを表示する
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {string} type - エフェクトタイプ ('miss' or 'evade')
     */
    showMissEffect(x, y, type = 'miss') {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        const pos = this.renderer.getTilePosition(x, y);
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

    /**
     * クリティカルヒットエフェクトを表示する
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {boolean} isMonster - モンスターのクリティカルかどうか
     */
    showCritEffect(x, y, isMonster = false) {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        const pos = this.renderer.getTilePosition(x, y);
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

    /**
     * ポータル遷移エフェクトのアニメーションを実行する
     * @param {number} duration - エフェクトの継続時間（ミリ秒）
     * @param {number} steps - アニメーションのステップ数
     * @param {Function} callback - アニメーション完了時に呼び出すコールバック関数
     */
    animatePortal(duration, steps, callback) {
        let currentStep = 0;

        // オリジナルのマップ状態をバックアップ
        const originalTiles = this.renderer.game.tiles.map(row => [...row]);
        const originalColors = this.renderer.game.colors.map(row => [...row]);

        // ポータル遷移開始フラグを設定
        this.renderer.game.isPortalTransitioning = true;

        // 変更されたタイルを追跡する配列（ステップごとにリセット）
        let changedTiles = [];

        const animate = () => {
            if (currentStep >= steps) {
                // ポータル遷移終了フラグをリセット
                this.renderer.game.isPortalTransitioning = false;
                // サウンドのフェードアウトを開始
                this.renderer.game.soundManager.fadeOutPortalSound();

                // マップを元の状態に戻す
                this.renderer.game.tiles = originalTiles.map(row => [...row]);
                this.renderer.game.colors = originalColors.map(row => [...row]);

                callback();
                // 通常のレンダリングを再開
                this.renderer.render();
                return;
            }

            // 各ステップで処理するタイルの数を制限
            const maxTilesToProcess = 100;
            let tilesProcessed = 0;

            // プレイヤーの位置
            const playerX = this.renderer.game.player.x;
            const playerY = this.renderer.game.player.y;

            // 現在のステップに基づいて変化の半径を計算
            const radius = Math.floor((currentStep / steps) * 15);
            
            // 各ステップで新しいタイルを変更できるように、changedTilesをリセット
            changedTiles = [];

            // 半径内のタイルをランダムに選択して処理
            for (let attempt = 0; attempt < maxTilesToProcess * 2 && tilesProcessed < maxTilesToProcess; attempt++) {
                // ランダムな角度と距離を選択
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * radius;
                
                // 極座標から直交座標に変換
                const offsetX = Math.round(Math.cos(angle) * distance);
                const offsetY = Math.round(Math.sin(angle) * distance);
                
                const x = playerX + offsetX;
                const y = playerY + offsetY;
                
                // マップの範囲内かチェック
                if (x >= 0 && x < this.renderer.game.width && y >= 0 && y < this.renderer.game.height) {
                    // タイルをまだ変更していない場合のみ処理（現在のステップ内で）
                    const tileKey = `${x},${y}`;
                    if (!changedTiles.includes(tileKey)) {
                        // SPACE配列からランダムにタイルを選択
                        this.renderer.game.tiles[y][x] = GAME_CONSTANTS.TILES.SPACE[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE.length)
                        ];

                        // SPACE_COLORSからランダムに色を選択
                        this.renderer.game.colors[y][x] = GAME_CONSTANTS.TILES.SPACE_COLORS[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE_COLORS.length)
                        ];
                        
                        // 変更したタイルを記録
                        changedTiles.push(tileKey);
                        tilesProcessed++;
                    }
                }
            }

            currentStep++;
            this.renderer.render();
            setTimeout(() => requestAnimationFrame(animate), duration / steps);
        };

        animate();
    }

    /**
     * 通常のポータル遷移エフェクトを開始する
     * @param {Function} callback - 遷移完了時に呼び出すコールバック関数
     */
    startPortalTransition(callback) {
        this.animatePortal(1000, 30, callback);
    }

    /**
     * 短いポータル遷移エフェクトを開始する
     * @param {Function} callback - 遷移完了時に呼び出すコールバック関数
     */
    startShortPortalTransition(callback) {
        this.animatePortal(200, 3, callback);
    }

    /**
     * ウェブ生成エフェクトを表示
     * @param {number} x - ウェブのX座標
     * @param {number} y - ウェブのY座標
     */
    showWebEffect(x, y) {
        // 位置を計算
        const position = this.renderer.getTilePosition(x, y);
        
        // エフェクト表示用のdivを作成
        const effectDiv = document.createElement('div');
        effectDiv.className = 'web-effect';
        effectDiv.style.position = 'absolute';
        effectDiv.style.left = `${position.x}px`;
        effectDiv.style.top = `${position.y}px`;
        effectDiv.style.width = '20px';        // 仮の値、実際のタイルサイズに合わせて調整
        effectDiv.style.height = '20px';       // 仮の値、実際のタイルサイズに合わせて調整
        effectDiv.style.zIndex = '100';
        effectDiv.style.animation = 'web-animation 0.5s';
        effectDiv.textContent = GAME_CONSTANTS.WEB.CHAR;
        effectDiv.style.color = GAME_CONSTANTS.WEB.COLOR;
        
        // ゲームコンテナに追加
        const gameContainer = document.getElementById('game');
        gameContainer.appendChild(effectDiv);
        
        // アニメーション終了後に要素を削除
        setTimeout(() => {
            if (gameContainer.contains(effectDiv)) {
                gameContainer.removeChild(effectDiv);
            }
        }, 500);
        
        // マップを再描画
        this.renderer.render();
    }

    /**
     * ウェブ消滅エフェクトを表示
     * @param {number} x - ウェブのX座標
     * @param {number} y - ウェブのY座標
     */
    showWebRemoveEffect(x, y) {
        // 位置を計算
        const position = this.renderer.getTilePosition(x, y);
        
        // エフェクト要素を作成
        const effectDiv = document.createElement('div');
        effectDiv.className = 'web-remove-effect';
        effectDiv.style.position = 'absolute';
        effectDiv.style.left = `${position.x}px`;
        effectDiv.style.top = `${position.y}px`;
        effectDiv.style.width = '20px';        // 仮の値、実際のタイルサイズに合わせて調整
        effectDiv.style.height = '20px';       // 仮の値、実際のタイルサイズに合わせて調整
        effectDiv.style.zIndex = '100';
        effectDiv.style.animation = 'web-remove-animation 0.5s';
        effectDiv.textContent = GAME_CONSTANTS.WEB.CHAR;
        effectDiv.style.color = '#FFFFFF';
        
        // ゲームコンテナに追加
        const gameContainer = document.getElementById('game');
        gameContainer.appendChild(effectDiv);
        
        // アニメーション終了後に要素を削除
        setTimeout(() => {
            if (gameContainer.contains(effectDiv)) {
                gameContainer.removeChild(effectDiv);
            }
        }, 500);
        
        // マップを再描画
        this.renderer.render();
    }

    // 弾道エフェクトを表示するメソッド
    showProjectileEffect(fromX, fromY, toX, toY, hit = true) {
        const points = this.renderer.game.getLinePoints(fromX, fromY, toX, toY);
        const duration = 300; // エフェクトの総時間（ミリ秒）
        const stepDelay = duration / points.length; // 各ポイント間の遅延

        // 前のハイライトをクリア
        this.renderer.clearHighlight();

        // 各ポイントで1つずつハイライトを表示
        points.forEach((point, index) => {
            setTimeout(() => {
                // 前のハイライトをクリア
                this.renderer.clearHighlight();

                // 現在の位置のみハイライト
                const tile = document.querySelector(`#game span[data-x="${point.x}"][data-y="${point.y}"]`);
                if (tile) {
                    tile.classList.add('highlighted');
                    // 最後の位置で命中/ミスの色を変える
                    if (index === points.length - 1) {
                        tile.style.color = hit ? '#66ccff' : '#ff6666';
                    } else {
                        tile.style.color = '#66ccff';
                    }
                }

                // 最後の位置の場合、少し待ってからクリア
                if (index === points.length - 1) {
                    setTimeout(() => {
                        this.renderer.clearHighlight();
                    }, 100);
                }
            }, index * stepDelay);
        });
    }
}

// グローバルスコープでクラスを利用可能にする
if (typeof window !== 'undefined') {
    window.RendererEffects = RendererEffects;
} 