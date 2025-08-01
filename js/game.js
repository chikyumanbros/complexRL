class Game {
    constructor() {
        // Display setup
        this.width = GAME_CONSTANTS.DIMENSIONS.WIDTH;
        this.height = GAME_CONSTANTS.DIMENSIONS.HEIGHT;
        this.renderer = new Renderer(this);
        this.soundManager = new SoundManager(this);
        this.inputHandler = new InputHandler(this);
        this.highScoreManager = new HighScoreManager(this);
        this.visionSystem = new VisionSystem(this);
        this.saveSystem = new SaveSystem(this);  // 追加
        this.liquidSystem = new LiquidSystem(this); // 液体システムの追加
        this.gasSystem = new GasSystem(this); // ガスシステムの追加
        this.electricalFields = []; // 電気フィールドシステム

        // デバッグユーティリティの初期化
        this.debugUtils = new DebugUtils(this);

        // Game state
        this.player = new Player(0, 0, this);
        this.logger = new Logger(this);
        this.mode = GAME_CONSTANTS.MODES.GAME;
        this.turn = 0;
        this.totalTurns = 0;
        this.tiles = [];
        this.colors = [];
        this.monsters = [];
        this.totalMonstersSpawned = 0;
        this.maxTotalMonsters = 100;
        this.webs = [];  // 蜘蛛の巣の配列
        this.bloodpools = []; // 血痕の配列（後方互換性のために残す）
        this.neuralObelisks = []; // ニューラルオベリスクの配列
        this.explored = [];
        this.rooms = [];
        this.isGameOver = false;
        this.floorLevel = 0;
        this.dangerLevel = 'NORMAL';
        this.explored = this.initializeExplored();
        this.lastAttackLocation = null;
        this.hasDisplayedPresenceWarning = false;
        this.lastHomeFloorUpdate = 0;
        this.inputDisabled = false;
        this.pendingMonsterDeaths = [];

        this.init();

        // リセット後も確実にロガーの初期化を行う
        if (this.logger) {
            this.logger.clearRoomInfo();
        }

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
        // セーブデータを削除
        localStorage.removeItem('complexRL_saveData');
        
        // ゲームオーバー状態をリセット
        this.isGameOver = false;
        
        // ゲームモードをリセット
        this.mode = GAME_CONSTANTS.MODES.GAME;
        
        // 液体をリセット
        this.liquidSystem.reset();
        
        // ガスをリセット
        this.gasSystem.reset();
        
        // 血痕と蜘蛛の巣をクリア（後方互換性のために残す）
        this.bloodpools = [];
        this.webs = [];
        
        // ロガーの部屋情報をクリア
        if (this.logger) {
            this.logger.clearRoomInfo();
        }
        
        // ゲームを初期化
        this.init();
        
        // サウンドマネージャーをリセット
        this.soundManager.stopAllSounds();
        this.soundManager.userInteracted = true;
        this.soundManager.updateBGM();
        
        // レンダリングを更新
        this.renderer.render();
    }

    init() {
        // Initialize map-related properties
        this.map = [];
        this.tiles = [];
        this.colors = [];
        this.rooms = [];
        this.monsters = [];
        this.webs = [];       // 蜘蛛の巣の配列を空にする
        this.bloodpools = []; // 血痕の配列を空にする
        this.neuralObelisks = []; // ニューラルオベリスクの配列を空にする
        this.explored = this.initializeExplored();
        this.totalMonstersSpawned = 0;
        this.monstersKilled = 0;  // モンスター撃破数を追跡
        this.turn = 0;
        this.totalTurns = 0;  // ゲーム全体のターン数をリセット
        this.floorLevel = 0;

        // プレイヤーを初期化（ステータスは未割り振りの状態で）
        this.player = new Player(0, 0, this);
        // 初期ステータスをすべて8に設定
        Object.keys(this.player.stats).forEach(stat => {
            this.player.stats[stat] = 8;
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

        // ウェブ処理フラグをリセット - ターン開始時に必ず初期化する
        this.player._processedWebThisTurn = false;
        this.player._lastWebBreakResult = false;

        // プレイヤーのターン処理
        this.processPlayerTurn();

        // 隣接するモンスターがいるか確認し、いる場合は情報表示
        this.checkAdjacentMonsters();

        // モンスターのターン処理
        this.processMonsterTurn();

        // 自然回復の処理はスキップ（廃止）

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
        // ★★★ プレイヤーの状態効果減衰処理を追加 ★★★
        this.processPlayerStatusEffects();
        
        // 蜘蛛の巣処理
        if (this.player.caughtInWeb) {
            // 脱出を試みる - 成功/失敗の結果に関わらず処理済みとする
            this.player.tryToBreakFreeFromWeb();
            // 脱出に失敗した場合は、このメソッドで処理し、
            // 次にmoveメソッドが呼ばれた時に再処理されないようにする
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

    processMonsterTurn() {
        // モンスターの配列のコピーを作成（ループ中にモンスターが削除される可能性があるため）
        const monstersCopy = [...this.monsters];
        
        // 血液プールの位置を取得
        const bloodpools = this.liquidSystem.getLiquids('blood');
        
        // For each monster, take a turn
        for (const monster of monstersCopy) {
            // Skip dead monsters
            if (monster.hp <= 0) continue;
            
            // Process bleeding effects for organic monsters
            if (monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC)) {
                monster.processBleedingEffects(this);
                
                // Add bloodpool at the monster's location if it's bleeding
                if (monster.isBleeding()) {
                    this.addBloodpool(monster.x, monster.y, monster.getBleedingSeverity());
                }
            }
            
            // アンデッド系、昆虫系、爬虫類系モンスターの場合、近くの血に引き寄せられる
            if (monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.UNDEAD) || 
                monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC, MONSTER_CATEGORIES.SECONDARY.INSECTOID) ||
                monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC, MONSTER_CATEGORIES.SECONDARY.REPTILE)) {
                // 血液検出範囲を大幅に拡大（基本値20マス + 知覚値の影響）
                const baseDetectionRange = 20;
                const perceptionBonus = monster.perception || 0;
                const detectionRange = baseDetectionRange + Math.floor(perceptionBonus * 0.5);
                let nearestBlood = null;
                let nearestDistance = detectionRange + 1;
                
                for (const blood of bloodpools) {
                    const distance = Math.max(
                        Math.abs(monster.x - blood.x),
                        Math.abs(monster.y - blood.y)
                    );
                    
                    // 視界チェック（壁を通して血の匂いを感知しない）
                    const canSense = this.hasLineOfSight(monster.x, monster.y, blood.x, blood.y);
                    
                    // より近い血を見つけた場合、または血の重症度/量が多い場合は優先
                    if (distance <= detectionRange && canSense && 
                        (distance < nearestDistance || 
                         (distance === nearestDistance && blood.severity > (nearestBlood?.severity || 0)))) {
                        nearestBlood = blood;
                        nearestDistance = distance;
                    }
                }
                
                // 近くに血があり、モンスターがまだ行動していない場合
                if (nearestBlood && !monster.hasActedThisTurn) {
                    // 血の方向へ移動する傾向を設定
                    monster.attractedToBlood = {
                        x: nearestBlood.x,
                        y: nearestBlood.y,
                        severity: nearestBlood.severity,
                        distance: nearestDistance
                    };
                    
                    // 血が遠ければ遠いほど移動確率は減少するが、重症度が高いほど増加
                    const distanceFactor = 1 - (nearestDistance / (detectionRange * 1.5));
                    const severityFactor = nearestBlood.severity * 0.15;
                    let baseChance = 30;
                    
                    // モンスターの種類によって血への引き寄せられる確率を調整
                    if (monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC, MONSTER_CATEGORIES.SECONDARY.INSECTOID)) {
                        baseChance = 50; // 昆虫系はより強く引き寄せられる
                    } else if (monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC, MONSTER_CATEGORIES.SECONDARY.REPTILE)) {
                        baseChance = 40; // 爬虫類系も強めに引き寄せられる
                    }
                    
                    const moveChance = baseChance + (severityFactor * 100) + (distanceFactor * 40);
                    
                    // モンスターが近くのプレイヤーを見つけられない場合、または血の重症度が非常に高い場合
                    const isPlayerNearby = this.isPlayerAdjacent(monster.x, monster.y);
                    const isVeryAttractive = nearestBlood.severity >= 3 && nearestDistance <= 10;
                    
                    if (!isPlayerNearby || isVeryAttractive) {
                        if (Math.random() * 100 < moveChance) {
                            // 血への移動を計算
                            const dx = Math.sign(nearestBlood.x - monster.x);
                            const dy = Math.sign(nearestBlood.y - monster.y);
                            
                            // 移動先が有効か確認
                            if (this.isValidPosition(monster.x + dx, monster.y + dy) && 
                                !this.isOccupied(monster.x + dx, monster.y + dy)) {
                                
                                // より安全な移動チェックを使用
                                const newX = monster.x + dx;
                                const newY = monster.y + dy;
                                
                                if (monster.isValidMoveDestination && monster.isValidMoveDestination(newX, newY, this)) {
                                    monster.x = newX;
                                    monster.y = newY;
                                    monster.hasActedThisTurn = true;
                                    
                                    // プレイヤーの視界内にいる場合のみメッセージを表示
                                    const isVisibleToPlayer = this.getVisibleTiles()
                                        .some(tile => tile.x === monster.x && tile.y === monster.y);
                                    
                                    // プレイヤーの知覚可能範囲内にある血液の近くにいる場合のみメッセージを表示
                                    const isBloodInPlayerSight = this.getVisibleTiles()
                                        .some(tile => tile.x === nearestBlood.x && tile.y === nearestBlood.y);
                                        
                                    // プレイヤーまたは血液が視界内にある場合のみメッセージを表示
                                    if (isVisibleToPlayer && (isBloodInPlayerSight || nearestDistance <= 3)) {
                                        // 距離に応じたメッセージを表示
                                        // 昆虫系、爬虫類系、死者系で異なるメッセージを表示
                                        if (monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC, MONSTER_CATEGORIES.SECONDARY.INSECTOID)) {
                                            if (nearestDistance <= 5) {
                                                this.logger.add(`${monster.name} is aggressively drawn to the scent of blood!`, "monsterInfo");
                                            } else if (nearestDistance <= 15) {
                                                this.logger.add(`${monster.name} skitters toward the blood...`, "monsterInfo");
                                            } else {
                                                this.logger.add(`${monster.name} seems to have detected blood from afar...`, "monsterInfo");
                                            }
                                        } else if (monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC, MONSTER_CATEGORIES.SECONDARY.REPTILE)) {
                                            if (nearestDistance <= 5) {
                                                this.logger.add(`${monster.name} flicks its tongue, sensing the blood!`, "monsterInfo");
                                            } else if (nearestDistance <= 15) {
                                                this.logger.add(`${monster.name} slithers toward the blood...`, "monsterInfo");
                                            } else {
                                                this.logger.add(`${monster.name} tastes the air, detecting blood nearby...`, "monsterInfo");
                                            }
                                        } else { // アンデッド系の場合
                                            if (nearestDistance <= 5) {
                                                this.logger.add(`${monster.name} is strongly attracted to the scent of blood!`, "monsterInfo");
                                            } else if (nearestDistance <= 15) {
                                                this.logger.add(`${monster.name} moved, drawn by the scent of blood...`, "monsterInfo");
                                            } else {
                                                this.logger.add(`${monster.name} seems to have sensed the scent of blood from afar...`, "monsterInfo");
                                            }
                                        }
                                    }
                                }
                                // 移動に失敗した場合も通常のモンスター行動に進む
                            }
                        }
                    }
                }
            }

            // 現在の位置に血液があり、対象のモンスターは血液を吸収する（HPが減っていなくても）
            if (monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.UNDEAD) || 
                monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC, MONSTER_CATEGORIES.SECONDARY.INSECTOID) ||
                monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC, MONSTER_CATEGORIES.SECONDARY.REPTILE)) {
                
                // 現在位置の血液を確認
                const bloodAtPosition = this.liquidSystem.liquids.blood.find(
                    blood => blood.x === monster.x && blood.y === monster.y
                );
                
                if (bloodAtPosition) {
                    let healAmount = 0;
                    
                    // HPが減っている場合は回復処理も行う
                    if (monster.hp < monster.maxHp) {
                        // 重症度と量に基づいた回復量を計算
                        const severityFactor = bloodAtPosition.severity * 0.5;
                        const maxHealing = monster.maxHp * 0.25; // 最大HPの25%まで回復可能
                        
                        // 基本回復量を計算し、最小値として1を保証する
                        healAmount = Math.floor(monster.maxHp * 0.05 * severityFactor); 
                        healAmount = Math.max(1, healAmount); // 最小でも1回復するように保証
                        
                        // 最大回復量を制限
                        healAmount = Math.min(healAmount, maxHealing, monster.maxHp - monster.hp);
                        
                        // 回復処理
                        monster.hp += healAmount;
                    }
                    
                    // 十分な量の血液がある場合のみ吸収
                    if (bloodAtPosition.volume >= GAME_CONSTANTS.LIQUIDS.BLOOD.VOLUME.MINIMUM) {
                        // 血液の量を減らす（消費）- HPが減っていなくても吸収する
                        const consumedVolume = Math.min(bloodAtPosition.volume, bloodAtPosition.severity * 0.2);
                        bloodAtPosition.volume -= consumedVolume;
                        
                        // 血液量が最小値未満になった場合は削除
                        if (bloodAtPosition.volume < GAME_CONSTANTS.LIQUIDS.BLOOD.VOLUME.MINIMUM) {
                            this.liquidSystem.liquids.blood = this.liquidSystem.liquids.blood.filter(
                                blood => !(blood.x === monster.x && blood.y === monster.y)
                            );
                        } else {
                            // 重症度を再計算
                            bloodAtPosition.severity = this.liquidSystem.calculateSeverityFromVolume('blood', bloodAtPosition.volume);
                        }
                        
                        // 後方互換性のために、bloodpoolsプロパティも更新
                        this.bloodpools = this.liquidSystem.getLiquids('blood');
                        
                        // プレイヤーの視界内にいる場合のみメッセージを表示
                        const isVisibleToPlayer = this.getVisibleTiles()
                            .some(tile => tile.x === monster.x && tile.y === monster.y);
                        
                        if (isVisibleToPlayer) {
                            // モンスターの種類と回復有無に応じたメッセージを表示
                            if (monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.UNDEAD)) {
                                if (healAmount > 0) {
                                    this.logger.add(`${monster.name} absorbs the blood and restores ${healAmount} HP! (HP: ${monster.hp}/${monster.maxHp})`, "monsterInfo");
                                } else {
                                    this.logger.add(`${monster.name} absorbs the blood...`, "monsterInfo");
                                }
                            } else if (monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC, MONSTER_CATEGORIES.SECONDARY.INSECTOID)) {
                                if (healAmount > 0) {
                                    this.logger.add(`${monster.name} feeds on the blood and regains ${healAmount} HP! (HP: ${monster.hp}/${monster.maxHp})`, "monsterInfo");
                                } else {
                                    this.logger.add(`${monster.name} feeds on the blood...`, "monsterInfo");
                                }
                            } else if (monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC, MONSTER_CATEGORIES.SECONDARY.REPTILE)) {
                                if (healAmount > 0) {
                                    this.logger.add(`${monster.name} laps at the blood and recovers ${healAmount} HP! (HP: ${monster.hp}/${monster.maxHp})`, "monsterInfo");
                                } else {
                                    this.logger.add(`${monster.name} laps at the blood...`, "monsterInfo");
                                }
                            }
                        }
                    }
                }
            }
            
            // Skip if monster died from bleeding
            if (monster.hp <= 0) continue;
            
            // Normal monster turn actions
            if (!monster.hasActedThisTurn) {
                monster.act(this);
            }
        }

        // モンスターの行動フラグをリセット
        for (const monster of this.monsters) {
            monster.hasActedThisTurn = false;
            // 血への誘引情報をリセット
            monster.attractedToBlood = null;
        }

        // プレイヤーの知覚チェック
        if (this.player.hp > 0) {
            this.player.checkPerception(this);
        }
    }

    processNaturalHealing() {
        // 自然回復機能を廃止
        return;
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
        // 自然回復機能を廃止
        return;
    }

    processMonsterNaturalHealing() {
        // 自然回復機能を廃止
        return;
    }

    // プレイヤーが指定座標に隣接しているかチェックする関数を追加
    isPlayerAdjacent(x, y) {
        return Math.abs(this.player.x - x) <= 1 && Math.abs(this.player.y - y) <= 1;
    }

    processEndTurnUpdates() {
        // 罠や状態効果などを処理
        // 蜘蛛の巣の寿命を更新
        this.updateWebs();
        
        // 血痕の寿命を更新
        this.updateBloodpools();
        
        // ガスの更新処理
        if (this.gasSystem) {
            // ガスの減衰と拡散
            this.gasSystem.update();
            
            // 血液からの瘴気発生処理
            this.gasSystem.generateMiasmaFromBlood();
        }
        
        // 電気フィールドの更新処理
        this.updateElectricalFields();
        
        // ★★★ 新規追加：ガス・液体効果の処理 ★★★
        this.processEnvironmentalEffects();
        
        // ホームフロアのステータスを更新
        if (this.floor === 0) {
            this.updateHomeFloorStatus();
        }
        
        this.updateExplored();
        this.updateRoomInfo();
        // サイケデリックエフェクトの値を減少させる
        this.renderer.psychedelicTurn = Math.max(0, this.renderer.psychedelicTurn - 1);
        this.renderer.updateFlickerValues();  // フリッカー効果の更新を追加
        this.renderer.render();
        this.saveGame();

        if (this.inputHandler.examineTarget) {
            const target = this.inputHandler.examineTarget;
            this.logger.updateLookInfo(target.x, target.y);
        }
    }

    // 新しいメソッドを追加
    /**
     * ガス・液体による環境効果を処理
     */
    processEnvironmentalEffects() {
        // プレイヤーへの効果適用
        if (this.player.hp > 0) {
            this.applyEnvironmentalEffectsToEntity(this.player, this.player.x, this.player.y);
        }
        
        // モンスターへの効果適用
        for (const monster of this.monsters) {
            if (monster.hp > 0) {
                this.applyEnvironmentalEffectsToEntity(monster, monster.x, monster.y);
            }
        }
        
        // 液体とガスの相互作用処理
        this.processLiquidGasInteractions();
    }

    /**
     * 特定のエンティティに環境効果を適用
     * @param {Object} entity - プレイヤーまたはモンスター
     * @param {number} x - X座標
     * @param {number} y - Y座標
     */
    applyEnvironmentalEffectsToEntity(entity, x, y) {
        // ガスによる効果
        this.gasSystem.applyGasDamage(x, y, entity);
        
        // 液体による効果
        this.liquidSystem.applyLiquidEffects(x, y, entity);
        
        // ★★★ 火炎の隣接影響を追加 ★★★
        this.gasSystem.processAdjacentFireEffects(entity, x, y);
    }



    /**
     * 拡張された感電範囲のダメージ処理
     * @param {number} centerX - 中心X座標
     * @param {number} centerY - 中心Y座標
     * @param {number} range - 拡張範囲
     * @param {number} damage - 拡張範囲でのダメージ
     */
    applyExtendedElectricalDamage(centerX, centerY, range, damage) {
        const conductiveLiquids = ['blood', 'water']; // オイルは絶縁性なので除外
        let chainCount = 0; // デバッグ用カウンター
        
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                if (dx === 0 && dy === 0) continue; // 中心は除外
                
                const x = centerX + dx;
                const y = centerY + dy;
                
                if (!this.isValidPosition(x, y)) continue;
                
                // 液体の連鎖があるかチェック
                let hasConnectingLiquid = false;
                let liquidType = '';
                for (const liquidTypeCheck of conductiveLiquids) {
                    const liquid = this.liquidSystem.getLiquidAt(x, y, liquidTypeCheck);
                    if (liquid) {
                        hasConnectingLiquid = true;
                        liquidType = liquidTypeCheck;
                        chainCount++;
                        break;
                    }
                }
                
                if (hasConnectingLiquid) {
                    // プレイヤーがその位置にいるかチェック
                    if (this.player.x === x && this.player.y === y) {
                        this.player.takeDamage(Math.floor(damage), { 
                            game: this, 
                            type: 'electrical_chain',
                            isEnvironmentalDamage: true 
                        });
                        this.logger.add(`Electricity conducts through ${liquidType} to you!`, 'playerDamage');
                    }
                    
                    // モンスターがその位置にいるかチェック
                    const monster = this.getMonsterAt(x, y);
                    if (monster) {
                        monster.takeDamage(Math.floor(damage), { 
                            game: this, 
                            type: 'electrical_chain',
                            isEnvironmentalDamage: true 
                        });
                        
                        const isVisible = this.getVisibleTiles().some(tile => tile.x === x && tile.y === y);
                        if (isVisible) {
                            this.logger.add(`Electricity chains through ${liquidType} to ${monster.name}!`, 'monsterInfo');
                        }
                    }
                }
            }
        }
        
        // デバッグログ（開発確認用）
        if (this.debug && chainCount > 0) {
            this.logger.add(`[DEBUG] Electrical chain affected ${chainCount} liquid tiles`, 'info');
        }
    }

    // ============================= 電気フィールドシステム =============================

    /**
     * 電気フィールドを作成
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} level - 電気フィールドのレベル (1-3)
     * @param {number} duration - 持続ターン数 (省略時は設定値を使用)
     */
    createElectricalField(x, y, level = 2, duration = null) {
        // 既存の電気フィールドを検索
        const existingField = this.electricalFields.find(field => field.x === x && field.y === y);
        
        if (existingField) {
            // 既存のフィールドがあれば、より強いレベルで更新
            existingField.level = Math.max(existingField.level, level);
            existingField.duration = duration || GAME_CONSTANTS.GASES.ELECTRICAL_FIELDS.DURATION.BASE;
            return;
        }

        // 新しい電気フィールドを作成
        const field = {
            x: x,
            y: y,
            level: level,
            duration: duration || GAME_CONSTANTS.GASES.ELECTRICAL_FIELDS.DURATION.BASE,
            lastDischargeTime: this.turn
        };

        this.electricalFields.push(field);
        
        // 視覚エフェクト
        const isVisible = this.getVisibleTiles().some(tile => tile.x === x && tile.y === y);
        if (isVisible) {
            this.renderer.showElectricalFieldEffect(x, y, 1);
        }
    }

    /**
     * 電気フィールドの更新処理（毎ターン呼び出し）
     */
    updateElectricalFields() {
        // 持続時間の減少と削除
        this.electricalFields = this.electricalFields.filter(field => {
            field.duration--;
            return field.duration > 0;
        });

        // 各電気フィールドでの放電処理
        this.electricalFields.forEach(field => {
            this.processElectricalFieldDischarge(field);
        });
    }

    /**
     * 電気フィールドでの放電処理
     * @param {Object} field - 電気フィールドオブジェクト
     */
    processElectricalFieldDischarge(field) {
        const config = GAME_CONSTANTS.GASES.ELECTRICAL_FIELDS;
        const dischargeChance = config.DISCHARGE_CHANCE[`LEVEL_${field.level}`];
        
        // 放電判定
        if (Math.random() > dischargeChance) {
            return;
        }

        let baseDamage = config.DAMAGE[`LEVEL_${field.level}`];

        // プレイヤーがその位置にいるかチェック
        if (this.player.x === field.x && this.player.y === field.y) {
            let damage = baseDamage;
            
            // 液体による伝導性チェック
            const conductivityMultiplier = this.getElectricalConductivity(field.x, field.y);
            damage = Math.floor(damage * conductivityMultiplier);
            
            this.player.takeDamage(damage, { 
                game: this, 
                type: 'electrical_field',
                isEnvironmentalDamage: true 
            });
            
            this.logger.add(`You are shocked by an electrical field! (${damage} damage)`, 'playerDamage');
        }

        // モンスターがその位置にいるかチェック
        const monster = this.getMonsterAt(field.x, field.y);
        if (monster) {
            let damage = baseDamage;
            
            // 液体による伝導性チェック
            const conductivityMultiplier = this.getElectricalConductivity(field.x, field.y);
            damage = Math.floor(damage * conductivityMultiplier);
            
            monster.takeDamage(damage, { 
                game: this, 
                type: 'electrical_field',
                isEnvironmentalDamage: true 
            });
            
            const isVisible = this.getVisibleTiles().some(tile => tile.x === field.x && tile.y === field.y);
            if (isVisible) {
                this.logger.add(`${monster.name} is shocked by electrical discharge!`, 'monsterInfo');
            }
        }

        // ★★★ 液体を通じた感電チェーン処理を追加 ★★★
        // 電気フィールドからも隣接液体への感電を発生させる
        const liquidChainRange = 3; // 液体チェーン範囲
        const chainDamage = Math.floor(baseDamage * 0.8); // チェーンダメージは80%
        this.applyExtendedElectricalDamage(field.x, field.y, liquidChainRange, chainDamage);

        // 視覚エフェクト
        const isVisible = this.getVisibleTiles().some(tile => tile.x === field.x && tile.y === field.y);
        if (isVisible) {
            this.renderer.showMalfunctionEffect(field.x, field.y, 'electrical', field.level);
            // 液体チェーン効果の視覚エフェクトも追加
            this.renderer.showElectricalFieldEffect(field.x, field.y, liquidChainRange);
        }
    }

    /**
     * 電気の伝導性を計算（液体の種類に応じて）
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @returns {number} 伝導性倍率
     */
    getElectricalConductivity(x, y) {
        const config = GAME_CONSTANTS.GASES.ELECTRICAL_FIELDS.LIQUID_CONDUCTIVITY;
        
        // 血液をチェック
        const blood = this.liquidSystem.getLiquidAt(x, y, 'blood');
        if (blood) {
            return config.BLOOD;
        }
        
        // 水をチェック（将来実装）
        const water = this.liquidSystem.getLiquidAt(x, y, 'water');
        if (water) {
            return config.WATER;
        }
        
        // オイルをチェック（絶縁性）
        const oil = this.liquidSystem.getLiquidAt(x, y, 'oil');
        if (oil) {
            return config.OIL;
        }
        
        // 液体がない場合は通常の伝導性
        return 1.0;
    }

    /**
     * 指定位置の電気フィールドを取得
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @returns {Object|null} 電気フィールドオブジェクト
     */
    getElectricalFieldAt(x, y) {
        return this.electricalFields.find(field => field.x === x && field.y === y);
    }

    /**
     * 液体とガスの全体的な相互作用処理
     */
    processLiquidGasInteractions() {
        // 冷却液と火炎ガスの相互作用処理
        const coolants = this.liquidSystem.getLiquids('coolant');
        
        for (const coolant of coolants) {
            this.liquidSystem.handleLiquidGasInteraction(coolant.x, coolant.y);
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

        // エネルギーを全回復
        if (this.player.energy < this.player.maxEnergy) {
            this.player.energy = this.player.maxEnergy;
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

        // 最後の更新時間を記録
        this.lastHomeFloorUpdate = Date.now();
        
        // 最後に部屋情報を更新（ポータル情報を反映）
        if (this.logger) {
            this.logger.clearRoomInfo(); // 古い情報をクリア
        }
        this.updateRoomInfo(); // 部屋情報を更新
    }

    processMonsterDeath(deathInfo) {
        const { monster, result, damageResult, context, suppressMessage } = deathInfo;

        // モンスター撃破数をカウントアップ
        this.monstersKilled++;

        // ★★★ 火炎ダメージによる死亡かチェック ★★★
        const isFireDeath = context && (
            context.type === 'fire_gas' || 
            context.type === 'fire_malfunction' || 
            context.type === 'fire_heat' ||
            context.isGasDamage && context.type === 'fire_gas'
        );

        // suppressMessageフラグがtrueの場合はログメッセージを表示しない
        if (!suppressMessage) {
            // 機会攻撃とキルのログを1行にまとめる
            const attackDesc = context.isOpportunityAttack ? "Opportunity attack" : context.attackType;
            const criticalText = context.isCritical ? " [CRITICAL HIT!]" : "";
            
            // ★★★ 火炎死亡の特別メッセージ ★★★
            let message;
            if (isFireDeath) {
                const fireDeathMessages = [
                    `${monster.name} is consumed by flames!`,
                    `${monster.name} burns to death!`,
                    `${monster.name} is incinerated by the fire!`,
                    `${monster.name} succumbs to the burning flames!`,
                    `${monster.name} is killed by the blazing fire!`
                ];
                message = fireDeathMessages[Math.floor(Math.random() * fireDeathMessages.length)];
            } else if (damageResult === null || context.attackType === "Door crush") {
                message = `${attackDesc}${criticalText} kills ${monster.name} with ${result.damage} damage!`;
            } else if (context.source === 'bleeding') {
                // 出血ダメージの場合は防御力を表示しない
                message = `${attackDesc}${criticalText} kills ${monster.name} with ${result.damage} damage!`;
            } else {
                const damageCalc = `(ATK: ${damageResult.totalAttack - damageResult.attackRolls.reduce((sum, roll) => sum + roll, 0)}+[${damageResult.attackRolls.join(',')}]` +
                    `${context.damageMultiplier !== 1 ? ` ×${context.damageMultiplier.toFixed(1)}` : ''} ` +
                    `${context.isCritical ? '[DEF IGNORED]' : `vs DEF: ${monster.defense.base}+[${damageResult.defenseRolls.join(',')}]`})`;
                message = `${attackDesc}${criticalText} kills ${monster.name} with ${result.damage} damage! ${damageCalc}`;
            }

            // クリティカルヒットの場合でも必ずkillクラスを含める
            const messageClass = context.isCritical ? "playerCrit kill" : "kill";

            this.logger.add(message, messageClass);

            // ★★★ 火炎死亡時の特別エフェクト ★★★
            if (isFireDeath) {
                this.renderer.showMalfunctionEffect(monster.x, monster.y, 'fire', 3);
                this.playSound('caution2'); // 特別な効果音
            } else if (context.isCritical) {
                this.renderer.showCritEffect(monster.x, monster.y);
            }
        }

        // lookパネルを常に更新（suppressMessageに関わらず）
        this.logger.clearLookInfo();

        // モンスターを倒した時の効果音を常に再生
        this.playSound('killMonsterSound');

        // 生物系モンスターの場合、死亡時に血痕を生成する確率判定
        if (monster.isOfCategory(MONSTER_CATEGORIES.PRIMARY.ORGANIC)) {
            const deathBloodChance = 0.8; // 80%の確率で血痕を生成
            
            // ★★★ 火炎死亡時は血液が沸騰して蒸発するため生成量を減らす ★★★
            const bloodReductionFactor = isFireDeath ? 0.2 : 1.0; // 火炎死亡時は20%のみ
            
            if (Math.random() < deathBloodChance) {
                // 重症度を計算（ダメージ量に応じて）
                let severity;
                const damagePercent = (result.damage / monster.maxHp) * 100;
                
                if (damagePercent >= 75) {
                    severity = 3; // 重度の血痕
                } else if (damagePercent >= 40) {
                    severity = 2; // 中度の血痕
                } else {
                    severity = 1; // 軽度の血痕
                }
                
                // ★★★ 火炎死亡時は重症度も下げる（血液が凝固・炭化） ★★★
                if (isFireDeath && severity > 1) {
                    severity = Math.max(1, severity - 1);
                }
                
                // 血液量を決定（モンスターのサイズに基づく）
                let bloodVolume = 0;
                if (monster.size === 'tiny') {
                    bloodVolume = GAME_CONSTANTS.LIQUIDS.BLOOD.VOLUME.DEATH_AMOUNT.TINY;
                } else if (monster.size === 'small') {
                    bloodVolume = GAME_CONSTANTS.LIQUIDS.BLOOD.VOLUME.DEATH_AMOUNT.SMALL;
                } else if (monster.size === 'large') {
                    bloodVolume = GAME_CONSTANTS.LIQUIDS.BLOOD.VOLUME.DEATH_AMOUNT.LARGE;
                } else if (monster.size === 'huge') {
                    bloodVolume = GAME_CONSTANTS.LIQUIDS.BLOOD.VOLUME.DEATH_AMOUNT.HUGE;
                } else {
                    // デフォルトはmedium
                    bloodVolume = GAME_CONSTANTS.LIQUIDS.BLOOD.VOLUME.DEATH_AMOUNT.MEDIUM;
                }
                
                // ★★★ 火炎死亡時は血液量を大幅減少 ★★★
                bloodVolume *= bloodReductionFactor;
                
                // 血痕を生成（重症度とボリュームを指定）
                if (bloodVolume > 0.01) { // 最小量以上の場合のみ生成
                    this.addBloodpool(monster.x, monster.y, severity, bloodVolume);
                    
                    // ★★★ 火炎死亡時のメッセージ ★★★
                    if (isFireDeath) {
                        const isVisible = this.getVisibleTiles().some(tile => tile.x === monster.x && tile.y === monster.y);
                        if (isVisible && Math.random() < 0.3) { // 30%の確率で表示
                            this.logger.add(`${monster.name}'s blood boils from the heat...`, 'warning');
                        }
                    }
                } else if (isFireDeath) {
                    // 血液が完全に蒸発した場合
                    const isVisible = this.getVisibleTiles().some(tile => tile.x === monster.x && tile.y === monster.y);
                    if (isVisible && Math.random() < 0.2) { // 20%の確率で表示
                        this.logger.add(`The flames completely evaporate ${monster.name}'s blood.`, 'info');
                    }
                }
            }
        }

        // モンスターを削除し、死亡エフェクトを表示（suppressMessageがtrueでも実行）
        this.removeMonster(monster);
        // すでにmonster.jsで死亡エフェクトが表示されている可能性があるので、
        // suppressMessageがtrueの場合は表示しない
        if (!suppressMessage) {
            this.renderer.showDeathEffect(monster.x, monster.y);
        }

        // 経験値の計算
        const levelDiff = monster.level - this.player.level;
        const baseXP = Math.floor(monster.baseXP || monster.level);
        const levelMultiplier = levelDiff > 0
            ? 1 + (levelDiff * 0.2)
            : Math.max(0.1, 1 + (levelDiff * 0.1));
        const intBonus = 1 + Math.max(0, (this.player.stats.int - 10) * 0.03);
        const xpGained = Math.max(1, Math.floor(baseXP * levelMultiplier * intBonus));

        // 経験値とCodexポイントの獲得ログ
        let rewardText = `Gained ${xpGained} XP!`;
       
        this.logger.add(rewardText, "playerInfo");

        // 経験値とCodexポイントの付与
        this.player.addExperience(xpGained);
        

        if (deathInfo.killedByPlayer) {
            this.monsterKillCount++;  // プレイヤーが倒した場合のみカウント
        }

        // ★★★ 火炎死亡時の追加処理 ★★★
        if (isFireDeath) {
            // 死体が燃焼し続けることで追加の火炎ガスを発生
            const additionalFireGas = Math.random() * 1.5 + 0.5; // 0.5-2.0量
            this.gasSystem.addGas(monster.x, monster.y, 'fire_gas', additionalFireGas);
            
            // 隣接タイルにも軽微な火炎ガスを拡散（死体の燃焼）
            const directions = [
                [-1, -1], [0, -1], [1, -1],
                [-1,  0],          [1,  0],
                [-1,  1], [0,  1], [1,  1]
            ];
            
            for (const [dx, dy] of directions) {
                const adjacentX = monster.x + dx;
                const adjacentY = monster.y + dy;
                
                if (this.isValidPosition(adjacentX, adjacentY) && Math.random() < 0.4) {
                    this.gasSystem.addGas(adjacentX, adjacentY, 'fire_gas', Math.random() * 0.6 + 0.2);
                }
            }
            
            // 火炎死亡時は隣接家具への燃焼チェック
            this.gasSystem.handleFurnitureIgnition(monster.x, monster.y, 2.5); // 高い火炎密度
        }
    }

    // メディテーション処理を分離
    processMeditation() {
        if (!this.player.meditation || !this.player.meditation.active) return;

        // エネルギーチェック（継続するには10エネルギーが必要）
        if (this.player.rangedCombat && this.player.rangedCombat.energy.current < 10) {
            this.logger.add("Not enough energy to continue meditation.", "warning");
            
            // 瞑想終了時に効果音を停止
            if (!this.player.meditation.skipSound && this.player.meditation.soundStarted) {
                this.soundManager.stopSound('meditationSound');
            }
            
            this.logger.add(`Meditation cancelled. (Total healed: ${this.player.meditation.totalHealed} HP)`, "playerInfo");
            this.player.meditation = null;
            return;
        }

        // エネルギー消費（ターンごとに10消費）
        if (this.player.rangedCombat) {
            this.player.rangedCombat.energy.current -= 10;
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

        this.player.meditation.turnsRemaining--;

        // 瞑想中はサイケデリックエフェクトを維持
        if (!this.player.meditation.autoEffectMeditation) {
            // 自動効果による瞑想でない場合のみ、サイケデリックエフェクトを維持
            this.renderer.psychedelicTurn = Math.max(this.renderer.psychedelicTurn, 3);
        }

        // 瞑想終了条件のチェック
        if (this.player.hp >= this.player.maxHp || this.player.meditation.turnsRemaining <= 0) {
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
            
            // 自動効果による瞑想の場合は特別なメッセージを表示
            if (this.player.meditation.autoEffectMeditation) {
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

        // 血痕と蜘蛛の巣をクリア
        this.bloodpools = [];
        this.webs = [];

        // Calculate final score.
        const totalXP = this.player.xp;
        
        // モンスター撃破数をカウント（存在しない場合は初期化）
        if (!this.monstersKilled) {
            this.monstersKilled = 0;
        }
        
        const finalScore = {
            turns: this.totalTurns,
            xpScore: totalXP * 10,  // 基本XPスコア
            levelBonus: Math.pow(this.player.level, 2) * 100,  // レベルによるボーナス
            floorBonus: this.floorLevel * 50,  // 到達した階層ボーナス
            efficiencyBonus: Math.floor(totalXP * 2000 / Math.max(1, this.totalTurns)),  // 効率ボーナス
            monsterBonus: this.monstersKilled * 20,  // 倒したモンスター数ボーナス
            totalScore: 0  // 初期化
        };
        
        // 合計スコア計算
        finalScore.totalScore = finalScore.xpScore + finalScore.levelBonus + 
                               finalScore.floorBonus + finalScore.efficiencyBonus + 
                               finalScore.monsterBonus;

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
            this.soundManager.fadeOutBGM(2000).then(() => {
                // フェードアウト完了後に音声状態をリセット
                this.soundManager.userInteracted = true;
                this.soundManager.updateBGM();
            });
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
        
        // 蜘蛛の巣情報を完全にリセット
        this.webs = [];
        
        // 液体システムをリセット
        this.liquidSystem.reset();
        
        // ガスシステムをリセット
        this.gasSystem.reset();
        
        // 血痕情報を完全にリセット（後方互換性のため）
        this.bloodpools = [];
        
        // マップ生成時に設置された蜘蛛の巣をゲームオブジェクトに追加
        if (mapGenerator.initialWebs && mapGenerator.initialWebs.length > 0) {
            this.webs.push(...mapGenerator.initialWebs);
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
        
        // フロア生成後、テーマ情報がloggerに確実に反映されるように順序を調整
        this.updateRoomInfo();
        
        // プレイヤーの初期位置周辺を探索済みにマーク
        this.updateExplored();

        // Setup input handling and rendering
        this.renderer.render();
        this.inputHandler.bindKeys();

        // 描画とログの更新（重要: フロアテーマ情報が設定された後に呼び出す）
        this.renderer.render();
        // フロア情報を更新（MapGeneratorで設定されたfloorInfoを利用）
        this.logger.updateFloorInfo(this.floorLevel, this.dangerLevel);
        this.logger.renderLookPanel();  // パネルを再描画
        this.updateRoomInfo();  // 周囲の部屋情報を更新
        this.updateExplored();
        
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
        // プレイヤーが初期化されていない場合は更新しない
        if (!this.player) return;

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

        // tiles配列が正しく初期化されているか確認
        if (!this.tiles || !this.tiles.length) {
            if (this.logger) {
                this.logger.clearRoomInfo();
            }
            return;
        }

        // プレイヤーの周囲2マス以内のポータルをチェック
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const checkX = px + dx;
                const checkY = py + dy;
                
                if (this.isValidPosition(checkX, checkY) && this.tiles && this.tiles[checkY] && this.tiles[checkY][checkX]) {
                    if (this.tiles[checkY][checkX] === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                        hasPortal = true;
                    } else if (this.tiles[checkY][checkX] === GAME_CONSTANTS.PORTAL.VOID.CHAR) {
                        hasVoidPortal = true;
                    }
                }
            }
        }

        // モンスターのカウント（既存のコード）
        let monsterCount = 0;
        if (currentRoom && this.monsters) {
            monsterCount = this.monsters.filter(monster =>
                monster.x >= currentRoom.x &&
                monster.x < currentRoom.x + currentRoom.width &&
                monster.y >= currentRoom.y &&
                monster.y < currentRoom.y + currentRoom.height
            ).length;
        } else if (this.monsters) {
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

        if (this.logger) {
            this.logger.updateRoomInfo(roomInfo, monsterCount);
        }
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
        return x >= 0 && x < this.width && y >= 0 && y < this.height && this.tiles && this.tiles[y];
    }

    // セーブデータを保存
    saveGame() {
        this.saveSystem.saveGame();
    }

    // セーブデータを読み込む
    loadGame() {
        // ロガーの部屋情報をクリア
        if (this.logger) {
            this.logger.clearRoomInfo();
        }
        
        this.saveSystem.loadGame();
        
        // セーブデータ読み込み後にマップ状態を確認し、必要なら初期化
        if (!this.tiles || !this.tiles.length) {
            this.tiles = [];
            for (let y = 0; y < this.height; y++) {
                this.tiles[y] = new Array(this.width).fill('.');
            }
        }
        
        // 部屋情報が更新されていない可能性があるため強制的に更新
        this.updateRoomInfo();
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

        // エネルギーを全回復
        if (this.player.energy < this.player.maxEnergy) {
            this.player.energy = this.player.maxEnergy;
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

        // 最後の更新時間を記録
        this.lastHomeFloorUpdate = Date.now();
        
        // 最後に部屋情報を更新（ポータル情報を反映）
        if (this.logger) {
            this.logger.clearRoomInfo(); // 古い情報をクリア
        }
        this.updateRoomInfo(); // 部屋情報を更新
    }

    playSound(audioName) {  // 引数を変更
        this.soundManager.playSound(audioName);  // SoundManagerのplaySoundを呼び出す
    }

    stopSound(audioName) {
        this.soundManager.stopSound(audioName);
    }

    // 新規: Vigorペナルティの処理メソッド
    processVigorPenalty(vigorStatus) {
        // Vigor機能は廃止されました
    }

    // 休憩を開始するメソッド（自然回復廃止に伴い機能停止）
    startRest(mode, turns = 0) {
        // 自然回復機能の廃止に伴い休憩機能は使用できません
        this.logger.add("Rest feature is no longer available.", "warning");
        return;
    }

    // 休憩を継続するメソッド（自然回復廃止に伴い機能停止）
    continueRest() {
        // 自然回復機能の廃止に伴い休憩機能は使用できません
        return;
    }

    // 休憩を終了するメソッド（自然回復廃止に伴い機能停止）
    endRest(reason) {
        // 自然回復機能の廃止に伴い休憩機能は使用できません
        return;
    }

    // 休憩をキャンセルするメソッド（自然回復廃止に伴い機能停止）
    cancelRest(reason) {
        // 自然回復機能の廃止に伴い休憩機能は使用できません
        return;
    }
    
    // 休憩のキャンセル条件をチェックするメソッド（自然回復廃止に伴い機能停止）
    checkRestCancelConditions() {
        // 自然回復機能の廃止に伴い休憩機能は使用できません
        return null;
    }

    // vigorエフェクト発生時の通知メソッド - 廃止済み
    onVigorEffectOccurred() {
        // vigor機能は廃止されました
        
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
        
        // エネルギー回復と上限回復
        if (this.player.rangedCombat && this.player.rangedCombat.energy) {
            // エネルギー上限の回復（回復率に基づいて）
            this.player.resetEnergyDecay(healPercent);
            
            // 現在のエネルギーを回復（HP回復と同じ方式で、不足分に対する回復率を適用）
            const energyHealAmount = Math.floor((this.player.rangedCombat.energy.max - this.player.rangedCombat.energy.current) * (healPercent / 100));
            const oldEnergy = this.player.rangedCombat.energy.current;
            this.player.rangedCombat.energy.current = Math.min(
                this.player.rangedCombat.energy.max,
                this.player.rangedCombat.energy.current + energyHealAmount
            );
            const actualEnergyHealed = this.player.rangedCombat.energy.current - oldEnergy;
            
            // 回復メッセージを表示
            const message = `You feel revitalized! Recovered ${actualHpHealed} HP and ${Math.floor(actualEnergyHealed)} Energy.`;
            this.logger.add(message, "playerInfo");
        } else {
            // エネルギーシステムがない場合はHPのみ回復
            const message = `You feel revitalized! Recovered ${actualHpHealed} HP.`;
            this.logger.add(message, "playerInfo");
        }
        
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
        // webs配列が存在しない場合は作成
        if (!this.webs) {
            this.webs = [];
            return;
        }
        
        // NOTE: 蜘蛛の巣は自然消滅しません
        // ウェブの存在確認のみを行います
    }
    
    
    // ========================== updateBloodpools Method ==========================
    updateBloodpools() {
        // 新しいLiquidSystemを使用して液体を更新する
        this.liquidSystem.update('blood');
        
        // 後方互換性のために残す
        // 血痕は消えないようにする
        // 元のコードはコメントアウト
        /*
        this.bloodpools = this.bloodpools.filter(bloodpool => {
            bloodpool.remainingTurns--;
            return bloodpool.remainingTurns > 0;
        });
        */
    }
    
    // ========================== addBloodpool Method ==========================
    addBloodpool(x, y, severity, volume = null) {
        // 新しいLiquidSystemを使用して血液を追加する
        this.liquidSystem.addLiquid(x, y, 'blood', severity, volume);
        
        // 後方互換性のために、bloodpoolsプロパティも更新する
        // これは将来的に削除可能
        this.bloodpools = this.liquidSystem.getLiquids('blood');
    }
    
    // 血液量から重症度を計算するメソッド
    calculateSeverityFromVolume(volume) {
        return this.liquidSystem.calculateSeverityFromVolume('blood', volume);
    }
    
    // 血液のオーバーフロー処理
    handleBloodOverflow(x, y, totalVolume) {
        this.liquidSystem.handleOverflow('blood', x, y, totalVolume);
    }

    // ========================== transferBloodpool Method ==========================
    // 血痕の上を通過した際に血痕の一部が移動先に付着する処理
    transferBloodpool(fromX, fromY, toX, toY) {
        this.liquidSystem.transferLiquid('blood', fromX, fromY, toX, toY);
        
        // 後方互換性のために更新
        this.bloodpools = this.liquidSystem.getLiquids('blood');
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

    // 遠距離攻撃の射線チェック用の新しいメソッド
    hasRangedAttackLineOfSight(x1, y1, x2, y2) {
        return this.visionSystem.hasRangedAttackLineOfSight(x1, y1, x2, y2);
    }

    // 元の視線チェックメソッドはそのまま維持
    hasLineOfSight(x1, y1, x2, y2) {
        return this.visionSystem.hasLineOfSight(x1, y1, x2, y2);
    }

    // 隣接するモンスターをチェックして情報を表示する
    checkAdjacentMonsters() {
        // プレイヤーの位置を取得
        const px = this.player.x;
        const py = this.player.y;
        
        // 隣接する座標を確認（斜めも含む）
        const adjacentCoords = [
            {x: px-1, y: py-1}, {x: px, y: py-1}, {x: px+1, y: py-1},
            {x: px-1, y: py},                     {x: px+1, y: py},
            {x: px-1, y: py+1}, {x: px, y: py+1}, {x: px+1, y: py+1}
        ];
        
        // 隣接座標にいるモンスターを見つける
        for (const coord of adjacentCoords) {
            const monster = this.getMonsterAt(coord.x, coord.y);
            if (monster && !monster.isRemoved && monster.hp > 0) {
                // モンスターが可視であることを確認
                const isVisible = this.getVisibleTiles().some(tile => 
                    tile.x === monster.x && tile.y === monster.y
                );
                
                if (isVisible) {
                    // モンスター情報を表示
                    this.renderer.examineTarget(monster.x, monster.y);
                    // 最初に見つけたモンスターのみ表示して終了
                    break;
                }
            }
        }
    }

    // 新しいメソッドを追加
    /**
     * プレイヤーの状態効果を処理
     */
    processPlayerStatusEffects() {
        // 冷却液効果の減衰処理
        if (this.player.coolantEffects) {
            this.player.coolantEffects.duration--;
            if (this.player.coolantEffects.duration <= 0) {
                delete this.player.coolantEffects;
                this.logger.add('The coolant effect wears off.', 'info');
            }
        }
    }

    // ============================= 線形電気放電システム =============================

    /**
     * 線形電気放電を実行（1ターンで完結する稲妻型の放電）
     * @param {number} startX - 放電開始X座標
     * @param {number} startY - 放電開始Y座標
     * @param {number} damage - 基本ダメージ
     * @param {number} maxLength - 最大放電距離
     * @param {number} branchCount - 分岐数（複数方向への放電）
     */
    triggerLinearElectricalDischarge(startX, startY, damage = 4, maxLength = 6, branchCount = 2) {
        const dischargeLines = [];
        
        // 複数の放電線を生成
        for (let i = 0; i < branchCount; i++) {
            const dischargeLine = this.generateElectricalDischargePath(startX, startY, maxLength);
            dischargeLines.push(dischargeLine);
        }
        
        // 各放電線に沿ってダメージを適用
        dischargeLines.forEach((line, lineIndex) => {
            line.forEach((point, pointIndex) => {
                // 距離に応じてダメージを減衰
                const distanceFactor = 1 - (pointIndex / line.length) * 0.3; // 最大30%減衰
                const adjustedDamage = Math.floor(damage * distanceFactor);
                
                this.applyElectricalDischargeAtPoint(point.x, point.y, adjustedDamage);
            });
        });
        
        // 視覚エフェクト：線形に稲妻を表示
        const isVisible = this.getVisibleTiles().some(tile => tile.x === startX && tile.y === startY);
        if (isVisible) {
            this.renderer.showLinearElectricalDischarge(dischargeLines, damage);
        }
        
        // サウンド効果
        this.playSound('caution2');
        
        return dischargeLines;
    }

    /**
     * ランダムな線形放電パスを生成
     * @param {number} startX - 開始X座標
     * @param {number} startY - 開始Y座標
     * @param {number} maxLength - 最大長さ
     * @returns {Array} 放電パスの座標配列
     */
    generateElectricalDischargePath(startX, startY, maxLength) {
        const path = [{x: startX, y: startY}];
        let currentX = startX;
        let currentY = startY;
        
        // ランダムな初期方向を決定
        const directions = [
            {x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1},
            {x: 1, y: 1}, {x: -1, y: -1}, {x: 1, y: -1}, {x: -1, y: 1}
        ];
        let direction = directions[Math.floor(Math.random() * directions.length)];
        
        for (let i = 1; i < maxLength; i++) {
            // 30%の確率で方向転換（稲妻の蛇行を表現）
            if (Math.random() < 0.3) {
                const newDirection = directions[Math.floor(Math.random() * directions.length)];
                direction = newDirection;
            }
            
            const nextX = currentX + direction.x;
            const nextY = currentY + direction.y;
            
            // 境界チェック
            if (nextX < 0 || nextX >= GAME_CONSTANTS.DIMENSIONS.WIDTH ||
                nextY < 0 || nextY >= GAME_CONSTANTS.DIMENSIONS.HEIGHT) {
                break;
            }
            
            // 壁に当たったら終了（電気は壁を通らない）
            if (GAME_CONSTANTS.TILES.WALL.includes(this.tiles[nextY][nextX])) {
                break;
            }
            
            path.push({x: nextX, y: nextY});
            currentX = nextX;
            currentY = nextY;
            
            // 10%の確率で放電が自然終了
            if (Math.random() < 0.1) {
                break;
            }
        }
        
        return path;
    }

    /**
     * 特定の点での電気放電ダメージを処理
     * @param {number} x - X座標
     * @param {number} y - Y座標
     * @param {number} damage - ダメージ量
     */
    applyElectricalDischargeAtPoint(x, y, damage) {
        // 液体による伝導性チェック
        const conductivityMultiplier = this.getElectricalConductivity(x, y);
        const adjustedDamage = Math.floor(damage * conductivityMultiplier);
        
        // プレイヤーへのダメージ
        if (this.player.x === x && this.player.y === y) {
            this.player.takeDamage(adjustedDamage, { 
                game: this, 
                type: 'electrical_discharge',
                isEnvironmentalDamage: true 
            });
            this.logger.add(`Lightning strikes you! (${adjustedDamage} damage)`, 'playerDamage');
        }
        
        // モンスターへのダメージ
        const monster = this.getMonsterAt(x, y);
        if (monster) {
            monster.takeDamage(adjustedDamage, { 
                game: this, 
                type: 'electrical_discharge',
                isEnvironmentalDamage: true 
            });
            
            const isVisible = this.getVisibleTiles().some(tile => tile.x === x && tile.y === y);
            if (isVisible) {
                this.logger.add(`Lightning strikes ${monster.name}!`, 'monsterInfo');
            }
        }
        
        // 液体がある場合は周囲への感電チェーン
        const conductiveLiquids = ['blood', 'water'];
        for (const liquidType of conductiveLiquids) {
            const liquid = this.liquidSystem.getLiquidAt(x, y, liquidType);
            if (liquid) {
                // 小規模な液体チェーン（範囲1、ダメージ50%）
                this.applyExtendedElectricalDamage(x, y, 1, Math.floor(adjustedDamage * 0.5));
                break;
            }
        }
    }
}

// Start the game.
const game = new Game();

