class Renderer {
    constructor(game) {
        this.game = game;
        this.highlightedTile = null;
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
        this.renderMap();
        this.renderStatus();
        this.renderMode();

        // ターゲットのハイライト表示
        if (this.highlightedTile) {
            const tile = this.game.map[this.highlightedTile.y][this.highlightedTile.x];
            const player = this.game.player;
            const distance = Math.max(
                Math.abs(this.highlightedTile.x - player.x),
                Math.abs(this.highlightedTile.y - player.y)
            );

            // 範囲内なら緑、範囲外なら赤でハイライト
            const color = distance <= 3 && tile === 'floor' ? '#2ecc7144' : '#e74c3c44';
            
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
                
                // 未踏破かつ視界外のタイルは表示しない
                if (!isVisible && !isExplored) {
                    display += '<span style="color: black; background-color: black"> </span>';
                    continue;
                }

                const currentRoom = this.getCurrentRoom(this.game.player.x, this.game.player.y);
                const visibility = currentRoom ? currentRoom.brightness : 3;
                
                // プレイヤーからの距離をユークリッド距離で計算
                const dx = x - this.game.player.x;
                const dy = y - this.game.player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // 視界範囲外の場合は暗く表示
                const isVisibleTile = isVisible;
                
                const isHighlighted = this.highlightedTile && 
                    this.highlightedTile.x === x && 
                    this.highlightedTile.y === y;
                
                let bgColor = '';
                if (isHighlighted) {
                    const player = this.game.player;
                    if (this.game.inputHandler.targetingMode === 'look') {
                        bgColor = '#ffffff33';
                    } else {
                        const skillId = this.game.inputHandler.targetingMode;
                        const skill = this.game.codexSystem.findSkillById(skillId);
                        const range = skill.range || 3;
                        bgColor = distance <= range && this.game.map[y][x] === 'floor' 
                            ? '#2ecc7144' 
                            : '#e74c3c44';
                    }
                }

                let content = '';
                let style = '';

                if (x === this.game.player.x && y === this.game.player.y) {
                    content = this.game.player.char;
                    style = `color: white; background-color: ${bgColor}`;
                } else {
                    const monster = this.game.getMonsterAt(x, y);
                    if (monster && isVisible) {  // モンスターは視界内の場合のみ表示
                        const color = GAME_CONSTANTS.COLORS.MONSTER[monster.type];
                        const animation = monster.isSleeping ? 'sleeping-monster 1s infinite' : 'none';
                        content = monster.char;
                        style = `color: ${color}; background-color: ${bgColor}; font-weight: ${isHighlighted ? 'bold' : 'normal'}; animation: ${animation}`;
                    } else {
                        const color = this.game.colors[y][x];
                        content = this.game.tiles[y][x];
                        style = `color: ${color}; background-color: ${bgColor}`;
                    }
                }

                // 視界範囲外の場合は暗く表示
                if (!isVisibleTile) {
                    style += '; opacity: 0.3';
                }

                display += `<span style="${style}">${content}</span>`;
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
        const codexElement = document.getElementById('codex');
        if (codexElement) {
            codexElement.textContent = player.codex;
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
} 
