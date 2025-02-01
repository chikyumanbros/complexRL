class Logger {
    constructor() {
        this.logElement = document.getElementById('message-log');
        this.messages = [];
    }

    add(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        messageDiv.className = type;  // CSSクラスを適用
        this.logElement.appendChild(messageDiv);
        this.logElement.scrollTop = this.logElement.scrollHeight;
    }

    render() {
        const logElement = document.getElementById('log-panel');
        if (!logElement) return;

        logElement.innerHTML = this.messages
            .map(msg => `<div style="color: ${msg.color}">${msg.text}</div>`)
            .join('');
    }

    clear() {
        this.messages = [];
        this.logElement.innerHTML = '';
    }
} 