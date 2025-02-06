// ==============================================
// Renderer Class: Main Rendering and Effects Management
// This class handles map rendering, status updates, and visual effects for the game.
// ==============================================
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

                // Check for melee attack effect
                const isAttackTarget = this.game.lastAttackLocation && 
                                     this.game.lastAttackLocation.x === x && 
                                     this.game.lastAttackLocation.y === y;
                
                if (isAttackTarget) {
                    classes.push('melee-attack');
                }

                // Render player, monster, and tile
                if (x === this.game.player.x && y === this.game.player.y) {
                    content = this.game.player.char;
                    style = 'color: white';
                    
                } else {
                    const monster = this.game.getMonsterAt(x, y);
                    if (monster && isVisible) {
                        content = monster.char;
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
            const hpBars = Math.ceil((player.hp / player.maxHp) * 15);
            const hpText = '|'.repeat(hpBars).padEnd(15, ' ');
            hpTextElement.textContent = hpText;
            // Add class based on HP percentage
            const hpPercentage = (player.hp / player.maxHp) * 100;
            hpTextElement.className = ''; // Clear existing classes
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
            
            // Change display if there's an accuracy modifier
            if (player.nextAttackModifier && player.nextAttackModifier.accuracyMod) {
                const modifiedAcc = Math.floor(baseAccuracy * (1 + player.nextAttackModifier.accuracyMod));
                accText = `<span style="color: ${player.nextAttackModifier.accuracyMod > 0 ? '#2ecc71' : '#e74c3c'}">${modifiedAcc}%</span>`;
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
            
            // Change display if there is an attack modifier
            if (player.nextAttackModifier) {
                const modifiedDamage = Math.floor(player.attackPower.base * player.nextAttackModifier.damageMod);
                // Use normal color if damageMod is 1.0
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
                this.game.getVisibleTiles().map(({x, y}) => `${x},${y}`)
            );
            
            const visibleMonsters = this.game.monsters.filter(monster => 
                visibleTiles.has(`${monster.x},${monster.y}`)
            );

            if (visibleMonsters.length > 0) {
                const monsterList = visibleMonsters.map(monster => {
                    const healthPercentage = (monster.hp / monster.maxHp) * 100;
                    
                    // Determine class based on HP percentage
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
        const display = this.game.codexSystem.getMenuDisplay(this.game.player);  // Pass the player object
        document.getElementById('available-skills').innerHTML = display.replace(/\n/g, '<br>');
    }

    // New: Method to clean up effects
    clearEffects() {
        if (this.game.lastAttackLocation) {
            this.game.lastAttackLocation = null;
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
            this.movementEffects.add({x, y});
            
            // Remove effect from each point with a delay
            setTimeout(() => {
                this.movementEffects.delete({x, y});
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
            centerX = tileRect.left - containerRect.left + tileRect.width / 2;
            centerY = tileRect.top - containerRect.top + tileRect.height / 2;
        } else {
            // Fallback calculation if player tile is not found (not recommended)
            const tileElement = document.querySelector('#game span');
            const tileSize = tileElement ? tileElement.offsetWidth : 14;
            centerX = x * tileSize + tileSize / 2;
            centerY = y * tileSize + tileSize / 2;
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
            const tileSize = tileElement ? tileElement.offsetWidth : 14;
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

        // Update HP display
        const hpElement = document.getElementById('hp');
        const maxHpElement = document.getElementById('max-hp');
        if (hpElement && maxHpElement) {
            hpElement.textContent = status.hp.split('/')[0];
            maxHpElement.textContent = status.hp.split('/')[1];
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
        let display = '';

        // Main title (centered)
        display += `<div style="color: #ffd700; font-size: 12px; text-align: center;">=== CONTROLS ===</div>\n\n`;

        // Display by category
        const categories = Object.entries(GAME_CONSTANTS.CONTROLS);
        categories.forEach(([category, data], idx) => {
            // Category title
            display += `<div style="color: #66ccff; font-size: 12px; margin-top: 15px;">=== ${data.title} ===</div>\n`;
            
            // Key and description (with indent)
            data.keys.forEach(keyInfo => {
                display += `<div style="margin-left: 10px;">`;
                display += `<span style="color: #2ecc71; display: inline-block; width: 100px;">[${keyInfo.key}]</span>`;
                display += `<span style="color: #ecf0f1;">${keyInfo.desc}</span>`;
                display += `</div>\n`;
            });
            
            // Add line break between categories if multiple exist
            if (idx < categories.length - 1) {
                display += `<br>\n`;
            }
        });
        
        // Combat System Tips
        display += `<br><div style="color: #e74c3c; text-align: center;">=== COMBAT SYSTEM ===</div>\n\n`;
        
        // Attack Roll
        display += `<div style="color: #f1c40f;">■ Attack (ATK)</div>\n`;
        display += `<div style="margin-left: 10px; color: #ecf0f1;">`;
        display += `Base: STR - (DEX/2)\n`;
        display += `Dice: (DEX/5)d(STR/5×3)\n`;
        display += `Total = Base + Dice Roll\n`;
        display += `</div>\n\n`;

        // Defense Roll
        display += `<div style="color: #f1c40f;">■ Defense (DEF)</div>\n`;
        display += `<div style="margin-left: 10px; color: #ecf0f1;">`;
        display += `Base: CON - (STR/2)\n`;
        display += `Dice: (STR/5)d(CON/5×3)\n`;
        display += `Total = Base + Dice Roll\n`;
        display += `</div>\n\n`;

        // Accuracy and Evasion
        display += `<div style="color: #f1c40f;">■ Accuracy & Evasion</div>\n`;
        display += `<div style="margin-left: 10px; color: #ecf0f1;">`;
        display += `Accuracy (ACC): 50 + (DEX×1.5)\n`;
        display += `Evasion (EVA): DEX×1.2\n`;
        display += `</div>\n\n`;

        // Combat Flow with Opportunity Attack details
        display += `<div style="color: #f1c40f;">■ Combat Flow</div>\n`;
        display += `<div style="margin-left: 10px; color: #ecf0f1;">`;
        display += `1. Speed Check (DEX - (STR+CON)/10)\n`;
        display += `2. Accuracy vs Roll (100)\n`;
        display += `3. Evasion vs Roll (100)\n`;
        display += `4. Damage = ATK Roll - DEF Roll\n`;
        display += `</div>\n\n`;

        // Opportunity Attack explanation
        display += `<div style="color: #f1c40f;">■ Opportunity Attack</div>\n`;
        display += `<div style="margin-left: 10px; color: #ecf0f1;">`;
        display += `Triggers:\n`;
        display += `・Moving away from adjacent enemies\n`;
        display += `・Moving through enemy-adjacent tiles\n\n`;
        display += `Effects:\n`;
        display += `・Enemy makes an immediate attack\n`;
        display += `・-30% Accuracy penalty\n`;
        display += `・+50% Damage bonus\n`;
        display += `・Multiple enemies can trigger simultaneously\n`;
        display += `</div>\n\n`;

        // Combat Penalties
        display += `<div style="color: #f1c40f;">■ Combat Penalties</div>\n`;
        display += `<div style="margin-left: 10px; color: #ecf0f1;">`;
        display += `Surrounded: -15% ACC/EVA per enemy (max -60%)\n`;
        display += `</div>\n\n`;
        
        // Footer
        display += `<div style="text-align: center;">Press [ESC] to return to game</div>\n`;
        
        return display;
    }

    showDeathEffect(x, y, color = '#ff6b6b') {
        const particleLayer = document.getElementById('particle-layer');
        //console.log('Particle layer:', particleLayer); // デバッグログ
        if (!particleLayer) {
            //console.error('Particle layer not found!'); // エラーログ
            return;
        }
    
        // 対象のタイルの位置を取得
        const targetTile = document.querySelector(`#game span[data-x="${x}"][data-y="${y}"]`);
        //console.log('Target tile:', targetTile, 'at', x, y); // デバッグログ
        
        let centerX, centerY;
        if (targetTile) {
            const gameContainer = document.getElementById('game-container');
            const containerRect = gameContainer ? gameContainer.getBoundingClientRect() : { left: 0, top: 0 };
            const tileRect = targetTile.getBoundingClientRect();
            centerX = tileRect.left - containerRect.left + tileRect.width / 2;
            centerY = tileRect.top - containerRect.top + tileRect.height / 2;
            //console.log('Position calculated:', centerX, centerY); // デバッグログ
        } else {
            const tileElement = document.querySelector('#game span');
            const tileSize = tileElement ? tileElement.offsetWidth : 14;
            centerX = x * tileSize + tileSize / 2;
            centerY = y * tileSize + tileSize / 2;
            //console.log('Fallback position:', centerX, centerY); // デバッグログ
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
            //console.log('Particle created:', i); // デバッグログ
            
            particle.addEventListener('animationend', () => {
                particle.remove();
                //console.log('Particle removed:', i); // デバッグログ
            });
        }
    }
}