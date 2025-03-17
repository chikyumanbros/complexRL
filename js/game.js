class Game {
    constructor() {
        // Display setup
        this.width = GAME_CONSTANTS.DIMENSIONS.WIDTH;
        this.height = GAME_CONSTANTS.DIMENSIONS.HEIGHT;
        this.renderer = new Renderer(this);
        this.soundManager = new SoundManager(this);
        this.inputHandler = new InputHandler(this);
        this.vigorEffects = new VigorEffects(this);
        this.highScoreManager = new HighScoreManager(this);
        this.visionSystem = new VisionSystem(this);
        this.saveSystem = new SaveSystem(this);  // 追加

        // デバッグユーティリティの初期化
        this.debugUtils = new DebugUtils(this);

        // Game state
        this.player = new Player(0, 0, this);
        this.player.vigor = GAME_CONSTANTS.VIGOR.MAX;
        this.logger = new Logger(this);
        this.mode = GAME_CONSTANTS.MODES.GAME;
        this.turn = 0;
        this.totalTurns = 0;
        this.monsters = [];
        this.totalMonstersSpawned = 0;
        this.maxTotalMonsters = 100;
        this.rooms = [];
        this.isGameOver = false;
        this.floorLevel = 0;
        this.dangerLevel = 'NORMAL';
        this.explored = this.initializeExplored();
        this.lastAttackLocation = null;
        this.hasDisplayedPresenceWarning = false;
        this.lastHomeFloorUpdate = 0;
        this.inputDisabled = false;
        this.vigorEffectOccurred = false;
        this.pendingMonsterDeaths = [];
        this.neuralObelisks = [];
        this.webs = [];

        this.init();

        // 保存されたデータがあれば読み込む
        this.saveSystem.loadGame();

        // Set up initial panel
        this.logger.renderLookPanel();
    }

    initializeExplored() {
        const explored = [];
        for (let y = 0; y < GAME_CONSTANTS.DIMENSIONS.HEIGHT; y++) {
            explored[y] = new Array(GAME_CONSTANTS.DIMENSIONS.WIDTH).fill(false);
        }
        return explored;
    }

    reset() {
        this.saveSystem.reset();
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
        this.totalTurns = 0;  // ゲーム全体のターン数をリセット
        this.floorLevel = 0;

        // プレイヤーを初期化（ステータスは未割り振りの状態で）
        this.player = new Player(0, 0, this);
        // 初期ステータスをすべて8に設定
        Object.keys(this.player.stats).forEach(stat => {
            this.player.stats[stat] = 6;
        });
        this.player.remainingStatPoints = 12;  // 割り振り可能なポイント
        
        // スキルのクールダウンをリセット（ゲーム初期化時のみ）
        if (this.player.skills) {
            for (const skill of this.player.skills.values()) {
                skill.remainingCooldown = 0;
            }
        }
        
        // this.codexSystem = new CodexSystem(); // codexSystem を削除
        this.logger = new Logger(this);
        this.isGameOver = false;

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

        // BGMの初期化はSoundManagerに任せる
    }

    placePlayerInRoom() {
        // ホームフロア（レベル0）の場合は、ポータルの1マス下に配置
        if (this.floorLevel === 0) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    if (this.tiles[y][x] === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                        this.player.x = x;
                        this.player.y = y + 1;
                        this.updateHomeFloor();
                        return;
                    }
                }
            }
        }

        // 通常フロアの場合は既存のロジックを使用
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
                this.tiles[testY][testX] !== GAME_CONSTANTS.NEURAL_OBELISK.CHAR && // ニューラルオベリスクを避ける
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
            monster.isRemoved = true; // 削除フラグを追加
            monster.lastSeenTurn = this.turn; // 最後に確認されたターンを記録
            this.monsters.splice(index, 1);
            
            // lastCombatMonsterの更新
            if (this.lastCombatMonster && this.lastCombatMonster.id === monster.id) {
                this.lastCombatMonster = null;
            }

            // 遠距離攻撃のターゲットが削除されたモンスターの場合、新しいターゲットを探す
            if (this.player.rangedCombat?.isActive && 
                this.player.rangedCombat.target && 
                this.player.rangedCombat.target.x === monster.x && 
                this.player.rangedCombat.target.y === monster.y) {
                const nextTarget = this.player.findNearestTargetInRange();
                if (nextTarget) {
                    this.player.rangedCombat.target = nextTarget;
                    this.logger.add(`Targeting next enemy at (${nextTarget.x}, ${nextTarget.y})`, "playerInfo");
                } else {
                    this.player.rangedCombat.isActive = false;
                    this.logger.add("No more targets in range.", "playerInfo");
                }
            }
        }
    }

    getMonsterAt(x, y) {
        return this.monsters.find(m => m.x === x && m.y === y);
    }

    processTurn() {
        // ターンカウントをインクリメント
        this.turn++;
        this.totalTurns++;  // ゲーム全体のターン数をインクリメント

        // プレイヤーのターン処理
        this.processPlayerTurn();

        // モンスターのターン処理
        this.processMonsterTurn();

        // 自然回復の処理
        this.processNaturalHealing();

        // エネルギー回復の処理を追加
        this.player.processEnergyRecharge();

        // 遠距離攻撃のターゲット位置を更新
        if (this.player.rangedCombat?.isActive && this.player.rangedCombat.target) {
            const targetMonster = this.monsters.find(m => 
                m.x === this.player.rangedCombat.target.x && 
                m.y === this.player.rangedCombat.target.y
            );
            if (targetMonster) {
                this.player.rangedCombat.target.x = targetMonster.x;
                this.player.rangedCombat.target.y = targetMonster.y;
            } else {
                // ターゲットが見つからない場合、新しいターゲットを探す
                const nextTarget = this.player.findNearestTargetInRange();
                if (nextTarget) {
                    this.player.rangedCombat.target = nextTarget;
                } else {
                    this.player.rangedCombat.isActive = false;
                }
            }
        }

        // ターン終了時の更新処理
        this.processEndTurnUpdates();
    }

    processPlayerTurn() {
        // 蜘蛛の巣処理
        if (this.player.caughtInWeb) {
            if (!this.player.tryToBreakFreeFromWeb()) {
                // 失敗した場合、このターンの行動は制限される
            }
        }

        // メディテーション処理
        if (this.player.meditation?.active) {
            this.processMeditation();
        }

        // 休憩処理
        if (this.player.resting?.active) {
            if (this.player.hp >= this.player.maxHp) {
                this.endRest("Your HP is fully restored");
            } else if (this.player.resting.mode === 'turns') {
                this.player.resting.turnsRemaining--;
                if (this.player.resting.turnsRemaining <= 0) {
                    this.endRest("You finished resting");
                }
            }
        }

        // Vigor処理
        this.processVigorUpdate();

        // スキルのクールダウン処理
        for (const [_, skill] of this.player.skills) {
            if (skill.remainingCooldown > 0) {
                skill.remainingCooldown--;
            }
        }

        // 前回の位置を更新
        if (!this.player.lastPosition) {
            this.player.lastPosition = { x: this.player.x, y: this.player.y };
        }

        // プレイヤーのnextAttackModifiersをクリア
        this.player.nextAttackModifiers = [];
    }

    processVigorUpdate() {
        if (this.floorLevel === 0) {
            this.processHomeFloorVigor();
        } else {
            this.processNormalFloorVigor();
        }

        // Vigorペナルティの処理
        if (this.floorLevel !== 0) {
            const currentStatus = GAME_CONSTANTS.VIGOR.getStatus(this.player.vigor, this.player.stats);
            this.processVigorPenalty(currentStatus);
        }
    }

    processHomeFloorVigor() {
        const currentVigor = Number.isFinite(this.player.vigor) ? 
            Number(this.player.vigor) : 
            GAME_CONSTANTS.VIGOR.MAX;

        if (currentVigor < GAME_CONSTANTS.VIGOR.MAX) {
            const oldStatus = GAME_CONSTANTS.VIGOR.getStatus(currentVigor, this.player.stats);
            
            this.player.validateVigor();
            this.player.vigor = GAME_CONSTANTS.VIGOR.MAX;
            this.player.validateVigor();

            const newStatus = GAME_CONSTANTS.VIGOR.getStatus(this.player.vigor, this.player.stats);

            if (oldStatus.name !== newStatus.name) {
                this.logger.add(`Your vigor has been restored to ${newStatus.name.toLowerCase()} level.`, "playerInfo");
                this.playSound('vigorUpSound');
            }
        }
    }

    processNormalFloorVigor() {
        this.player.validateVigor();

        const oldStatus = GAME_CONSTANTS.VIGOR.getStatus(this.player.vigor, this.player.stats);
        
        const currentRoom = this.getCurrentRoom();
        const dangerLevel = currentRoom ? currentRoom.dangerLevel : 'NORMAL';
        
        const decreaseChance = GAME_CONSTANTS.VIGOR.calculateDecreaseChance(this.turn, dangerLevel);
        const roll = Math.floor(Math.random() * 100);

        if (roll < decreaseChance) {
            const healthStatus = GAME_CONSTANTS.HEALTH_STATUS.getStatus(
                this.player.hp,
                this.player.maxHp,
                this.player.stats
            );
            
            const decrease = GAME_CONSTANTS.VIGOR.calculateDecreaseAmount(
                this.player.vigor, 
                this.player.stats,
                healthStatus
            );
            
            const oldVigor = this.player.vigor;
            this.player.vigor = Math.max(0, this.player.vigor - decrease);
            this.player.validateVigor();

            const newStatus = GAME_CONSTANTS.VIGOR.getStatus(this.player.vigor, this.player.stats);
            const vigorChange = this.player.vigor - oldVigor;

            if (oldStatus.name !== newStatus.name) {
                if (vigorChange < 0) {
                    this.logger.add(`Your vigor has decreased to ${newStatus.name.toLowerCase()} level.`, "warning");
                    this.playSound('vigorDownSound');
                } else if (vigorChange > 0) {
                    this.logger.add(`Your vigor has increased to ${newStatus.name.toLowerCase()} level.`, "playerInfo");
                    this.playSound('vigorUpSound');
                }
            }
        }
    }

    processMonsterTurn() {
        // モンスターの行動
        this.monsters.forEach(monster => {
            if (!monster.hasActedThisTurn) {
                monster.act(this);
            }
        });

        // 生存しているモンスターのみを対象とする
        this.monsters = this.monsters.filter(monster => monster.hp > 0);

        // モンスターの行動フラグをリセット
        for (const monster of this.monsters) {
            monster.hasActedThisTurn = false;
        }

        // プレイヤーの知覚チェック
        if (this.player.hp > 0) {
            this.player.checkPerception(this);
        }
    }

    processNaturalHealing() {
        // プレイヤーの自然回復
        if (this.player.hp > 0 && !this.hasAdjacentMonsters(this.player.x, this.player.y)) {
            this.processPlayerNaturalHealing();
        }

        // モンスターの自然回復
        if ((this.player.lastAction === 'wait' || this.player.lastAction === 'move')) {
            this.processMonsterNaturalHealing();
        }
    }

    // 指定座標に隣接するモンスターがいるかチェックする関数を追加
    hasAdjacentMonsters(x, y) {
        const directions = [
            {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
            {dx: -1, dy: 0},                    {dx: 1, dy: 0},
            {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
        ];

        for (const dir of directions) {
            const checkX = x + dir.dx;
            const checkY = y + dir.dy;
            if (this.getMonsterAt(checkX, checkY)) {
                return true;
            }
        }
        return false;
    }

    processPlayerNaturalHealing() {
        const vigorStatus = GAME_CONSTANTS.VIGOR.getStatus(this.player.vigor, this.player.stats);
        if (vigorStatus.name !== 'Exhausted' && this.player.hp < this.player.maxHp) {
            const successChance = GAME_CONSTANTS.FORMULAS.NATURAL_HEALING.getSuccessChance(this.player.stats);
            const roll = Math.random() * 100;

            if (roll < successChance) {
                const healingDice = GAME_CONSTANTS.FORMULAS.HEALING_DICE(this.player.stats);
                const healModifier = GAME_CONSTANTS.FORMULAS.HEAL_MODIFIER(this.player.stats);
                const healResult = GAME_CONSTANTS.FORMULAS.NATURAL_HEALING.calculateHeal(healingDice, healModifier);
                const actualHeal = GAME_CONSTANTS.FORMULAS.NATURAL_HEALING.applyHeal(this.player, healResult.amount);

                if (actualHeal > 0) {
                    this.logger.add(
                        `Natural healing: [${healResult.rolls.join(',')}]+${healModifier} > +${actualHeal} HP`,
                        "heal"
                    );
                }
            }
        }
    }

    processMonsterNaturalHealing() {
        for (const monster of this.monsters) {
            if (monster.hp < monster.maxHp) {
                // プレイヤーが隣接していない場合のみ回復
                if (!this.hasAdjacentMonsters(monster.x, monster.y) && 
                    !this.isPlayerAdjacent(monster.x, monster.y)) {
                    const successChance = GAME_CONSTANTS.FORMULAS.NATURAL_HEALING.getSuccessChance(monster.stats);
                    const roll = Math.random() * 100;

                    if (roll < successChance) {
                        const healingDice = GAME_CONSTANTS.FORMULAS.HEALING_DICE(monster.stats);
                        const healModifier = GAME_CONSTANTS.FORMULAS.HEAL_MODIFIER(monster.stats);
                        const healResult = GAME_CONSTANTS.FORMULAS.NATURAL_HEALING.calculateHeal(healingDice, healModifier);
                        const actualHeal = GAME_CONSTANTS.FORMULAS.NATURAL_HEALING.applyHeal(monster, healResult.amount);

                        if (monster.hp > monster.maxHp) {
                            monster.hp = monster.maxHp;
                        }
                    }

                    if (monster.hasStartedFleeing && (monster.hp / monster.maxHp) > monster.fleeThreshold) {
                        monster.hasStartedFleeing = false;
                    }
                }
            }
        }
    }

    // プレイヤーが指定座標に隣接しているかチェックする関数を追加
    isPlayerAdjacent(x, y) {
        return Math.abs(this.player.x - x) <= 1 && Math.abs(this.player.y - y) <= 1;
    }

    processEndTurnUpdates() {
        this.updateExplored();
        this.updateRoomInfo();
        // サイケデリックエフェクトの値を減少させる
        this.renderer.psychedelicTurn = Math.max(0, this.renderer.psychedelicTurn - 1);
        this.renderer.updateFlickerValues();  // フリッカー効果の更新を追加
        this.updateWebs();
        this.renderer.render();
        this.saveGame();

        if (this.inputHandler.examineTarget) {
            const target = this.inputHandler.examineTarget;
            this.logger.updateLookInfo(target.x, target.y);
        }

        if (this.floorLevel === 0) {
            this.updateHomeFloorStatus();
        }
    }

    // ホームフロアでのプレイヤーステータス更新のみを行うメソッド
    updateHomeFloorStatus() {
        // ホームフロアでのみ実行
        if (this.floorLevel !== 0) return;

        // HPを全回復
        if (this.player.hp < this.player.maxHp) {
            const healAmount = this.player.maxHp - this.player.hp;
            this.player.hp = this.player.maxHp;
        }

        // Vigorを全回復
        if (this.player.vigor < GAME_CONSTANTS.VIGOR.MAX) {
            this.player.vigor = GAME_CONSTANTS.VIGOR.MAX;
            this.player.validateVigor();  // Add validation after setting vigor
        }

        // スキルのクールダウンをリセット
        if (this.player.skills) {
            for (const skill of this.player.skills.values()) {
                skill.remainingCooldown = 0;
            }
        }

        // キャラクター作成モード中は宇宙空間のタイルを更新しない
        if (this.inputHandler && (this.inputHandler.mode === 'characterCreation' || this.inputHandler.mode === 'name')) {
            return;
        }

        // サイバー風の壁タイルをGAME_CONSTANTSから使用
        const cyberWallTiles = GAME_CONSTANTS.TILES.CYBER_WALL;

        // 毎ターン床タイルと壁タイルをランダムに変更
        const centerRoom = this.rooms[0];  // ホームフロアは1つの部屋のみ

        // 初回のみ宇宙空間を生成するためのフラグ
        const isFirstUpdate = !this.lastHomeFloorUpdate;

        for (let y = 0; y < GAME_CONSTANTS.DIMENSIONS.HEIGHT; y++) {
            for (let x = 0; x < this.width; x++) {
                // 階段タイルはスキップ
                if (this.tiles[y][x] === GAME_CONSTANTS.STAIRS.CHAR) {
                    continue;
                }

                // 部屋の外側の宇宙空間
                if (x < centerRoom.x - 1 || x >= centerRoom.x + centerRoom.width + 1 ||
                    y < centerRoom.y - 1 || y >= centerRoom.y + centerRoom.height + 1) {
                    this.map[y][x] = 'space';
                    
                    // 宇宙空間のアニメーションを停止するため、初回のみタイルと色を設定
                    if (isFirstUpdate || !this.map[y][x] || this.map[y][x] !== 'space') {
                        this.tiles[y][x] = GAME_CONSTANTS.TILES.SPACE[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE.length)
                        ];
                        this.colors[y][x] = GAME_CONSTANTS.TILES.SPACE_COLORS[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE_COLORS.length)
                        ];
                    }
                } else {
                    // 部屋の中のタイルを更新
                    if (this.map[y][x] === 'wall') {
                        this.tiles[y][x] = cyberWallTiles[
                            Math.floor(Math.random() * cyberWallTiles.length)
                        ];
                    } else if (this.map[y][x] === 'floor') {
                        this.tiles[y][x] = Math.random() < 0.5 ? '0' : '1';
                    }
                }
            }
        }
        this.lastHomeFloorUpdate = this.turn;
    }

    processMonsterDeath(deathInfo) {
        const { monster, result, damageResult, context } = deathInfo;

        // 機会攻撃とキルのログを1行にまとめる
        const attackDesc = context.isOpportunityAttack ? "Opportunity attack" : context.attackType;
        const criticalText = context.isCritical ? " [CRITICAL HIT!]" : "";
        const damageCalc = `(ATK: ${damageResult.totalAttack - damageResult.attackRolls.reduce((sum, roll) => sum + roll, 0)}+[${damageResult.attackRolls.join(',')}]` +
            `${context.damageMultiplier !== 1 ? ` ×${context.damageMultiplier.toFixed(1)}` : ''} ` +
            `${context.isCritical ? '[DEF IGNORED]' : `vs DEF: ${monster.defense.base}+[${damageResult.defenseRolls.join(',')}]`})`;

        // クリティカルヒットの場合でも必ずkillクラスを含める
        const messageClass = context.isCritical ? "playerCrit kill" : "kill";

        this.logger.add(
            `${attackDesc}${criticalText} kills ${monster.name} with ${result.damage} damage! ${damageCalc}`,
            messageClass
        );

        // クリティカルヒット時のエフェクトを表示
        if (context.isCritical) {
            this.renderer.showCritEffect(monster.x, monster.y);
        }

        // モンスターを削除し、死亡エフェクトを表示
        this.removeMonster(monster);
        this.renderer.showDeathEffect(monster.x, monster.y);

        // lookパネルを更新
        this.logger.clearLookInfo();

        // 新規: モンスターを倒した時の効果音を再生
        this.playSound('killMonsterSound');

        // 経験値の計算
        const levelDiff = monster.level - this.player.level;
        const baseXP = Math.floor(monster.baseXP || monster.level);
        const levelMultiplier = levelDiff > 0
            ? 1 + (levelDiff * 0.2)
            : Math.max(0.1, 1 + (levelDiff * 0.1));
        const intBonus = 1 + Math.max(0, (this.player.stats.int - 10) * 0.03);
        const xpGained = Math.max(1, Math.floor(baseXP * levelMultiplier * intBonus));

        // Vigor変動の計算（より安全な実装）
        const wisBonus = Math.max(0, this.player.stats.wis || 0);  // 負の値とundefinedを防ぐ
        const maxRoll = Math.max(1, this.player.level + wisBonus);
        const roll = Math.floor(Math.random() * maxRoll) + 1;

        // Vigor変動量の計算を安全に実装
        let vigorChange = 0;
        const oldVigor = Number.isFinite(this.player.vigor) ? 
            this.player.vigor : 
            GAME_CONSTANTS.VIGOR.MAX;

        if (roll <= this.player.level) {
            // 失敗：Vigor減少（より安全な計算）
            const wisValue = Math.max(0, this.player.stats.wis || 0);
            vigorChange = -Math.max(1, Math.floor(wisValue / 3));
        } else {
            // 成功：Vigor回復（より安全な計算）
            const baseRecovery = Math.max(1, Math.floor((monster.level || 1) / 2));
            const maxRecovery = Math.max(0, GAME_CONSTANTS.VIGOR.MAX - oldVigor);
            vigorChange = Math.min(baseRecovery, maxRecovery);
        }

        // Vigor値の更新（より安全な実装）
        const newVigor = Math.max(0, Math.min(GAME_CONSTANTS.VIGOR.MAX, oldVigor + vigorChange));
        this.player.vigor = newVigor;
        this.player.validateVigor();  // Add validation after changing vigor

        // 状態変化の確認と通知
        const oldStatus = GAME_CONSTANTS.VIGOR.getStatus(oldVigor, this.player.stats);
        const newStatus = GAME_CONSTANTS.VIGOR.getStatus(newVigor, this.player.stats);

        if (vigorChange !== 0) {
            // 自動移動を停止
            this.player.stopAllAutoMovement();

            // Vigor変動のログ出力を修正
            const changeDesc = vigorChange > 0 ? "restores" : "depletes";
            // Vigor増減の言葉遣いを精神的な意味合いも込めて変更
            const vigorVerb = vigorChange > 0 ? "is invigorated" : "is drained";
            this.logger.add(
                `Combat ${changeDesc} your vigor. Your spirit ${vigorVerb}.`,
                vigorChange > 0 ? "playerInfo" : "warning"
            );

            // 状態が変化した場合は追加のメッセージ（既存のまま）
            if (oldStatus.name !== newStatus.name) {
                this.logger.add(
                    `Your vigor state changed to ${newStatus.name.toLowerCase()}.`,
                    "warning"
                );
                // Vigor状態変化時に効果音を再生
                if (vigorChange > 0) {
                    this.playSound('vigorUpSound');
                } else {
                    this.playSound('vigorDownSound');
                }
            }
        }

        // 経験値とCodexポイントの獲得ログ
        let rewardText = `Gained ${xpGained} XP!`;
       
        this.logger.add(rewardText, "playerInfo");

        // 経験値とCodexポイントの付与
        this.player.addExperience(xpGained);
        

        if (deathInfo.killedByPlayer) {
            this.monsterKillCount++;  // プレイヤーが倒した場合のみカウント
        }
    }

    // メディテーション処理を分離
    processMeditation() {
        if (!this.player.meditation || !this.player.meditation.active) return;

        // 瞑想開始時にループ再生を開始（初回のみ）
        if (!this.player.meditation.soundStarted && !this.player.meditation.skipSound) {
            this.soundManager.playSound('meditationSound', { loop: true });
            this.player.meditation.soundStarted = true;
        }

        // 1ターンごとの回復処理
        const healAmount = this.player.meditation.healPerTurn;

        // HP回復処理
        const actualHeal = Math.min(healAmount, this.player.maxHp - this.player.hp);
        this.player.hp += actualHeal;
        this.player.meditation.totalHealed += actualHeal;
        // HP回復のログを追加（colorをhealに変更）
        if (actualHeal > 0) {
            this.logger.add(`Meditation heals you for ${actualHeal} HP.`, "heal");
        }

        // Vigor変動処理
        const maxRoll = Math.max(1, this.player.level + this.player.stats.wis);  // 最小値を1に
        const roll = Math.floor(Math.random() * maxRoll) + 1;

        let vigorChange = 0;  // 初期値を設定
        if (roll <= this.player.level) {
            // 失敗：Vigorが減少（最小値を-1に）
            vigorChange = -Math.max(1, Math.floor(Math.random() * this.player.stats.wis));
        } else {
            // 成功：Vigor回復
            const maxRecovery = Math.max(0, GAME_CONSTANTS.VIGOR.MAX - this.player.vigor);
            vigorChange = Math.min(roll, maxRecovery);
        }

        // Vigor値の更新と状態変化チェック
        if (vigorChange !== 0) {
            // 自動移動を停止
            this.player.stopAllAutoMovement();

            const oldStatus = GAME_CONSTANTS.VIGOR.getStatus(this.player.vigor, this.player.stats);
            this.player.vigor = Math.max(0, Math.min(GAME_CONSTANTS.VIGOR.MAX, this.player.vigor + vigorChange));
            this.player.validateVigor();  // Add validation after changing vigor
            const newStatus = GAME_CONSTANTS.VIGOR.getStatus(this.player.vigor, this.player.stats);

            // 状態が変化した場合のみログ表示
            if (oldStatus.name !== newStatus.name) {
                this.logger.add(`Your vigor has ${vigorChange < 0 ? 'decreased' : 'increased'} to ${newStatus.name.toLowerCase()} level.`, "warning");
                // Vigor状態変化時に効果音を再生
                if (vigorChange > 0) {
                    this.playSound('vigorUpSound');
                } else {
                    this.playSound('vigorDownSound');
                }
            }
        }

        // Vigor回復のログ出力を修正
        // Vigor増減の言葉遣いを精神的な意味合いも込めて変更
        const vigorVerb = vigorChange > 0 ? "is invigorated" : "is drained";
        if (vigorChange > 0) {
            this.logger.add(`Meditation successful. Your spirit ${vigorVerb}.`, "playerInfo");
        } else if (vigorChange < 0) {
            this.logger.add(`Meditation failed. Your spirit ${vigorVerb}.`, "warning");
        }

        this.player.meditation.turnsRemaining--;

        // 瞑想中はサイケデリックエフェクトを維持
        if (!this.player.meditation.vigorEffectMeditation) {
            // vigor効果による瞑想でない場合のみ、サイケデリックエフェクトを維持
            this.renderer.psychedelicTurn = Math.max(this.renderer.psychedelicTurn, 3);
        }

        // 瞑想終了条件のチェック
        if ((this.player.hp >= this.player.maxHp && this.player.vigor >= GAME_CONSTANTS.VIGOR.MAX) ||
            this.player.meditation.turnsRemaining <= 0) {
            let endMessage;
            if (this.player.meditation.turnsRemaining <= 0) {
                endMessage = `Meditation complete. (Total healed: ${this.player.meditation.totalHealed} HP)`;
            } else {
                endMessage = "You feel fully restored!";
            }

            this.logger.add(endMessage, "playerInfo");
            
            // 瞑想終了時に効果音を停止（skipSoundフラグがない場合のみ）
            if (!this.player.meditation.skipSound && this.player.meditation.soundStarted) {
                this.soundManager.stopSound('meditationSound');
            }
            
            // vigorエフェクトによる瞑想の場合は特別なメッセージを表示
            if (this.player.meditation.vigorEffectMeditation) {
                this.logger.add("The strange sensation passes.", "playerInfo");
            }

            this.player.meditation = null;
        }

        // サイケデリックエフェクトのターンカウンターを更新
        // this.renderer.psychedelicTurn++;
        this.renderer.render();
    }

    toggleMode() {
        if (this.mode === GAME_CONSTANTS.MODES.GAME) {
            // this.mode = GAME_CONSTANTS.MODES.CODEX; // CODEX モードへの切り替えを削除
            // document.body.classList.add('codex-mode');
            // this.renderer.renderCodexMenu();
            // 何もしない
        } else if (this.mode === GAME_CONSTANTS.MODES.HELP) {
            this.mode = GAME_CONSTANTS.MODES.GAME;
            document.body.classList.remove('help-mode');
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
        const baseCount = Math.floor(10 + this.floorLevel * 1.5);
        const monsterCount = Math.max(6, baseCount + dangerData.levelModifier);

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
                    this.tiles[y][x] !== GAME_CONSTANTS.STAIRS.CHAR && //階段
                    !GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[y][x]) && //障害物
                    !GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(this.tiles[y][x]) && //透明な障害物
                    this.tiles[y][x] !== GAME_CONSTANTS.PORTAL.VOID.CHAR;  // VOIDポータルを避ける

                const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(x, y, this.player.x, this.player.y);

                if (isValidSpawn && distance >= GAME_CONSTANTS.ROOM.SAFE_RADIUS) {

                    monster = Monster.spawnRandomMonster(x, y, this.floorLevel, this.dangerLevel, this);
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
                                const packDistance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(packX, packY, this.player.x, this.player.y);

                                const isValidPackSpawn = this.isValidPosition(packX, packY) &&
                                    this.map[packY][packX] === 'floor' &&
                                    !this.getMonsterAt(packX, packY) &&
                                    this.tiles[packY][packX] !== GAME_CONSTANTS.TILES.DOOR.CLOSED &&
                                    this.tiles[packY][packX] !== GAME_CONSTANTS.STAIRS.CHAR &&
                                    !GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.tiles[packY][packX]) &&
                                    !GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(this.tiles[packY][packX]) &&
                                    this.tiles[packY][packX] !== GAME_CONSTANTS.PORTAL.VOID.CHAR &&  // VOIDポータルを避ける
                                    packDistance >= GAME_CONSTANTS.ROOM.SAFE_RADIUS;

                                if (isValidPackSpawn) {
                                    const packMember = new Monster(monster.type, packX, packY, this);
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

        // モンスター生成後に知覚チェックを実行
        if (this.monsters.length > 0) {
            this.player.checkPerception(this);
        }
    }

    gameOver() {
        // セーブデータを削除
        localStorage.removeItem('complexRL_saveData');

        // Calculate final score.
        const totalXP = this.player.xp;
        const finalScore = {
            turns: this.totalTurns,  // 全体のターン数を使用
            totalScore: Math.floor((totalXP * 1.5) / Math.max(1, this.totalTurns * 0.01))  // 全体のターン数を使用
        };

        // 死因が設定されていない場合は、最後の戦闘情報から推測
        if (!this.player.deathCause) {
            if (this.lastCombatMonster) {
                this.player.deathCause = `Slain by ${this.lastCombatMonster.name}`;
            } else if (this.player.hp <= 0) {
                this.player.deathCause = 'Unknown cause';
            }
        }

        // ハイスコアを保存
        this.saveHighScore(finalScore);

        // Render the final state.
        this.renderer.render();

        // Set game over state.
        this.isGameOver = true;
        this.mode = GAME_CONSTANTS.MODES.GAME_OVER;

        // Display game over message via Logger.
        this.logger.showGameOverMessage(finalScore);

        // ゲームオーバー時にフェードアウト
        if (!this.soundManager.homeBGM.paused) {
            this.soundManager.fadeOutBGM(2000);  // ゲームオーバー時は2秒かけてフェードアウト
        }
    }

    generateNewFloor() {
        // プレイヤーが死亡している場合は新しいフロアを生成しない
        if (this.player.hp <= 0 || this.isGameOver) {
            return;
        }

        // ポータルサウンドをフェードアウト
        this.soundManager.fadeOutPortalSound();

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
            GAME_CONSTANTS.DIMENSIONS.WIDTH,
            GAME_CONSTANTS.DIMENSIONS.HEIGHT,
            this.floorLevel,
            this
        );
        const mapData = mapGenerator.generate();
        
        this.map = mapData.map;
        this.tiles = mapData.tiles;
        this.colors = mapData.colors;
        this.rooms = mapData.rooms;
        
        // ニューラルオベリスク情報を Game クラスに保存
        this.neuralObelisks = mapGenerator.neuralObelisks || [];
        
        // デバッグログ
        if (this.neuralObelisks.length > 0) {
            //console.log('Neural Obelisks saved to Game:', this.neuralObelisks);
        }
        
        // 高さと幅を定数から再設定して一貫性を保つ
        this.width = GAME_CONSTANTS.DIMENSIONS.WIDTH;
        this.height = GAME_CONSTANTS.DIMENSIONS.HEIGHT;

        this.monsters = [];
        this.totalMonstersSpawned = 0;
        this.explored = this.initializeExplored();
        this.turn = 0;  // フロアごとのターン数をリセット
        
        // 蜘蛛の巣情報をリセット
        this.webs = [];
        
        // マップ生成時に設置された蜘蛛の巣をゲームオブジェクトに追加
        if (mapGenerator.initialWebs && mapGenerator.initialWebs.length > 0) {
            //console.log(`マップ生成時に ${mapGenerator.initialWebs.length} 個の蜘蛛の巣を配置しました。`);
            
            // 初期化されていなければ初期化
            if (!this.webs) {
                this.webs = [];
            }
            
            // マップ生成時の蜘蛛の巣を追加
            this.webs.push(...mapGenerator.initialWebs);
        } else {
            //console.warn('マップ生成時に蜘蛛の巣が生成されませんでした');
        }
        
        // Home Floorモードのために、階段の位置を記録
        if (this.homeFloorData) {
            this.homeFloorData.stairsPos = this.findStairsPosition();
        }

        // プレイヤーを配置
        this.placePlayerInRoom();
        this.player.autoExploring = false;
        
        // モンスターの初期配置
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

        // 描画とログの更新
        this.renderer.render();
        this.logger.renderLookPanel();  // Display look panel
        this.logger.updateFloorInfo(this.floorLevel, this.dangerLevel);  // Update floor info in Logger
        this.updateRoomInfo();  // Update surrounding room information
        this.updateExplored();  // Update explored information

        // フロア生成後に描画が完了してからセーブを実行
        requestAnimationFrame(() => this.saveGame());
    }

    setInputMode(mode, options = {}) {
        this.inputHandler.setMode(mode, options);
    }

    // Mark tiles within the player's visible range as explored.
    updateExplored() {
        const visibleTiles = this.visionSystem.getVisibleTiles();
        visibleTiles.forEach(({ x, y }) => {
            this.explored[y][x] = true;

            // examineTargetが存在し、その座標が可視範囲内なら情報を更新
            if (this.inputHandler.examineTarget && 
                this.inputHandler.examineTarget.x === x && 
                this.inputHandler.examineTarget.y === y) {
                this.logger.updateLookInfo(x, y);
            }
        });
    }

    // getVisibleTilesメソッドを追加
    getVisibleTiles() {
        return this.visionSystem.getVisibleTiles();
    }

    // getLinePointsメソッドを追加
    getLinePoints(x1, y1, x2, y2) {
        return this.visionSystem.getLinePoints(x1, y1, x2, y2);
    }

    // hasLineOfSightメソッドを追加
    hasLineOfSight(x1, y1, x2, y2) {
        return this.visionSystem.hasLineOfSight(x1, y1, x2, y2);
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

        // ポータルとvoidポータルの検出を追加
        let hasPortal = false;
        let hasVoidPortal = false;
        let isNexus = this.floorLevel === 0;  // レベル0（ネクサス）かどうか

        // プレイヤーの周囲2マス以内のポータルをチェック
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const checkX = px + dx;
                const checkY = py + dy;
                
                if (this.isValidPosition(checkX, checkY)) {
                    if (this.tiles[checkY][checkX] === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                        hasPortal = true;
                    } else if (this.tiles[checkY][checkX] === GAME_CONSTANTS.PORTAL.VOID.CHAR) {
                        hasVoidPortal = true;
                    }
                }
            }
        }

        // モンスターのカウント（既存のコード）
        let monsterCount;
        if (currentRoom) {
            monsterCount = this.monsters.filter(monster =>
                monster.x >= currentRoom.x &&
                monster.x < currentRoom.x + currentRoom.width &&
                monster.y >= currentRoom.y &&
                monster.y < currentRoom.y + currentRoom.height
            ).length;
        } else {
            monsterCount = this.monsters.filter(monster => {
                const distance = GAME_CONSTANTS.DISTANCE.calculateChebyshev(monster.x, monster.y, px, py);
                return distance <= 2.5;
            }).length;
        }

        // 部屋情報にポータルの存在を追加
        const roomInfo = currentRoom ? {
            ...currentRoom,
            hasPortal,
            hasVoidPortal,
            isNexus
        } : {
            hasPortal,
            hasVoidPortal,
            isNexus
        };

        this.logger.updateRoomInfo(roomInfo, monsterCount);
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
        this.saveSystem.saveGame();
    }

    // セーブデータを読み込む
    loadGame() {
        this.saveSystem.loadGame();
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

    updateHomeFloor() {
        // ホームフロアでのみ実行
        if (this.floorLevel !== 0) return;

        // HPを全回復
        if (this.player.hp < this.player.maxHp) {
            const healAmount = this.player.maxHp - this.player.hp;
            this.player.hp = this.player.maxHp;
        }

        // Vigorを全回復
        if (this.player.vigor < GAME_CONSTANTS.VIGOR.MAX) {
            this.player.vigor = GAME_CONSTANTS.VIGOR.MAX;
            this.player.validateVigor();  // Add validation after setting vigor
        }

        // スキルのクールダウンをリセット
        if (this.player.skills) {
            for (const skill of this.player.skills.values()) {
                skill.remainingCooldown = 0;
            }
        }

        // キャラクター作成モード中は宇宙空間のタイルを更新しない
        if (this.inputHandler && (this.inputHandler.mode === 'characterCreation' || this.inputHandler.mode === 'name')) {
            return;
        }

        // サイバー風の壁タイルをGAME_CONSTANTSから使用
        const cyberWallTiles = GAME_CONSTANTS.TILES.CYBER_WALL;

        // 毎ターン床タイルと壁タイルをランダムに変更
        const centerRoom = this.rooms[0];  // ホームフロアは1つの部屋のみ

        // 初回のみ宇宙空間を生成するためのフラグ
        const isFirstUpdate = !this.lastHomeFloorUpdate;

        for (let y = 0; y < GAME_CONSTANTS.DIMENSIONS.HEIGHT; y++) {
            for (let x = 0; x < this.width; x++) {
                // 階段タイルはスキップ
                if (this.tiles[y][x] === GAME_CONSTANTS.STAIRS.CHAR) {
                    continue;
                }

                // 部屋の外側の宇宙空間
                if (x < centerRoom.x - 1 || x >= centerRoom.x + centerRoom.width + 1 ||
                    y < centerRoom.y - 1 || y >= centerRoom.y + centerRoom.height + 1) {
                    this.map[y][x] = 'space';
                    
                    // 宇宙空間のアニメーションを停止するため、初回のみタイルと色を設定
                    if (isFirstUpdate || !this.map[y][x] || this.map[y][x] !== 'space') {
                        this.tiles[y][x] = GAME_CONSTANTS.TILES.SPACE[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE.length)
                        ];
                        this.colors[y][x] = GAME_CONSTANTS.TILES.SPACE_COLORS[
                            Math.floor(Math.random() * GAME_CONSTANTS.TILES.SPACE_COLORS.length)
                        ];
                    }
                } else {
                    // 部屋の中のタイルを更新
                    if (this.map[y][x] === 'wall') {
                        this.tiles[y][x] = cyberWallTiles[
                            Math.floor(Math.random() * cyberWallTiles.length)
                        ];
                    } else if (this.map[y][x] === 'floor') {
                        this.tiles[y][x] = Math.random() < 0.5 ? '0' : '1';
                    }
                }
            }
        }
        this.lastHomeFloorUpdate = this.turn;
    }

    playSound(audioName) {  // 引数を変更
        this.soundManager.playSound(audioName);  // SoundManagerのplaySoundを呼び出す
    }

    stopSound(audioName) {
        this.soundManager.stopSound(audioName);
    }

    // 新規: Vigorペナルティの処理メソッド
    processVigorPenalty(vigorStatus) {
        // Highの場合は処理をスキップ
        if (vigorStatus.name === 'High') return;

        // 状態に応じた確率設定
        let threshold;
        let severity;

        //console.log('=== Vigor Penalty Roll ===');
        //console.log(`Current Vigor Status: ${vigorStatus.name}`);

        switch (vigorStatus.name) {
            case 'Exhausted': 
                // 1d20で判定、1で発動（5%） - 確率を10%から5%に下げる
                threshold = Math.floor(Math.random() * 20) + 1;
                //console.log(`Exhausted Roll: ${threshold}/20 (needs 1 to trigger)`);
                if (threshold === 1) {
                    severity = 'Exhausted';  // 直接文字列を使用
                    
                    // 知力値に基づいたダメージを計算
                    const wisRoll = Math.floor(Math.random() * this.player.stats.wis) + 1;
                    const exhaustionDamage = wisRoll;
                    
                    // プレイヤーにダメージを与える
                    this.player.hp = Math.max(0, this.player.hp - exhaustionDamage);
                    this.soundManager.playSound('takeDamageSound');
                    this.renderer.flashStatusPanel();
                    
                    // ダメージのログを表示
                    this.logger.add(`You take ${exhaustionDamage} damage from exhaustion!`, "warning");
                    
                    // 死亡判定
                    if (this.player.hp <= 0) {
                        this.soundManager.playSound('playerDeathSound');
                        this.logger.add("You succumb to exhaustion...", "important");
                        this.player.deathCause = "Died from exhaustion";  // 死因を設定
                        this.gameOver();
                        return; // 死亡した場合は処理を終了
                    }
                }
                break;
            case 'Critical':
                // 1d50で判定、1で発動（2%） - 確率を5%から2%に下げる
                threshold = Math.floor(Math.random() * 50) + 1;
                //console.log(`Critical Roll: ${threshold}/50 (needs 1 to trigger)`);
                if (threshold === 1) {
                    // 良い効果の可能性を排除
                    severity = 'Critical';
                }
                break;

            case 'Low':
                // 1d50で判定、1で発動（2%） - 確率を5%から2%に下げる
                threshold = Math.floor(Math.random() * 50) + 1;
                //console.log(`Low Roll: ${threshold}/50 (needs 1 to trigger)`);
                if (threshold === 1) {
                    // 良い効果の可能性を排除
                    severity = 'Low';
                }
                break;

            case 'Moderate':
                // 1d200で判定、1で発動（0.5%） - 確率を2%から0.5%に下げる
                threshold = Math.floor(Math.random() * 200) + 1;
                //console.log(`Moderate Roll: ${threshold}/200 (needs 1 to trigger)`);
                if (threshold === 1) {
                    // 良い効果の可能性を排除
                    severity = 'Moderate';
                }
                break;
        }

        // 効果の適用
        if (severity) {
            // グローバルオブジェクトから VigorEffects を参照
            const effect = VigorEffects.getVigorPenaltyEffect(severity, vigorStatus.name);
            if (!effect) {
                //console.log(`No effect applied for severity: ${severity}, vigorStatus: ${vigorStatus.name}`);
                return;
            }
            //console.log(`Selected Severity: ${severity}`);
            //console.log(`Selected Effect Type: ${effect.type}`);
            //console.log(`Effect Details:`, effect);
            const vigorEffects = new VigorEffects(this);
            vigorEffects.applyVigorEffect(effect);  // インスタンスメソッドとして呼び出し
            
            // エフェクトの描画をクリア
            if (effect.type === 'shortTeleport') {
                this.renderer.clearEffects();
            }
        } else {
            //console.log('No effect triggered');
        }
        //console.log('========================');
    }

    // 休憩を開始するメソッド
    startRest(mode, turns = 0) {
        if (this.player.hp <= 0 || this.player.resting?.active) return;
        
        // HPが最大値なら休憩する必要なし
        if (this.player.hp >= this.player.maxHp) {
            this.logger.add("You are already at full health", "playerInfo");
            return;
        }
        
        // 瞑想中は休憩できない
        if (this.player.meditation && this.player.meditation.active) {
            this.logger.add("You cannot rest while meditating", "warning");
            return;
        }
        
        // vigorがexhausted状態の場合は休憩できない
        const vigorStatus = GAME_CONSTANTS.VIGOR.getStatus(this.player.vigor, this.player.stats);
        if (vigorStatus.name === 'Exhausted') {
            this.logger.add("You are too exhausted to rest", "warning");
            return;
        }
        
        // 休憩状態を初期化
        this.player.resting = {
            active: true,
            mode: mode,
            turnsRemaining: turns,
            startHp: this.player.hp
        };
        
        const message = mode === 'turns' ? 
            `Resting for ${turns} turns...` : 
            "Resting until fully healed...";
        
        this.logger.add(message, "playerInfo");
        this.playSound('restStartSound'); // 効果音があれば
        
        // 休憩を継続（最初のターンを処理）
        this.continueRest();
    }

    // 休憩を継続するメソッド（自動探索と同様の仕組み）
    continueRest() {
        if (!this.player.resting?.active) return;
        
        // キャンセル条件チェック
        const cancelReason = this.checkRestCancelConditions();
        if (cancelReason) {
            this.cancelRest(cancelReason);
            return;
        }
        
        // 1ターン進める
        this.processTurn();
        
        // 継続条件をチェック
        if (this.player.resting?.active) {
            // 終了条件に達していなければ次のターンを遅延処理
            setTimeout(() => {
                if (this.player.resting?.active) {
                    this.continueRest();
                }
            }, 100); // 100msの遅延でターンを進行
        }
    }

    // 休憩を終了するメソッド
    endRest(reason) {
        if (!this.player.resting?.active) return;
        
        const healedAmount = this.player.hp - this.player.resting.startHp;
        this.logger.add(`${reason}. (Healed: ${healedAmount} HP)`, "playerInfo");
        
        this.player.resting = {
            active: false,
            mode: null,
            turnsRemaining: 0,
            startHp: 0
        };
        
        this.playSound('restEndSound'); // 効果音があれば
    }

    // 休憩をキャンセルするメソッド
    cancelRest(reason) {
        if (!this.player.resting?.active) return;
        
        const healedAmount = this.player.hp - this.player.resting.startHp;
        this.logger.add(`${reason}. Rest interrupted. (Healed: ${healedAmount} HP)`, "warning");
        
        this.player.resting = {
            active: false,
            mode: null,
            turnsRemaining: 0,
            startHp: 0
        };
        
        this.playSound('restCancelSound'); // 効果音があれば
    }
    
    // 休憩のキャンセル条件をチェックするメソッド
    checkRestCancelConditions() {
        // 敵の視認チェック
        const visibleMonsters = this.monsters.filter(monster => {
            // プレイヤーの視界内にいるモンスターを検出
            return this.hasLineOfSight(this.player.x, this.player.y, monster.x, monster.y) &&
                GAME_CONSTANTS.DISTANCE.calculateChebyshev(this.player.x, this.player.y, monster.x, monster.y) <= 
                this.player.perception.base;
        });
        
        if (visibleMonsters.length > 0) {
            return "You noticed an enemy";
        }
        
        // VigorEffectsが発生したかどうかのチェック
        if (this.vigorEffectOccurred) {
            this.vigorEffectOccurred = false; // リセット
            return "A strange sensation interrupted you";
        }
        
        return null;
    }

    // vigorエフェクト発生時の通知メソッド
    onVigorEffectOccurred() {
        this.vigorEffectOccurred = true;
        
        // 休憩中であればキャンセル
        if (this.player.resting?.active) {
            this.cancelRest("A strange sensation interrupted you");
        }
    }

    // Game クラスに追加するメソッド
    touchNeuralObelisk(x, y) {
        // ニューラルオベリスクの情報を取得
        const obelisk = this.neuralObelisks.find(o => o.x === x && o.y === y);
        
        let level = 3; // デフォルトはレベル3
        let colorName = "yellow";
        
        if (obelisk) {
            level = obelisk.level;
            
            // 色の名前を設定
            switch(level) {
                case 1: colorName = "blue"; break;
                case 2: colorName = "green"; break;
                case 3: colorName = "yellow"; break;
                case 4: colorName = "orange"; break;
                case 5: colorName = "purple"; break;
            }
        }
        
        this.logger.add(`You touch the ${colorName} Neural Obelisk (Level ${level})...`, "playerInfo");
        
        // 回復効果を適用
        this.healPlayerWithObelisk(level);
        
        // オベリスクを消去
        this.removeNeuralObelisk(x, y);
        
        // 効果音やエフェクトを再生
        this.soundManager.playSound('levelUpSound');
        this.renderer.showLightPillarEffect(x, y);
    }

    // 回復効果を適用するヘルパーメソッド
    healPlayerWithObelisk(level) {
        const healPercent = GAME_CONSTANTS.NEURAL_OBELISK.LEVELS[level].HEAL_PERCENT;
        
        // HP回復量を計算（最大HPの割合）
        const hpHealAmount = Math.floor(this.player.maxHp * (healPercent / 100));
        const oldHp = this.player.hp;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + hpHealAmount);
        const actualHpHealed = this.player.hp - oldHp;
        
        // Vigor回復量を計算（最大Vigorの割合）
        const vigorHealAmount = Math.floor(GAME_CONSTANTS.VIGOR.MAX * (healPercent / 100));
        const oldVigor = this.player.vigor;
        this.player.vigor = Math.min(GAME_CONSTANTS.VIGOR.MAX, this.player.vigor + vigorHealAmount);
        const actualVigorHealed = this.player.vigor - oldVigor;
        
        // 回復メッセージを表示
        let message = `You feel revitalized! Recovered ${actualHpHealed} HP`;
        if (actualVigorHealed > 0) {
            message += " and your vigor has increased";
        }
        message += ".";
        this.logger.add(message, "playerInfo");
        
        // ステータスパネルを更新
        this.renderer.renderStatus();
    }

    // オベリスクを消去するメソッド
    removeNeuralObelisk(x, y) {
        // マップデータを床に戻す
        this.map[y][x] = 'floor';
        this.tiles[y][x] = GAME_CONSTANTS.TILES.FLOOR[
            Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
        ];
        this.colors[y][x] = GAME_CONSTANTS.COLORS.FLOOR;
        
        // neuralObelisks 配列から削除
        this.neuralObelisks = this.neuralObelisks.filter(
            o => !(o.x === x && o.y === y)
        );
        
        // マップを再描画
        this.renderer.render();
    }

    // 蜘蛛の巣の更新処理
    updateWebs() {
        // 蜘蛛の巣は永続的に残るため、持続時間の減少処理を削除
        // 以前のコード:
        // this.webs = this.webs.filter(web => {
        //     web.duration--;
        //     return web.duration > 0;
        // });
    }

    // ハイスコアの保存
    saveHighScore(finalScore) {
        this.highScoreManager.saveHighScore(finalScore);
    }

    // ハイスコアの読み込み
    loadHighScores() {
        return this.highScoreManager.loadHighScores();
    }

    // ハイスコアのクリア
    clearHighScores() {
        this.highScoreManager.clearHighScores();
    }

    // ハイスコアの表示
    showHighScores() {
        this.highScoreManager.showHighScores();
    }
}

// Start the game.
const game = new Game();

