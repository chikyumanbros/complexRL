class SoundManager {
    constructor(game) {
        this.game = game;

        // BGM用のプロパティ
        this.homeBGM = new Audio('assets/sounds/complex_nexus.ogg');
        this.homeBGM.loop = true;
        this.homeBGM.volume = 0.5;  // 初期音量を50%に設定
        this.fadeOutInterval = null;  // フェードアウト用のインターバルID

        // 効果音を読み込む
        this.doorOpenSound = new Audio('assets/sounds/doorOpen.wav');
        this.doorCloseSound = new Audio('assets/sounds/doorClose.wav');
        this.doorKillSound = new Audio('assets/sounds/doorKill.wav'); // Door Kill用SE
        this.portalSound = new Audio('assets/sounds/portal.wav');
        this.levelUpSound = new Audio('assets/sounds/levelup.wav');
        this.descendStairsSound = new Audio('assets/sounds/descend_stairs.wav');
        
        // 新しい効果音: killMonsterSound
        this.killMonsterSound = new Audio('assets/sounds/killmonster.wav'); // killmonster用SE
        this.missSound = new Audio('assets/sounds/miss.wav'); // miss用SE
        this.critSound = new Audio('assets/sounds/crit.wav'); // crit用SE
        this.damageSound = new Audio('assets/sounds/damage.wav'); // damage用SE

        // SEのボリューム (0.0 - 1.0, 初期値は0.5)
        this.seVolume = 0.5;
        this.setSeVolume(this.seVolume); // 初期ボリュームを設定

        this.userInteracted = false; // ユーザー操作検知用フラグ
    }

    // BGMの更新
    updateBGM() {
        if (!this.userInteracted) {
            // 初回操作を検知するイベントリスナーを設定
            const handleFirstInteraction = () => {
                this.userInteracted = true;
                document.removeEventListener('click', handleFirstInteraction);
                document.removeEventListener('keydown', handleFirstInteraction);

                // ホームフロアの場合のみ再生
                if (this.game.floorLevel === 0 && this.homeBGM.paused) {
                    this.homeBGM.play().catch(error => {
                        if (error.name !== 'NotAllowedError') {
                            console.warn('BGM playback failed:', error);
                        }
                    });
                }
            };

            document.addEventListener('click', handleFirstInteraction);
            document.addEventListener('keydown', handleFirstInteraction);
            return;
        }

        // 通常のBGM処理
        if (this.game.floorLevel === 0) {
            if (this.homeBGM.paused) {
                this.homeBGM.volume = 0.5;
                this.homeBGM.play().catch(error => {
                    if (error.name !== 'NotAllowedError') {
                        console.warn('BGM playback failed:', error);
                    }
                });
            }
        } else {
            if (!this.homeBGM.paused) {
                this.fadeOutBGM();
            }
        }
    }

    // フェードアウト機能
    fadeOutBGM(duration = 1000) {
        if (this.fadeOutInterval) {
            clearInterval(this.fadeOutInterval);
        }

        const originalVolume = this.homeBGM.volume;
        const steps = 20;  // フェードアウトのステップ数
        const volumeStep = originalVolume / steps;
        const intervalTime = duration / steps;

        this.fadeOutInterval = setInterval(() => {
            if (this.homeBGM.volume > volumeStep) {
                this.homeBGM.volume -= volumeStep;
            } else {
                this.homeBGM.pause();
                this.homeBGM.volume = originalVolume;  // 音量を元に戻す
                this.homeBGM.currentTime = 0;
                clearInterval(this.fadeOutInterval);
                this.fadeOutInterval = null;
            }
        }, intervalTime);
    }

    // 音量調整用メソッド（必要に応じて）
    setBGMVolume(volume) {
        this.homeBGM.volume = Math.max(0, Math.min(1, volume));
    }

    // SEのボリュームを設定するメソッド
    setSeVolume(volume) {
        this.seVolume = Math.max(0, Math.min(1, volume)); // 0.0 - 1.0の範囲に制限
        this.doorOpenSound.volume = this.seVolume;
        this.doorCloseSound.volume = this.seVolume;
        this.doorKillSound.volume = 0.7; // Door Killの音量は大きめに設定
        this.portalSound.volume = this.seVolume;
        this.levelUpSound.volume = 0.7; // レベルアップSEの音量を設定
        this.descendStairsSound.volume = this.seVolume; // 階段を降りるSEの音量を設定

        // 新しい効果音の音量を設定
        this.killMonsterSound.volume = this.seVolume; // killmonsterの音量を設定
        this.missSound.volume = this.seVolume;  // missの音量を設定
        this.critSound.volume = this.seVolume;  // critの音量を設定
        this.damageSound.volume = this.seVolume; // damageの音量を設定
    }

    // 効果音を再生するメソッド
    playSound(audio) {
        // ユーザーが操作したか確認
        if (!this.userInteracted) return;

        // ボリュームを設定
        audio.volume = this.seVolume;

        // currentTimeを0に設定して、常に最初から再生
        audio.currentTime = 0;
        audio.play().catch(error => {
            if (error.name !== 'NotAllowedError') {
                console.warn('Sound playback failed:', error);
            }
        });
    }
} 