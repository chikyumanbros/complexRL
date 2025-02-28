const MONSTER_SPRITES = {
    RAT: [  // 灰色の体に茶色の耳としっぽ
        [  // フレーム1
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
        [  // フレーム2 - 少し動きを付ける
            "                ",
            "                ",
            "                ",
            "               S",
            "              SS",
            "    SS       S  ",
            "   SSS  SSS S   ",
            "   SB SSSSSS S  ",
            "   SSSSSSSSSS S ",
            "  SWSSSSSSSSS S ",
            "  SSSSSSSSSSSS  ",
            "BSSSSSSBBSSSSS  ",
            " S WBSS  SSSS   ",
            "     S   SSS    ",
            "     S     S    ",
            "         SS     "
        ],
        [  // フレーム3
            "                ",
            "                ",
            "                ",
            "              S ",
            "              S ",
            "    SS      S   ",
            "   SSS  SSS  S  ",
            "   SB SSSSSS  S ",
            "   SSSSSSSSSS  S",
            "  SWSSSSSSSSS  S",
            " SSSSSSSSSSSSS  ",
            "BSSSSSSBBSSSS   ",
            " S WBSS  SSSS   ",
            "     S   SSS    ",
            "    S      S    ",
            "        SS      "
        ]
    ],
    BAT: [  // 紫色の翼と赤い目
        [  // フレーム1 - 翼を上げる
            "                ",
            "                ",
            "                ",
            "                ",
            "     C   C      ",
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
            "                "
        ],
        [  // フレーム2 - 翼を水平に
            "                ",
            "                ",
            "                ",
            "                ",
            "                ",
            " C  C    C  C   ",
            "CC CCCCCCCC CC  ",
            " CCCCCCCCCCCC   ",
            "     CCCC       ",
            "      CCC       ",
            "       C C      ",
            "                ",
            "                ",
            "                ",
            "                ",
            "                "
        ],
        [  // フレーム3 - 翼を下げる
            "                ",
            "                ",
            "                ",
            "                ",
            "                ",
            "       CC       ",
            "    CCCCCC     ",
            "  CCCCCCCCCC   ",
            " C   CCCC   C  ",
            "C    CCC    C  ",
            "C     C     C  ",
            "                ",
            "                ",
            "                ",
            "                ",
            "                "
        ]
    ],
    G_VIPER: [  // 黄色の模様入り緑色
        // フレーム1
        [
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
        // フレーム2
        [
            "                ",
            "                ",
            "    GGG         ",
            "  GGGDGG        ",
            "   D GGGG       ",
            "   D  OOGG      ",
            "      OOOG      ",
            "      OOOG      ",
            "      OOG      G",
            "     OOG      G ",
            "     GG      G  ",
            "    GGG      GG ",
            "   GGG        GG",
            "   GGGG       GG",
            "   GGGGGG   GGG ",
            "    GGGGGGGGG   "
        ],
        // フレーム3
        [
            "                ",
            "                ",
            "     GGG        ",
            "   GGGDGG       ",
            "    D GGGG      ",
            "    D  OOGG     ",
            "       OOOG     ",
            "       OOOG     ",
            "       OOG     G",
            "      OOG     G ",
            "      GG     G  ",
            "     GGG     GG ",
            "    GGG       GG",
            "    GGGG      GG",
            "    GGGGGG  GGG ",
            "     GGGGGGGGG  "
        ]
    ],
    GOBLIN: [  // オレンジの服と茶色の棍棒
        [  // フレーム1 - 基本姿勢
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
        [  // フレーム2 - 棍棒を振り上げる
            "                ",
            "         G      ",
            "       GGGG     ",
            "     GGBGGG S   ",
            "    GGGGGG  S   ",
            "    G  BB   S   ",
            "      GGGG SS   ",
            "     G GG BB    ",
            "   GG  G  GB    ",
            "       BB       ",
            "      B  B      ",
            "      B  B      ",
            "    G    G      ",
            "   GG   GG      ",
            "                ",
            "                "
        ],
        [  // フレーム3 - 棍棒を振り下ろす
            "                ",
            "         G      ",
            "       GGGG     ",
            "     GGBGGG     ",
            "    GGGGGG      ",
            "    G  BB       ",
            "      GGGG      ",
            "     G GG       ",
            "   GG  G  G     ",
            "       BB  S    ",
            "      B  B S    ",
            "      B  B S    ",
            "     G   GSS    ",
            "    GG  GG      ",
            "                ",
            "                "
        ]
    ],
    G_SPIDER: [  // 赤い体に黒い脚
        // フレーム1
        [
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
        // フレーム2
        [
            "                ",
            "                ",
            "          PP    ",
            "     P  PPPPP   ",
            "    P PPPPPPP P ",
            "   PP PPPPPP P P",
            "  P PP      P P ",
            " P PP PPPPP  PPP",
            "PP  PPR   PR P P",
            " P PPR PPPR PPP ",
            "  P  PBBBPPPP  P",
            "  P  B B BP PP P",
            "  P  B   B    P ",
            "  P   B B    P  ",
            "             P  ",
            "                "
        ],
        // フレーム3
        [
            "                ",
            "                ",
            "           PP   ",
            "      P  PPPPP  ",
            "     P PPPPPPP P",
            "    PP PPPPPP P ",
            "   P PP      P P",
            "  P PP PPPPP  PP",
            " PP  PPR   PR P ",
            "P  PPR PPPR PPP ",
            " P  PBBBPPPP  P ",
            " P  B B BP PP P ",
            " P  B   B    P  ",
            " P   B B   P    ",
            "           P    ",
            "                "
        ]
    ],
    SKELETON: [  // 銀色の鎧の残骸
        // フレーム1
        [
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
        // フレーム2
        [
            "                ",
            "     WWWW       ",
            "    WWWWWW      ",
            "    WRWWRW      ",
            "     W  W       ",
            "                ",
            "      WW        ",
            "   W      W     ",
            "  WWW    WWW    ",
            " WW W WW W WW   ",
            " W   W  W   W   ",
            "   WW    WW     ",
            "    WW  WW      ",
            " W W  WW  W W   ",
            "W   WW  WW   W  ",
            " W W      W W   "
        ],
        // フレーム3
        [
            "                ",
            "     WWWW       ",
            "    WWWWWW      ",
            "    WRWWRW      ",
            "     W  W       ",
            "                ",
            "     WWW        ",
            "  WW      W     ",
            "  WWW    WWW    ",
            " WW W WW W WW   ",
            " W   W  W   W   ",
            "   W      WW    ",
            " W  WW  WW      ",
            "  W   WW   W    ",
            "W  WW    WW  W  ",
            " W W      W W   "
        ]
    ],
    ZOMBIE: [  // 腐敗した緑と茶色
        // フレーム1
        [
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
        // フレーム2
        [
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
            "      DD D      ",
            "     L   L      ",
            "    LL   LL     ",
            "   LL     LL    "
        ],
        // フレーム3
        [
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
            "     D   D      ",
            "    L     L     ",
            "   LL     LL    ",
            "  LL       LL   "
        ]
    ],
    GHOST: [  // 青白い発光効果
        // フレーム1
        [
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
        // フレーム2
        [
            "                ",
            "    T           ",
            "    CT          ",
            "    CCT         ",
            "    CCT         ",
            "    TTTT        ",
            "   TTTTTT       ",
            "   TTTTTT       ",
            "   T TT  T      ",
            "    TTT TT      ",
            "  TT T TTTT     ",
            "  T CTTTTCT     ",
            "     TCT C C   C",
            "      T C C CC  ",
            "         C CC   ",
            "          C     "
        ],
        // フレーム3
        [
            "                ",
            "   T            ",
            "   CT           ",
            "   CCT          ",
            "   CCT          ",
            "   TTTT         ",
            "  TTTTTT        ",
            "  TTTTTT        ",
            "  T TT  T       ",
            "   TTT TT       ",
            " TT T TTTT      ",
            " T CTTTTCT      ",
            "    TCT C C    C",
            "     T C C CC   ",
            "        C CC    ",
            "         C      "
        ]
    ],
    TROLL: [  // 苔むした緑色の肌
        // フレーム1
        [
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
        // フレーム2
        [
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
            "     DDDDD      ",
            "    DD   DD     ",
            "   KK     KK    ",
            "  KK       KK   "
        ],
        // フレーム3
        [
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
            "    DD   DD     ",
            "   K       K    ",
            " KK         KK  "
        ]
    ],
};

// SPRITE_COLORS セクション: スプライト用の色定義（16色対応）
const SPRITE_COLORS = {
    getRandomizedColor: function(baseColor, statVariation = 0) {
        if (!baseColor) return null;
        
        const r = parseInt(baseColor.slice(1,3), 16);
        const g = parseInt(baseColor.slice(3,5), 16);
        const b = parseInt(baseColor.slice(5,7), 16);
        
        // グリッチ効果の確率 (例: 10%)
        const glitchChance = 0.1;

        if (Math.random() < glitchChance) {
            // グリッチ用の色をランダムに選択
            const glitchColors = ['#3d5a3d', '#6a006a', '#006a6a', '#6a0000']; // くすんだダークトーン
            return glitchColors[Math.floor(Math.random() * glitchColors.length)];
        } else {
            // ステータス変動に基づいて色のブレ幅を調整
            // 通常の0.1から、statVariationに応じて0.05～0.3の範囲で変動
            const variationRange = Math.min(0.5, Math.max(0.05, 0.1 + (statVariation * 0.002)));
            const variation = () => (Math.random() * (variationRange * 2) - variationRange);
            
            const clamp = (n) => Math.min(255, Math.max(0, Math.round(n)));
            
            const newR = clamp(r * (1 + variation()));
            const newG = clamp(g * (1 + variation()));
            const newB = clamp(b * (1 + variation()));
            
            return `#${newR.toString(16).padStart(2,'0')}${newG.toString(16).padStart(2,'0')}${newB.toString(16).padStart(2,'0')}`;
        }
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
        // スプライトが配列の配列になったため、最初のフレームを使用する
        const firstFrame = Array.isArray(sprite[0]) ? sprite[0] : sprite;
        
        const colorCount = {};
        firstFrame.forEach(row => {
            [...row].forEach(char => {
                if (char !== ' ') {
                    colorCount[char] = (colorCount[char] || 0) + 1;
                }
            });
        });

        let mostUsedChar = Object.entries(colorCount)
            .sort((a, b) => b[1] - a[1])[0]?.[0];

        return mostUsedChar ? this[mostUsedChar] : '#ffffff';
    }
};
