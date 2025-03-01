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
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);  // キーダウンのハンドラ
        this.boundHandleKeyUp = this.handleKeyUp.bind(this);      // キーアップのハンドラを追加
        this.pressedKeys = new Set();  // 現在押されているキーを追跡
        this.bindKeys();
        this.mode = 'name';  // 初期モードをname入力に設定
        this.lastInputTime = 0;  // 最後の入力時刻を追加
        this.inputCooldown = 0;  // 入力クールダウン時間（ミリ秒）
        this.nameBuffer = '';  // プレイヤー名入力用バッファ
        this.landmarkTargetMode = false;
        this.currentLandmarks = null;
        this.currentLandmarkIndex = 0;
        this.pressedKeys = new Set();  // 押されているキーを追跡
        // スキルスロットの並べ替え用変数を追加
        this.skillSlotSwapMode = false;
        this.firstSlot = null;
        // Ctrlキーの状態を保存する変数
        this.ctrlPressed = false;
        // 直接キーコンビネーションを検出するための変数を追加
        this.pendingCtrlCombo = false;
        this.lastCtrlKeyTime = 0;
    }

    // ----------------------
    // Key Binding Methods
    // ----------------------
    bindKeys() {
        document.addEventListener('keydown', this.boundHandleKeyDown);
        document.addEventListener('keyup', this.boundHandleKeyUp);
    }

    unbindKeys() {
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        document.removeEventListener('keyup', this.boundHandleKeyUp);
    }

    // キーが離された時の処理
    handleKeyUp(event) {
        // 名前入力モードの場合は大文字小文字を区別するため、keyを変換しない
        const key = this.mode === 'name' ? event.key : event.key.toLowerCase();
        this.pressedKeys.delete(key);
        
        // Ctrlキーの検出を改善（MacとWindows両方で動作するように）
        // 注意: Ctrlキーを離した直後は、数字キーを処理する前にフラグがリセットされることがあるため、
        // 少し遅延してリセットする
        if (key === 'control' || key === 'ctrl' || event.keyCode === 17) {
            console.log('Control key released (will reset after delay)');
            // 少し遅延してリセット（数字キーの入力を受け付ける時間を確保）
            setTimeout(() => {
                this.ctrlPressed = false;
                this.pendingCtrlCombo = false; // キーコンビネーション状態もリセット
                console.log('Control key state reset after delay');
            }, 200); // 200ミリ秒の遅延を追加
        }
    }

    // キーが押された時の処理
    handleKeyDown(event) {
        // デバッグログを追加（MetaキーはMacのCommandキー）
        console.log('Key pressed:', event.key, 'Ctrl:', event.ctrlKey, 'Meta:', event.metaKey, 'Key code:', event.keyCode);
        console.log('Current ctrlPressed state:', this.ctrlPressed);
        
        // Ctrlキーの状態を保存（Ctrl, Control, またはevent.ctrlKeyがtrueの場合）
        // MacではControlキー、WindowsではCtrlキーを検出
        if (event.ctrlKey || event.key === 'Control' || event.key === 'Ctrl' || event.keyCode === 17) {
            this.ctrlPressed = true;
            this.pendingCtrlCombo = true;
            this.lastCtrlKeyTime = Date.now();
            console.log('Control key state set to true');
        }
        
        // 名前入力モードの場合は大文字小文字を区別するため、keyを変換しない
        const key = this.mode === 'name' ? event.key : event.key.toLowerCase();
        
        // Ctrl+数字キーの直接検出
        // Ctrlキーを押しながら数字キーを押した場合を検出
        if (event.ctrlKey && /^[1-9]$/.test(key)) {
            console.log('Direct Ctrl+Number detection:', key);
            
            // スキルスロット並べ替えモードに入る
            this.startSkillSlotSwap(key);
            
            // イベントをデフォルト動作をキャンセル（ブラウザのショートカットを防止）
            event.preventDefault();
            return;
        }
        
        // Alt+数字キーの直接検出（代替として）
        if (event.altKey && /^[1-9]$/.test(key)) {
            console.log('Direct Alt+Number detection:', key);
            
            // スキルスロット並べ替えモードに入る
            this.startSkillSlotSwap(key);
            
            // イベントをデフォルト動作をキャンセル
            event.preventDefault();
            return;
        }
        
        // すでに押されているキーは無視（キーリピートを防止）
        if (this.pressedKeys.has(key)) {
            event.preventDefault();
            return;
        }
        
        // 新しく押されたキーとして記録
        this.pressedKeys.add(key);
        
        // メッセージログのスクロール制御
        // どのモードでも常に処理できるようにここで実装
        if (key.toLowerCase() === '[' || key.toLowerCase() === ']') {
            this.handleLogScroll(key.toLowerCase());
            
            // ヘルプモードやCodexモードの場合はスクロールのみ許可して他の処理は行わない
            if (this.game.mode === GAME_CONSTANTS.MODES.HELP || 
                this.game.mode === GAME_CONSTANTS.MODES.CODEX) {
                return;
            }
        }
        
        // 数字キーが押されたときにctrlPressedの状態をログ出力
        if (/^[1-9]$/.test(key)) {
            console.log(`Number key ${key} pressed with ctrlPressed:`, this.ctrlPressed, 'event.ctrlKey:', event.ctrlKey);
            
            // ctrlPressedがtrueで、最近Ctrlキーが押された場合（200ms以内）
            if (this.pendingCtrlCombo && (Date.now() - this.lastCtrlKeyTime < 200)) {
                console.log('Detected Ctrl+Number combo through tracking:', key);
                this.startSkillSlotSwap(key);
                this.pendingCtrlCombo = false; // 一度使ったらリセット
                return;
            }
        }
        
        // 通常の入力処理を行う
        this.handleInput(key, event);
    }

    // ----------------------
    // Utility Methods
    // ----------------------
    // 移動キーかどうかを判定するメソッド
    isMovementKey(key) {
        const movementKeys = [
            'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
            'h', 'j', 'k', 'l', 'y', 'u', 'b', 'n'
        ];
        return movementKeys.includes(key);
    }

    // ----------------------
    // Main Input Handler Method
    // ----------------------
    handleInput(key, event) {
        // ポータルアニメーション中は入力を無視
        if (this.game.isPortalTransitioning) {
            return;
        }

        // vigor effectsによる入力無効化をチェック
        if (this.game.inputDisabled) {
            console.log('Input disabled due to vigor effect');
            event.preventDefault();
            return;
        }

        // 入力クールダウンのチェック
        const currentTime = Date.now();
        if (currentTime - this.lastInputTime < this.inputCooldown) {
            if (event) event.preventDefault();
            return;
        }
        
        // 入力時間を更新
        this.lastInputTime = currentTime;

        console.log('Processing input:', key, 'Ctrl key state:', this.ctrlPressed);

        // ESCキーの処理を最優先で行う
        if (key === 'escape') {
            if (this.lookMode) {
                this.endLookMode();
                return;
            }
            if (this.landmarkTargetMode) {
                this.endLandmarkTargetMode();
                return;
            }
            if (this.targetingMode) {
                this.cancelTargeting();
                return;
            }
            // スキルスロット並べ替えモードの解除を追加
            if (this.skillSlotSwapMode) {
                this.cancelSkillSlotSwap();
                return;
            }
            // Wikiモードの解除を追加
            if (this.game.mode === GAME_CONSTANTS.MODES.WIKI) {
                this.closeWikiMode();
                return;
            }
            // ヘルプモードの解除を追加
            if (this.game.mode === GAME_CONSTANTS.MODES.HELP) {
                if (document.body.classList.contains('codex-mode')) {
                    document.body.classList.remove('codex-mode');  // Codexモードのクラスを削除
                }
                this.game.toggleMode();
                return;
            }
            // Codexモードの解除を追加
            if (this.game.mode === GAME_CONSTANTS.MODES.CODEX) {
                this.game.toggleMode();
                return;
            }
            return;
        }

        // プレイヤー名入力モードの処理
        if (this.mode === 'name') {
            // 名前入力モードの時点でタイプライターエフェクトを無効化
            const messageLogElement = document.getElementById('message-log');
            if (messageLogElement) {
                messageLogElement.classList.add('no-typewriter');
            }
            this.handleNameInput(key, event);
            return;
        }

        if (this.mode === 'characterCreation') {
            this.handleCharacterCreation(key);
            return;
        }

        // 名前入力モード以外の場合はタイプライターエフェクトを有効化
        const messageLogElement = document.getElementById('message-log');
        if (messageLogElement) {
            messageLogElement.classList.remove('no-typewriter');
        }

        // --- Clean up visual effects on new input ---
        this.game.renderer.clearEffects();

        // バックスペースでランドマークナビゲーション開始（他のモードでない時のみ）
        if (key === 'backspace' && 
            !this.lookMode && 
            !this.landmarkTargetMode && 
            !this.targetingMode && 
            this.game.mode === GAME_CONSTANTS.MODES.GAME) {  // ゲームモードの時のみ許可
            
            // ホームフロアでは無効にする
            if (this.game.floorLevel === 0) {
                this.game.logger.add("Landmark navigation is not available on the home floor.", "warning");
                return;
            }
            
            this.startLandmarkNavigation();
            return;
        }

        // 各モードの処理
        if (this.lookMode) {
            this.handleLookMode(key);
            return;
        }

        if (this.landmarkTargetMode) {
            this.handleLandmarkTargetMode(key);
            return;
        }

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

                            // スプライトプレビューの内容をクリア
                            spritePreview.innerHTML = '';

                            // フレックスコンテナを作成
                            const flexContainer = document.createElement('div');
                            flexContainer.style.display = 'flex';
                            flexContainer.style.flexWrap = 'wrap';
                            flexContainer.style.gap = '20px';
                            flexContainer.style.padding = '20px';
                            spritePreview.appendChild(flexContainer);

                            // モンスタータイプごとにコンテナを生成
                            const monsters = Object.keys(MONSTERS);
                            monsters.forEach((type, index) => {
                                const containerId = `sprite-preview-container${index === 0 ? '' : index + 1}`;
                                const container = document.createElement('div');
                                container.id = containerId;
                                container.style.padding = '10px';
                                container.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                                container.style.border = '1px solid #333';
                                container.style.borderRadius = '5px';
                                container.style.minWidth = '200px';
                                container.style.flex = '0 0 auto';
                                
                                // タイトルを追加
                                const title = document.createElement('div');
                                title.style.color = '#fff';
                                title.style.marginBottom = '10px';
                                title.style.fontFamily = 'monospace';
                                title.textContent = `Monster Type: ${type}`;
                                container.appendChild(title);

                                flexContainer.appendChild(container);

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

        // --- Help Mode Activation/Deactivation ---
        if (key === '?') {
            if (this.game.mode === GAME_CONSTANTS.MODES.HELP) {
                this.game.toggleMode();  // ヘルプモードを解除
            } else {
                this.game.enterHelpMode();  // ヘルプモードを開始
            }
            return;
        }

        // --- Help Mode Cancellation (First Block) ---
        if (this.game.mode === GAME_CONSTANTS.MODES.HELP && !document.body.classList.contains('codex-mode')) {
            if (key === 'escape') {
                this.game.toggleMode();  // 変更: toggleModeを使用
            } else if (key === 'tab') {
                if (event) event.preventDefault();
                this.game.toggleMode();  // ヘルプモードを解除
                this.toggleCodexMode();  // Codexモードを有効化
                this.game.mode = GAME_CONSTANTS.MODES.CODEX;  // モードをCodexに設定
                this.game.renderer.renderCodexMenu();  // Codexメニューを表示
            }
            return;
        }

        // --- Tab Key Handling for Codex & Mode Toggle ---
        if (key === 'tab') {
            if (event) event.preventDefault();
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
        if (key === 'r' && event && event.ctrlKey) {
            if (event) event.preventDefault();
            if (confirm('Are you sure you want to reset the game? All progress will be lost.')) {
                this.game.reset();
            }
        }
    }

    handleNameInput(key, event) {
        if (key === 'Enter' && this.nameBuffer.trim().length > 0) {
            this.game.player.name = this.nameBuffer.trim();
            this.game.renderer.renderStatus();
            this.mode = 'characterCreation';  // 名前入力後はキャラクター作成モードへ
            this.game.logger.clearTitle();
            this.game.logger.add(`Welcome, ${this.game.player.name}! Let's create your character.`, "important");
            this.game.logger.add(`You have ${this.game.player.remainingStatPoints} points to distribute.`, "info");
            this.game.logger.add("Use these keys to adjust stats:", "info");
            this.game.logger.add("[S]trength | [D]exterity | [C]onstitution | [I]ntelligence | [W]isdom", "info");
            this.game.logger.add("Press ENTER when finished", "info");
            this.showCurrentStats();
            return;
        }

        if (key === 'Backspace') {
            this.nameBuffer = this.nameBuffer.slice(0, -1);
        } else if (key.length === 1 && this.nameBuffer.length < 15) {  // 15文字制限
            // 英数字とスペースのみ許可（大文字と小文字を明示的に許可）
            if (/^[a-zA-Z0-9 ]$/.test(key)) {
                this.nameBuffer += key;
            }
        }

        // 名前入力プロンプトの更新
        this.game.renderer.renderNamePrompt(this.nameBuffer);
    }

    // 新規: キャラクター作成モードの入力処理
    handleCharacterCreation(key) {
        const statMap = {
            's': 'str',
            'd': 'dex',
            'c': 'con',
            'i': 'int',
            'w': 'wis'
        };

        if (key === 'enter' && this.game.player.remainingStatPoints === 0) {
            // キャラクター作成完了
            this.mode = 'game';
            this.game.player.updateDerivedStats();
            // HPを最大値に設定
            this.game.player.hp = this.game.player.maxHp;
            this.game.logger.add("Character creation complete!", "important");
            
            // ゲームの初期化処理を追加
            this.game.generateNewFloor();  // generateFloor から generateNewFloor に修正
            this.game.mode = GAME_CONSTANTS.MODES.GAME;  // ゲームモードに設定
            this.game.processTurn();  // 最初のターンを処理
            this.game.renderer.render();  // 画面を更新
            return;
        }

        const stat = statMap[key.toLowerCase()];
        if (stat && this.game.player.remainingStatPoints > 0) {
            this.game.player.stats[stat]++;
            this.game.player.remainingStatPoints--;
            this.showCurrentStats();
            
            // ステータスパネルを更新
            this.game.player.updateDerivedStats();
            // HPを最大値に設定
            this.game.player.hp = this.game.player.maxHp;
            this.game.renderer.renderStatus();
        }
    }

    // 新規: 現在のステータスを表示
    showCurrentStats() {
        const player = this.game.player;
        
        // ログをクリアしてから新しい情報を表示
        this.game.logger.clear();
        
        this.game.logger.add(`Welcome, ${player.name}! Let's create your character.`, "important");
        this.game.logger.add(`You have ${player.remainingStatPoints} points to distribute.`, "info");
        this.game.logger.add("Use these keys to adjust stats:", "info");
        this.game.logger.add("[S]trength | [D]exterity | [C]onstitution | [I]ntelligence | [W]isdom", "info");
        this.game.logger.add("Press ENTER when finished", "info");
        this.game.logger.add("\nCurrent Stats:", "playerInfo");
        
        Object.entries(player.stats).forEach(([stat, value]) => {
            const statName = GAME_CONSTANTS.STATS.NAMES[stat];
            this.game.logger.add(`${statName}: ${value}`, "playerInfo");
        });
        this.game.logger.add(`\nRemaining Points: ${player.remainingStatPoints}`, "important");
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
        // --- Debug ---
        if (key === '`') {
            const debug = document.getElementById('debug-panel');
            if (debug) {
                debug.style.display = debug.style.display === 'none' ? 'block' : 'none';
            }
            return;
        }

        // Wikiモードを開く（wキー）
        if (key === 'w') {
            this.openWikiMode();
            return;
        }

        // --- 処理済みかどうかをチェック ---
        let processed = false;
        
        // --- Tab key to toggle codex ---
        if (key === 'tab') {
            this.game.toggleMode();
            processed = true;
        }
        
        // confirmモードの場合、Y/Nの入力のみを受け付ける
        if (this.mode === 'confirm') {
            const upperKey = key.toLowerCase();  // 小文字に変換
            if (upperKey === 'y' || upperKey === 'n') {  // 小文字で比較
                if (this.confirmCallback) {
                    this.confirmCallback(upperKey === 'y');  // 小文字で比較
                    this.confirmCallback = null;
                    this.mode = 'normal';  // 通常モードに戻す
                }
            }
            // ここにadditionalKeysの処理を追加
            else if (this.additionalKeys && this.additionalKeys[key] !== undefined) {
                if (this.confirmCallback) {
                    this.confirmCallback(this.additionalKeys[key]);
                    this.confirmCallback = null;
                    this.mode = 'normal';
                }
            }
            return;
        }

        // スキルスロット並べ替えモードの処理
        if (this.skillSlotSwapMode) {
            this.handleSkillSlotSwapMode(key);
            return;
        }

        // インタラクションモードの処理
        if (this.mode === 'interact') {
            let dx = 0;
            let dy = 0;

            // '.'キーで現在のマスを指定
            if (key === '.') {
                dx = 0;
                dy = 0;
            } else {
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
                        this.game.logger.add("Interaction cancelled.", "info");
                        return;
                    default: return;
                }
            }

            const x = this.game.player.x + dx;
            const y = this.game.player.y + dy;

            // 扉の操作を試みる
            const door = this.findAdjacentDoors().find(d => d.x === x && d.y === y);
            if (door) {
                const operation = door.tile === GAME_CONSTANTS.TILES.DOOR.CLOSED ? 'o' : 'c';
                this.operateDoor(door, operation);
                this.game.processTurn();
                this.game.renderer.render();
                this.mode = 'normal';
                return;
            }

            // ポータルの使用を試みる
            const tile = this.game.tiles[y][x];
            if (tile === GAME_CONSTANTS.PORTAL.VOID.CHAR || tile === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                const isVoid = tile === GAME_CONSTANTS.PORTAL.VOID.CHAR;
                this.game.logger.add(`Enter the ${isVoid ? 'VOID' : ''} portal? [y/n]`, "important");
                
                // 次のフレームでconfirmモードに移行（即時実行を防ぐ）
                setTimeout(() => {
                    this.game.setInputMode('confirm', {
                        callback: (confirmed) => {
                            if (confirmed) {
                                this.game.logger.add(`You step into the ${isVoid ? 'VOID' : ''} portal...`, "important");
                                this.game.renderer.startPortalTransition(() => {
                                    if (isVoid) {
                                        this.game.floorLevel = 0;  // ホームフロアに戻る
                                        this.game.generateNewFloor();
                                        this.game.soundManager.updateBGM();
                                        
                                        // プレイヤーをホームフロアのポータルの1マス下に配置
                                        for (let y = 0; y < this.game.height; y++) {
                                            for (let x = 0; x < this.game.width; x++) {
                                                if (this.game.tiles[y][x] === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                                                    this.game.player.x = x;
                                                    this.game.player.y = y + 1;  // ポータルの1マス下
                                                    return;
                                                }
                                            }
                                        }
                                    } else {
                                        this.game.floorLevel++;
                                        this.game.generateNewFloor();
                                        this.game.soundManager.updateBGM();
                                    }
                                });
                                this.game.soundManager.playPortalSound();
                                this.game.processTurn();
                            } else {
                                this.game.logger.add(`You decide not to enter the ${isVoid ? 'VOID' : ''} portal.`, "playerInfo");
                            }
                        }
                    });
                }, 0);

                this.mode = 'normal';  // インタラクトモードを終了
                return;
            }

            this.game.logger.add("Nothing to interact with in that direction.", "warning");
            this.mode = 'normal';
            return;
        }

        // スペースキーでインタラクションモードを開始
        if (key === ' ') {
            // インタラクト可能なオブジェクトを探す
            const player = this.game.player;
            const interactables = [];

            // 現在のマスをチェック
            const currentTile = this.game.tiles[player.y][player.x];
            if (currentTile === GAME_CONSTANTS.PORTAL.VOID.CHAR || 
                currentTile === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                interactables.push({ x: player.x, y: player.y, type: 'portal', tile: currentTile });
            }

            // 隣接マスをチェック
            const adjacentOffsets = [
                { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
                { dx: -1, dy: 0 },                      { dx: 1, dy: 0 },
                { dx: -1, dy: 1 },  { dx: 0, dy: 1 },  { dx: 1, dy: 1 }
            ];

            // 隣接する扉とポータルをチェック
            for (let offset of adjacentOffsets) {
                const x = player.x + offset.dx;
                const y = player.y + offset.dy;

                if (x < 0 || x >= this.game.width || y < 0 || y >= this.game.height) continue;

                const tile = this.game.tiles[y][x];
                if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED || 
                    tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
                    interactables.push({ x, y, type: 'door', tile });
                } else if (tile === GAME_CONSTANTS.PORTAL.VOID.CHAR || 
                         tile === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                    interactables.push({ x, y, type: 'portal', tile });
                }
            }

            // インタラクト可能なオブジェクトが1つだけの場合
            if (interactables.length === 1) {
                const target = interactables[0];
                if (target.type === 'door') {
                    const operation = target.tile === GAME_CONSTANTS.TILES.DOOR.CLOSED ? 'o' : 'c';
                    this.operateDoor({ x: target.x, y: target.y, tile: target.tile }, operation);
                    this.game.processTurn();
                    this.game.renderer.render();
                } else if (target.type === 'portal') {
                    const isVoid = target.tile === GAME_CONSTANTS.PORTAL.VOID.CHAR;
                    this.game.logger.add(`Enter the ${isVoid ? 'VOID' : ''} portal? [y/n]`, "important");
                    
                    setTimeout(() => {
                        this.game.setInputMode('confirm', {
                            callback: (confirmed) => {
                                if (confirmed) {
                                    this.game.logger.add(`You step into the ${isVoid ? 'VOID' : ''} portal...`, "important");
                                    this.game.renderer.startPortalTransition(() => {
                                        if (isVoid) {
                                            this.game.floorLevel = 0;
                                            this.game.generateNewFloor();
                                            this.game.soundManager.updateBGM();
                                            
                                            for (let y = 0; y < this.game.height; y++) {
                                                for (let x = 0; x < this.game.width; x++) {
                                                    if (this.game.tiles[y][x] === GAME_CONSTANTS.PORTAL.GATE.CHAR) {
                                                        this.game.player.x = x;
                                                        this.game.player.y = y + 1;
                                                        return;
                                                    }
                                                }
                                            }
                                        } else {
                                            this.game.floorLevel++;
                                            this.game.generateNewFloor();
                                            this.game.soundManager.updateBGM();
                                        }
                                    });
                                    this.game.soundManager.playPortalSound();
                                    this.game.processTurn();
                                } else {
                                    this.game.logger.add(`You decide not to enter the ${isVoid ? 'VOID' : ''} portal.`, "playerInfo");
                                }
                            }
                        });
                    }, 0);
                }
                return;
            }

            // 複数のインタラクト可能なオブジェクトがある場合は通常のインタラクトモードを開始
            if (interactables.length > 0) {
                this.mode = 'interact';
                this.game.logger.add("Choose direction to interact. (Press direction key)", "info");
            } else {
                this.game.logger.add("Nothing to interact with nearby.", "warning");
            }
            return;
        }

        // --- Look Mode Processing ---
        if (this.lookMode) {
            this.handleLookMode(key);
            return;
        }

        // --- Landmark Navigation Mode ---
        if (key === 'backspace') {
            this.startLandmarkNavigation();
            return;
        }

        // --- Landmark Target Mode Processing ---
        if (this.landmarkTargetMode) {
            this.handleLandmarkTargetMode(key);
            return;
        }

        // 自動探索の開始
        if (key === 'z') {
            // 瞑想中は自動探索を開始できないようにする
            if (this.game.player.meditation && this.game.player.meditation.active) {
                this.game.logger.add("Cannot auto-explore while meditating.", "warning");
                return;
            }
            
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
            // デバッグ: 修飾キーの状態を詳細に確認
            console.log('Number key pressed:', key, 
                'Ctrl state tracking:', this.ctrlPressed, 
                'Direct event.ctrlKey:', event ? event.ctrlKey : 'event is null',
                'Alt key:', event ? event.altKey : 'event is null',
                'Meta key:', event ? event.metaKey : 'event is null');
            
            // Ctrlキーまたはevent.ctrlKeyが有効か確認（より頑健に）
            // MacではmetaKeyがCommandキーを表すため、それも確認
            const isModifierPressed = 
                this.ctrlPressed || 
                (event && (event.ctrlKey || event.altKey));
            
            if (isModifierPressed) {
                console.log('Modifier+Number detected! Starting skill swap for slot:', key);
                this.startSkillSlotSwap(key);
                return;
            }

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
            // REST コマンドを追加
            case '^':
                this.game.startRest('turns', 10);
                return;
            case '~':
                this.game.startRest('full');
                return;
            default: return;
        }

        // --- Cancel Meditation if Moving ---
        if ((dx !== 0 || dy !== 0) && player.meditation && player.meditation.active) {
            // cannotCancelByInputフラグがある場合はキャンセルしない
            if (!player.meditation.cannotCancelByInput) {
                this.game.logger.add(`Meditation cancelled. (Total healed: ${player.meditation.totalHealed})`, "playerInfo");
                this.game.soundManager.stopSound('meditationSound');
                player.meditation = null;
            } else {
                console.log('Meditation cannot be cancelled by input due to vigor effect');
            }
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
            const distance = GAME_CONSTANTS.DISTANCE.calculate(monster.x, monster.y, player.x, player.y);
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
            // 新しい座標を計算
            let newX = this.targetX + dx;
            let newY = this.targetY + dy;

            // マップ範囲内かチェック
            if (newX >= 0 && newX < this.game.width && newY >= 0 && newY < this.game.height) {
                // ↓↓↓ 変更箇所: ランドマークターゲットモードかどうかで処理を分岐 ↓↓↓
                if (this.landmarkTargetMode) {
                    // ランドマークターゲットモードの場合は視界外も許可
                    this.targetX = newX;
                    this.targetY = newY;
                } else {
                    // 通常のターゲティングモードの場合は視界内のみ
                    const visibleTiles = new Set(
                        this.game.getVisibleTiles().map(({ x, y }) => `${x},${y}`)
                    );
                    if (visibleTiles.has(`${newX},${newY}`)) {
                        this.targetX = newX;
                        this.targetY = newY;
                    }
                }
                // ↑↑↑ 変更箇所: ランドマークターゲットモードかどうかで処理を分岐 ↑↑↑
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
        const distance = GAME_CONSTANTS.SKILL_DISTANCE.calculate(this.targetX, this.targetY, player.x, player.y);

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
        if (mode === 'confirm') {
            this.confirmCallback = options.callback;
            // additionalKeysをオプションとして受け取る
            this.additionalKeys = options.additionalKeys || {};
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

            // ドア開くSEを再生
            this.game.playSound('doorOpenSound');
        } else if (operation === 'c' && door.tile === GAME_CONSTANTS.TILES.DOOR.OPEN) {
            const monster = this.game.getMonsterAt(door.x, door.y);
            if (monster) {
                // モンスターのHPを確実に0にする
                const damage = Math.max(monster.hp, 1);
                const result = monster.takeDamage(damage, this.game);
                this.game.logger.add(`The closing door crushes ${monster.name}!`, "playerCrit");

                // モンスターを即座に削除
                monster.isRemoved = true;
                this.game.removeMonster(monster);

                // lastCombatMonsterを確実にクリア
                this.game.lastCombatMonster = null;

                // 位置情報を正しく記録
                this.game.lastDoorKillLocation = { 
                    x: door.x, 
                    y: door.y
                };

                // タイル更新を遅延実行
                setTimeout(() => {
                    // 床タイルに変更
                    this.game.tiles[door.y][door.x] = GAME_CONSTANTS.TILES.FLOOR[
                        Math.floor(Math.random() * GAME_CONSTANTS.TILES.FLOOR.length)
                    ];
                    this.game.colors[door.y][door.x] = GAME_CONSTANTS.COLORS.FLOOR;

                    // lastDoorKillLocationをクリア
                    this.game.lastDoorKillLocation = null;

                    if (result.killed) {
                        this.game.logger.add(`The door has destroyed ${monster.name}!`, "kill");
                        
                        // 部屋の情報更新
                        const currentRoom = this.game.getCurrentRoom();
                        if (currentRoom) {
                            const monsterCount = this.game.getMonstersInRoom(currentRoom).length;
                            this.game.logger.updateRoomInfo(currentRoom, monsterCount, true);
                        }
                    }

                    // 視界の更新を強制
                    this.game._visibleTilesCache = null;
                    this.game.renderer.render();
                    
                    // Look情報を更新
                    this.game.renderer.examineTarget(door.x, door.y, true);
                }, 400);

                // 即座にレンダリング
                this.game._visibleTilesCache = null;
                this.game.renderer.render();
                
                // Look情報を即座に更新
                this.game.renderer.examineTarget(door.x, door.y, true);

                // ドアキルSEを再生
                this.game.playSound('doorKillSound');
            } else {
                this.game.tiles[door.y][door.x] = GAME_CONSTANTS.TILES.DOOR.CLOSED;
                this.game.colors[door.y][door.x] = GAME_CONSTANTS.COLORS.DOOR;
                this.game.logger.add("You closed the door.", "playerInfo");
                
                // 扉を閉めた後に視界を更新
                this.game._visibleTilesCache = null;  // キャッシュをクリア
                this.game.renderer.render();

                // ドア閉じるSEを再生
                this.game.playSound('doorCloseSound');
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

    handleConfirm(key) {
        const upperKey = key.toUpperCase();
        if (upperKey === 'y' || upperKey === 'n') {
            if (this.confirmCallback) {
                this.confirmCallback(upperKey === 'y');
                this.confirmCallback = null;
            }
        }
    }

    // ----------------------
    // Landmark Navigation Methods
    // ----------------------
    startLandmarkNavigation() {
        // ホームフロア（floorLevel = 0）ではランドマークターゲットを無効にする
        if (this.game.floorLevel === 0) {
            this.game.logger.add("ホームフロアではランドマークナビゲーションは使用できません。", "warning");
            return;
        }

        const landmarks = this.findExploredLandmarks();
        if (landmarks.length === 0) {
            this.game.logger.add("No notable landmarks in sight.", "warning");
            return;
        }

        this.landmarkTargetMode = true;
        this.targetX = landmarks[0].x;
        this.targetY = landmarks[0].y;
        this.currentLandmarks = landmarks;
        this.currentLandmarkIndex = 0;
        
        this.game.logger.add("Landmark navigation mode - Use arrow keys to cycle, ENTER to move, ESC to cancel", "info");
        this.game.renderer.highlightTarget(this.targetX, this.targetY, true);
        this.game.renderer.examineTarget(this.targetX, this.targetY, true);
    }

    handleLandmarkTargetMode(key) {
        if (!this.currentLandmarks || this.currentLandmarks.length === 0) {
            this.endLandmarkTargetMode();
            return;
        }

        switch (key) {
            case 'h':
                this.cycleLandmark(-1);
                break;
            case 'l':
                this.cycleLandmark(1);
                break;
            case 'enter':
            case ' ':
                this.startAutoMoveToLandmark();
                break;
            case 'escape':
            case 'backspace':  // backspaceでも解除可能に
                this.endLandmarkTargetMode();
                break;
        }
    }

    cycleLandmark(direction) {
        if (!this.currentLandmarks || this.currentLandmarks.length === 0) {
            return;
        }

        // 現在のインデックスを基に、次のインデックスを計算（ローテーション）
        this.currentLandmarkIndex = (this.currentLandmarkIndex + direction + this.currentLandmarks.length) % this.currentLandmarks.length;

        const landmark = this.currentLandmarks[this.currentLandmarkIndex];
        this.targetX = landmark.x;
        this.targetY = landmark.y;
        // 視界外でもハイライト
        this.game.renderer.highlightTarget(this.targetX, this.targetY, true);
        this.game.renderer.examineTarget(this.targetX, this.targetY, true);
    }

    findExploredLandmarks() {
        const landmarks = [];
        // const visibleTiles = new Set( // 不要なので削除
        //     this.game.getVisibleTiles().map(({ x, y }) => `${x},${y}`)
        // );

        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                // if (!visibleTiles.has(`${x},${y}`)) continue; // 不要なので削除
                // ↓↓↓ 変更箇所: 探索済みかどうかをチェック ↓↓↓
                if (!this.game.explored[y][x]) continue;
                // ↑↑↑ 変更箇所: 探索済みかどうかをチェック ↑↑↑
                const tile = this.game.tiles[y][x];
                if (tile === GAME_CONSTANTS.TILES.DOOR.CLOSED ||
                    tile === GAME_CONSTANTS.TILES.DOOR.OPEN ||
                    tile === GAME_CONSTANTS.STAIRS.CHAR ||
                    tile === GAME_CONSTANTS.PORTAL.GATE.CHAR ||
                    tile === GAME_CONSTANTS.PORTAL.VOID.CHAR) {
                    landmarks.push({ x, y, type: tile });
                }
            }
        }

        return landmarks;
    }

    startAutoMoveToLandmark() {
        const landmark = {
            x: this.targetX,
            y: this.targetY
        };
        
        this.game.player.startAutoMoveToLandmark(landmark);
        this.endLandmarkTargetMode();
    }

    endLandmarkTargetMode() {
        this.landmarkTargetMode = false;
        this.currentLandmarks = null;
        this.currentLandmarkIndex = 0;
        this.game.renderer.clearHighlight();
        this.game.logger.add("Exited landmark navigation mode.", "info");
    }

    // メッセージログのスクロール制御
    handleLogScroll(key) {
        const logPanel = document.getElementById('message-log');
        const enemyInfo = document.querySelector('.enemy-info');
        const helpPanel = document.getElementById('available-skills');
        const codexPanel = document.querySelector('.codex-content');
        const scrollAmount = 30;

        if (key === '[') {
            // 上方向スクロール
            if (logPanel) {
                logPanel.scrollTop -= scrollAmount;
            }
            if (enemyInfo) {
                enemyInfo.scrollTop -= scrollAmount;
            }
            if (helpPanel && this.game.mode === GAME_CONSTANTS.MODES.HELP) {
                helpPanel.scrollTop -= scrollAmount;
            }
            if (codexPanel && this.game.mode === GAME_CONSTANTS.MODES.CODEX) {
                codexPanel.scrollTop -= scrollAmount;
            }
        } else if (key === ']') {
            // 下方向スクロール
            if (logPanel) {
                logPanel.scrollTop += scrollAmount;
            }
            if (enemyInfo) {
                enemyInfo.scrollTop += scrollAmount;
            }
            if (helpPanel && this.game.mode === GAME_CONSTANTS.MODES.HELP) {
                helpPanel.scrollTop += scrollAmount;
            }
            if (codexPanel && this.game.mode === GAME_CONSTANTS.MODES.CODEX) {
                codexPanel.scrollTop += scrollAmount;
            }
        }
    }

    // ----------------------
    // Utility Methods
    // ----------------------
    openWikiMode() {
        // 既存のゲームモードを保存
        this.previousMode = this.game.mode;
        
        // Wikiモードを設定
        this.game.mode = GAME_CONSTANTS.MODES.WIKI;
        
        // 現在のWikiページの存在を確認
        const existingWikiWindow = document.getElementById('wiki-frame-container');
        if (existingWikiWindow) {
            // 既に開いていれば表示切替
            existingWikiWindow.style.display = existingWikiWindow.style.display === 'none' ? 'flex' : 'none';
            return;
        }
        
        // Wikiページを表示するコンテナを作成
        const wikiFrameContainer = document.createElement('div');
        wikiFrameContainer.id = 'wiki-frame-container';
        wikiFrameContainer.style.position = 'fixed';
        wikiFrameContainer.style.top = '0';
        wikiFrameContainer.style.left = '0';
        wikiFrameContainer.style.width = '100%';
        wikiFrameContainer.style.height = '100%';
        wikiFrameContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        wikiFrameContainer.style.zIndex = '1000';
        wikiFrameContainer.style.display = 'flex';
        wikiFrameContainer.style.justifyContent = 'center';
        wikiFrameContainer.style.alignItems = 'center';
        
        // Wikiページを表示するiframeを作成
        const wikiFrame = document.createElement('iframe');
        wikiFrame.id = 'wiki-frame';
        wikiFrame.style.width = '80%';
        wikiFrame.style.height = '80%';
        wikiFrame.style.border = 'none';
        wikiFrame.style.backgroundColor = '#fff';
        wikiFrame.style.borderRadius = '5px';
        wikiFrame.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
        wikiFrame.src = 'wiki.html';
        
        // Create close button
        const closeButton = document.createElement('div');
        closeButton.textContent = 'Close [ESC]';
        closeButton.style.position = 'absolute';
        closeButton.style.top = '10px';
        closeButton.style.right = '10%';
        closeButton.style.color = '#fff';
        closeButton.style.padding = '5px 10px';
        closeButton.style.backgroundColor = '#333';
        closeButton.style.borderRadius = '5px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => this.closeWikiMode();
        
        // Add elements to container
        wikiFrameContainer.appendChild(wikiFrame);
        wikiFrameContainer.appendChild(closeButton);
        document.body.appendChild(wikiFrameContainer);
        
        // Add key event listener (ESC key to close)
        this.wikiKeydownListener = (e) => {
            if (e.key === 'Escape') {
                this.closeWikiMode();
            }
        };
        document.addEventListener('keydown', this.wikiKeydownListener);
        
        // Add log message
        this.game.logger.add('Wiki screen opened. Press [ESC] or click [Close] to return.', 'system');
    }
    
    // Method to close wiki mode
    closeWikiMode() {
        const wikiContainer = document.getElementById('wiki-frame-container');
        if (wikiContainer) {
            wikiContainer.style.display = 'none';
        }
        
        // Restore previous mode
        this.game.mode = this.previousMode || GAME_CONSTANTS.MODES.GAME;
        
        // Remove key event listener
        if (this.wikiKeydownListener) {
            document.removeEventListener('keydown', this.wikiKeydownListener);
            this.wikiKeydownListener = null;
        }
        
        // Add log message
        this.game.logger.add('Wiki screen closed.', 'system');
    }

    // スキルスロット並べ替えモードを開始するメソッド
    startSkillSlotSwap(slotKey) {
        console.log('Starting skill slot swap for slot:', slotKey);
        const player = this.game.player;
        
        // スロットが存在するか確認
        console.log('Player skills:', [...player.skills.entries()]);
        
        // スロットが空の場合、並べ替えを開始しない
        if (!player.skills.has(slotKey)) {
            console.log('No skill found in slot:', slotKey);
            this.game.logger.add("No skill in slot " + slotKey + " to swap!", "warning");
            return;
        }
        
        this.skillSlotSwapMode = true;
        this.firstSlot = slotKey;
        const skillData = player.skills.get(slotKey);
        console.log('Selected skill data:', skillData);
        
        const skill = this.game.codexSystem.findSkillById(skillData.id);
        console.log('Found skill:', skill);
        
        this.game.logger.add(`Select another skill slot to swap with ${skill.name} (Slot ${slotKey})`, "info");
    }
    
    // スキルスロット並べ替えモードの処理メソッド
    handleSkillSlotSwapMode(key) {
        console.log('Handling skill slot swap, key pressed:', key);
        
        // 数字キーのみ処理
        if (!/^[1-9]$/.test(key)) {
            console.log('Not a number key, cancelling swap');
            this.cancelSkillSlotSwap();
            return;
        }
        
        const player = this.game.player;
        const secondSlot = key;
        
        console.log('First slot:', this.firstSlot, 'Second slot:', secondSlot);
        
        // 同じスロットを選択した場合はキャンセル
        if (this.firstSlot === secondSlot) {
            console.log('Same slot selected, cancelling swap');
            this.cancelSkillSlotSwap();
            return;
        }
        
        // スロット間でスキルを交換
        const firstSkill = player.skills.get(this.firstSlot);
        const secondSkill = player.skills.get(secondSlot);
        
        console.log('First skill:', firstSkill, 'Second skill:', secondSkill);
        
        // 2つ目のスロットが空の場合
        if (!secondSkill) {
            console.log('Moving skill to empty slot');
            // 1つ目のスロットから2つ目のスロットに移動
            player.skills.set(secondSlot, firstSkill);
            player.skills.delete(this.firstSlot);
            
            const skillName = this.game.codexSystem.findSkillById(firstSkill.id).name;
            this.game.logger.add(`Moved ${skillName} from slot ${this.firstSlot} to slot ${secondSlot}`, "playerInfo");
        } else {
            console.log('Swapping skills between slots');
            // 両方のスロットにスキルがある場合は交換
            player.skills.set(this.firstSlot, secondSkill);
            player.skills.set(secondSlot, firstSkill);
            
            const firstSkillName = this.game.codexSystem.findSkillById(firstSkill.id).name;
            const secondSkillName = this.game.codexSystem.findSkillById(secondSkill.id).name;
            this.game.logger.add(`Swapped ${firstSkillName} and ${secondSkillName}`, "playerInfo");
        }
        
        // スキルスロット並べ替えモードを終了
        this.skillSlotSwapMode = false;
        this.firstSlot = null;
        
        console.log('Skill swap completed, updating skill panel');
        
        // スキルパネルを更新（renderAvailableSkillsではなくrenderStatusを使用）
        this.game.renderer.renderStatus();
        
        // 変更を画面に反映するためにrenderも呼び出す
        this.game.renderer.render();
    }
    
    // スキルスロット並べ替えをキャンセルするメソッド
    cancelSkillSlotSwap() {
        console.log('Cancelling skill slot swap');
        this.skillSlotSwapMode = false;
        this.firstSlot = null;
        this.game.logger.add("Skill swap cancelled", "info");
    }
    
    // Shiftキーが押されているかをチェックするメソッド
    isShiftPressed(event) {
        return event && event.shiftKey;
    }
}