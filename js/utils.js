class DiceRoller {
    // 例: "2d6+3" -> 2個の6面ダイス + 3
    static roll(diceNotation) {
        const match = diceNotation.match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/);
        if (!match) return null;

        const [_, numDice, sides, operator, modifier] = match;
        let total = 0;
        
        // ダイスを振る
        for (let i = 0; i < parseInt(numDice); i++) {
            total += Math.floor(Math.random() * parseInt(sides)) + 1;
        }
        
        // 修正値を適用
        if (modifier) {
            total = operator === '+' ? 
                total + parseInt(modifier) : 
                total - parseInt(modifier);
        }
        
        return total;
    }
} 