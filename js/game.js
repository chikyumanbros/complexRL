class Game {
    constructor() {
        this.width = GAME_CONSTANTS.DIMENSIONS.WIDTH;
        this.height = GAME_CONSTANTS.DIMENSIONS.HEIGHT;
        this.map = [];
        this.tiles = [];
        this.colors = [];
        this.player = new Player(0, 0, this);  // 座標は後で設定
        this.codexSystem = new CodexSystem();
        this.renderer = new Renderer(this);
        this.inputHandler = new InputHandler(this);
        this.logger = new Logger(this);
        this.mode = GAME_CONSTANTS.MODES.GAME;
        this.turn = 0;
        this.monsters = [];
        this.totalMonstersSpawned = 0;
        this.maxTotalMonsters = 100;
        this.rooms = [];  // 部屋の情報を保持
        this.isGameOver = false;
        this.floorLevel = 1;  // 階層を追加
        this.dangerLevel = 'NORMAL';  // 危険度を追加
        this.explored = this.initializeExplored();  // 踏破情報を追加
        
        this.init();

        // 初期パネルの設定
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
        // 入力ハンドラを先にクリーンアップ
        if (this.inputHandler) {
            this.inputHandler.unbindKeys();
        }

        // 状態を完全に初期化
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
        this.floorLevel = 1;  // 階層を追加
        this.dangerLevel = 'NORMAL';  // 危険度を追加
        this.explored = this.initializeExplored();

        // DOMをクリア
        const gameElement = document.getElementById('game');
        const messageLogElement = document.getElementById('message-log');
        const codexMenuElement = document.getElementById('codex-menu');
        const availableSkillsElement = document.getElementById('available-skills');
        const statusElement = document.getElementById('status');

        if (gameElement) {
            gameElement.innerHTML = '';
            // ゲームコンテナの再構築
            gameElement.id = 'game';
            gameElement.style.whiteSpace = 'pre';
        }
        if (messageLogElement) messageLogElement.innerHTML = '';
        if (codexMenuElement) codexMenuElement.innerHTML = '';
        if (availableSkillsElement) availableSkillsElement.innerHTML = '';
        if (statusElement) {
            // ステータス表示のリセット
            document.getElementById('hp').textContent = '0';
            document.getElementById('max-hp').textContent = '0';
            document.getElementById('hp-text').textContent = '';
        }

        // マップを生成し直す
        const mapGenerator = new MapGenerator(this.width, this.height, this.floorLevel, this);
        const mapData = mapGenerator.generate();
        this.map = mapData.map;
        this.tiles = mapData.tiles;
        this.colors = mapData.colors;
        this.rooms = mapData.rooms;

        // プレイヤーを配置し直す
        this.placePlayerInRoom();

        // 新しい入力ハンドラを作成
        this.inputHandler = new InputHandler(this);

        // モンスターを再配置
        this.spawnInitialMonsters();

        // レンダラーを再初期化
        this.renderer = new Renderer(this);

        // 初期メッセージ
        this.logger.add("Welcome to complexRL!", "important");

        // 画面を更新
        this.renderer.render();
        this.renderer.renderCodexMenu();
    }

    init() {
        // マップ関連の初期化
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
        
        // マップ生成（プレイヤーの配置とモンスターの生成を含む）
        this.generateNewFloor();
        
        // 情報の初期化と表示
        const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[this.dangerLevel];
        this.logger.updateFloorInfo(this.floorLevel, this.dangerLevel);
        this.updateRoomInfo();
        
        // 入力とレンダリングの設定
        this.renderer.render();
        this.inputHandler.bindKeys();
    }

    placePlayerInRoom() {
        if (!this.rooms || this.rooms.length === 0) {
            // 部屋がない場合はデフォルトの位置に配置
            this.player.x = Math.floor(this.width / 2);
            this.player.y = Math.floor(this.height / 2);
            return;
        }

        // ランダムな部屋を選択
        const randomRoom = this.rooms[Math.floor(Math.random() * this.rooms.length)];
        
        // 部屋の中央付近にプレイヤーを配置
        const centerX = Math.floor(randomRoom.x + randomRoom.width / 2);
        const centerY = Math.floor(randomRoom.y + randomRoom.height / 2);
        
        this.player.x = centerX;
        this.player.y = centerY;
        
        // プレイヤーの開始部屋を記録
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
        
        // プレイヤーのクールダウン処理
        this.player.processTurn();

        // 生存しているモンスターのみが行動
        this.monsters = this.monsters.filter(monster => monster.hp > 0);
        
        // モンスターの行動
        for (const monster of this.monsters) {
            monster.act(this);
            
            // プレイヤーが死亡した場合
            if (this.player.hp <= 0) {
                return;
            }
        }

        this.updateExplored();  // ターン終了時に踏破情報を更新
        this.updateRoomInfo();  // 部屋の情報を更新
        this.renderer.render();
    }

    toggleMode() {
        this.mode = this.mode === GAME_CONSTANTS.MODES.GAME ? 
            GAME_CONSTANTS.MODES.CODEX : 
            GAME_CONSTANTS.MODES.GAME;
        
        // モードに応じて適切なパネルを表示
        if (this.mode === GAME_CONSTANTS.MODES.GAME) {
            this.logger.renderLookPanel();  // ゲームモードならlookパネル
        } else {
            this.renderer.renderCodexMenu(); // Codexモードならcodexメニュー
        }
        
        this.renderer.render();
    }

    spawnInitialMonsters() {
        // 基本モンスター数を設定
        const baseMonsters = 30;  // 基本値
        
        // フロアレベルによるボーナス
        const floorBonus = Math.floor(this.floorLevel * 2);  // フロアごとに2体ずつ増加
        
        // 危険度による補正
        let dangerModifier = 0;
        switch (this.dangerLevel) {
            case 'SAFE':
                dangerModifier = -10;  // 安全: 基本値から10体減少
                break;
            case 'NORMAL':
                dangerModifier = 0;    // 通常: 変化なし
                break;
            case 'DANGEROUS':
                dangerModifier = 10;   // 危険: 基本値から10体増加
                break;
            case 'DEADLY':
                dangerModifier = 20;   // 致命的: 基本値から20体増加
                break;
        }
        
        // ランダムな変動を追加
        const randomVariation = Math.floor(Math.random() * 6);  // 0-5のランダム変動
        
        // 最終的な生成数を計算（最小値は5体を保証）
        const numMonsters = Math.max(5, 
            baseMonsters + floorBonus + dangerModifier + randomVariation
        );

        // デバッグ用のログを追加
        console.log(`Spawning monsters:`, {
            base: baseMonsters,
            floorBonus,
            dangerModifier,
            randomVariation,
            total: numMonsters
        });

        // モンスターの生成
        for (let i = 0; i < numMonsters; i++) {
            if (this.totalMonstersSpawned >= this.maxTotalMonsters) {
                break;
            }
            this.spawnMonster();
        }
    }

    spawnMonster() {
        if (this.totalMonstersSpawned >= this.maxTotalMonsters) {
            return false;
        }

        let attempts = 50;
        while (attempts > 0) {
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);
            
            // プレイヤーの開始部屋にいないことを確認
            if (this.playerStartRoom && this.isPositionInRoom(x, y, this.playerStartRoom)) {
                attempts--;
                continue;
            }

            if (this.map[y][x] === 'floor' && !this.isOccupied(x, y)) {
                // フロア階層と危険度を考慮してモンスターを生成
                const dangerModifier = GAME_CONSTANTS.DANGER_LEVELS[this.dangerLevel].levelModifier;
                const adjustedFloorLevel = this.floorLevel + dangerModifier;
                const monster = Monster.spawnRandomMonster(x, y, adjustedFloorLevel);
                
                this.monsters.push(monster);
                this.totalMonstersSpawned++;

                // 群れ生成の処理
                const monsterTemplate = GAME_CONSTANTS.MONSTERS[monster.type];
                if (monsterTemplate.pack && Math.random() < monsterTemplate.pack.chance) {
                    const packSize = Math.floor(
                        Math.random() * 
                        (monsterTemplate.pack.max - monsterTemplate.pack.min + 1) + 
                        monsterTemplate.pack.min
                    );

                    // 周囲のマスに群れを生成
                    for (let i = 0; i < packSize - 1; i++) {
                        const positions = this.getAdjacentPositions(x, y, 3); // 3マス以内の範囲で生成
                        for (const pos of positions) {
                            if (this.totalMonstersSpawned >= this.maxTotalMonsters) break;
                            if (this.map[pos.y][pos.x] === 'floor' && !this.isOccupied(pos.x, pos.y)) {
                                const packMember = new Monster(monster.type, pos.x, pos.y);
                                this.monsters.push(packMember);
                                this.totalMonstersSpawned++;
                                break;
                            }
                        }
                    }
                }
                return true;
            }
            attempts--;
        }
        return false;
    }

    // 指定された位置から指定範囲内の有効な位置をランダムに取得
    getAdjacentPositions(centerX, centerY, radius) {
        const positions = [];
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let x = centerX - radius; x <= centerX + radius; x++) {
                if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
                    // 中心からの距離を計算
                    const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    if (distance <= radius) {
                        positions.push({x, y});
                    }
                }
            }
        }
        // ランダムに並び替え
        return positions.sort(() => Math.random() - 0.5);
    }

    gameOver() {
        this.isGameOver = true;
        this.mode = GAME_CONSTANTS.MODES.GAME_OVER;
        
        // 最終スコアの計算
        const monstersKilled = this.maxTotalMonsters - this.monsters.length;
        const finalScore = {
            monstersKilled: monstersKilled,
            codexPoints: this.player.codex,
            turns: this.turn
        };

        // ゲームオーバーメッセージ
        this.logger.add("=================", "important");
        this.logger.add("GAME OVER", "death");
        this.logger.add("Final Score:", "important");
        this.logger.add(`Monsters Defeated: ${monstersKilled}`, "important");
        this.logger.add(`Codex Points: ${this.player.codex}`, "important");
        this.logger.add(`Survived Turns: ${this.turn}`, "important");
        this.logger.add("=================", "important");
        this.logger.add("Press Enter to restart", "info");
    }

    generateNewFloor() {
        // 危険度の抽選
        const dangerRoll = Math.random() * 100;
        if (dangerRoll < 10) {
            this.dangerLevel = 'SAFE';
        } else if (dangerRoll < 70) {
            this.dangerLevel = 'NORMAL';  // NEUTRALからNORMALに修正
        } else if (dangerRoll < 90) {
            this.dangerLevel = 'DANGEROUS';
        } else {
            this.dangerLevel = 'DEADLY';
        }

        // デバッグ用のログを追加
        console.log(`New floor ${this.floorLevel}, Danger Level: ${this.dangerLevel} (Roll: ${dangerRoll})`);

        // フロア情報をロガーに送る
        this.logger.updateFloorInfo(this.floorLevel, this.dangerLevel);

        // 新しいフロアの生成時もgameインスタンスを渡す
        const mapGenerator = new MapGenerator(
            this.width,
            this.height,
            this.floorLevel,
            this  // gameインスタンスを渡す
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
        this.spawnInitialMonsters();
        
        this.updateRoomInfo();  // 部屋の情報を更新
        
        this.renderer.render();
    }

    setInputMode(mode, options = {}) {
        this.inputHandler.setMode(mode, options);
    }

    // プレイヤーの視界内のタイルを踏破済みとしてマーク
    updateExplored() {
        const visibleTiles = this.getVisibleTiles();
        visibleTiles.forEach(({x, y}) => {
            this.explored[y][x] = true;
        });
    }

    // 視線が通るかチェック
    hasLineOfSight(x1, y1, x2, y2) {
        const points = this.getLinePoints(x1, y1, x2, y2);
        
        // 始点と終点を除いた中間点をチェック
        for (let i = 1; i < points.length - 1; i++) {
            const {x, y} = points[i];
            
            // 壁または閉じたドアの場合、視界をブロック
            if (this.map[y][x] === 'wall' || this.tiles[y][x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                return false;
            }
            
            // 斜め視線の場合は隣接壁のチェック
            if (i > 0) {
                const prev = points[i - 1];
                if (prev.x !== x && prev.y !== y) {
                    if (this.map[prev.y][x] === 'wall' && this.map[y][prev.x] === 'wall') {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    // 2点間の線上の座標を取得（ブレゼンハムのアルゴリズム）
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

    // プレイヤーから見える全タイルを取得
    getVisibleTiles() {
        const visibleTiles = new Set();
        const px = this.player.x;
        const py = this.player.y;
        const currentRoom = this.renderer.getCurrentRoom(px, py);
        
        // 部屋の中にいる場合は部屋の明るさ、通路にいる場合は視界を制限
        const visibility = currentRoom ? currentRoom.brightness : 3;  // 通路では視界3マスに制限

        for (let y = Math.max(0, py - visibility); y <= Math.min(this.height - 1, py + visibility); y++) {
            for (let x = Math.max(0, px - visibility); x <= Math.min(this.width - 1, px + visibility); x++) {
                // ユークリッド距離を使用して円形の視界を作成
                const dx = x - px;
                const dy = y - py;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 視界範囲を少し広めに取り、端を少しぼかす
                if (distance <= visibility + 0.5 && this.hasLineOfSight(px, py, x, y)) {
                    // 端の部分をランダムに欠けさせて自然な円形に
                    if (distance <= visibility || Math.random() < 0.5) {
                        visibleTiles.add(`${x},${y}`);
                    }
                }
            }
        }

        return Array.from(visibleTiles).map(coord => {
            const [x, y] = coord.split(',').map(Number);
            return {x, y};
        });
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
        
        // モンスターカウントの範囲を設定
        let monsterCount;
        if (currentRoom) {
            // 部屋内の場合は部屋全体のモンスターをカウント
            monsterCount = this.monsters.filter(monster => 
                monster.x >= currentRoom.x && 
                monster.x < currentRoom.x + currentRoom.width && 
                monster.y >= currentRoom.y && 
                monster.y < currentRoom.y + currentRoom.height
            ).length;
        } else {
            // 通路の場合は視界範囲内（2マス）のモンスターをカウント
            monsterCount = this.monsters.filter(monster => 
                Math.abs(monster.x - px) <= 2 && 
                Math.abs(monster.y - py) <= 2
            ).length;
        }

        this.logger.updateRoomInfo(currentRoom, monsterCount);
    }

    // プレイヤーが現在いる部屋を取得
    getCurrentRoom() {
        if (!this.map) return null;
        
        // プレイヤーの現在位置
        const px = this.player.x;
        const py = this.player.y;
        
        // プレイヤーが部屋にいるかチェック
        for (const room of this.rooms) {
            if (px >= room.x && px < room.x + room.width &&
                py >= room.y && py < room.y + room.height) {
                return room;
            }
        }
        
        return null; // 部屋にいない場合（通路にいる場合）
    }

    // 指定された部屋内のモンスターを取得
    getMonstersInRoom(room) {
        if (!room) return [];
        
        return this.monsters.filter(monster => 
            monster.x >= room.x && 
            monster.x < room.x + room.width &&
            monster.y >= room.y && 
            monster.y < room.y + room.height
        );
    }
}

// ゲームの開始
const game = new Game();

function showMessage(text, color = '#fff') {
    const messageElement = document.createElement('div');
    messageElement.style.color = color;
    messageElement.textContent = text;
    messageLog.appendChild(messageElement);
    messageLog.scrollTop = messageLog.scrollHeight;
}

function updateStats() {
    const statsElement = document.getElementById('stats');
    statsElement.innerHTML = `HP: ${player.hp}/${player.maxHp} | Level: ${player.level} | XP: ${player.xp}/${player.nextLevelXp} | Gold: ${player.gold}`;
}

function showGameOver() {
    const gameOverElement = document.createElement('div');
    gameOverElement.style.color = 'red';
    gameOverElement.style.fontSize = '24px';
    gameOverElement.textContent = 'GAME OVER - Press Space to Restart';
    messageLog.appendChild(gameOverElement);
} 