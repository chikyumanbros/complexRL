class MapGenerator {
    constructor(width, height, floorLevel = 1, game) {
        this.width = GAME_CONSTANTS.DIMENSIONS.WIDTH;   
        this.height = GAME_CONSTANTS.DIMENSIONS.HEIGHT;
        this.floorLevel = floorLevel;
        this.game = game;
        this.map = null;
        this.tiles = null;  // タイルの文字を保存
        this.colors = null; // タイルの色を保存
        this.rooms = null;  // 部屋の情報を保存するプロパティを追加
        this.neuralObelisks = [];  // ニューラルオベリスクの情報を保存する配列を初期化
        this.initialWebs = [];     // 生成される蜘蛛の巣の情報を保存する配列を初期化
        this.floorTheme = this.determineFloorTheme(); // フロアテーマを決定
    }

    generate() {
        this.floorTheme = this.determineFloorTheme();
        
        if (this.floorLevel === 0) {
            this.generateHomeFloor();
            return;
        }
        
        this.initializeMap();
        this.initializeTiles();
        this.initializeColors();
        
        const rooms = this.generateRooms();
        this.connectRooms(rooms);
        this.placeObstacles(rooms);
        this.placeDoors(rooms);
        
        if (this.floorLevel > 3) {
            this.placeWebsInRooms(rooms);
            this.placeWebsInCorridors();
        }
        
        this.placeStairs(rooms);
        
        // 新しい地域接続性チェックとパス作成
        this.ensureGlobalConnectivity();
        
        if (this.game) {
            this.setFloorThemeFlavorText();
        }
        
        return this.map;
    }
    
    // マップ全体の接続性を確保するメソッド
    ensureGlobalConnectivity() {
        console.log("Checking global map connectivity...");
        
        // マップの全ての床タイルを特定
        const floorTiles = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.map[y][x] === 'floor') {
                    floorTiles.push({x, y});
                }
            }
        }
        
        if (floorTiles.length === 0) {
            console.log("No floor tiles found, skipping connectivity check");
            return;
        }
        
        // 接続性チェックの開始点
        const start = floorTiles[0];
        
        // BFS（幅優先探索）で接続されている領域を探索
        const visited = Array(this.height).fill().map(() => Array(this.width).fill(false));
        const queue = [start];
        visited[start.y][start.x] = true;
        let connectedTiles = 0;
        
        while (queue.length > 0) {
            const current = queue.shift();
            connectedTiles++;
            
            // 隣接する8方向を検査
            const directions = [
                {x: 0, y: -1}, {x: 1, y: -1}, {x: 1, y: 0}, {x: 1, y: 1},
                {x: 0, y: 1}, {x: -1, y: 1}, {x: -1, y: 0}, {x: -1, y: -1}
            ];
            
            for (const dir of directions) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;
                
                // マップ範囲内かチェック
                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
                    continue;
                }
                
                // 未訪問の床タイルのみ探索
                if (!visited[ny][nx] && this.map[ny][nx] === 'floor') {
                    visited[ny][nx] = true;
                    queue.push({x: nx, y: ny});
                }
            }
        }
        
        // 未接続の床タイルを特定
        const disconnectedRegions = [];
        let currentRegion = [];
        
        for (const tile of floorTiles) {
            if (!visited[tile.y][tile.x]) {
                // この床タイルは最初のBFSで到達できなかった
                currentRegion = this.exploreRegion(tile.x, tile.y, visited);
                disconnectedRegions.push(currentRegion);
            }
        }
        
        console.log(`Connected tiles: ${connectedTiles}, Total floor tiles: ${floorTiles.length}`);
        console.log(`Found ${disconnectedRegions.length} disconnected regions`);
        
        // 未接続の領域を接続する
        if (disconnectedRegions.length > 0) {
            this.connectDisconnectedRegions(disconnectedRegions, visited);
        }
    }
    
    // 特定の開始点から接続されている領域を探索
    exploreRegion(startX, startY, visited) {
        const region = [];
        const tempVisited = JSON.parse(JSON.stringify(visited)); // ディープコピー
        const queue = [{x: startX, y: startY}];
        tempVisited[startY][startX] = true;
        
        while (queue.length > 0) {
            const current = queue.shift();
            region.push(current);
            
            // 隣接する8方向を検査
            const directions = [
                {x: 0, y: -1}, {x: 1, y: -1}, {x: 1, y: 0}, {x: 1, y: 1},
                {x: 0, y: 1}, {x: -1, y: 1}, {x: -1, y: 0}, {x: -1, y: -1}
            ];
            
            for (const dir of directions) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;
                
                // マップ範囲内かチェック
                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
                    continue;
                }
                
                // 未訪問の床タイルのみ探索
                if (!tempVisited[ny][nx] && this.map[ny][nx] === 'floor') {
                    tempVisited[ny][nx] = true;
                    queue.push({x: nx, y: ny});
                    visited[ny][nx] = true; // 元の訪問フラグも更新
                }
            }
        }
        
        return region;
    }
    
    // 切断された領域をメインマップに接続
    connectDisconnectedRegions(disconnectedRegions, visited) {
        console.log("Connecting disconnected regions to main map...");
        
        // メイン領域（接続されている部分）のエッジタイルを特定
        const mainMapEdgeTiles = this.findEdgeTiles(visited);
        
        // 各切断領域をメインマップに接続
        disconnectedRegions.forEach((region, index) => {
            console.log(`Connecting region ${index + 1} with ${region.length} tiles`);
            
            // この領域のエッジタイルを特定
            const regionEdgeTiles = this.findRegionEdgeTiles(region);
            
            // 最適な接続点を見つける
            let bestConnection = null;
            let shortestDistance = Infinity;
            
            for (const mainTile of mainMapEdgeTiles) {
                for (const regionTile of regionEdgeTiles) {
                    const distance = Math.abs(mainTile.x - regionTile.x) + Math.abs(mainTile.y - regionTile.y);
                    
                    if (distance < shortestDistance) {
                        shortestDistance = distance;
                        bestConnection = {main: mainTile, region: regionTile};
                    }
                }
            }
            
            if (bestConnection) {
                console.log(`Creating path from (${bestConnection.main.x},${bestConnection.main.y}) to (${bestConnection.region.x},${bestConnection.region.y})`);
                this.createForcedDirectPath(bestConnection.main.x, bestConnection.main.y, bestConnection.region.x, bestConnection.region.y);
            } else {
                console.log("Failed to find connection points for region");
            }
        });
    }
    
    // マップのエッジタイル（壁に隣接する床タイル）を特定
    findEdgeTiles(visited) {
        const edgeTiles = [];
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // 訪問済みの床タイルのみチェック
                if (!visited[y][x] || this.map[y][x] !== 'floor') {
                    continue;
                }
                
                // 隣接するセルに壁があるかチェック
                const directions = [
                    {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}
                ];
                
                let isEdge = false;
                for (const dir of directions) {
                    const nx = x + dir.x;
                    const ny = y + dir.y;
                    
                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.map[ny][nx] === 'wall') {
                        isEdge = true;
                        break;
                    }
                }
                
                if (isEdge) {
                    edgeTiles.push({x, y});
                }
            }
        }
        
        return edgeTiles;
    }
    
    // 領域のエッジタイルを特定
    findRegionEdgeTiles(region) {
        const edgeTiles = [];
        
        for (const tile of region) {
            // 隣接するセルに壁があるかチェック
            const directions = [
                {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}
            ];
            
            let isEdge = false;
            for (const dir of directions) {
                const nx = tile.x + dir.x;
                const ny = tile.y + dir.y;
                
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.map[ny][nx] === 'wall') {
                    isEdge = true;
                    break;
                }
            }
            
            if (isEdge) {
                edgeTiles.push({x: tile.x, y: tile.y});
            }
        }
        
        return edgeTiles;
    }
    
    // 2点間に強制的な直線パスを作成
    createForcedDirectPath(startX, startY, endX, endY) {
        const dx = Math.abs(endX - startX);
        const dy = Math.abs(endY - startY);
        const sx = (startX < endX) ? 1 : -1;
        const sy = (startY < endY) ? 1 : -1;
        let err = dx - dy;
        
        // 幅広い通路を作成する（通行しやすくするため）
        const pathWidth = 2; // 合計幅5マス（中心から両側に2マス）
        
        let x = startX, y = startY;
        console.log(`Creating wide path from (${startX},${startY}) to (${endX},${endY})`);
        
        while (true) {
            // 現在位置とその周囲を床に設定
            for (let offsetY = -pathWidth; offsetY <= pathWidth; offsetY++) {
                for (let offsetX = -pathWidth; offsetX <= pathWidth; offsetX++) {
                    const nx = x + offsetX;
                    const ny = y + offsetY;
                    
                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                        // 特殊タイル（階段など）は維持
                        if (GAME_CONSTANTS.STAIRS && this.tiles[ny][nx] === GAME_CONSTANTS.STAIRS.CHAR) {
                            continue;
                        }
                        
                        this.map[ny][nx] = 'floor';
                        this.tiles[ny][nx] = GAME_CONSTANTS.TILES.FLOOR[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                        ];
                        this.colors[ny][nx] = GAME_CONSTANTS.COLORS.FLOOR;
                    }
                }
            }
            
            // 終点に到達したら終了
            if (x === endX && y === endY) break;
            
            // 次の位置を計算
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
        }
        
        console.log("Path created successfully");
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
        
        // ホームフロア（レベル0）の場合は壁を白に
        if (this.floorLevel === 0) {
            for (let y = 0; y < this.height; y++) {
                colors[y] = [];
                for (let x = 0; x < this.width; x++) {
                    colors[y][x] = this.map[y][x] === 'wall' ? '#FFFFFF' : GAME_CONSTANTS.COLORS.FLOOR;
                }
            }
            return colors;
        }

        // 階層の下一桁を取得 (0-9)
        const floorDigit = this.floorLevel % 10;
        
        // 危険度による色の変更
        let baseWallColor = GAME_CONSTANTS.COLORS.WALL_VARIATIONS[floorDigit];
        const dangerLevel = this.game.dangerLevel;
        
        // テーマに応じた色の調整
        switch (this.floorTheme) {
            case 'CAVE':
                // 洞窟は自然な茶色/岩っぽい色に
                baseWallColor = this.adjustColor(baseWallColor, {r: 1, g: 0.5, b: 0, brightness: 0});
                break;
            case 'LABORATORY':
                // 実験施設は白っぽく清潔な色に
                baseWallColor = this.adjustColor(baseWallColor, {r: 0.5, g: 0.5, b: 0.5, brightness: 2});
                break;
            case 'RUINS':
                // 遺跡は古びた石の色に
                baseWallColor = this.adjustColor(baseWallColor, {r: 0.5, g: 0.5, b: 0, brightness: -1});
                break;
            case 'CRYPT':
                // 地下墓地は暗く不気味な色に
                baseWallColor = this.adjustColor(baseWallColor, {r: 0, g: 0, b: 0.5, brightness: -2});
                break;
        }
        
        // 危険度に応じて色を調整
        switch (dangerLevel) {
            case 'SAFE':
                baseWallColor = this.adjustColor(baseWallColor, {b: 1, brightness: 1});
                break;
            case 'DANGEROUS':
                baseWallColor = this.adjustColor(baseWallColor, {r: 1, brightness: -1});
                break;
            case 'DEADLY':
                baseWallColor = this.adjustColor(baseWallColor, {r: 1, b: 1, brightness: -2});
                break;
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
        
        // テーマに基づいて部屋数を調整
        let minRooms, maxRooms;
        switch (this.floorTheme) {
            case 'CAVE':
                minRooms = Math.max(1, GAME_CONSTANTS.ROOM.MIN_COUNT - 1);
                maxRooms = Math.max(minRooms + 2, GAME_CONSTANTS.ROOM.MAX_COUNT - 2);
                break;
            case 'LABORATORY':
                minRooms = GAME_CONSTANTS.ROOM.MIN_COUNT + 1;
                maxRooms = GAME_CONSTANTS.ROOM.MAX_COUNT + 2;
                break;
            case 'RUINS':
                minRooms = GAME_CONSTANTS.ROOM.MIN_COUNT;
                maxRooms = GAME_CONSTANTS.ROOM.MAX_COUNT + 1;
                break;
            case 'CRYPT':
                minRooms = GAME_CONSTANTS.ROOM.MIN_COUNT - 1;
                maxRooms = GAME_CONSTANTS.ROOM.MIN_COUNT + 2;
                break;
            default:
                minRooms = GAME_CONSTANTS.ROOM.MIN_COUNT;
                maxRooms = GAME_CONSTANTS.ROOM.MAX_COUNT;
        }
        
        const numRooms = minRooms + Math.floor(Math.random() * (maxRooms - minRooms));

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
        // 基本となる長方形の部屋を作成
        const baseWidth = GAME_CONSTANTS.ROOM.MIN_SIZE + 
            Math.floor(Math.random() * (GAME_CONSTANTS.ROOM.MAX_SIZE - GAME_CONSTANTS.ROOM.MIN_SIZE));
        const baseHeight = GAME_CONSTANTS.ROOM.MIN_SIZE + 
            Math.floor(Math.random() * (GAME_CONSTANTS.ROOM.MAX_SIZE - GAME_CONSTANTS.ROOM.MIN_SIZE));
        const x = 1 + Math.floor(Math.random() * (this.width - baseWidth - 2));
        const y = 1 + Math.floor(Math.random() * (this.height - baseHeight - 2));

        // テーマに基づいて部屋の形状を決定
        let shapeTypes = [];
        
        switch (this.floorTheme) {
            case 'CAVE':
                // 洞窟テーマ: 自然な形状が多い
                shapeTypes = [
                    { id: 4, weight: 70 },  // 洞窟型 (70%)
                    { id: 3, weight: 20 },  // 不規則 (20%)
                    { id: 0, weight: 10 }   // 長方形 (10%)
                ];
                    break;
            case 'RUINS':
                // 遺跡テーマ: 崩れた建物のような形状
                shapeTypes = [
                    { id: 1, weight: 30 },  // L字型 (30%)
                    { id: 2, weight: 30 },  // 凹型 (30%)
                    { id: 3, weight: 30 },  // 不規則 (30%)
                    { id: 0, weight: 10 }   // 長方形 (10%)
                ];
                break;
            case 'LABORATORY':
                // 実験施設テーマ: 人工的で整った形状
                shapeTypes = [
                    { id: 0, weight: 60 },  // 長方形 (60%)
                    { id: 1, weight: 20 },  // L字型 (20%)
                    { id: 2, weight: 20 }   // 凹型 (20%)
                ];
                break;
            case 'CRYPT':
                // 地下墓地テーマ: 小さく整った部屋が多い
                shapeTypes = [
                    { id: 0, weight: 80 },  // 長方形 (80%)
                    { id: 1, weight: 10 },  // L字型 (10%)
                    { id: 2, weight: 10 }   // 凹型 (10%)
                ];
                break;
            default:
                // 標準テーマ: バランスのとれた形状分布
                shapeTypes = [
                    { id: 0, weight: 40 },  // 長方形 (40%)
                    { id: 1, weight: 15 },  // L字型 (15%)
                    { id: 2, weight: 15 },  // 凹型 (15%)
                    { id: 3, weight: 15 },  // 不規則 (15%)
                    { id: 4, weight: 15 }   // 洞窟型 (15%)
                ];
        }
        
        // 重み付き抽選で部屋形状を決定
        const totalWeight = shapeTypes.reduce((sum, type) => sum + type.weight, 0);
        let roll = Math.random() * totalWeight;
        let shapeType = 0;
        
        for (const type of shapeTypes) {
            roll -= type.weight;
            if (roll <= 0) {
                shapeType = type.id;
                break;
            }
        }

        // 部屋の実際の形状を格納する配列
        const shape = [];
        for (let i = 0; i < baseHeight; i++) {
            shape[i] = new Array(baseWidth).fill(true);
        }

        // 形状に応じて部屋を加工
        switch (shapeType) {
            case 4: // 洞窟型
                // 洞窟生成時のパラメータをテーマに合わせて調整
                const caveParams = {
                    initialFloorChance: 0.6,  // 初期の床の確率
                    iterations: 4             // セルオートマトンの繰り返し回数
                };
                
                if (this.floorTheme === 'CAVE') {
                    // CAVEテーマでは、より自然で広い洞窟
                    caveParams.initialFloorChance = 0.7;
                    caveParams.iterations = 3;
                }
                
                this.generateCaveShape(shape, baseWidth, baseHeight, caveParams);
                break;
            
            // 他の形状も同様に処理...
            case 1: // L字型
                const cutSize = Math.floor(Math.min(baseWidth, baseHeight) * 0.4);
                for (let i = 0; i < cutSize; i++) {
                    for (let j = 0; j < cutSize; j++) {
                        shape[i][baseWidth - 1 - j] = false;
                    }
                }
                break;

            // ... 他の形状処理
        }

        // 明るさの設定（テーマによって調整）
        let brightness;
        const roll2 = Math.random();
        
        // テーマごとに明るさ確率を調整
        let dimProb, moderateProb;
        
        switch (this.floorTheme) {
            case 'CAVE':
                // 洞窟は暗い傾向
                dimProb = GAME_CONSTANTS.ROOM.BRIGHTNESS.PROBABILITIES.DIM * 1.5;
                moderateProb = GAME_CONSTANTS.ROOM.BRIGHTNESS.PROBABILITIES.MODERATE * 0.8;
                break;
            case 'LABORATORY':
                // 実験施設は明るい傾向
                dimProb = GAME_CONSTANTS.ROOM.BRIGHTNESS.PROBABILITIES.DIM * 0.5;
                moderateProb = GAME_CONSTANTS.ROOM.BRIGHTNESS.PROBABILITIES.MODERATE * 0.8;
                break;
            case 'CRYPT':
                // 地下墓地は非常に暗い
                dimProb = GAME_CONSTANTS.ROOM.BRIGHTNESS.PROBABILITIES.DIM * 2;
                moderateProb = GAME_CONSTANTS.ROOM.BRIGHTNESS.PROBABILITIES.MODERATE * 0.7;
                break;
            default:
                dimProb = GAME_CONSTANTS.ROOM.BRIGHTNESS.PROBABILITIES.DIM;
                moderateProb = GAME_CONSTANTS.ROOM.BRIGHTNESS.PROBABILITIES.MODERATE;
        }
        
        // 明るさ決定
        if (roll2 < dimProb) {
            brightness = GAME_CONSTANTS.ROOM.BRIGHTNESS.DIM;
        } else if (roll2 < dimProb + moderateProb) {
            brightness = GAME_CONSTANTS.ROOM.BRIGHTNESS.MODERATE;
        } else {
            brightness = GAME_CONSTANTS.ROOM.BRIGHTNESS.BRIGHT;
        }

        return { x, y, width: baseWidth, height: baseHeight, brightness, shape };
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
        // 部屋の形状に従って床を作成
        for (let y = 0; y < room.height; y++) {
            for (let x = 0; x < room.width; x++) {
                if (room.shape[y][x]) {  // shapeがtrueの場所のみ床を作成
                    const mapY = room.y + y;
                    const mapX = room.x + x;
                    if (mapY < this.height && mapX < this.width) {
                        this.map[mapY][mapX] = 'floor';
                        this.tiles[mapY][mapX] = GAME_CONSTANTS.TILES.FLOOR[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                        ];
                        this.colors[mapY][mapX] = GAME_CONSTANTS.COLORS.FLOOR;
                    }
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
                    
                    // ニューラルオベリスク生成チャンスがある場合は中心を除外
                    const shouldPlaceObelisk = Math.random() < GAME_CONSTANTS.NEURAL_OBELISK.SPAWN_CHANCE;
                    
                    const positions = [
                        // 中心位置を条件付きで追加
                        ...(shouldPlaceObelisk ? [] : [{x: centerX, y: centerY}]),
                        {x: centerX - 1, y: centerY},
                        {x: centerX + 1, y: centerY},
                        {x: centerX, y: centerY - 1},
                        {x: centerX, y: centerY + 1}
                    ];
                    
                    // 中心位置情報を保存
                    if (shouldPlaceObelisk) {
                        positions.centerX = centerX;
                        positions.centerY = centerY;
                        positions.shouldPlaceObelisk = true;
                    }
                    
                    return positions;
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
                name: 'zigzag',
                getPositions: (room) => {
                    const positions = [];
                    let offset = 0;
                    for (let y = room.y + 2; y < room.y + room.height - 2; y += 2) {
                        const x = room.x + 2 + offset;
                        if (x < room.x + room.width - 2) {
                            positions.push({x, y});
                        }
                        offset = (offset + 2) % 4; // 2マスずつジグザグに
                    }
                    return positions;
                }
            },
            {
                name: 'diamond',
                getPositions: (room) => {
                    const positions = [];
                    const centerX = Math.floor(room.x + room.width / 2);
                    const centerY = Math.floor(room.y + room.height / 2);
                    const size = Math.min(
                        Math.floor((room.width - 4) / 2),
                        Math.floor((room.height - 4) / 2)
                    );
                    
                    // ニューラルオベリスク生成チャンスがある場合は中心を除外
                    const shouldPlaceObelisk = Math.random() < GAME_CONSTANTS.NEURAL_OBELISK.SPAWN_CHANCE;
                    
                    // ダイヤモンド型に配置（中心を除外するかどうかを判定）
                    for (let i = 0; i <= size; i++) {
                        // i=0 の場合は中心点なので、条件付きで追加
                        if (i === 0) {
                            if (!shouldPlaceObelisk) {
                                positions.push({x: centerX, y: centerY});
                            }
                        } else {
                            positions.push({x: centerX + i, y: centerY + i});
                            positions.push({x: centerX + i, y: centerY - i});
                            positions.push({x: centerX - i, y: centerY + i});
                            positions.push({x: centerX - i, y: centerY - i});
                        }
                    }
                    
                    // 中心位置情報を保存
                    if (shouldPlaceObelisk) {
                        positions.centerX = centerX;
                        positions.centerY = centerY;
                        positions.shouldPlaceObelisk = true;
                    }
                    
                    return positions;
                }
            },
            {
                name: 'circle',
                getPositions: (room) => {
                    const positions = [];
                    const centerX = Math.floor(room.x + room.width / 2);
                    const centerY = Math.floor(room.y + room.height / 2);
                    const radius = Math.min(
                        Math.floor((room.width - 4) / 2),
                        Math.floor((room.height - 4) / 2)
                    );
                    
                    // ニューラルオベリスク生成チャンスがある場合は中心を除外
                    const shouldPlaceObelisk = Math.random() < GAME_CONSTANTS.NEURAL_OBELISK.SPAWN_CHANCE;
                    
                    // 部屋が小さすぎる場合（半径が1以下）は、アクセス可能なパスを確保
                    const isTooSmall = radius <= 1;
                    
                    // 円形に配置（近似）
                    for (let angle = 0; angle < 360; angle += 45) {
                        const radian = angle * Math.PI / 180;
                        const x = Math.round(centerX + radius * Math.cos(radian));
                        const y = Math.round(centerY + radius * Math.sin(radian));
                        
                        if (x >= room.x + 2 && x < room.x + room.width - 2 &&
                            y >= room.y + 2 && y < room.y + room.height - 2) {
                            
                            // 小さな部屋で、オベリスクを配置する場合は、アクセスパスを確保
                            if (isTooSmall && shouldPlaceObelisk) {
                                // 南側（プレイヤーが通常アクセスする方向）のパスを空ける
                                if (!(angle >= 135 && angle <= 225)) {
                                    positions.push({x, y});
                                }
                            } else {
                                positions.push({x, y});
                            }
                        }
                    }

                    // 中央位置を保存（ニューラルオベリスク用）
                    if (shouldPlaceObelisk) {
                        positions.centerX = centerX;
                        positions.centerY = centerY;
                        positions.isCircle = true;
                        positions.shouldPlaceObelisk = true;
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
            },
            {
                name: 'maze',
                getPositions: (room) => {
                    const positions = [];
                    const startX = room.x + 2;
                    const startY = room.y + 2;
                    const endX = room.x + room.width - 3;
                    const endY = room.y + room.height - 3;
                    
                    // 迷路のような不規則なパターンを生成
                    for (let y = startY; y <= endY; y += 2) {
                        for (let x = startX; x <= endX; x += 2) {
                            if (Math.random() < 0.7) { // 70%の確率で障害物を配置
                                positions.push({x, y});
                                // ランダムに隣接する位置にも配置
                                if (Math.random() < 0.5 && x + 1 <= endX) {
                                    positions.push({x: x + 1, y});
                                } else if (y + 1 <= endY) {
                                    positions.push({x, y: y + 1});
                                }
                            }
                        }
                    }
                    return positions;
                }
            },
            {
                name: 'spiral',
                getPositions: (room) => {
                    const positions = [];
                    const centerX = Math.floor(room.x + room.width / 2);
                    const centerY = Math.floor(room.y + room.height / 2);
                    const maxRadius = Math.min(
                        Math.floor((room.width - 4) / 2),
                        Math.floor((room.height - 4) / 2)
                    );
                    
                    // 渦巻きパターンを生成
                    let angle = 0;
                    let radius = 1;
                    while (radius <= maxRadius) {
                        const x = Math.round(centerX + radius * Math.cos(angle));
                        const y = Math.round(centerY + radius * Math.sin(angle));
                        
                        if (x >= room.x + 2 && x < room.x + room.width - 2 &&
                            y >= room.y + 2 && y < room.y + room.height - 2) {
                            positions.push({x, y});
                        }
                        
                        angle += Math.PI / 8;
                        radius += angle / (2 * Math.PI) * 0.5;
                    }
                    return positions;
                }
            },
            {
                name: 'checkerboard',
                getPositions: (room) => {
                    const positions = [];
                    for (let y = room.y + 2; y < room.y + room.height - 2; y += 2) {
                        for (let x = room.x + 2 + (y % 4 === 0 ? 0 : 2); x < room.x + room.width - 2; x += 4) {
                            positions.push({x, y});
                        }
                    }
                    return positions;
                }
            },
            {
                name: 'triangles',
                getPositions: (room) => {
                    const positions = [];
                    const centerX = Math.floor(room.x + room.width / 2);
                    const centerY = Math.floor(room.y + room.height / 2);
                    const size = Math.min(
                        Math.floor((room.width - 4) / 2),
                        Math.floor((room.height - 4) / 2)
                    );
                    
                    // 三角形パターンを生成
                    for (let i = 0; i <= size; i++) {
                        for (let j = 0; j <= i; j++) {
                            // 上向き三角形
                            if (centerY - i + 2 >= room.y + 2) {
                                positions.push({
                                    x: centerX - i + j * 2,
                                    y: centerY - i + 2
                                });
                            }
                            // 下向き三角形
                            if (centerY + i - 2 < room.y + room.height - 2) {
                                positions.push({
                                    x: centerX - i + j * 2,
                                    y: centerY + i - 2
                                });
                            }
                        }
                    }
                    return positions;
                }
            },
            {
                name: 'parallel',
                getPositions: (room) => {
                    const positions = [];
                    const isHorizontal = Math.random() < 0.5;
                    
                    if (isHorizontal) {
                        // 水平な平行線
                        for (let y = room.y + 2; y < room.y + room.height - 2; y += 3) {
                            for (let x = room.x + 2; x < room.x + room.width - 2; x++) {
                                positions.push({x, y});
                            }
                        }
                    } else {
                        // 垂直な平行線
                        for (let x = room.x + 2; x < room.x + room.width - 2; x += 3) {
                            for (let y = room.y + 2; y < room.y + room.height - 2; y++) {
                                positions.push({x, y});
                            }
                        }
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

        // Helper function to determine obelisk level with weighted probabilities
        function determineObeliskLevel() {
            // レベル1: 30%, レベル2: 25%, レベル3: 20%, レベル4: 15%, レベル5: 10%
            const levelWeights = [30, 25, 20, 15, 10];
            const totalWeight = levelWeights.reduce((sum, weight) => sum + weight, 0);
            let roll = Math.random() * totalWeight;
            let level = 1;
            
            for (let i = 0; i < levelWeights.length; i++) {
                roll -= levelWeights[i];
                if (roll <= 0) {
                    level = i + 1;
                    break;
                }
            }
            
            return level;
        }

        // サークルパターンの場合、中央にニューラルオベリスクを配置する可能性がある
        if (positions.shouldPlaceObelisk && pattern.name === 'circle') {
            const centerX = positions.centerX;
            const centerY = positions.centerY;
            
            if (this.isValidObstaclePosition(centerX, centerY)) {
                // 回復レベルを重み付き確率で決定
                const level = determineObeliskLevel();
                
                //console.log(`Generated Neural Obelisk at (${centerX},${centerY}) with level ${level} (circle pattern)`);
                
                // ニューラルオベリスクを配置
                this.map[centerY][centerX] = 'neural_obelisk';
                this.tiles[centerY][centerX] = GAME_CONSTANTS.NEURAL_OBELISK.CHAR;
                this.colors[centerY][centerX] = GAME_CONSTANTS.NEURAL_OBELISK.LEVELS[level].COLOR;
                
                // レベル情報を保存
                if (!this.neuralObelisks) this.neuralObelisks = [];
                this.neuralObelisks.push({
                    x: centerX,
                    y: centerY,
                    level: level
                });
            }
        }
        
        // ダイヤモンドパターンの場合も中央にニューラルオベリスクを配置する可能性を追加
        if (positions.shouldPlaceObelisk && pattern.name === 'diamond') {
            const centerX = positions.centerX;
            const centerY = positions.centerY;
            
            if (this.isValidObstaclePosition(centerX, centerY)) {
                // 回復レベルを重み付き確率で決定
                const level = determineObeliskLevel();
                
                //console.log(`Generated Neural Obelisk at (${centerX},${centerY}) with level ${level} (diamond pattern)`);
                
                // ニューラルオベリスクを配置
                this.map[centerY][centerX] = 'neural_obelisk';
                this.tiles[centerY][centerX] = GAME_CONSTANTS.NEURAL_OBELISK.CHAR;
                this.colors[centerY][centerX] = GAME_CONSTANTS.NEURAL_OBELISK.LEVELS[level].COLOR;
                
                // レベル情報を保存
                if (!this.neuralObelisks) this.neuralObelisks = [];
                this.neuralObelisks.push({
                    x: centerX,
                    y: centerY,
                    level: level
                });
            }
        }
        
        // クロスパターンの場合も中央にニューラルオベリスクを配置する可能性を追加
        if (positions.shouldPlaceObelisk && pattern.name === 'cross') {
            const centerX = positions.centerX;
            const centerY = positions.centerY;
            
            if (this.isValidObstaclePosition(centerX, centerY)) {
                // 回復レベルを重み付き確率で決定
                const level = determineObeliskLevel();
                
                //console.log(`Generated Neural Obelisk at (${centerX},${centerY}) with level ${level} (cross pattern)`);
                
                // ニューラルオベリスクを配置
                this.map[centerY][centerX] = 'neural_obelisk';
                this.tiles[centerY][centerX] = GAME_CONSTANTS.NEURAL_OBELISK.CHAR;
                this.colors[centerY][centerX] = GAME_CONSTANTS.NEURAL_OBELISK.LEVELS[level].COLOR;
                
                // レベル情報を保存
                if (!this.neuralObelisks) this.neuralObelisks = [];
                this.neuralObelisks.push({
                    x: centerX,
                    y: centerY,
                    level: level
                });
            }
        }
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
        
        // 追加：VOIDポータルとの重複チェック
        if (this.map[y][x] === 'void') {
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
        if (rooms.length < 2) return;

        // テーマに応じた接続パラメータ
        let extraConnectionRatio;
        let preferStraightCorridors;
        
        switch (this.floorTheme) {
            case 'CAVE':
                // 洞窟は接続が少なく、曲がりくねった通路
                extraConnectionRatio = 0.1;
                preferStraightCorridors = false;
                break;
            case 'LABORATORY':
                // 実験施設は整然とした直線的な通路
                extraConnectionRatio = 0.4;
                preferStraightCorridors = true;
                break;
            case 'RUINS':
                // 遺跡は崩れた通路
                extraConnectionRatio = 0.3;
                preferStraightCorridors = false;
                break;
            case 'CRYPT':
                // 地下墓地は限られた通路
                extraConnectionRatio = 0.2;
                preferStraightCorridors = true;
                break;
            default:
                // 標準
                extraConnectionRatio = 0.3;
                preferStraightCorridors = false;
        }

        // 部屋間の接続情報を格納する配列
        const connections = [];
        
        // すべての部屋のペアとその距離を計算
        for (let i = 0; i < rooms.length; i++) {
            for (let j = i + 1; j < rooms.length; j++) {
                const roomA = rooms[i];
                const roomB = rooms[j];
                const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                    roomA.x + roomA.width/2, roomA.y + roomA.height/2,
                    roomB.x + roomB.width/2, roomB.y + roomB.height/2
                );
                connections.push({
                    roomA: i,
                    roomB: j,
                    distance: distance
                });
            }
        }

        // 距離でソート
        connections.sort((a, b) => a.distance - b.distance);

        // Union-Find データ構造
        const parent = new Array(rooms.length).fill(0).map((_, i) => i);
        const find = (x) => {
            if (parent[x] !== x) {
                parent[x] = find(parent[x]);
            }
            return parent[x];
        };
        const union = (x, y) => {
            parent[find(x)] = find(y);
        };

        // 最小全域木を構築
        const selectedConnections = [];
        for (const conn of connections) {
            if (find(conn.roomA) !== find(conn.roomB)) {
                selectedConnections.push(conn);
                union(conn.roomA, conn.roomB);
            }
        }

        // 追加の接続を作成（ループを作る）
        const extraConnectionCount = Math.floor(rooms.length * extraConnectionRatio);
        for (const conn of connections) {
            if (selectedConnections.length >= rooms.length - 1 + extraConnectionCount) break;
            if (!selectedConnections.includes(conn)) {
                selectedConnections.push(conn);
            }
        }

        // 選択された接続に基づいて通路を生成
        for (const conn of selectedConnections) {
            const roomA = rooms[conn.roomA];
            const roomB = rooms[conn.roomB];
            
            // 接続点を見つける
            const points = this.findConnectionPoints(roomA, roomB);
            if (!points) continue;

            const { startX, startY, endX, endY } = points;
            
            // 通路を生成（テーマに合わせた方向を優先）
            let success = false;
            if (preferStraightCorridors) {
                // 実験施設や地下墓地では水平→垂直の順に試す
                success = this.tryCreateCorridor(startX, endX, startY, endY, 'horizontal');
                if (!success) {
                    success = this.tryCreateCorridor(startX, endX, startY, endY, 'vertical');
                }
            } else {
                // 自然な洞窟や遺跡ではランダムな順序で試す
                if (Math.random() < 0.5) {
                    success = this.tryCreateCorridor(startX, endX, startY, endY, 'horizontal');
                    if (!success) {
                        success = this.tryCreateCorridor(startX, endX, startY, endY, 'vertical');
                    }
                } else {
                    success = this.tryCreateCorridor(startX, endX, startY, endY, 'vertical');
                    if (!success) {
                        success = this.tryCreateCorridor(startX, endX, startY, endY, 'horizontal');
                    }
                }
            }
            
            // どちらの方法でも失敗した場合は強制的に接続
            if (!success) {
                this.createForcedCorridor(startX, endX, startY, endY);
            }
        }
    }

    // 通路生成を試みるメソッド
    tryCreateCorridor(startX, endX, startY, endY, firstDirection) {
        let success = true;
        if (firstDirection === 'horizontal') {
            success = success && this.createSafeHorizontalCorridor(startX, endX, startY);
            if (success) {
                success = success && this.createSafeVerticalCorridor(endX, startY, endY);
            }
        } else {
            success = success && this.createSafeVerticalCorridor(startX, startY, endY);
            if (success) {
                success = success && this.createSafeHorizontalCorridor(startX, endX, endY);
            }
        }
        return success;
    }

    // 強制的に通路を生成するメソッド
    createForcedCorridor(startX, endX, startY, endY) {
        // 直線的な通路を生成
        const dx = Math.sign(endX - startX);
        const dy = Math.sign(endY - startY);
        
        let x = startX;
        let y = startY;
        
        while (x !== endX || y !== endY) {
            this.map[y][x] = 'floor';
            this.tiles[y][x] = GAME_CONSTANTS.TILES.FLOOR[
                Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
            ];
            this.colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
            
            if (x !== endX && (y === endY || Math.random() < 0.5)) {
                x += dx;
            } else if (y !== endY) {
                y += dy;
            }
        }
        
        // 終点も床にする
        this.map[endY][endX] = 'floor';
        this.tiles[endY][endX] = GAME_CONSTANTS.TILES.FLOOR[
            Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
        ];
        this.colors[endY][endX] = GAME_CONSTANTS.COLORS.FLOOR;
    }

    // 既存のcreateHorizontalCorridorメソッドを修正
    createSafeHorizontalCorridor(x1, x2, y) {
        const startX = Math.min(x1, x2);
        const endX = Math.max(x1, x2);
        let success = true;
        
        for (let x = startX; x <= endX; x++) {
            if (y < this.height && x < this.width) {
                if (this.isInsideAnyRoom(x, y)) {
                    success = false;
                } else {
                    this.map[y][x] = 'floor';
                    this.tiles[y][x] = GAME_CONSTANTS.TILES.FLOOR[
                        Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                    ];
                    this.colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
                    
                    // 通路の上下に壁を設置
                    if (y > 0) this.ensureWall(x, y - 1);
                    if (y < this.height - 1) this.ensureWall(x, y + 1);
                }
            }
        }
        return success;
    }

    // 既存のcreateVerticalCorridorメソッドを修正
    createSafeVerticalCorridor(x, y1, y2) {
        const startY = Math.min(y1, y2);
        const endY = Math.max(y1, y2);
        let success = true;
        
        for (let y = startY; y <= endY; y++) {
            if (y < this.height && x < this.width) {
                if (this.isInsideAnyRoom(x, y)) {
                    success = false;
                } else {
                    this.map[y][x] = 'floor';
                    this.tiles[y][x] = GAME_CONSTANTS.TILES.FLOOR[
                        Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                    ];
                    this.colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
                    
                    // 通路の左右に壁を設置
                    if (x > 0) this.ensureWall(x - 1, y);
                    if (x < this.width - 1) this.ensureWall(x + 1, y);
                }
            }
        }
        return success;
    }

    // 部屋間の接続点を見つける新しいメソッド
    findConnectionPoints(roomA, roomB) {
        // 部屋Aの境界候補点を生成
        const roomAPoints = [];
        // 左右の壁
        for (let y = roomA.y + 1; y < roomA.y + roomA.height - 1; y++) {
            roomAPoints.push({ x: roomA.x, y: y, side: 'left' });
            roomAPoints.push({ x: roomA.x + roomA.width - 1, y: y, side: 'right' });
        }
        // 上下の壁
        for (let x = roomA.x + 1; x < roomA.x + roomA.width - 1; x++) {
            roomAPoints.push({ x: x, y: roomA.y, side: 'top' });
            roomAPoints.push({ x: x, y: roomA.y + roomA.height - 1, side: 'bottom' });
        }

        // 部屋Bの境界候補点を生成
        const roomBPoints = [];
        // 左右の壁
        for (let y = roomB.y + 1; y < roomB.y + roomB.height - 1; y++) {
            roomBPoints.push({ x: roomB.x, y: y, side: 'left' });
            roomBPoints.push({ x: roomB.x + roomB.width - 1, y: y, side: 'right' });
        }
        // 上下の壁
        for (let x = roomB.x + 1; x < roomB.x + roomB.width - 1; x++) {
            roomBPoints.push({ x: x, y: roomB.y, side: 'top' });
            roomBPoints.push({ x: x, y: roomB.y + roomB.height - 1, side: 'bottom' });
        }

        // 最適な接続点のペアを見つける
        let bestPoints = null;
        let shortestDistance = Infinity;

        for (const pointA of roomAPoints) {
            for (const pointB of roomBPoints) {
                const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(
                    pointA.x, pointA.y,
                    pointB.x, pointB.y
                );
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    bestPoints = { startX: pointA.x, startY: pointA.y, endX: pointB.x, endY: pointB.y };
                }
            }
        }

        return bestPoints;
    }

    // 既存の通路をチェックする新しいメソッド
    isExistingPath(x, y) {
        // 既に床タイルが存在し、かつ部屋の中でない場合は既存の通路とみなす
        return this.map[y][x] === 'floor' && !this.isInsideAnyRoom(x, y);
    }

    // 部屋の中かどうかをより厳密にチェック
    isInsideAnyRoom(x, y) {
        if (!this.rooms) return false;
        
        // 部屋の内部だけでなく、境界も含めてチェック
        return this.rooms.some(room => {
            const inX = x >= room.x - 1 && x <= room.x + room.width;
            const inY = y >= room.y - 1 && y <= room.y + room.height;
            return inX && inY;
        });
    }

    placeStairs(rooms) {
        // 最後の部屋を取得
        const lastRoom = rooms[rooms.length - 1];
        
        // 階段の配置可能な位置を収集
        const validPositions = [];
        const MIN_DISTANCE_FROM_PLAYER = 10; // プレイヤーからの最小距離を10マスに増加
        
        for (let y = lastRoom.y; y < lastRoom.y + lastRoom.height; y++) {
            for (let x = lastRoom.x; x < lastRoom.x + lastRoom.width; x++) {
                // 床タイルかつプレイヤーの位置と異なる場合
                if (this.map[y][x] === 'floor') {
                    // プレイヤーが存在する場合、距離をチェック
                    if (this.game?.player) {
                        // プレイヤーからの距離を計算
                        const distanceToPlayer = Math.sqrt(
                            Math.pow(x - this.game.player.x, 2) + 
                            Math.pow(y - this.game.player.y, 2)
                        );
                        
                        // 最小距離以上離れている場合のみ有効な位置として追加
                        if (distanceToPlayer >= MIN_DISTANCE_FROM_PLAYER) {
                            validPositions.push({x, y});
                        }
                    } else {
                        // プレイヤーが存在しない場合（初期生成時など）は全ての床タイルを追加
                        validPositions.push({x, y});
                    }
                }
            }
        }
        
        // 有効な位置が見つからない場合は制約を緩める
        if (validPositions.length === 0) {
            // 最小距離を徐々に減らして再試行
            let reducedDistance = MIN_DISTANCE_FROM_PLAYER;
            while (validPositions.length === 0 && reducedDistance > 3) {
                reducedDistance -= 2; // 距離を2マスずつ減らす
                for (let y = lastRoom.y; y < lastRoom.y + lastRoom.height; y++) {
                    for (let x = lastRoom.x; x < lastRoom.x + lastRoom.width; x++) {
                        if (this.map[y][x] === 'floor' && 
                            !(x === this.game?.player?.x && y === this.game?.player?.y)) {
                            if (this.game?.player) {
                                const distanceToPlayer = Math.sqrt(
                                    Math.pow(x - this.game.player.x, 2) + 
                                    Math.pow(y - this.game.player.y, 2)
                                );
                                if (distanceToPlayer >= reducedDistance) {
                                    validPositions.push({x, y});
                                }
                            } else {
                                validPositions.push({x, y});
                            }
                        }
                    }
                }
            }
            
            // それでも見つからない場合は、最低限プレイヤーと同じ位置でないことだけを確認
            if (validPositions.length === 0) {
                for (let y = lastRoom.y; y < lastRoom.y + lastRoom.height; y++) {
                    for (let x = lastRoom.x; x < lastRoom.x + lastRoom.width; x++) {
                        if (this.map[y][x] === 'floor' && 
                            !(x === this.game?.player?.x && y === this.game?.player?.y)) {
                            validPositions.push({x, y});
                        }
                    }
                }
            }
        }

        // 階段候補位置のパス到達可能性をチェック
        const accessiblePositions = validPositions.filter(pos => {
            return this.isReachableFromPlayer(pos.x, pos.y);
        });
        
        // 有効かつ到達可能な位置からランダムに1つ選択
        const positionsToUse = accessiblePositions.length > 0 ? accessiblePositions : validPositions;
        
        // 到達可能な位置がない場合、プレイヤーから最も近い部屋へのパスを作成
        if (accessiblePositions.length === 0 && validPositions.length > 0) {
            const stairsPos = validPositions[Math.floor(Math.random() * validPositions.length)];
            this.createPathToStairs(stairsPos.x, stairsPos.y);
            
            // 階段の配置
            this.map[stairsPos.y][stairsPos.x] = 'floor';  // 基底マップを床に
            this.tiles[stairsPos.y][stairsPos.x] = GAME_CONSTANTS.STAIRS.CHAR;  // 見た目を階段に
            this.colors[stairsPos.y][stairsPos.x] = GAME_CONSTANTS.STAIRS.COLOR;  // 色を階段用に
            return;
        }
        
        // 到達可能な位置がある場合は通常通り配置
        if (positionsToUse.length > 0) {
            const stairsPos = positionsToUse[Math.floor(Math.random() * positionsToUse.length)];
            
            // 階段の配置
            this.map[stairsPos.y][stairsPos.x] = 'floor';  // 基底マップを床に
            this.tiles[stairsPos.y][stairsPos.x] = GAME_CONSTANTS.STAIRS.CHAR;  // 見た目を階段に
            this.colors[stairsPos.y][stairsPos.x] = GAME_CONSTANTS.STAIRS.COLOR;  // 色を階段用に
        } else {
            // 最終的な対策: 最後の部屋の中央に階段を配置し、強制的にパスを確保
            const centerX = Math.floor(lastRoom.x + lastRoom.width / 2);
            const centerY = Math.floor(lastRoom.y + lastRoom.height / 2);
            this.map[centerY][centerX] = 'floor';
            this.tiles[centerY][centerX] = GAME_CONSTANTS.STAIRS.CHAR;
            this.colors[centerY][centerX] = GAME_CONSTANTS.STAIRS.COLOR;
            
            // 強制的にパスを作成
            this.createPathToStairs(centerX, centerY);
        }
    }

    // プレイヤーから到達可能かどうかを判定（A*アルゴリズムを使用）
    isReachableFromPlayer(targetX, targetY) {
        if (!this.game?.player) return true; // プレイヤーがいない場合は常に到達可能とみなす
        
        const startX = this.game.player.x;
        const startY = this.game.player.y;
        
        console.log(`Checking reachability from player(${startX},${startY}) to target(${targetX},${targetY})`);
        
        // 開始地点と目標地点が同じ場合
        if (startX === targetX && startY === targetY) {
            return true;
        }
        
        // デバッグ: 現在の周辺タイルの状態を出力
        console.log(`==== 経路探索開始 ====`);
        for (let y = Math.max(0, startY - 3); y <= Math.min(this.height - 1, startY + 3); y++) {
            let row = '';
            for (let x = Math.max(0, startX - 3); x <= Math.min(this.width - 1, startX + 3); x++) {
                if (x === startX && y === startY) {
                    row += 'P'; // プレイヤー位置
                } else {
                    if (this.map[y][x] === 'wall') {
                        row += '#'; // 壁
                    } else if (this.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                        row += '+'; // 閉じたドア
                    } else if (this.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                        row += '/'; // 開いたドア
                    } else if (GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[y][x])) {
                        row += '*'; // 通行不可の障害物
                    } else if (GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(this.tiles[y][x])) {
                        row += '~'; // 透明な障害物
                    } else {
                        row += '.'; // 通行可能な床
                    }
                }
            }
            console.log(row);
        }
        console.log(`====================`);
        
        // 目標地点周辺のタイル状態を出力
        console.log(`==== 目標地点周辺 ====`);
        for (let y = Math.max(0, targetY - 3); y <= Math.min(this.height - 1, targetY + 3); y++) {
            let row = '';
            for (let x = Math.max(0, targetX - 3); x <= Math.min(this.width - 1, targetX + 3); x++) {
                if (x === targetX && y === targetY) {
                    row += 'T'; // 目標位置
                } else {
                    if (this.map[y][x] === 'wall') {
                        row += '#'; // 壁
                    } else if (this.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                        row += '+'; // 閉じたドア
                    } else if (this.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                        row += '/'; // 開いたドア
                    } else if (GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[y][x])) {
                        row += '*'; // 通行不可の障害物
                    } else if (GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(this.tiles[y][x])) {
                        row += '~'; // 透明な障害物
                    } else {
                        row += '.'; // 通行可能な床
                    }
                }
            }
            console.log(row);
        }
        console.log(`====================`);
        
        // 幅優先探索（BFS）を使用して確実に到達可能かどうかを判定
        const visited = Array(this.height).fill().map(() => Array(this.width).fill(false));
        const queue = [{x: startX, y: startY}];
        visited[startY][startX] = true;
        
        // 探索方向（4方向または8方向）
        const directions = [
            {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0},
            {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}, {x: -1, y: -1} // 斜め方向も含む
        ];
        
        // BFSでの探索
        while (queue.length > 0) {
            const current = queue.shift();
            
            // 目標に到達した
            if (current.x === targetX && current.y === targetY) {
                console.log(`Path found using BFS - target is reachable`);
                return true;
            }
            
            // 隣接するマスを探索
            for (const dir of directions) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;
                
                // マップ範囲外または既に訪問済みならスキップ
                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height || visited[ny][nx]) {
                    continue;
                }
                
                // タイルの通行可能性をチェック
                let canPass = false;
                
                if (nx === targetX && ny === targetY) {
                    // 目標地点は特別扱い（階段などの特殊タイルの場合）
                    canPass = true;
                    console.log(`Target tile at (${nx},${ny}) is being treated as passable (special case)`);
                } else if (this.map[ny][nx] === 'floor') {
                    // 床タイルの場合、障害物の有無をチェック
                    const tileChar = this.tiles[ny][nx];
                    
                    if (tileChar === GAME_CONSTANTS.TILES.DOOR.CLOSED || 
                        tileChar === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                        // ドアは通行可能
                        canPass = true;
                        console.log(`Door at (${nx},${ny}) is passable, type: ${tileChar}`);
                    } else if (!GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(tileChar) &&
                               !GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(tileChar)) {
                        // 通行不可の障害物がない場合
                        canPass = true;
                    }
                }
                
                // 通行可能なら訪問済みにして探索キューに追加
                if (canPass) {
                    visited[ny][nx] = true;
                    queue.push({x: nx, y: ny});
                }
            }
        }
        
        // マップ全体の探索状況をデバッグ表示
        console.log(`==== 探索結果 ====`);
        let visitedCount = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (visited[y][x]) {
                    visitedCount++;
                }
            }
        }
        console.log(`Visited ${visitedCount} tiles out of ${this.width * this.height}`);
        
        // プレイヤー周辺の探索結果
        for (let y = Math.max(0, startY - 5); y <= Math.min(this.height - 1, startY + 5); y++) {
            let row = '';
            for (let x = Math.max(0, startX - 5); x <= Math.min(this.width - 1, startX + 5); x++) {
                if (x === startX && y === startY) {
                    row += 'P'; // プレイヤー位置
                } else if (visited[y][x]) {
                    row += 'v'; // 訪問済み
                } else {
                    if (this.map[y][x] === 'wall') {
                        row += '#'; // 壁
                    } else {
                        row += '.'; // 通行可能だが未訪問
                    }
                }
            }
            console.log(row);
        }
        console.log(`====================`);
        
        console.log(`No path found - target is unreachable`);
        return false; // パスが見つからなかった
    }

    // パスを作成するメソッド
    createPathToStairs(stairsX, stairsY) {
        if (!this.game?.player) return; // プレイヤーがいない場合は処理しない
        
        const playerX = this.game.player.x;
        const playerY = this.game.player.y;
        
        console.log(`Creating path from player(${playerX},${playerY}) to stairs(${stairsX},${stairsY})`);
        
        // 既存のパスをチェック
        console.log("Checking initial reachability...");
        if (this.isReachableFromPlayer(stairsX, stairsY)) {
            console.log("Stairs already reachable, no need to create path");
            return;
        }
        
        console.log("No existing path found, creating new path...");
        
        // A*アルゴリズムで最短経路を見つける
        const openSet = [{x: playerX, y: playerY, g: 0, h: 0, f: 0}];
        const closedSet = new Set();
        const cameFrom = {};
        
        let iterations = 0;
        const MAX_ITERATIONS = 2000; // 大きなマップでも十分な反復回数
        let pathFound = false;
        
        while (openSet.length > 0 && iterations < MAX_ITERATIONS) {
            iterations++;
            
            // f値が最も小さいノードを選択
            openSet.sort((a, b) => a.f - b.f);
            const current = openSet.shift();
            const key = `${current.x},${current.y}`;
            
            // 目標に到達した
            if (current.x === stairsX && current.y === stairsY) {
                // パスを再構築して床を作成
                console.log(`Path found after ${iterations} iterations, creating path...`);
                
                // パスのマスを記録
                const path = [];
                let pathKey = key;
                
                while (pathKey in cameFrom) {
                    const [x, y] = pathKey.split(',').map(Number);
                    path.push({x, y});
                    pathKey = cameFrom[pathKey];
                }
                path.reverse(); // スタートからゴールの順に並べ替え
                
                // パスを床に変更
                let pathCreated = false;
                for (const point of path) {
                    // 壁や障害物の場合のみ床に変更
                    if (this.map[point.y][point.x] === 'wall' || 
                        GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[point.y][point.x]) ||
                        GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(this.tiles[point.y][point.x])) {
                        
                        this.map[point.y][point.x] = 'floor';
                        this.tiles[point.y][point.x] = GAME_CONSTANTS.TILES.FLOOR[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                        ];
                        this.colors[point.y][point.x] = GAME_CONSTANTS.COLORS.FLOOR;
                        pathCreated = true;
                        
                        // パスを広げる（幅を持たせる）
                        for (let dy = -1; dy <= 1; dy++) {
                            for (let dx = -1; dx <= 1; dx++) {
                                if (dx === 0 && dy === 0) continue; // 中心は既に処理済み
                                
                                const nx = point.x + dx;
                                const ny = point.y + dy;
                                
                                // マップ範囲内かつ壁または障害物の場合
                                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                                    // 階段は上書きしない
                                    if (nx === stairsX && ny === stairsY) continue;
                                    
                                    if (this.map[ny][nx] === 'wall' || 
                                        GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[ny][nx]) ||
                                        GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(this.tiles[ny][nx])) {
                                        
                                        // 50%の確率で床に変更（パスに幅を持たせる）
                                        if (Math.random() < 0.5) {
                                            this.map[ny][nx] = 'floor';
                                            this.tiles[ny][nx] = GAME_CONSTANTS.TILES.FLOOR[
                                                Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                                            ];
                                            this.colors[ny][nx] = GAME_CONSTANTS.COLORS.FLOOR;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                
                // 階段周辺を常に通行可能に
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = stairsX + dx;
                        const ny = stairsY + dy;
                        
                        // マップ範囲内
                        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                            // 階段自体は上書きしない
                            if (nx === stairsX && ny === stairsY) continue;
                            
                            if (this.map[ny][nx] === 'wall' || 
                                GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[ny][nx]) ||
                                GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(this.tiles[ny][nx])) {
                                
                                // 階段の周りは必ず床にする
                                this.map[ny][nx] = 'floor';
                                this.tiles[ny][nx] = GAME_CONSTANTS.TILES.FLOOR[
                                    Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                                ];
                                this.colors[ny][nx] = GAME_CONSTANTS.COLORS.FLOOR;
                                pathCreated = true;
                            }
                        }
                    }
                }
                
                if (pathCreated) {
                    console.log("Path tiles created based on A* search");
                } else {
                    console.log("No new path tiles needed to be created");
                }
                
                pathFound = true;
                break;
            }
            
            closedSet.add(key);
            
            // 隣接するマスを探索（8方向に拡張）
            const directions = [
                {x: 0, y: -1}, {x: 1, y: -1}, {x: 1, y: 0}, {x: 1, y: 1}, 
                {x: 0, y: 1}, {x: -1, y: 1}, {x: -1, y: 0}, {x: -1, y: -1}
            ];
            
            for (const dir of directions) {
                const nx = current.x + dir.x;
                const ny = current.y + dir.y;
                const neighborKey = `${nx},${ny}`;
                
                // マップ範囲外またはクローズドセットにあるなら次へ
                if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height || 
                    closedSet.has(neighborKey)) {
                    continue;
                }
                
                // A*経路探索用の通行可能判定（探索用に条件を緩和）
                let canPass = false;
                
                // 現在のタイルの状態
                const isWall = this.map[ny][nx] === 'wall';
                const tileChar = this.tiles[ny][nx];
                const isBlockingObstacle = GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(tileChar);
                const isTransparentObstacle = GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(tileChar);
                
                // 目標地点は必ず通行可能
                if (nx === stairsX && ny === stairsY) {
                    canPass = true;
                }
                // 床は基本的に通行可能（ドアや障害物を考慮）
                else if (this.map[ny][nx] === 'floor') {
                    if (tileChar === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                        // 閉じたドアは通過可能（プレイヤーは開けられる）
                        canPass = true;
                    } else if (tileChar === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                        // 開いたドアは通過可能
                        canPass = true;
                    } else if (!isBlockingObstacle && !isTransparentObstacle) {
                        // 通行不可の障害物がなければ通過可能
                        canPass = true;
                    }
                }
                // 壁や障害物は通行不可だが、経路作成のため「コスト高で通過可能」とする
                else if (isWall || isBlockingObstacle || isTransparentObstacle) {
                    canPass = true; // 経路探索では通行可能とする（後で床に変換）
                }
                
                // 通行不可なら次のマスへ
                if (!canPass) {
                    continue;
                }
                
                // タイルの種類に応じたコスト計算
                let tileCost = 1; // 基本コスト
                
                // 壁や障害物はコスト高
                if (isWall || isBlockingObstacle || isTransparentObstacle) {
                    tileCost = 5; // 壁を通過するコストを高く
                }
                
                // 斜め移動の場合はコスト増加
                if (dir.x !== 0 && dir.y !== 0) {
                    tileCost *= 1.414; // √2 に近似
                }
                
                // ドアは若干コスト高
                if (tileChar === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                    tileCost += 1; // ドアを開けるコスト
                }
                
                // マンハッタン距離のヒューリスティック
                const h = Math.abs(nx - stairsX) + Math.abs(ny - stairsY);
                const g = current.g + tileCost;
                const f = g + h;
                
                // 既にオープンセットにあって、今回のパスの方が長い場合はスキップ
                const existingIndex = openSet.findIndex(node => node.x === nx && node.y === ny);
                if (existingIndex !== -1 && openSet[existingIndex].g <= g) {
                    continue;
                }
                
                // オープンセットに追加または更新
                if (existingIndex === -1) {
                    openSet.push({x: nx, y: ny, g, h, f});
                } else {
                    openSet[existingIndex] = {x: nx, y: ny, g, h, f};
                }
                
                // 経路を記録
                cameFrom[neighborKey] = key;
            }
        }
        
        // 到達可能かどうか再確認
        console.log("Checking reachability after path creation...");
        const isReachable = this.isReachableFromPlayer(stairsX, stairsY);
        
        if (pathFound && isReachable) {
            console.log("Path to stairs created successfully");
            return;
        }
        
        console.log(`WARNING: ${pathFound ? "Path was found but stairs still not reachable" : "A* search failed after " + iterations + " iterations"}`);
        console.log("Creating emergency path as fallback...");
        
        // 緊急パス作成
        this.createEmergencyPathToStairs(playerX, playerY, stairsX, stairsY);
        
        // 最終確認
        const finalCheck = this.isReachableFromPlayer(stairsX, stairsY);
        if (!finalCheck) {
            console.log("CRITICAL: Even emergency path creation failed. Forcing direct connection.");
            
            // 最後の手段：プレイヤーと階段を直接床で繋ぐ
            const plotDirectLine = (x0, y0, x1, y1) => {
                const dx = Math.abs(x1 - x0);
                const dy = Math.abs(y1 - y0);
                const sx = (x0 < x1) ? 1 : -1;
                const sy = (y0 < y1) ? 1 : -1;
                let err = dx - dy;
                
                // 幅5の太い通路を作成
                const width = 2; // 中心から両側へ2マス（合計幅5）
                
                let x = x0, y = y0;
                while (true) {
                    // 現在位置とその周囲を床にする
                    for (let offsetY = -width; offsetY <= width; offsetY++) {
                        for (let offsetX = -width; offsetX <= width; offsetX++) {
                            const nx = x + offsetX;
                            const ny = y + offsetY;
                            
                            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                                // 階段位置は保持
                                if (nx === stairsX && ny === stairsY) continue;
                                
                                this.map[ny][nx] = 'floor';
                                this.tiles[ny][nx] = GAME_CONSTANTS.TILES.FLOOR[
                                    Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                                ];
                                this.colors[ny][nx] = GAME_CONSTANTS.COLORS.FLOOR;
                            }
                        }
                    }
                    
                    // 終点に到達したら終了
                    if (x === x1 && y === y1) break;
                    
                    // 次の位置へ
                    const e2 = 2 * err;
                    if (e2 > -dy) { err -= dy; x += sx; }
                    if (e2 < dx) { err += dx; y += sy; }
                }
            };
            
            // 直接線を引く
            plotDirectLine(playerX, playerY, stairsX, stairsY);
            
            // 階段のタイルを復元
            this.tiles[stairsY][stairsX] = GAME_CONSTANTS.STAIRS.CHAR;
            this.colors[stairsY][stairsX] = GAME_CONSTANTS.STAIRS.COLOR;
            
            console.log("Direct path forcibly created");
        }
    }

    // 緊急用の直接パス生成（最後の手段）
    createEmergencyPathToStairs(startX, startY, endX, endY) {
        console.log(`Creating EMERGENCY path from (${startX},${startY}) to (${endX},${endY})`);
        
        // 完全に新しいアプローチ：複数の幅広い通路を作成する
        
        // 経由点を設定（ジグザグパスの角）
        const waypoints = [
            {x: startX, y: startY}, // スタート
            {x: Math.floor((startX + endX) / 2), y: startY}, // 中間点1
            {x: Math.floor((startX + endX) / 2), y: endY}, // 中間点2
            {x: endX, y: endY} // ゴール
        ];
        
        // プレイヤーの周囲を床にする（3x3エリア）
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = startX + dx;
                const ny = startY + dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    this.map[ny][nx] = 'floor';
                    this.tiles[ny][nx] = GAME_CONSTANTS.TILES.FLOOR[
                        Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                    ];
                    this.colors[ny][nx] = GAME_CONSTANTS.COLORS.FLOOR;
                }
            }
        }
        
        // 階段の周囲を床にする（3x3エリア）
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = endX + dx;
                const ny = endY + dy;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    // 階段自体は保持する
                    if (nx === endX && ny === endY) continue;
                    
                    this.map[ny][nx] = 'floor';
                    this.tiles[ny][nx] = GAME_CONSTANTS.TILES.FLOOR[
                        Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                    ];
                    this.colors[ny][nx] = GAME_CONSTANTS.COLORS.FLOOR;
                }
            }
        }
        
        // 経由点間に幅広い通路を作成（幅3の通路）
        for (let i = 0; i < waypoints.length - 1; i++) {
            const start = waypoints[i];
            const end = waypoints[i + 1];
            
            // 水平移動
            if (start.x !== end.x) {
                const step = start.x < end.x ? 1 : -1;
                for (let x = start.x; x !== end.x + step; x += step) {
                    // 幅3の通路
                    for (let offset = -1; offset <= 1; offset++) {
                        const y = start.y + offset;
                        if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
                            this.map[y][x] = 'floor';
                            this.tiles[y][x] = GAME_CONSTANTS.TILES.FLOOR[
                                Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                            ];
                            this.colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
                        }
                    }
                }
            }
            
            // 垂直移動
            if (start.y !== end.y) {
                const step = start.y < end.y ? 1 : -1;
                for (let y = start.y; y !== end.y + step; y += step) {
                    // 幅3の通路
                    for (let offset = -1; offset <= 1; offset++) {
                        const x = end.x + offset;
                        if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
                            this.map[y][x] = 'floor';
                            this.tiles[y][x] = GAME_CONSTANTS.TILES.FLOOR[
                                Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                            ];
                            this.colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
                        }
                    }
                }
            }
        }
        
        // 階段のタイルを復元
        this.tiles[endY][endX] = GAME_CONSTANTS.STAIRS.CHAR;
        this.colors[endY][endX] = GAME_CONSTANTS.STAIRS.COLOR;
        
        // 直接パスの確認
        const isReachable = this.isReachableFromPlayer(endX, endY);
        console.log(`Emergency path created. Stairs reachable: ${isReachable}`);
        
        if (!isReachable) {
            // まだ到達できない場合は、最終手段：プレイヤーと階段を直接つなぐ直線パス
            console.log("CRITICAL: Emergency path failed. Creating direct line path as last resort.");
            
            // 直線パスを作成（ブレゼンハムのアルゴリズム）
            const plotLine = (x0, y0, x1, y1) => {
                const dx = Math.abs(x1 - x0);
                const dy = Math.abs(y1 - y0);
                const sx = (x0 < x1) ? 1 : -1;
                const sy = (y0 < y1) ? 1 : -1;
                let err = dx - dy;
                
                while (x0 !== x1 || y0 !== y1) {
                    // 現在位置を床に
                    this.map[y0][x0] = 'floor';
                    this.tiles[y0][x0] = GAME_CONSTANTS.TILES.FLOOR[
                        Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                    ];
                    this.colors[y0][x0] = GAME_CONSTANTS.COLORS.FLOOR;
                    
                    // 周囲も床にする
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = x0 + dx;
                            const ny = y0 + dy;
                            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                                this.map[ny][nx] = 'floor';
                                this.tiles[ny][nx] = GAME_CONSTANTS.TILES.FLOOR[
                                    Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                                ];
                                this.colors[ny][nx] = GAME_CONSTANTS.COLORS.FLOOR;
                            }
                        }
                    }
                    
                    // 次の位置を計算
                    const e2 = 2 * err;
                    if (e2 > -dy) {
                        err -= dy;
                        x0 += sx;
                    }
                    if (e2 < dx) {
                        err += dx;
                        y0 += sy;
                    }
                }
            };
            
            // プレイヤーから階段への直線
            plotLine(startX, startY, endX, endY);
            
            // 階段のタイルを復元
            this.tiles[endY][endX] = GAME_CONSTANTS.STAIRS.CHAR;
            this.colors[endY][endX] = GAME_CONSTANTS.STAIRS.COLOR;
        }
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
                    if (wallCount >= 2) {
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

    // Add new method for generating home floor
    generateHomeFloor() {
        // 中央の部屋を作成
        const centerRoom = {
            x: Math.floor(this.width / 2) - 10,
            y: Math.floor(this.height / 2) - 8,
            width: 20,
            height: 16,
            brightness: 100
        };
        
        this.rooms = [centerRoom];

        // まず全マップを宇宙空間で初期化（表示領域全体を使用）
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.map[y][x] = 'space';
                this.tiles[y][x] = GAME_CONSTANTS.TILES.SPACE[
                    Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE.length)
                ];
                this.colors[y][x] = GAME_CONSTANTS.TILES.SPACE_COLORS[
                    Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE_COLORS.length)
                ];
            }
        }

        // 部屋の壁を設定
        for (let y = centerRoom.y - 1; y <= centerRoom.y + centerRoom.height; y++) {
            for (let x = centerRoom.x - 1; x <= centerRoom.x + centerRoom.width; x++) {
                if (x === centerRoom.x - 1 || x === centerRoom.x + centerRoom.width ||
                    y === centerRoom.y - 1 || y === centerRoom.y + centerRoom.height) {
                    this.map[y][x] = 'wall';
                    this.tiles[y][x] = GAME_CONSTANTS.TILES.CYBER_WALL[
                        Math.floor(Math.random() * GAME_CONSTANTS.TILES.CYBER_WALL.length)
                    ];
                    const cyberWallColors = ['#ADFF2F', '#00FFFF', '#FF00FF', '#FFFFFF']; 
                    this.colors[y][x] = cyberWallColors[Math.floor(Math.random() * cyberWallColors.length)];
                }
            }
        }

        // 部屋の内部を床にする
        for (let y = centerRoom.y; y < centerRoom.y + centerRoom.height; y++) {
            for (let x = centerRoom.x; x < centerRoom.x + centerRoom.width; x++) {
                this.map[y][x] = 'floor';
                this.tiles[y][x] = Math.random() < 0.5 ? '0' : '1';
                this.colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
            }
        }

        // ポータルを部屋の中心に配置
        const portalX = centerRoom.x + Math.floor(centerRoom.width / 2);
        const portalY = centerRoom.y + Math.floor(centerRoom.height / 2);
        
        this.map[portalY][portalX] = 'portal';
        this.tiles[portalY][portalX] = GAME_CONSTANTS.PORTAL.GATE.CHAR;
        this.colors[portalY][portalX] = GAME_CONSTANTS.PORTAL.GATE.COLORS[0]; // 初期色はマゼンタ

        // プレイヤーの位置をポータルの手前に設定
        if (this.game && this.game.player) {
            this.game.player.x = portalX;
            this.game.player.y = portalY + 2; // ポータルの2マス下に配置
        }

        // 危険度を'SAFE'に設定
        if (this.game) {
            this.game.dangerLevel = 'SAFE';
        }
    }

    placeVoidPortal() {
        // VOIDポータルの生成は現在凍結されています
        return;
        
        /* 以下の処理は凍結中
        // 危険度に基づいて生成確率を決定
        const spawnChances = {
            'SAFE': 0.1,      // 安全な場所には10%の確率で出現
            'NORMAL': 0.3,    // 通常の場所には30%の確率で出現
            'DANGEROUS': 0.5, // 危険な場所には50%の確率で出現
            'DEADLY': 0.7     // 致命的な場所には70%の確率で出現
        };

        // 現在の危険度に基づいて生成判定
        const currentDanger = this.game?.dangerLevel || 'NORMAL';
        const spawnChance = spawnChances[currentDanger];
        
        // 確率判定に失敗した場合は生成しない
        if (Math.random() > spawnChance) {
            return;
        }

        // 部屋情報がない場合は処理しない
        if (!this.rooms || !Array.isArray(this.rooms) || this.rooms.length <= 1) {
            console.warn('placeVoidPortal: 部屋情報が不足しているか不正です。VOIDポータルを生成できません。');
            return;
        }

        // 最初の部屋以外からランダムに部屋を選択
        const availableRooms = this.rooms.slice(1);
        if (availableRooms.length === 0) return;

        const room = availableRooms[Math.floor(Math.random() * availableRooms.length)];
        
        // 部屋内の有効な位置を探す
        const validPositions = [];
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                if (this.map[y][x] === 'floor' && 
                    this.tiles[y][x] !== GAME_CONSTANTS.STAIRS.CHAR &&
                    this.tiles[y][x] !== GAME_CONSTANTS.TILES.DOOR.CLOSED &&
                    !GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[y][x]) &&
                    !GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(this.tiles[y][x])
                ) {
                    validPositions.push({ x, y });
                }
            }
        }

        if (validPositions.length === 0) return;

        // ランダムな位置を選択
        const pos = validPositions[Math.floor(Math.random() * validPositions.length)];
        
        // VOIDポータルを配置
        this.map[pos.y][pos.x] = 'void';  // 'portal'から'void'に変更
        this.tiles[pos.y][pos.x] = GAME_CONSTANTS.PORTAL.VOID.CHAR;
        this.colors[pos.y][pos.x] = GAME_CONSTANTS.PORTAL.VOID.COLORS[0];
        */
    }

    // 部屋内に蜘蛛の巣を配置するメソッド
    placeWebsInRooms(rooms) {
        // roomsが不正な場合は処理しない
        if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
            //console.warn('placeWebsInRooms: 部屋情報が不足しているか不正です。蜘蛛の巣を生成できません。');
            return;
        }

        //console.log(`placeWebsInRooms: ${rooms.length}個の部屋に蜘蛛の巣を生成します`);
        let totalWebsCreated = 0;

        rooms.forEach(room => {
            // 部屋ごとに蜘蛛の巣を配置する確率（15%に調整）
            if (Math.random() < 0.15) {
                // 部屋内に配置する蜘蛛の巣の数（1〜2個に調整）
                const webCount = Math.floor(Math.random() * 2) + 1;
                let roomWebsCreated = 0;
                
                for (let i = 0; i < webCount; i++) {
                    // 部屋内のランダムな位置を選択
                    const x = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
                    const y = room.y + 1 + Math.floor(Math.random() * (room.height - 2));
                    
                    // 位置が有効かつ床タイルであることを確認
                    if (this.isValidWebPosition(x, y)) {
                        this.placeWeb(x, y);
                        roomWebsCreated++;
                        totalWebsCreated++;
                    }
                }
                
                if (roomWebsCreated > 0) {
                    //console.log(`部屋(${room.x},${room.y})に${roomWebsCreated}個の蜘蛛の巣を生成しました`);
                }
            }
        });
        
        //console.log(`placeWebsInRooms: 合計${totalWebsCreated}個の蜘蛛の巣を生成しました`);
    }
    
    // 廊下に蜘蛛の巣を配置するメソッド
    placeWebsInCorridors() {
        //console.log('placeWebsInCorridors: 廊下に蜘蛛の巣を生成します');
        let totalWebsCreated = 0;
        
        // マップ全体をスキャン
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // 床タイルかつ部屋内ではない場所（廊下）を検出
                if (this.map[y][x] === 'floor' && !this.isInsideAnyRoom(x, y)) {
                    // 廊下に蜘蛛の巣を配置する確率（2%に調整）
                    if (Math.random() < 0.02) {
                        if (this.isValidWebPosition(x, y)) {
                            this.placeWeb(x, y);
                            totalWebsCreated++;
                        }
                    }
                }
            }
        }
        
        //console.log(`placeWebsInCorridors: 廊下に${totalWebsCreated}個の蜘蛛の巣を生成しました`);
    }
    
    // 蜘蛛の巣を配置可能な位置かどうかを判定
    isValidWebPosition(x, y) {
        // マップ範囲内チェック
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }

        // 床タイルかつ何も配置されていないことを確認
        if (this.map[y][x] !== 'floor') {
            return false;
        }
        
        // 階段、ポータル、障害物などが配置されていないか確認
        // ニューラルオベリスクなどの特別なオブジェクトとの重複を避ける
        // 基本床タイルであることを確認するよう条件を緩和
        const isBasicFloorTile = GAME_CONSTANTS.TILES.FLOOR.includes(this.tiles[y][x]);
        if (!isBasicFloorTile) {
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
    
    // 指定位置に蜘蛛の巣を配置
    placeWeb(x, y) {
        const web = {
            x: x,
            y: y,
            char: GAME_CONSTANTS.WEB.CHAR,
            color: GAME_CONSTANTS.WEB.COLOR,
            type: 'web',
            createdBy: 'environment', // 環境によって生成されたことを示す
            trapChance: GAME_CONSTANTS.WEB.TRAP_CHANCE
        };
        
        // 常にinitialWebsに追加（バックアップとして）
        this.initialWebs.push(web);
        
        // ゲームオブジェクトがあれば、websにも追加
        if (this.game) {
            if (!this.game.webs) {
                this.game.webs = [];
            }
            this.game.webs.push(web);
        }
    }

    // 洞窟型の形状を生成するメソッドを拡張
    generateCaveShape(shape, width, height, params = {}) {
        // デフォルトパラメータを設定
        const initialFloorChance = params.initialFloorChance || 0.6;
        const iterations = params.iterations || 4;
        
        // 初期状態をランダムに設定
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // 端は必ず壁に
                if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
                    shape[y][x] = false;
                } else {
                    shape[y][x] = Math.random() < initialFloorChance;
                }
            }
        }

        // セルオートマトンによる洞窟生成
        for (let i = 0; i < iterations; i++) {
            this.applyCellularAutomata(shape, width, height);
        }

        // 中心部から外側に向かって接続性をチェック
        this.ensureCaveConnectivity(shape, width, height);
    }

    // セルオートマトンのルールを適用
    applyCellularAutomata(shape, width, height) {
        const newShape = [];
        for (let y = 0; y < height; y++) {
            newShape[y] = [...shape[y]];
        }

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const floorCount = this.countNeighborFloors(shape, x, y);
                
                // B678/S345678 ルール（より自然な洞窟形状のために調整）
                if (shape[y][x]) {
                    // 床の場合、3-8個の隣接床があれば床のまま
                    newShape[y][x] = floorCount >= 3;
                } else {
                    // 壁の場合、6-8個の隣接床があれば床になる
                    newShape[y][x] = floorCount >= 6;
                }
            }
        }

        // 結果を反映
        for (let y = 0; y < height; y++) {
            shape[y] = [...newShape[y]];
        }
    }

    // 周囲8マスの床の数をカウント
    countNeighborFloors(shape, x, y) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                if (shape[y + dy][x + dx]) count++;
            }
        }
        return count;
    }

    // 洞窟の接続性を確保
    ensureCaveConnectivity(shape, width, height) {
        // 中心点から到達可能な床をマーク
        const visited = Array(height).fill().map(() => Array(width).fill(false));
        const centerY = Math.floor(height / 2);
        const centerX = Math.floor(width / 2);

        // 中心点が壁の場合、近くの床を探す
        let startX = centerX;
        let startY = centerY;
        if (!shape[centerY][centerX]) {
            let found = false;
            for (let r = 1; r < Math.min(width, height) / 2 && !found; r++) {
                for (let dy = -r; dy <= r && !found; dy++) {
                    for (let dx = -r; dx <= r && !found; dx++) {
                        const y = centerY + dy;
                        const x = centerX + dx;
                        if (y > 0 && y < height - 1 && x > 0 && x < width - 1 && shape[y][x]) {
                            startY = y;
                            startX = x;
                            found = true;
                        }
                    }
                }
            }
        }

        // 幅優先探索で到達可能な床をマーク
        const queue = [[startY, startX]];
        visited[startY][startX] = true;

        while (queue.length > 0) {
            const [y, x] = queue.shift();
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny > 0 && ny < height - 1 && nx > 0 && nx < width - 1 &&
                        shape[ny][nx] && !visited[ny][nx]) {
                        visited[ny][nx] = true;
                        queue.push([ny, nx]);
                    }
                }
            }
        }

        // 到達不可能な床を壁に変更
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (shape[y][x] && !visited[y][x]) {
                    shape[y][x] = false;
                }
            }
        }

        // 少なくとも1つの出入り口を確保
        let hasEntrance = false;
        for (let x = 1; x < width - 1 && !hasEntrance; x++) {
            if (shape[1][x] && shape[2][x]) {
                shape[0][x] = true;
                hasEntrance = true;
            }
        }
        if (!hasEntrance) {
            const x = Math.floor(width / 2);
            shape[0][x] = true;
            shape[1][x] = true;
        }
    }

    // フロアテーマを決定するメソッド
    determineFloorTheme() {
        // テーマとその選択確率
        const themes = [
            { id: 'STANDARD', weight: 50 },    // 標準的なダンジョン (50%)
            { id: 'CAVE', weight: 20 },        // 自然な洞窟 (20%)
            { id: 'RUINS', weight: 15 },       // 古代の遺跡 (15%)
            { id: 'LABORATORY', weight: 10 },  // 実験施設 (10%)
            { id: 'CRYPT', weight: 5 }         // 地下墓地 (5%)
        ];
        
        // 重み付き抽選
        const totalWeight = themes.reduce((sum, theme) => sum + theme.weight, 0);
        let roll = Math.random() * totalWeight;
        
        for (const theme of themes) {
            roll -= theme.weight;
            if (roll <= 0) return theme.id;
        }
        
        return 'STANDARD'; // デフォルト
    }

    // フロアテーマに応じたフレーバーテキストを設定するメソッド
    setFloorThemeFlavorText() {
        if (!this.game) return;
        
        // ゲームオブジェクトのフロア情報を初期化
        if (!this.game.floorInfo) {
            this.game.floorInfo = {};
        }
        
        // テーマごとのフレーバーテキスト
        const flavorTexts = {
            'STANDARD': [
                "The dungeon walls bear the marks of ancient construction. Standard corridors connect chambers of varying sizes.",
                "A typical complex of rooms and passages, built with practiced geometric precision. Nothing unusual stands out.",
                "The familiar layout of a traditional dungeon sprawls before you, showing signs of deliberate construction.",
                "Rectangular chambers connected by straight corridors form a predictable maze of pathways.",
                "The stonework here is methodical and precise - a testament to skilled dungeon architects."
            ],
            'CAVE': [
                "Natural rock formations create winding passages. The ceiling drips with moisture, and the air smells of earth.",
                "Jagged cave walls twist unpredictably through the stone. This place was carved by water, not tools.",
                "Stalagmites and stalactites create natural columns within the irregular cavern system.",
                "The rough stone walls bear no mark of tools - only the patient erosion of water over centuries.",
                "The cave system winds organically through the rock, creating unexpected open chambers and tight passages."
            ],
            'RUINS': [
                "Crumbling architecture suggests this place was once grand. Partial collapse has reshaped many chambers.",
                "Ancient stonework, once precise, now lies in partial ruin. Sections of walls have collapsed entirely.",
                "These ruins hint at sophisticated architecture from a bygone era, now slowly yielding to time.",
                "Fallen columns and partial walls suggest this place was abandoned long ago and has partially collapsed.",
                "The original geometric precision of these chambers has been disrupted by structural failures."
            ],
            'LABORATORY': [
                "Clinical surfaces and precise right angles dominate this area. Everything feels meticulously designed.",
                "The perfectly geometric layout suggests this was built for scientific experimentation and precision.",
                "Sterile chambers connected by uniform corridors speak to the methodical purpose of this facility.",
                "The walls here are unnaturally smooth, built with mathematical precision for some unknown purpose.",
                "Everything in this clinical environment appears designed for efficiency and control."
            ],
            'CRYPT': [
                "The oppressive atmosphere of a burial complex surrounds you. Small chambers suggest individual tombs.",
                "Low ceilings and narrow passages mark this as a place for the dead, not the living.",
                "The compact chambers and restricted pathways suggest this was built to house the deceased.",
                "The stale air carries the weight of a burial site. The architecture is solemn and restrained.",
                "Small ritual chambers connect through tight corridors in this place of eternal rest."
            ]
        };
        
        // 現在のフロアテーマに対応するテキスト配列を取得
        const textsForTheme = flavorTexts[this.floorTheme] || flavorTexts['STANDARD'];
        
        // ランダムに1つ選択
        const selectedText = textsForTheme[Math.floor(Math.random() * textsForTheme.length)];
        
        // フレーバーテキストを設定（上書き）
        this.game.floorInfo.flavor = selectedText;
        
        // フロアテーマ情報も保存
        this.game.floorInfo.theme = this.floorTheme;
    }
} 