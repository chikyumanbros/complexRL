class Logger {
    constructor(game) {
        this.logElement = document.getElementById('message-log');
        this.codexPanelElement = document.getElementById('available-skills');
        this.messages = [];
        this.currentLookInfo = null;
        this.game = game;  // Store reference to the game
        this.floorInfo = null;  // Store floor information
        this.roomInfo = null;  // Store room information
        this.currentRoom = null;  // Store current room
        this.currentMonsterCount = 0;  // Store current monster count
        this.roomDescriptions = {
            bright: [
                "The room is brightly lit, every corner clearly visible.",
                "Bright light fills this chamber, leaving no shadows to hide in.",
                "A warm, luminous glow permeates the entire space.",
                "The chamber bathes in clear, revealing light."
            ],
            moderate: [
                "Shadows dance at the edges of this moderately lit room.",
                "The light here is neither bright nor dim, casting gentle shadows.",
                "A comfortable half-light fills the chamber.",
                "Patches of light and shadow create an intricate pattern."
            ],
            dim: [
                "Dark shadows dominate this dimly lit space.",
                "The room lies in near darkness, with only faint light penetrating.",
                "Thick shadows cling to every corner of this gloomy chamber.",
                "Darkness seems to swallow most of the light here."
            ],
            corridor: [
                "You are in a narrow corridor.",
                "Stone walls press close in this tight passage.",
                "The corridor stretches before you, cold and confined.",
                "Ancient stonework surrounds you in this narrow hallway."
            ],
            monsters: {
                many: [
                    "Numerous creatures lurk in the shadows.",
                    "The room teems with hostile presence.",
                    "Multiple threats move in the darkness.",
                    "You sense many dangerous entities nearby."
                ],
                several: [
                    "You sense several presences nearby.",
                    "A few creatures stir in the shadows.",
                    "Multiple beings share this space with you.",
                    "The room holds more than one threat."
                ],
                one: [
                    "You sense a presence nearby.",
                    "Something else is here with you.",
                    "A single entity lurks in this room.",
                    "One creature shares this space."
                ],
                none: [
                    "The room seems empty... for now.",
                    "No immediate threats are visible.",
                    "The space appears unoccupied.",
                    "Nothing stirs in the immediate vicinity."
                ]
            },
            doorKill: [
                "A shattered door lies in pieces, fresh blood staining its splintered remains.",
                "The remnants of a door scatter across the floor, still wet with recent violence.",
                "Dark crimson marks and broken hinges tell a tale of a deadly door trap.",
                "Wooden splinters and crimson droplets mark where a door once stood."
            ],
            meleeKill: [
                "The air still crackles with the energy of recent combat.",
                "The metallic scent of battle lingers in the air.",
                "Fresh marks of violence paint a grim scene.",
                "The aftermath of recent combat hangs heavy in the air."
            ]
        };
        this.messageColors = {
            bright: '#d4af37',      // Antique Gold
            moderate: '#8b8b8b',    // Calm Gray
            dim: '#4a4a4a',         // Darker Gray
            corridor: '#696969',    // Medium Gray
            monsters: {
                many: '#8b0000',    // Dark Red
                several: '#cd853f', // Peru (calm brown)
                one: '#bc8f8f',     // Rosy Brown
                none: '#556b2f'     // Dark Olive Green
            },
            floorInfo: {
                safe: '#90EE90',    // Light Green (safe)
                caution: '#FFD700',  // Gold (caution)
                danger: '#FF6B6B',   // Salmon Pink (danger)
                deadly: '#FF4500'    // Orange Red (deadly)
            },
            lookInfo: {
                monster: '#deb887', // Burlywood
                player: '#b8860b',  // Dark Goldenrod
                tile: '#708090'     // Slate Gray
            }
        };
    }

    add(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.className = type;  // Apply CSS class
        this.logElement.appendChild(messageDiv);
        this.logElement.scrollTop = this.logElement.scrollHeight;
    }

    // Update look information
    updateLookInfo(info) {
        this.currentLookInfo = info;
        if (this.game && this.game.mode === GAME_CONSTANTS.MODES.GAME) {
            this.renderLookPanel();
        }
    }

    // Update floor information
    updateFloorInfo(floorLevel, dangerLevel) {
        const dangerInfo = GAME_CONSTANTS.DANGER_LEVELS[dangerLevel];
        this.floorInfo = {
            flavor: dangerInfo.flavor,
            danger: Object.keys(GAME_CONSTANTS.DANGER_LEVELS).indexOf(dangerLevel)  // Convert to numeric index
        };
        if (this.game.mode === GAME_CONSTANTS.MODES.GAME) {
            this.renderLookPanel();
        }
    }

    // Update panel display
    updatePanel(game) {
        this.game = game;
        if (game.mode === GAME_CONSTANTS.MODES.CODEX) {
            game.renderer.renderCodexMenu();
        } else {
            this.renderLookPanel();
        }
    }

    // Update room information
    updateRoomInfo(room, monsterCount, isDoorKill = false, isMeleeKill = false) {
        if (this.shouldUpdateRoomInfo(room, monsterCount) || isDoorKill || isMeleeKill) {
            let roomInfo = '';
            let brightnessColor = '';
            let monsterColor = '';
            
            if (room) {
                // Select brightness description and corresponding color
                if (room.brightness >= 5) {
                    roomInfo = this.getRandomDescription('bright');
                    brightnessColor = this.messageColors.bright;
                } else if (room.brightness >= 3) {
                    roomInfo = this.getRandomDescription('moderate');
                    brightnessColor = this.messageColors.moderate;
                } else {
                    roomInfo = this.getRandomDescription('dim');
                    brightnessColor = this.messageColors.dim;
                }
            } else {
                roomInfo = this.getRandomDescription('corridor');
                brightnessColor = this.messageColors.corridor;
            }

            // Add combat description
            let combatDesc = '';
            if (isDoorKill) {
                combatDesc = this.getRandomDescription('doorKill');
            } else if (isMeleeKill) {
                combatDesc = this.getRandomDescription('meleeKill');
            }

            // Select monster presence description and its color (for both room and corridor)
            let monsterDesc = '';
            if (monsterCount > 3) {
                monsterDesc = this.getRandomDescription('monsters.many');
                monsterColor = this.messageColors.monsters.many;
            } else if (monsterCount > 1) {
                monsterDesc = this.getRandomDescription('monsters.several');
                monsterColor = this.messageColors.monsters.several;
            } else if (monsterCount === 1) {
                monsterDesc = this.getRandomDescription('monsters.one');
                monsterColor = this.messageColors.monsters.one;
            } else {
                monsterDesc = this.getRandomDescription('monsters.none');
                monsterColor = this.messageColors.monsters.none;
            }

            // Append line breaks (<br>) after each description
            roomInfo = `<span style="color: ${brightnessColor}">${roomInfo}</span><br>` +
                       (combatDesc ? `<span style="color: ${this.messageColors.monsters.many}">${combatDesc}</span><br>` : '') +
                       `<span style="color: ${monsterColor}">${monsterDesc}</span>`;

            this.roomInfo = roomInfo;
            this.currentRoom = room;
            this.currentMonsterCount = monsterCount;

            if (this.game.mode === GAME_CONSTANTS.MODES.GAME) {
                this.renderLookPanel();
            }
        }
    }

    shouldUpdateRoomInfo(room, monsterCount) {
        // Always update on first time
        if (!this.currentRoom && !room) {
            return this.currentMonsterCount !== monsterCount;
        }
        
        // When transitioning from a room to a corridor or vice versa
        if ((!this.currentRoom && room) || (this.currentRoom && !room)) {
            return true;
        }
        
        // Changes within the room
        if (this.currentRoom && room) {
            return this.currentRoom.x !== room.x || 
                   this.currentRoom.y !== room.y || 
                   this.currentRoom.brightness !== room.brightness ||
                   this.currentMonsterCount !== monsterCount;
        }
        
        // In corridors, update only if the monster count changes
        if (!this.currentRoom && !room) {
            return this.currentMonsterCount !== monsterCount;
        }
        
        return false;
    }

    getRandomDescription(path) {
        const descriptions = path.split('.').reduce((obj, key) => obj[key], this.roomDescriptions);
        return descriptions[Math.floor(Math.random() * descriptions.length)];
    }

    // Render look information panel
    renderLookPanel() {
        if (!this.codexPanelElement) return;

        let display = "=== ATMOSPHERE ===\n\n";
        if (this.floorInfo) {
            let colorKey = 'safe';
            if (this.floorInfo.danger >= 3) {
                colorKey = 'deadly';
            } else if (this.floorInfo.danger >= 2) {
                colorKey = 'danger';
            } else if (this.floorInfo.danger >= 1) {
                colorKey = 'caution';
            }
            
            // Split flavor text by '.' and add line breaks
            const flavorLines = this.floorInfo.flavor.split('.');
            const coloredLines = flavorLines
                .filter(line => line.trim())
                .map(line => `<span style="color: ${this.messageColors.floorInfo[colorKey]}">${line.trim()}.</span><br>`)
                .join('');
            
            display += `${coloredLines}\n`;
        }
        
        display += "\n=== SURROUNDINGS ===\n\n";
        if (this.roomInfo) {
            display += `${this.roomInfo}\n`;
        }
        
        display += "\n=== LOOK INFO ===\n\n";
        if (this.currentLookInfo) {
            // If it's monster information
            if (this.currentLookInfo.includes("Level")) {
                display += `<span style="color: ${this.messageColors.lookInfo.monster}">${this.currentLookInfo}</span>`;
            }
            // If it's player information
            else if (this.currentLookInfo.includes("yourself")) {
                display += `<span style="color: ${this.messageColors.lookInfo.player}">${this.currentLookInfo}</span>`;
            }
            // If it's tile information
            else {
                display += `<span style="color: ${this.messageColors.lookInfo.tile}">${this.currentLookInfo}</span>`;
            }
        } else {
            display += `<span style="color: ${this.messageColors.lookInfo.tile}">Use look mode (;) to examine surroundings</span>`;
        }

        this.codexPanelElement.innerHTML = display.replace(/\n(?!<)/g, '<br>');
    }

    render() {
        const logElement = document.getElementById('log-panel');
        if (!logElement) return;

        logElement.innerHTML = this.messages
            .map(msg => `<div style="color: ${msg.color}">${msg.text}</div>`)
            .join('');
    }

    clear() {
        this.messages = [];
        this.logElement.innerHTML = '';
    }

    showGameOverMessage(finalScore) {
        this.add("=================", "important");
        this.add("GAME OVER", "death");
        this.add("Final Score:", "important");
        this.add(`Monsters Defeated: ${finalScore.monstersKilled}`, "important");
        this.add(`Codex Points: ${finalScore.codexPoints}`, "important");
        this.add(`Survived Turns: ${finalScore.turns}`, "important");
        this.add("=================", "important");
        this.add("Press Enter to restart", "info");
    }
} 