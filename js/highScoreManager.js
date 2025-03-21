class HighScoreManager {
    constructor(game) {
        this.game = game;
        this.highScores = [];
        this.isShowingHighScores = false;
        this.loadHighScores();
    }

    // ハイスコアの保存
    saveHighScore(finalScore) {
        const deathInfo = {
            cause: this.game.player.deathCause || 'Unknown',
            level: this.game.player.level
        };

        const newScore = {
            ...finalScore,
            playerName: this.game.player.name || 'Unknown',
            deathInfo,
            date: new Date().toISOString()
        };

        // 既存のスコアを読み込む
        let allScores = this.loadHighScores();
        
        // 重複チェック - 同じプレイヤー名、スコア、死亡時間（1分以内）のスコアは追加しない
        const isDuplicate = allScores.some(score => {
            const timeDiff = Math.abs(new Date(score.date) - new Date(newScore.date));
            return score.playerName === newScore.playerName &&
                   score.totalScore === newScore.totalScore &&
                   timeDiff < 60000; // 1分以内
        });

        if (!isDuplicate) {
            // 新しいスコアを追加
            allScores.push(newScore);
            
            // スコアでソート（降順）
            allScores.sort((a, b) => {
                // まずtotalScoreで比較
                if (b.totalScore !== a.totalScore) {
                    return b.totalScore - a.totalScore;
                }
                // totalScoreが同じ場合は、より新しい日付を優先
                return new Date(b.date) - new Date(a.date);
            });
            
            // 上位5件のみを保持
            this.highScores = allScores.slice(0, 5);

            // ローカルストレージに保存
            localStorage.setItem('complexRL_highScores', JSON.stringify(this.highScores));
        }
    }

    // ハイスコアの読み込み
    loadHighScores() {
        const savedScores = localStorage.getItem('complexRL_highScores');
        this.highScores = savedScores ? JSON.parse(savedScores) : [];
        return this.highScores;
    }

    // ハイスコアのクリア
    clearHighScores() {
        localStorage.removeItem('complexRL_highScores');
        this.highScores = [];
        this.game.logger.add("High scores have been cleared.", "important");
        
        // ハイスコア表示中の場合は更新
        if (this.isShowingHighScores) {
            this.showHighScores();
        }
    }

    // ハイスコアの表示
    showHighScores() {
        const codexPanelElement = document.getElementById('available-skills');
        if (!codexPanelElement) return;
        
        // ハイスコアが表示されている場合は、表示を消去
        if (this.isShowingHighScores) {
            codexPanelElement.innerHTML = '';
            this.isShowingHighScores = false;
            // lookpanelの内容を復元する
            this.game.logger.renderLookPanel();
            return;
        }

        // ハイスコア表示に切り替え
        // HTMLの生成
        const titleElement = document.createElement('div');
        titleElement.style.color = '#FFD700';
        titleElement.style.fontWeight = 'bold';
        titleElement.style.fontSize = '18px';
        titleElement.style.marginBottom = '10px';
        titleElement.textContent = '=== HIGH SCORES ===';
        
        const instructionElement = document.createElement('div');
        instructionElement.style.color = '#FFFFFF';
        instructionElement.style.marginBottom = '15px';
        instructionElement.textContent = '(Press Ctrl+S again to hide)';
        
        // 既存の内容をクリア
        codexPanelElement.innerHTML = '';
        
        // 要素を追加
        codexPanelElement.appendChild(titleElement);
        codexPanelElement.appendChild(instructionElement);
        
        if (this.highScores.length === 0) {
            const noScoresElement = document.createElement('div');
            noScoresElement.textContent = 'No high scores yet!';
            codexPanelElement.appendChild(noScoresElement);
        } else {
            // スコア表示のコンテナ
            const scoresContainer = document.createElement('div');
            scoresContainer.style.display = 'flex';
            scoresContainer.style.justifyContent = 'space-between';
            
            // 3列に分けるために配列を分割
            const firstColumn = this.highScores.slice(0, 2);   // 1-2位
            const secondColumn = this.highScores.slice(2, 4);  // 3-4位
            const thirdColumn = this.highScores.slice(4);      // 5位
            
            // 各列のコンテナ
            const column1Container = document.createElement('div');
            column1Container.style.flex = '1';
            column1Container.style.whiteSpace = 'pre-wrap';
            
            const column2Container = document.createElement('div');
            column2Container.style.flex = '1';
            column2Container.style.whiteSpace = 'pre-wrap';
            column2Container.style.marginLeft = '20px';
            
            const column3Container = document.createElement('div');
            column3Container.style.flex = '1';
            column3Container.style.whiteSpace = 'pre-wrap';
            column3Container.style.marginLeft = '20px';
            
            // 各スコアをフォーマット
            const addScoreToColumn = (score, index, container) => {
                const date = new Date(score.date).toLocaleDateString();
                const rankColor = index === 0 ? '#FFD700' : // 金
                                 index === 1 ? '#C0C0C0' : // 銀
                                 index === 2 ? '#CD7F32' : // 銅
                                 '#FFFFFF';  // その他
                
                const scoreTitle = document.createElement('div');
                scoreTitle.style.color = rankColor;
                scoreTitle.style.fontWeight = 'bold';
                scoreTitle.textContent = `${index + 1}. Score: ${score.totalScore}`;
                container.appendChild(scoreTitle);
                
                const nameInfo = document.createElement('div');
                nameInfo.style.color = '#E6E6FA';  // Lavender色
                nameInfo.style.marginLeft = '10px';
                nameInfo.textContent = `Name: ${score.playerName}`;
                container.appendChild(nameInfo);
                
                const levelInfo = document.createElement('div');
                levelInfo.style.color = '#4169E1';
                levelInfo.style.marginLeft = '10px';
                levelInfo.textContent = `Level: ${score.deathInfo.level}`;
                container.appendChild(levelInfo);
                
                const turnsInfo = document.createElement('div');
                turnsInfo.style.color = '#DEB887';
                turnsInfo.style.marginLeft = '10px';
                turnsInfo.textContent = `Turns: ${score.turns}`;
                container.appendChild(turnsInfo);
                
                const deathInfo = document.createElement('div');
                deathInfo.style.color = '#FF4500';
                deathInfo.style.marginLeft = '10px';
                deathInfo.textContent = `Death: ${score.deathInfo.cause}`;
                container.appendChild(deathInfo);
                
                const dateInfo = document.createElement('div');
                dateInfo.style.color = '#B8860B';
                dateInfo.style.marginLeft = '10px';
                dateInfo.textContent = `Date: ${date}`;
                container.appendChild(dateInfo);
                
                const spacer = document.createElement('div');
                spacer.style.marginBottom = '15px';
                container.appendChild(spacer);
            };
            
            // 各列にスコアを追加
            firstColumn.forEach((score, i) => addScoreToColumn(score, i, column1Container));
            secondColumn.forEach((score, i) => addScoreToColumn(score, i + 2, column2Container));
            thirdColumn.forEach((score, i) => addScoreToColumn(score, i + 4, column3Container));
            
            // 列をコンテナに追加
            scoresContainer.appendChild(column1Container);
            scoresContainer.appendChild(column2Container);
            scoresContainer.appendChild(column3Container);
            
            // スコアコンテナをパネルに追加
            codexPanelElement.appendChild(scoresContainer);
        }
        
        // 表示状態を更新
        this.isShowingHighScores = true;
    }
} 