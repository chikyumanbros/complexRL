const GAME_CONSTANTS = {
    // TILES Section: Terrain tiles and doors
    TILES: {
        FLOOR: ['.', '^', '~' ,'¨' , '：' ,'∙'],
        WALL: ['#', '█', '▓', '▒', '░'],
        DOOR: {
            OPEN: '/',
            CLOSED: '+'
        },
        OBSTACLE: {
            BLOCKING: ['Ж', 'Ш', '=', '◘', '◙'],      // 視線を遮る障害物（柱や大きな岩）
            TRANSPARENT: ['¤', '†', '‡', '§', '¶', '≡','£','╬', '╫', '╪', '┼','◊', '♠'],   // 視線を通す障害物（家具や装飾品）
        },
    },

    // STAIRS Section: Stairs properties
    STAIRS: {
        CHAR: '>',
        COLOR: '#FFFF00',
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
            get RAT() { return GAME_CONSTANTS.MONSTERS.RAT.color; },
            get BAT() { return GAME_CONSTANTS.MONSTERS.BAT.color; },
            get SNAKE() { return GAME_CONSTANTS.MONSTERS.SNAKE.color; },
            get GOBLIN() { return GAME_CONSTANTS.MONSTERS.GOBLIN.color; },
            get SPIDER() { return GAME_CONSTANTS.MONSTERS.SPIDER.color; },
            get SKELETON() { return GAME_CONSTANTS.MONSTERS.SKELETON.color; },
            get ZOMBIE() { return GAME_CONSTANTS.MONSTERS.ZOMBIE.color; },
            get GHOST() { return GAME_CONSTANTS.MONSTERS.GHOST.color; },
            get TROLL() { return GAME_CONSTANTS.MONSTERS.TROLL.color; }
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
            movement: '#3498db',    // 青 - 移動
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
        WIDTH: 60,
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
            title: "Movement",
            keys: [
                { key: "h/←", desc: "Move left" },
                { key: "j/↓", desc: "Move down" },
                { key: "k/↑", desc: "Move up" },
                { key: "l/→", desc: "Move right" },
                { key: "y", desc: "Move diagonally up-left" },
                { key: "u", desc: "Move diagonally up-right" },
                { key: "b", desc: "Move diagonally down-left" },
                { key: "n", desc: "Move diagonally down-right" },
                { key: ".", desc: "Wait one turn" },
                { key: "z", desc: "Auto explore" }
            ]
        },
        ACTIONS: {
            title: "Actions",
            keys: [
                { key: "1-9", desc: "Use skill" },
                { key: "o", desc: "Open door" },
                { key: "c", desc: "Close door" },
                { key: ">", desc: "Descend stairs | Auto move to stairs" },
                { key: "Tab", desc: "Toggle Codex menu" },
                { key: ";", desc: "Look mode" },
                { key: "?", desc: "Show this help" },
                { key: "Esc", desc: "Cancel/Close menu" }
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
            str: 10,
            dex: 10,
            con: 10,
            int: 10,
            wis: 10
        },

        // ステータスの説明
        DESCRIPTIONS: {
            str: 'Physical power, affects attack damage',
            dex: 'Agility and precision, affects accuracy and evasion',
            con: 'Endurance and toughness, affects HP and defense',
            int: 'Mental acuity, affects skills and learning',
            wis: 'Perception and intuition, affects healing and awareness'
        },

        // ステータスの最小値と最大値
        MIN_VALUE: 1,
        MAX_VALUE: 10,

        // ステータス変動の範囲（モンスター生成時用）
        VARIATION: {
            MIN_PERCENT: -10,  // -10%
            MAX_PERCENT: 10    // +10%
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
            // 知覚：WISとDEXが主要、STRとCONが高いとペナルティ
            const base = Math.floor((stats.wis + stats.dex) / 2);
            const penalty = Math.floor((stats.str + stats.con) / 5);
            return Math.max(3, base - penalty);
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
            // 速度：DEXと(STR+CON)のバランスで決定
            const baseSpeed = Math.floor(stats.dex * 0.7);  // DEXからの基本値
            const penalty = Math.floor((stats.str + stats.con) / 15);  // 重量ペナルティ
            const rawSpeed = Math.max(1, baseSpeed - penalty);
            
            // DEXと(STR+CON)の比率で速度を決定
            const dexRatio = stats.dex / ((stats.str + stats.con) / 2);
            
            if (dexRatio <= 0.7) return { value: 1, name: "Very Slow" };
            if (dexRatio <= 0.9) return { value: 2, name: "Slow" };
            if (dexRatio <= 1.1) return { value: 3, name: "Normal" };
            if (dexRatio <= 1.3) return { value: 4, name: "Fast" };
            return { value: 5, name: "Very Fast" };
        },
        SIZE: (stats) => {
            // 基準値（10）からの偏差を計算
            const strDev = stats.str - 10;
            const conDev = stats.con - 10;
            const intDev = stats.int - 10;
            
            // サイズ値 = STRとCONの平均偏差
            const sizeValue = (strDev + conDev) / 2;
            
            if (sizeValue <= -5) return { value: 1, name: "Tiny" };     // 非常に小さい
            if (sizeValue <= -3) return { value: 2, name: "Small" };    // 小さい
            if (sizeValue <= 3) return { value: 3, name: "Medium" };    // 中型
            if (sizeValue <= 5) return { value: 4, name: "Large" };     // 大きい
            return { value: 5, name: "Huge" };                          // 非常に大きい
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
        calculateThresholds: function(stats) {
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
        getStatus: function(currentHp, maxHp, stats) {
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

    // MONSTERS Section: Monster definitions and attributes
    MONSTERS: {
        RAT: {
            char: 'r',
            name: 'Rat',
            get color() {
                return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.RAT);
            },
            stats: {
                str: 4,    // 偏差: -6 (より小さな体格に)
                dex: 13,   // 高速な動きは維持
                con: 4,    // 偏差: -6 (より小さな体格に)
                int: 2,    // 偏差: -8 (変更なし)
                wis: 8     // 良好な知覚能力は維持
            },
            level: 1,
            pack: {
                chance: 0.7,    // 70% chance to form a pack
                min: 5,         // Minimum 2 creatures
                max: 15         // Maximum 4 creatures
            }
        },
        BAT: {
            char: 'b',
            name: 'Bat',
            get color() {
                return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.BAT);
            },
            stats: {
                str: 3,    // 偏差: -7 (極めて小さな体格)
                dex: 14,   // 非常に高速は維持
                con: 3,    // 偏差: -7 (極めて小さな体格)
                int: 2,    // 偏差: -8 (変更なし)
                wis: 10    // 優れたエコーロケーション能力は維持
            },
            level: 2,
            pack: {
                chance: 0.6,
                min: 5,
                max: 15
            }
        },
        SNAKE: {
            char: 's',
            name: 'Snake',
            get color() {
                return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.SNAKE);
            },
            stats: {
                str: 6,    // 中小型の体格
                dex: 12,   // 素早い
                con: 6,    // 適度な耐久力
                int: 3,    // 低い知性
                wis: 12    // 優れた感覚器官
            },
            level: 3,
            pack: {
                chance: 0.4,
                min: 2,
                max: 7
            }
        },
        GOBLIN: {
            char: 'g',
            name: 'Goblin',
            get color() {
                return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.GOBLIN);
            },
            stats: {
                str: 8,    // 中型の体格
                dex: 10,   // 平均的な素早さ
                con: 8,    // 中型の体格に合わせた体力
                int: 7,    // それなりの知性
                wis: 6     // 低い判断力
            },
            level: 2,
            pack: {
                chance: 0.5,
                min: 2,
                max: 4
            }
        },
        SPIDER: {
            char: 'a',
            name: 'Giant Spider',
            get color() {
                return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.SPIDER);
            },
            stats: {
                str: 7,    // 中型の体格
                dex: 13,   // 高い機動力
                con: 7,    // 中型の体格に合わせた体力
                int: 4,    // 低い知性
                wis: 11    // 優れた感覚
            },
            level: 3,
            pack: {
                chance: 0.4,
                min: 2,
                max: 10
            }
        },
        SKELETON: {
            char: 'k',
            name: 'Skeleton',
            get color() {
                return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.SKELETON);
            },
            stats: {
                str: 11,   // 大きな力
                dex: 7,    // 遅い動き
                con: 9,    // 頑丈な骨格
                int: 4,    // 低い知性
                wis: 5     // 乏しい判断力
            },
            level: 4,
            pack: {
                chance: 0.3,
                min: 2,
                max: 5
            }
        },
        ZOMBIE: {
            char: 'z',
            name: 'Zombie',
            get color() {
                return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.ZOMBIE);
            },
            stats: {
                str: 12,   // 強い腕力
                dex: 5,    // 非常に遅い
                con: 12,   // 高い耐久力
                int: 2,    // 極めて低い知性
                wis: 4     // 鈍い感覚
            },
            level: 4,
            pack: {
                chance: 0.4,
                min: 2,
                max: 10
            }
        },
        GHOST: {
            char: 'h',
            name: 'Ghost',
            get color() {
                return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.GHOST);
            },
            stats: {
                str: 4,    // 非物質的な弱さ
                dex: 12,   // 高い機動力
                con: 4,    // 非物質的な脆弱さ
                int: 11,   // 高い知性
                wis: 13    // 鋭い超常感覚
            },
            level: 5,
            pack: {
                chance: 0.2,
                min: 2,
                max: 5
            }
        },
        TROLL: {
            char: 'T',
            name: 'Troll',
            get color() {
                return GAME_CONSTANTS.SPRITE_COLORS.getMostUsedColor(GAME_CONSTANTS.MONSTER_SPRITES.TROLL);
            },
            stats: {
                str: 15,   // 巨大な力
                dex: 6,    // 遅い動き
                con: 15,   // 極めて頑丈
                int: 4,    // 低い知性
                wis: 7     // 平均的な感覚
            },
            level: 6,
            pack: {
                chance: 0.1,    // Trolls rarely form packs
                min: 2,
                max: 3
            }
        },
    },

     // MONSTER_SPRITES Section: Monster sprites
     MONSTER_SPRITES: {
        RAT: [  // 灰色の体に茶色の耳としっぽ
            "                ",
            "                ",
            "                ",
            "               S",
            "               S",
            "    SS        S ",
            "   SSS  SSS  S  ",
            "   SB SSSSSS  S ",
            "   SSSSSSSSSS  S",
            "  SWSSSSSSSSS  S",
            "  SSSSSSSSSSSS S",
            "BSSSSSSBBSSSSSS ",
            " S WBSS  SSSS   ",
            "     S   SSS    ",
            "      S    S    ",
            "          SS    "
        ],
        BAT: [  // 紫色の翼と赤い目
            "                ",
            "                ",
            "                ",
            "                ",
            "                ",
            "  CC C  C CCC   ",
            " CCCC CC CCCCC  ",
            " C  CCCCCCC  C  ",
            "     CCCC       ",
            "      CCC       ",
            "       C C      ",
            "                ",  
            "                ",
            "                ",
            "                ",
            "                ",
        ],
        SNAKE: [  // 黄色の模様入り緑色
            "                ",
            "                ",
            "   GGG          ",
            " GGGDGG         ",
            "  D GGGG        ",
            "  D  OOGG       ",
            "     OOOG       ",
            "     OOOG       ",
            "     OOG       G",
            "    OOG       G ",
            "    GG       G  ",
            "   GGG       GG ",
            "  GGG         GG",
            "  GGGG        GG",
            "  GGGGGG    GGG ",
            "   GGGGGGGGGGG  "
        ],
        GOBLIN: [  // オレンジの服と茶色の棍棒
            "                ",
            "         G      ",
            "       GGGG S   ",
            "     GGBGGG  S  ",
            "    GGGGGG   S  ",
            "    G  BB    S  ",
            "      GGGG  SS  ",
            "     G GG  BB   ",
            "   GG  G  G B   ",
            "       BB       ",
            "      B  B      ",
            "      B  B      ",
            "     G   G      ",
            "    GG  GG      ",
            "                ",
            "                "
        ],
        SPIDER: [  // 赤い体に黒い脚
            "                ",
            "                ",
            "         PP     ",
            "    P  PPPPP    ",
            "   P PPPPPPP P  ",
            "  PP PPPPPP P P ",
            " P PP      P P P",
            "P PP PPPPP  PPP ",
            "P  PPR   PR P P ",
            "  PPR PPPR PPP P",
            " P  PBBBPPPP   P",
            " P  B B BP PP  P",
            " P  B   B    P  ",
            " P   B B     P  ",
            "            P   ",
            "                "
        ],
        SKELETON: [  // 銀色の鎧の残骸
            "                ",
            "     WWWW       ",
            "    WWWWWW      ",
            "    WRWWRW      ",
            "     W  W       ",
            "                ",
            "      WW        ",
            "  WW      WW    ",
            "  WWW    WWW    ",
            " WW W WW W WW   ",
            " W   W  W   W   ",
            "   W      W     ",
            " W  WW  WW  W   ",
            " W W  WW  W W   ",
            "W   WW  WW   W  ",
            " W  W WW W  W   "
        ],
        ZOMBIE: [  // 腐敗した緑と茶色
            "                ",
            "   LLL          ",
            "   RRL          ",
            "   RRR          ",
            "   R LLL        ",
            "   R LLLL       ",
            "    LL  LL      ",
            "    L  LLR      ",
            "    L DDDDD     ",
            "    L RRDDD     ",
            "       RDD      ",
            "      D D       ",
            "      D DD      ",
            "      L  LL     ",
            "     LL   LL    ",
            "    LL   LL     "
        ],
        GHOST: [  // 青白い発光効果
            "                ",
            "     T          ",
            "     CT         ",
            "     CCT        ",
            "     CCT        ",
            "     TTTT       ",
            "    TTTTTT      ",
            "    TTTTTT      ",
            "    T TT  T     ",
            "     TTT TT     ",
            "   TT T TTTT    ",
            "   T CTTTTCT    ",
            "      TCT C C  C",
            "       T C C CC ",
            "          C CC  ",
            "           C    "
        ],
        TROLL: [  // 苔むした緑色の肌
            "       kWWW W   ",
            "    KKKDKWWW W  ",
            "    K KKKWW W W ",
            " D   WKKKK W W  ",
            "DDD  KK KW      ",
            "DDD    WWW K    ",
            " D  KWWWWWWKK   ",
            " D KK WWWW KK   ",
            " D K  WWWW KK   ",
            " KK  KKKK KK    ",
            "     KKKK KK    ",
            "      DDD       ",
            "      DDDD      ",
            "     DD DD      ",
            "     K    K     ",
            "   KK     KKK   "
        ],
    },

    // SPRITE_COLORS セクション: スプライト用の色定義（16色対応）
    SPRITE_COLORS: {
        getRandomizedColor: function(baseColor) {
            if (!baseColor) return null;
            
            // 16進数の色コードをRGBに分解
            const r = parseInt(baseColor.slice(1,3), 16);
            const g = parseInt(baseColor.slice(3,5), 16);
            const b = parseInt(baseColor.slice(5,7), 16);
            
            // 各色に±10%のランダムな変動を加える
            const variation = () => (Math.random() * 0.2 - 0.1);
            const clamp = (n) => Math.min(255, Math.max(0, Math.round(n)));
            
            const newR = clamp(r * (1 + variation()));
            const newG = clamp(g * (1 + variation()));
            const newB = clamp(b * (1 + variation()));
            
            return `#${newR.toString(16).padStart(2,'0')}${newG.toString(16).padStart(2,'0')}${newB.toString(16).padStart(2,'0')}`;
        },
        
        // 基本色の定義
        'B': '#474747',  // 暗いグレー（基本色）
        'W': '#B3B3B3',  // 薄いグレー（目など）
        'R': '#B34747',  // 暗い赤（ドラゴンなど）
        'G': '#47B347',  // 暗い緑（トロル、ゴブリンなど）
        'K': '#8B4B65',  // バーガンディ（暖色系の中間色）
        'N': '#00005A',  // 暗いネイビーブルー
        'O': '#B37400',  // 暗いオレンジ
        'Y': '#B3B300',  // 暗い黄色
        'P': '#8A328A',  // 明るい紫
        'C': '#00B3B3',  // 暗いシアン
        'M': '#B300B3',  // 暗いマゼンタ
        'D': '#741D1D',  // 暗い茶色
        'T': '#005A5A',  // 暗いティール
        'S': '#868686',  // 暗いシルバー
        'L': '#00B300',  // 暗いライム
        ' ': null,        // 透明

        // スプライトから最も頻繁に使用される色を検出
        getMostUsedColor: function(sprite) {
            const colorCount = {};
            
            // スプライトの各文字をカウント
            sprite.forEach(row => {
                [...row].forEach(char => {
                    if (char !== ' ') {
                        colorCount[char] = (colorCount[char] || 0) + 1;
                    }
                });
            });

            // 最も頻度の高い文字を見つける
            let mostUsedChar = Object.entries(colorCount)
                .sort((a, b) => b[1] - a[1])[0]?.[0];

            // 対応する色コードを返す
            return mostUsedChar ? this[mostUsedChar] : '#ffffff';
        }
    },

    DISTANCE: {
        calculate: (x1, y1, x2, y2) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        }
    }
};