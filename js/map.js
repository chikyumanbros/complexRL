class MapGenerator {
    constructor(width, height, floorLevel = 1) {
        this.width = width;
        this.height = height;
        this.floorLevel = floorLevel;
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
        for (let y = 0; y < this.height; y++) {
            colors[y] = [];
            for (let x = 0; x < this.width; x++) {
                colors[y][x] = GAME_CONSTANTS.COLORS.WALL;
            }
        }
        return colors;
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

        // 部屋の明るさをランダムに設定
        const brightness = Math.random() < 0.3 ? 2 : 5;  // 30%の確率で暗い部屋（視界2マス）、それ以外は通常（視界5マス）

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
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
            if (y < this.height && x < this.width) {
                this.map[y][x] = 'floor';
                this.tiles[y][x] = GAME_CONSTANTS.TILES.FLOOR[
                    Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                ];
                this.colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
            }
        }
    }

    createVerticalCorridor(x, y1, y2) {
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
            if (y < this.height && x < this.width) {
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
        console.log('Valid positions for stairs:', validPositions.length);
        console.log('Selected position:', stairsPos);
        
        // 階段の配置
        this.map[stairsPos.y][stairsPos.x] = 'floor';  // 基底マップを床に
        this.tiles[stairsPos.y][stairsPos.x] = GAME_CONSTANTS.STAIRS.CHAR;  // 見た目を階段に
        this.colors[stairsPos.y][stairsPos.x] = GAME_CONSTANTS.STAIRS.COLOR;  // 色を階段用に
    }
} 