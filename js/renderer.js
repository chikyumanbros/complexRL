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
        this.renderMode();

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
                color = '#ffffff33';
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
                        backgroundColor = 'rgba(255, 255, 255, 0.2)';
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
                    style += '; opacity: 0.5';
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
            const hpBars = Math.ceil((player.hp / player.maxHp) * 10);
            const hpText = '|'.repeat(hpBars).padEnd(10, ' ');
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
        const xpTextElement = document.getElementById('xp-text');
        if (xpTextElement) {
            const xpBars = Math.ceil((player.xp / player.xpToNextLevel) * 20);
            const xpText = '|'.repeat(xpBars).padEnd(20, ' ');
            xpTextElement.textContent = xpText;
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

        // 攻撃力と防御力の詳細表示
        const attackElement = document.getElementById('attack');
        if (attackElement) {
            let attackText = `${player.attackPower.base}+${player.attackPower.diceCount}d${player.attackPower.diceSides}`;
            
            // 攻撃修正がある場合は表示を変更
            if (player.nextAttackModifier) {
                const modifiedDamage = Math.floor(player.attackPower.base * player.nextAttackModifier.damageMod);
                attackText = `<span style="color: ${player.nextAttackModifier.damageMod > 1 ? '#2ecc71' : '#e74c3c'}">${modifiedDamage}+${player.attackPower.diceCount}d${player.attackPower.diceSides}</span>`;
            }
            attackElement.innerHTML = attackText;
        }
        const defenseElement = document.getElementById('defense');
        if (defenseElement) {
            defenseElement.textContent = `${player.defense.base}+${player.defense.diceCount}d${player.defense.diceSides}`;
        }

        // 命中率の表示を追加
        const accuracyElement = document.getElementById('accuracy');
        if (accuracyElement) {
            let accText = `${player.accuracy}%`;
            
            // 命中修正がある場合は表示を変更
            if (player.nextAttackModifier && player.nextAttackModifier.accuracyMod) {
                const modifiedAcc = Math.floor(player.accuracy * (1 + player.nextAttackModifier.accuracyMod));
                accText = `<span style="color: ${player.nextAttackModifier.accuracyMod > 0 ? '#2ecc71' : '#e74c3c'}">${modifiedAcc}%</span>`;
            }
            accuracyElement.innerHTML = accText;
        }

        // 回避率、知覚の表示を追加
        const evasionElement = document.getElementById('evasion');
        if (evasionElement) {
            evasionElement.textContent = `${player.evasion}%`;
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
    }

    renderMode() {
        const modeText = this.game.mode === GAME_CONSTANTS.MODES.GAME ? 'GAME MODE' : 'CODEX MODE';
        document.getElementById('game-mode').textContent = modeText;
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
} 