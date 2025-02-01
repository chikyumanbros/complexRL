class InputHandler {
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

    bindKeys() {
        document.addEventListener('keydown', this.boundHandleInput);
    }

    unbindKeys() {
        document.removeEventListener('keydown', this.boundHandleInput);
    }

    handleInput(event) {
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        
        const key = event.key.toLowerCase();

        // ゲームオーバー時の処理
        if (this.game.isGameOver) {
            if (key === 'enter') {
                this.game.reset();  // ゲームをリセット
                return;
            }
            return;  // その他のキー入力を無視
        }

        // タブキーのデフォルト動作を防ぐ
        if (key === 'tab') {
            event.preventDefault();
            this.game.toggleMode();
            return;
        }

        // ステータス選択モード時の処理を追加
        if (this.mode === 'statSelect') {
            this.handleStatSelection(key);
            return;
        }

        if (this.game.mode === 'game') {
            this.handleGameModeInput(key);
        } else if (this.game.mode === 'codex') {
            this.handleCodexModeInput(key);
        }
    }

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

    handleGameModeInput(key) {
        // ルックモード中の処理
        if (this.lookMode) {
            this.handleLookMode(key);
            return;
        }
        
        const player = this.game.player;
        
        // ドア操作 (oで開け、cで閉じる)
        if (key === 'o' || key === 'c') {
            const adjacentDoors = this.findAdjacentDoors();
            
            if (adjacentDoors.length === 0) {
                this.game.logger.add("No door to operate nearby.", "warning");
                return;
            }
            
            if (adjacentDoors.length === 1) {
                // ドアが1つの場合は直接操作
                this.operateDoor(adjacentDoors[0], key);
            } else {
                // 複数のドアがある場合は方向選択モードに入る
                this.game.logger.add("Choose direction to operate door. (Press direction key)", "info");
                this.mode = 'doorOperation';
                this.pendingDoorOperation = key;
                return;
            }
            
            this.game.processTurn();
            this.game.renderer.render();
            return;
        }
        
        // ドア操作の方向選択モード
        if (this.mode === 'doorOperation') {
            let dx = 0;
            let dy = 0;
            
            switch(key) {
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
        
        // ターゲット選択モード中の処理
        if (this.targetingMode) {
            this.handleTargetingMode(key);
            return;
        }

        // 階段を降りる
        if (key === '>') {
            if (this.game.tiles[player.y][player.x] === GAME_CONSTANTS.STAIRS.CHAR) {
                player.descendStairs();
                return;
            } else {
                this.game.logger.add("There are no stairs here.", "warning");
                return;
            }
        }

        // ルックモード開始
        if (key === ';') {
            this.startLookMode();
            return;
        }

        // 数字キーが押された場合（スキル使用）
        if (/^[1-9]$/.test(key)) {
            const skillData = player.skills.get(key);
            if (!skillData) {
                this.game.logger.add("No skill assigned to this slot!", "warning");
                return;
            }

            // クールダウンチェックを先に行う
            if (skillData.remainingCooldown > 0) {
                this.game.logger.add(
                    `Skill is on cooldown! (${skillData.remainingCooldown} turns remaining)`,
                    "warning"
                );
                return;  // クールダウン中は何もせずに終了
            }

            const skill = this.game.codexSystem.findSkillById(skillData.id);
            if (skill.requiresTarget) {
                this.startTargeting(skillData.id);
            } else {
                // スキルを使用し、フリーアクションでない場合のみターンを進める
                const result = player.useSkill(skillData.id, null, this.game);
                if (result && !skill.isFreeAction) {
                    this.game.processTurn();
                }
            }
            return;
        }

        // 移動キーの処理
        let dx = 0;
        let dy = 0;
        switch(key) {
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

        // 移動キーが押された時点でメディテーションを解除
        if ((dx !== 0 || dy !== 0) && player.meditation && player.meditation.active) {
            this.game.logger.add(`Meditation cancelled. (Total healed: ${player.meditation.totalHealed}) 🧘❌`, "playerInfo");
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

    // 隣接するモンスターを探す
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

        // スペースキーでモード切り替え
        if (key === ' ') {
            codex.toggleInputMode();
            this.game.renderer.renderCodexMenu();
            return;
        }

        if (codex.inputMode === 'category') {
            // カテゴリー切り替えモード
            for (let cat in codex.categories) {
                if (keyLower === codex.categories[cat].key) {
                    codex.currentCategory = cat;
                    this.game.renderer.renderCodexMenu();
                    return;
                }
            }
        } else {
            // スキル入力モード
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

    startLookMode() {
        this.targetingMode = 'look';
        this.targetX = this.game.player.x;
        this.targetY = this.game.player.y;
        this.game.logger.add("Look mode - Use arrow keys to move cursor, ENTER to examine, ESC to cancel", "info");
        this.game.renderer.highlightTarget(this.targetX, this.targetY);
    }

    handleLookMode(key) {
        let dx = 0;
        let dy = 0;

        switch (key) {
            case 'arrowleft':
            case 'h':
                dx = -1;
                break;
            case 'arrowright':
            case 'l':
                dx = 1;
                break;
            case 'arrowup':
            case 'k':
                dy = -1;
                break;
            case 'arrowdown':
            case 'j':
                dy = 1;
                break;
            case 'escape':
                this.endLookMode();
                return;
            case 'enter':
                this.examineTarget();
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

    examineTarget() {
        const monster = this.game.getMonsterAt(this.targetX, this.targetY);
        if (monster) {
            const healthPercent = Math.floor((monster.hp / monster.maxHp) * 100);
            const messages = [
                `${monster.name} (Level ${monster.level}):`,
                `HP: ${monster.hp}/${monster.maxHp} (${healthPercent}%)`,
                `Attack Power: ${monster.attackPower.base}+${monster.attackPower.diceCount}d${monster.attackPower.diceSides}`,
                `Accuracy: ${monster.accuracy}%`,
                `Perception: ${monster.perception}`,
                `Codex Points: ${monster.codexPoints}`
            ];
            messages.forEach(msg => this.game.logger.add(msg, "monsterInfo"));
        } else if (this.targetX === this.game.player.x && this.targetY === this.game.player.y) {
            this.game.logger.add("You see yourself here.", "playerInfo");
        } else {
            const tile = this.game.map[this.targetY][this.targetX];
            this.game.logger.add(`You see ${tile === 'floor' ? 'a floor' : 'a wall'} here.`, "info");
        }
    }

    endLookMode() {
        this.targetingMode = null;
        this.game.renderer.clearHighlight();
        this.game.logger.add("Exited look mode.", "info");
    }

    handleTargetingMode(key) {
        let dx = 0;
        let dy = 0;

        switch (key) {
            case 'y': dx = -1; dy = -1; break;
            case 'u': dx = 1;  dy = -1; break;
            case 'b': dx = -1; dy = 1;  break;
            case 'n': dx = 1;  dy = 1;  break;
            case 'h': dx = -1; break;
            case 'l': dx = 1;  break;
            case 'k': dy = -1; break;
            case 'j': dy = 1;  break;
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
        
        // ルックモードの場合は別処理
        if (this.targetingMode === 'look') {
            this.examineTarget();
            this.endLookMode();
            return;
        }
        
        // スキルの取得
        const skill = this.game.codexSystem.findSkillById(this.targetingMode);
        const range = skill.range || 3; // デフォルトの範囲を3に設定
        
        // 距離チェック
        const distance = Math.max(
            Math.abs(this.targetX - player.x),
            Math.abs(this.targetY - player.y)
        );
        
        // 範囲外の場合は早期リターン
        if (distance > range || this.game.map[this.targetY][this.targetX] !== 'floor') {
            this.game.logger.add("Invalid target location!", "warning");
            this.targetingMode = null;
            this.game.renderer.clearHighlight();
            return;
        }

        const result = player.useSkill(this.targetingMode, targetPos, this.game);
        this.targetingMode = null;
        this.game.renderer.clearHighlight();
        
        // スキル使用が成功した場合のみターンを進める
        if (result) {
            this.game.processTurn();
        }
    }

    cancelTargeting() {
        this.targetingMode = null;
        this.game.renderer.clearHighlight();
        this.game.logger.add("Targeting cancelled.", "info");
    }

    // 新規: ステータス選択の処理
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

    // 新規: ステータス選択モードを設定
    setMode(mode, options = {}) {
        this.mode = mode;
        if (mode === 'statSelect') {
            this.statSelectCallback = options.callback;
        }
    }

    // 新しいヘルパーメソッド
    findAdjacentDoors() {
        const player = this.game.player;
        const doors = [];
        
        const adjacentOffsets = [
            {dx: -1, dy: -1}, {dx: 0, dy: -1}, {dx: 1, dy: -1},
            {dx: -1, dy: 0},                    {dx: 1, dy: 0},
            {dx: -1, dy: 1},  {dx: 0, dy: 1},  {dx: 1, dy: 1}
        ];

        for (let offset of adjacentOffsets) {
            const x = player.x + offset.dx;
            const y = player.y + offset.dy;
            
            if (x < 0 || x >= this.game.width || y < 0 || y >= this.game.height)
                continue;

            const tile = this.game.tiles[y][x];
            if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED || 
                tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                doors.push({x, y, tile});
            }
        }
        
        return doors;
    }

    // ドア操作の実装を分離
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
                this.game.logger.add(`The closing door crushes ${monster.name} for massive damage! ⚡`, "playerCrit");
                if (this.game.renderer.flashTile) {
                    this.game.renderer.flashTile(door.x, door.y, GAME_CONSTANTS.COLORS.DOOR);
                }
                this.game.tiles[door.y][door.x] = GAME_CONSTANTS.TILES.FLOOR[
                    Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                ];
                this.game.colors[door.y][door.x] = GAME_CONSTANTS.COLORS.FLOOR;
                if (result.killed) {
                    this.game.logger.add(`The door has destroyed ${monster.name}! 💥`, "kill");
                    this.game.removeMonster(monster);
                }
            } else {
                this.game.tiles[door.y][door.x] = GAME_CONSTANTS.TILES.DOOR.CLOSED;
                this.game.colors[door.y][door.x] = GAME_CONSTANTS.COLORS.DOOR;
                this.game.logger.add("You closed the door.", "playerInfo");
            }
        }
    }
} 