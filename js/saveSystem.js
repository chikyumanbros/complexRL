class SaveSystem {
    constructor(game) {
        this.game = game;
    }

    saveGame() {
        if (this.game.isGameOver) return;

        const currentState = {
            playerPos: `${this.game.player.x},${this.game.player.y}`,
            playerHp: this.game.player.hp,
            playerVigor: this.game.player.vigor,
            monstersState: this.game.monsters.map(m => `${m.x},${m.y},${m.hp}`).join('|'),
            turn: this.game.turn,
            totalTurns: this.game.totalTurns,
            floorLevel: this.game.floorLevel
        };

        // フロアレベルが変化した場合は必ずセーブする
        if (this._lastSaveState?.floorLevel !== this.game.floorLevel) {
            this._lastSaveState = null;  // フロア変更時は前回のセーブ状態を無効化
        }

        const saveData = {
            player: {
                name: this.game.player.name,
                x: this.game.player.x,
                y: this.game.player.y,
                maxHp: this.game.player.maxHp,
                hp: this.game.player.hp,
                level: this.game.player.level,
                xp: this.game.player.xp,
                xpToNextLevel: this.game.player.xpToNextLevel,
                stats: this.game.player.stats,
                skills: Array.from(this.game.player.skills).map(([slot, skill]) => ({
                    slot,
                    skillId: skill.id,
                    remainingCooldown: skill.remainingCooldown
                })),
                vigor: this.game.player.vigor,
                rangedCombat: {
                    energy: {
                        current: this.game.player.rangedCombat.energy.current,
                        max: this.game.player.rangedCombat.energy.max,
                        rechargeRate: this.game.player.rangedCombat.energy.rechargeRate,
                        cost: this.game.player.rangedCombat.energy.cost
                    },
                    isActive: this.game.player.rangedCombat.isActive
                },
                attackPower: this.game.player.attackPower,
                defense: this.game.player.defense,
                accuracy: this.game.player.accuracy,
                evasion: this.game.player.evasion,
                perception: this.game.player.perception
            },
            gameState: {
                floorLevel: this.game.floorLevel,
                dangerLevel: this.game.dangerLevel,
                turn: this.game.turn,
                totalTurns: this.game.totalTurns
            },
            mapData: {
                map: this.game.map,
                tiles: this.game.tiles,
                colors: this.game.colors,
                rooms: this.game.rooms,
                explored: this.game.explored
            },
            monsters: this.game.monsters.map(monster => ({
                type: monster.type,
                x: monster.x,
                y: monster.y,
                hp: monster.hp,
                isSleeping: monster.isSleeping,
                hasStartedFleeing: monster.hasStartedFleeing
            })),
            webs: this.game.webs
        };

        try {
            localStorage.setItem('complexRL_saveData', JSON.stringify(saveData));
            this._lastSaveState = currentState;
        } catch (e) {
            console.error('Failed to save game data:', e);
        }
    }

    loadGame() {
        try {
            const savedData = localStorage.getItem('complexRL_saveData');
            if (!savedData) {
                this.game.init();
                return;
            }

            const data = JSON.parse(savedData);

            // データの検証
            if (!data || !data.player || !data.gameState || !data.mapData) {
                console.error('Invalid save data format');
                this.game.init();
                return;
            }

            // 初期化を先に行う
            this.game.init();

            // ゲーム状態の復元
            this.game.floorLevel = data.gameState.floorLevel ?? 0;
            this.game.dangerLevel = data.gameState.dangerLevel ?? 'SAFE';
            this.game.turn = data.gameState.turn ?? 0;
            this.game.totalTurns = data.gameState.totalTurns ?? 0;

            // プレイヤー名が保存されている場合
            if (data.player.name) {
                this.game.renderer.renderNamePrompt('');
                this.game.inputHandler.mode = 'game';
                this.game.logger.clearTitle();
                this.game.logger.add(`Welcome back, ${data.player.name}!`, "important");
            }

            // プレイヤーデータの復元
            this.game.player.x = data.player.x;
            this.game.player.y = data.player.y;
            this.game.player.hp = data.player.hp;
            this.game.player.maxHp = data.player.maxHp;
            this.game.player.level = data.player.level ?? 1;
            this.game.player.xp = data.player.xp ?? 0;
            this.game.player.xpToNextLevel = data.player.xpToNextLevel ?? 100;
            this.game.player.stats = data.player.stats ?? this.game.player.stats;
            this.game.player.vigor = (typeof data.player.vigor === 'number' && !isNaN(data.player.vigor)) ? data.player.vigor : GAME_CONSTANTS.VIGOR.MAX;
            this.game.player.name = data.player.name ?? '';
            this.game.player.validateVigor();

            // 遠距離攻撃のエネルギー情報を復元
            if (data.player.rangedCombat && data.player.rangedCombat.energy) {
                this.game.player.rangedCombat.energy.current = data.player.rangedCombat.energy.current ?? this.game.player.rangedCombat.energy.max;
                this.game.player.rangedCombat.energy.max = data.player.rangedCombat.energy.max ?? GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_MAX(this.game.player.stats);
                this.game.player.rangedCombat.energy.rechargeRate = data.player.rangedCombat.energy.rechargeRate ?? GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_RECHARGE(this.game.player.stats);
                this.game.player.rangedCombat.energy.cost = data.player.rangedCombat.energy.cost ?? GAME_CONSTANTS.FORMULAS.RANGED_COMBAT.ENERGY_COST(this.game.player.stats);
                this.game.player.rangedCombat.isActive = data.player.rangedCombat.isActive ?? false;
            }

            this.game.player.skills = new Map();
            if (Array.isArray(data.player.skills) && data.player.skills.length > 0) {
                data.player.skills.forEach(skillData => {
                    if (skillData?.slot && skillData?.skillId) {
                        this.game.player.skills.set(skillData.slot, {
                            id: skillData.skillId,
                            remainingCooldown: skillData.remainingCooldown ?? 0
                        });
                    }
                });
            }

            // 派生ステータスの復元
            if (data.player.attackPower) this.game.player.attackPower = data.player.attackPower;
            if (data.player.defense) this.game.player.defense = data.player.defense;
            if (data.player.accuracy) this.game.player.accuracy = data.player.accuracy;
            if (data.player.evasion) this.game.player.evasion = data.player.evasion;
            if (data.player.perception) this.game.player.perception = data.player.perception;

            // マップデータの復元
            this.game.map = data.mapData.map ?? this.game.map;
            this.game.tiles = data.mapData.tiles ?? this.game.tiles;
            this.game.colors = data.mapData.colors ?? this.game.colors;
            this.game.rooms = data.mapData.rooms ?? [];
            this.game.explored = data.mapData.explored ?? this.game.initializeExplored();

            // モンスターの復元
            if (Array.isArray(data.monsters)) {
                this.game.monsters = data.monsters
                    .filter(monsterData => monsterData?.type)
                    .map(monsterData => {
                        const monster = new Monster(
                            monsterData.type,
                            monsterData.x ?? 0,
                            monsterData.y ?? 0,
                            this.game
                        );
                        monster.hp = Math.min(monsterData.hp ?? monster.hp, monster.maxHp);
                        monster.isSleeping = monsterData.isSleeping ?? false;
                        monster.hasStartedFleeing = monsterData.hasStartedFleeing ?? false;
                        return monster;
                    });
            }
            
            // 蜘蛛の巣情報をリセットしてから復元
            this.game.webs = [];
            if (Array.isArray(data.webs)) {
                this.game.webs = data.webs.filter(web => {
                    if (!web || typeof web.x !== 'number' || typeof web.y !== 'number') {
                        return false;
                    }
                    if (web.x < 0 || web.x >= this.game.width || web.y < 0 || web.y >= this.game.height) {
                        return false;
                    }
                    return this.game.map[web.y][web.x] === 'floor';
                });
            }

            this.game.renderer.render();
            this.game.logger.add("Previous save data loaded", "important");

            // ステータスパネルの更新
            this.game.renderer.renderStatus();

            // BGMの更新処理を最後に実行し、強制的に再生を試みる
            this.game.soundManager.userInteracted = true;
            this.game.soundManager.updateBGM();
        } catch (e) {
            console.error('Failed to load save data:', e);
            this.game.init();
        }
    }

    reset() {
        // Reset game state
        this.game.player = new Player(0, 0, this.game);
        this.game.player.vigor = GAME_CONSTANTS.VIGOR.MAX;
        this.game.logger = new Logger(this.game);
        this.game.mode = GAME_CONSTANTS.MODES.GAME;
        this.game.turn = 0;
        this.game.totalTurns = 0;
        this.game.monsters = [];
        this.game.totalMonstersSpawned = 0;
        this.game.rooms = [];
        this.game.isGameOver = false;
        this.game.floorLevel = 0;
        this.game.dangerLevel = 'NORMAL';
        this.game.explored = this.game.initializeExplored();
        this.game.lastAttackLocation = null;
        this.game.hasDisplayedPresenceWarning = false;
        this.game.lastHomeFloorUpdate = 0;
        this.game.inputDisabled = false;
        this.game.vigorEffectOccurred = false;
        this.game.pendingMonsterDeaths = [];
        this.game.neuralObelisks = [];
        this.game.webs = [];
        this.game.monsterKillCount = 0;

        // Initialize the map
        const mapGenerator = new MapGenerator(this.game.width, this.game.height);
        const mapData = mapGenerator.generateHomeFloor();
        this.game.map = mapData.map;
        this.game.tiles = mapData.tiles;
        this.game.colors = mapData.colors;
        this.game.rooms = mapData.rooms;

        // Reposition the player
        this.game.placePlayerInRoom();

        // Create a new input handler
        this.game.inputHandler = new InputHandler(this.game);

        // Reposition monsters
        this.game.spawnInitialMonsters();

        // Reinitialize the renderer
        this.game.renderer = new Renderer(this.game);

        // Display initial message
        this.game.logger.add("Welcome to complexRL!", "important");

        // Set mode to GAME mode
        this.game.mode = GAME_CONSTANTS.MODES.GAME;

        // Update the screen (display the look panel)
        this.game.renderer.render();
        this.game.logger.renderLookPanel();
        this.game.logger.updateFloorInfo(this.game.floorLevel, this.game.dangerLevel);
        this.game.updateRoomInfo();
        this.game.updateExplored();
        this.saveGame();

        // プレイヤー名入力画面を表示
        this.game.renderer.renderNamePrompt('');
        this.game.inputHandler.setMode('name');

        // リセット時にBGMも更新
        this.game.soundManager.updateBGM();
    }
} 