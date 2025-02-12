class Renderer {
    constructor(game) {
        this.game = game;
        this.highlightedTile = null;
        this.movementEffects = null;
        this.spriteColorCache = new Map();
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
        // Initialize movement effects state
        if (!this.movementEffects) {
            this.movementEffects = new Set();
        }

        this.renderMap();
        this.renderStatus();

        // Apply meditation effect
        if (this.game.player.meditation && this.game.player.meditation.active) {
            this.showMeditationEffect(this.game.player.x, this.game.player.y);
        }

        // Apply movement effects
        this.movementEffects.forEach(effect => {
            const tile = document.querySelector(`#game span[data-x="${effect.x}"][data-y="${effect.y}"]`);
            if (tile) {
                tile.classList.add('movement-trail');
            }
        });

        // Display highlighted target
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
                const range = skill ? skill.range : 1; // Treat as melee attack if the skill is not found
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
            this.game.getVisibleTiles().map(({ x, y }) => `${x},${y}`)
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

                // Declare data attributes with let
                let dataAttrs = `data-x="${x}" data-y="${y}"`;

                // Check for door-kill effect
                const isDoorKillTarget = this.game.lastDoorKillLocation &&
                    this.game.lastDoorKillLocation.x === x &&
                    this.game.lastDoorKillLocation.y === y;

                if (isDoorKillTarget) {
                    classes.push('door-kill');
                }

                // Highlight for look mode or skill targeting
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

                // 攻撃エフェクトの条件チェック
                const isAttackTarget = this.game.lastAttackLocation &&
                    this.game.lastAttackLocation.x === x &&
                    this.game.lastAttackLocation.y === y;

                if (isAttackTarget && this.game.lastAttackHit === true) {  // 厳密な比較を使用
                    classes.push('melee-attack');
                }

                // Render player, monster, and tile
                if (x === this.game.player.x && y === this.game.player.y) {
                    content = this.game.player.char;
                    
                    // 体力状態に基づいて色を設定
                    const healthStatus = this.game.player.getHealthStatus(this.game.player.hp, this.game.player.maxHp);
                    style = `color: ${healthStatus.color}`;

                } else {
                    const monster = this.game.getMonsterAt(x, y);
                    if (monster && isVisible) {
                        content = monster.char;
                        // モンスターは元の色を維持
                        style = `color: ${GAME_CONSTANTS.COLORS.MONSTER[monster.type]}`;

                        // Apply styles based on monster state
                        if (monster.isSleeping) {
                            style += '; animation: sleeping-monster 1s infinite';
                        }
                        if (monster.hasStartedFleeing) {
                            style += '; opacity: 0.8';
                        }
                    } else {
                        content = this.game.tiles[y][x];
                        const tile = this.game.tiles[y][x];

                        // Set color for special tiles
                        if (tile === GAME_CONSTANTS.STAIRS.CHAR) {
                            style = `color: ${GAME_CONSTANTS.STAIRS.COLOR}`;
                        } else {
                            style = `color: ${this.game.colors[y][x]}`;
                        }
                    }
                }

                // Display tiles outside vision as dark
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
                return 'rgba(100, 100, 255, 0.3)';  // Blueish background for sleeping monsters
            }
            return 'rgba(255, 100, 100, 0.3)';  // Reddish background for normal monsters
        }
        return 'rgba(255, 255, 255, 0.2)';  // Standard highlight
    }

    renderStatus() {
        const player = this.game.player;

        // Calculate penalty based on surrounding monsters count (15% penalty per monster, limited to 60%)
        const surroundingMonsters = player.countSurroundingMonsters(this.game);
        const penaltyPerMonster = 15; // 15% penalty per monster
        const surroundingPenalty = Math.min(60, Math.max(0, (surroundingMonsters - 1) * penaltyPerMonster)) / 100;

        // Update floor level element
        const floorLevelElement = document.getElementById('floor-level');
        if (floorLevelElement) {
            const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[this.game.dangerLevel];
            floorLevelElement.innerHTML = `${this.game.floorLevel} <span style="color: ${dangerInfo.color}">[${dangerInfo.name}]</span>`;
        }

        // Update HP numerical and bar display
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
            const hpBars = Math.ceil((player.hp / player.maxHp) * 20);
            const hpText = '|'.repeat(hpBars).padEnd(20, ' ');
            hpTextElement.textContent = hpText;
            // 体力状態に基づいてクラスを設定
            const healthStatus = player.getHealthStatus(player.hp, player.maxHp);
            hpTextElement.className = ''; // Clear existing classes
            hpTextElement.classList.add(healthStatus.name.toLowerCase().replace(' ', '-'));
        }

        // 体力状態名の表示を追加
        const healthStatusElement = document.getElementById('health-status');
        if (healthStatusElement) {
            const healthStatus = player.getHealthStatus(player.hp, player.maxHp);
            healthStatusElement.innerHTML = `<span style="color: ${healthStatus.color}">${healthStatus.name}</span>`;
        }

        // Update player level display
        const levelElement = document.getElementById('level');
        if (levelElement) {
            levelElement.textContent = player.level;
        }

        // Update XP numerical and bar display
        const xpElement = document.getElementById('xp');
        if (xpElement) {
            xpElement.textContent = `${player.xp}/${player.xpToNextLevel}`;
        }

        // Update other stats display
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

        // Update accuracy display
        const accuracyElement = document.getElementById('accuracy');
        if (accuracyElement) {
            const baseAccuracy = Math.floor(player.accuracy * (1 - surroundingPenalty));
            let accText = surroundingPenalty > 0
                ? `<span style="color: #e74c3c">${baseAccuracy}%</span>`
                : `${baseAccuracy}%`;

            // 修飾効果の累積を計算
            let totalAccuracyMod = 0;
            if (player.nextAttackModifiers && player.nextAttackModifiers.length > 0) {
                for (const mod of player.nextAttackModifiers) {
                    if (mod.accuracyMod) totalAccuracyMod += mod.accuracyMod;
                }
                const modifiedAcc = Math.floor(baseAccuracy * (1 + totalAccuracyMod));
                accText = `<span style="color: ${totalAccuracyMod > 0 ? '#2ecc71' : '#e74c3c'}">${modifiedAcc}%</span>`;
            }
            accuracyElement.innerHTML = accText;
        }

        // Update evasion display
        const evasionElement = document.getElementById('evasion');
        if (evasionElement) {
            const baseEvasion = Math.floor(player.evasion * (1 - surroundingPenalty));
            evasionElement.innerHTML = surroundingPenalty > 0
                ? `<span style="color: #e74c3c">${baseEvasion}%</span>`
                : `${baseEvasion}%`;
        }

        // Update detailed attack and defense values display
        const attackElement = document.getElementById('attack');
        if (attackElement) {
            let attackText = `${player.attackPower.base}+${player.attackPower.diceCount}d${player.attackPower.diceSides}`;

            // 修飾効果の累積を計算
            let totalDamageMod = 1;
            if (player.nextAttackModifiers && player.nextAttackModifiers.length > 0) {
                for (const mod of player.nextAttackModifiers) {
                    if (mod.damageMod) totalDamageMod *= mod.damageMod;
                }
                if (totalDamageMod !== 1) {
                    const damageColor = totalDamageMod > 1 ? '#2ecc71' : '#e74c3c';
                    attackText = `${player.attackPower.base}+${player.attackPower.diceCount}d${player.attackPower.diceSides} ×${totalDamageMod.toFixed(1)}`;
                    attackText = `<span style="color: ${damageColor}">${attackText}</span>`;
                }
            }
            attackElement.innerHTML = attackText;
        }
        const defenseElement = document.getElementById('defense');
        if (defenseElement) {
            defenseElement.textContent = `${player.defense.base}+${player.defense.diceCount}d${player.defense.diceSides}`;
        }
        const speedElement = document.getElementById('speed');
        if (speedElement) {
            let baseSpeed = GAME_CONSTANTS.FORMULAS.SPEED(player.stats);
            let speedText = `${baseSpeed}`;

            // 修飾効果の累積を計算
            let totalSpeedMod = 0;
            if (player.nextAttackModifiers && player.nextAttackModifiers.length > 0) {
                for (const mod of player.nextAttackModifiers) {
                    if (mod.speedMod) totalSpeedMod += mod.speedMod;
                }
                if (totalSpeedMod !== 0) {
                    const modifiedSpeed = Math.floor(baseSpeed * (1 + totalSpeedMod));
                    speedText = `<span style="color: ${totalSpeedMod > 0 ? '#2ecc71' : '#e74c3c'}">${modifiedSpeed}</span>`;
                }
            }
            speedElement.innerHTML = speedText;
        }

        // Update skill list display (only slots 1-9)
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

        // Update visible monsters list display
        const monstersInSightElement = document.getElementById('nearby-enemies');
        if (monstersInSightElement) {
            const visibleTiles = new Set(
                this.game.getVisibleTiles().map(({ x, y }) => `${x},${y}`)
            );

            const visibleMonsters = this.game.monsters.filter(monster =>
                visibleTiles.has(`${monster.x},${monster.y}`)
            );

            if (visibleMonsters.length > 0) {
                const monsterList = visibleMonsters.map(monster => {
                    const healthStatus = monster.getHealthStatus(monster.hp, monster.maxHp);
                    const healthClass = healthStatus.name.toLowerCase().replace(' ', '-');

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

        // Update perception display
        const perceptionElement = document.getElementById('perception');
        if (perceptionElement) {
            perceptionElement.textContent = player.perception;
        }
    }

    renderCodexMenu() {
        const display = this.game.codexSystem.getMenuDisplay(this.game.player);  // Pass the player object
        document.getElementById('available-skills').innerHTML = display.replace(/\n/g, '<br>');
    }

    // New: Method to clean up effects
    clearEffects() {
        if (this.game.lastAttackLocation) {
            this.game.lastAttackLocation = null;
            this.game.lastAttackHit = false;  // フラグをリセット
            this.render();
        }

        // Clean up skill usage effect
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

    // New method for next attack modifier effect
    showNextAttackModifierEffect(x, y) {
        const playerChar = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        console.log('Player char element:', playerChar); // Debug log
        if (playerChar) {
            playerChar.classList.add('next-attack-modifier');
            console.log('Added next-attack-modifier class'); // Debug log
            setTimeout(() => {
                playerChar.classList.remove('next-attack-modifier');
                console.log('Removed next-attack-modifier class'); // Debug log
            }, 500);
        }
    }
    // New method for meditation effect
    showMeditationEffect(x, y) {
        const playerChar = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        if (playerChar && this.game.player.meditation && this.game.player.meditation.active) {
            playerChar.classList.add('meditation-effect');
        }
    }
    // New method for movement trail effect
    showMovementTrailEffect(fromX, fromY, toX, toY) {
        // Clear existing effects
        this.movementEffects = new Set();

        // Calculate trail from start to end
        const dx = toX - fromX;
        const dy = toY - fromY;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));

        // Calculate each point in the trail
        for (let i = 0; i <= steps; i++) {
            const x = Math.round(fromX + (dx * i / steps));
            const y = Math.round(fromY + (dy * i / steps));
            this.movementEffects.add({ x, y });

            // Remove effect from each point with a delay
            setTimeout(() => {
                this.movementEffects.delete({ x, y });
                this.render();
            }, 100 + (i * 50)); // Remove sequentially with a time delay
        }

        // Force re-rendering
        this.render();

        // Clear all effects after a constant time delay
        setTimeout(() => {
            this.movementEffects.clear();
            this.render();
        }, 100 + (steps * 50) + 100);
    }

    showLevelUpEffect(x, y) {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        // Retrieve player tile element using data-x, data-y attributes
        const playerTile = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        let centerX, centerY;
        if (playerTile) {
            // Calculate relative position from #game-container (effect layer's parent)
            const gameContainer = document.getElementById('game-container');
            const containerRect = gameContainer ? gameContainer.getBoundingClientRect() : { left: 0, top: 0 };
            const tileRect = playerTile.getBoundingClientRect();
            centerX = tileRect.left - containerRect.left;
            centerY = tileRect.top - containerRect.top;
        } else {
            // Fallback calculation if player tile is not found
            const tileElement = document.querySelector('#game span');
            const tileSize = tileElement ? tileElement.offsetWidth : 15;
            centerX = x * tileSize;
            centerY = y * tileSize;
        }

        const particleCount = 50;
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

        // Retrieve current player tile element (identified by data-x, data-y attributes)
        const playerTile = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        let centerX, centerY;
        if (playerTile) {
            const gameContainer = document.getElementById('game-container');
            // If gameContainer does not exist, fallback to { left: 0, top: 0 }
            const containerRect = gameContainer ? gameContainer.getBoundingClientRect() : { left: 0, top: 0 };
            const tileRect = playerTile.getBoundingClientRect();
            centerX = tileRect.left - containerRect.left + tileRect.width / 2;
            centerY = tileRect.top - containerRect.top + tileRect.height / 2;
        } else {
            const tileElement = document.querySelector('#game span');
            const tileSize = tileElement ? tileElement.offsetWidth : 15;
            centerX = x * tileSize + tileSize / 2;
            centerY = y * tileSize + tileSize / 2;
        }

        // Calculate bottom position relative to player center based on particleLayer height
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
    
        // Update floor level element
        const floorLevelElement = document.getElementById('floor-level');
        if (floorLevelElement) {
            const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[this.game.dangerLevel];
            floorLevelElement.innerHTML = `${this.game.floorLevel} <span style="color: ${dangerInfo.color}">[${dangerInfo.name}]</span>`;
        }
    
        // Update level display
        const levelElement = document.getElementById('level');
        if (levelElement) {
            levelElement.textContent = status.level;
        }
    
        // Update HP and Health Status display
        const hpElement = document.getElementById('hp');
        const maxHpElement = document.getElementById('max-hp');
        const healthStatusElement = document.getElementById('health-status');
        if (hpElement && maxHpElement) {
            const [currentHp, maxHp] = status.hp.split('/');
            hpElement.textContent = currentHp;
            maxHpElement.textContent = maxHp;
    
            // HPの割合に基づいて色を設定
            const hpPercentage = (parseInt(currentHp) / parseInt(maxHp)) * 100;
            let healthColor = '#ffffff'; // デフォルト白
            if (hpPercentage <= 25) {
                healthColor = '#e74c3c'; // Near Death（赤）
            } else if (hpPercentage <= 50) {
                healthColor = '#e67e22'; // Badly Wounded（オレンジ）
            } else if (hpPercentage <= 75) {
                healthColor = '#f1c40f'; // Wounded（黄色）
            }
            
            if (healthStatusElement) {
                healthStatusElement.innerHTML = `<span style="color: ${healthColor}">${status.healthStatus}</span>`;
            }
        }
    
        // Update base stats
        for (const [key, value] of Object.entries(status.stats)) {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = value;
            }
        }
    
        // Update derived stats (using innerHTML to allow HTML tags)
        for (const [key, value] of Object.entries(status.derived)) {
            const element = document.getElementById(key);
            if (element) {
                element.innerHTML = value;
            }
        }
    
        // Update XP display
        const xpElement = document.getElementById('xp');
        if (xpElement) {
            xpElement.textContent = status.xp;
        }
    
        // Update Codex points display
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
        // 左列と右列のコンテンツを別々に作成
        let leftColumn = '';
        let rightColumn = '';

        // 左列：コントロール
        leftColumn += `<div style="color: #ffd700; font-size: 12px; margin-bottom: 8px;">■ CONTROLS</div>\n`;
        const categories = Object.entries(GAME_CONSTANTS.CONTROLS);
        categories.forEach(([category, data]) => {
            leftColumn += `<div style="color: #66ccff; font-size: 11px; margin-top: 6px;">● ${data.title}</div>\n`;
            data.keys.forEach(keyInfo => {
                leftColumn += `<div style="margin-left: 8px;">`;
                leftColumn += `<span style="color: #2ecc71; display: inline-block; width: 50px;">[${keyInfo.key}]</span>`;
                leftColumn += `<span style="color: #ecf0f1;">${keyInfo.desc}</span>`;
                leftColumn += `</div>\n`;
            });
        });

        // 右列：戦闘システム
        rightColumn += `<div style="color: #ffd700; font-size: 12px; margin-bottom: 8px;">■ COMBAT SYSTEM</div>\n`;

        // Attack & Defense
        rightColumn += `<div style="color: #3498db; margin-bottom: 4px;">● Base Stats</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `ATK: STR - (DEX/3)\n`;
        rightColumn += `DEF: CON - (STR/3)\n`;
        rightColumn += `</div>\n`;

        rightColumn += `<div style="color: #3498db; margin-top: 8px; margin-bottom: 4px;">● Combat Dice</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `ATK: Base + (DEX/5)d(STR/5×3)\n`;
        rightColumn += `DEF: Base + (STR/5)d(CON/5×3)\n`;
        rightColumn += `</div>\n`;

        rightColumn += `<div style="color: #3498db; margin-top: 8px; margin-bottom: 4px;">● Hit Chance</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `ACC: 50 + DEX + INT - (CON/3)\n`;
        rightColumn += `EVA: DEX + INT - (CON/3)\n`;
        rightColumn += `SPD: DEX - ((STR + CON)/10)\n`;
        rightColumn += `PER: (DEX + WIS + INT - (STR + CON)/2) / 2\n`;
        rightColumn += `</div>\n`;

        rightColumn += `<div style="color: #3498db; margin-top: 8px; margin-bottom: 4px;">● Combat Flow</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `1. Speed Check\n`;
        rightColumn += `2. ACC vs Roll(100)\n`;
        rightColumn += `3. EVA vs Roll(100)\n`;
        rightColumn += `4. DMG = ATK - DEF\n`;
        rightColumn += `</div>\n`;

        rightColumn += `<div style="color: #3498db; margin-top: 8px; margin-bottom: 4px;">● Penalties</div>\n`;
        rightColumn += `<div style="margin-left: 8px; color: #ecf0f1;">`;
        rightColumn += `Surrounded: -15% ACC/EVA per enemy\n`;
        rightColumn += `(Max: -60%)\n`;
        rightColumn += `</div>\n`;

        // 2列レイアウトを作成
        const display = `
            <div style="display: flex; justify-content: space-between; gap: 20px;">
                <div style="flex: 1;">${leftColumn}</div>
                <div style="flex: 1;">${rightColumn}</div>
            </div>
            <div style="text-align: center; margin-top: 12px; color: #7f8c8d;">[ESC] to return</div>
        `;

        return display;
    }

    showDeathEffect(x, y, color = '#9B2222') {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        // 対象のタイルの位置を取得
        const targetTile = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);

        let centerX, centerY;
        if (targetTile) {
            const gameContainer = document.getElementById('game-container');
            const containerRect = gameContainer ? gameContainer.getBoundingClientRect() : { left: 0, top: 0 };
            const tileRect = targetTile.getBoundingClientRect();
            centerX = tileRect.left - containerRect.left;
            centerY = tileRect.top - containerRect.top;
        } else {
            const tileElement = document.querySelector('#game span');
            const tileSize = tileElement ? tileElement.offsetWidth : 15;
            centerX = x * tileSize;
            centerY = y * tileSize;
        }

        const particleCount = 50;
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('death-particle');
            particle.style.left = centerX + "px";
            particle.style.top = centerY + "px";
            particle.style.backgroundColor = color;

            const angle = Math.random() * Math.PI * 2;
            const distance = 15 + Math.random() * 25;
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

    drawMonsterSprite(canvas, monsterType, monsterId = null) {
        const ctx = canvas.getContext('2d');
        const sprite = GAME_CONSTANTS.MONSTER_SPRITES[monsterType];
        if (!sprite) return;

        // キャンバスをクリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const spriteWidth = sprite[0].length;
        const spriteHeight = sprite.length;
        const pixelSize = 8;

        // キャンバスサイズをスプライトサイズに合わせて調整
        canvas.width = spriteWidth * pixelSize;
        canvas.height = spriteHeight * pixelSize;

        // キャッシュキーを生成（モンスターIDがある場合は個体別のキーを使用）
        const cacheKey = monsterId ? `${monsterType}_${monsterId}` : monsterType;

        // このモンスターのカラーキャッシュを取得または生成
        if (!this.spriteColorCache.has(cacheKey)) {
            const colorMap = new Map();
            sprite.forEach((row, y) => {
                [...row].forEach((pixel, x) => {
                    const key = `${x},${y}`;
                    const baseColor = GAME_CONSTANTS.SPRITE_COLORS[pixel];
                    colorMap.set(key, GAME_CONSTANTS.SPRITE_COLORS.getRandomizedColor(baseColor));
                });
            });
            this.spriteColorCache.set(cacheKey, colorMap);
        }

        // キャッシュされた色を使用して描画
        const colorMap = this.spriteColorCache.get(cacheKey);
        sprite.forEach((row, y) => {
            [...row].forEach((pixel, x) => {
                const color = colorMap.get(`${x},${y}`);
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(
                        x * pixelSize,
                        y * pixelSize,
                        pixelSize,
                        pixelSize
                    );
                }
            });
        });
    }

    previewMonsterSprite(monsterType, containerId, pixelSize = 8) {
        const sprite = GAME_CONSTANTS.MONSTER_SPRITES[monsterType];
        if (!sprite) {
            console.error(`Sprite not found for monster type: ${monsterType}`);
            return;
        }

        const spriteWidth = sprite[0].length;
        const spriteHeight = sprite.length;

        // コンテナ要素を取得
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container element not found with ID: ${containerId}`);
            return;
        }
        container.style.display = 'block';

        // 既存のcanvasがあれば削除
        const existingCanvas = container.querySelector('canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        // canvas要素を作成
        const canvas = document.createElement('canvas');
        canvas.width = spriteWidth * pixelSize;
        canvas.height = spriteHeight * pixelSize;
        const ctx = canvas.getContext('2d');

        // スプライトの描画
        sprite.forEach((row, y) => {
            [...row].forEach((pixel, x) => {
                const color = GAME_CONSTANTS.SPRITE_COLORS[pixel];
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
                }
            });
        });

        // canvasをコンテナに追加
        container.appendChild(canvas);
    }

    examineTarget(targetX, targetY, lookMode = false) {
        let monster = this.game.getMonsterAt(targetX, targetY);

        if (!lookMode && this.game.lastCombatMonster && this.game.lastCombatMonster.hp > 0) {
            monster = this.game.lastCombatMonster;
            targetX = monster.x;
            targetY = monster.y;
        }

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'flex-start';
        container.style.gap = '50px';
        container.style.border = 'none';
        container.style.padding = '0';

        const infoDiv = document.createElement('div');
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

            const healthStatus = monster.getHealthStatus(monster.hp, monster.maxHp);
            let status = [];

            // --- Basic Information ---
            let lookInfo = [
                `${monster.name} (Level ${monster.level}):`,
                `HP: ${Math.max(0, monster.hp)}/${monster.maxHp} [<span style="color: ${healthStatus.color}">${healthStatus.name}</span>]`,
                `Distance: ${Math.max(Math.abs(this.game.player.x - targetX), Math.abs(this.game.player.y - targetY))} tiles`
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

            const spriteDiv = document.createElement('div');
            spriteDiv.style.border = 'none';
            spriteDiv.style.padding = '0';

            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            canvas.style.imageRendering = 'pixelated';
            canvas.style.background = 'transparent';
            canvas.style.display = 'block';

            spriteDiv.appendChild(canvas);
            this.drawMonsterSprite(canvas, monster.type, monster.id);

            container.appendChild(infoDiv);
            container.appendChild(spriteDiv);
        } else if (targetX === this.game.player.x && targetY === this.game.player.y) {
            infoDiv.innerHTML = "You see yourself here.";
            container.appendChild(infoDiv);
        } else {
            const tile = this.game.tiles[targetY][targetX];
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
            } else if (GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(tile)) {
                lookInfo = "You see a massive stone pillar blocking your view.";
            } else if (GAME_CONSTANTS.TILES.OBSTACLE.TRANSPARENT.includes(tile)) {
                lookInfo = "You see some decorative furniture.";
            } else {
                lookInfo = `You see ${tile} here.`;
            }
            infoDiv.innerHTML = lookInfo;
            container.appendChild(infoDiv);
        }

        this.game.logger.updateLookInfo(container);
    }

    showMissEffect(x, y, type = 'miss') {
        const particleLayer = document.getElementById('particle-layer');
        if (!particleLayer) return;

        // 対象のタイルの位置を取得
        const targetTile = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        
        let centerX, centerY;
        if (targetTile) {
            const gameContainer = document.getElementById('game-container');
            const containerRect = gameContainer ? gameContainer.getBoundingClientRect() : { left: 0, top: 0 };
            const tileRect = targetTile.getBoundingClientRect();
            centerX = tileRect.left - containerRect.left;
            centerY = tileRect.top - containerRect.top;
        } else {
            const tileElement = document.querySelector('#game span');
            const tileSize = tileElement ? tileElement.offsetWidth : 15;
            centerX = x * tileSize;
            centerY = y * tileSize;
        }

        // エフェクトの設定
        const config = {
            miss: {
                color: '#ffff00',
                size: 20,
                duration: '0.4s'
            },
            evade: {
                color: '#00FFFF',
                size: 24,
                duration: '0.5s'
            }
        };

        const settings = config[type];
        
        // リングエフェクトの生成
        const ring = document.createElement('div');
        ring.classList.add('miss-ring');
        
        // リングのスタイル設定
        ring.style.left = (centerX - settings.size/2) + "px";
        ring.style.top = (centerY - settings.size/2) + "px";
        ring.style.width = settings.size + "px";
        ring.style.height = settings.size + "px";
        ring.style.borderColor = settings.color;
        ring.style.animationDuration = settings.duration;

        particleLayer.appendChild(ring);

        // アニメーション終了時に要素を削除
        ring.addEventListener('animationend', () => {
            ring.remove();
        });
    }
}