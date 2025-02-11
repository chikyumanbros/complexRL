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

        // Fully reset the state
        this.map = [];
        this.tiles = [];
        this.colors = [];
        this.player = new Player(0, 0, this);
        this.codexSystem = new CodexSystem();
        this.logger = new Logger(this);
        this.mode = GAME_CONSTANTS.MODES.GAME;
        this.turn = 0;
        this.monsters = [];
        this.totalMonstersSpawned = 0;
        this.maxTotalMonsters = 30;
        this.rooms = [];
        this.isGameOver = false;
        this.floorLevel = 1;  // Added floor level
        this.dangerLevel = 'NORMAL';  // Added danger level
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
        this.dangerLevel = 'NORMAL';
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
    }

    placePlayerInRoom() {
        if (!this.rooms || this.rooms.length === 0) {
            // If there are no rooms, place the player at a default position
            this.player.x = Math.floor(this.width / 2);
            this.player.y = Math.floor(this.height / 2);
            return;
        }

        // Select a random room
        const randomRoom = this.rooms[Math.floor(Math.random() * this.rooms.length)];
        
        // Place the player near the center of the room
        const centerX = Math.floor(randomRoom.x + randomRoom.width / 2);
        const centerY = Math.floor(randomRoom.y + randomRoom.height / 2);
        
        this.player.x = centerX;
        this.player.y = centerY;
        
        // Record the player's starting room
        this.playerStartRoom = randomRoom;
    }

    isPositionInRoom(x, y, room) {
        return x >= room.x && x < room.x + room.width &&
               y >= room.y && y < room.y + room.height;
    }

    isOccupied(x, y) {
        if (this.player.x === x && this.player.y === y) return true;
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
        this.turn++;
        
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

                // Check distance from the player.
                const dx = x - this.player.x;
                const dy = y - this.player.y;
                const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);

                const isValidSpawn = this.isValidPosition(x, y) && 
                                   this.map[y][x] === 'floor' && 
                                   !this.getMonsterAt(x, y) &&
                                   distanceToPlayer >= GAME_CONSTANTS.ROOM.SAFE_RADIUS;

                if (isValidSpawn) {
                    monster = Monster.spawnRandomMonster(x, y, this.floorLevel, this.dangerLevel);
                    this.monsters.push(monster);
                    this.totalMonstersSpawned++;
                    //console.log(`Spawned ${monster.name} (Level ${monster.level}) at (${x}, ${y})`);

                    // Handle pack spawning.
                    const template = GAME_CONSTANTS.MONSTERS[monster.type];
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
        visibleTiles.forEach(({x, y}) => {
            this.explored[y][x] = true;
        });
    }

    // Check if there is a clear line of sight.
    hasLineOfSight(x1, y1, x2, y2) {
        const points = this.getLinePoints(x1, y1, x2, y2);
        
        // Check the intermediate points, excluding the start and end.
        for (let i = 1; i < points.length - 1; i++) {
            const {x, y} = points[i];
            
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
            points.push({x, y});
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
        const visibleTiles = new Set();
        const px = this.player.x;
        const py = this.player.y;
        const currentRoom = this.getCurrentRoom();
        
        // キャッシュを使用（モンスターの位置は含めない）
        const cacheKey = `${px},${py},${currentRoom?.brightness || 3}`;
        if (this._visibleTilesCache?.key === cacheKey) {
            return this._visibleTilesCache.tiles;
        }
        
        // 部屋の明るさをそのまま使用（廊下は3）
        const visibility = currentRoom ? currentRoom.brightness : 3;
        const extendedVisibility = visibility + 1;

        for (let y = Math.max(0, py - extendedVisibility); y <= Math.min(this.height - 1, py + extendedVisibility); y++) {
            for (let x = Math.max(0, px - extendedVisibility); x <= Math.min(this.width - 1, px + extendedVisibility); x++) {
                const dx = x - px;
                const dy = y - py;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                const isWallOrDoor = this.map[y][x] === 'wall' || 
                                   this.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED ||
                                   this.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.OPEN;
                
                const visibilityCheck = isWallOrDoor ? 
                                      distance <= extendedVisibility : 
                                      distance <= visibility;

                if (visibilityCheck && this.hasLineOfSight(px, py, x, y)) {
                    visibleTiles.add(`${x},${y}`);
                }
            }
        }
        
        const result = Array.from(visibleTiles).map(coord => {
            const [x, y] = coord.split(',').map(Number);
            return {x, y};
        });
        
        // キャッシュを更新
        this._visibleTilesCache = {
            key: cacheKey,
            tiles: result
        };
        
        return result;
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
            // In a corridor, count monsters within a 2-tile radius.
            monsterCount = this.monsters.filter(monster => 
                Math.abs(monster.x - px) <= 2 && 
                Math.abs(monster.y - py) <= 2
            ).length;
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
                x: this.player.x,
                y: this.player.y,
                hp: this.player.hp,
                maxHp: this.player.maxHp,
                level: this.player.level,
                xp: this.player.xp,
                xpToNextLevel: this.player.xpToNextLevel,
                codexPoints: this.player.codexPoints,
                stats: this.player.stats,
                // スキルをシリアライズ可能な形式に変換
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

            // 初期化を先に行う
            this.init();

            // プレイヤーの復元
            this.player.x = data.player.x;
            this.player.y = data.player.y;
            this.player.hp = data.player.hp;
            this.player.maxHp = data.player.maxHp;
            this.player.level = data.player.level;
            this.player.xp = data.player.xp;
            this.player.xpToNextLevel = data.player.xpToNextLevel;
            this.player.codexPoints = data.player.codexPoints;
            this.player.stats = data.player.stats;
            
            // スキルの復元
            this.player.skills = new Map();
            if (Array.isArray(data.player.skills)) {
                data.player.skills.forEach(skillData => {
                    this.player.skills.set(skillData.slot, {
                        id: skillData.skillId,
                        remainingCooldown: skillData.remainingCooldown
                    });
                });
            }

            // マップデータの復元
            this.map = data.map;
            this.tiles = data.tiles;
            this.colors = data.colors;
            this.rooms = data.rooms;
            this.explored = data.explored;
            this.floorLevel = data.floorLevel;
            this.dangerLevel = data.dangerLevel;
            this.turn = data.turn;

            // モンスターの復元
            this.monsters = data.monsters.map(monsterData => {
                const monster = new Monster(monsterData.type, monsterData.x, monsterData.y, this);
                monster.hp = monsterData.hp;
                monster.isSleeping = monsterData.isSleeping;
                monster.hasStartedFleeing = monsterData.hasStartedFleeing;
                return monster;
            });
            this.renderer.render();
            this.logger.add("Previous save data loaded", "important");
        } catch (e) {
            console.error('Failed to load save data:', e);
            // 読み込みに失敗した場合は新規ゲームを開始
            this.init();
        }
    }
}

// Start the game.
const game = new Game();
