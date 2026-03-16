import { GameConfig } from './GameConfig';

export type GameResult = 'playing' | 'win' | 'lose';

/**
 * Состояние игры: очки, ходы, результат.
 */
export class GameState {
    private _score: number = 0;
    private _movesLeft: number;
    private _result: GameResult = 'playing';
    private _bombBoosterCount: number;
    private _teleportBoosterCount: number;

    constructor(movesLeft: number = GameConfig.MAX_MOVES) {
        this._movesLeft = movesLeft;
        this._bombBoosterCount = GameConfig.DEFAULT_BOMB_BOOSTERS;
        this._teleportBoosterCount = GameConfig.DEFAULT_TELEPORT_BOOSTERS;
    }

    get score(): number { return this._score; }
    get movesLeft(): number { return this._movesLeft; }
    get result(): GameResult { return this._result; }
    get isPlaying(): boolean { return this._result === 'playing'; }
    get bombBoosterCount(): number { return this._bombBoosterCount; }
    get teleportBoosterCount(): number { return this._teleportBoosterCount; }

    /** Использовать бустер-бомбу (возвращает true, если было использование). */
    useBombBooster(): boolean {
        if (this._result !== 'playing' || this._bombBoosterCount <= 0) return false;
        this._bombBoosterCount--;
        return true;
    }

    /** Использовать бустер-телепорт (возвращает true, если было использование). */
    useTeleportBooster(): boolean {
        if (this._result !== 'playing' || this._teleportBoosterCount <= 0) return false;
        this._teleportBoosterCount--;
        return true;
    }

    addScore(points: number): void {
        if (this._result !== 'playing') return;
        this._score += points;
    }

    useMove(): void {
        if (this._result !== 'playing') return;
        this._movesLeft--;
        if (this._movesLeft <= 0 && this._score < GameConfig.TARGET_SCORE) {
            this._result = 'lose';
        } else if (this._score >= GameConfig.TARGET_SCORE) {
            this._result = 'win';
        }
    }

    /** Бонусные ходы (например за группу 10+) */
    addMoves(count: number): void {
        if (this._result !== 'playing') return;
        this._movesLeft += count;
    }

    setWin(): void { this._result = 'win'; }
    setLose(): void { this._result = 'lose'; }

    get targetScore(): number { return GameConfig.TARGET_SCORE; }
}
