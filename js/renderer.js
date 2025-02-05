class Renderer {
    constructor(game) {
        this.game = game;
        this.highlightedTile = null;
        this.movementEffects = null;
    }

    highlightTarget(x, y) {
        this.highlightedTile = { x, y };
        this.render();
    }

    clearHighlight() {
        this.highlightedTile = null;
        this.render();
    }

    render() {
        // 移動エフェクトの状態を追加
        if (!this.movementEffects) {
            this.movementEffects = new Set();
        }

        this.renderMap();
        this.renderStatus();

        // 瞑想エフェクトの適用
        if (this.game.player.meditation && this.game.player.meditation.active) {
            this.showMeditationEffect(this.game.player.x, this.game.player.y);
        }

        // 移動エフェクトの適用
        this.movementEffects.forEach(effect => {
            const tile = document.querySelector(`#game span[data-x="${effect.x}"][data-y="${effect.y}"]`);
            if (tile) {
                tile.classList.add('movement-trail');
            }
        });

        // ターゲットのハイライト表示
        if (this.highlightedTile) {
            const tile = this.game.map[this.highlightedTile.y][this.highlightedTile.x];
            const player = this.game.player;
            const distance = Math.max(
                Math.abs(this.highlightedTile.x - player.x),
                Math.abs(this.highlightedTile.y - player.y)
            );

            let color;
            if (this.game.inputHandler.targetingMode === 'look') {
                color = '#ffffff';
            } else {
                const skillId = this.game.inputHandler.targetingMode;
                const skill = this.game.codexSystem.findSkillById(skillId);
                const range = skill ? skill.range : 1; // スキルがない場合は近接攻撃として扱う
                color = distance <= range && tile === 'floor' ? '#2ecc7144' : '#e74c3c44';
            }
            
            const cell = document.querySelector(
                `#game-container [data-x="${this.highlightedTile.x}"][data-y="${this.highlightedTile.y}"]`
            );
            if (cell) {
                cell.style.backgroundColor = color;
            }
        }
    }

    renderMap() {
        const container = document.getElementById('game');
        container.style.position = 'relative';
        
        const visibleTiles = new Set(
            this.game.getVisibleTiles().map(({x, y}) => `${x},${y}`)
        );
        
        let display = '';
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                const isVisible = visibleTiles.has(`${x},${y}`);
                const isExplored = this.game.explored[y][x];
                
                if (!isVisible && !isExplored) {
                    display += '<span style="color: black; background-color: black"> </span>';
                    continue;
                }

                let content = '';
                let style = '';
                let classes = [];
                let backgroundColor = '';

                // data属性を let で宣言
                let dataAttrs = `data-x="${x}" data-y="${y}"`;

                // ドアキルエフェクトのチェック
                const isDoorKillTarget = this.game.lastDoorKillLocation && 
                                       this.game.lastDoorKillLocation.x === x && 
                                       this.game.lastDoorKillLocation.y === y;
                
                if (isDoorKillTarget) {
                    classes.push('door-kill');
                }

                // ルックモードまたはスキルターゲティングのハイライト
                if (this.highlightedTile && 
                    this.highlightedTile.x === x && 
                    this.highlightedTile.y === y) {
                    if (this.game.inputHandler.targetingMode === 'look') {
                        backgroundColor = 'rgba(255, 255, 255, 0.53)';
                    } else {
                        const player = this.game.player;
                        const skillId = this.game.inputHandler.targetingMode;
                        const skill = this.game.codexSystem.findSkillById(skillId);
                        const range = skill ? skill.range || 3 : 3;
                        const distance = Math.max(
                            Math.abs(this.highlightedTile.x - player.x),
                            Math.abs(this.highlightedTile.y - player.y)
                        );
                        backgroundColor = distance <= range && this.game.map[y][x] === 'floor' 
                            ? 'rgba(46, 204, 113, 0.2)' 
                            : 'rgba(231, 76, 60, 0.2)';
                    }
                }

                // 攻撃エフェクトの確認
                const isAttackTarget = this.game.lastAttackLocation && 
                                     this.game.lastAttackLocation.x === x && 
                                     this.game.lastAttackLocation.y === y;
                
                if (isAttackTarget) {
                    classes.push('melee-attack');
                }

                // プレイヤー、モンスター、タイルの表示
                if (x === this.game.player.x && y === this.game.player.y) {
                    content = this.game.player.char;
                    style = 'color: white';
                    
                } else {
                    const monster = this.game.getMonsterAt(x, y);
                    if (monster && isVisible) {
                        content = monster.char;
                        style = `color: ${GAME_CONSTANTS.COLORS.MONSTER[monster.type]}`;
                        
                        // モンスターの状態に応じたスタイル
                        if (monster.isSleeping) {
                            style += '; animation: sleeping-monster 1s infinite';
                        }
                        if (monster.hasStartedFleeing) {
                            style += '; opacity: 0.8';
                        }
                    } else {
                        content = this.game.tiles[y][x];
                        const tile = this.game.tiles[y][x];
                        
                        // 特殊タイルの色設定
                        if (tile === GAME_CONSTANTS.STAIRS.CHAR) {
                            style = `color: ${GAME_CONSTANTS.STAIRS.COLOR}`;
                        } else {
                            style = `color: ${this.game.colors[y][x]}`;
                        }
                    }
                }

                // 視界外のタイルは暗く表示
                if (!isVisible) {
                    style += '; opacity: 0.4';
                }

                if (backgroundColor) {
                    style += `; background-color: ${backgroundColor}`;
                }

                const classString = classes.length > 0 ? `class="${classes.join(' ')}"` : '';
                display += `<span ${dataAttrs} ${classString} style="${style}">${content}</span>`;
            }
            display += '\n';
        }
        container.innerHTML = display;
    }

    getCurrentRoom(x, y) {
        return this.game.rooms.find(room => 
            x >= room.x && x < room.x + room.width &&
            y >= room.y && y < room.y + room.height
        );
    }

    getHighlightColor(x, y) {
        const monster = this.game.getMonsterAt(x, y);
        if (monster) {
            if (monster.isSleeping) {
                return 'rgba(100, 100, 255, 0.3)';  // 睡眠中のモンスターは青みがかった背景
            }
            return 'rgba(255, 100, 100, 0.3)';  // 通常のモンスターは赤みがかった背景
        }
        return 'rgba(255, 255, 255, 0.2)';  // 通常のハイライト
    }

    renderStatus() {
        const player = this.game.player;
        
        // 周囲のモンスター数によるペナルティを計算
        const surroundingMonsters = player.countSurroundingMonsters(this.game);
        const penaltyPerMonster = 15; // 1体につき15%のペナルティ
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

        // floor-level の更新
        const floorLevelElement = document.getElementById('floor-level');
        if (floorLevelElement) {
            const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[this.game.dangerLevel];
            floorLevelElement.innerHTML = `${this.game.floorLevel} <span style="color: ${dangerInfo.color}">[${dangerInfo.name}]</span>`;
        }
        
        // HPの数値とバー表示の更新
        const hpElementValue = document.getElementById('hp');
        if (hpElementValue) {
            hpElementValue.textContent = player.hp;
        }
        const maxHpElementValue = document.getElementById('max-hp');
        if (maxHpElementValue) {
            maxHpElementValue.textContent = player.maxHp;
        }
        const hpTextElement = document.getElementById('hp-text');
        if (hpTextElement) {
            const hpBars = Math.ceil((player.hp / player.maxHp) * 15);
            const hpText = '|'.repeat(hpBars).padEnd(15, ' ');
            hpTextElement.textContent = hpText;
            // HPの割合に応じたクラスの追加
            const hpPercentage = (player.hp / player.maxHp) * 100;
            hpTextElement.className = ''; // 既存のクラスをクリア
            if (hpPercentage > 75) {
                hpTextElement.classList.add('healthy');
            } else if (hpPercentage > 50) {
                hpTextElement.classList.add('cautious');
            } else if (hpPercentage > 25) {
                hpTextElement.classList.add('wounded');
            } else {
                hpTextElement.classList.add('danger');
            }
        }

        // プレイヤーのレベルの更新
        const levelElement = document.getElementById('level');
        if (levelElement) {
            levelElement.textContent = player.level;
        }
        
        // 経験値の数値とバー表示の更新
        const xpElement = document.getElementById('xp');
        if (xpElement) {
            xpElement.textContent = `${player.xp}/${player.xpToNextLevel}`;
        }
        
        // その他のステータスの更新
        for (let stat in player.stats) {
            const statElement = document.getElementById(stat);
            if (statElement) {
                statElement.textContent = player.stats[stat];
            }
        }
        const codexElement = document.getElementById('codexPoints');
        if (codexElement) {
            codexElement.textContent = player.codexPoints;
        }

        // 命中率の表示を更新
        const accuracyElement = document.getElementById('accuracy');
        if (accuracyElement) {
            const baseAccuracy = Math.floor(player.accuracy * (1 - surroundingPenalty));
            let accText = surroundingPenalty > 0 
                ? `<span style="color: #e74c3c">${baseAccuracy}%</span>`
                : `${baseAccuracy}%`;
            
            // 命中修正がある場合は表示を変更
            if (player.nextAttackModifier && player.nextAttackModifier.accuracyMod) {
                const modifiedAcc = Math.floor(baseAccuracy * (1 + player.nextAttackModifier.accuracyMod));
                accText = `<span style="color: ${player.nextAttackModifier.accuracyMod > 0 ? '#2ecc71' : '#e74c3c'}">${modifiedAcc}%</span>`;
            }
            accuracyElement.innerHTML = accText;
        }

        // 回避率の表示を更新
        const evasionElement = document.getElementById('evasion');
        if (evasionElement) {
            const baseEvasion = Math.floor(player.evasion * (1 - surroundingPenalty));
            evasionElement.innerHTML = surroundingPenalty > 0 
                ? `<span style="color: #e74c3c">${baseEvasion}%</span>`
                : `${baseEvasion}%`;
        }

        // 攻撃力と防御力の詳細表示
        const attackElement = document.getElementById('attack');
        if (attackElement) {
            let attackText = `${player.attackPower.base}+${player.attackPower.diceCount}d${player.attackPower.diceSides}`;
            
            // 攻撃修正がある場合は表示を変更
            if (player.nextAttackModifier) {
                const modifiedDamage = Math.floor(player.attackPower.base * player.nextAttackModifier.damageMod);
                // damageMod が 1.0 の場合は通常の色を使用
                const damageColor = player.nextAttackModifier.damageMod > 1 ? '#2ecc71' : 
                                   player.nextAttackModifier.damageMod < 1 ? '#e74c3c' : 'inherit';
                attackText = `<span style="color: ${damageColor}">${modifiedDamage}+${player.attackPower.diceCount}d${player.attackPower.diceSides}</span>`;
            }
            attackElement.innerHTML = attackText;
        }
        const defenseElement = document.getElementById('defense');
        if (defenseElement) {
            defenseElement.textContent = `${player.defense.base}+${player.defense.diceCount}d${player.defense.diceSides}`;
        }
        const speedElement = document.getElementById('speed');
        if (speedElement) {
            speedElement.textContent = `${GAME_CONSTANTS.FORMULAS.SPEED(player.stats)}`;
        }

        // スキル一覧の表示を更新（1-9のスロットのみ）
        const skillsElement = document.getElementById('skills');
        if (skillsElement) {
            const skillsDisplay = player.skills.size > 0 
                ? Array.from(player.skills.entries())
                    .filter(([slot]) => /^[1-9]$/.test(slot))
                    .map(([slot, skillData]) => {
                        const skill = this.game.codexSystem.findSkillById(skillData.id);
                        const cooldownText = skillData.remainingCooldown > 0 
                            ? ` (CD: ${skillData.remainingCooldown})`
                            : '';
                        const effectText = skill.getEffectText(player);
                        return `[${slot}] ${skill.name} ${effectText}${cooldownText}`;
                    })
                    .join('<br>')
                : 'NO SKILLS';
            skillsElement.innerHTML = skillsDisplay;
        }

        // 視界内のモンスターリストの表示を更新
        const monstersInSightElement = document.getElementById('nearby-enemies');
        if (monstersInSightElement) {
            const visibleTiles = new Set(
                this.game.getVisibleTiles().map(({x, y}) => `${x},${y}`)
            );
            
            const visibleMonsters = this.game.monsters.filter(monster => 
                visibleTiles.has(`${monster.x},${monster.y}`)
            );

            if (visibleMonsters.length > 0) {
                const monsterList = visibleMonsters.map(monster => {
                    const healthPercentage = (monster.hp / monster.maxHp) * 100;
                    
                    // HPの割合に応じてクラスを決定
                    let healthClass;
                    if (healthPercentage > 75) {
                        healthClass = 'healthy';
                    } else if (healthPercentage > 50) {
                        healthClass = 'cautious';
                    } else if (healthPercentage > 25) {
                        healthClass = 'wounded';
                    } else {
                        healthClass = 'danger';
                    }

                    const sleepStatus = monster.isSleeping ? ' Zzz' : '';
                    const fleeingStatus = monster.hasStartedFleeing ? ' >>>' : '';
                    const monsterSymbol = monster.char ? monster.char : 'M';
                    const monsterColor = GAME_CONSTANTS.COLORS.MONSTER[monster.type];
                    
                    return `<span style="color: ${monsterColor}">` +
                           `${monsterSymbol} ${monster.name}</span>` +
                           ` [<span class="${healthClass}">${monster.hp}/${monster.maxHp}</span>]` +
                           `${sleepStatus}${fleeingStatus}`;
                }).join('<br>');
                monstersInSightElement.innerHTML = monsterList;
            } else {
                monstersInSightElement.innerHTML = 'No monsters in sight';
            }
        }
    }

    renderCodexMenu() {
        const display = this.game.codexSystem.getMenuDisplay(this.game.player);  // プレイヤーオブジェクトを渡す
        document.getElementById('available-skills').innerHTML = display.replace(/\n/g, '<br>');
    }

    // 新規: エフェクトをクリーンアップするメソッド
    clearEffects() {
        if (this.game.lastAttackLocation) {
            this.game.lastAttackLocation = null;
            this.render();
        }
        
        // スキル使用エフェクトのクリーンアップ
        const playerChar = document.querySelector('#game-container [data-player="true"]');
        if (playerChar) {
            playerChar.classList.remove('next-attack-modifier');
        }
    }

    flashStatusPanel() {
        const statusPanel = document.getElementById('status-panel');
        if (statusPanel) {
            statusPanel.classList.add('damage-flash');
            setTimeout(() => {
                statusPanel.classList.remove('damage-flash');
            }, 200);
        }
    }

    // 新しいメソッドを追加
    showNextAttackModifierEffect(x, y) {
        const playerChar = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        console.log('Player char element:', playerChar); // デバッグ用
        if (playerChar) {
            playerChar.classList.add('next-attack-modifier');
            console.log('Added next-attack-modifier class'); // デバッグ用
            setTimeout(() => {
                playerChar.classList.remove('next-attack-modifier');
                console.log('Removed next-attack-modifier class'); // デバッグ用
            }, 500);
        }
    }
    // meditation エフェクト用の新しいメソッドを追加
    showMeditationEffect(x, y) {
        const playerChar = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        if (playerChar && this.game.player.meditation && this.game.player.meditation.active) {
            playerChar.classList.add('meditation-effect');
        }
    }
    // 移動エフェクト用の新しいメソッドを追加
    showMovementTrailEffect(fromX, fromY, toX, toY) {
        // 既存のエフェクトをクリア
        this.movementEffects = new Set();
        
        // 始点から終点までの軌跡を計算
        const dx = toX - fromX;
        const dy = toY - fromY;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        
        // 軌跡の各ポイントを計算
        for (let i = 0; i <= steps; i++) {
            const x = Math.round(fromX + (dx * i / steps));
            const y = Math.round(fromY + (dy * i / steps));
            this.movementEffects.add({x, y});
            
            // 各ポイントのエフェクトを時間差で消す
            setTimeout(() => {
                this.movementEffects.delete({x, y});
                this.render();
            }, 100 + (i * 50)); // 時間差で消えていく
        }

        // 強制的に再レンダリング
        this.render();

        // 全エフェクトを一定時間後にクリア
        setTimeout(() => {
            this.movementEffects.clear();
            this.render();
        }, 100 + (steps * 50) + 100);
    }

    showLevelUpEffect(x, y) {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        // 画面上でプレイヤータイルの要素を取得（data-x, data-y属性で識別）
        const playerTile = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        let centerX, centerY;
        if (playerTile) {
            // #game-container（エフェクトレイヤーの親要素）からの相対位置を計算
            const gameContainer = document.getElementById('game-container');
            const containerRect = gameContainer ? gameContainer.getBoundingClientRect() : { left: 0, top: 0 };
            const tileRect = playerTile.getBoundingClientRect();
            centerX = tileRect.left - containerRect.left + tileRect.width / 2;
            centerY = tileRect.top - containerRect.top + tileRect.height / 2;
        } else {
            // もしプレイヤータイルが見つからない場合は、fallbackとして計算（あまり推奨されません）
            const tileElement = document.querySelector('#game span');
            const tileSize = tileElement ? tileElement.offsetWidth : 14;
            centerX = x * tileSize + tileSize / 2;
            centerY = y * tileSize + tileSize / 2;
        }

        const particleCount = 20;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('levelup-particle');
            particle.style.left = centerX + "px";
            particle.style.top = centerY + "px";

            const angle = Math.random() * Math.PI * 2;
            const distance = 20 + Math.random() * 30;
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance;
            particle.style.setProperty('--dx', dx + "px");
            particle.style.setProperty('--dy', dy + "px");

            particleLayer.appendChild(particle);
            particle.addEventListener('animationend', () => {
                particle.remove();
            });
        }
    }

    showLightPillarEffect(x, y) {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        // 現在のプレイヤータイル要素（data-x, data-y 属性で識別）を取得
        const playerTile = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        let centerX, centerY;
        if (playerTile) {
            const gameContainer = document.getElementById('game-container');
            // gameContainer が存在しない場合、フォールバックとして { left: 0, top: 0 } を利用
            const containerRect = gameContainer ? gameContainer.getBoundingClientRect() : { left: 0, top: 0 };
            const tileRect = playerTile.getBoundingClientRect();
            centerX = tileRect.left - containerRect.left + tileRect.width / 2;
            centerY = tileRect.top - containerRect.top + tileRect.height / 2;
        } else {
            const tileElement = document.querySelector('#game span');
            const tileSize = tileElement ? tileElement.offsetWidth : 14;
            centerX = x * tileSize + tileSize / 2;
            centerY = y * tileSize + tileSize / 2;
        }
        
        // particleLayer の高さから、プレイヤーの中心の下端の位置（bottom）を計算
        const bottomValue = particleLayer.offsetHeight - centerY;
        
        const pillar = document.createElement('div');
        pillar.classList.add('light-pillar');
        pillar.style.left = centerX + "px";
        pillar.style.bottom = bottomValue + "px";
        
        particleLayer.appendChild(pillar);
        
        pillar.addEventListener('animationend', () => {
            pillar.remove();
        });
    }

    updateStatusPanel(status) {
        const panel = document.getElementById('status-panel');
        
        // floor-levelの更新
        const floorLevelElement = document.getElementById('floor-level');
        if (floorLevelElement) {
            const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[this.game.dangerLevel];
            floorLevelElement.innerHTML = `${this.game.floorLevel} <span style="color: ${dangerInfo.color}">[${dangerInfo.name}]</span>`;
        }

        // レベルの更新
        const levelElement = document.getElementById('level');
        if (levelElement) {
            levelElement.textContent = status.level;
        }

        // HPの更新
        const hpElement = document.getElementById('hp');
        const maxHpElement = document.getElementById('max-hp');
        if (hpElement && maxHpElement) {
            hpElement.textContent = status.hp.split('/')[0];
            maxHpElement.textContent = status.hp.split('/')[1];
        }

        // 基本ステータスの更新
        for (const [key, value] of Object.entries(status.stats)) {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = value;
            }
        }

        // 派生ステータスの更新
        for (const [key, value] of Object.entries(status.derived)) {
            const element = document.getElementById(key);
            if (element) {
                element.innerHTML = value; // HTMLタグを解釈するためにinnerHTMLを使用
            }
        }

        // XPの更新
        const xpElement = document.getElementById('xp');
        if (xpElement) {
            xpElement.textContent = status.xp;
        }

        // Codex pointsの更新
        const codexElement = document.getElementById('codexPoints');
        if (codexElement) {
            codexElement.textContent = this.game.player.codexPoints;
        }

        if (this.statusPanelFlashing) {
            panel.classList.add('flash');
            setTimeout(() => {
                panel.classList.remove('flash');
                this.statusPanelFlashing = false;
            }, 100);
        }
    }

    renderHelpMenu() {
        const display = this.getHelpDisplay();
        document.getElementById('available-skills').innerHTML = display;
    }

    getHelpDisplay() {
        let display = '';

        // メインタイトル (中央揃え)
        display += `<div style="color: #ffd700; font-size: 14px; text-align: center;">=== CONTROLS ===</div>\n\n`;

        // カテゴリごとに表示
        const categories = Object.entries(GAME_CONSTANTS.CONTROLS);
        categories.forEach(([category, data], idx) => {
            // カテゴリタイトル
            display += `<div style="color: #66ccff; font-size: 12px; margin-top: 15px;">=== ${data.title} ===</div>\n`;
            
            // キーと説明（インデントを付与）
            data.keys.forEach(keyInfo => {
                display += `<div style="margin-left: 10px;">`;
                display += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[${keyInfo.key}]</span>`;
                display += `<span style="color: #ecf0f1;">${keyInfo.desc}</span>`;
                display += `</div>\n`;
            });
            
            // 複数のカテゴリの場合は、カテゴリ毎に改行
            if (idx < categories.length - 1) {
                display += `<br>\n`;
            }
        });
        
        // フッター
        display += `<br><div style="color: #e74c3c; text-align: center;">=== TIPS ===</div>\n\n`;
        display += `<div style="text-align: center;">Press [ESC] to return to game</div>\n`;
        
        return display;
    }
} 