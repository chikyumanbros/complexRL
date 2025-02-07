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
        this.mode = 'normal';  // 通常モード
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
        // --- Clean up visual effects on new input ---
        this.game.renderer.clearEffects();

        if (event.ctrlKey || event.altKey || event.metaKey) return;

        const key = event.key.toLowerCase();

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
                this.game.logger.add("There are no stairs here.", "warning");
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
        for (const monster of this.game.monsters) {
            const dx = Math.abs(monster.x - player.x);
            const dy = Math.abs(monster.y - player.y);
            if (dx <= 1 && dy <= 1) {  // 隣接（斜めも含む）
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
        this.lookMode = true;  // lookModeフラグを設定
        this.targetingMode = 'look';
        this.targetX = this.game.player.x;
        this.targetY = this.game.player.y;
        this.game.logger.add("Look mode - Use arrow keys to move cursor, ESC to cancel", "info");
        this.game.renderer.highlightTarget(this.targetX, this.targetY);
        this.examineTarget(); // 初期位置の情報を表示
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
            const newX = this.targetX + dx;
            const newY = this.targetY + dy;
            if (newX >= 0 && newX < this.game.width && newY >= 0 && newY < this.game.height) {
                this.targetX = newX;
                this.targetY = newY;
                this.game.renderer.highlightTarget(this.targetX, this.targetY);
                this.examineTarget();
            }
        }
    }

    examineTarget() {
        let monster = this.game.getMonsterAt(this.targetX, this.targetY);

        if (!this.lookMode && this.game.lastCombatMonster && this.game.lastCombatMonster.hp > 0) {
            monster = this.game.lastCombatMonster;
            this.targetX = monster.x;
            this.targetY = monster.y;
        }

        let lookInfo = '';

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'flex-start';
        container.style.gap = '20px';
        // 枠を消すためのスタイルを追加
        container.style.border = 'none';
        container.style.padding = '0';

        const infoDiv = document.createElement('div');
        // 情報部分の枠も消す
        infoDiv.style.border = 'none';
        infoDiv.style.padding = '0';

        if (monster) {
            // Fallback: compute attack and defense if undefined
            if (!monster.attackPower) {
                monster.attackPower = GAME_CONSTANTS.FORMULAS.ATTACK(monster.stats);
            }
            if (!monster.defense) {
                monster.defense = GAME_CONSTANTS.FORMULAS.DEFENSE(monster.stats);
            }

            const healthPercent = Math.floor((monster.hp / monster.maxHp) * 100);
            let status = [];

            // --- Basic Information ---
            let lookInfo = [
                `${monster.name} (Level ${monster.level}):`,
                `HP: ${monster.hp}/${monster.maxHp}`,
                `Distance: ${Math.max(Math.abs(this.game.player.x - monster.x), Math.abs(this.game.player.y - monster.y))} tiles`
            ];

            // --- Status Effects ---
            if (monster.hasStartedFleeing) {
                status.push("Fleeing");
            }
            if (monster.isSleeping) {
                status.push("Sleeping");
            }

            if (status.length > 0) {
                lookInfo.push(`Status: ${status.join(", ")}`);
            }

            // --- Combat Details ---
            lookInfo.push(
                `ATK: ${monster.attackPower.base}+${monster.attackPower.diceCount}d${monster.attackPower.diceSides}`,
                `DEF: ${monster.defense.base}+${monster.defense.diceCount}d${monster.defense.diceSides}`,
                `SPD: ${GAME_CONSTANTS.FORMULAS.SPEED(monster.stats)}`,
                `ACC: ${monster.accuracy}%`,
                `EVA: ${monster.evasion}%`,
                `PER: ${monster.perception}`,
            );

            infoDiv.innerHTML = lookInfo.join('\n');

            // スプライト表示用のdivのスタイルも修正
            const spriteDiv = document.createElement('div');
            spriteDiv.style.border = 'none';
            spriteDiv.style.padding = '0';
            
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            canvas.style.imageRendering = 'pixelated';
            canvas.style.background = 'transparent';  // 背景を透明に
            canvas.style.display = 'block';

            spriteDiv.appendChild(canvas);

            const spriteType = monster.type.toUpperCase();
            if (GAME_CONSTANTS.MONSTER_SPRITES[spriteType]) {
                this.game.renderer.drawMonsterSprite(canvas, spriteType);
            }

            container.appendChild(infoDiv);
            container.appendChild(spriteDiv);
        } else if (this.targetX === this.game.player.x && this.targetY === this.game.player.y) {
            infoDiv.innerHTML = "You see yourself here.";
            container.appendChild(infoDiv);
        } else {
            const tile = this.game.tiles[this.targetY][this.targetX];
            let lookInfo = '';
            if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                lookInfo = "You see a closed door here.";
            } else if (tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                lookInfo = "You see an open door here.";
            } else if (tile === GAME_CONSTANTS.STAIRS.CHAR) {
                lookInfo = "You see stairs leading down here.";
            } else if (GAME_CONSTANTS.TILES.FLOOR.includes(tile)) {
                lookInfo = "You see a floor here.";
            } else if (GAME_CONSTANTS.TILES.WALL.includes(tile)) {
                lookInfo = "You see a wall here.";
            } else {
                lookInfo = `You see ${tile} here.`;
            }
            infoDiv.innerHTML = lookInfo;
            container.appendChild(infoDiv);
        }

        this.game.logger.updateLookInfo(container);
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
            const newX = this.targetX + dx;
            const newY = this.targetY + dy;
            if (newX >= 0 && newX < this.game.width && newY >= 0 && newY < this.game.height) {
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
        const distance = Math.max(
            Math.abs(this.targetX - player.x),
            Math.abs(this.targetY - player.y)
        );

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
}