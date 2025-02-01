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
        this.logger = new Logger();
        this.mode = GAME_CONSTANTS.MODES.GAME;
        this.turn = 0;
        this.monsters = [];
        this.totalMonstersSpawned = 0;
        this.maxTotalMonsters = 30;
        this.rooms = [];  // 部屋の情報を保持
        this.isGameOver = false;
        this.floorLevel = 1;  // 階層を追加
        
        this.init();
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
        this.logger = new Logger();
        this.mode = GAME_CONSTANTS.MODES.GAME;
        this.turn = 0;
        this.monsters = [];
        this.totalMonstersSpawned = 0;
        this.maxTotalMonsters = 30;
        this.rooms = [];
        this.isGameOver = false;

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
            gameElement.style.fontFamily = 'monospace';
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
        const mapGenerator = new MapGenerator(this.width, this.height, this.floorLevel);
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
        // フロア生成時に現在の階層を渡す
        this.mapGenerator = new MapGenerator(
            GAME_CONSTANTS.DIMENSIONS.WIDTH,
            GAME_CONSTANTS.DIMENSIONS.HEIGHT,
            this.floorLevel
        );
        const mapData = this.mapGenerator.generate();
        this.map = mapData.map;
        this.tiles = mapData.tiles;
        this.colors = mapData.colors;
        this.rooms = mapData.rooms;  // 部屋の情報を保存

        this.placePlayerInRoom();  // プレイヤーを部屋に配置
        this.spawnInitialMonsters();
        this.renderer.renderCodexMenu();
        this.renderer.render();
        this.logger.add("Welcome to complexRL!", "important");
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

        this.renderer.render();
    }

    toggleMode() {
        this.mode = this.mode === GAME_CONSTANTS.MODES.GAME ? 
            GAME_CONSTANTS.MODES.CODEX : 
            GAME_CONSTANTS.MODES.GAME;
        this.renderer.render();
    }

    spawnInitialMonsters() {
        const numMonsters = Math.floor(Math.random() * 6) + 10;  // 10-15体のモンスター
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
                // フロア階層を考慮してモンスターを生成
                const monster = Monster.spawnRandomMonster(x, y, this.floorLevel);
                this.monsters.push(monster);
                this.totalMonstersSpawned++;
                return true;
            }
            attempts--;
        }
        return false;
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

        // ゲームオーバー画面の表示
        this.renderer.renderGameOver(finalScore);
    }

    generateNewFloor() {
        // 新しいフロアの生成
        const mapGenerator = new MapGenerator(this.width, this.height, this.floorLevel);
        const mapData = mapGenerator.generate();
        
        this.map = mapData.map;
        this.tiles = mapData.tiles;
        this.colors = mapData.colors;
        this.rooms = mapData.rooms;
        
        // モンスターをクリア
        this.monsters = [];
        this.totalMonstersSpawned = 0;
        
        // プレイヤーを最初の部屋に配置
        this.placePlayerInRoom();
        
        // 新しいモンスターを生成
        this.spawnInitialMonsters();
        
        // 画面を更新
        this.renderer.render();
    }

    setInputMode(mode, options = {}) {
        this.inputHandler.setMode(mode, options);
    }
}

// ゲームの開始
const game = new Game();

function showMessage(text, color = '#fff') {
    const messageElement = document.createElement('div');
    messageElement.style.color = color;
    messageElement.style.fontFamily = "'Courier New', monospace, sans-serif";
    messageElement.textContent = text;
    messageLog.appendChild(messageElement);
    messageLog.scrollTop = messageLog.scrollHeight;
}

function updateStats() {
    const statsElement = document.getElementById('stats');
    statsElement.style.fontFamily = "'Courier New', monospace, sans-serif";
    statsElement.innerHTML = `HP: ${player.hp}/${player.maxHp} | Level: ${player.level} | XP: ${player.xp}/${player.nextLevelXp} | Gold: ${player.gold}`;
}

function showGameOver() {
    const gameOverElement = document.createElement('div');
    gameOverElement.style.color = 'red';
    gameOverElement.style.fontFamily = "'Courier New', monospace, sans-serif";
    gameOverElement.style.fontSize = '24px';
    gameOverElement.textContent = 'GAME OVER - Press Space to Restart';
    messageLog.appendChild(gameOverElement);
} 