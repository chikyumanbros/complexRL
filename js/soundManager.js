class SoundManager {
    constructor(game) {
        this.game = game;

        // BGM用のプロパティ
        this.homeBGM = new Audio('assets/sounds/complex_nexus.ogg');
        this.homeBGM.loop = true;
        this.homeBGM.volume = 0.5;  // 初期音量を50%に設定
        this.floor1BGM = new Audio('assets/sounds/floor1.ogg'); // floor1BGM を追加
        this.floor1BGM.loop = true;
        this.floor1BGM.volume = 0.5;  // 初期音量を50%に設定
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
        this.takeDamageSound = new Audio('assets/sounds/takedamage.wav'); // takedamage用SE
        this.playerDeathSound = new Audio('assets/sounds/playerdeath.wav'); // playerdeath用SE

        // nextattackmodifier用SE
        this.nextAttackModifierSound = new Audio('assets/sounds/nextattackmodifier.wav');

        // 新しい効果音: meditationSound, jumpSound
        this.meditationSound = new Audio('assets/sounds/meditation.wav'); // meditation用SE
        this.jumpSound = new Audio('assets/sounds/jump.wav'); // jump用SE

        // move sound
        this.moveSounds = {
            'move1': new Audio('assets/sounds/move1.wav'),
            'move2': new Audio('assets/sounds/move2.wav'),
            'move3': new Audio('assets/sounds/move3.wav'),
            'move4': new Audio('assets/sounds/move4.wav'),
        };

        // Vigor up/down sounds
        this.vigorUpSound = new Audio('assets/sounds/vigorup.wav');
        this.vigorDownSound = new Audio('assets/sounds/vigordown.wav');

        // caution sound
        this.cautionSound = new Audio('assets/sounds/caution.wav');
        this.caution2Sound = new Audio('assets/sounds/caution2.wav');

        // SEのボリューム (0.0 - 1.0, 初期値は0.5)
        this.seVolume = 0.5;
        this.setSeVolume(this.seVolume); // 初期ボリュームを設定

        this.userInteracted = false; // ユーザー操作検知用フラグ
    }

    // BGMの更新
    updateBGM() {
        console.log('updateBGM called, floorLevel:', this.game.floorLevel); // ログを追加

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
            // floor1BGMが再生中の場合は停止
            if (!this.floor1BGM.paused) {
                this.floor1BGM.pause();
                this.floor1BGM.currentTime = 0;
            }
        } else {
            // floorLevel が 0 以外の場合 floor1BGM を再生
            console.log('floor1BGM.paused:', this.floor1BGM.paused); // floor1BGM.paused の状態をログ出力
            if (this.floor1BGM.paused) {
                this.floor1BGM.volume = 0.5;
                this.floor1BGM.play().catch(error => {
                    if (error.name !== 'NotAllowedError') {
                        console.warn('floor1BGM playback called'); // ログを追加
                        console.warn('BGM playback failed:', error);
                    }
                });
            }
            // homeBGM が再生中の場合はフェードアウト
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
        this.killMonsterSound.volume = 0.4; // killmonsterの音量を設定
        this.missSound.volume = 0.4;  // missの音量を設定
        this.critSound.volume = 0.4;  // critの音量を設定
        this.damageSound.volume = 0.1; // damageの音量を設定
        this.takeDamageSound.volume = 0.5; // takedamageの音量を設定
        this.playerDeathSound.volume = this.seVolume; // playerdeathの音量を設定

        // nextattackmodifierの音量を設定
        this.nextAttackModifierSound.volume = this.seVolume;

        // 新しい効果音の音量を設定
        this.meditationSound.volume = this.seVolume; // meditationの音量を設定
        this.jumpSound.volume = this.seVolume; // jumpの音量を設定

        // move sound の音量を設定
        for (const key in this.moveSounds) {
            if (this.moveSounds.hasOwnProperty(key)) {
                this.moveSounds[key].volume = this.seVolume;
            }
        }

        // Vigor up/down sounds
        this.vigorUpSound.volume = this.seVolume;
        this.vigorDownSound.volume = this.seVolume;

        // caution sound の音量を設定
        this.cautionSound.volume = this.seVolume;
        this.caution2Sound.volume = this.seVolume;
    }

    // 効果音を再生するメソッド
    playSound(audioName, loop = false) {
        // ユーザーが操作したか確認
        if (!this.userInteracted) return;

        console.log("playSound called with audioName:", audioName); // 追加: audioNameを確認

        // moveSounds の場合は this[audioName] ではなく this.moveSounds[audioName] を使う
        let audio = this.moveSounds[audioName] || this[audioName];
        if (!audio) {
            console.warn(`Sound "${audioName}" not found.`);
            return;
        }
          // audioNameがオブジェクトの場合、audioName.nameをaudioに代入する
          if (typeof audioName === 'object' && audioName !== null && audioName.name) {
            audio = this[audioName.name];
          }

        // ボリュームを設定
        audio.volume = this.seVolume;

        // ループ設定
        audio.loop = loop;

        // currentTimeを0に設定して、常に最初から再生
        audio.currentTime = 0;
        audio.play().catch(error => {
            if (error.name !== 'NotAllowedError') {
                console.warn('Sound playback failed:', error);
            }
        });
    }

    // 効果音を停止するメソッド
    stopSound(audioName) {
        const audio = this[audioName];
        if (audio) {
            audio.pause();
            audio.currentTime = 0; // 停止時にcurrentTimeをリセット
        }
    }
} 