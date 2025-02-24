const GAME_CONSTANTS = {
    // TILES Section: Terrain tiles and doors
    TILES: {
        FLOOR: ['.', '^', '~', '¨', '：', '∙'],
        WALL: ['#', '█', '▓', '▒', '░'],
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
            BLOCKING: ['Ж', 'Ш', '=', '◘', '◙'],      // 視線を遮る障害物（柱や大きな岩）
            TRANSPARENT: ['¤', '†', '‡', '¶', '≡', '£', '┼', '◊', '♠'],   // 視線を通す障害物（家具や装飾品）
        },
        // 宇宙空間用のタイルを追加
        SPACE: [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ',' ',' ',' ',' ',' ', '░', '·', '°' , '*', '◊', '○', '●', '☼', '÷', 'ø', 'פ'],
        
        // 宇宙の色パレット
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

    // STAIRS Section: Stairs properties
    STAIRS: {
        CHAR: '>',
        COLOR: '#FFFF00',
    },

    // PORTALセクションを追加
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

    // COLORS Section: Color definitions for various elements
    COLORS: {
        FLOOR: '#333',
        WALL_VARIATIONS: [
            '#556',  // Basic blue-gray
            '#755',  // Red-gray
            '#565',  // Green-gray
            '#577',  // Blue-green-gray
            '#655',  // Yellow-gray
            '#757',  // Purple-gray
            '#557',  // Light bluish-gray
            '#765',  // Orangish-gray
            '#575',  // Emerald-tinted gray
            '#776',  // Golden-tinted gray
        ],
        WALL: '#556',  // Default wall color (kept for backward compatibility)
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
            BLOCKING_VARIATIONS: [
                '#664433',  // 基本の茶色
                '#553322',  // 暗い茶色
                '#775544',  // 明るい茶色
                '#664422',  // 黄みがかった茶色
                '#663333',  // 赤みがかった茶色
                '#555533',  // 緑がかった茶色
                '#A9A9A9',  // 銀色
                '#D2B48C',  // 金色
                '#008080',  // 青緑色
                '#B1B1B1',  // 鋼鉄色
                '#FFD700',  // 黄金色
                '#C71585',  // 銅色
            ],
            TRANSPARENT_VARIATIONS: [
                '#8B4513',  // 基本の木製色
                '#A0522D',  // サドルブラウン
                '#6B4423',  // 暗い木製色
                '#8B6914',  // 黄みがかった木製色
                '#7C3607',  // 赤みがかった木製色
                '#855E42',  // 明るい木製色
                '#9A8661',  // さらに明るい木製色
                '#7A6B5A',  // さらに暗い木製色
                '#FFA07A',  // 朱色
                '#FF6347',  // 朱色の濃い版
            ],
            BLOCKING: '#664433',     // 後方互換性のため維持
            TRANSPARENT: '#8B4513',  // 後方互換性のため維持
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

    // MODES Section: Game mode identifiers
    MODES: {
        GAME: 'game',
        CODEX: 'codex',
        GAME_OVER: 'game_over',
        HELP: 'help',
        TITLE: 'title'
    },

    // DIMENSIONS Section: Game board dimensions
    DIMENSIONS: {
        WIDTH: 65,
        HEIGHT: 35
    },

    // ROOM Section: Room generation parameters
    ROOM: {
        MIN_SIZE: 5,
        MAX_SIZE: 15,
        MIN_COUNT: 10,
        MAX_COUNT: 15,
        PADDING: 2,
        SAFE_RADIUS: 3,
        // 部屋の明るさの定義を追加
        BRIGHTNESS: {
            DIM: 2,      // 暗い部屋（視界2マス）
            MODERATE: 4,  // 中程度の明るさ（視界4マス）
            BRIGHT: 6,    // 明るい部屋（視界6マス）
            PROBABILITIES: {
                DIM: 0.2,      // 20%の確率
                MODERATE: 0.4,  // 40%の確率
                BRIGHT: 0.4     // 40%の確率
            }
        },
        OBSTACLES: {
            CHANCE: 0.7,           // 部屋に障害物を配置する確率
            MIN_COUNT: 2,          // 最小障害物数（ランダムパターンの場合のみ使用）
            MAX_COUNT: 8,          // 最大障害物数（ランダムパターンの場合のみ使用）
            TRANSPARENT_RATIO: 0.5, // 視線を通す障害物の割合
            MIN_ROOM_SIZE: 7       // パターン配置に必要な最小部屋サイズ
        }
    },

    // DANGER_LEVELS Section: Danger level configurations
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

    // CONTROLS Section: Key bindings for game controls
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
                { key: '<', desc: 'Use stairs up' },
                { key: 'c', desc: 'Close door' },
                { key: 's', desc: 'Show skill tree' },
                { key: 'z', desc: 'Cast skill (with number)' },
                { key: 'm', desc: 'Toggle music' },
                { key: '?', desc: 'Show help menu' },
                { key: 'ctrl+s', desc: 'Show monster sprite preview' }
            ]
        },
        // ランドマークターゲットモードの説明を追記
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

    // 新規: ステータス定義を追加
    STATS: {
        // ステータスの種類
        TYPES: {
            STR: 'str',
            DEX: 'dex',
            CON: 'con',
            INT: 'int',
            WIS: 'wis'
        },

        // ステータスの表示名
        NAMES: {
            str: 'Strength',
            dex: 'Dexterity',
            con: 'Constitution',
            int: 'Intelligence',
            wis: 'Wisdom'
        },

        // 初期値（プレイヤー用）
        DEFAULT_VALUES: {
            str: 6,
            dex: 6,
            con: 6,
            int: 6,
            wis: 6
        },

        // ステータスの説明
        DESCRIPTIONS: {
            str: 'Increases physical attack damage and slightly affects max HP.',
            dex: 'Affects accuracy, evasion, and slightly influences attack speed.',
            con: 'Determines max HP and affects natural healing rate.',
            int: 'Increases critical hit chance and resistance to status effects.',
            wis: 'Improves perception, affects meditation, and slightly increases max vigor.'
        },

        // ステータスの最小値と最大値
        MIN_VALUE: 1,
        MAX_VALUE: 10,

        // ステータス変動の範囲（モンスター生成時用）
        VARIATION: {
            MIN_PERCENT: -10,  // -10%
            MAX_PERCENT: 10    // +10%
        },

        // ステータス補正の限界値
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

    // FORMULAS Section: Calculations for character stats and actions
    FORMULAS: {
        MAX_HP: (stats, level) => {
            const baseHP = stats.con * 2 + Math.floor(stats.str / 4);
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const sizeModifier = 0.8 + (size.value * 0.1);  // Tiny: 0.9x, Small: 1.0x, Medium: 1.1x, Large: 1.2x, Huge: 1.3x
            const levelBonus = 1 + (level * 0.25);
            return Math.floor(baseHP * sizeModifier * levelBonus);
        },
        ATTACK: (stats) => {
            // 基本攻撃力：STRが主要、DEXが高すぎるとペナルティ、SIZEが影響
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const sizeModifier = 0.8 + (size.value * 0.1);  // Tiny: 0.9x, Small: 1.0x, Medium: 1.1x, Large: 1.2x, Huge: 1.3x
            const base = Math.max(1, Math.floor((stats.str * 0.7 - stats.dex / 4) * sizeModifier));

            // ダイス数：DEXに基づくが、徐々に上昇が緩やかに
            const diceCount = Math.max(1, Math.floor(Math.sqrt(stats.dex) / 2));

            // ダイス面：STRに基づき、徐々に上昇が緩やかに
            const diceSides = Math.max(2, Math.floor(Math.sqrt(stats.str) * 2));

            return { base, diceCount, diceSides };
        },
        DEFENSE: (stats) => {
            // 基本防御：CONが主要、INTが高いとペナルティ、SIZEが影響
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const sizeModifier = 0.8 + (size.value * 0.1);  // Tiny: 0.9x, Small: 1.0x, Medium: 1.1x, Large: 1.2x, Huge: 1.3x
            const base = Math.max(1, Math.floor((stats.con * 0.5 - stats.int / 5) * sizeModifier));

            // 防御ダイス数：CONに基づくが、緩やかに
            const diceCount = Math.max(1, Math.floor(Math.sqrt(stats.con) / 3));

            // 防御ダイス面：CONに基づき、徐々に上昇が緩やかに
            const diceSides = Math.max(2, Math.floor(Math.sqrt(stats.con) * 1.5));

            return { base, diceCount, diceSides };
        },
        ACCURACY: (stats) => {
            // SPEEDとSIZEの影響を計算
            const speed = GAME_CONSTANTS.FORMULAS.SPEED(stats);
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const speedMod = (speed.value - 3) * 5;  // Normal(3)を基準に ±5%
            const sizeMod = (3 - size.value) * 3;    // Medium(3)を基準に ±3%

            // 基本命中率50%、DEXとWISで上昇、CONで減少
            const acc = 50 + Math.floor(stats.dex * 0.8) + Math.floor(stats.wis * 0.4)
                - Math.floor(stats.con / 4) + speedMod + sizeMod;

            return Math.min(85, Math.max(20, acc));
        },
        EVASION: (stats) => {
            // SPEEDとSIZEの影響を計算
            const speed = GAME_CONSTANTS.FORMULAS.SPEED(stats);
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const speedMod = (speed.value - 3) * 4;  // Normal(3)を基準に ±4%
            const sizeMod = (3 - size.value) * 3;    // Medium(3)を基準に ±3%

            // 基本回避率8%、DEXとWISで上昇、CONとSTRで減少
            const eva = 8 + Math.floor(stats.dex * 0.6) + Math.floor(stats.wis * 0.3)
                - Math.floor(stats.con / 5) - Math.floor(stats.str / 5)
                + speedMod + sizeMod;

            return Math.min(60, Math.max(5, eva));
        },
        PERCEPTION: (stats) => {
            // 基本知覚：WISとDEXの平均
            const base = Math.floor((stats.wis + stats.dex) / 2);

            // SPEEDとSIZEの影響を計算
            const speed = GAME_CONSTANTS.FORMULAS.SPEED(stats);
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);

            // 速度修正：Normal(3)を基準に ±1
            const speedMod = (speed.value - 3);

            // サイズ修正：Medium(3)を基準に ±1
            // 小さいほど知覚が高く、大きいほど低い
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
            // 回復修正：CONがプラス、STRがマイナスに影響
            return Math.max(1, Math.floor(stats.con / 4) - Math.floor(stats.str / 6));
        },
        SLEEP_CHANCE: (stats) => {
            // 睡眠耐性：INTが主要
            return Math.min(50, Math.max(0, 45 - Math.floor(stats.int * 2.5)));
        },
        SPEED: (stats) => {
            // 全てのステータスが同じ場合は、その値に基づいて判定
            if (stats.str === stats.dex && stats.dex === stats.con && 
                stats.con === stats.int && stats.int === stats.wis) {
                const value = stats.dex; // どのステータスでも同じ値なので、dexを使用
                if (value <= 6) return { value: 1, name: "Very Slow" };
                if (value <= 9) return { value: 2, name: "Slow" };
                if (value <= 13) return { value: 3, name: "Normal" };
                if (value <= 16) return { value: 4, name: "Fast" };
                return { value: 5, name: "Very Fast" };
            }

            // 通常の計算（DEXと(STR+CON)/2で判定）
            const baseSpeed = stats.dex - ((stats.str + stats.con) / 2);
            
            if (baseSpeed <= -4) return { value: 1, name: "Very Slow" };
            if (baseSpeed <= -2) return { value: 2, name: "Slow" };
            if (baseSpeed <= 2) return { value: 3, name: "Normal" };
            if (baseSpeed <= 4) return { value: 4, name: "Fast" };
            return { value: 5, name: "Very Fast" };
        },
        SIZE: (stats) => {
            // 全てのステータスが同じ場合は、その値に基づいて判定
            if (stats.str === stats.dex && stats.dex === stats.con && 
                stats.con === stats.int && stats.int === stats.wis) {
                const value = stats.con;
                if (value <= 6) return { value: 1, name: "Tiny" };
                if (value <= 9) return { value: 2, name: "Small" };
                if (value <= 13) return { value: 3, name: "Medium" };
                if (value <= 16) return { value: 4, name: "Large" };
                return { value: 5, name: "Huge" };
            }

            // 通常の計算（CONとSTRに基づく）
            const baseSize = (stats.con * 0.7 + stats.str * 0.3);
            
            if (baseSize <= 7) return { value: 1, name: "Tiny" };
            if (baseSize <= 10) return { value: 2, name: "Small" };
            if (baseSize <= 14) return { value: 3, name: "Medium" };
            if (baseSize <= 18) return { value: 4, name: "Large" };
            return { value: 5, name: "Huge" };
        },
        // 自然回復の処理を追加
        NATURAL_HEALING: {
            // 回復判定の基本成功率とステータス補正を計算（基本確率を10%に下げ、CONの影響も抑制）
            getSuccessChance: (stats) => {
                return 10 + Math.floor(stats.con / 6);  // 基本確率10%、CONは6ごとに+1%
            },

            // 回復量を計算（ダイスロールと修正値を含む）
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

            // 実際の回復処理（HP上限を考慮）
            applyHeal: (entity, healAmount) => {
                const oldHp = entity.hp;
                entity.hp = Math.min(entity.maxHp, entity.hp + healAmount);
                return entity.hp - oldHp;  // 実際の回復量を返す
            }
        },
        CRITICAL_RANGE: (stats) => {
            const baseRange = 3;
            const dexBonus = Math.floor((stats.dex - 10) * 0.15);  // DEXが10以上で+0.15（約7ポイントで+1）
            const intBonus = Math.floor((stats.int - 10) * 0.1);   // INTが10以上で+0.1（10ポイントで+1）
            
            return Math.min(5, Math.max(1, baseRange + dexBonus + intBonus));
        }
    },

    // 体力状態の判定システム
    HEALTH_STATUS: {
        // 基本となる閾値（%）
        THRESHOLDS: {
            HEALTHY: 75,
            WOUNDED: 50,
            BADLY_WOUNDED: 25,
            NEAR_DEATH: 10
        },

        // ステータスによる閾値の修正計算
        calculateThresholds: function (stats) {
            // 体力と知恵が高いほど、より低いHP%でも良好な状態を維持できる
            const conModifier = (stats.con - 10) * 0.5;  // 体力による修正（±0.5%ずつ）
            const wisModifier = (stats.wis - 10) * 0.3;  // 知恵による修正（±0.3%ずつ）

            // 閾値に修正を「加算」しているため、高いステータスはより低いHP%まで状態を維持
            return {
                HEALTHY: Math.min(90, Math.max(60, this.THRESHOLDS.HEALTHY - conModifier - wisModifier)),
                WOUNDED: Math.min(65, Math.max(35, this.THRESHOLDS.WOUNDED - conModifier - wisModifier)),
                BADLY_WOUNDED: Math.min(40, Math.max(15, this.THRESHOLDS.BADLY_WOUNDED - conModifier - wisModifier)),
                NEAR_DEATH: Math.min(15, Math.max(5, this.THRESHOLDS.NEAR_DEATH - conModifier - wisModifier))
            };
        },

        // 体力状態の判定
        getStatus: function (currentHp, maxHp, stats) {
            // 死亡判定を最初に行う
            if (currentHp <= 0) return {
                name: "Dead",
                color: "#4a4a4a"  // 暗いグレー
            };

            const percentage = (currentHp / maxHp) * 100;
            const thresholds = this.calculateThresholds(stats);

            // HPが1の場合は必ずNear Death状態とする
            if (currentHp === 1) return {
                name: "Near Death",
                color: "#8e44ad"  // 紫色
            };

            // 閾値の判定を修正（小さい方から判定）
            if (percentage <= thresholds.NEAR_DEATH) return {
                name: "Near Death",
                color: "#8e44ad"  // 紫色
            };
            if (percentage <= thresholds.BADLY_WOUNDED) return {
                name: "Badly Wounded",
                color: "#e74c3c"  // 赤色
            };
            if (percentage <= thresholds.WOUNDED) return {
                name: "Wounded",
                color: "#f1c40f"  // 黄色
            };
            return {
                name: "Healthy",
                color: "#2ecc71"  // 緑色
            };
        }
    },

    DISTANCE: {
        calculate: (x1, y1, x2, y2) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        }
    },

    SKILL_DISTANCE: {
        calculate: (x1, y1, x2, y2) => {
            const dx = Math.abs(x2 - x1);
            const dy = Math.abs(y2 - y1);
            return Math.max(dx, dy);
        }
    },

    VIGOR: {
        MAX: 100,
        DEFAULT: 100,
        
        // 基本となる閾値（%）
        THRESHOLDS: {
            HIGH: 75,     // 健全
            MODERATE: 50, // 疲労
            LOW: 25,      // 消耗
            CRITICAL: 10  // 限界
        },

        // 状態による減少値
        DECREASE: {
            HEALTHY: 1,
            WOUNDED: 3,
            BADLY_WOUNDED: 5,
            NEAR_DEATH: 10
        },

        // ターン経過による減少確率の計算
        calculateDecreaseChance: (turnsInFloor, dangerLevel) => {
            // 基本確率をフロアの危険度によって変更
            let baseChance;
            switch (dangerLevel) {
                case 'SAFE':
                    baseChance = 1;  // 安全: 1%
                    break;
                case 'NORMAL':
                    baseChance = 3;  // 通常: 3%
                    break;
                case 'DANGEROUS':
                    baseChance = 6;  // 危険: 6%
                    break;
                case 'DEADLY':
                    baseChance = 9; // 致命的: 9%
                    break;
                default:
                    baseChance = 3;  // デフォルト値
            }

            const turnModifier = Math.floor(turnsInFloor / 20);  // 20ターンごとに確率上昇

            // 最大確率も危険度によって変動
            const maxChance = {
                SAFE: 15,      // 安全: 最大15%
                NORMAL: 25,    // 通常: 最大25%（変更なし）
                DANGEROUS: 35, // 危険: 最大35%
                DEADLY: 45     // 致命的: 最大45%
            }[dangerLevel] || 25;

            return Math.min(maxChance, baseChance + turnModifier);
        },

        // 閾値の計算（STRとINTの影響を受ける）
        calculateThresholds: function(stats) {
            // STRとINTが高いほど、より低い%でも良好な状態を維持できる
            const strModifier = (stats.str - 10) * 0.5;  // 力による修正（±0.5%ずつ）
            const intModifier = (stats.int - 10) * 0.5;  // 知力による修正（±0.5%ずつ）
            
            return {
                HIGH: Math.floor(Math.min(90, Math.max(60, this.THRESHOLDS.HIGH - strModifier - intModifier))),
                MODERATE: Math.floor(Math.min(65, Math.max(35, this.THRESHOLDS.MODERATE - strModifier - intModifier))),
                LOW: Math.floor(Math.min(40, Math.max(15, this.THRESHOLDS.LOW - strModifier - intModifier))),
                CRITICAL: Math.floor(Math.min(15, Math.max(5, this.THRESHOLDS.CRITICAL - strModifier - intModifier)))
            };
        },

        // Vigorの状態判定
        getStatus: function(currentVigor, stats) {
            if (currentVigor <= 0) return {
                name: "Exhausted",
                color: "#4a4a4a",  // 暗いグレー
                ascii: "(x_xל)"
            };

            const percentage = (currentVigor / this.MAX) * 100;
            const thresholds = this.calculateThresholds(stats);

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
    }
};