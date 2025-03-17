class VisionSystem {
    constructor(game) {
        this.game = game;
    }

    // 視線が通るかどうかをチェック
    hasLineOfSight(x1, y1, x2, y2) {
        const points = this.getLinePoints(x1, y1, x2, y2);
        
        // プレイヤーの位置を除く全ての点をチェック
        for (let i = 0; i < points.length - 1; i++) {
            const point = points[i];
            const tile = this.game.tiles[point.y][point.x];
            
            // 床でない場合、障害物の種類をチェック
            if (this.game.map[point.y][point.x] !== 'floor') {
                // 透明な障害物、void portal、obeliskは視線を通す
                const isTransparentObstacle = GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(tile);
                const isVoidPortal = tile === GAME_CONSTANTS.PORTAL.VOID.CHAR;
                const isObelisk = tile === GAME_CONSTANTS.NEURAL_OBELISK.CHAR;
                if (!isTransparentObstacle && !isVoidPortal && !isObelisk) {
                    return false;
                }
            }
            
            // 閉じたドアは視線を遮る
            if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                return false;
            }
        }
        return true;
    }

    // 2点間の線上の座標を取得（Bresenhamのアルゴリズム）
    getLinePoints(x1, y1, x2, y2) {
        const points = [];
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;

        let x = x1;
        let y = y1;

        while (true) {
            points.push({ x, y });
            if (x === x2 && y === y2) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
        return points;
    }

    // プレイヤーから見える全タイルを取得
    getVisibleTiles() {
        const visibleTiles = new Set();

        // ホームフロア（floor0）の場合は全タイルを表示
        if (this.game.floorLevel === 0) {
            for (let y = 0; y < GAME_CONSTANTS.DIMENSIONS.HEIGHT; y++) {
                for (let x = 0; x < GAME_CONSTANTS.DIMENSIONS.WIDTH; x++) {
                    visibleTiles.add(`${x},${y}`);
                }
            }
            return Array.from(visibleTiles).map(coord => {
                const [x, y] = coord.split(',').map(Number);
                return { x, y };
            });
        }

        // 通常フロアの場合は視界計算ロジックを使用
        const currentRoom = this.game.getCurrentRoom();
        const CORRIDOR_VISIBILITY = 3;

        // プレイヤーのperceptionに基づく最大視界範囲
        const maxVisibilityRange = this.game.player.perception;

        for (let y = 0; y < GAME_CONSTANTS.DIMENSIONS.HEIGHT; y++) {
            for (let x = 0; x < GAME_CONSTANTS.DIMENSIONS.WIDTH; x++) {
                const dx = x - this.game.player.x;
                const dy = y - this.game.player.y;
                const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(x, y, this.game.player.x, this.game.player.y);

                // 最大視界範囲を超えている場合はスキップ
                if (distance > maxVisibilityRange) continue;

                // 対象タイルが属する部屋を検出
                const roomAtTile = this.game.getRoomAt(x, y);

                let tileVisibility;
                if (roomAtTile) {
                    // タイルが部屋に属している場合、その部屋の明るさと最大視界範囲の小さい方を使用
                    tileVisibility = Math.min(roomAtTile.brightness, maxVisibilityRange);
                } else if (currentRoom && this.game.isNearRoom(x, y, currentRoom)) {
                    // プレイヤーがいる部屋の隣接タイルの場合も同様
                    tileVisibility = Math.min(currentRoom.brightness, maxVisibilityRange);
                } else {
                    // それ以外（通路など）は基本の視界範囲と最大視界範囲の小さい方を使用
                    tileVisibility = Math.min(CORRIDOR_VISIBILITY, maxVisibilityRange);
                }

                // 壁や障害物の場合は、より広い範囲で視認可能に（ただし最大視界範囲は超えない）
                if (this.game.map[y][x] === 'wall' ||
                    this.game.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED ||
                    (this.game.map[y][x] === 'obstacle' &&
                        GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.game.tiles[y][x]))) {
                    tileVisibility = Math.min(tileVisibility + 1, maxVisibilityRange);
                }

                if (distance <= tileVisibility) {
                    if (this.hasLineOfSight(this.game.player.x, this.game.player.y, x, y)) {
                        visibleTiles.add(`${x},${y}`);
                    }
                }
            }
        }
        return Array.from(visibleTiles).map(coord => {
            const [x, y] = coord.split(',').map(Number);
            return { x, y };
        });
    }
} 