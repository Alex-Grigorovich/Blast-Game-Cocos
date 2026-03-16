import { GameConfig, BoardValue } from './GameConfig';

/** Позиция на поле [row, col] */
export type Cell = [number, number];

/**
 * Игровое поле — только данные и логика.
 * Сетка: grid[row][col]. Значение -1 — пусто, 0..4 — цвет, 5..10 — спецтайл (ракета Г/В, бомба, бомба-макс, очистить всё, телепорт).
 */
export class GameBoard {
    private grid: number[][];
    private readonly rows: number;
    private readonly cols: number;
    private readonly colors: number;

    constructor(rows: number = GameConfig.ROWS, cols: number = GameConfig.COLS, colorCount: number = GameConfig.COLORS) {
        this.rows = rows;
        this.cols = cols;
        this.colors = colorCount;
        this.grid = [];
        this.fillWithRandom();
    }

    getRows(): number { return this.rows; }
    getCols(): number { return this.cols; }
    getColors(): number { return this.colors; }

    /** Значение в ячейке: -1 пусто, 0..4 цвет, 5..8 спецтайл */
    getAt(row: number, col: number): BoardValue {
        if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return -1;
        return this.grid[row][col] as BoardValue;
    }

    isNormal(value: number): boolean { return value >= 0 && value <= 4; }
    isSpecial(value: number): boolean { return value >= 5 && value <= 10; }

    /** Телепорт — обмен двух ячеек (не сжигание). */
    isTeleport(value: number): boolean { return value === GameConfig.TILE_TELEPORT; }

    setAt(row: number, col: number, value: number): void {
        if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
            this.grid[row][col] = value;
        }
    }

    /** Заполнить поле случайными тайлами (0–4). При INITIAL_BOMB_COUNT > 0 часть ячеек — случайные бомбы (5–8). */
    fillWithRandom(): void {
        this.grid = [];
        for (let r = 0; r < this.rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < this.cols; c++) {
                this.grid[r][c] = Math.floor(Math.random() * this.colors);
            }
        }
        const n = GameConfig.INITIAL_BOMB_COUNT || 0;
        if (n <= 0) return;
        const bombTypes = [GameConfig.TILE_ROCKET_H, GameConfig.TILE_ROCKET_V, GameConfig.TILE_BOMB, GameConfig.TILE_BOMB_MAX];
        let placed = 0;
        for (let i = 0; i < 200 && placed < n; i++) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);
            if (this.grid[r][c] >= 0 && this.grid[r][c] <= 4) {
                this.grid[r][c] = bombTypes[Math.floor(Math.random() * bombTypes.length)];
                placed++;
            }
        }
    }

    /** Соседи по вертикали и горизонтали */
    private getNeighbors(row: number, col: number): Cell[] {
        const out: Cell[] = [];
        const d: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of d) {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) out.push([r, c]);
        }
        return out;
    }

    /**
     * Найти связную группу того же цвета (только обычные тайлы 0..4). Используется для hasValidMove и др.
     */
    getConnectedGroup(row: number, col: number): Cell[] {
        const color = this.getAt(row, col);
        if (!this.isNormal(color)) return [];
        const group: Cell[] = [];
        const visited = new Set<string>();
        const key = (r: number, c: number) => `${r},${c}`;
        const dfs = (r: number, c: number) => {
            if (this.getAt(r, c) !== color) return;
            const k = key(r, c);
            if (visited.has(k)) return;
            visited.add(k);
            group.push([r, c]);
            for (const [nr, nc] of this.getNeighbors(r, c)) dfs(nr, nc);
        };
        dfs(row, col);
        return group;
    }

    /**
     * При клике сгорают только соседние тайлы того же цвета (до 4 по вертикали/горизонтали + сам тайл), не вся связная группа.
     */
    getNeighborGroupSameColor(row: number, col: number): Cell[] {
        const color = this.getAt(row, col);
        if (!this.isNormal(color)) return [];
        const out: Cell[] = [[row, col]];
        for (const [r, c] of this.getNeighbors(row, col)) {
            if (this.getAt(r, c) === color) out.push([r, c]);
        }
        return out;
    }

    /**
     * Ячейки, которые задевает спецтайл при активации.
     * Ракета Г — вся строка, ракета В — весь столбец, бомба — радиус 1, бомба-макс — радиус 2.
     */
    getSpecialEffectCells(row: number, col: number): Cell[] {
        const v = this.getAt(row, col);
        if (!this.isSpecial(v)) return [];
        const out: Cell[] = [];
        if (v === GameConfig.TILE_ROCKET_H) {
            for (let c = 0; c < this.cols; c++) out.push([row, c]);
        } else if (v === GameConfig.TILE_ROCKET_V) {
            for (let r = 0; r < this.rows; r++) out.push([r, col]);
        } else if (v === GameConfig.TILE_BOMB) {
            const R = GameConfig.BOMB_RADIUS;
            for (let dr = -R; dr <= R; dr++)
                for (let dc = -R; dc <= R; dc++) {
                    const r = row + dr, c = col + dc;
                    if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) out.push([r, c]);
                }
        } else if (v === GameConfig.TILE_BOMB_MAX) {
            const R = GameConfig.BOMB_MAX_RADIUS;
            for (let dr = -R; dr <= R; dr++)
                for (let dc = -R; dc <= R; dc++) {
                    const r = row + dr, c = col + dc;
                    if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) out.push([r, c]);
                }
        } else if (v === GameConfig.TILE_CLEAR_ALL) {
            for (let r = 0; r < this.rows; r++)
                for (let c = 0; c < this.cols; c++) out.push([r, c]);
        }
        return out;
    }

    /** Ячейки в радиусе R от (row, col) — для бустера-бомбы из UI (3x3 при R=1). */
    getBombEffectCells(row: number, col: number, radius: number = GameConfig.BOMB_RADIUS): Cell[] {
        const out: Cell[] = [];
        for (let dr = -radius; dr <= radius; dr++)
            for (let dc = -radius; dc <= radius; dc++) {
                const r = row + dr, c = col + dc;
                if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) out.push([r, c]);
            }
        return out;
    }

    /** Добавить к множеству ячеек зоны от спецтайлов в этих ячейках (ракеты, бомбы, очистить всё). Не меняет сетку. */
    private getEffectCellsForValue(row: number, col: number, v: number): Cell[] {
        if (v === GameConfig.TILE_ROCKET_H) {
            const out: Cell[] = [];
            for (let c = 0; c < this.cols; c++) out.push([row, c]);
            return out;
        }
        if (v === GameConfig.TILE_ROCKET_V) {
            const out: Cell[] = [];
            for (let r = 0; r < this.rows; r++) out.push([r, col]);
            return out;
        }
        if (v === GameConfig.TILE_BOMB) {
            return this.getBombEffectCells(row, col, GameConfig.BOMB_RADIUS);
        }
        if (v === GameConfig.TILE_BOMB_MAX) {
            return this.getBombEffectCells(row, col, GameConfig.BOMB_MAX_RADIUS);
        }
        if (v === GameConfig.TILE_CLEAR_ALL) {
            const out: Cell[] = [];
            for (let r = 0; r < this.rows; r++)
                for (let c = 0; c < this.cols; c++) out.push([r, c]);
            return out;
        }
        return [];
    }

    /**
     * Цепная реакция: по начальному набору ячеек собирает все ячейки, задеваемые при сжигании.
     * Обход по очереди (BFS): каждая бомба/ракета/очистить всё в зоне добавляет свою зону, так срабатывают все по цепочке.
     */
    getCellsWithChainReaction(initialCells: Cell[]): Cell[] {
        const key = (r: number, c: number) => `${r},${c}`;
        const seen = new Set<string>();
        const queue: Cell[] = [];
        for (const [r, c] of initialCells) {
            const k = key(r, c);
            if (seen.has(k)) continue;
            seen.add(k);
            queue.push([r, c]);
        }
        let idx = 0;
        while (idx < queue.length) {
            const [r, c] = queue[idx++];
            const v = this.getAt(r, c);
            if (!this.isSpecial(v)) continue;
            const extra = this.getEffectCellsForValue(r, c, v);
            for (const [er, ec] of extra) {
                const kk = key(er, ec);
                if (seen.has(kk)) continue;
                seen.add(kk);
                queue.push([er, ec]);
            }
        }
        return Array.from(seen).map(k => {
            const [r, c] = k.split(',').map(Number);
            return [r, c] as Cell;
        });
    }

    /** Поменять местами две ячейки (бустер телепорт). */
    swap(row1: number, col1: number, row2: number, col2: number): void {
        if (row1 < 0 || row1 >= this.rows || col1 < 0 || col1 >= this.cols) return;
        if (row2 < 0 || row2 >= this.rows || col2 < 0 || col2 >= this.cols) return;
        const t = this.grid[row1][col1];
        this.grid[row1][col1] = this.grid[row2][col2];
        this.grid[row2][col2] = t;
    }

    /** Перемешать поле (все ячейки заново случайные 0..4). Без потери хода. */
    shuffle(): void {
        this.fillWithRandom();
    }

    /**
     * Удалить тайлы в указанных ячейках (записать -1).
     * Возвращает количество удалённых.
     */
    burnCells(cells: Cell[]): number {
        let count = 0;
        for (const [r, c] of cells) {
            if (this.getAt(r, c) >= 0) {
                this.setAt(r, c, -1);
                count++;
            }
        }
        return count;
    }

    /**
     * Сжечь группу и на месте одной ячейки (например клика) поставить спецтайл.
     * specialType: 5..8 (ракета Г, ракета В, бомба, бомба-макс).
     */
    burnCellsAndSpawnSpecial(cells: Cell[], spawnAt: Cell, specialType: number): number {
        const count = this.burnCells(cells);
        this.setAt(spawnAt[0], spawnAt[1], specialType);
        return count;
    }

    /**
     * Применить гравитацию: тайлы падают вниз (уменьшение row).
     * Пустые ячейки остаются сверху.
     */
    applyGravity(): void {
        for (let c = 0; c < this.cols; c++) {
            let write = 0;
            for (let r = 0; r < this.rows; r++) {
                const v = this.grid[r][c];
                if (v >= 0) {
                    if (write !== r) {
                        this.grid[write][c] = v;
                        this.grid[r][c] = -1;
                    }
                    write++;
                }
            }
            for (let r = write; r < this.rows; r++) this.grid[r][c] = -1;
        }
    }

    /**
     * Заполнить пустые ячейки (значение -1) только обычными тайлами 0..4.
     */
    refill(): void {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] === -1) {
                    this.grid[r][c] = Math.floor(Math.random() * this.colors);
                }
            }
        }
    }

    /**
     * Есть ли ход: есть группа из 2+ одного цвета или спецтайл (бустер).
     */
    hasValidMove(): boolean {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const v = this.getAt(r, c);
                if (v < 0) continue;
                if (this.isSpecial(v)) return true;
                if (this.getConnectedGroup(r, c).length >= GameConfig.MIN_GROUP_SIZE) return true;
            }
        }
        return false;
    }

    /** Копия сетки для отображения (readonly). [row][col] */
    getGridSnapshot(): number[][] {
        return this.grid.map(row => [...row]);
    }
}
