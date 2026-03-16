const { ccclass, property } = cc._decorator;

@ccclass
export default class GameUI extends cc.Component {
    @property(cc.Label)
    scoreLabel: cc.Label = null;

    @property(cc.Label)
    movesLabel: cc.Label = null;

    @property(cc.Label)
    bombBoosterCountLabel: cc.Label = null;

    @property(cc.Label)
    teleportBoosterCountLabel: cc.Label = null;

    @property(cc.Node)
    winPanel: cc.Node = null;

    @property(cc.Node)
    losePanel: cc.Node = null;

    setScore(value: number): void {
        if (this.scoreLabel) this.scoreLabel.string = `${value}`;
    }

    setMoves(value: number): void {
        if (this.movesLabel) this.movesLabel.string = `${value}`;
    }

    setTargetScore(value: number): void {
        if (this.scoreLabel) this.scoreLabel.string = `0 / ${value}`;
    }

    updateScore(current: number, target: number): void {
        if (this.scoreLabel) this.scoreLabel.string = `${current} / ${target}`;
    }

    setBombBoosterCount(value: number): void {
        if (this.bombBoosterCountLabel) this.bombBoosterCountLabel.string = `${value}`;
    }

    setTeleportBoosterCount(value: number): void {
        if (this.teleportBoosterCountLabel) this.teleportBoosterCountLabel.string = `${value}`;
    }

    showWin(): void {
        if (this.winPanel) this.winPanel.active = true;
        if (this.losePanel) this.losePanel.active = false;
    }

    showLose(): void {
        if (this.losePanel) this.losePanel.active = true;
        if (this.winPanel) this.winPanel.active = false;
    }

    hideResult(): void {
        if (this.winPanel) this.winPanel.active = false;
        if (this.losePanel) this.losePanel.active = false;
    }
}

