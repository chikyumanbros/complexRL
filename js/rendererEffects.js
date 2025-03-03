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
        
        // 画面フリーズエフェクト用の変数
        this.isScreenFrozen = false;
        this.freezeOverlay = null;
        this.glitchCanvas = null;
        
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
     * 揺らぎ効果を計算する関数（明るさと色用）
     * @param {number} baseOpacity - 基本の不透明度
     * @param {number} x - タイルのX座標
     * @param {number} y - タイルのY座標
     * @returns {Object} - 計算された不透明度と色
     */
    calculateFlicker(baseOpacity, x, y) {
        // ホームフロアでは灯りのエフェクトを無効化
        if (this.renderer.game.floorLevel === 0) {
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
            if (this.renderer.game.map[ny] && this.renderer.game.map[ny][nx]) {
                // 壁や遮蔽物に隣接していれば、影として明るさを少し下げる
                if (this.renderer.game.map[ny][nx] === 'wall' ||
                    (this.renderer.game.map[ny][nx] === 'obstacle' &&
                        GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.renderer.game.tiles[ny][nx]))) {
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

        const distance = GAME_CONSTANTS.DISTANCE.calculate(
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
     * 画面をフリーズさせる関数
     */
    freezeScreen() {
        //console.log('Freezing screen for vigor effect');
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
        if (this.renderer.game.playSound) {
            this.renderer.game.playSound('vigorEffectSound');
        }
    }
    
    /**
     * フリーズを解除する関数
     */
    unfreezeScreen() {
        //console.log('Unfreezing screen');
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
        if (this.renderer.game.player.meditation && this.renderer.game.player.meditation.vigorEffectMeditation) {
            // 瞑想状態がキャンセルされた場合に音を停止
            if (this.renderer.game.player.meditation.soundStarted) {
                this.renderer.game.stopSound('meditationSound');
                //console.log('Stopping meditation sound due to vigor effect cancellation');
            }
        }
    }
    
    /**
     * グリッチエフェクトを描画する関数
     * @private
     */
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
                opacity: 1 - (i / (trailCount + 1)) // 徐々に薄くなる
            });

            // 各残像を時間差で消す
            setTimeout(() => {
                this.renderer.movementEffects.delete({ x, y, opacity: 1 - (i / (trailCount + 1)) });
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

            // マップ全体のタイルを宇宙空間のタイルと色に変更
            for (let y = 0; y < this.renderer.game.height; y++) {
                for (let x = 0; x < this.renderer.game.width; x++) {
                    // ポータルからの距離を計算
                    const distanceFromPortal = Math.sqrt(
                        Math.pow(x - this.renderer.game.player.x, 2) +
                        Math.pow(y - this.renderer.game.player.y, 2)
                    );

                    // 距離に応じて変化の確率を調整
                    const changeThreshold = (currentStep / steps) * 15 - distanceFromPortal;

                    if (Math.random() < Math.max(0, changeThreshold / 15)) {
                        // SPACE配列からランダムにタイルを選択
                        this.renderer.game.tiles[y][x] = GAME_CONSTANTS.TILES.SPACE[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE.length)
                        ];

                        // SPACE_COLORSからランダムに色を選択
                        this.renderer.game.colors[y][x] = GAME_CONSTANTS.TILES.SPACE_COLORS[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE_COLORS.length)
                        ];
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
        this.animatePortal(1000, 120, callback);
    }

    /**
     * 短いポータル遷移エフェクトを開始する
     * @param {Function} callback - 遷移完了時に呼び出すコールバック関数
     */
    startShortPortalTransition(callback) {
        this.animatePortal(200, 5, callback);
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
}

// グローバルスコープでクラスを利用可能にする
if (typeof window !== 'undefined') {
    window.RendererEffects = RendererEffects;
} 