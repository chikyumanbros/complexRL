// ====================
// Class: InputHandler
// ====================
class InputHandler {
    // ----------------------
    // Constructor & Properties
    // ----------------------
    constructor(game) {
        this.game = game;
        this.targetingMode = null;  // ターゲット選択モード用
        this.targetX = null;
        this.targetY = null;
        this.lookMode = false;  // ルックモードを追加
        this.boundHandleInput = this.handleInput.bind(this);  // バインドされたメソッドを保持
        this.bindKeys();
        this.mode = 'name';  // 初期モードをname入力に設定
        this.lastInputTime = 0;  // 最後の入力時刻を追加
        this.inputCooldown = 100;  // 入力クールダウン時間（ミリ秒）
        this.nameBuffer = '';  // プレイヤー名入力用バッファ
    }

    // ----------------------
    // Key Binding Methods
    // ----------------------
    bindKeys() {
        document.addEventListener('keydown', this.boundHandleInput);
    }

    unbindKeys() {
        document.removeEventListener('keydown', this.boundHandleInput);
    }

    // ----------------------
    // Main Input Handler Method
    // ----------------------
    handleInput(event) {
        // 入力クールダウンのチェック
        const currentTime = Date.now();
        if (currentTime - this.lastInputTime < this.inputCooldown) {
            event.preventDefault();
            return;
        }
        this.lastInputTime = currentTime;

        // プレイヤー名入力モードの処理
        if (this.mode === 'name') {
            // 名前入力モードの時点でタイプライターエフェクトを無効化
            const messageLogElement = document.getElementById('message-log');
            if (messageLogElement) {
                messageLogElement.classList.add('no-typewriter');
            }
            this.handleNameInput(event);
            return;
        }

        // 名前入力モード以外の場合はタイプライターエフェクトを有効化
        const messageLogElement = document.getElementById('message-log');
        if (messageLogElement) {
            messageLogElement.classList.remove('no-typewriter');
        }

        // --- Clean up visual effects on new input ---
        this.game.renderer.clearEffects();

        const key = event.key.toLowerCase();

        // 開発者コマンドの処理を最初に行う
        if (event.ctrlKey && event.shiftKey) {
            console.log('Developer command detected:', key);
            switch (key) {
                case 's':
                    event.preventDefault();
                    const spritePreview = document.getElementById('sprite-preview');
                    if (spritePreview) {
                        const isHidden = spritePreview.style.display === 'none';
                        spritePreview.style.display = isHidden ? 'block' : 'none';
                        
                        if (!isHidden) {
                            console.log('Hiding sprite preview...');
                        } else {
                            console.log('Showing sprite preview...');
                            // モンスターの定義を確認
                            if (!MONSTERS) {
                                console.error('MONSTERS is not defined');
                                return;
                            }

                            const monsters = Object.keys(MONSTERS).map((type, index) => ({
                                type,
                                containerId: `sprite-preview-container${index === 0 ? '' : index + 1}`
                            }));
                            
                            monsters.forEach(({ type, containerId }) => {
                                const container = document.getElementById(containerId);
                                if (!container) {
                                    console.warn(`Container ${containerId} not found`);
                                    return;
                                }

                                try {
                                    // スプライトの描画
                                    this.game.renderer.previewMonsterSprite(type, containerId);

                                    // ステータス情報の表示
                                    const monsterData = MONSTERS[type];
                                    if (!monsterData || !monsterData.stats) {
                                        console.error(`Invalid monster data for type: ${type}`);
                                        return;
                                    }

                                    const monsterStats = monsterData.stats;
                                    const size = GAME_CONSTANTS.FORMULAS.SIZE(monsterStats);
                                    const speed = GAME_CONSTANTS.FORMULAS.SPEED(monsterStats);
                                    const attack = GAME_CONSTANTS.FORMULAS.ATTACK(monsterStats);
                                    const defense = GAME_CONSTANTS.FORMULAS.DEFENSE(monsterStats);
                                    const accuracy = GAME_CONSTANTS.FORMULAS.ACCURACY(monsterStats);
                                    const evasion = GAME_CONSTANTS.FORMULAS.EVASION(monsterStats);
                                    const maxHp = GAME_CONSTANTS.FORMULAS.MAX_HP(monsterStats, MONSTERS[type].level);

                                    const statsHtml = `
                                        <div style="text-align: left; margin-top: 10px; font-family: monospace;">
                                            <div style="color: #ffd700">Level ${MONSTERS[type].level}</div>
                                            <div>HP: ${maxHp}</div>
                                            <div>ATK: ${attack.base}+${attack.diceCount}d${attack.diceSides}</div>
                                            <div>DEF: ${defense.base}+${defense.diceCount}d${defense.diceSides}</div>
                                            <div>ACC: ${accuracy}%</div>
                                            <div>EVA: ${evasion}%</div>
                                            <div>PER: ${GAME_CONSTANTS.FORMULAS.PERCEPTION(monsterStats)}</div>
                                            <div style="color: ${GAME_CONSTANTS.COLORS.SIZE[size.value].color}">Size: ${size.name}</div>
                                            <div style="color: ${GAME_CONSTANTS.COLORS.SPEED[speed.value].color}">Speed: ${speed.name}</div>
                                            <div style="color: #3498db">Stats:</div>
                                            <div>STR: ${monsterStats.str}</div>
                                            <div>DEX: ${monsterStats.dex}</div>
                                            <div>CON: ${monsterStats.con}</div>
                                            <div>INT: ${monsterStats.int}</div>
                                            <div>WIS: ${monsterStats.wis}</div>
                                        </div>
                                    `;

                                    // 既存のステータス情報があれば更新、なければ新規作成
                                    let statsDiv = container.querySelector('.monster-stats');
                                    if (!statsDiv) {
                                        statsDiv = document.createElement('div');
                                        statsDiv.className = 'monster-stats';
                                        container.appendChild(statsDiv);
                                    }
                                    statsDiv.innerHTML = statsHtml;
                                } catch (error) {
                                    console.error(`Error processing monster ${type}:`, error);
                                }
                            });
                        }
                    }
                    return;
            }
        }

        // 通常のゲーム入力の処理
        if (this.game.player.isDead) {
            // ... existing dead player code ...
            return;
        }

        // --- Game Over Input Handling ---
        if (this.game.isGameOver) {
            if (key === 'enter') {
                this.game.reset();  // ゲームをリセット
            }
            if (key === ' ') {
                this.game.reset();
            }
            return;  // その他のキー入力を無視
        }

        // --- Help Mode Activation ---
        if (key === '?') {
            this.game.enterHelpMode();  // 変更: 新しいメソッドを使用
            return;
        }

        // --- Help Mode Cancellation (First Block) ---
        if (this.game.mode === GAME_CONSTANTS.MODES.HELP) {
            if (key === 'escape') {
                this.game.toggleMode();  // 変更: toggleModeを使用
            }
            return;
        }

        // --- Help Mode Cancellation (Second Block) ---
        if (this.game.mode === GAME_CONSTANTS.MODES.HELP) {
            if (key === 'escape') {
                this.game.mode = GAME_CONSTANTS.MODES.GAME;
                this.game.logger.renderLookPanel();
            }
            return;
        }

        // --- Tab Key Handling for Codex & Mode Toggle ---
        if (key === 'tab') {
            event.preventDefault();
            // lookモードが有効な場合は解除
            if (this.lookMode) {
                this.endLookMode();
            }
            this.toggleCodexMode();
            this.game.toggleMode();
            return;
        }

        // --- Stat Selection Mode Handling ---
        if (this.mode === 'statSelect') {
            this.handleStatSelection(key);
            return;
        }

        // --- Codex Mode vs Game Mode Input Handling ---
        if (document.body.classList.contains('codex-mode')) {
            this.handleCodexModeInput(key);
        } else {
            this.handleGameModeInput(key);
        }

        // Ctrl+R for resetの部分を修正
        if (event.key.toLowerCase() === 'r' && event.ctrlKey) {
            event.preventDefault();
            if (confirm('Are you sure you want to reset the game? All progress will be lost.')) {
                this.game.reset();
            }
        }
    }

    handleNameInput(event) {
        const key = event.key;

        if (key === 'Enter' && this.nameBuffer.trim().length > 0) {
            this.game.player.name = this.nameBuffer.trim();
            this.mode = 'game';
            this.game.logger.clearTitle();  // タイトルを消去
            this.game.logger.add(`Welcome, ${this.game.player.name}!`, "important");
            this.game.renderer.render();
            return;
        }

        if (key === 'Backspace') {
            this.nameBuffer = this.nameBuffer.slice(0, -1);
        } else if (key.length === 1 && this.nameBuffer.length < 15) {  // 15文字制限
            // 英数字とスペースのみ許可
            if (/^[a-zA-Z0-9 ]$/.test(key)) {
                this.nameBuffer += key;
            }
        }

        // 名前入力プロンプトの更新
        this.game.renderer.renderNamePrompt(this.nameBuffer);
    }

    // ----------------------
    // Targeting Mode Methods
    // ----------------------
    startTargeting(skillId) {
        const player = this.game.player;
        this.targetingMode = skillId;
        // カーソルの初期位置をプレイヤーの現在位置に設定
        this.targetX = player.x;
        this.targetY = player.y;
        // 即座にハイライトを表示
        this.game.renderer.highlightTarget(this.targetX, this.targetY);
        // ターゲットモードに入ったことをプレイヤーに通知
        this.game.logger.add("Select target location. (ENTER to confirm, ESC to cancel)", "info");
    }

    // ----------------------
    // Game Mode Input Handling
    // ----------------------
    handleGameModeInput(key) {
        // --- Look Mode Processing ---
        if (this.lookMode) {
            this.handleLookMode(key);
            return;
        }

        // 自動探索の開始
        if (key === 'z') {
            if (!this.game.player.autoExploring) {
                this.game.player.startAutoExplore();
            }
            return;
        }

        // 自動探索中は他のキー入力で解除
        if (this.game.player.autoExploring) {
            this.game.player.stopAutoExplore();
            return;
        }

        const player = this.game.player;

        // --- Door Operation (Open/Close) ---
        if (key === 'o' || key === 'c') {
            const adjacentDoors = this.findAdjacentDoors();

            if (adjacentDoors.length === 0) {
                this.game.logger.add("No door to operate nearby.", "warning");
                return;
            }

            // Filter for operable doors based on the key
            const operableDoors = adjacentDoors.filter(door =>
                (key === 'o' && door.tile === GAME_CONSTANTS.TILES.DOOR.CLOSED) ||
                (key === 'c' && door.tile === GAME_CONSTANTS.TILES.DOOR.OPEN)
            );

            if (operableDoors.length === 1) {
                // Directly operate if exactly one door is available
                this.operateDoor(operableDoors[0], key);
            } else if (operableDoors.length === 0) {
                this.game.logger.add(`No door to ${key === 'o' ? 'open' : 'close'} nearby.`, "warning");
                return;
            } else {
                // Multiple doors available: Enter door operation directional mode
                this.game.logger.add("Choose direction to operate door. (Press direction key)", "info");
                this.mode = 'doorOperation';
                this.pendingDoorOperation = key;
                return;
            }

            this.game.processTurn();
            this.game.renderer.render();
            return;
        }

        // --- Door Operation: Directional Input Handling ---
        if (this.mode === 'doorOperation') {
            let dx = 0;
            let dy = 0;

            switch (key) {
                case 'arrowleft':
                case 'h': dx = -1; break;
                case 'arrowright':
                case 'l': dx = 1; break;
                case 'arrowup':
                case 'k': dy = -1; break;
                case 'arrowdown':
                case 'j': dy = 1; break;
                case 'y': dx = -1; dy = -1; break;
                case 'u': dx = 1; dy = -1; break;
                case 'b': dx = -1; dy = 1; break;
                case 'n': dx = 1; dy = 1; break;
                case 'escape':
                    this.mode = 'normal';
                    this.game.logger.add("Door operation cancelled.", "info");
                    return;
                default: return;
            }

            const x = this.game.player.x + dx;
            const y = this.game.player.y + dy;

            const door = this.findAdjacentDoors().find(d => d.x === x && d.y === y);
            if (door) {
                this.operateDoor(door, this.pendingDoorOperation);
                this.game.processTurn();
                this.game.renderer.render();
            } else {
                this.game.logger.add("No door in that direction.", "warning");
            }

            this.mode = 'normal';
            this.pendingDoorOperation = null;
            return;
        }

        // --- Targeting Mode Handling ---
        if (this.targetingMode) {
            this.handleTargetingMode(key);
            return;
        }

        // --- Stair Descent Handling ---
        if (key === '>') {
            if (this.game.tiles[player.y][player.x] === GAME_CONSTANTS.STAIRS.CHAR) {
                player.descendStairs();
                return;
            } else {
                // 階段が見つかっていない場合
                const stairLocation = this.findExploredStairs();
                if (!stairLocation) {
                    this.game.logger.add("You haven't found any stairs yet.", "warning");
                    return;
                }
                
                // プレイヤーが階段の位置にいない場合、自動移動を開始
                player.startAutoMoveToStairs(stairLocation);
                return;
            }
        }

        // --- Initiate Look Mode ---
        if (key === ';') {
            this.startLookMode();
            return;
        }

        // --- Skill Usage via Number Keys ---
        if (/^[1-9]$/.test(key)) {
            const skillData = player.skills.get(key);
            if (!skillData) {
                this.game.logger.add("No skill assigned to this slot!", "warning");
                return;
            }

            // Check for cooldown before skill activation
            if (skillData.remainingCooldown > 0) {
                this.game.logger.add(
                    `Skill is on cooldown! (${skillData.remainingCooldown} turns remaining)`,
                    "warning"
                );
                return;
            }

            const skill = this.game.codexSystem.findSkillById(skillData.id);
            if (skill.requiresTarget) {
                this.startTargeting(skillData.id);
            } else {
                // Use the skill and process turn if it's not a free action
                const result = player.useSkill(skillData.id, null, this.game);
                if (result && !skill.isFreeAction) {
                    this.game.processTurn();
                }
            }
            return;
        }

        // --- Movement Handling ---
        let dx = 0;
        let dy = 0;
        switch (key) {
            case 'ArrowLeft':
            case 'h': dx = -1; break;
            case 'ArrowRight':
            case 'l': dx = 1; break;
            case 'ArrowUp':
            case 'k': dy = -1; break;
            case 'ArrowDown':
            case 'j': dy = 1; break;
            case 'y': dx = -1; dy = -1; break;
            case 'u': dx = 1; dy = -1; break;
            case 'b': dx = -1; dy = 1; break;
            case 'n': dx = 1; dy = 1; break;
            case '.':
                this.game.logger.add("You wait...", "playerInfo");
                this.game.processTurn();
                return;
            default: return;
        }

        // --- Cancel Meditation if Moving ---
        if ((dx !== 0 || dy !== 0) && player.meditation && player.meditation.active) {
            this.game.logger.add(`Meditation cancelled. (Total healed: ${player.meditation.totalHealed})`, "playerInfo");
            player.meditation = null;
        }

        const newX = player.x + dx;
        const newY = player.y + dy;

        const monster = this.game.getMonsterAt(newX, newY);
        if (monster) {
            player.attackMonster(monster, this.game);
            this.game.processTurn();
            return;
        }

        if (player.move(dx, dy, this.game.map)) {
            this.game.processTurn();
        }
    }

    // ----------------------
    // Utility Method: Find Nearby Monster
    // ----------------------
    findNearbyMonster() {
        const player = this.game.player;
        // チェビシェフ距離からユークリッド距離に変更
        for (const monster of this.game.monsters) {
            const dx = monster.x - player.x;
            const dy = monster.y - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance <= 1.5) {  // 斜め距離も考慮して1.5に設定
                return monster;
            }
        }
        return null;
    }

    // ----------------------
    // Codex Mode Input Handling
    // ----------------------
    handleCodexModeInput(key) {
        const codex = this.game.codexSystem;
        const keyLower = key.toLowerCase();

        if (codex.selectionMode === 'replace') {
            if (keyLower === 'escape') {
                codex.selectionMode = 'normal';
                codex.pendingSkill = null;
                this.game.renderer.renderCodexMenu();
                return;
            }

            const slotNum = parseInt(key);
            if (slotNum >= 0 && slotNum <= 9 && this.game.player.skills.has(slotNum)) {
                if (codex.replaceSkill(slotNum, this.game.player)) {
                    this.game.renderer.render();
                    this.game.renderer.renderCodexMenu();
                }
                return;
            }
            return;
        }

        // --- Toggle Codex Input Mode with Space ---
        if (key === ' ') {
            codex.toggleInputMode();
            this.game.renderer.renderCodexMenu();
            return;
        }

        if (codex.inputMode === 'category') {
            // --- Category Selection Mode ---
            for (let cat in codex.categories) {
                if (keyLower === codex.categories[cat].key) {
                    codex.currentCategory = cat;
                    this.game.renderer.renderCodexMenu();
                    return;
                }
            }
        } else {
            // --- Skill Input Mode ---
            if (key === 'backspace') {
                codex.updateInputBuffer(codex.inputBuffer.slice(0, -1));
                this.game.renderer.renderCodexMenu();
                return;
            }

            if (key === 'enter' && codex.suggestions.length > 0) {
                const result = codex.tryLearnSkill(codex.suggestions[0].id, this.game.player);
                if (result === true) {
                    this.game.logger.add(`Learned skill: ${codex.suggestions[0].name}`, "important");
                    codex.clearInput();
                } else if (result === 'replace') {
                    this.game.logger.add("Select slot to replace", "warning");
                } else {
                    this.game.logger.add(result, "warning");
                }
                this.game.renderer.render();
                this.game.renderer.renderCodexMenu();
                return;
            }

            if (key.length === 1 && /[a-zA-Z]/.test(key)) {
                codex.updateInputBuffer(codex.inputBuffer + key);
                this.game.renderer.renderCodexMenu();
            }
        }
    }

    // ----------------------
    // Look Mode Methods
    // ----------------------
    startLookMode() {
        this.lookMode = true;
        this.targetingMode = 'look';
        this.targetX = this.game.player.x;
        this.targetY = this.game.player.y;
        this.game.logger.add("Look mode - Use arrow keys to move cursor, ESC to cancel", "info");
        this.game.renderer.highlightTarget(this.targetX, this.targetY);
        this.game.renderer.examineTarget(this.targetX, this.targetY, true); // 初期位置の情報を表示
    }

    handleLookMode(key) {
        let dx = 0;
        let dy = 0;

        switch (key) {
            case 'arrowleft':
            case 'h': dx = -1; break;
            case 'arrowright':
            case 'l': dx = 1; break;
            case 'arrowup':
            case 'k': dy = -1; break;
            case 'arrowdown':
            case 'j': dy = 1; break;
            case 'y': dx = -1; dy = -1; break;
            case 'u': dx = 1; dy = -1; break;
            case 'b': dx = -1; dy = 1; break;
            case 'n': dx = 1; dy = 1; break;
            case 'escape':
                this.endLookMode();
                return;
        }

        if (dx !== 0 || dy !== 0) {
            const visibleTiles = new Set(
                this.game.getVisibleTiles().map(({ x, y }) => `${x},${y}`)
            );

            // 新しい座標を計算
            let newX = this.targetX + dx;
            let newY = this.targetY + dy;

            // マップ範囲内かチェック
            if (newX >= 0 && newX < this.game.width && newY >= 0 && newY < this.game.height) {
                // 視界内のタイルを探す
                while (!visibleTiles.has(`${newX},${newY}`)) {
                    newX += dx;
                    newY += dy;
                    
                    // マップ範囲外に出たら中止
                    if (newX < 0 || newX >= this.game.width || newY < 0 || newY >= this.game.height) {
                        return;
                    }
                    
                    // 次の視界内タイルが見つかった場合
                    if (visibleTiles.has(`${newX},${newY}`)) {
                        this.targetX = newX;
                        this.targetY = newY;
                        this.game.renderer.highlightTarget(this.targetX, this.targetY);
                        this.game.renderer.examineTarget(this.targetX, this.targetY, true);
                        return;
                    }
                }

                // 隣接タイルが視界内の場合は通常通り移動
                this.targetX = newX;
                this.targetY = newY;
                this.game.renderer.highlightTarget(this.targetX, this.targetY);
                this.game.renderer.examineTarget(this.targetX, this.targetY, true);
            }
        }
    }

    endLookMode() {
        this.lookMode = false;  // lookModeフラグを解除
        this.targetingMode = null;
        this.game.renderer.clearHighlight();
        this.game.logger.add("Exited look mode.", "info");
    }

    // ----------------------
    // Targeting Mode Navigation
    // ----------------------
    handleTargetingMode(key) {
        let dx = 0;
        let dy = 0;

        switch (key) {
            case 'y': dx = -1; dy = -1; break;
            case 'u': dx = 1; dy = -1; break;
            case 'b': dx = -1; dy = 1; break;
            case 'n': dx = 1; dy = 1; break;
            case 'h': dx = -1; break;
            case 'l': dx = 1; break;
            case 'k': dy = -1; break;
            case 'j': dy = 1; break;
            case 'enter':
            case ' ':
                this.confirmTarget();
                return;
            case 'escape':
                this.cancelTargeting();
                return;
        }

        if (dx !== 0 || dy !== 0) {
            const visibleTiles = new Set(
                this.game.getVisibleTiles().map(({ x, y }) => `${x},${y}`)
            );

            // 新しい座標を計算
            let newX = this.targetX + dx;
            let newY = this.targetY + dy;

            // マップ範囲内かチェック
            if (newX >= 0 && newX < this.game.width && newY >= 0 && newY < this.game.height) {
                // 視界内のタイルを探す
                while (!visibleTiles.has(`${newX},${newY}`)) {
                    newX += dx;
                    newY += dy;
                    
                    // マップ範囲外に出たら中止
                    if (newX < 0 || newX >= this.game.width || newY < 0 || newY >= this.game.height) {
                        return;
                    }
                    
                    // 次の視界内タイルが見つかった場合
                    if (visibleTiles.has(`${newX},${newY}`)) {
                        this.targetX = newX;
                        this.targetY = newY;
                        this.game.renderer.highlightTarget(this.targetX, this.targetY);
                        return;
                    }
                }

                // 隣接タイルが視界内の場合は通常通り移動
                this.targetX = newX;
                this.targetY = newY;
                this.game.renderer.highlightTarget(this.targetX, this.targetY);
            }
        }
    }

    confirmTarget() {
        const player = this.game.player;
        const targetPos = { x: this.targetX, y: this.targetY };

        // --- Ignore confirmation if in Look Mode ---
        if (this.targetingMode === 'look') {
            return;
        }

        // --- Acquire Skill Information ---
        const skill = this.game.codexSystem.findSkillById(this.targetingMode);
        const range = skill.range || 3; // デフォルトの範囲を3に設定

        // --- Validate Target Distance and Tile ---
        // チェビシェフ距離からユークリッド距離に変更
        const dx = this.targetX - player.x;
        const dy = this.targetY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > range || this.game.map[this.targetY][this.targetX] !== 'floor') {
            this.game.logger.add("Invalid target location!", "warning");
            this.targetingMode = null;
            this.game.renderer.clearHighlight();
            return;
        }

        const result = player.useSkill(this.targetingMode, targetPos, this.game);
        this.targetingMode = null;
        this.game.renderer.clearHighlight();

        // --- Process Turn if Skill Use is Successful ---
        if (result) {
            this.game.processTurn();
        }
    }

    cancelTargeting() {
        this.targetingMode = null;
        this.game.renderer.clearHighlight();
        this.game.logger.add("Targeting cancelled.", "info");
    }

    // ----------------------
    // Stat Selection Handling
    // ----------------------
    handleStatSelection(key) {
        const statMap = {
            's': 'str',
            'd': 'dex',
            'c': 'con',
            'i': 'int',
            'w': 'wis'
        };

        if (statMap[key]) {
            if (this.statSelectCallback) {
                this.statSelectCallback(statMap[key]);
                this.mode = 'normal';  // 通常モードに戻す
                this.statSelectCallback = null;
            }
        }
    }

    // --- Set Mode and associated callbacks (e.g., statSelect) ---
    setMode(mode, options = {}) {
        this.mode = mode;
        if (mode === 'statSelect') {
            this.statSelectCallback = options.callback;
        }
    }

    // ----------------------
    // Utility: Find Adjacent Doors
    // ----------------------
    findAdjacentDoors() {
        const player = this.game.player;
        const doors = [];

        const adjacentOffsets = [
            { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
            { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }
        ];

        for (let offset of adjacentOffsets) {
            const x = player.x + offset.dx;
            const y = player.y + offset.dy;

            if (x < 0 || x >= this.game.width || y < 0 || y >= this.game.height)
                continue;

            const tile = this.game.tiles[y][x];
            if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED ||
                tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                doors.push({ x, y, tile });
            }
        }

        return doors;
    }

    // ----------------------
    // Door Operation Implementation
    // ----------------------
    operateDoor(door, operation) {
        if (operation === 'o' && door.tile === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
            this.game.tiles[door.y][door.x] = GAME_CONSTANTS.TILES.DOOR.OPEN;
            this.game.colors[door.y][door.x] = GAME_CONSTANTS.COLORS.DOOR;
            this.game.logger.add("You opened the door.", "playerInfo");
            
            // 扉を開けた後に視界を更新
            this.game._visibleTilesCache = null;  // キャッシュをクリア
            this.game.renderer.render();
        } else if (operation === 'c' && door.tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
            const monster = this.game.getMonsterAt(door.x, door.y);
            if (monster) {
                const massiveDamage = monster.hp + 999;
                const result = monster.takeDamage(massiveDamage);
                this.game.logger.add(`The closing door crushes ${monster.name} for massive damage!`, "playerCrit");

                // --- Record Door Kill Location ---
                this.game.lastDoorKillLocation = { x: door.x, y: door.y };

                // --- Delayed Tile Update ---
                setTimeout(() => {
                    this.game.lastDoorKillLocation = null;
                    this.game.tiles[door.y][door.x] = GAME_CONSTANTS.TILES.FLOOR[
                        Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                    ];
                    this.game.colors[door.y][door.x] = GAME_CONSTANTS.COLORS.FLOOR;

                    if (result.killed) {
                        this.game.logger.add(`The door has destroyed ${monster.name}!`, "kill");
                        this.game.removeMonster(monster);
                        const currentRoom = this.game.getCurrentRoom();
                        const monsterCount = this.game.getMonstersInRoom(currentRoom).length;
                        this.game.logger.updateRoomInfo(currentRoom, monsterCount, true);
                    }

                    this.game.renderer.render();
                }, 400);

                // --- Immediate Rendering for Effect Display ---
                this.game.renderer.render();

            } else {
                this.game.tiles[door.y][door.x] = GAME_CONSTANTS.TILES.DOOR.CLOSED;
                this.game.colors[door.y][door.x] = GAME_CONSTANTS.COLORS.DOOR;
                this.game.logger.add("You closed the door.", "playerInfo");
                
                // 扉を閉めた後に視界を更新
                this.game._visibleTilesCache = null;  // キャッシュをクリア
                this.game.renderer.render();
            }
        }
    }

    // ----------------------
    // Misc: Toggle Codex Mode
    // ----------------------
    toggleCodexMode() {
        document.body.classList.toggle('codex-mode');
        const gameModeElem = document.getElementById('game-mode');
        if (!gameModeElem) {
            //console.warn("'game-mode' element not found. Please add <div id=\"game-mode\"></div> to your HTML.");
            return;
        }
    }

    // ----------------------
    // Utility Methods
    // ----------------------
    findExploredStairs() {
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                if (this.game.explored[y][x] && 
                    this.game.tiles[y][x] === GAME_CONSTANTS.STAIRS.CHAR) {
                    return { x, y };
                }
            }
        }
        return null;
    }
}