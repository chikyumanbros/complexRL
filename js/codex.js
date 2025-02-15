/* ========================== CodexSystem Class Definition ========================== */
class CodexSystem {
    constructor() {
        // ==== Initialize Skill Categories ====
        this.categories = {
            // ---- Combat Skills ----
            combat: {
                key: 'c',
                name: 'COMBAT',
                skills: [
                    { 
                        // --- Power Strike Skill ---
                        id: 'powerStrike',
                        name: 'Power Strike',
                        desc: 'Channel STR for power, sacrificing DEX accuracy (Base: DMG +50%, ACC -30%, scales with STR/DEX)',
                        cost: 25,
                        cooldown: 8,
                        isFreeAction: true,  // フリーアクションとして設定
                        requiresTarget: false,
                        learned: false,  // スキルの習得状態を追加
                        getEffectText: (player) => {
                            // STR 10で1.5倍になるように調整
                            const damageBonus = 1 + (0.5 * player.stats.str / 10);
                            // DEX 10で-30%になるように調整
                            const accuracyPenalty = 1 - (0.3 * player.stats.dex / 10);
                            return `[DMG: +${Math.floor((damageBonus - 1) * 100)}%, ACC: ${Math.floor((accuracyPenalty - 1) * 100)}%]`;
                        },
                        effect: (game, player) => {
                            const damageBonus = 1 + (0.5 * player.stats.str / 10);
                            const accuracyPenalty = -0.3 * (player.stats.dex / 10);

                            // 配列が未初期化の場合は初期化
                            if (!player.nextAttackModifiers) {
                                player.nextAttackModifiers = [];
                            }

                            player.nextAttackModifiers.push({
                                name: 'Power Strike',
                                damageMod: damageBonus,
                                accuracyMod: accuracyPenalty,
                                duration: 1
                            });
                            
                            game.logger.add(
                                `You prepare a powerful strike! ${this.findSkillById('powerStrike').getEffectText(player)} `, 
                                "playerInfo"
                            );
                            game.renderer.render();
                            game.renderer.showNextAttackModifierEffect(player.x, player.y);
                            return true;
                        }
                    },
                    { 
                        // --- Quick Slash Skill ---
                        id: 'quick', 
                        name: 'Quick Slash', 
                        cost: 20, 
                        cooldown: 12,
                        desc: 'Swift attack that improves accuracy and speed. (Base: ACC +20%, SPD +20%)',
                        getEffectText: (player) => {
                            return `[ACC: +20%, SPD: +20%]`;
                        },
                        isFreeAction: true,
                        requiresTarget: false,
                        learned: false,
                        effect: (game, player) => {
                            // 配列が未初期化の場合は初期化
                            if (!player.nextAttackModifiers) {
                                player.nextAttackModifiers = [];
                            }

                            player.nextAttackModifiers.push({
                                name: 'Quick Slash',
                                damageMod: 1,
                                accuracyMod: 0.2,
                                speedMod: 0.2,
                                duration: 1
                            });
                            
                            game.logger.add(
                                `You prepare a quick strike! ${this.findSkillById('quick').getEffectText(player)}`, 
                                "playerInfo"
                            );
                            game.renderer.render();
                            game.renderer.showNextAttackModifierEffect(player.x, player.y);
                            return true;
                        }
                    }
                ]
            },
            // ---- Movement Skills ----
            movement: {
                key: 'm',
                name: 'MOVEMENT',
                skills: [
                    {
                        // --- Jump Skill ---
                        id: 'jump',
                        name: 'Jump',
                        desc: 'Jump over enemies. Range based on DEX/CON. (Base: 3, +1 per 3 DEX over CON)',
                        cost: 30,
                        cooldown: 30,
                        isFreeAction: false,
                        requiresTarget: true,
                        range: 3,
                        getEffectText: (player) => {
                            const jumpRange = Math.floor((player.stats.dex - player.stats.con) / 3) + 3;
                            return `[Range: ${jumpRange}]`;
                        },
                        effect: (game, player, target) => {
                            // ---- Visibility Check ----
                            const visibleTiles = game.getVisibleTiles();
                            const isVisible = visibleTiles.some(tile => 
                                tile.x === target.x && tile.y === target.y
                            );
                            
                            if (!isVisible) {
                                game.logger.add("Can't jump to unseen location!", "warning");
                                return false;
                            }

                            // ---- Calculate Jump Range ----
                            const jumpRange = Math.floor((player.stats.dex - player.stats.con) / 3) + 3;
                            
                            // ---- Distance Check (Chebyshev distance) ----
                            const dx = Math.abs(target.x - player.x);
                            const dy = Math.abs(target.y - player.y);
                            const distance = Math.max(dx, dy);
                            
                            if (distance > jumpRange) {
                                game.logger.add("Too far to jump!", "warning");
                                return false;
                            }

                            // ---- Check Destination Validity ----
                            // 閉じたドアへのジャンプを禁止
                            if (game.tiles[target.y][target.x] === GAME_CONSTANTS.TILES.DOOR.CLOSED) {
                                game.logger.add("Can't jump through closed doors!", "warning");
                                return false;
                            }

                            if (game.map[target.y][target.x] !== 'floor') {
                                game.logger.add("Can't jump there!", "warning");
                                return false;
                            }

                            // ---- Monster Presence Check ----
                            if (game.getMonsterAt(target.x, target.y)) {
                                game.logger.add("Can't jump onto a monster!", "warning");
                                return false;
                            }

                            // ---- Save Current Position ----
                            const fromX = player.x;
                            const fromY = player.y;

                            // ---- Show Movement Effect ----
                            game.renderer.showMovementTrailEffect(fromX, fromY, target.x, target.y);

                            // ---- Execute Jump ----
                            player.x = target.x;
                            player.y = target.y;
                            
                            game.logger.add("Jump!", "playerAction");
                            
                            return { success: true, skipTurnProcess: true };  // ターン処理をスキップするフラグを追加
                        }
                    }
                ]
            },
            // ---- Defense Skills ----
            defense: {
                key: 'd',
                name: 'DEFENSE',
                skills: [
                    { 
                        // --- Shield Block Skill ---
                        id: 'block', 
                        name: 'Shield Block', 
                        cost: 20, 
                        desc: 'Passive defense boost',
                        getEffectText: (player) => {
                            return `[DEF: +20%]`;
                        },
                        isFreeAction: true,
                        requiresTarget: false,
                        learned: false
                    },
                    { 
                        // --- Armor Master Skill ---
                        id: 'armor', 
                        name: 'Armor Master', 
                        cost: 35, 
                        desc: 'Improved defense from all sources',
                        getEffectText: (player) => {
                            return `[DEF: +35%]`;
                        },
                        isFreeAction: true,
                        requiresTarget: false,
                        learned: false
                    }
                ]
            },
            // ---- Mind Skills ----
            mind: {
                key: 'i',
                name: 'MIND',
                skills: [
                    {
                        // --- Meditation Skill ---
                        id: 'meditation',
                        name: 'Meditation',
                        desc: 'Meditate to recover HP. Move or take damage to cancel. (Heal: WIS/2 per turn, Max turns: WIS)',
                        cost: 30,
                        cooldown: 100,
                        isFreeAction: false,  // フリーアクションではないため、ターン消費する
                        requiresTarget: false,
                        cancelOnDamage: true,
                        getEffectText: (player) => {
                            const healPerTurn = Math.floor(player.stats.wis / 3);
                            const maxTurns = Math.floor(player.stats.wis / 2);
                            return `[${healPerTurn} HP/turn, ${maxTurns} turns]`;
                        },
                        effect: (game, player) => {
                            // ---- HP Check ----
                            if (player.hp >= player.maxHp) {
                                game.logger.add("Cannot meditate as HP is full.", "warning");
                                return false;
                            }

                            if (player.meditation && player.meditation.active) {
                                game.logger.add("Already meditating！", "warning");
                                return false;
                            }

                            player.meditation = {
                                active: true,
                                initialDelay: true,
                                healPerTurn: Math.floor(player.stats.wis / 3),
                                turnsRemaining: Math.floor(player.stats.wis / 2),
                                totalHealed: 0
                            };

                            game.logger.add("Started meditating...", "playerInfo");
                            game.renderer.render();
                            return { success: true, skipTurnProcess: true };  // ターン処理をスキップするフラグを追加
                        }
                    }
                ]
            },
        };

        // ==== Initialize Mode and Input Settings ====
        this.currentCategory = 'combat';
        this.selectionMode = 'normal';
        this.pendingSkill = null;
        this.inputBuffer = '';
        this.suggestions = [];
        this.inputMode = 'category';  // 'category' または 'skill'
    }

    // ===== Input Mode Methods =====
    toggleInputMode() {
        this.inputMode = this.inputMode === 'category' ? 'skill' : 'category';
        this.clearInput();
    }

    updateInputBuffer(input) {
        this.inputBuffer = input.toLowerCase();
        this.updateSuggestions();
    }

    updateSuggestions() {
        if (this.inputMode === 'category') {
            this.suggestions = [];  // カテゴリモードではサジェスションを表示しない
            return;
        }

        const currentCat = this.categories[this.currentCategory];
        this.suggestions = currentCat.skills
            .filter(skill => 
                skill.id.includes(this.inputBuffer) || 
                skill.name.toLowerCase().includes(this.inputBuffer))
            .slice(0, 5);
    }

    clearInput() {
        this.inputBuffer = '';
        this.suggestions = [];
    }

    // ===== Skill Learning and Replacement Methods =====
    tryLearnSkill(skillId, player) {
        const skill = this.findSkillById(skillId);
        if (!skill) return false;
        
        // すでに習得済みのスキルかチェック
        for (const [_, skillData] of player.skills) {
            if (skillData.id === skillId) {
                return "You already know this skill!";
            }
        }

        if (player.codexPoints < skill.cost) {
            return "Not enough CODEX points!";
        }

        // スキルを自動的に次の利用可能なスロットに割り当て
        const availableSlot = this.getNextAvailableSlot(player);
        if (availableSlot) {
            player.codexPoints -= skill.cost;
            player.assignSkill(skillId, availableSlot);
            this.inputMode = 'category';  // カテゴリ選択モードに戻る
            return true;
        } else {
            this.selectionMode = 'replace';
            this.pendingSkill = skillId;
            return 'replace';
        }
    }

    replaceSkill(slotNumber, player) {
        if (this.pendingSkill === null || this.selectionMode !== 'replace') return false;

        const currentCat = this.categories[this.currentCategory];
        const skill = currentCat.skills.find(s => s.id === this.pendingSkill);
        
        player.codexPoints -= skill.cost;
        player.removeSkill(slotNumber);
        player.assignSkill(this.pendingSkill, slotNumber);
        
        this.selectionMode = 'normal';
        this.pendingSkill = null;
        this.inputMode = 'category';  // カテゴリ選択モードに戻る
        return true;
    }

    // ===== Display Methods =====
    getMenuDisplay(player) {
        if (this.selectionMode === 'replace') {
            return this.getReplacementDisplay(player);
        }

        let display = '';
        
        // ---- Mode Heading ----
        display += `=== ${this.inputMode.toUpperCase()} MODE ===\n\n`;

        // ---- Categories Heading ----
        display += 'Categories: ';
        for (let cat in this.categories) {
            const category = this.categories[cat];
            display += `[${category.key}] ${category.name} `;
        }
        display += '\n\n';

        const currentCat = this.categories[this.currentCategory];
        display += `Selected: ${currentCat.name}\n\n`;
        
        // ---- Available Skills in Current Category ----
        display += `Available ${currentCat.name} Skills:\n`;
        currentCat.skills.forEach(skill => {
            const canAfford = player.codexPoints >= skill.cost;
            const alreadyLearned = Array.from(player.skills.entries()).some(([_, skillData]) => skillData.id === skill.id);
            
            if (!alreadyLearned) {  // 未習得のスキルのみ表示
                const skillColor = canAfford ? '#2ecc71' : '#e74c3c';
                display += `<span style="color: ${skillColor}">[${skill.id}] ${skill.name} (${skill.cost} CP)\n`;
                display += `    ${skill.desc}</span>\n`;
            }
        });
        display += '\n';
        
        if (this.inputMode === 'skill') {
            // ---- Skill Input Heading ----
            display += `Enter skill name: ${this.inputBuffer}_\n\n`;

            // ---- Suggestions Display ----
            if (this.suggestions.length > 0) {
                display += 'Suggestions:\n';
                this.suggestions.forEach(skill => {
                    const canAfford = player.codexPoints >= skill.cost;
                    const alreadyLearned = Array.from(player.skills.entries()).some(([_, skillData]) => skillData.id === skill.id);
                    const skillColor = alreadyLearned ? '#666' : (canAfford ? '#2ecc71' : '#e74c3c');
                    
                    display += `<span style="color: ${skillColor}">[${skill.id}] ${skill.name} (${skill.cost} CP)\n`;
                    display += `    ${skill.desc}</span>\n`;
                });
                display += '\n';
            }
        }

        // ---- Current Skills Heading ----
        display += 'Current Skills:\n';
        if (player.skills.size === 0) {
            display += 'NO SKILLS\n';
        } else {
            player.skills.forEach((skillId, slot) => {
                const skill = this.findSkillById(skillId);
                if (skill) {
                    display += `[${slot}] ${skill.name}\n`;
                }
            });
        }

        // ---- Controls Heading ----
        display += '\n=== CONTROLS ===\n';
        if (this.inputMode === 'category') {
            display += 'Press [SPACE] to enter skill selection mode\n';
            display += 'Press category key to change category';
        } else {
            display += 'Press [SPACE] to return to category mode\n';
            display += 'Type skill name and press [ENTER] to learn';
        }

        return display;
    }

    getReplacementDisplay(player) {
        const skill = this.findSkillById(this.pendingSkill);
        let display = `Select skill slot to replace with ${skill.name}:\n\n`;
        
        player.skills.forEach((skillId, slot) => {
            const existingSkill = this.findSkillById(skillId);
            if (existingSkill) {
                display += `[${slot}] ${existingSkill.name}\n`;
            }
        });
        
        display += '\nPress [ESC] to cancel';
        return display;
    }

    // ===== Utility Methods =====
    findSkillById(skillId) {
        for (const category of Object.values(this.categories)) {
            const skill = category.skills.find(s => s.id === skillId);
            if (skill) return skill;
        }
        return null;
    }

    getNextAvailableSlot(player) {
        for (let i = 1; i <= 9; i++) {
            const slot = i.toString();
            if (!player.skills.has(slot)) {
                return slot;
            }
        }
        return null;
    }
}

/* ========================== Utility Functions for Codex UI ========================== */

// ===== Function: createCodexEntry =====
function createCodexEntry(title, content) {
    const entry = document.createElement('div');
    entry.className = 'codex-entry';
    
    const titleElement = document.createElement('div');
    titleElement.className = 'codex-title';
    titleElement.textContent = title;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'codex-content';
    contentElement.textContent = content;
    
    entry.appendChild(titleElement);
    entry.appendChild(contentElement);
    return entry;
}

// ===== Function: createCodexMenu =====
function createCodexMenu() {
    const menu = document.createElement('div');
    
    // ---- Menu Title ----
    const title = document.createElement('div');
    title.textContent = "=== CODEX ===";
    title.style.color = "#ffd700";
    title.style.marginBottom = "10px";
    menu.appendChild(title);
    
    // ---- Category-Based Skill Display ----
    for (const categoryKey in game.codexSystem.categories) {
        const category = game.codexSystem.categories[categoryKey];
        
        // ---- Category Header ----
        const categoryHeader = document.createElement('div');
        categoryHeader.textContent = `== ${category.name} ==`;
        categoryHeader.style.color = "#88ccff";
        categoryHeader.style.marginTop = "10px";
        categoryHeader.style.marginBottom = "5px";
        menu.appendChild(categoryHeader);
        
        // ---- List Skills that are not yet learned ----
        category.skills
            .filter(skill => !Array.from(game.player.skills.values()).includes(skill.id))
            .forEach(skill => {
                const menuItem = document.createElement('div');
                const canAfford = game.player.codexPoints >= skill.cost;
                
                menuItem.textContent = `${skill.name} (${skill.cost} CP)`;
                menuItem.style.cursor = 'pointer';
                menuItem.style.marginBottom = '5px';
                menuItem.style.marginLeft = '10px';
                menuItem.style.color = canAfford ? '#2ecc71' : '#e74c3c';
                
                // ---- Tooltip with Skill Description ----
                menuItem.title = skill.desc;
                
                menuItem.addEventListener('click', () => {
                    game.codexSystem.currentCategory = categoryKey;
                    game.codexSystem.inputMode = 'skill';
                    game.codexSystem.updateInputBuffer(skill.id);
                });
                
                menu.appendChild(menuItem);
            });
    }
    
    return menu;
}