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
                        cooldown: 4,
                        isFreeAction: true,  // フリーアクションとして設定
                        requiresTarget: false,
                        slot: '1',  // デフォルトスロット
                        learned: false,  // スキルの習得状態を追加
                        getEffectText: (player) => {
                            // STR 10で1.5倍になるように調整
                            const damageBonus = 1 + (0.5 * player.stats.str / 10);
                            // DEX 10で-30%になるように調整
                            const accuracyPenalty = 1 - (0.3 * player.stats.dex / 10);
                            return `[DMG: +${Math.floor((damageBonus-1)*100)}%, ACC: ${Math.floor((accuracyPenalty-1)*100)}%]`;
                        },
                        effect: (game, player) => {
                            const damageBonus = 1 + (0.5 * player.stats.str / 10);
                            const accuracyPenalty = -0.3 * (player.stats.dex / 10);  // 負の値として設定

                            player.nextAttackModifier = {
                                name: 'Power Strike',
                                damageMod: damageBonus,
                                accuracyMod: accuracyPenalty,  // 命中率の低下を追加
                                duration: 1
                            };
                            game.logger.add(
                                `You prepare a powerful strike! ${this.findSkillById('powerStrike').getEffectText(player)} 💪`, 
                                "playerInfo"
                            );
                        }
                    },
                    { id: 'quick', name: 'Quick Slash', cost: 20, desc: 'Fast attack with bonus hit chance'}
                ]
            },
            movement: {
                key: 'm',
                name: 'MOVEMENT',
                skills: [
                    {
                        id: 'jump',
                        name: 'Jump',
                        desc: 'Jump up to 3 tiles in any direction. Can jump over enemies.',
                        cost: 30,
                        cooldown: 15,
                        isFreeAction: false,
                        requiresTarget: true,
                        maxRange: 3,
                        getEffectText: (player) => {
                            return `[Range: 3]`;
                        },
                        effect: (game, player, targetPos) => {
                            if (!targetPos) return false;
                            
                            const dx = targetPos.x - player.x;
                            const dy = targetPos.y - player.y;
                            const distance = Math.max(Math.abs(dx), Math.abs(dy));
                            
                            if (distance > 3) {  // maxRangeを直接使用せず、固定値で確認
                                game.logger.add("Target is too far! (Maximum range: 3)", "warning");
                                return false;
                            }

                            // 移動先が床であることを確認
                            if (game.map[targetPos.y][targetPos.x] !== 'floor') {
                                game.logger.add("Can't jump there!", "warning");
                                return false;
                            }

                            // 移動を実行
                            player.x = targetPos.x;
                            player.y = targetPos.y;
                            game.logger.add("You make a swift jump! 🦘", "playerInfo");
                            return true;
                        }
                    }
                ]
            },
            defense: {
                key: 'd',
                name: 'DEFENSE',
                skills: [
                    { id: 'block', name: 'Shield Block', cost: 20, desc: 'Passive defense boost' },
                    { id: 'armor', name: 'Armor Master', cost: 35, desc: 'Improved defense from all sources' }
                ]
            },
            magic: {
                key: 'a',
                name: 'ARCANE',
                skills: [
                    { id: 'bolt', name: 'Magic Bolt', cost: 25, desc: 'Basic magic attack' },
                    { id: 'shield', name: 'Arcane Shield', cost: 30, desc: 'Magic barrier' }
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
                        cooldown: 50,
                        isFreeAction: false,
                        requiresTarget: false,
                        getEffectText: (player) => {
                            const healPerTurn = Math.floor(player.stats.wis / 5);  // 計算式をWIS/2に変更
                            const maxTurns = player.stats.wis;
                            return `[${healPerTurn} HP/turn, ${maxTurns} turns]`;
                        },
                        effect: function(game, player) {
                            const healPerTurn = Math.floor(player.stats.wis / 5);
                            const maxTurns = player.stats.wis;
                            
                            player.meditation = {
                                active: true,
                                healPerTurn: healPerTurn,
                                turnsRemaining: maxTurns,
                                totalHealed: 0,
                                initialDelay: true  // 初回遅延フラグを追加
                            };
                            
                            game.logger.add(`You begin to meditate... (+${healPerTurn} HP/turn) 🧘`, "playerInfo");
                        }
                    }
                ]
            }
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
        for (const [_, existingSkill] of player.skills) {
            if (existingSkill.id === skillId) {
                return "You already know this skill!";
            }
        }

        if (player.codex < skill.cost) {
            return "Not enough CODEX points!";
        }

        // スキルを自動的に次の利用可能なスロットに割り当て
        const availableSlot = this.getNextAvailableSlot(player);
        if (availableSlot) {
            player.codex -= skill.cost;
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
        
        player.codex -= skill.cost;
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
        display += `Selected: ${currentCat.name}\n`;
        
        if (this.inputMode === 'skill') {
            display += `\nEnter skill name: ${this.inputBuffer}_\n\n`;

            // サジェスションの表示
            if (this.suggestions.length > 0) {
                display += 'Suggestions:\n';
                this.suggestions.forEach(skill => {
                    display += `[${skill.id}] ${skill.name} (${skill.cost} CP)\n`;
                    display += `    ${skill.desc}\n`;
                });
            }
        }

        // 現在のスキル一覧
        display += '\nCurrent Skills:\n';
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