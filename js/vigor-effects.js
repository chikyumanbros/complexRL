class VigorEffects {
    constructor(game) {
        this.game = game;
    }

    static getVigorPenaltyEffect(severity) {
        const effects = {
            severe: [
                { type: 'forceDescend', weight: 15 },
                { type: 'randomTeleport', weight: 25 },
                { type: 'forgetAllTiles', weight: 35 },
                { type: 'forcedWait', weight: 25 }
            ],
            moderate: [
                { type: 'forgetSomeTiles', weight: 40 },
                { type: 'psychedelicEffect', weight: 35 },
                { type: 'forcedWait', weight: 25 }
            ],
            mild: [
                { type: 'psychedelicEffect', weight: 60 },
                { type: 'forgetSomeTiles', weight: 40 }
            ],
            positive: [
                { type: 'revealAll', weight: 25 },
                { type: 'fullRestore', weight: 25 },
                { type: 'createVoidPortal', weight: 25 },
                { type: 'levelUp', weight: 25 }
            ]
        };

        return VigorEffects.weightedRandomChoice(effects[severity]);
    }

    static weightedRandomChoice(options) {
        const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
        let random = Math.random() * totalWeight;

        for (const option of options) {
            random -= option.weight;
            if (random <= 0) return option;
        }
        return options[0];
    }

    applyVigorEffect(effect) {
        switch (effect.type) {
            case 'pauseAndShift':
                this.game.logger.add("Your exhaustion forces you to pause, and the world shifts...", "warning");
                this.game.player.meditation = {
                    active: true,
                    duration: 1  // 1ターンだけ
                };
                this.game.playSound('waitSound'); // 適切なサウンドに変更
                break;

            case 'forceDescend':
                this.game.logger.add("Your exhaustion forces you downward!", "warning");
                this.game.renderer.startPortalTransition(() => {
                    this.game.floorLevel++;
                    this.game.generateNewFloor();
                    this.game.soundManager.updateBGM();
                });
                this.game.playSound('portalSound');
                break;

            case 'randomTeleport':
                this.game.logger.add("Your mind wanders, and so does your body...", "warning");
                this.game.renderer.startShortPortalTransition(() => {
                    let x, y;
                    do {
                        x = Math.floor(Math.random() * this.game.width);
                        y = Math.floor(Math.random() * this.game.height);
                    } while (this.game.map[y][x] === 'wall' || this.game.getMonsterAt(x, y) ||
                        (x === this.game.player.x && y === this.game.player.y) ||
                        GAME_CONSTANTS.TILES.OBSTACLE.BLOCKING.includes(this.game.tiles[y][x]));

                    this.game.player.x = x;
                    this.game.player.y = y;
                    this.game.renderer.render();
                    // サウンドをフェードアウト
                    this.game.soundManager.fadeOutAndStop('portalSound');
                });
                // startShortPortalTransition の外でサウンドを再生
                this.game.playSound('portalSound');
                break;

            case 'forgetAllTiles':
                this.game.logger.add("Your memory fades completely...", "warning");
                for (let y = 0; y < this.game.height; y++) {
                    for (let x = 0; x < this.game.width; x++) {
                        if (!this.game.getVisibleTiles().some(({ x: visibleX, y: visibleY }) => visibleX === x && visibleY === y)) {
                            this.game.explored[y][x] = false;
                        }
                    }
                }
                this.game.playSound('forgetSound');
                break;

            case 'forgetSomeTiles':
                this.game.logger.add("Your memory becomes hazy...", "warning");
                const exploredTiles = [];
                for (let y = 0; y < this.game.height; y++) {
                    for (let x = 0; x < this.game.width; x++) {
                        if (this.game.explored[y][x] && !this.game.getVisibleTiles().some(({ x: visibleX, y: visibleY }) => visibleX === x && visibleY === y)) {
                            exploredTiles.push({ x, y });
                        }
                    }
                }
                // 探索済みタイルの30%をランダムに忘れる
                const tilesToForget = Math.floor(exploredTiles.length * 0.3);
                for (let i = 0; i < tilesToForget; i++) {
                    if (exploredTiles.length === 0) break;
                    const index = Math.floor(Math.random() * exploredTiles.length);
                    const tile = exploredTiles.splice(index, 1)[0];
                    this.game.explored[tile.y][tile.x] = false;
                }
                this.game.playSound('forgetSound');
                break;

            case 'revealAll':
                this.game.logger.add("A moment of clarity reveals all!", "important");
                for (let y = 0; y < this.game.height; y++) {
                    for (let x = 0; x < this.game.width; x++) {
                        this.game.explored[y][x] = true;
                    }
                }
                this.game.playSound('revealSound'); // 仮のサウンド名
                break;

            case 'fullRestore':
                this.game.logger.add("A surge of energy restores you!", "important");
                const hpRestored = this.game.player.maxHp - this.game.player.hp;
                this.game.player.hp = this.game.player.maxHp;
                this.game.player.vigor = GAME_CONSTANTS.VIGOR.MAX;
                if (hpRestored > 0) {
                    this.game.logger.add(`Restored ${hpRestored} HP!`, "important");
                }
                this.game.logger.add("Vigor fully restored!", "important");
                this.game.playSound('healSound'); // 仮のサウンド名
                break;

            case 'createVoidPortal':
                this.game.logger.add("A void portal materializes nearby!", "important");
                const adjacentSpaces = [
                    { dx: -1, dy: -1 }, { dx: 0, dy: -1 }, { dx: 1, dy: -1 },
                    { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
                    { dx: -1, dy: 1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 1 }
                ];

                // 隣接する空きマスをシャッフル
                const shuffledSpaces = adjacentSpaces
                    .filter(({ dx, dy }) => {
                        const newX = this.game.player.x + dx;
                        const newY = this.game.player.y + dy;
                        return this.game.isValidPosition(newX, newY) &&
                            this.game.map[newY][newX] === 'floor' &&
                            !this.game.isOccupied(newX, newY);
                    })
                    .sort(() => Math.random() - 0.5);

                // 最初の空きマスにポータルを作成
                if (shuffledSpaces.length > 0) {
                    const { dx, dy } = shuffledSpaces[0];
                    const portalX = this.game.player.x + dx;
                    const portalY = this.game.player.y + dy;
                    this.game.tiles[portalY][portalX] = GAME_CONSTANTS.PORTAL.VOID.CHAR;
                    this.game.playSound('portalCreateSound'); // 仮のサウンド名
                }
                break;

            case 'levelUp':
                this.game.logger.add("A mysterious force empowers you!", "important");
                this.game.player.levelUp();
                break;
        }
        this.game.renderer.render();
    }
}

// グローバルオブジェクトに登録
window.VigorEffects = VigorEffects; 