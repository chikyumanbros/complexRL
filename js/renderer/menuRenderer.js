class MenuRenderer {
    constructor(game) {
        this.game = game;
    }

    renderHelpMenu() {
        const display = this.getHelpDisplay();
        document.getElementById('available-skills').innerHTML = display;
    }

    getHelpDisplay() {
        // 左列と右列のコンテンツを別々に作成
        let leftColumn = '';
        let rightColumn = '';

        // 左列：コントロール
        leftColumn += `<div class="help-section-title">■ CONTROLS</div>\n`;
        const categories = Object.entries(GAME_CONSTANTS.CONTROLS);
        categories.forEach(([category, data]) => {
            leftColumn += `<div class="help-category">● ${data.title}</div>\n`;
            data.keys.forEach(keyInfo => {
                leftColumn += `<div style="margin-left: 8px;">`;
                leftColumn += `<span class="help-key">[${keyInfo.key}]</span>`;
                leftColumn += `<span class="help-text">${keyInfo.desc}</span>`;
                leftColumn += `</div>\n`;
            });
        });
        
        // 休息コマンドの説明を追加
        leftColumn += `<div class="help-category">● RESTING</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span class="help-key">[^]</span>`;
        leftColumn += `<span class="help-text">Rest for 10 turns</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span class="help-key">[~]</span>`;
        leftColumn += `<span class="help-text">Rest until fully healed</span>`;
        leftColumn += `</div>\n`;
        
        // 遠距離攻撃の操作説明を追加
        leftColumn += `<div class="help-category">● RANGED COMBAT</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span class="help-key">[F]</span>`;
        leftColumn += `<span class="help-text">Toggle ranged mode</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span class="help-key">[Tab]</span>`;
        leftColumn += `<span class="help-text">Next target</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span class="help-key">[Shift+Tab]</span>`;
        leftColumn += `<span class="help-text">Previous target</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span class="help-key">[Enter]</span>`;
        leftColumn += `<span class="help-text">Fire at target</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span class="help-key">[Esc]</span>`;
        leftColumn += `<span class="help-text">Exit ranged mode</span>`;
        leftColumn += `</div>\n`;
        
        // 標準アクションの説明を追加
        leftColumn += `<div class="help-category">● STANDARD ACTIONS</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span class="help-key">[Ctrl+m] or [Alt+m]</span>`;
        leftColumn += `<span class="help-text">Meditate to recover HP and Vigor</span>`;
        leftColumn += `</div>\n`;
        leftColumn += `<div style="margin-left: 8px;">`;
        leftColumn += `<span class="help-key">[Ctrl+j] or [Alt+j]</span>`;
        leftColumn += `<span class="help-text">Jump to a nearby location</span>`;
        leftColumn += `</div>\n`;

        // 右列：ステータスと戦闘システム
        rightColumn += `<div class="help-section-title">■ STATUS SYSTEM</div>\n`;

        // Health Status の説明
        rightColumn += `<div class="help-category">● HEALTH STATUS</div>\n`;
        rightColumn += `<div style="margin-left: 8px;">`;
        rightColumn += `<span class="health-status healthy">Healthy</span>: 75-100% HP<br>`;
        rightColumn += `<span class="health-status wounded">Wounded</span>: 50-75% HP<br>`;
        rightColumn += `<span class="health-status badly-wounded">Badly Wounded</span>: 25-50% HP<br>`;
        rightColumn += `<span class="health-status near-death">Near Death</span>: 0-25% HP`;
        rightColumn += `</div>\n`;

        // Vigor の説明
        rightColumn += `<div class="help-category">● VIGOR SYSTEM</div>\n`;
        rightColumn += `<div style="margin-left: 8px;">`;
        rightColumn += `<span class="vigor-status high">High</span>: 75-100% - Full potential<br>`;
        rightColumn += `<span class="vigor-status moderate">Moderate</span>: 50-75% - Slight penalties<br>`;
        rightColumn += `<span class="vigor-status low">Low</span>: 25-50% - Moderate penalties<br>`;
        rightColumn += `<span class="vigor-status critical">Critical</span>: 0-25% - Severe penalties<br><br>`;
        rightColumn += `<span class="help-text">Vigor affects accuracy and evasion.<br>`;
        rightColumn += `Recovers through meditation or combat victories.<br>`;
        rightColumn += `Meditation: d(Level+WIS) recovery, but risk -d(WIS) on low roll.</span>`;
        rightColumn += `</div>\n`;

        rightColumn += `<div class="help-section-title">■ COMBAT SYSTEM</div>\n`;

        // 戦闘システムの説明
        rightColumn += `<div class="help-category">● BASE STATS</div>\n`;
        rightColumn += `<div style="margin-left: 8px;">`;
        rightColumn += `<span class="help-text">HP: (CON×2 + STR/4) × Size Mod × Level<br>`;
        rightColumn += `ATK: (STR×0.7 - DEX/4) × Size Mod + Dice<br>`;
        rightColumn += `DEF: (CON×0.5 - INT/5) × Size Mod + Dice<br>`;
        rightColumn += `Size Mod: 0.9~1.3 (by STR+CON)</span>`;
        rightColumn += `</div>\n`;

        rightColumn += `<div class="help-category">● DAMAGE ROLLS</div>\n`;
        rightColumn += `<div style="margin-left: 8px;">`;
        rightColumn += `<span class="help-text">ATK: √(DEX/2) × 1d(√STR×2)<br>`;
        rightColumn += `DEF: √(CON/3) × 1d(√CON×1.5)</span>`;
        rightColumn += `</div>\n`;

        rightColumn += `<div class="help-category">● COMBAT STATS</div>\n`;
        rightColumn += `<div style="margin-left: 8px;">`;
        rightColumn += `<span class="help-text">ACC: 50 + DEX×0.8 + WIS×0.4 - CON/4<br>`;
        rightColumn += `EVA: 8 + DEX×0.6 + WIS×0.3 - STR/5<br>`;
        rightColumn += `CRIT: 3% + (DEX-10)×0.15 + (INT-10)×0.1<br>`;
        rightColumn += `(Critical hits ignore EVA & DEF)</span>`;
        rightColumn += `</div>\n`;

        rightColumn += `<div class="help-category">● SIZE & SPEED</div>\n`;
        rightColumn += `<div style="margin-left: 8px;">`;
        rightColumn += `<span class="help-text">Size: Based on CON×0.7 + STR×0.3<br>`;
        rightColumn += `Tiny ≤7, Small ≤10, Medium ≤14<br>`;
        rightColumn += `Large ≤18, Huge >18<br><br>`;
        rightColumn += `Speed: Based on DEX vs (STR+CON)<br>`;
        rightColumn += `Very Slow: ≤-4, Slow: ≤-2<br>`;
        rightColumn += `Normal: ≤2, Fast: ≤4, Very Fast: >4</span>`;
        rightColumn += `</div>\n`;

        rightColumn += `<div class="help-category">● COMBAT FLOW</div>\n`;
        rightColumn += `<div style="margin-left: 8px;">`;
        rightColumn += `<span class="help-text">1. Speed Check<br>`;
        rightColumn += `2. Roll(100) vs ACC for hit<br>`;
        rightColumn += `3. Roll(100) vs EVA if not crit<br>`;
        rightColumn += `4. DMG = ATK - DEF (if not crit)<br>`;
        rightColumn += `5. DMG = ATK (if critical hit)</span>`;
        rightColumn += `</div>\n`;

        rightColumn += `<div class="help-category">● RANGED COMBAT</div>\n`;
        rightColumn += `<div style="margin-left: 8px;">`;
        rightColumn += `<span class="help-text">[F] Toggle ranged mode<br>`;
        rightColumn += `[Tab/Shift+Tab] Cycle targets<br>`;
        rightColumn += `[ENTER] Fire at target<br>`;
        rightColumn += `[ESC] Exit ranged mode<br><br>`;
        rightColumn += `Energy: 75 + INT×2 + DEX<br>`;
        rightColumn += `Recharge: 2 + INT/3 per turn<br>`;
        rightColumn += `Cost: 30 - INT/4 per shot (min 20)<br>`;
        rightColumn += `DMG: (DEX×0.5 + INT×0.3) + dice<br>`;
        rightColumn += `Dice: (DEX/5)d(INT/4)<br>`;
        rightColumn += `ACC: 30 + DEX×0.8 + INT×0.4 ± Speed<br>`;
        rightColumn += `Range: 1 + INT/3<br>`;
        rightColumn += `Size Bonus: ±5% per size diff</span>`;
        rightColumn += `</div>\n`;

        rightColumn += `<div class="help-category">● COMBAT PENALTIES</div>\n`;
        rightColumn += `<div style="margin-left: 8px;">`;
        rightColumn += `<span class="help-text">Surrounded: -15% ACC/EVA per enemy<br>`;
        rightColumn += `(Max: -60%)<br><br>`;
        rightColumn += `Opportunity Attack:<br>`;
        rightColumn += `-30% ACC, +50% DMG<br>`;
        rightColumn += `No counter-attack chance</span>`;
        rightColumn += `</div>\n`;

        // レイアウトを調整してカラムを並べて表示、gapを50pxに
        return `<div style="display: flex; gap: 50px;">
                    <div style="flex: 1; padding-right: 20px;">${leftColumn}</div>
                    <div style="flex: 1;">${rightColumn}</div>
                </div>`;
    }

    renderCodexMenu() {
        // Codexシステムが削除されたため、何も表示しない
        document.getElementById('available-skills').innerHTML = "Codex system has been removed.";
    }

    renderNamePrompt(currentInput) {
        const messageLogElement = document.getElementById('message-log');
        if (!messageLogElement) return;

        // タイプライターエフェクトを完全に無効化
        messageLogElement.classList.add('no-typewriter');

        // 静的コンテンツが既に描画されているか確認
        let staticContainer = document.getElementById('static-title-container');
        let dynamicContainer = document.getElementById('dynamic-name-input-container');
        
        // 初回描画時のみ静的コンテンツを作成
        if (!staticContainer) {
            // ログパネルをクリア
            messageLogElement.innerHTML = '';
            
            // 静的コンテンツ用のコンテナを作成
            staticContainer = document.createElement('div');
            staticContainer.id = 'static-title-container';
            staticContainer.className = 'static-content';
            messageLogElement.appendChild(staticContainer);

            // タイトルアートの後に追加するクレジット情報
            const credits = [
                "",
                "",
                "v0.1.0 alpha ©︎chikyuman-bros.",
                "",
                "",
                "Font: IBM EGA 9x8 & IBM VGA 8x16 || Source: The Ultimate Oldschool PC Font Pack by VileR",
                "Licensed under CC BY-SA 4.0",
                "https://int10h.org/oldschool-pc-fonts/",
            ];

            // バージョン表記とタイトルアートを表示
            const titleArt = [
                "  ▄████▄   ▒█████   ███▄ ▄███▓ ██▓███   ██▓    ▓█████ ▒██   ██▒",
                " ▒██▀ ▀█  ▒██▒  ██▒▓██▒▀█▀ ██▒▓██░  ██▒▓██▒    ▓█   ▀ ▒▒ █ █ ▒░",
                " ▒▓█    ▄ ▒██░  ██▒▓██    ▓██░▓██░ ██▓▒▒██░    ▒███   ░░  █   ░",
                " ▒▓▓▄ ▄██▒▒██   ██░▒██    ▒██ ▒██▄█▓▒ ▒▒██░    ▒▓█  ▄  ░ █ █ ▒ ",
                " ▒ ▓███▀ ░░ ████▓▒░▒██▒   ░██▒▒██▒ ░  ░░██████▒░▒████▒▒██▒ ▒██▒",
                " ░ ░▒ ▒  ░░ ▒░▒░▒░ ░ ▒░   ░  ░▒▓▒░ ░  ░░ ▒░▓  ░░░ ▒░ ░▒▒ ░ ░▓ ░",
                "   ░  ▒     ░ ▒ ▒░ ░  ░      ░░▒ ░     ░ ░ ▒  ░ ░ ░  ░░░   ░▒ ░",
                " ░        ░ ░ ░ ▒  ░      ░   ░░         ░ ░      ░    ░    ░  ",
                " ░ ░          ░ ░         ░               ░  ░   ░  ░   ░      ",
            ];
            
            // タイトルアート用のコンテナを作成
            const titleArtContainer = document.createElement('div');
            titleArtContainer.className = 'title-art-container';
            titleArtContainer.style.lineHeight = '0.5';
            titleArtContainer.style.margin = '5px';
            titleArtContainer.style.padding = '0';
            titleArtContainer.style.display = 'block';
            titleArtContainer.style.visibility = 'visible';
            titleArtContainer.style.opacity = '1';
            staticContainer.appendChild(titleArtContainer);
            
            // 基本色と波のパラメータ - フルカラーに変更
            const baseHue = 0; // 赤から開始
            const hueRange = 360; // フルカラーの色相範囲
            const baseValue = 75; // 明るさの基本値
            const valueRange = 15; // 明るさの変化範囲
            const baseSaturation = 90; // 彩度の基本値
            
            // タイトルアートの各行の要素を保持する配列
            const titleElements = [];
            
            // タイトルアートを表示
            titleArt.forEach((line, index) => {
                const div = document.createElement('div');
                div.textContent = line;
                div.className = 'message title';
                div.style.whiteSpace = 'pre';
                div.style.lineHeight = '0.8';
                div.style.margin = '0';
                div.style.padding = '0';
                div.style.display = 'block';
                div.style.visibility = 'visible';
                div.style.opacity = '1';
                div.style.fontSize = '20px';
                
                // 初期の色を設定（HSLを使用）- 行によって異なる色相で初期化
                const initialHue = (baseHue + index * 30) % 360;
                const initialValue = baseValue;
                div.style.color = `hsl(${initialHue}, ${baseSaturation}%, ${initialValue}%)`;
                
                titleArtContainer.appendChild(div);
                titleElements.push(div); // 配列に要素を追加
            });
            
            // 波のアニメーション用のパラメータ
            let time = 0;
            const waveSpeed = 0.05; // 波の速度（遅めに）
            const waveFrequency = 0.3; // 波の周波数
            const waveAmplitude = 1.0; // 波の振幅
            
            // JavaScriptによるウェーブアニメーション
            const animateWave = () => {
                titleElements.forEach((element, index) => {
                    // 波形関数を使用して色相と明るさを計算
                    const waveOffset = Math.sin(time + index * waveFrequency) * waveAmplitude;
                    
                    // 色相の計算 - 全色相環を回転
                    const hue = (baseHue + index * 40 + time * 20) % 360;
                    
                    // 明るさの変化 - 波に合わせて明るく/暗くなる
                    const value = baseValue + waveOffset * valueRange;
                    
                    // HSL色空間で色を設定
                    element.style.color = `hsl(${hue}, ${baseSaturation}%, ${value}%)`;
                });
                
                // 時間を進める
                time += waveSpeed;
                
                // 次のアニメーションフレーム
                setTimeout(animateWave, 50); // よりスムーズなアニメーションのため、短い間隔
            };
            
            // アニメーションを開始
            animateWave();
            
            // 空行とクレジットを表示
            ['', ...credits].forEach(line => {
                const div = document.createElement('div');
                
                // URLを含む行の場合はアンカータグにする
                if (line.includes('http')) {
                    div.innerHTML = line.replace(
                        /(https?:\/\/[^\s]+)/g, 
                        '<a href="$1" target="_blank" style="color: #66ccff; text-decoration: underline;">$1</a>'
                    );
                } else {
                    div.textContent = line;
                }
                
                div.className = 'message title';
                div.style.animation = 'none';
                div.style.transition = 'none';
                div.style.whiteSpace = 'pre';
                div.style.display = 'block';
                div.style.visibility = 'visible';
                div.style.color = '#fffdd0'; // クリーム色で確実に表示
                div.style.fontSize = '15px';
                div.style.opacity = '0.8';
                div.style.lineHeight = '0.8'; // 行間をさらに詰める
                div.style.margin = '5px'; // マージンを0に
                div.style.padding = '0.5px'; // パディングを0に
                staticContainer.appendChild(div);
            });
        }
        
        // 動的コンテンツ（名前入力部分）の更新
        if (!dynamicContainer) {
            dynamicContainer = document.createElement('div');
            dynamicContainer.id = 'dynamic-name-input-container';
            dynamicContainer.className = 'dynamic-content';
            messageLogElement.appendChild(dynamicContainer);
        } else {
            // 既存のコンテナをクリア
            dynamicContainer.innerHTML = '';
        }

        // プロンプトメッセージを追加
        const messages = [
            { text: 'Enter your name:', style: 'important' },
            { text: `> ${currentInput}_`, style: 'system' },
            { text: '(Press Enter to confirm)', style: 'hint' }
        ];

        messages.forEach(msg => {
            const div = document.createElement('div');
            div.textContent = msg.text;
            div.className = `message ${msg.style}`;
            dynamicContainer.appendChild(div);
        });

        // 最新のメッセージが見えるようにスクロール
        messageLogElement.scrollTop = messageLogElement.scrollHeight;
    }
} 