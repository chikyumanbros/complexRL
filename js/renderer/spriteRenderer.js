class SpriteRenderer {
    constructor() {
        this.spriteColorCache = new Map();
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
} 