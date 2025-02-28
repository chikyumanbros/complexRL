// デバッグモード用のユーティリティクラス
class DebugUtils {
    constructor(game) {
        this.game = game;
        this.enabled = false;
        this.debugElements = {};
        
        // デバッグモードのトグル (Ctrl+D)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.toggleDebugMode();
            }
        });
        
        // デバッグモード有効時のキー操作
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            
            // Vigorの操作
            if (e.key === 'v') {
                // 'v'キーを押したらVIGORモード
                this.showVigorControls();
            }
            
            // Vigorを減少 (PageDown)
            if (e.key === 'PageDown') {
                this.decreaseVigor(10);
                e.preventDefault();
            }
            
            // Vigorを増加 (PageUp)
            if (e.key === 'PageUp') {
                this.increaseVigor(10);
                e.preventDefault();
            }
            
            // 特定のVIGORステータスに設定するショートカット
            if (e.ctrlKey && e.key >= '1' && e.key <= '5') {
                e.preventDefault();
                const number = parseInt(e.key);
                this.setVigorToStatus(number);
            }
            
            // 幻覚エフェクトを強制的に適用 (H)
            if (e.key === 'h') {
                this.game.renderer.psychedelicTurn += 10;
                this.game.renderer.render();
                console.log('幻覚エフェクトを適用しました');
            }
        });
    }
    
    // デバッグモードの切り替え
    toggleDebugMode() {
        this.enabled = !this.enabled;
        console.log(`デバッグモード: ${this.enabled ? 'ON' : 'OFF'}`);
        
        if (this.enabled) {
            this.showDebugPanel();
            this.game.logger.add("デバッグモードが有効になりました", "important");
            this.game.logger.add("Ctrl+D: デバッグモード切替", "important");
            this.game.logger.add("v: Vigor操作モード表示", "important");
            this.game.logger.add("h: 幻覚エフェクト適用", "important");
        } else {
            this.hideDebugPanel();
            this.game.logger.add("デバッグモードが無効になりました", "important");
        }
    }
    
    // Vigorを増加
    increaseVigor(amount) {
        const oldVigor = this.game.player.vigor;
        this.game.player.vigor = Math.min(GAME_CONSTANTS.VIGOR.MAX, oldVigor + amount);
        console.log(`Vigor: ${oldVigor} -> ${this.game.player.vigor}`);
        this.game.player.validateVigor();
        this.game.renderer.render();
        this.updateDebugPanel();
    }
    
    // Vigorを減少
    decreaseVigor(amount) {
        const oldVigor = this.game.player.vigor;
        this.game.player.vigor = Math.max(0, oldVigor - amount);
        console.log(`Vigor: ${oldVigor} -> ${this.game.player.vigor}`);
        this.game.player.validateVigor();
        this.game.renderer.render();
        this.updateDebugPanel();
    }
    
    // 特定のVigorステータスに設定
    setVigorToStatus(statusNumber) {
        const stats = this.game.player.stats;
        const thresholds = GAME_CONSTANTS.VIGOR.calculateThresholds(stats);
        let newVigor;
        
        switch (statusNumber) {
            case 1: // High
                newVigor = thresholds.HIGH + 1;
                break;
            case 2: // Moderate
                newVigor = thresholds.MODERATE + 1;
                break;
            case 3: // Low
                newVigor = thresholds.LOW + 1;
                break;
            case 4: // Critical
                newVigor = thresholds.CRITICAL + 1;
                break;
            case 5: // Exhausted
                newVigor = 0;
                break;
            default:
                return;
        }
        
        const oldVigor = this.game.player.vigor;
        this.game.player.vigor = newVigor;
        console.log(`Vigor状態を変更: ${oldVigor} -> ${newVigor} (${GAME_CONSTANTS.VIGOR.getStatus(newVigor, stats).name})`);
        this.game.player.validateVigor();
        this.game.renderer.render();
        this.updateDebugPanel();
    }
    
    // デバッグパネルの表示
    showDebugPanel() {
        let panel = document.getElementById('debug-panel');
        
        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'debug-panel';
            panel.style.position = 'fixed';
            panel.style.top = '10px';
            panel.style.right = '10px';
            panel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            panel.style.color = '#fff';
            panel.style.padding = '10px';
            panel.style.borderRadius = '5px';
            panel.style.zIndex = '1000';
            panel.style.fontFamily = 'monospace';
            panel.style.fontSize = '14px';
            document.body.appendChild(panel);
        }
        
        this.debugElements.panel = panel;
        this.updateDebugPanel();
    }
    
    // デバッグパネルを非表示
    hideDebugPanel() {
        const panel = document.getElementById('debug-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }
    
    // デバッグパネルの更新
    updateDebugPanel() {
        if (!this.enabled || !this.debugElements.panel) return;
        
        const player = this.game.player;
        const stats = player.stats;
        const vigorStatus = GAME_CONSTANTS.VIGOR.getStatus(player.vigor, stats);
        const thresholds = GAME_CONSTANTS.VIGOR.calculateThresholds(stats);
        
        this.debugElements.panel.innerHTML = `
            <h3>デバッグパネル</h3>
            <div>
                <strong>Vigor:</strong> ${player.vigor}/${GAME_CONSTANTS.VIGOR.MAX}
                (${vigorStatus.name})
            </div>
            <div>
                <strong>Vigorしきい値:</strong><br>
                High: ${thresholds.HIGH}<br>
                Moderate: ${thresholds.MODERATE}<br>
                Low: ${thresholds.LOW}<br>
                Critical: ${thresholds.CRITICAL}
            </div>
            <div>
                <strong>操作方法:</strong><br>
                PageUp/PageDown: Vigor ±10<br>
                Ctrl+1~5: 状態設定<br>
                H: 幻覚エフェクト適用
            </div>
        `;
    }
    
    // Vigor操作ガイドの表示
    showVigorControls() {
        this.game.logger.add("--- VIGOR デバッグモード ---", "important");
        this.game.logger.add("PageUp: Vigor +10", "important");
        this.game.logger.add("PageDown: Vigor -10", "important");
        this.game.logger.add("Ctrl+1: High", "important");
        this.game.logger.add("Ctrl+2: Moderate", "important");
        this.game.logger.add("Ctrl+3: Low", "important");
        this.game.logger.add("Ctrl+4: Critical", "important");
        this.game.logger.add("Ctrl+5: Exhausted", "important");
        this.game.logger.add("H: 幻覚エフェクト適用", "important");
    }
}

// グローバルオブジェクトとして登録
window.DebugUtils = DebugUtils; 