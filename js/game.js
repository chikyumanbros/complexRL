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
        this.maxTotalMonsters = 100;
        this.rooms = [];  // 部屋の情報を保持
        this.isGameOver = false;
        this.floorLevel = 1;  // 階層を追加
        this.explored = this.initializeExplored();  // 踏破情報を追加
        
        this.init();
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
        this.logger = new Logger();
        this.mode = GAME_CONSTANTS.MODES.GAME;
        this.turn = 0;
        this.monsters = [];
        this.totalMonstersSpawned = 0;
        this.maxTotalMonsters = 30;
        this.rooms = [];
        this.isGameOver = false;
        this.floorLevel = 1;  // 階層を追加
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

        this.updateExplored();  // ターン終了時に踏破情報を更新
        this.renderer.render();
    }

    toggleMode() {
        this.mode = this.mode === GAME_CONSTANTS.MODES.GAME ? 
            GAME_CONSTANTS.MODES.CODEX : 
            GAME_CONSTANTS.MODES.GAME;
        this.renderer.render();
    }

    spawnInitialMonsters() {
        // 基本モンスター数を増やし、フロアレベルに応じて増加
        const baseMonsters = 30;  // 基本値を30に
        const floorBonus = Math.floor(this.floorLevel * 2);  // フロアごとに2体ずつ増加
        const randomVariation = Math.floor(Math.random() * 6);  // 0-5のランダム変動
        const numMonsters = baseMonsters + floorBonus + randomVariation;  // 最終的な生成数

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
            if (this.map[y][x] === 'wall') {
                return false;
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