class Game {
    constructor() {
        this.width = GAME_CONSTANTS.DIMENSIONS.WIDTH;
        this.height = GAME_CONSTANTS.DIMENSIONS.HEIGHT;
        this.map = [];
        this.tiles = [];
        this.colors = [];
        this.player = new Player(0, 0, this);  // Coordinates will be set later
        this.codexSystem = new CodexSystem();
        this.renderer = new Renderer(this);
        this.inputHandler = new InputHandler(this);
        this.logger = new Logger(this);
        this.mode = GAME_CONSTANTS.MODES.GAME;
        this.turn = 0;
        this.monsters = [];
        this.totalMonstersSpawned = 0;
        this.maxTotalMonsters = 100;
        this.rooms = [];  // Stores room information
        this.isGameOver = false;
        this.floorLevel = 1;  // Added floor level
        this.dangerLevel = 'NORMAL';  // Added danger level
        this.explored = this.initializeExplored();  // Added explored information
        this.lastAttackLocation = null;  // Added property to track last attack location
        this.hasDisplayedPresenceWarning = false;  // Added hasDisplayedPresenceWarning property

        this.init();

        // 保存されたデータがあれば読み込む
        this.loadGame();

        // Set up initial panel
        this.logger.renderLookPanel();
    }

    initializeExplored() {
        const explored = [];
        for (let y = 0; y < this.height; y++) {
            explored[y] = new Array(this.width).fill(false);
        }
        return explored;
    }

    reset() {
        // Clean up the input handler first
        if (this.inputHandler) {
            this.inputHandler.unbindKeys();
        }

        // モードをリセット
        this.mode = GAME_CONSTANTS.MODES.GAME;
        document.body.classList.remove('codex-mode');
        document.body.classList.remove('help-mode');

        // Fully reset the state
        this.map = [];
        this.tiles = [];
        this.colors = [];
        this.player = new Player(0, 0, this);
        this.codexSystem = new CodexSystem();
        this.logger = new Logger(this);
        this.turn = 0;
        this.monsters = [];
        this.totalMonstersSpawned = 0;
        this.maxTotalMonsters = 30;
        this.rooms = [];
        this.isGameOver = false;
        this.floorLevel = 1;

        // 危険度をランダムに決定
        const dangerLevels = Object.keys(GAME_CONSTANTS.DANGER_LEVELS);
        const weights = [0.3, 0.4, 0.2, 0.1]; // SAFE, NORMAL, DANGEROUS, DEADLYの出現確率
        let roll = Math.random();
        let cumulativeWeight = 0;

        for (let i = 0; i < dangerLevels.length; i++) {
            cumulativeWeight += weights[i];
            if (roll < cumulativeWeight) {
                this.dangerLevel = dangerLevels[i];
                break;
            }
        }

        this.explored = this.initializeExplored();

        // Clear the DOM
        const gameElement = document.getElementById('game');
        const messageLogElement = document.getElementById('message-log');
        const codexMenuElement = document.getElementById('codex-menu');
        const availableSkillsElement = document.getElementById('available-skills');
        const statusElement = document.getElementById('status');

        if (gameElement) {
            gameElement.innerHTML = '';
            // Rebuild the game container
            gameElement.id = 'game';
            gameElement.style.whiteSpace = 'pre';
        }
        if (messageLogElement) messageLogElement.innerHTML = '';
        if (codexMenuElement) codexMenuElement.innerHTML = '';
        if (availableSkillsElement) availableSkillsElement.innerHTML = '';
        if (statusElement) {
            // Reset status display
            document.getElementById('hp').textContent = '0';
            document.getElementById('max-hp').textContent = '0';
            document.getElementById('hp-text').textContent = '';
        }

        // プレイヤーの自動探索状態をリセット
        if (this.player) {
            this.player.autoExploring = false;
        }

        // Regenerate the map
        const mapGenerator = new MapGenerator(this.width, this.height, this.floorLevel, this);
        const mapData = mapGenerator.generate();
        this.map = mapData.map;
        this.tiles = mapData.tiles;
        this.colors = mapData.colors;
        this.rooms = mapData.rooms;

        // Reposition the player
        this.placePlayerInRoom();

        // Create a new input handler
        this.inputHandler = new InputHandler(this);

        // Reposition monsters
        this.spawnInitialMonsters();

        // Reinitialize the renderer
        this.renderer = new Renderer(this);

        // Display initial message
        this.logger.add("Welcome to complexRL!", "important");

        // Set mode to GAME mode
        this.mode = GAME_CONSTANTS.MODES.GAME;

        // Update the screen (display the look panel)
        this.renderer.render();
        this.logger.renderLookPanel();  // Display look panel
        this.logger.updateFloorInfo(this.floorLevel, this.dangerLevel);  // Update floor info in Logger
        this.updateRoomInfo();  // Update surrounding room information
        this.updateExplored();  // Update explored information
        this.saveGame();

        // プレイヤー名入力画面を表示
        this.renderer.renderNamePrompt('');
        this.inputHandler.setMode('name');
    }

    init() {
        // Initialize map-related properties
        this.map = [];
        this.tiles = [];
        this.colors = [];
        this.rooms = [];
        this.monsters = [];
        this.explored = this.initializeExplored();
        this.totalMonstersSpawned = 0;
        this.turn = 0;
        this.floorLevel = 1;

        // 危険度をランダムに決定（reset()と同じロジック）
        const dangerLevels = Object.keys(GAME_CONSTANTS.DANGER_LEVELS);
        const weights = [0.3, 0.4, 0.2, 0.1]; // SAFE, NORMAL, DANGEROUS, DEADLYの出現確率
        let roll = Math.random();
        let cumulativeWeight = 0;

        for (let i = 0; i < dangerLevels.length; i++) {
            cumulativeWeight += weights[i];
            if (roll < cumulativeWeight) {
                this.dangerLevel = dangerLevels[i];
                break;
            }
        }

        this.isGameOver = false;

        // Generate a new floor (including player placement and monster generation)
        this.generateNewFloor();

        // Initialize and display information
        const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[this.dangerLevel];
        this.logger.updateFloorInfo(this.floorLevel, this.dangerLevel);
        this.updateRoomInfo();

        // プレイヤーの初期位置周辺を探索済みにマーク
        this.updateExplored();

        // Setup input handling and rendering
        this.renderer.render();
        this.inputHandler.bindKeys();

        // プレイヤー名入力画面を表示
        this.renderer.renderNamePrompt('');
        this.inputHandler.setMode('name');
    }

    placePlayerInRoom() {
        if (!this.rooms || this.rooms.length === 0) {
            // 部屋がない場合のフォールバック処理
            this.player.x = Math.floor(this.width / 2);
            this.player.y = Math.floor(this.height / 2);
            return;
        }

        // 部屋をランダムに選択
        const randomRoom = this.rooms[Math.floor(Math.random() * this.rooms.length)];

        // 部屋内の有効な位置を探す
        let attempts = 50;
        let validPosition = null;

        while (attempts > 0 && !validPosition) {
            // 部屋の中心付近の座標を生成
            const centerX = Math.floor(randomRoom.x + randomRoom.width / 2);
            const centerY = Math.floor(randomRoom.y + randomRoom.height / 2);

            // 中心から±2マスの範囲でランダムな位置を試す
            const testX = centerX + Math.floor(Math.random() * 5) - 2;
            const testY = centerY + Math.floor(Math.random() * 5) - 2;

            // 位置が部屋の中にあり、かつ床タイルで、障害物や階段がない場合
            if (this.isPositionInRoom(testX, testY, randomRoom) &&
                this.map[testY][testX] === 'floor' &&
                this.tiles[testY][testX] !== GAME_CONSTANTS.STAIRS.CHAR &&
                !GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[testY][testX]) &&
                !GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(this.tiles[testY][testX])) {
                validPosition = { x: testX, y: testY };
            }

            attempts--;
        }

        // 有効な位置が見つかった場合はその位置に、見つからなかった場合は部屋の中心に配置
        if (validPosition) {
            this.player.x = validPosition.x;
            this.player.y = validPosition.y;
        } else {
            this.player.x = Math.floor(randomRoom.x + randomRoom.width / 2);
            this.player.y = Math.floor(randomRoom.y + randomRoom.height / 2);
        }

        // プレイヤーの開始部屋を記録
        this.playerStartRoom = randomRoom;
    }

    isPositionInRoom(x, y, room) {
        return x >= room.x && x < room.x + room.width &&
            y >= room.y && y < room.y + room.height;
    }

    isOccupied(x, y) {
        // プレイヤーの位置チェック
        if (this.player.x === x && this.player.y === y) return true;

        // 閉じた扉のチェックを追加
        if (this.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) return true;

        // モンスターの位置チェック
        return this.monsters.some(m => m.x === x && m.y === y);
    }

    removeMonster(monster) {
        const index = this.monsters.indexOf(monster);
        if (index > -1) {
            this.monsters.splice(index, 1);
        }
    }

    getMonsterAt(x, y) {
        return this.monsters.find(m => m.x === x && m.y === y);
    }

    processTurn() {
        this.hasDisplayedPresenceWarning = false;  // フラグをリセット
        this.turn++;

        // 明るさの揺らぎを更新
        this.renderer.updateFlickerValues();

        // Process player's cooldown
        this.player.processTurn();

        // Only allow alive monsters to act
        this.monsters = this.monsters.filter(monster => monster.hp > 0);

        // Monster action phase
        for (const monster of this.monsters) {
            monster.act(this);

            // If the player dies
            if (this.player.hp <= 0) {
                return;
            }
        }

        // Update explored information at the end of the turn
        this.updateExplored();
        // Update room information
        this.updateRoomInfo();
        // 幻覚エフェクトのターンカウントを更新
        this.renderer.psychedelicTurn++;
        this.renderer.render();

        // 各ターン終了時にセーブ
        this.saveGame();
    }

    toggleMode() {
        if (this.mode === GAME_CONSTANTS.MODES.GAME) {
            this.mode = GAME_CONSTANTS.MODES.CODEX;
            document.body.classList.add('codex-mode');
            this.renderer.renderCodexMenu();
        } else if (this.mode === GAME_CONSTANTS.MODES.HELP) {
            this.mode = GAME_CONSTANTS.MODES.GAME;
            document.body.classList.remove('help-mode');
            this.logger.renderLookPanel();
        } else {
            this.mode = GAME_CONSTANTS.MODES.GAME;
            document.body.classList.remove('codex-mode');
            this.logger.renderLookPanel();
        }

        this.renderer.render();
    }

    // New method to switch to help mode
    enterHelpMode() {
        this.mode = GAME_CONSTANTS.MODES.HELP;
        document.body.classList.add('help-mode');
        this.renderer.renderHelpMenu();
        this.renderer.render();
    }

    spawnInitialMonsters() {
        const dangerData = GAME_CONSTANTS.DANGER_LEVELS[this.dangerLevel];

        // Increase base count while incorporating the danger modifier
        const baseCount = Math.floor(5 + this.floorLevel * 1.5);
        const monsterCount = Math.max(3, baseCount + dangerData.levelModifier);

        //console.log(`Attempting to spawn ${monsterCount} monsters on floor ${this.floorLevel} (${this.dangerLevel})`);
        //console.log(`Base count: ${baseCount}, Danger modifier: ${dangerData.levelModifier}`);

        for (let i = 0; i < monsterCount; i++) {
            const validRooms = this.rooms.filter(room => {
                // Exclude the room that contains the player
                const isPlayerRoom = this.player.x >= room.x &&
                    this.player.x < room.x + room.width &&
                    this.player.y >= room.y &&
                    this.player.y < room.y + room.height;
                return !isPlayerRoom;
            });

            //console.log(`Found ${validRooms.length} valid rooms for spawning`);
            if (validRooms.length === 0) {
                //console.log('No valid rooms found for monster spawning');
                continue;
            }

            // Check to limit the number of monsters per room
            const roomCounts = new Map();
            validRooms.forEach(room => {
                const count = this.monsters.filter(m =>
                    m.x >= room.x && m.x < room.x + room.width &&
                    m.y >= room.y && m.y < room.y + room.height
                ).length;
                roomCounts.set(room, count);
            });

            // Prioritize rooms with fewer monsters (based on room area)
            const availableRooms = validRooms.filter(room =>
                roomCounts.get(room) < Math.floor(room.width * room.height / 16)
            );

            if (availableRooms.length === 0) continue;

            const room = availableRooms[Math.floor(Math.random() * availableRooms.length)];
            let attempts = 50;
            let monster = null;

            while (attempts > 0 && !monster) {
                const x = room.x + Math.floor(Math.random() * room.width);
                const y = room.y + Math.floor(Math.random() * room.height);

                // 生成位置の妥当性チェックを強化
                const isValidSpawn = this.isValidPosition(x, y) &&
                    this.map[y][x] === 'floor' &&
                    !this.getMonsterAt(x, y) &&
                    this.tiles[y][x] !== GAME_CONSTANTS.TILES.DOOR.CLOSED && // 閉じた扉のチェックを追加
                    this.tiles[y][x] !== GAME_CONSTANTS.STAIRS.CHAR;

                const dx = x - this.player.x;
                const dy = y - this.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (isValidSpawn && distance >= GAME_CONSTANTS.ROOM.SAFE_RADIUS) {

                    monster = Monster.spawnRandomMonster(x, y, this.floorLevel, this.dangerLevel);
                    this.monsters.push(monster);
                    this.totalMonstersSpawned++;
                    //console.log(`Spawned ${monster.name} (Level ${monster.level}) at (${x}, ${y})`);

                    // Handle pack spawning.
                    const template = MONSTERS[monster.type];
                    if (template.pack && Math.random() < template.pack.chance) {
                        const packSize = template.pack.min +
                            Math.floor(Math.random() * (template.pack.max - template.pack.min + 1));

                        //console.log(`Attempting to spawn pack of size ${packSize} for ${monster.name}`);

                        // Spawn pack members.
                        for (let j = 0; j < packSize - 1; j++) {
                            let packAttempts = 10;
                            let packSpawned = false;

                            while (packAttempts > 0 && !packSpawned) {
                                const packX = x + Math.floor(Math.random() * 3) - 1;
                                const packY = y + Math.floor(Math.random() * 3) - 1;

                                // Ensure pack members maintain a safe distance from the player.
                                const packDx = packX - this.player.x;
                                const packDy = packY - this.player.y;
                                const packDistance = Math.sqrt(packDx * packDx + packDy * packDy);

                                const isValidPackSpawn = this.isValidPosition(packX, packY) &&
                                    this.map[packY][packX] === 'floor' &&
                                    !this.getMonsterAt(packX, packY) &&
                                    this.tiles[packY][packX] !== GAME_CONSTANTS.TILES.DOOR.CLOSED &&
                                    this.tiles[packY][packX] !== GAME_CONSTANTS.STAIRS.CHAR &&
                                    packDistance >= GAME_CONSTANTS.ROOM.SAFE_RADIUS;

                                if (isValidPackSpawn) {
                                    const packMember = new Monster(monster.type, packX, packY);
                                    this.monsters.push(packMember);
                                    this.totalMonstersSpawned++;
                                    packSpawned = true;
                                    //console.log(`Spawned pack member (Level ${packMember.level}) at (${packX}, ${packY})`);
                                }
                                packAttempts--;
                            }

                            if (!packSpawned) {
                                //console.log('Failed to spawn pack member');
                            }
                        }
                    }
                }
                attempts--;
            }

            if (!monster) {
                //console.log(`Failed to spawn monster after ${50 - attempts} attempts`);
            }
        }

        // Final check on the total number of monsters.
        const monstersPerRoom = new Map();
        this.rooms.forEach(room => {
            const count = this.monsters.filter(m =>
                m.x >= room.x && m.x < room.x + room.width &&
                m.y >= room.y && m.y < room.y + room.height
            ).length;
            monstersPerRoom.set(room, count);
        });

        //console.log(`Total monsters spawned: ${this.monsters.length}`);
        //console.log('Monsters per room:', Array.from(monstersPerRoom.entries()).map(([room, count]) => 
        //    `Room at (${room.x},${room.y}): ${count} monsters`
        //));
    }

    gameOver() {
        // セーブデータを削除
        localStorage.removeItem('complexRL_saveData');

        // Calculate final score.
        const monstersKilled = this.maxTotalMonsters - this.monsters.length;
        const finalScore = {
            monstersKilled: monstersKilled,
            codexPoints: this.player.codexPoints,
            turns: this.turn
        };

        // Render the final state.
        this.renderer.render();

        // Set game over state.
        this.isGameOver = true;
        this.mode = GAME_CONSTANTS.MODES.GAME_OVER;

        // Display game over message via Logger.
        this.logger.showGameOverMessage(finalScore);
    }

    generateNewFloor() {
        // Determine danger level by random roll.
        const dangerRoll = Math.random() * 100;
        if (dangerRoll < 5) {  // 5%に減少
            this.dangerLevel = 'SAFE';
        } else if (dangerRoll < 50) {  // 45%に減少
            this.dangerLevel = 'NORMAL';
        } else if (dangerRoll < 80) {  // 30%に増加
            this.dangerLevel = 'DANGEROUS';
        } else {  // 20%に増加
            this.dangerLevel = 'DEADLY';
        }

        // Add debug log.
        //console.log(`New floor ${this.floorLevel}, Danger Level: ${this.dangerLevel} (Roll: ${dangerRoll})`);

        // Send floor information to Logger.
        this.logger.updateFloorInfo(this.floorLevel, this.dangerLevel);

        // Pass the game instance when generating a new floor.
        const mapGenerator = new MapGenerator(
            this.width,
            this.height,
            this.floorLevel,
            this
        );
        const mapData = mapGenerator.generate();

        this.map = mapData.map;
        this.tiles = mapData.tiles;
        this.colors = mapData.colors;
        this.rooms = mapData.rooms;

        this.monsters = [];
        this.totalMonstersSpawned = 0;
        this.explored = this.initializeExplored();

        this.placePlayerInRoom();
        this.player.autoExploring = false;

        // モンスターの生成
        this.spawnInitialMonsters();

        // Initialize and display information
        const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[this.dangerLevel];
        this.logger.updateFloorInfo(this.floorLevel, this.dangerLevel);
        this.updateRoomInfo();

        // プレイヤーの初期位置周辺を探索済みにマーク
        this.updateExplored();

        // Setup input handling and rendering
        this.renderer.render();
        this.inputHandler.bindKeys();
    }

    setInputMode(mode, options = {}) {
        this.inputHandler.setMode(mode, options);
    }

    // Mark tiles within the player's visible range as explored.
    updateExplored() {
        const visibleTiles = this.getVisibleTiles();
        visibleTiles.forEach(({ x, y }) => {
            this.explored[y][x] = true;
        });
    }

    // Check if there is a clear line of sight.
    hasLineOfSight(x1, y1, x2, y2) {
        const points = this.getLinePoints(x1, y1, x2, y2);

        // Check the intermediate points, excluding the start and end.
        for (let i = 1; i < points.length - 1; i++) {
            const { x, y } = points[i];

            // 視線を遮る障害物かどうかをチェック
            const isBlockingObstacle =
                this.map[y][x] === 'wall' ||
                this.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED ||
                (this.map[y][x] === 'obstacle' &&
                    GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[y][x]));

            if (isBlockingObstacle) {
                return false;
            }

            // 斜めの視線チェック
            if (i > 0) {
                const prev = points[i - 1];
                if (prev.x !== x && prev.y !== y) {
                    const isCornerBlocking =
                        (this.map[prev.y][x] === 'wall' && this.map[y][prev.x] === 'wall') ||
                        (this.map[prev.y][x] === 'obstacle' &&
                            GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[prev.y][x]) &&
                            this.map[y][prev.x] === 'obstacle' &&
                            GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[y][prev.x]));

                    if (isCornerBlocking) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    // Get coordinates along the line between two points (Bresenham's algorithm).
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

    // Retrieve all tiles visible to the player.
    getVisibleTiles() {
        const visibleTiles = [];
        const currentRoom = this.getCurrentRoom();
        const CORRIDOR_VISIBILITY = 2; // 部屋に属さない床（通路）の視界範囲

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const dx = x - this.player.x;
                const dy = y - this.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // 対象タイルが属する部屋を検出
                const roomAtTile = this.getRoomAt(x, y);

                let tileVisibility;
                if (roomAtTile) {
                    // タイルが部屋に属している場合、その部屋の明るさに余分な範囲を追加
                    tileVisibility = roomAtTile.brightness;
                } else if (currentRoom && this.isNearRoom(x, y, currentRoom)) {
                    // プレイヤーがいる部屋の隣接タイルの場合、その部屋の明るさに余分な範囲を追加
                    tileVisibility = currentRoom.brightness;
                } else {
                    // それ以外（通路など）は基本の視界範囲を使用
                    tileVisibility = CORRIDOR_VISIBILITY;
                }

                // 壁や障害物の場合は、より広い範囲で視認可能に
                if (this.map[y][x] === 'wall' ||
                    this.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED ||
                    (this.map[y][x] === 'obstacle' &&
                        GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[y][x]))) {
                    tileVisibility += 1;  // 視界を遮る要素は通常の視界範囲より1マス広く見える
                }

                if (distance <= tileVisibility) {
                    if (this.hasLineOfSight(this.player.x, this.player.y, x, y)) {
                        visibleTiles.push({ x, y });
                    }
                }
            }
        }
        return visibleTiles;
    }

    updateRoomInfo() {
        const px = this.player.x;
        const py = this.player.y;
        const currentRoom = this.rooms.find(room =>
            px >= room.x &&
            px < room.x + room.width &&
            py >= room.y &&
            py < room.y + room.height
        );

        // Set the range for counting monsters.
        let monsterCount;
        if (currentRoom) {
            // In a room, count monsters throughout the room.
            monsterCount = this.monsters.filter(monster =>
                monster.x >= currentRoom.x &&
                monster.x < currentRoom.x + currentRoom.width &&
                monster.y >= currentRoom.y &&
                monster.y < currentRoom.y + currentRoom.height
            ).length;
        } else {
            // 廊下でのモンスターカウント（チェビシェフ距離からユークリッド距離に変更）
            monsterCount = this.monsters.filter(monster => {
                const dx = monster.x - px;
                const dy = monster.y - py;
                const distance = Math.sqrt(dx * dx + dy * dy);
                return distance <= 2.5;  // 円形の範囲で確認
            }).length;
        }

        this.logger.updateRoomInfo(currentRoom, monsterCount);
    }

    // Get the room in which the player is currently located.
    getCurrentRoom() {
        if (!this.map) return null;

        // Get the player's current coordinates.
        const px = this.player.x;
        const py = this.player.y;

        // Check if the player is inside a room.
        for (const room of this.rooms) {
            if (px >= room.x && px < room.x + room.width &&
                py >= room.y && py < room.y + room.height) {
                return room;
            }
        }

        return null; // Return null if not in a room (i.e., in a corridor).
    }

    // Retrieve monsters within the specified room.
    getMonstersInRoom(room) {
        if (!room) return [];

        return this.monsters.filter(monster =>
            monster.x >= room.x &&
            monster.x < room.x + room.width &&
            monster.y >= room.y &&
            monster.y < room.y + room.height
        );
    }

    // New: Method to check if a coordinate is valid.
    isValidPosition(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    // セーブデータを保存
    saveGame() {
        if (this.isGameOver) return;

        // 前回のセーブから変更がない場合はスキップ
        const currentState = {
            playerPos: `${this.player.x},${this.player.y}`,
            playerHp: this.player.hp,
            monstersState: this.monsters.map(m => `${m.x},${m.y},${m.hp}`).join('|'),
            turn: this.turn
        };

        if (this._lastSaveState &&
            JSON.stringify(currentState) === JSON.stringify(this._lastSaveState)) {
            return;
        }

        // セーブ処理
        const saveData = {
            player: {
                name: this.player.name,
                x: this.player.x,
                y: this.player.y,
                hp: this.player.hp,
                maxHp: this.player.maxHp,
                level: this.player.level,
                xp: this.player.xp,
                xpToNextLevel: this.player.xpToNextLevel,
                codexPoints: this.player.codexPoints,
                stats: this.player.stats,
                skills: Array.from(this.player.skills).map(([slot, skill]) => ({
                    slot,
                    skillId: skill.id,
                    remainingCooldown: skill.remainingCooldown
                }))
            },
            monsters: this.monsters.map(monster => ({
                type: monster.type,
                x: monster.x,
                y: monster.y,
                hp: monster.hp,
                isSleeping: monster.isSleeping,
                hasStartedFleeing: monster.hasStartedFleeing
            })),
            map: this.map,
            tiles: this.tiles,
            colors: this.colors,
            rooms: this.rooms,
            explored: this.explored,
            floorLevel: this.floorLevel,
            dangerLevel: this.dangerLevel,
            turn: this.turn
        };

        try {
            localStorage.setItem('complexRL_saveData', JSON.stringify(saveData));
            this._lastSaveState = currentState;
        } catch (e) {
            console.error('Failed to save game data:', e);
        }
    }

    // セーブデータを読み込む
    loadGame() {
        try {
            const savedData = localStorage.getItem('complexRL_saveData');
            if (!savedData) {
                this.init();
                return;
            }

            const data = JSON.parse(savedData);
            
            // データの検証
            if (!data || !data.player) {
                console.error('Invalid save data format');
                this.init();
                return;
            }

            // 初期化を先に行う
            this.init();

            // プレイヤー名が保存されている場合
            if (data.player.name) {
                // タイトル画面のみ表示し、ゲームモードに設定
                this.renderer.renderNamePrompt('');
                this.inputHandler.mode = 'game';
                
                // 少し遅延してタイトルを消去し、ウェルカムメッセージを表示
                setTimeout(() => {
                    this.logger.clearTitle();
                    this.logger.add(`Welcome back, ${data.player.name}!`, "important");
                }, 1000);
            }

            // プレイヤーの復元（nullチェック付き）
            if (data.player) {
                this.player.name = data.player.name || 'Unknown';
                this.player.x = data.player.x || 0;
                this.player.y = data.player.y || 0;
                this.player.hp = data.player.hp || this.player.maxHp;
                this.player.maxHp = data.player.maxHp || this.player.maxHp;
                this.player.level = data.player.level || 1;
                this.player.xp = data.player.xp || 0;
                this.player.xpToNextLevel = data.player.xpToNextLevel || 100;
                this.player.codexPoints = data.player.codexPoints || 0;
                this.player.stats = data.player.stats || this.player.stats;
            }

            // スキルの復元
            this.player.skills = new Map();
            if (data.player.skills && Array.isArray(data.player.skills)) {
                data.player.skills.forEach(skillData => {
                    if (skillData && skillData.slot && skillData.skillId) {
                        this.player.skills.set(skillData.slot, {
                            id: skillData.skillId,
                            remainingCooldown: skillData.remainingCooldown || 0
                        });
                    }
                });
            }

            // マップデータの復元（nullチェック付き）
            this.map = data.map || this.map;
            this.tiles = data.tiles || this.tiles;
            this.colors = data.colors || this.colors;
            this.rooms = data.rooms || this.rooms;
            this.explored = data.explored || this.explored;
            this.floorLevel = data.floorLevel || 1;
            this.dangerLevel = data.dangerLevel || 'NORMAL';
            this.turn = data.turn || 0;

            // モンスターの復元（nullチェック付き）
            if (Array.isArray(data.monsters)) {
                this.monsters = data.monsters.map(monsterData => {
                    if (!monsterData || !monsterData.type) return null;
                    const monster = new Monster(monsterData.type, monsterData.x || 0, monsterData.y || 0, this);
                    monster.hp = monsterData.hp || monster.hp;
                    monster.isSleeping = monsterData.isSleeping || false;
                    monster.hasStartedFleeing = monsterData.hasStartedFleeing || false;
                    return monster;
                }).filter(monster => monster !== null);
            }

            this.renderer.render();
            this.logger.add("Previous save data loaded", "important");
        } catch (e) {
            console.error('Failed to load save data:', e);
            // 読み込みに失敗した場合は新規ゲームを開始
            this.init();
        }
    }

    getRoomAt(x, y) {
        for (const room of this.rooms) {
            if (x >= room.x && x < room.x + room.width &&
                y >= room.y && y < room.y + room.height) {
                return room;
            }
        }
        return null;
    }

    // Game クラス内に追加するメソッド：指定座標が指定部屋から range 内にあるかを判定する
    isNearRoom(x, y, room, range = 1) {
        for (let dy = -range; dy <= range; dy++) {
            for (let dx = -range; dx <= range; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= room.x && nx < room.x + room.width &&
                    ny >= room.y && ny < room.y + room.height) {
                    return true;
                }
            }
        }
        return false;
    }
}

// Start the game.
const game = new Game();
