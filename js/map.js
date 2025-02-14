class MapGenerator {
    constructor(width, height, floorLevel = 1, game) {
        this.width = width;
        this.height = height;
        this.floorLevel = floorLevel;
        this.game = game;
        this.map = null;
        this.tiles = null;  // タイルの文字を保存
        this.colors = null; // タイルの色を保存
    }

    generate() {
        this.map = this.initializeMap();
        this.tiles = this.initializeTiles();
        this.colors = this.initializeColors();
        const rooms = this.generateRooms();
        this.connectRooms(rooms);
        this.placeDoors(rooms);
        this.placeStairs(rooms);  // 階段の配置を追加
        return {
            map: this.map,
            tiles: this.tiles,
            colors: this.colors,
            rooms: rooms  // 部屋の情報を追加
        };
    }

    initializeMap() {
        const map = [];
        for (let y = 0; y < this.height; y++) {
            map[y] = [];
            for (let x = 0; x < this.width; x++) {
                map[y][x] = 'wall';
            }
        }
        return map;
    }

    initializeTiles() {
        const tiles = [];
        for (let y = 0; y < this.height; y++) {
            tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                tiles[y][x] = GAME_CONSTANTS.TILES.WALL[
                    Math.floor(Math.random() * GAME_CONSTANTS.TILES.WALL.length)
                ];
            }
        }
        return tiles;
    }

    initializeColors() {
        const colors = [];
        
        // 階層の下一桁を取得 (0-9)
        const floorDigit = this.floorLevel % 10;
        
        // 危険度による色の変更
        let baseWallColor = GAME_CONSTANTS.COLORS.WALL_VARIATIONS[floorDigit];
        const dangerLevel = this.game.dangerLevel;
        
        // 危険度に応じて色を調整
        switch (dangerLevel) {
            case 'SAFE':
                // より明るく、青みがかった色に
                baseWallColor = this.adjustColor(baseWallColor, {b: 1, brightness: 1});
                break;
            case 'DANGEROUS':
                // より暗く、赤みがかった色に
                baseWallColor = this.adjustColor(baseWallColor, {r: 1, brightness: -1});
                break;
            case 'DEADLY':
                // より暗く、紫がかった色に
                baseWallColor = this.adjustColor(baseWallColor, {r: 1, b: 1, brightness: -2});
                break;
            // NORMALの場合は基本色をそのまま使用
        }
        
        // わずかなランダムな色の変動を加える
        const randomizeColor = (baseColor) => {
            const variation = Math.floor(Math.random() * 3) - 1; // -1, 0, 1 のいずれか
            const r = parseInt(baseColor[1], 16);
            const g = parseInt(baseColor[2], 16);
            const b = parseInt(baseColor[3], 16);
            
            const newR = Math.max(0, Math.min(15, r + variation)).toString(16);
            const newG = Math.max(0, Math.min(15, g + variation)).toString(16);
            const newB = Math.max(0, Math.min(15, b + variation)).toString(16);
            
            return `#${newR}${newG}${newB}`;
        };

        for (let y = 0; y < this.height; y++) {
            colors[y] = [];
            for (let x = 0; x < this.width; x++) {
                if (this.map[y][x] === 'wall') {
                    colors[y][x] = randomizeColor(baseWallColor);
                } else {
                    colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
                }
            }
        }
        return colors;
    }

    // 色を調整するヘルパーメソッド
    adjustColor(color, {r = 0, g = 0, b = 0, brightness = 0}) {
        const components = {
            r: parseInt(color[1], 16),
            g: parseInt(color[2], 16),
            b: parseInt(color[3], 16)
        };
        
        // RGB成分の調整
        if (r) components.r = Math.min(15, components.r + 1);
        if (g) components.g = Math.min(15, components.g + 1);
        if (b) components.b = Math.min(15, components.b + 1);
        
        // 明るさの全体的な調整
        Object.keys(components).forEach(key => {
            components[key] = Math.max(0, Math.min(15, components[key] + brightness));
        });
        
        return `#${components.r.toString(16)}${components.g.toString(16)}${components.b.toString(16)}`;
    }

    generateRooms() {
        const rooms = [];
        const numRooms = GAME_CONSTANTS.ROOM.MIN_COUNT + 
            Math.floor(Math.random() * (GAME_CONSTANTS.ROOM.MAX_COUNT - GAME_CONSTANTS.ROOM.MIN_COUNT));

        for (let i = 0; i < numRooms; i++) {
            let attempts = 50;
            while (attempts > 0) {
                const room = this.createRandomRoom();
                if (!this.roomsOverlap(room, rooms)) {
                    rooms.push(room);
                    this.carveRoom(room);
                    break;
                }
                attempts--;
            }
        }
        return rooms;
    }

    createRandomRoom() {
        const width = GAME_CONSTANTS.ROOM.MIN_SIZE + 
            Math.floor(Math.random() * (GAME_CONSTANTS.ROOM.MAX_SIZE - GAME_CONSTANTS.ROOM.MIN_SIZE));
        const height = GAME_CONSTANTS.ROOM.MIN_SIZE + 
            Math.floor(Math.random() * (GAME_CONSTANTS.ROOM.MAX_SIZE - GAME_CONSTANTS.ROOM.MIN_SIZE));
        const x = 1 + Math.floor(Math.random() * (this.width - width - 2));
        const y = 1 + Math.floor(Math.random() * (this.height - height - 2));

        // 部屋の明るさを3段階に設定
        const roll = Math.random();
        let brightness;
        if (roll < GAME_CONSTANTS.ROOM.BRIGHTNESS.PROBABILITIES.DIM) {
            brightness = GAME_CONSTANTS.ROOM.BRIGHTNESS.DIM;       // 暗い部屋
        } else if (roll < GAME_CONSTANTS.ROOM.BRIGHTNESS.PROBABILITIES.DIM + 
                   GAME_CONSTANTS.ROOM.BRIGHTNESS.PROBABILITIES.MODERATE) {
            brightness = GAME_CONSTANTS.ROOM.BRIGHTNESS.MODERATE;  // 中程度の明るさ
        } else {
            brightness = GAME_CONSTANTS.ROOM.BRIGHTNESS.BRIGHT;    // 明るい部屋
        }

        return { x, y, width, height, brightness };
    }

    roomsOverlap(room, otherRooms) {
        return otherRooms.some(other => 
            !(room.x + room.width + GAME_CONSTANTS.ROOM.PADDING < other.x ||
              other.x + other.width + GAME_CONSTANTS.ROOM.PADDING < room.x ||
              room.y + room.height + GAME_CONSTANTS.ROOM.PADDING < other.y ||
              other.y + other.height + GAME_CONSTANTS.ROOM.PADDING < room.y)
        );
    }

    carveRoom(room) {
        // 部屋の床を作成
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                if (y < this.height && x < this.width) {
                    this.map[y][x] = 'floor';
                    // ランダムなフロアタイルを選択
                    this.tiles[y][x] = GAME_CONSTANTS.TILES.FLOOR[
                        Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                    ];
                    this.colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
                }
            }
        }

        // 部屋のサイズが十分大きい場合のみ障害物を配置
        if (room.width >= 7 && room.height >= 7 && 
            Math.random() < GAME_CONSTANTS.ROOM.OBSTACLES.CHANCE) {
            this.placeObstacles(room);
        }
    }

    placeObstacles(room) {
        // 部屋が最小サイズより小さい場合は処理しない
        if (room.width < GAME_CONSTANTS.ROOM.OBSTACLES.MIN_ROOM_SIZE || 
            room.height < GAME_CONSTANTS.ROOM.OBSTACLES.MIN_ROOM_SIZE) {
            return;
        }

        // パターンを定義
        const patterns = [
            {
                name: 'corners',
                getPositions: (room) => [
                    {x: room.x + 1, y: room.y + 1},
                    {x: room.x + room.width - 2, y: room.y + 1},
                    {x: room.x + 1, y: room.y + room.height - 2},
                    {x: room.x + room.width - 2, y: room.y + room.height - 2}
                ]
            },
            {
                name: 'cross',
                getPositions: (room) => {
                    const centerX = Math.floor(room.x + room.width / 2);
                    const centerY = Math.floor(room.y + room.height / 2);
                    return [
                        {x: centerX, y: centerY},
                        {x: centerX - 1, y: centerY},
                        {x: centerX + 1, y: centerY},
                        {x: centerX, y: centerY - 1},
                        {x: centerX, y: centerY + 1}
                    ];
                }
            },
            {
                name: 'pillars',
                getPositions: (room) => {
                    const positions = [];
                    for (let x = room.x + 2; x < room.x + room.width - 2; x += 2) {
                        for (let y = room.y + 2; y < room.y + room.height - 2; y += 2) {
                            positions.push({x, y});
                        }
                    }
                    return positions;
                }
            },
            {
                name: 'random',
                getPositions: (room) => {
                    const positions = [];
                    const count = GAME_CONSTANTS.ROOM.OBSTACLES.MIN_COUNT + 
                        Math.floor(Math.random() * (GAME_CONSTANTS.ROOM.OBSTACLES.MAX_COUNT - GAME_CONSTANTS.ROOM.OBSTACLES.MIN_COUNT + 1));
                    
                    for (let i = 0; i < count; i++) {
                        positions.push({
                            x: room.x + 1 + Math.floor(Math.random() * (room.width - 2)),
                            y: room.y + 1 + Math.floor(Math.random() * (room.height - 2))
                        });
                    }
                    return positions;
                }
            }
        ];

        // パターンをランダムに選択
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        const positions = pattern.getPositions(room);

        // 各位置に障害物を配置
        positions.forEach(({x, y}) => {
            if (this.isValidObstaclePosition(x, y)) {
                // 視線を通す/通さない障害物の選択
                const isTransparent = Math.random() < GAME_CONSTANTS.ROOM.OBSTACLES.TRANSPARENT_RATIO;
                const obstacleType = isTransparent ? 'TRANSPARENT' : 'BLOCKING';
                const obstacles = GAME_CONSTANTS.TILES.OBSTACLE[obstacleType];
                
                // 障害物タイルをランダムに選択
                const obstacle = obstacles[Math.floor(Math.random() * obstacles.length)];
                
                // 障害物を配置
                this.map[y][x] = 'obstacle';
                this.tiles[y][x] = obstacle;
                
                // ランダムな色のバリエーションを選択
                const colorVariations = isTransparent ? 
                    GAME_CONSTANTS.COLORS.OBSTACLE.TRANSPARENT_VARIATIONS :
                    GAME_CONSTANTS.COLORS.OBSTACLE.BLOCKING_VARIATIONS;
                
                this.colors[y][x] = colorVariations[
                    Math.floor(Math.random() * colorVariations.length)
                ];
            }
        });
    }

    isValidObstaclePosition(x, y) {
        // マップ範囲内チェック
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }

        // 床タイルかチェック（障害物や他の要素がないことを確認）
        const isFloorTile = GAME_CONSTANTS.TILES.FLOOR.includes(this.tiles[y][x]);
        if (!isFloorTile) {
            return false;
        }

        // プレイヤーの初期位置からの安全距離チェック
        if (this.game?.player) {
            const dx = Math.abs(x - this.game.player.x);
            const dy = Math.abs(y - this.game.player.y);
            if (dx + dy < GAME_CONSTANTS.ROOM.SAFE_RADIUS) {
                return false;
            }
        }

        return true;
    }

    connectRooms(rooms) {
        for (let i = 1; i < rooms.length; i++) {
            const roomA = rooms[i - 1];
            const roomB = rooms[i];
            
            const x1 = Math.floor(roomA.x + roomA.width / 2);
            const y1 = Math.floor(roomA.y + roomA.height / 2);
            const x2 = Math.floor(roomB.x + roomB.width / 2);
            const y2 = Math.floor(roomB.y + roomB.height / 2);

            if (Math.random() < 0.5) {
                this.createHorizontalCorridor(x1, x2, y1);
                this.createVerticalCorridor(x2, y1, y2);
            } else {
                this.createVerticalCorridor(x1, y1, y2);
                this.createHorizontalCorridor(x1, x2, y2);
            }
        }
    }

    createHorizontalCorridor(x1, x2, y) {
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);
        
        for (let x = startX; x <= endX; x++) {
            if (y < this.height && x < this.width) {
                // 通路の上下が壁であることを確認
                if (y > 0) this.ensureWall(x, y - 1);
                if (y < this.height - 1) this.ensureWall(x, y + 1);
                
                // 通路を作成
                this.map[y][x] = 'floor';
                this.tiles[y][x] = GAME_CONSTANTS.TILES.FLOOR[
                    Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                ];
                this.colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
            }
        }
    }

    createVerticalCorridor(x, y1, y2) {
        const startY = Math.min(y1, y2);
        const endY = Math.max(y1, y2);
        
        for (let y = startY; y <= endY; y++) {
            if (y < this.height && x < this.width) {
                // 通路の左右が壁であることを確認
                if (x > 0) this.ensureWall(x - 1, y);
                if (x < this.width - 1) this.ensureWall(x + 1, y);
                
                // 通路を作成
                this.map[y][x] = 'floor';
                this.tiles[y][x] = GAME_CONSTANTS.TILES.FLOOR[
                    Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                ];
                this.colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
            }
        }
    }

    placeStairs(rooms) {
        // 最後の部屋を取得
        const lastRoom = rooms[rooms.length - 1];
        
        // 階段の配置可能な位置を収集
        const validPositions = [];
        for (let y = lastRoom.y; y < lastRoom.y + lastRoom.height; y++) {
            for (let x = lastRoom.x; x < lastRoom.x + lastRoom.width; x++) {
                // プレイヤーの開始位置と異なる場所のみを有効な位置として追加
                if (this.map[y][x] === 'floor' && 
                    !(x === this.game?.player?.x && y === this.game?.player?.y)) {
                    validPositions.push({x, y});
                }
            }
        }
        
        // 有効な位置からランダムに1つ選択
        const stairsPos = validPositions[Math.floor(Math.random() * validPositions.length)];
        
        // デバッグログ
        //console.log('Valid positions for stairs:', validPositions.length);
        //console.log('Selected position:', stairsPos);
        
        // 階段の配置
        this.map[stairsPos.y][stairsPos.x] = 'floor';  // 基底マップを床に
        this.tiles[stairsPos.y][stairsPos.x] = GAME_CONSTANTS.STAIRS.CHAR;  // 見た目を階段に
        this.colors[stairsPos.y][stairsPos.x] = GAME_CONSTANTS.STAIRS.COLOR;  // 色を階段用に
    }

    placeDoors(rooms) {
        rooms.forEach(room => {
            const candidates = [];

            // 上の壁：元は room.y、通路側は room.y - 1
            for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
                if (room.y - 1 >= 0 && this.map[room.y - 1][x] === 'floor' &&
                    // 角から1マス以上離れていることを確認
                    x > room.x + 1 && x < room.x + room.width - 2 &&
                    // 左右の2マスが壁であることを確認
                    this.map[room.y - 1][x - 1] === 'wall' &&
                    this.map[room.y - 1][x + 1] === 'wall') {
                    candidates.push({ x, y: room.y - 1 });
                }
            }

            // 下の壁
            const yBottom = room.y + room.height - 1;
            for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
                if (yBottom + 1 < this.height && this.map[yBottom + 1][x] === 'floor' &&
                    x > room.x + 1 && x < room.x + room.width - 2 &&
                    // 左右の2マスが壁であることを確認
                    this.map[yBottom + 1][x - 1] === 'wall' &&
                    this.map[yBottom + 1][x + 1] === 'wall') {
                    candidates.push({ x, y: yBottom + 1 });
                }
            }

            // 左の壁
            for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
                if (room.x - 1 >= 0 && this.map[y][room.x - 1] === 'floor' &&
                    y > room.y + 1 && y < room.y + room.height - 2 &&
                    // 上下の2マスが壁であることを確認
                    this.map[y - 1][room.x - 1] === 'wall' &&
                    this.map[y + 1][room.x - 1] === 'wall') {
                    candidates.push({ x: room.x - 1, y });
                }
            }

            // 右の壁
            const xRight = room.x + room.width - 1;
            for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
                if (xRight + 1 < this.width && this.map[y][xRight + 1] === 'floor' &&
                    y > room.y + 1 && y < room.y + room.height - 2 &&
                    // 上下の2マスが壁であることを確認
                    this.map[y - 1][xRight + 1] === 'wall' &&
                    this.map[y + 1][xRight + 1] === 'wall') {
                    candidates.push({ x: xRight + 1, y });
                }
            }

            // 候補があればランダムに１つ選び、ドアとして配置
            if (candidates.length > 0) {
                const doorPos = candidates[Math.floor(Math.random() * candidates.length)];
                if (this.tiles[doorPos.y][doorPos.x] !== GAME_CONSTANTS.STAIRS.CHAR) {
                    // ドアの周囲の壁タイルをカウント
                    let wallCount = 0;
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const checkY = doorPos.y + dy;
                            const checkX = doorPos.x + dx;
                            if (checkY >= 0 && checkY < this.height && 
                                checkX >= 0 && checkX < this.width && 
                                this.map[checkY][checkX] === 'wall') {
                                wallCount++;
                            }
                        }
                    }

                    // 壁タイルが4個以上ある場合のみドアを配置
                    if (wallCount >= 4) {
                        this.tiles[doorPos.y][doorPos.x] = GAME_CONSTANTS.TILES.DOOR.CLOSED;
                        this.colors[doorPos.y][doorPos.x] = GAME_CONSTANTS.COLORS.DOOR;
                    } else {
                        // 壁が少なすぎる場合は床にする
                        this.tiles[doorPos.y][doorPos.x] = GAME_CONSTANTS.TILES.FLOOR[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                        ];
                        this.colors[doorPos.y][doorPos.x] = GAME_CONSTANTS.COLORS.FLOOR;
                    }
                }
            }
        });
    }

    // 新しいヘルパーメソッドを追加
    ensureWall(x, y) {
        // 既に床になっている場所は壁に戻さない（部屋の中は保持）
        if (this.isPartOfRoom(x, y)) return;
        
        this.map[y][x] = 'wall';
        this.tiles[y][x] = GAME_CONSTANTS.TILES.WALL[
            Math.floor(Math.random() * GAME_CONSTANTS.TILES.WALL.length)
        ];
        this.colors[y][x] = GAME_CONSTANTS.COLORS.WALL;
    }

    // 新しいヘルパーメソッドを追加
    isPartOfRoom(x, y) {
        // 周囲8マスを確認し、3マス以上が床の場合は部屋の一部とみなす
        let floorCount = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const checkY = y + dy;
                const checkX = x + dx;
                if (checkY >= 0 && checkY < this.height && 
                    checkX >= 0 && checkX < this.width && 
                    this.map[checkY][checkX] === 'floor') {
                    floorCount++;
                }
            }
        }
        return floorCount >= 3;
    }

    // 改善した printMap メソッド
    printMap() {
        if (!this.tiles) {
            //console.log("マップが生成されていません");
            return;
        }
        for (let y = 0; y < this.height; y++) {
            let rowStr = "";
            const styles = [];
            for (let x = 0; x < this.width; x++) {
                // %c を使ってタイル毎にスタイルを指定
                rowStr += `%c${this.tiles[y][x]}`;
                // 背景を黒にして見やすく（必要に応じて調整可能）
                styles.push(`color: ${this.colors[y][x]}; background-color: black; font-weight: bold;`);
            }
            //console.log(rowStr, ...styles);
        }
    }
} 