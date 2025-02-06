const GAME_CONSTANTS = {
    // TILES Section: Terrain tiles and doors
    TILES: {
        FLOOR: ['.', '^', '~'],
        WALL: ['#', '?', '=', '$', '*'],
        DOOR: {
            OPEN: '/',
            CLOSED: '+'
        }
    },

    // STAIRS Section: Stairs properties
    STAIRS: {
        CHAR: '>',
        COLOR: '#FFFF00',
    },

    // COLORS Section: Color definitions for various elements
    COLORS: {
        FLOOR: '#222',
        WALL_VARIATIONS: [
            '#445',  // Basic blue-gray
            '#544',  // Red-gray
            '#454',  // Green-gray
            '#455',  // Blue-green-gray
            '#554',  // Yellow-gray
            '#545',  // Purple-gray
            '#556',  // Light bluish-gray
            '#655',  // Orangish-gray
            '#565',  // Emerald-tinted gray
            '#665',  // Golden-tinted gray
        ],
        WALL: '#445',  // Default wall color (kept for backward compatibility)
        DOOR: '#8B4513',
        HEAL: '#2ed573',
        MONSTER: {
            RAT: '#a33',
            BAT: '#c66',
            SNAKE: '#6a6',
            GOBLIN: '#3a3',
            SPIDER: '#939',
            SKELETON: '#eee',
            ZOMBIE: '#6a6',
            GHOST: '#6cf',
            TROLL: '#383',
            DRAGON_WHELP: '#d33'
        },
    },

    // MODES Section: Game mode identifiers
    MODES: {
        GAME: 'game',
        CODEX: 'codex',
        GAME_OVER: 'game_over',
        HELP: 'help'
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
        SAFE_RADIUS: 3
    },

    // FORMULAS Section: Calculations for character stats and actions
    FORMULAS: {
        MAX_HP: (stats, level) => Math.floor((stats.con * 2 + stats.str / 5) * (1 + level * 0.2)),
        ATTACK: (stats) => ({
            base: Math.max(0, Math.floor(stats.str - stats.dex / 2)),
            diceCount: Math.floor(stats.dex / 5),
            diceSides: Math.floor(stats.str / 5) * 3
        }),
        DEFENSE: (stats) => ({
            base: Math.max(1, Math.floor(stats.con - stats.str / 2)),
            diceCount: Math.floor(stats.str / 5),
            diceSides: Math.floor(stats.con / 5) * 3
        }),
        ACCURACY: (stats) => Math.floor(50 + stats.dex * 1.5),
        EVASION: (stats) => Math.floor(stats.dex * 1.2),
        PERCEPTION: (stats) => Math.floor(3 + stats.wis * 0.4),
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
            count: Math.floor(1 + stats.con / 20),
            sides: Math.floor(1 + stats.con / 20)
        }),
        HEAL_MODIFIER: (stats) => Math.max(1, Math.floor((stats.con - stats.str) / 2)),
        SLEEP_CHANCE: (stats) => {
            // Lower intelligence increases sleepiness. Maximum 50% chance.
            return Math.min(50, Math.max(0, 50 - stats.int * 8));
        },
        SPEED: (stats) => Math.max(1, Math.floor(stats.dex - ((stats.str + stats.con) / 10)))
    },

    // MONSTERS Section: Monster definitions and attributes
    MONSTERS: {
        RAT: {
            char: 'r',
            name: 'Rat',
            stats: {
                str: 8,
                dex: 14,
                con: 8,
                int: 2,
                wis: 8
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
            stats: {
                str: 6,
                dex: 16,
                con: 6,
                int: 3,
                wis: 10
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
            stats: {
                str: 12,
                dex: 12,
                con: 7,
                int: 4,
                wis: 12
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
            stats: {
                str: 10,
                dex: 10,
                con: 9,
                int: 8,
                wis: 6
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
            stats: {
                str: 8,
                dex: 18,
                con: 8,
                int: 5,
                wis: 14
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
            stats: {
                str: 14,
                dex: 8,
                con: 12,
                int: 4,
                wis: 6
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
            stats: {
                str: 12,
                dex: 6,
                con: 11,
                int: 2,
                wis: 4
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
            stats: {
                str: 4,
                dex: 18,
                con: 4,
                int: 14,
                wis: 16
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
            stats: {
                str: 18,
                dex: 6,
                con: 18,
                int: 3,
                wis: 8
            },
            level: 6,
            pack: {
                chance: 0.1,    // Trolls rarely form packs
                min: 2,
                max: 3
            }
        },
        DRAGON_WHELP: {
            char: 'D',
            name: 'Dragon Whelp',
            stats: {
                str: 16,
                dex: 14,
                con: 16,
                int: 12,
                wis: 14
            },
            level: 7,
            pack: {
                chance: 0.15,   // Dragon whelps rarely appear in pairs
                min: 2,
                max: 2
            }
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
                { key: "Tab", desc: "Toggle Codex menu" },
                { key: ";", desc: "Look mode" },
                { key: "?", desc: "Show this help" },
                { key: "Esc", desc: "Cancel/Close menu" }
            ]
        }
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
            "  SDSSSSSSSSS  S",
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
            " D  GGGG        ",
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
            "  OOGG  ",
            " OWWWGO ",
            "GODDDDOG",
            "GORRRROG",
            " OGDGGO ",
            "  DDDD  ",
            " O DD O ",
            "D    D "
        ],
        SPIDER: [  // 赤い体に黒い脚
            "                ",
            "                ",
            "         PPPP   ",
            "PP     PPPPPPP  ",
            "P P  PPPPPPPPP  ",
            "   P PPPPPPPPP  ",
            " P PP      PPP P",
            "P PP PPPPP  PPP ",
            "P  PPR   PR P P ",
            "  PPRRPPPRRPPP P",
            " P  PPPPPPPP   P",
            " P  PP PPP PP  P",
            " P  B   B    P  ",
            " P   B B     P  ",
            "            P   ",
            "                "
        ],
        SKELETON: [  // 銀色の鎧の残骸
            "  SSSS  ",
            " SWWWWS ",
            "SSBBBBSS",
            "SBRRRRBS",
            " SWWWWS ",
            "  S  S  ",
            " W SS W ",
            "S      S"
        ],
        ZOMBIE: [  // 腐敗した緑と茶色
            "  GGDG  ",
            " GWWGDG ",
            "GGDDBDDG",
            "GDDRRRDG",
            " GDDDDG ",
            "  D  D  ",
            " D DD D ",
            "D    DD"
        ],
        GHOST: [  // 青白い発光効果
            "  CCCC  ",
            " CWWWWC ",
            "CCNNNNCC",
            "CNNNNNNC",
            " CCNNNN ",
            "  N  N  ",
            " C NN C ",
            "N      N"
        ],
        TROLL: [  // 苔むした緑色の肌
            "  TTTT  ",
            " TWWTTT ",
            "TTDDDDTT",
            "TDRRRRDT",
            " TDDDDT ",
            "  D  D  ",
            " T DT T ",
            "D TTTT D"
        ],
        DRAGON_WHELP: [  // 炎色の鱗
            "  OOYY  ",
            " OWWYYO ",
            "OOYYRRYY",
            "OYRRYYRO",
            " OYRRYO ",
            "  R  R  ",
            " Y RR Y ",
            "R  YY  R"
        ]
    },

    // SPRITE_COLORS セクション: スプライト用の色定義（16色対応）
    SPRITE_COLORS: {
        'B': '#474747',  // 暗いグレー（基本色）
        'W': '#B3B3B3',  // 薄いグレー（目など）
        'R': '#B34747',  // 暗い赤（ドラゴンなど）
        'G': '#47B347',  // 暗い緑（トロル、ゴブリンなど）
        'K': '#242424',  // より暗い黒の代替色（黒は透明で使えるため変更）
        'N': '#00005A',  // 暗いネイビーブルー
        'O': '#B37400',  // 暗いオレンジ
        'Y': '#B3B300',  // 暗い黄色
        'P': '#5A005A',  // 暗い紫
        'C': '#00B3B3',  // 暗いシアン
        'M': '#B300B3',  // 暗いマゼンタ
        'D': '#741D1D',  // 暗い茶色
        'T': '#005A5A',  // 暗いティール
        'S': '#868686',  // 暗いシルバー
        'L': '#00B300',  // 暗いライム（明るい緑の代わりに）
        ' ': null        // 透明
    }
};