class CodexSystem {
    constructor() {
        this.categories = {
            combat: {
                key: 'c',
                name: 'COMBAT',
                skills: [
                    { 
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
                            return `[DMG: +${Math.floor((damageBonus-1)*100)}%, ACC: ${Math.floor((accuracyPenalty-1)*100)}%]`;
                        },
                        effect: (game, player) => {
                            // 既に攻撃修飾効果が有効な場合は使用できない
                            if (player.nextAttackModifier) {
                                game.logger.add(`${player.nextAttackModifier.name} is already in effect!`, "warning");
                                return false;
                            }

                            const damageBonus = 1 + (0.5 * player.stats.str / 10);
                            const accuracyPenalty = -0.3 * (player.stats.dex / 10);

                            player.nextAttackModifier = {
                                name: 'Power Strike',
                                damageMod: damageBonus,
                                accuracyMod: accuracyPenalty,
                                duration: 1
                            };
                            
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
                            // 既に攻撃修飾効果が有効な場合は使用できない
                            if (player.nextAttackModifier) {
                                game.logger.add(`${player.nextAttackModifier.name} is already in effect!`, "warning");
                                return false;
                            }

                            player.nextAttackModifier = {
                                name: 'Quick Slash',
                                damageMod: 1,
                                accuracyMod: 0.2,
                                speedMod: 0.2,
                                duration: 1
                            };
                            
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
            movement: {
                key: 'm',
                name: 'MOVEMENT',
                skills: [
                    {
                        id: 'jump',
                        name: 'Jump',
                        desc: 'Jump over enemies. Range based on DEX/CON. (Base: 3, +1 per 3 DEX over CON)',
                        cost: 30,
                        cooldown: 30,
                        isFreeAction: false,
                        requiresTarget: true,
                        maxRange: 3,
                        getEffectText: (player) => {
                            const jumpRange = Math.floor((player.stats.dex - player.stats.con) / 3) + 3;
                            return `[Range: ${jumpRange}]`;
                        },
                        effect: (game, player, target) => {
                            // 視界範囲チェック
                            const visibleTiles = game.getVisibleTiles();
                            const isVisible = visibleTiles.some(tile => 
                                tile.x === target.x && tile.y === target.y
                            );
                            
                            if (!isVisible) {
                                game.logger.add("Can't jump to unseen location!", "warning");
                                return false;
                            }

                            // ジャンプ範囲を計算（DEXとCONから算出）
                            const jumpRange = Math.floor((player.stats.dex - player.stats.con) / 3) + 3;
                            
                            // 距離チェック
                            const dx = target.x - player.x;
                            const dy = target.y - player.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            if (distance > jumpRange) {
                                game.logger.add("Too far to jump!", "warning");
                                return false;
                            }

                            // 移動先の有効性チェック
                            if (game.map[target.y][target.x] !== 'floor') {
                                game.logger.add("Can't jump there!", "warning");
                                return false;
                            }

                            // モンスターがいる場所にはジャンプできない
                            if (game.getMonsterAt(target.x, target.y)) {
                                game.logger.add("Can't jump onto a monster!", "warning");
                                return false;
                            }

                            // ジャンプ前の位置を保存
                            const fromX = player.x;
                            const fromY = player.y;

                            // エフェクトを表示
                            game.renderer.showMovementTrailEffect(fromX, fromY, target.x, target.y);

                            // ジャンプの実行
                            player.x = target.x;
                            player.y = target.y;
                            
                            game.logger.add("Jump!", "playerAction");
                            
                            return true;
                        }
                    }
                ]
            },
            defense: {
                key: 'd',
                name: 'DEFENSE',
                skills: [
                    { 
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
            magic: {
                key: 'a',
                name: 'ARCANE',
                skills: [
                    { 
                        id: 'bolt', 
                        name: 'Magic Bolt', 
                        cost: 25, 
                        desc: 'Basic magic attack',
                        getEffectText: (player) => {
                            return `[MAG: ${Math.floor(player.stats.int * 0.5)} DMG]`;
                        },
                        isFreeAction: false,
                        requiresTarget: true,
                        learned: false
                    },
                    { 
                        id: 'shield', 
                        name: 'Arcane Shield', 
                        cost: 30, 
                        desc: 'Magic barrier',
                        getEffectText: (player) => {
                            return `[BARRIER: ${player.stats.int * 2}]`;
                        },
                        isFreeAction: true,
                        requiresTarget: false,
                        learned: false
                    }
                ]
            },
            mind: {  // mental から mind に変更
                key: 'i',  // 'm' から 'i' に変更 (intelligence/inner の i)
                name: 'MIND',  // MENTAL から MIND に変更
                skills: [
                    {
                        id: 'meditation',
                        name: 'Meditation',
                        desc: 'Meditate to recover HP. Move to cancel. (Heal: WIS/2 per turn, Max turns: WIS)',
                        cost: 30,
                        cooldown: 100,
                        isFreeAction: false,
                        requiresTarget: false,
                        getEffectText: (player) => {
                            const healPerTurn = Math.floor(player.stats.wis / 3);  // effect関数と同じ計算式
                            const maxTurns = Math.floor(player.stats.wis / 2);     // effect関数と同じ計算式
                            return `[${healPerTurn} HP/turn, ${maxTurns} turns]`;
                        },
                        effect: (game, player) => {
                            // If HP is at maximum value, cannot meditate
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
                            return true;
                        }
                    }
                ]
            },
        };
        this.currentCategory = 'combat';
        this.selectionMode = 'normal';
        this.pendingSkill = null;
        this.inputBuffer = '';
        this.suggestions = [];
        this.inputMode = 'category';  // 'category' または 'skill'
    }

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

    getMenuDisplay(player) {
        if (this.selectionMode === 'replace') {
            return this.getReplacementDisplay(player);
        }

        let display = '';
        
        // モード表示
        display += `=== ${this.inputMode.toUpperCase()} MODE ===\n\n`;

        // カテゴリ一覧
        display += 'Categories: ';
        for (let cat in this.categories) {
            const category = this.categories[cat];
            display += `[${category.key}] ${category.name} `;
        }
        display += '\n\n';

        const currentCat = this.categories[this.currentCategory];
        display += `Selected: ${currentCat.name}\n\n`;
        
        // 選択されたカテゴリのスキル一覧を表示
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
            display += `Enter skill name: ${this.inputBuffer}_\n\n`;

            // サジェスションの表示
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

        // 現在のスキル一覧
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

        // 操作説明
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

function createCodexMenu() {
    const menu = document.createElement('div');
    const title = document.createElement('div');
    title.textContent = "=== CODEX ===";
    title.style.color = "#ffd700";
    title.style.marginBottom = "10px";
    menu.appendChild(title);
    
    // カテゴリごとにスキルを表示
    for (const categoryKey in game.codexSystem.categories) {
        const category = game.codexSystem.categories[categoryKey];
        
        // カテゴリヘッダーを作成
        const categoryHeader = document.createElement('div');
        categoryHeader.textContent = `== ${category.name} ==`;
        categoryHeader.style.color = "#88ccff";
        categoryHeader.style.marginTop = "10px";
        categoryHeader.style.marginBottom = "5px";
        menu.appendChild(categoryHeader);
        
        // カテゴリ内のスキルをフィルタリングして表示
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
                
                // ツールチップとしてスキルの説明を追加
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