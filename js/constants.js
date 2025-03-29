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

    // 液体関連の定数を統合
    LIQUIDS: {
        // 血液
        BLOOD: {
            CHAR: '≈',
            COLOR: '#800000', // より暗い赤
            ANIMATION_CHARS: ['≈', '∼', '≈', '∼', '≈', '∼'],
            ANIMATION_COLORS: [
                '#800000',  // より暗い赤色
                '#8B0000',  // 少し明るい、しかし暗い赤色
                '#A52A2A',  // 茶色がかった暗い赤色
                '#B22222',  // 少し明るい赤色
                '#A52A2A',  // 茶色がかった暗い赤色
                '#8B0000',  // 少し明るい、しかし暗い赤色
            ],
            SEVERITY: {
                LIGHT: {
                    CHAR: '∴',
                    COLOR: '#800000',
                    OPACITY: 0.6
                },
                MEDIUM: {
                    CHAR: '≈',
                    COLOR: '#8B0000',
                    OPACITY: 0.75
                },
                HEAVY: {
                    CHAR: '*',
                    COLOR: '#A52A2A',
                    OPACITY: 0.9
                }
            },
            DURATION: {
                BASE: 15,           // 基本持続ターン数
                SEVERITY_FACTOR: {  // 重症度による持続時間の追加係数
                    LIGHT: 1,       // 軽度: 基本持続時間×1
                    MEDIUM: 1.5,    // 中度: 基本持続時間×1.5
                    HEAVY: 2        // 重度: 基本持続時間×2
                }
            },
            // 血液量の管理用定数
            VOLUME: {
                // 出血量（リットル）
                AMOUNT: {
                    LIGHT: 0.2,      // 軽度の出血: 0.2リットル/ターン
                    MEDIUM: 0.5,     // 中度の出血: 0.5リットル/ターン
                    HEAVY: 1.0       // 重度の出血: 1.0リットル/ターン
                },
                // 閾値（どの量から重症度が変わるか）
                THRESHOLD: {
                    MEDIUM: 0.5,     // 中度の血痕になる閾値
                    HEAVY: 1.5       // 重度の血痕になる閾値
                },
                // モンスター死亡時の出血量（リットル）
                DEATH_AMOUNT: {
                    TINY: 0.5,       // 小型: 0.5リットル
                    SMALL: 1.0,      // 小さめ: 1.0リットル
                    MEDIUM: 2.0,     // 中型: 2.0リットル
                    LARGE: 4.0,      // 大型: 4.0リットル
                    HUGE: 6.0        // 巨大: 6.0リットル
                },
                // タイルの血液容量限界（リットル）
                TILE_CAPACITY: 5.0,  // 1タイルに最大5リットルまで
                // 溢れ出る割合（限界を超えた分の何%が溢れるか）
                OVERFLOW_RATIO: 0.7,  // 限界を超えた量の70%が周囲に溢れる
                // 最小量（これ未満になると消滅）
                MINIMUM: 0.05        // 0.05リットル未満で消滅
            },
            // 通過時の転移率（何%が移動先に付着するか）
            TRANSFER_RATE: 0.3,      // 30%が移動先に付着
            // 蒸発率（ターンごとに減少する割合）
            EVAPORATION_RATE: 0.0,   // 血液は蒸発しない（0%）
            // 特殊効果
            EFFECTS: {
                DISSOLVES_WEB: true  // 蜘蛛の巣を溶かす
            }
        },
        // 将来的に追加する液体タイプの例
        /*
        WATER: {
            CHAR: '~',
            COLOR: '#4169E1', // ロイヤルブルー
            SEVERITY: {
                LIGHT: {
                    CHAR: '·',
                    COLOR: '#4169E1',
                    OPACITY: 0.5
                },
                MEDIUM: {
                    CHAR: '~',
                    COLOR: '#1E90FF',
                    OPACITY: 0.7
                },
                HEAVY: {
                    CHAR: '≈',
                    COLOR: '#0000CD',
                    OPACITY: 0.9
                }
            },
            DURATION: {
                BASE: 10,
                SEVERITY_FACTOR: {
                    LIGHT: 1,
                    MEDIUM: 1.5,
                    HEAVY: 2
                }
            },
            VOLUME: {
                AMOUNT: {
                    LIGHT: 0.3,
                    MEDIUM: 0.7,
                    HEAVY: 1.2
                },
                THRESHOLD: {
                    MEDIUM: 0.6,
                    HEAVY: 1.8
                },
                TILE_CAPACITY: 6.0,
                OVERFLOW_RATIO: 0.8,
                MINIMUM: 0.1
            },
            TRANSFER_RATE: 0.4,
            EVAPORATION_RATE: 0.1,
            EFFECTS: {
                DISSOLVES_WEB: true,
                EXTINGUISHES_FIRE: true
            }
        }
        */
    },

    // 後方互換性のために残しておく（将来的には削除可能）
    BLOODPOOL: {
        CHAR: '≈',
        COLOR: '#800000', // より暗い赤
        ANIMATION_CHARS: ['≈', '∼', '≈', '∼', '≈', '∼'],
        ANIMATION_COLORS: [
            '#800000',  // より暗い赤色
            '#8B0000',  // 少し明るい、しかし暗い赤色
            '#A52A2A',  // 茶色がかった暗い赤色
            '#B22222',  // 少し明るい赤色
            '#A52A2A',  // 茶色がかった暗い赤色
            '#8B0000',  // 少し明るい、しかし暗い赤色
        ],
        SEVERITY: {
            LIGHT: {
                CHAR: '∴',
                COLOR: '#800000',
                OPACITY: 0.6
            },
            MEDIUM: {
                CHAR: '≈',
                COLOR: '#8B0000',
                OPACITY: 0.75
            },
            HEAVY: {
                CHAR: '*',
                COLOR: '#A52A2A',
                OPACITY: 0.9
            }
        },
        DURATION: {
            BASE: 15,           // 基本持続ターン数
            SEVERITY_FACTOR: {  // 重症度による持続時間の追加係数
                LIGHT: 1,       // 軽度: 基本持続時間×1
                MEDIUM: 1.5,    // 中度: 基本持続時間×1.5
                HEAVY: 2        // 重度: 基本持続時間×2
            }
        },
        // 血液量の管理用定数
        VOLUME: {
            // 出血量（リットル）
            BLEEDING_AMOUNT: {
                LIGHT: 0.2,      // 軽度の出血: 0.2リットル/ターン
                MEDIUM: 0.5,     // 中度の出血: 0.5リットル/ターン
                HEAVY: 1.0       // 重度の出血: 1.0リットル/ターン
            },
            // モンスター死亡時の出血量（リットル）
            DEATH_AMOUNT: {
                TINY: 0.5,       // 小型: 0.5リットル
                SMALL: 1.0,      // 小さめ: 1.0リットル
                MEDIUM: 2.0,     // 中型: 2.0リットル
                LARGE: 4.0,      // 大型: 4.0リットル
                HUGE: 6.0        // 巨大: 6.0リットル
            },
            // タイルの血液容量限界（リットル）
            TILE_CAPACITY: 5.0,  // 1タイルに最大5リットルまで
            // 溢れ出る割合（限界を超えた分の何%が溢れるか）
            OVERFLOW_RATIO: 0.7  // 限界を超えた量の70%が周囲に溢れる
        }
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
            get TROLL() { return SPRITE_COLORS.getMostUsedColor(MONSTER_SPRITES.TROLL); },
            get MECH_DRONE() { return SPRITE_COLORS.getMostUsedColor(MONSTER_SPRITES.MECH_DRONE); }
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
    },

    // モード関連
    MODES: {
        GAME: 'game',
        GAME_OVER: 'game_over',
        HELP: 'help',
        TITLE: 'title',
        WIKI: 'wiki'
    },

    // ディメンション関連
    DIMENSIONS: {
        WIDTH: 118,
        HEIGHT: 48
    },

    // 部屋生成関連
    ROOM: {
        MIN_SIZE: 7,
        MAX_SIZE: 15,
        MIN_COUNT: 15,
        MAX_COUNT: 25,
        PADDING: 0,
        SAFE_RADIUS: 3,
        BRIGHTNESS: {
            DIM: 4,      // 暗い部屋
            MODERATE: 6,  // 中程度の明るさ
            BRIGHT: 10,    // 明るい部屋
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
                { key: '>', desc: 'Use stairs down' },
                { key: 'c', desc: 'Close door' },
                { key: 'o', desc: 'Open door' },
                { key: 'z', desc: 'Cast skill (with number)' },
                { key: '?', desc: 'Show help menu' },
                //{ key: 'ctrl+s', desc: 'Show monster sprite preview' },
                { key: '[', desc: 'Scroll message log up' },
                { key: ']', desc: 'Scroll message log down' },
                { key: 'Shift+L', desc: 'Toggle lighting effects' }
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
            str: 8,
            dex: 8,
            con: 8,
            int: 8,
            wis: 8
        },
        DESCRIPTIONS: {
            str: 'Increases physical attack damage and slightly affects max HP.',
            dex: 'Affects accuracy, evasion, and slightly influences attack speed.',
            con: 'Determines max HP and overall physical toughness.',
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
            const speedMod = (speed.value - 3) * 5;  // Normal(3)を基準に ±5%
            const size = GAME_CONSTANTS.FORMULAS.SIZE(stats);
            const sizeMod = (3 - size.value) * 3;    // Medium(3)を基準に ±3%
            const acc = 60 + Math.floor(stats.dex * 0.8) + Math.floor(stats.wis * 0.4)
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
            return Math.max(6, base + speedMod + sizeMod);
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
                return 0;  // 常に0を返して回復させない（廃止）
            },
            calculateHeal: (healingDice, healModifier) => {
                return {
                    amount: 0,  // 常に0を返して回復させない（廃止）
                    rolls: []
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
                return Math.floor(2 + stats.int / 3);
            },
            // エネルギーコストの計算（基本コスト - INT / 4）
            ENERGY_COST: (stats) => {
                return Math.max(20, Math.floor(30 - stats.int / 4));
            },
            // 基本攻撃力の計算（DEX * 0.5 + INT * 0.3）
            BASE_ATTACK: (stats) => {
                return Math.floor(stats.dex * 0.5 + stats.int * 0.3);
            },
            // 攻撃ダイスの計算
            ATTACK_DICE: (stats) => ({
                count: Math.max(1, Math.floor(stats.dex / 5)),
                sides: Math.max(2, Math.floor(stats.int / 4))
            }),
            // 命中率の計算（50 + DEX * 0.8 + INT * 0.4）
            ACCURACY: (stats) => {
                const speed = GAME_CONSTANTS.FORMULAS.SPEED(stats);
                const speedMod = (speed.value - 3) * 5;  // Normal(3)を基準に ±5%
                return Math.min(90, Math.floor(40 + stats.dex * 0.8 + stats.int * 0.4 + speedMod));
            },
            // 射程範囲の計算（4 + INT / 3）
            RANGE: (stats) => {
                return Math.floor(2 + stats.int / 3);
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
    // Vigor関連（ダミー互換性用・廃止予定）
    VIGOR: {
        MAX: 100,
        THRESHOLDS: {
            HIGH: 75,
            MODERATE: 50,
            LOW: 25,
            CRITICAL: 10,
            EXHAUSTED: 0
        },
        DECREASE: {
            HIGH: 0,
            MODERATE: 0,
            LOW: 0,
            CRITICAL: 0
        },
        calculateDecreaseChance: () => 0,
        calculateDecreaseAmount: () => 0,
        calculateThresholds: () => ({
            HIGH: 75,
            MODERATE: 50,
            LOW: 25,
            CRITICAL: 10,
            EXHAUSTED: 0
        }),
        getStatus: () => ({
            name: "High",
            color: "#2ecc71",
            ascii: "∈ϴ‿ϴל"
        })
    },

    // 遠距離攻撃システムの設定
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