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
        
        let display = '';
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                const isHighlighted = this.highlightedTile && 
                    this.highlightedTile.x === x && 
                    this.highlightedTile.y === y;
                
                let bgColor = '';
                if (isHighlighted) {
                    const player = this.game.player;
                    if (this.game.inputHandler.targetingMode === 'look') {
                        bgColor = '#ffffff33';  // ルックモード時は薄い白色
                    } else {
                        // スキルのターゲティングモード時
                        const skillId = this.game.inputHandler.targetingMode;
                        const skill = this.game.codexSystem.findSkillById(skillId);
                        const distance = Math.max(
                            Math.abs(x - player.x),
                            Math.abs(y - player.y)
                        );
                        const range = skill.range || 3; // デフォルトの範囲を3に設定
                        bgColor = distance <= range && this.game.map[y][x] === 'floor' 
                            ? '#2ecc7144' 
                            : '#e74c3c44';
                    }
                }

                if (x === this.game.player.x && y === this.game.player.y) {
                    display += `<span style="color: white; background-color: ${bgColor}">${this.game.player.char}</span>`;
                } else {
                    const monster = this.game.getMonsterAt(x, y);
                    if (monster) {
                        const color = GAME_CONSTANTS.COLORS.MONSTER[monster.type];
                        // 睡眠中のモンスターは点滅エフェクトを追加
                        const animation = monster.isSleeping ? 'sleeping-monster 1s infinite' : 'none';
                        display += `<span style="color: ${color}; background-color: ${bgColor}; font-weight: ${isHighlighted ? 'bold' : 'normal'}; animation: ${animation}">${monster.char}</span>`;
                    } else {
                        const color = this.game.colors[y][x];
                        display += `<span style="color: ${color}; background-color: ${bgColor}">${this.game.tiles[y][x]}</span>`;
                    }
                }
            }
            display += '\n';
        }
        container.innerHTML = display;
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
            floorLevelElement.textContent = this.game.floorLevel;
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
            attackElement.textContent = `${player.attackPower.base}+${player.attackPower.diceCount}d${player.attackPower.diceSides}`;
        }
        const defenseElement = document.getElementById('defense');
        if (defenseElement) {
            defenseElement.textContent = `${player.defense.base}+${player.defense.diceCount}d${player.defense.diceSides}`;
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

    renderGameOver(score) {
        const container = document.getElementById('game');
        let display = '';

        // 画面全体を暗く表示
        for (let y = 0; y < this.game.height; y++) {
            for (let x = 0; x < this.game.width; x++) {
                // 中央部分にゲームオーバーメッセージを表示
                if (y === Math.floor(this.game.height / 2) - 3 && x === Math.floor(this.game.width / 2) - 5) {
                    display += "╔═════════════╗";
                    x += 12;
                } else if (y === Math.floor(this.game.height / 2) - 2 && x === Math.floor(this.game.width / 2) - 5) {
                    display += "║ GAME  OVER  ║";
                    x += 12;
                } else if (y === Math.floor(this.game.height / 2) - 1 && x === Math.floor(this.game.width / 2) - 5) {
                    display += "╠═════════════╣";
                    x += 12;
                } else if (y === Math.floor(this.game.height / 2) && x === Math.floor(this.game.width / 2) - 5) {
                    const kills = score.monstersKilled.toString().padStart(3, ' ');
                    display += `║ Kills: ${kills}  ║`;
                    x += 12;
                } else if (y === Math.floor(this.game.height / 2) + 1 && x === Math.floor(this.game.width / 2) - 5) {
                    const codex = score.codexPoints.toString().padStart(3, ' ');
                    display += `║ Codex: ${codex}  ║`;
                    x += 12;
                } else if (y === Math.floor(this.game.height / 2) + 2 && x === Math.floor(this.game.width / 2) - 5) {
                    const turns = score.turns.toString().padStart(3, ' ');
                    display += `║ Turns: ${turns}  ║`;
                    x += 12;
                } else if (y === Math.floor(this.game.height / 2) + 3 && x === Math.floor(this.game.width / 2) - 5) {
                    display += "╠═════════════╣";
                    x += 12;
                } else if (y === Math.floor(this.game.height / 2) + 4 && x === Math.floor(this.game.width / 2) - 5) {
                    display += "║[Enter]retry ║";
                    x += 12;
                } else if (y === Math.floor(this.game.height / 2) + 5 && x === Math.floor(this.game.width / 2) - 5) {
                    display += "╚═════════════╝";
                    x += 12;
                } else {
                    // 背景を暗く
                    const tile = this.game.tiles[y][x];
                    display += `<span style="color: #333">${tile}</span>`;
                }
            }
            display += '\n';
        }

        container.innerHTML = display;
    }
} 