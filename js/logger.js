class Logger {
    constructor(game) {
        this.logElement = document.getElementById('message-log');
        this.codexPanelElement = document.getElementById('available-skills');
        this.messages = [];
        this.maxMessages = 100; // メッセージの最大数を設定
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
            ],
            portal: [
                "A shimmering portal pulses with arcane energy nearby.",
                "The air crackles around a mysterious gateway.",
                "A portal's soft hum resonates through the area.",
                "Magical energies swirl around a nearby portal."
            ],
            voidportal: [
                "A dark portal emanates an unsettling void energy.",
                "Shadows writhe around a sinister void gateway.",
                "An ominous void portal tears at the fabric of reality.",
                "The darkness deepens around a threatening void portal."
            ],
            nexus: [
                "You stand in the Nexus, a sanctuary between worlds.",
                "The Nexus hums with ancient protective magic.",
                "Safe haven surrounds you in the mystical Nexus.",
                "The tranquil energy of the Nexus embraces you."
            ],
            obelisk: {
                level1: [
                    "A blue Neural Obelisk pulses with gentle energy, offering minor restoration.",
                    "Soft blue light emanates from a Neural Obelisk, promising a small measure of healing.",
                    "A Neural Obelisk glows with a calming blue aura, its restorative powers modest but welcome.",
                    "The blue glow of a Neural Obelisk offers basic healing to those who touch it."
                ],
                level2: [
                    "A green Neural Obelisk hums with moderate power, ready to restore your vitality.",
                    "Emerald light bathes the area around a Neural Obelisk of appreciable healing potential.",
                    "A Neural Obelisk radiates a soothing green light, promising significant restoration.",
                    "The verdant glow of a Neural Obelisk suggests moderate healing capabilities."
                ],
                level3: [
                    "A yellow Neural Obelisk shines brightly, containing substantial healing energy.",
                    "Golden light streams from a powerful Neural Obelisk, offering considerable restoration.",
                    "A Neural Obelisk bathes the area in warm yellow light, its healing potential substantial.",
                    "The brilliant yellow glow of a Neural Obelisk promises significant recovery upon touch."
                ],
                level4: [
                    "An orange Neural Obelisk thrums with impressive power, capable of major restoration.",
                    "Intense orange energy swirls within a Neural Obelisk of remarkable healing capacity.",
                    "A Neural Obelisk pulses with fierce orange light, promising extensive revitalization.",
                    "The vibrant orange aura of a Neural Obelisk suggests powerful healing properties."
                ],
                level5: [
                    "A purple Neural Obelisk crackles with extraordinary power, offering near-complete restoration.",
                    "Violet energy cascades from a Neural Obelisk of exceptional healing potential.",
                    "A Neural Obelisk emanates deep purple light, promising the most potent restoration.",
                    "The majestic purple glow of a Neural Obelisk indicates its supreme healing capabilities."
                ]
            }
        };
        this.messageColors = {
            bright: '#d4af37',      // Antique Gold
            moderate: '#b8860b',    // Dark Goldenrod
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
            },
            portal: '#4169E1',    // Royal Blue
            voidportal: '#483D8B', // Dark Slate Blue
            nexus: '#9370DB',     // Medium Purple
            obelisk: {
                level1: '#1E90FF', // ドジャーブルー
                level2: '#32CD32', // ライムグリーン
                level3: '#FFD700', // ゴールド
                level4: '#FF8C00', // ダークオレンジ
                level5: '#9932CC'  // ダークオーキッド
            },
        };

        // lookInfoElementの初期化を変更
        this.lookInfoElement = document.getElementById('available-skills');
        if (!this.lookInfoElement) {
            //console.warn('available-skills要素が見つかりません');
            return;
        }

        this.gameOverMessageShown = false;
    }

    add(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.className = type;

        // メッセージ数が上限を超えた場合、古いメッセージを削除
        const children = this.logElement.children;
        while (children.length >= this.maxMessages) {
            this.logElement.removeChild(children[0]);
        }

        this.logElement.appendChild(messageDiv);
        this.logElement.scrollTop = this.logElement.scrollHeight;
    }

    // Update look information
    updateLookInfo(content) {
        if (!this.lookInfoElement) {
            //console.error('lookInfoElementが初期化されていません');
            return;
        }

        this.currentLookInfo = content;
        if (this.game.mode === GAME_CONSTANTS.MODES.GAME) {
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
    updateRoomInfo(room, monsterCount, isDoorKill = false, isMeleeKill = false, obeliskInfo = null) {
        if (this.shouldUpdateRoomInfo(room, monsterCount) || isDoorKill || isMeleeKill || obeliskInfo) {
            let roomInfo = '';
            let brightnessColor = '';
            let monsterColor = '';
            
            if (room) {
                // Select brightness description and corresponding color
                if (room.brightness >= GAME_CONSTANTS.ROOM.BRIGHTNESS.BRIGHT) {
                    roomInfo = this.getRandomDescription('bright');
                    brightnessColor = this.messageColors.bright;
                } else if (room.brightness >= GAME_CONSTANTS.ROOM.BRIGHTNESS.MODERATE) {
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

            // Add portal description if present
            let portalDesc = '';
            if (room && room.hasPortal) {
                portalDesc = this.getRandomDescription('portal');
            } else if (room && room.hasVoidPortal) {
                portalDesc = this.getRandomDescription('voidportal');
            } else if (room && room.isNexus) {
                portalDesc = this.getRandomDescription('nexus');
            }
            
            // Add obelisk description if present
            let obeliskDesc = '';
            let obeliskColor = '';
            if (obeliskInfo) {
                const level = obeliskInfo.level || 3; // デフォルトはレベル3
                obeliskDesc = this.getRandomDescription(`obelisk.level${level}`);
                obeliskColor = this.messageColors.obelisk[`level${level}`];
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

            // Combine all descriptions with appropriate colors
            roomInfo = `<span style="color: ${brightnessColor}">${roomInfo}</span><br>` +
                       (combatDesc ? `<span style="color: ${this.messageColors.monsters.many}">${combatDesc}</span><br>` : '') +
                       (portalDesc ? `<span style="color: ${this.messageColors[room.hasVoidPortal ? 'voidportal' : room.hasPortal ? 'portal' : 'nexus']}">${portalDesc}</span><br>` : '') +
                       (obeliskDesc ? `<span style="color: ${obeliskColor}">${obeliskDesc}</span><br>` : '') +
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

        let display = "=== ATMOSPHERE ===\n";
        if (this.floorInfo) {
            let colorKey = 'safe';
            if (this.floorInfo.danger >= 3) {
                colorKey = 'deadly';
            } else if (this.floorInfo.danger >= 2) {
                colorKey = 'danger';
            } else if (this.floorInfo.danger >= 1) {
                colorKey = 'caution';
            }
            
            const flavorLines = this.floorInfo.flavor.split('.');
            const coloredLines = flavorLines
                .filter(line => line.trim())
                .map(line => `<span style="color: ${this.messageColors.floorInfo[colorKey]}">${line.trim()}.</span>`)
                .join('<br>');
            
            display += `${coloredLines}\n\n`;
        }
        
        display += "=== SURROUNDINGS ===\n";
        if (this.roomInfo) {
            display += `${this.roomInfo}\n\n`;
        }
        
        display += "=== LOOK INFO ===\n";
        if (this.currentLookInfo) {
            // 既存のコンテンツをクリア
            this.codexPanelElement.innerHTML = display
                .replace(/\n/g, '<br>')
                .replace(/\n(?!<)/g, '<br>');

            // currentLookInfoが要素の場合は直接追加
            if (this.currentLookInfo instanceof Element) {
                this.codexPanelElement.appendChild(this.currentLookInfo);
            } else {
                // 文字列の場合は従来通り
                this.codexPanelElement.innerHTML += this.currentLookInfo;
            }
            return;
        } else {
            display += `<span style="color: ${this.messageColors.lookInfo.tile}">Use look mode (;) to examine surroundings</span>`;
        }

        this.codexPanelElement.style.whiteSpace = 'pre-wrap';
        this.codexPanelElement.innerHTML = display
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n(?!<)/g, '<br>');
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
        this.gameOverMessageShown = false;
    }

    clearLookInfo() {
        this.currentLookInfo = null;
        if (this.game.mode === GAME_CONSTANTS.MODES.GAME) {
            this.renderLookPanel();
        }
    }

    showGameOverMessage(finalScore) {
        // ゲームオーバーメッセージが既に表示されているかチェック
        if (this.gameOverMessageShown) return;
        
        this.add("=================", "important");
        this.add("GAME OVER", "death");
        this.add("Final Score:", "important");
        this.add(`Total Score: ${finalScore.totalScore}`, "important");
        this.add(`Codex Points: ${finalScore.codexPoints}`, "important");
        this.add(`Survived Turns: ${finalScore.turns}`, "important");
        this.add("=================", "important");
        this.add("Press Enter to restart", "info");
        
        // フラグを設定
        this.gameOverMessageShown = true;
    }

    clearTitle() {
        if (!this.logElement) return;
        
        // タイプライターエフェクトを再度有効化
        this.logElement.classList.remove('no-typewriter');
        
        // メッセージログをクリア
        this.logElement.innerHTML = '';
    }
} 