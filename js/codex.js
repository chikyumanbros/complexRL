/* ========================== CodexSystem Class Definition ========================== */
class CodexSystem {
    constructor() {
        this.categories = SKILLS;  // SKILLSオブジェクトを直接参照
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
            const color = GAME_CONSTANTS.COLORS.CODEX_CATEGORY[cat];
            const name = category.name;
            // 頭文字とカテゴリーキーのみ色付け
            display += `<span style="color: ${color}">[${category.key}]</span> <span style="color: ${color}">${name[0]}</span><span style="color: white">${name.slice(1)}</span> `;
        }
        display += '\n\n';

        const currentCat = this.categories[this.currentCategory];
        const currentColor = GAME_CONSTANTS.COLORS.CODEX_CATEGORY[this.currentCategory];
        const currentName = currentCat.name;
        display += `Selected: <span style="color: ${currentColor}">${currentName[0]}</span><span style="color: white">${currentName.slice(1)}</span>\n\n`;
        
        // ---- Available Skills in Current Category ----
        display += `Available ${currentCat.name} Skills:\n`;
        currentCat.skills.forEach(skill => {
            const canAfford = player.codexPoints >= skill.cost;
            const alreadyLearned = Array.from(player.skills.entries()).some(([_, skillData]) => skillData.id === skill.id);
            
            if (!alreadyLearned) {  // 未習得のスキルのみ表示
                const textColor = canAfford ? 'white' : '#666666';
                const bracketColor = canAfford ? '#2ecc71' : '#666666';
                display += `<span style="color: ${bracketColor}">[${skill.id}]</span> ` +
                          `<span style="color: ${currentColor}">${skill.name[0]}</span>` +
                          `<span style="color: ${textColor}">${skill.name.slice(1)} (${skill.cost} CP)\n` +
                          `    ${skill.desc}</span>\n`;
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
                    const textColor = alreadyLearned ? '#666' : (canAfford ? 'white' : '#666');
                    
                    // カテゴリーの色を取得
                    let categoryColor;
                    for (let cat in this.categories) {
                        if (this.categories[cat].skills.some(s => s.id === skill.id)) {
                            categoryColor = GAME_CONSTANTS.COLORS.CODEX_CATEGORY[cat];
                            break;
                        }
                    }

                    display += `<span style="color: ${categoryColor}">${skill.name[0]}</span>` +
                              `<span style="color: ${textColor}">${skill.name.slice(1)}</span>\n`;
                });
                display += '\n';
            }
        }

        // ---- Current Skills Heading ----
        display += 'Current Skills:\n';
        if (player.skills.size === 0) {
            display += 'NO SKILLS\n';
        } else {
            player.skills.forEach((skillData, slot) => {
                const skill = this.findSkillById(skillData.id);  // skillDataからidを取得
                if (skill) {
                    // スキルが属するカテゴリーを見つける
                    let categoryColor;
                    for (let cat in this.categories) {
                        if (this.categories[cat].skills.some(s => s.id === skill.id)) {
                            categoryColor = GAME_CONSTANTS.COLORS.CODEX_CATEGORY[cat];
                            break;
                        }
                    }
                    display += `[${slot}] <span style="color: ${categoryColor}">${skill.name[0]}</span>${skill.name.slice(1)}\n`;
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
            .filter(skill => !Array.from(game.player.skills.values()).some(skillData => skillData.id === skill.id))
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