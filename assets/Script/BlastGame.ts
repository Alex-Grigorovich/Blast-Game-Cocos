const { ccclass, property } = cc._decorator;
import { GameBoard } from './Game/GameBoard';
import { GameState } from './Game/GameState';
import { GameConfig } from './Game/GameConfig';
import BoardView from './View/BoardView';
import GameUI from './View/GameUI';

/**
 * Главный контроллер игры Blast.
 * Связывает логику (GameBoard, GameState) и отображение (BoardView, GameUI).
 */
@ccclass
export default class BlastGame extends cc.Component {
    @property(BoardView)
    boardView: BoardView = null;

    @property(GameUI)
    gameUI: GameUI = null;

    @property(cc.Node)
    boosterBombBtn: cc.Node = null;

    @property(cc.Node)
    boosterTeleportBtn: cc.Node = null;

    /** Скорость изменения масштаба при наведении/уходе мыши с кнопок бустеров (сек). При наведении — 1.5, при уходе — 1. */
    @property({ tooltip: 'Длительность перехода масштаба (сек)' })
    boosterHoverPulseDuration: number = 0.15;

    private board: GameBoard = null;
    private state: GameState = null;
    private inputBlocked: boolean = false;
    private shuffleCount: number = 0;
    private selectedForSwap: [number, number] | null = null;
    private boosterMode: 'none' | 'bomb' | 'teleport' = 'none';
    private teleportSource: 'ui' | 'tile' | null = null;

    start(): void {
        this.startNewGame();
        this.registerBoosterButtons();
    }

    private runBoosterHoverEnter(node: cc.Node): void {
        if (!node || !node.isValid) return;
        node.stopAllActions();
        const t = this.boosterHoverPulseDuration > 0 ? this.boosterHoverPulseDuration : 0.15;
        node.runAction(cc.scaleTo(t, 1.5));
    }

    private runBoosterHoverLeave(node: cc.Node): void {
        if (!node || !node.isValid) return;
        node.stopAllActions();
        const t = this.boosterHoverPulseDuration > 0 ? this.boosterHoverPulseDuration : 0.15;
        node.runAction(cc.scaleTo(t, 1));
    }

    private registerBoosterButtons(): void {
        const setup = (node: cc.Node, handler: Function) => {
            if (!node) return;
            node.zIndex = 100;
            const size = node.getContentSize();
            if (size.width < 10 || size.height < 10) node.setContentSize(80, 80);
            if (!node.getComponent(cc.Button)) node.addComponent(cc.Button);
            node.on(cc.Node.EventType.TOUCH_END, handler, this);
            node.on(cc.Node.EventType.MOUSE_ENTER, () => this.runBoosterHoverEnter(node), this);
            node.on(cc.Node.EventType.MOUSE_LEAVE, () => this.runBoosterHoverLeave(node), this);
        };
        setup(this.boosterBombBtn, this.onBoosterBombClick);
        setup(this.boosterTeleportBtn, this.onBoosterTeleportClick);
    }

    startNewGame(): void {
        this.board = new GameBoard(GameConfig.ROWS, GameConfig.COLS, GameConfig.COLORS);
        this.state = new GameState(GameConfig.MAX_MOVES);
        this.inputBlocked = false;
        this.shuffleCount = 0;
        this.selectedForSwap = null;
        this.boosterMode = 'none';
        this.teleportSource = null;
        if (this.gameUI) {
            this.gameUI.hideResult();
            this.gameUI.updateScore(0, GameConfig.TARGET_SCORE);
            this.gameUI.setMoves(this.state.movesLeft);
            this.gameUI.setBombBoosterCount(this.state.bombBoosterCount);
            this.gameUI.setTeleportBoosterCount(this.state.teleportBoosterCount);
        }
        if (this.boardView) {
            this.boardView.bind(this.board, (row, col) => this.onTileClick(row, col));
        }
        this.checkLoseIfNoMoves();
    }

    /** Кнопка «Бустер бомба» под заголовком Бустеры: активация = списание использования, счётчик обновляется при клике по кнопке. */
    private onBoosterBombClick(): void {
        if (!this.state.isPlaying) return;
        if (this.boosterMode === 'bomb') {
            this.boosterMode = 'none';
            return;
        }
        if (this.state.bombBoosterCount > 0) {
            this.state.useBombBooster();
            this.boosterMode = 'bomb';
            if (this.gameUI) this.gameUI.setBombBoosterCount(this.state.bombBoosterCount);
        }
    }

    /** Кнопка «Бустер телепорт» под заголовком Бустеры: активация = списание использования, счётчик обновляется при клике по кнопке. */
    private onBoosterTeleportClick(): void {
        if (!this.state.isPlaying) return;
        if (this.boosterMode === 'teleport') {
            this.boosterMode = 'none';
            this.teleportSource = null;
            this.selectedForSwap = null;
            if (this.boardView) this.boardView.highlightCells([], false);
            this.boardView.refresh();
            return;
        }
        if (this.state.teleportBoosterCount > 0) {
            this.state.useTeleportBooster();
            this.boosterMode = 'teleport';
            this.teleportSource = 'ui';
            if (this.gameUI) this.gameUI.setTeleportBoosterCount(this.state.teleportBoosterCount);
        }
    }

    private onTileClick(row: number, col: number): void {
        if (this.inputBlocked || !this.state.isPlaying) return;
        const value = this.board.getAt(row, col);
        if (value < 0) return;

        // --- Бустеры под заголовком «Бустеры» (кнопки): работают отдельно от спецтайлов на поле ---
        // UI «Бустер бомба»: уже активирован (счётчик списан при клике по кнопке), по клику по полю — сжигаем в радиусе R
        if (this.boosterMode === 'bomb') {
            const initial = this.board.getBombEffectCells(row, col, GameConfig.BOMB_RADIUS);
            const cells = this.board.getCellsWithChainReaction(initial);
            const count = this.board.burnCells(cells);
            this.state.addScore(count * GameConfig.scorePerTile);
            this.boosterMode = 'none';
            this.boardView.refresh();
            if (this.gameUI) this.gameUI.updateScore(this.state.score, GameConfig.TARGET_SCORE);
            this.scheduleOnce(() => this.applyGravityAndRefill(), 0.2);
            return;
        }

        // Обмен двух тайлов: второй клик (UI-телепорт или телепорт-тайл на поле)
        if (this.selectedForSwap !== null) {
            if (row === this.selectedForSwap[0] && col === this.selectedForSwap[1]) {
                this.selectedForSwap = null;
                this.boosterMode = 'none';
                this.teleportSource = null;
                this.boardView.highlightCells([], false);
                this.boardView.refresh();
                return;
            }
            this.board.swap(this.selectedForSwap[0], this.selectedForSwap[1], row, col);
            if (this.teleportSource === 'tile') this.state.useMove();
            this.selectedForSwap = null;
            this.boosterMode = 'none';
            this.teleportSource = null;
            this.boardView.highlightCells([], false);
            this.boardView.refresh();
            if (this.gameUI) {
                this.gameUI.updateScore(this.state.score, GameConfig.TARGET_SCORE);
                this.gameUI.setMoves(this.state.movesLeft);
            }
            return;
        }

        // UI «Бустер телепорт»: первый клик по полю — выбор первой клетки (счётчик уже списан при клике по кнопке)
        if (this.boosterMode === 'teleport' && this.teleportSource === 'ui') {
            this.selectedForSwap = [row, col];
            this.boardView.highlightCells([[row, col]], true);
            return;
        }

        // --- Спецтайлы на поле (бустеры в игровом поле): работают отдельно от кнопок «Бустеры» ---
        // Телепорт-тайл на поле: выбор первой клетки, ход спишется при обмене
        if (this.board.isTeleport(value)) {
            this.selectedForSwap = [row, col];
            this.teleportSource = 'tile';
            this.boardView.highlightCells([[row, col]], true);
            return;
        }

        this.inputBlocked = true;

        // Ракета/бомба/очистить всё на поле — эффект спецтайла с цепной реакцией, тратится ход
        if (this.board.isSpecial(value)) {
            const initial = this.board.getSpecialEffectCells(row, col);
            const cells = this.board.getCellsWithChainReaction(initial);
            const count = this.board.burnCells(cells);
            this.state.addScore(count * GameConfig.scorePerTile);
            this.state.useMove();
            this.boardView.refresh();
            if (this.gameUI) {
                this.gameUI.updateScore(this.state.score, GameConfig.TARGET_SCORE);
                this.gameUI.setMoves(this.state.movesLeft);
            }
            this.scheduleOnce(() => this.applyGravityAndRefill(), 0.2);
            return;
        }

        // При клике сгорает вся связная группа того же цвета (все прилегающие по горизонтали и вертикали)
        const group = this.board.getConnectedGroup(row, col);
        if (group.length < GameConfig.MIN_GROUP_SIZE) {
            if (this.boardView && group.length === 1) this.boardView.pulseTile(row, col);
            this.inputBlocked = false;
            return;
        }

        const count = this.board.burnCells(group);
        const n = group.length;
        let spawnType: number | null = null;
        if (n >= GameConfig.POWER_BOOSTER_GROUP_MIN) {
            const power = [GameConfig.TILE_BOMB_MAX, GameConfig.TILE_CLEAR_ALL];
            spawnType = power[Math.floor(Math.random() * power.length)];
            this.state.addMoves(GameConfig.BONUS_MOVES_POWER);
        } else if (n >= GameConfig.BOOSTER_GROUP_MIN && n <= GameConfig.BOOSTER_GROUP_MAX) {
            const boosters = [GameConfig.TILE_ROCKET_H, GameConfig.TILE_ROCKET_V, GameConfig.TILE_BOMB, GameConfig.TILE_TELEPORT];
            spawnType = boosters[Math.floor(Math.random() * boosters.length)];
        }
        if (spawnType !== null) {
            this.board.setAt(row, col, spawnType);
        }
        this.state.addScore(count * GameConfig.scorePerTile);
        this.state.useMove();
        this.boardView.refresh();
        if (this.gameUI) {
            this.gameUI.updateScore(this.state.score, GameConfig.TARGET_SCORE);
            this.gameUI.setMoves(this.state.movesLeft);
        }
        this.scheduleOnce(() => this.applyGravityAndRefill(), 0.2);
    }

    private applyGravityAndRefill(): void {
        this.board.applyGravity();
        this.board.refill();
        this.boardView.refresh();
        this.inputBlocked = false;
        this.checkWinLose();
    }

    private checkWinLose(): void {
        if (this.state.result === 'win') {
            if (this.gameUI) this.gameUI.showWin();
            return;
        }
        if (this.state.result === 'lose') {
            if (this.gameUI) this.gameUI.showLose();
            return;
        }
        this.checkLoseIfNoMoves();
    }

    /** Если ходов нет — перемешать до MAX_SHUFFLES раз, иначе проигрыш. */
    private checkLoseIfNoMoves(): void {
        if (!this.state.isPlaying) return;
        if (this.board.hasValidMove()) return;
        if (this.shuffleCount < GameConfig.MAX_SHUFFLES) {
            this.shuffleCount++;
            this.board.shuffle();
            this.boardView.refresh();
        } else {
            this.state.setLose();
            if (this.gameUI) this.gameUI.showLose();
        }
    }
}
