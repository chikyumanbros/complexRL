const GAME_CONSTANTS = {
    // タイル関連
    TILES: {
        FLOOR: ['.', '^', '~', '¨', '：', '∙'],
        WALL: ['#', '█', '▓', '▒'],
        CYBER_WALL: [
            '╢', '╖', '╕', '╣', '║', '╗', '╝', '╜', '╞', '╟',
            '╚', '╔', '╩', '╦', '╠', '═', '╬', '╧', '╨', '╤',
            '╥', '╙', '╘', '╒', '╓'
        ],
        DOOR: {
            OPEN: '/',
            CLOSED: '+'
        },
        OBSTACLE: {
            BLOCKING: ['◘', '◙'],      // 視線を遮る障害物
            TRANSPARENT: ['¤', '†', '‡', '¶', '≡', '£', '┼', '◊', '♠', 'Ж', 'Ш', '='],   // 視線を通す障害物
        },
        SPACE: [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',' ',' ',' ',' ',' ', '░', '·', '°' , '*', '◊', '○', '●', '☼', '÷', 'ø', 'פ'],
        SPACE_COLORS: [
            '#1a237e',  // 深い青
            '#311b92',  // 深い紫
            '#4a148c',  // 紫
            '#0d47a1',  // 濃い青
            '#ff1744',  // ビビッドな赤
            '#f50057',  // ビビッドなピンク
            '#d500f9',  // ビビッドな紫
            '#ff9100',  // ビビッドなオレンジ
            '#ffea00',  // ビビッドなイエロー
            '#76ff03',  // ビビッドなライムグリーン
            '#00e5ff',  // ビビッドな水色
            '#2979ff',  // ビビッドな青
            '#b39ddb',  // 薄い紫
            '#90caf9',  // 薄い青
            '#4fc3f7',  // 明るい青
            '#e1bee7',  // 淡い紫
            '#FFFFFF',
        ],
    },

    // 蜘蛛の巣関連
    WEB: {
        CHAR: '⅗',
        COLOR: '#CCCCCC',
        ANIMATION_CHARS: ['⅗', '⅗', '⅗', '⅗', '⅗', '⅗'],
        ANIMATION_COLORS: [
            '#CCCCCC',  // 薄い灰色
            '#DDDDDD',  // より薄い灰色
            '#EEEEEE',  // さらに薄い灰色
            '#FFFFFF',  // 白
            '#EEEEEE',  // さらに薄い灰色
            '#DDDDDD',  // より薄い灰色
        ],
        TRAP_CHANCE: 0.75,  // プレイヤーが罠にかかる基本確率
        ESCAPE_CHANCE: {    // 罠から脱出する確率
            BASE: 0.5       // 基本脱出確率（固定値）
        },
        INTERACTION_MESSAGE: "You remove the sticky web.",  // インタラクト時のメッセージ
        FAIL_MESSAGE: "The web is too sticky to remove."    // 取り除けなかった時のメッセージ
    },

    // 階段関連
    STAIRS: {
        CHAR: '>',
        COLOR: '#FFFF00',
    },

    // ポータル関連
    PORTAL: {
        GATE: {
            CHAR: '∩',
            ANIMATION_CHARS: ['∩','∩','∩', '░', '▒', '░',],
            COLORS: [
                '#FF00FF',  // マゼンタ
                '#FF66FF',  // 明るいマゼンタ
                '#FFB3FF',  // さらに明るいマゼンタ
                '#FFE6FF',  // 非常に明るいマゼンタ
                '#FFFFFF'   // 白
            ]
        },
        VOID: {
            CHAR: '§',
            ANIMATION_CHARS: ['§','פ','∂', '░', '▒', '░',],
            COLORS: [
                '#800080',  // 紫
                '#A020F0',  // 薄紫
                '#DDA0DD',  // 薄い紫
                '#EE82EE',  // バイオレット
                '#FFFFFF'   // 白
            ]
        }   
    },

    // ニューラルオベリスク関連
    NEURAL_OBELISK: {
        CHAR: '♀',
        ANIMATION_CHARS: ['♀','♁','⊕', '░', '▒', '░'],
        LEVELS: {
            1: {
                COLOR: '#00BFFF',  // 薄い青色
                HEAL_PERCENT: 20   // 最大HPとVigorの20%回復
            },
            2: {
                COLOR: '#00FF00',  // 緑色
                HEAL_PERCENT: 35   // 最大HPとVigorの35%回復
            },
            3: {
                COLOR: '#FFFF00',  // 黄色
                HEAL_PERCENT: 50   // 最大HPとVigorの50%回復
            },
            4: {
                COLOR: '#FFA500',  // オレンジ色
                HEAL_PERCENT: 75   // 最大HPとVigorの75%回復
            },
            5: {
                COLOR: '#800080',  // 紫色
                HEAL_PERCENT: 100  // 最大HPとVigorの100%回復（完全回復）
            }
        },
        SPAWN_CHANCE: 0.5  // サークルパターンの中央に生成される確率
    },

    // 色関連
    COLORS: {
        FLOOR: '#333',
        WALL: '#556',  // デフォルトの壁の色（後方互換性のため）
        WALL_VARIATIONS: [
            '#556',  // 基本の青灰色
            '#755',  // 赤灰色
            '#565',  // 緑灰色
            '#577',  // 青緑灰色
            '#655',  // 黄灰色
            '#757',  // 紫灰色
            '#557',  // 明るい青灰色
            '#765',  // オレンジ灰色
            '#575',  // エメラルド色の灰色
            '#776',  // 金色の灰色
        ],
        DOOR: '#8B4513',
        HEAL: '#2ed573',
        MONSTER: {
            get RAT() { return SPRITE_COLORS.getMostUsedColor(MONSTER_SPRITES.RAT); },
            get BAT() { return SPRITE_COLORS.getMostUsedColor(MONSTER_SPRITES.BAT); },
            get G_VIPER() { return SPRITE_COLORS.getMostUsedColor(MONSTER_SPRITES.G_VIPER); },
            get GOBLIN() { return SPRITE_COLORS.getMostUsedColor(MONSTER_SPRITES.GOBLIN); },
            get G_SPIDER() { return SPRITE_COLORS.getMostUsedColor(MONSTER_SPRITES.G_SPIDER); },
            get SKELETON() { return SPRITE_COLORS.getMostUsedColor(MONSTER_SPRITES.SKELETON); },
            get ZOMBIE() { return SPRITE_COLORS.getMostUsedColor(MONSTER_SPRITES.ZOMBIE); },
            get GHOST() { return SPRITE_COLORS.getMostUsedColor(MONSTER_SPRITES.GHOST); },
            get TROLL() { return SPRITE_COLORS.getMostUsedColor(MONSTER_SPRITES.TROLL); }
        },
        OBSTACLE: {
            BLOCKING: '#664433',     // 後方互換性のため
            BLOCKING_VARIATIONS: [
                '#775544',  // 明るい茶色
                '#664422',  // やや明るい茶色
                '#886644',  // 黄金がかった茶色
                '#775522',  // 明るい黄みがかった茶色
                '#773333',  // 明るい赤みがかった茶色
                '#666633',  // オリーブがかった茶色
                '#9A9A9A',  // 銀色
                '#DDCB72',  // 明るい金色
                '#007070',  // 青緑色
                '#B0B0B0',  // 明るい鋼鉄色
                '#E0D000',  // 明るい黄金色
                '#C09510',  // 明るい銅色
            ],
            TRANSPARENT: '#B87333',  // 明るい木製色
            TRANSPARENT_VARIATIONS: [
                '#B87333',  // 明るい基本の木製色
                '#CD853F',  // 明るいサドルブラウン
                '#8B5A2B',  // ハニーオーク色
                '#D2B48C',  // タン色
                '#A0522D',  // シエナ色
                '#DEB887',  // バーリーウッド
                '#EED9C4',  // アーモンド色
                '#BC8F8F',  // ローズブラウン
                '#FFA07A',  // 明るい朱色
                '#FF7F50',  // コーラル色
            ],
        },
        SPEED: {
            1: { color: '#e74c3c', name: 'Very Slow' },
            2: { color: '#e67e22', name: 'Slow' },
            3: { color: '#f1c40f', name: 'Normal' },
            4: { color: '#2ecc71', name: 'Fast' },
            5: { color: '#3498db', name: 'Very Fast' }
        },
        SIZE: {
            1: { color: '#3498db', name: 'Tiny' },
            2: { color: '#2ecc71', name: 'Small' },
            3: { color: '#f1c40f', name: 'Medium' },
            4: { color: '#e67e22', name: 'Large' },
            5: { color: '#e74c3c', name: 'Huge' }
        },
        CODEX_CATEGORY: {
            combat: '#e74c3c',     // 赤 - 戦闘
            acrobatics: '#3498db',    // 青 - 移動
            defense: '#f1c40f',     // 黄 - 防御
            mind: '#2ecc71'         // 緑 - 精神
        }
    },

    // モード関連
    MODES: {
        GAME: 'game',
        CODEX: 'codex',
        GAME_OVER: 'game_over',
        HELP: 'help',
        TITLE: 'title',
        WIKI: 'wiki'
    },

    // ディメンション関連
    DIMENSIONS: {
        WIDTH: 65,
        HEIGHT: 35
    },

    // 部屋生成関連
    ROOM: {
        MIN_SIZE: 5,
        MAX_SIZE: 10,
        MIN_COUNT: 15,
        MAX_COUNT: 20,
        PADDING: 0,
        SAFE_RADIUS: 3,
        BRIGHTNESS: {
            DIM: 3,      // 暗い部屋
            MODERATE: 5,  // 中程度の明るさ
            BRIGHT: 7,    // 明るい部屋
            PROBABILITIES: {
                DIM: 0.2,      // 20%の確率
                MODERATE: 0.4,  // 40%の確率
                BRIGHT: 0.4     // 40%の確率
            }
        },
        OBSTACLES: {
            CHANCE: 0.7,           // 障害物配置確率
            MIN_COUNT: 2,          // 最小障害物数
            MAX_COUNT: 10,          // 最大障害物数
            TRANSPARENT_RATIO: 0.5, // 視線を通す障害物の割合
            MIN_ROOM_SIZE: 5       // パターン配置に必要な最小部屋サイズ
        }
    },

    // 危険度レベル関連
    DANGER_LEVELS: {
        SAFE: {
            name: 'Serene',
            levelModifier: -1,
            color: '#2ecc71',
            flavor: "A gentle breeze carries the scent of ancient stone. The air feels unusually peaceful, almost protective."
        },
        NORMAL: {
            name: 'Neutral',
            levelModifier: 0,
            color: '#f1c40f',
            flavor: "The familiar musty scent of the dungeon fills the air. Distant echoes remind you to remain vigilant."
        },
        DANGEROUS: {
            name: 'Perilous',
            levelModifier: 1,
            color: '#e74c3c',
            flavor: "The shadows seem to writhe with malicious intent. Every sound carries an undertone of danger."
        },
        DEADLY: {
            name: 'Fatal',
            levelModifier: 2,
            color: '#8e44ad',
            flavor: "An oppressive darkness weighs heavily on your soul. The very air seems to pulse with deadly energy."
        }
    },

    // コントロール関連
    CONTROLS: {
        MOVEMENT: {
            title: 'MOVEMENT',
            keys: [
                { key: 'h', desc: 'Move left' },
                { key: 'j', desc: 'Move down' },
                { key: 'k', desc: 'Move up' },
                { key: 'l', desc: 'Move right' },
                { key: 'y', desc: 'Move diagonally up-left' },
                { key: 'u', desc: 'Move diagonally up-right' },
                { key: 'b', desc: 'Move diagonally down-left' },
                { key: 'n', desc: 'Move diagonally down-right' },
                { key: '.', desc: 'Wait a turn' }
            ]
        },
        INTERACTION: {
            title: 'INTERACTION',
            keys: [
                { key: ',', desc: 'Pick up item' },
                { key: 'd', desc: 'Drop item' },
                { key: 'i', desc: 'Show inventory' },
                { key: 'e', desc: 'Eat/Equip item' },
                { key: '>', desc: 'Use stairs down' },
                { key: 'c', desc: 'Close door' },
                { key: 's', desc: 'Show skill tree' },
                { key: 'z', desc: 'Cast skill (with number)' },
                { key: 'm', desc: 'Toggle music' },
                { key: '?', desc: 'Show help menu' },
                //{ key: 'ctrl+s', desc: 'Show monster sprite preview' },
                { key: '[', desc: 'Scroll message log up' },
                { key: ']', desc: 'Scroll message log down' }
            ]
        },
        RESTING: {
            title: 'RESTING',
            keys: [
                { key: '^', desc: 'Rest for 10 turns' },
                { key: '~', desc: 'Rest until fully healed' }
            ]
        },
        LANDMARK: {
            title: 'LANDMARK TARGET',
            keys: [
                { key: 'Backspace', desc: 'Enter landmark target mode' },
                { key: 'Movement keys', desc: 'Select a landmark' },
                { key: 'Enter', desc: 'Start auto-move to the selected landmark' },
                { key: 'Esc', desc: 'Cancel landmark target mode' }
            ]
        }
    },

    // ステータス関連
    STATS: {
        TYPES: {
            STR: 'str',
            DEX: 'dex',
            CON: 'con',
            INT: 'int',
            WIS: 'wis'
        },
        NAMES: {
            str: 'Strength',
            dex: 'Dexterity',
            con: 'Constitution',
            int: 'Intelligence',
            wis: 'Wisdom'
        },
        DEFAULT_VALUES: {
            str: 6,
            dex: 6,
            con: 6,
            int: 6,
            wis: 6
        },
        DESCRIPTIONS: {
            str: 'Increases physical attack damage and slightly affects max HP.',
            dex: 'Affects accuracy, evasion, and slightly influences attack speed.',
            con: 'Determines max HP and affects natural healing rate.',
            int: 'Increases critical hit chance and resistance to status effects.',
            wis: 'Improves perception, affects meditation, and slightly increases max vigor.'
        },
        MIN_VALUE: 1,
        MAX_VALUE: 10,
        VARIATION: {
            MIN_PERCENT: -10,  // -10%
            MAX_PERCENT: 10    // +10%
        },
        MODIFIER_LIMITS: {
            MAX_HP: 100,
            ATTACK: 100,
            DEFENSE: 100,
            ACCURACY: 100,
            EVASION: 100,
            PERCEPTION: 100,
            HEALING_DICE: 100,
            HEAL_MODIFIER: 100
        }
    },

    // 計算式関連
    FORMULAS: {
        MAX_HP: (stats, level) => {
            const baseHP = stats.con * 2 + Math.floor(stats.str / 4);
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const sizeModifier = 0.8 + (size.value * 0.1);  // Tiny: 0.9x, Small: 1.0x, Medium: 1.1x, Large: 1.2x, Huge: 1.3x
            const levelBonus = 1 + (level * 0.25);
            return Math.floor(baseHP * sizeModifier * levelBonus);
        },
        ATTACK: (stats) => {
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const sizeModifier = 0.8 + (size.value * 0.1);  // Tiny: 0.9x, Small: 1.0x, Medium: 1.1x, Large: 1.2x, Huge: 1.3x
            const base = Math.max(1, Math.floor((stats.str * 0.7 - stats.dex / 4) * sizeModifier));
            const diceCount = Math.max(1, Math.floor(Math.sqrt(stats.dex) / 2));
            const diceSides = Math.max(2, Math.floor(Math.sqrt(stats.str) * 2));
            return { base, diceCount, diceSides };
        },
        DEFENSE: (stats) => {
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const sizeModifier = 0.8 + (size.value * 0.1);  // Tiny: 0.9x, Small: 1.0x, Medium: 1.1x, Large: 1.2x, Huge: 1.3x
            const base = Math.max(1, Math.floor((stats.con * 0.5 - stats.int / 5) * sizeModifier));
            const diceCount = Math.max(1, Math.floor(Math.sqrt(stats.con) / 3));
            const diceSides = Math.max(2, Math.floor(Math.sqrt(stats.con) * 1.5));
            return { base, diceCount, diceSides };
        },
        ACCURACY: (stats) => {
            const speed = GAME_CONSTANTS.FORMULAS.SPEED(stats);
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const speedMod = (speed.value - 3) * 5;  // Normal(3)を基準に ±5%
            const sizeMod = (3 - size.value) * 3;    // Medium(3)を基準に ±3%
            const acc = 50 + Math.floor(stats.dex * 0.8) + Math.floor(stats.wis * 0.4)
                - Math.floor(stats.con / 4) + speedMod + sizeMod;
            return Math.min(85, Math.max(20, acc));
        },
        EVASION: (stats) => {
            const speed = GAME_CONSTANTS.FORMULAS.SPEED(stats);
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const speedMod = (speed.value - 3) * 4;  // Normal(3)を基準に ±4%
            const sizeMod = (3 - size.value) * 3;    // Medium(3)を基準に ±3%
            const eva = 8 + Math.floor(stats.dex * 0.6) + Math.floor(stats.wis * 0.3)
                - Math.floor(stats.con / 5) - Math.floor(stats.str / 5)
                + speedMod + sizeMod;
            return Math.min(60, Math.max(5, eva));
        },
        PERCEPTION: (stats) => {
            const base = Math.floor((stats.wis + stats.dex) / 2);
            const speed = GAME_CONSTANTS.FORMULAS.SPEED(stats);
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const speedMod = (speed.value - 3);
            const sizeMod = (3 - size.value);
            return Math.max(3, base + speedMod + sizeMod);
        },
        rollDamage: (attack, defense) => {
            let damage = attack.base;
            for (let i = 0; i < attack.diceCount; i++) {
                damage += Math.floor(Math.random() * attack.diceSides) + 1;
            }
            let def = defense.base;
            for (let i = 0; i < defense.diceCount; i++) {
                def += Math.floor(Math.random() * defense.diceSides) + 1;
            }
            return Math.max(1, damage - def);
        },
        HEALING_DICE: (stats) => ({
            count: Math.max(1, Math.floor(Math.sqrt(stats.con) / 2)),
            sides: Math.max(2, Math.floor(Math.sqrt(stats.con)))
        }),
        HEAL_MODIFIER: (stats) => {
            return Math.max(1, Math.floor(stats.con / 4) - Math.floor(stats.str / 6));
        },
        SLEEP_CHANCE: (stats) => {
            return Math.min(50, Math.max(0, 45 - Math.floor(stats.int * 2.5)));
        },
        SPEED: (stats) => {
            if (stats.str === stats.dex && stats.dex === stats.con && 
                stats.con === stats.int && stats.int === stats.wis) {
                const value = stats.dex; // どのステータスでも同じ値なので、dexを使用
                if (value <= 6) return { value: 1, name: "Very Slow" };
                if (value <= 9) return { value: 2, name: "Slow" };
                if (value <= 13) return { value: 3, name: "Normal" };
                if (value <= 16) return { value: 4, name: "Fast" };
                return { value: 5, name: "Very Fast" };
            }

            const baseSpeed = stats.dex - ((stats.str + stats.con) / 2);
            
            if (baseSpeed <= -4) return { value: 1, name: "Very Slow" };
            if (baseSpeed <= -2) return { value: 2, name: "Slow" };
            if (baseSpeed <= 2) return { value: 3, name: "Normal" };
            if (baseSpeed <= 4) return { value: 4, name: "Fast" };
            return { value: 5, name: "Very Fast" };
        },
        SIZE: (stats) => {
            if (stats.str === stats.dex && stats.dex === stats.con && 
                stats.con === stats.int && stats.int === stats.wis) {
                const value = stats.con;
                if (value <= 6) return { value: 1, name: "Tiny" };
                if (value <= 9) return { value: 2, name: "Small" };
                if (value <= 13) return { value: 3, name: "Medium" };
                if (value <= 16) return { value: 4, name: "Large" };
                return { value: 5, name: "Huge" };
            }

            const baseSize = (stats.con * 0.7 + stats.str * 0.3);
            
            if (baseSize <= 7) return { value: 1, name: "Tiny" };
            if (baseSize <= 10) return { value: 2, name: "Small" };
            if (baseSize <= 14) return { value: 3, name: "Medium" };
            if (baseSize <= 18) return { value: 4, name: "Large" };
            return { value: 5, name: "Huge" };
        },
        NATURAL_HEALING: {
            getSuccessChance: (stats) => {
                return 10 + Math.floor(stats.con / 6);  // 基本確率10%、CONは6ごとに+1%
            },
            calculateHeal: (healingDice, healModifier) => {
                let healAmount = 0;
                const rolls = [];
                for (let i = 0; i < healingDice.count; i++) {
                    const roll = Math.floor(Math.random() * healingDice.sides) + 1;
                    rolls.push(roll);
                    healAmount += roll;
                }
                healAmount = Math.max(0, healAmount + healModifier);
                return {
                    amount: healAmount,
                    rolls: rolls
                };
            },
            applyHeal: (entity, healAmount) => {
                const oldHp = entity.hp;
                entity.hp = Math.min(entity.maxHp, entity.hp + healAmount);
                return entity.hp - oldHp;  // 実際の回復量を返す
            }
        },
        CRITICAL_RANGE: (stats) => {
            const baseRange = 3;
            const dexBonus = Math.floor((stats.dex - 10) * 0.15);  // DEXが10以上で+0.15
            const intBonus = Math.floor((stats.int - 10) * 0.1);   // INTが10以上で+0.1
            return Math.min(5, Math.max(1, baseRange + dexBonus + intBonus));
        },
        // 遠距離攻撃の計算式を追加
        RANGED_COMBAT: {
            // エネルギー最大値の計算（INT + DEX / 2）
            ENERGY_MAX: (stats) => {
                return Math.floor(75 + stats.int * 2 + stats.dex);
            },
            // エネルギー回復量の計算（INT / 3 + 5）
            ENERGY_RECHARGE: (stats) => {
                return Math.floor(5 + stats.int / 3);
            },
            // エネルギーコストの計算（基本コスト - INT / 4）
            ENERGY_COST: (stats) => {
                return Math.max(15, Math.floor(30 - stats.int / 4));
            },
            // 基本攻撃力の計算（DEX * 0.5 + INT * 0.3）
            BASE_ATTACK: (stats) => {
                return Math.floor(stats.dex * 0.5 + stats.int * 0.3);
            },
            // 攻撃ダイスの計算
            ATTACK_DICE: (stats) => ({
                count: Math.max(1, Math.floor(stats.dex / 4)),
                sides: Math.max(2, Math.floor(stats.int / 3))
            }),
            // 命中率の計算（50 + DEX * 0.8 + INT * 0.4）
            ACCURACY: (stats) => {
                return Math.min(90, Math.floor(50 + stats.dex * 0.8 + stats.int * 0.4));
            },
            // 射程範囲の計算（4 + INT / 3）
            RANGE: (stats) => {
                return Math.floor(1 + stats.int / 3);
            },
            // サイズによる命中補正を計算（新規追加）
            SIZE_ACCURACY_MODIFIER: (targetStats) => {
                const size = GAME_CONSTANTS.FORMULAS.SIZE(targetStats);
                // Medium(3)を基準に、大きいほど+補正、小さいほど-補正
                // Tiny: -15%, Small: -10%, Medium: 0%, Large: +10%, Huge: +15%
                return (size.value - 3) * 5;
            }
        }
    },

    // 体力状態関連
    HEALTH_STATUS: {
        THRESHOLDS: {
            HEALTHY: 75,
            WOUNDED: 50,
            BADLY_WOUNDED: 25,
            NEAR_DEATH: 10
        },
        calculateThresholds: function (stats) {
            const conModifier = (stats.con - 10) * 0.5;  // 体力による修正
            const wisModifier = (stats.wis - 10) * 0.3;  // 知恵による修正
            return {
                HEALTHY: Math.min(90, Math.max(60, this.THRESHOLDS.HEALTHY - conModifier - wisModifier)),
                WOUNDED: Math.min(65, Math.max(35, this.THRESHOLDS.WOUNDED - conModifier - wisModifier)),
                BADLY_WOUNDED: Math.min(40, Math.max(15, this.THRESHOLDS.BADLY_WOUNDED - conModifier - wisModifier)),
                NEAR_DEATH: Math.min(15, Math.max(5, this.THRESHOLDS.NEAR_DEATH - conModifier - wisModifier))
            };
        },
        getStatus: function (currentHp, maxHp, stats) {
            if (currentHp <= 0) return {
                name: "Dead",
                color: "#4a4a4a"  // 暗いグレー
            };

            const percentage = (currentHp / maxHp) * 100;
            const thresholds = this.calculateThresholds(stats);

            if (currentHp === 1) return {
                name: "Near Death",
                color: "#8e44ad"  // 紫色
            };

            if (percentage <= thresholds.NEAR_DEATH) return {
                name: "Near Death",
                color: "#8e44ad"
            };
            if (percentage <= thresholds.BADLY_WOUNDED) return {
                name: "Badly Wounded",
                color: "#e74c3c"
            };
            if (percentage <= thresholds.WOUNDED) return {
                name: "Wounded",
                color: "#f1c40f"
            };
            return {
                name: "Healthy",
                color: "#2ecc71"
            };
        }
    },

    // 距離関連
    DISTANCE: {
        // チェビシェフ距離の計算メソッドを追加
        calculateChebyshev: (x1, y1, x2, y2) => {
            const dx = Math.abs(x2 - x1);
            const dy = Math.abs(y2 - y1);
            return Math.max(dx, dy);
        }
    },
    // Vigor関連
    VIGOR: {
        MAX: 100,
        THRESHOLDS: {
            HIGH: 75,     // 健全
            MODERATE: 50, // 疲労
            LOW: 25,      // 消耗
            CRITICAL: 10,  // 限界
            EXHAUSTED: 0   // 枯渇
        },
        DECREASE: {
            // Vigorが低いほど低下が緩やかになるように変更
            HIGH: 2,        // 健全状態では大きく低下
            MODERATE: 1,    // 疲労状態では中程度に低下
            LOW: 1,         // 消耗状態では少し低下
            CRITICAL: 1     // 限界状態では最小限の低下
        },
        calculateDecreaseChance: (turnsInFloor, dangerLevel) => {
            let baseChance;
            switch (dangerLevel) {
                case 'SAFE':
                    baseChance = 2; 
                    break;
                case 'NORMAL':
                    baseChance = 3; 
                    break;
                case 'DANGEROUS':
                    baseChance = 4; 
                    break;
                case 'DEADLY':
                    baseChance = 5; 
                    break;
                default:
                    baseChance = 3;  // デフォルト値
            }
            const turnModifier = Math.floor(turnsInFloor / 50);  // 50ターンごとに確率上昇
            const maxChance = {
                SAFE: 5,      // 安全: 最大5%
                NORMAL: 7,    // 通常: 最大7%
                DANGEROUS: 10, // 危険: 最大10%
                DEADLY: 15     // 致命的: 最大15%
            }[dangerLevel] || 7;
            return Math.min(maxChance, baseChance + turnModifier);
        },
        // Vigorの現在値に基づいて低下量を計算する新しい関数
        calculateDecreaseAmount: function(currentVigor, stats, healthStatus) {
            const percentage = (currentVigor / this.MAX) * 100;
            const thresholds = this.calculateThresholds(stats);
            
            // 基本低下量を計算（Vigorが低いほど低下が緩やかに）
            let baseDecrease;
            if (percentage <= thresholds.CRITICAL) baseDecrease = this.DECREASE.CRITICAL;
            else if (percentage <= thresholds.LOW) baseDecrease = this.DECREASE.LOW;
            else if (percentage <= thresholds.MODERATE) baseDecrease = this.DECREASE.MODERATE;
            else baseDecrease = this.DECREASE.HIGH;
            
            // 体力状態による修正（体力が低いほど低下が大きく）
            let healthMultiplier = 1.0;
            if (healthStatus) {
                switch (healthStatus.name) {
                    case "Near Death":
                        healthMultiplier = 1.5;  // 瀕死状態では1.5倍
                        break;
                    case "Badly Wounded":
                        healthMultiplier = 1.3;  // 重傷状態では1.3倍
                        break;
                    case "Wounded":
                        healthMultiplier = 1.1;  // 負傷状態では1.1倍
                        break;
                    default:
                        healthMultiplier = 1.0;  // 健康状態では修正なし
                }
            }
            
            // 最終的な低下量を計算（小数点以下切り上げ）
            return Math.ceil(baseDecrease * healthMultiplier);
        },
        calculateThresholds: function(stats) {
            const strModifier = (stats.str - 10) * 0.5;  // 力による修正
            const intModifier = (stats.int - 10) * 0.5;  // 知力による修正
            return {
                HIGH: Math.floor(Math.min(90, Math.max(60, this.THRESHOLDS.HIGH - strModifier - intModifier))),
                MODERATE: Math.floor(Math.min(65, Math.max(35, this.THRESHOLDS.MODERATE - strModifier - intModifier))),
                LOW: Math.floor(Math.min(40, Math.max(15, this.THRESHOLDS.LOW - strModifier - intModifier))),
                CRITICAL: Math.floor(Math.min(15, Math.max(5, this.THRESHOLDS.CRITICAL - strModifier - intModifier))),
                EXHAUSTED: Math.floor(Math.min(0, Math.max(0, this.THRESHOLDS.EXHAUSTED - strModifier - intModifier)))
            };
        },
        getStatus: function(currentVigor, stats) {
            const percentage = (currentVigor / this.MAX) * 100;
            const thresholds = this.calculateThresholds(stats);

            if (percentage <= thresholds.EXHAUSTED) return {
                name: "Exhausted",
                color: "#4a4a4a",
                ascii: "(x_xל)"
            };
            
            if (percentage <= thresholds.CRITICAL) return {
                name: "Critical",
                color: "#8e44ad",  // 紫色
                ascii: "◦˛⁔◦ל"
            };
            if (percentage <= thresholds.LOW) return {
                name: "Low",
                color: "#e74c3c",  // 赤色
                ascii: "•˛⁔•ל"
            };
            if (percentage <= thresholds.MODERATE) return {
                name: "Moderate",
                color: "#f1c40f",  // 黄色
                ascii: "∈Ō_Ōל"
            };
            return {
                name: "High",
                color: "#2ecc71",  // 緑色
                ascii: "∈ϴ‿ϴל"  // 変更
            };
        }
    },

    // 遠距離攻撃システムの設定を追加
    RANGED_COMBAT: {
        ENERGY: {
            MAX: 100,
            RECHARGE_RATE: 10,
            COST: 30
        },
        ATTACK: {
            BASE: 4,
            DICE: {
                COUNT: 2,
                SIDES: 4
            }
        },
        ACCURACY: 50,
        RANGE: 6
    }
};