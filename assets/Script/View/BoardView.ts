const { ccclass, property } = cc._decorator;
import { GameBoard, Cell } from '../Game/GameBoard';
import { GameConfig } from '../Game/GameConfig';
import TileView, { TILE_COLORS, TileClickCallback } from './TileView';

/** Является ли значение тайлом-бомбой с idle-анимацией (ракета Г/В, бомба, бомба-макс). */
function isBombIdleType(value: number): boolean {
    return value >= GameConfig.TILE_ROCKET_H && value <= GameConfig.TILE_BOMB_MAX;
}

/** Индексы: 0–4 цвета, 5–10 спецтайлы (ракета Г/В, бомба, бомба-макс, очистить всё, телепорт) */
const TILE_FRAME_COUNT = 11;

/** Категории спрайтов для GameDesk: обычные тайлы и типы бомб */
@ccclass
export default class BoardView extends cc.Component {
    @property(cc.Prefab)
    tilePrefab: cc.Prefab = null;

    /** Отдельный префаб для тайлов-бомб (ракета Г/В, бомба, бомба-макс). Если задан — для значений 5–8 создаётся он вместо tilePrefab. */
    @property(cc.Prefab)
    bombTilePrefab: cc.Prefab = null;

    @property(cc.SpriteFrame)
    tileSpriteFrame: cc.SpriteFrame = null;

    // --- Категория: обычные тайлы (5 цветов) ---
    /** Обычные тайлы: массив из 5 спрайтов по цветам (0 красный, 1 зелёный, 2 синий, 3 жёлтый, 4 сиреневый). Если пусто — используется tileFrames[0..4] или tileSpriteFrame. */
    @property([cc.SpriteFrame])
    ordinaryFrames: cc.SpriteFrame[] = [];

    // --- Категория: бомба (радиусная 3×3) ---
    /** Бомба: спрайт для обычной бомбы (радиус 3×3). Если не задан — используется tileFrames[7]. */
    @property(cc.SpriteFrame)
    bombFrame: cc.SpriteFrame = null;

    // --- Категория: бомба горизонтальная (вся строка) ---
    /** Бомба горизонтальная: спрайт для уничтожения всей строки. Если не задан — используется tileFrames[5]. */
    @property(cc.SpriteFrame)
    bombHorizontalFrame: cc.SpriteFrame = null;

    // --- Категория: бомба вертикальная (весь столбец) ---
    /** Бомба вертикальная: спрайт для уничтожения всего столбца. Если не задан — используется tileFrames[6]. */
    @property(cc.SpriteFrame)
    bombVerticalFrame: cc.SpriteFrame = null;

    /** Оставшиеся спецтайлы (бомба-макс, очистить всё, телепорт) — по индексам 8,9,10. Fallback: общий список спрайтов. */
    @property([cc.SpriteFrame])
    tileFrames: cc.SpriteFrame[] = [];

    @property
    tileSize: number = 64;

    @property
    spacing: number = 4;

    /** Idle-анимация бомб: интервал в секундах между «пульсами» (увеличение тайла). По умолчанию 5. */
    @property({ tooltip: 'Секунд между повторениями idle-анимации бомб' })
    bombIdleInterval: number = 5;

    /** Idle-анимация бомб: длительность одного пульса (увеличение и возврат масштаба) в секундах. По умолчанию 0.35. */
    @property({ tooltip: 'Длительность одного пульса (сек)' })
    bombIdleAnimDuration: number = 0.35;

    /** Длительность анимации исчезновения/взрыва тайла при сжигании (сек). По умолчанию 0.28. */
    @property({ tooltip: 'Длительность анимации взрыва/исчезновения тайла (сек)' })
    burnAnimDuration: number = 0.28;

    private board: GameBoard = null;
    private tileNodes: cc.Node[][] = [];
    private tileViews: TileView[][] = [];
    private onClick: TileClickCallback = null;
    /** Последний снимок сетки для анимации появления/падения тайлов */
    private lastGridSnapshot: number[][] | null = null;

    /** Привязать к модели поля и установить обработчик клика */
    bind(board: GameBoard, onTileClick: TileClickCallback): void {
        this.board = board;
        this.onClick = onTileClick;
        const self = this;
        const doBuild = () => {
            if (!self.tileSpriteFrame && (!self.tileFrames || self.tileFrames.length === 0)) {
                cc.loader.loadRes('Texture/singleColor', cc.SpriteFrame, (err: Error, frame: cc.SpriteFrame) => {
                    if (!err && frame) self.tileSpriteFrame = frame;
                    self.buildGrid();
                });
            } else {
                self.buildGrid();
            }
        };
        this.scheduleOnce(doBuild, 0);
    }

    private buildGrid(): void {
        this.clearGrid();
        if (!this.board) return;
        const rows = this.board.getRows();
        const cols = this.board.getCols();
        const totalW = cols * this.tileSize + (cols - 1) * this.spacing;
        const totalH = rows * this.tileSize + (rows - 1) * this.spacing;
        const w = this.node.width || totalW;
        const h = this.node.height || totalH;
        const anchorX = this.node.anchorX != null ? this.node.anchorX : 0.5;
        const anchorY = this.node.anchorY != null ? this.node.anchorY : 0.5;
        // При якоре (0.5, 0.5) центр узла в (0,0) — сетку центрируем в (0,0). При (0,0) центр узла в (w/2, h/2).
        const centerX = anchorX === 0.5 ? 0 : w / 2;
        const centerY = anchorY === 0.5 ? 0 : h / 2;
        const startX = centerX - totalW / 2 + this.tileSize / 2;
        const startY = centerY - totalH / 2 + this.tileSize / 2;

        for (let r = 0; r < rows; r++) {
            this.tileNodes[r] = [];
            this.tileViews[r] = [];
            for (let c = 0; c < cols; c++) {
                const node = this.createTileNode(r, c);
                const x = startX + c * (this.tileSize + this.spacing);
                const y = startY + r * (this.tileSize + this.spacing);
                node.setPosition(cc.v2(x, y));
                this.node.addChild(node);
                this.tileNodes[r][c] = node;
                const tv = node.getComponent(TileView);
                if (tv) this.tileViews[r][c] = tv;
            }
        }
        // Запуск idle для бомб после добавления узлов в сцену (чтобы анимация работала и при старте игры)
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const value = this.board.getAt(r, c);
                if (isBombIdleType(value)) {
                    const view = this.tileViews[r] && this.tileViews[r][c];
                    if (view) view.setBombIdle(this.bombIdleInterval, this.bombIdleAnimDuration);
                }
            }
        }
    }

    /** Выбор спрайта по значению тайла: сначала категории (обычные, бомба, бомба Г/В), затем tileFrames по индексу. */
    private getFrameForValue(value: number): cc.SpriteFrame | null {
        if (value < 0 || value >= TILE_FRAME_COUNT) return null;
        if (value >= 0 && value < GameConfig.COLORS) {
            if (this.ordinaryFrames && this.ordinaryFrames[value]) return this.ordinaryFrames[value];
            if (this.tileFrames && this.tileFrames[value]) return this.tileFrames[value];
            return this.tileSpriteFrame || null;
        }
        if (value === GameConfig.TILE_ROCKET_H) return this.bombHorizontalFrame || (this.tileFrames && this.tileFrames[5]) || null;
        if (value === GameConfig.TILE_ROCKET_V) return this.bombVerticalFrame || (this.tileFrames && this.tileFrames[6]) || null;
        if (value === GameConfig.TILE_BOMB) return this.bombFrame || (this.tileFrames && this.tileFrames[7]) || null;
        if (this.tileFrames && this.tileFrames[value]) return this.tileFrames[value];
        return this.tileSpriteFrame || null;
    }

    private getColorForValue(value: number): cc.Color {
        if (value >= 0 && value < TILE_COLORS.length) return TILE_COLORS[value];
        return cc.color(255, 255, 255);
    }

    private getAnyTileFrame(): cc.SpriteFrame | null {
        return this.tileSpriteFrame
            || (this.ordinaryFrames && this.ordinaryFrames[0])
            || (this.tileFrames && this.tileFrames[0])
            || (this.bombFrame || this.bombHorizontalFrame || this.bombVerticalFrame)
            || null;
    }

    private createTileNode(row: number, col: number): cc.Node {
        const value = this.board.getAt(row, col);
        const useBombPrefab = isBombIdleType(value) && this.bombTilePrefab;
        let node: cc.Node;
        if (useBombPrefab) {
            node = cc.instantiate(this.bombTilePrefab);
        } else if (this.tilePrefab) {
            node = cc.instantiate(this.tilePrefab);
        } else {
            node = new cc.Node('Tile');
            node.setContentSize(this.tileSize, this.tileSize);
            const sprite = node.addComponent(cc.Sprite);
            const frame = this.getFrameForValue(value) || this.getAnyTileFrame();
            if (frame) {
                sprite.spriteFrame = frame;
                sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            } else {
                const g = node.addComponent(cc.Graphics);
                g.rect(-this.tileSize / 2, -this.tileSize / 2, this.tileSize, this.tileSize);
                g.fillColor = this.getColorForValue(value);
                g.fill();
            }
            const tv = node.addComponent(TileView);
            (tv as any).sprite = sprite;
        }
        node.setContentSize(this.tileSize, this.tileSize);
        const tv = node.getComponent(TileView) || node.addComponent(TileView);
        if (!tv.sprite && node.getComponent(cc.Sprite)) (tv as any).sprite = node.getComponent(cc.Sprite);
        tv.init(row, col, value, (r, c) => this.onClick && this.onClick(r, c));
        const frame = this.getFrameForValue(value) || this.getAnyTileFrame();
        // Обычные тайлы (0–4): без тинта — цвет берётся из спрайта, иначе затемнение (синий, красный и т.д.)
        const color = value >= 0 && value <= 4 ? cc.color(255, 255, 255) : undefined;
        tv.setDisplay(value, frame, color);
        if (isBombIdleType(value)) tv.setBombIdle(this.bombIdleInterval, this.bombIdleAnimDuration);
        else tv.stopBombIdle();
        this.tileViews[row] = this.tileViews[row] || [];
        this.tileViews[row][col] = tv;
        return node;
    }

    private clearGrid(): void {
        for (let r = 0; r < this.tileNodes.length; r++) {
            for (let c = 0; c < (this.tileNodes[r] || []).length; c++) {
                const n = this.tileNodes[r][c];
                if (n && n.isValid) n.destroy();
            }
        }
        this.tileNodes = [];
        this.tileViews = [];
    }

    /** Обновить отображение по текущему состоянию поля */
    refresh(): void {
        if (!this.board) return;
        const snapshot = this.board.getGridSnapshot();
        const rows = this.board.getRows();
        const cols = this.board.getCols();
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const view = this.tileViews[r] && this.tileViews[r][c];
                if (view) {
                    const value = this.board.getAt(r, c);
                    view.node.active = value >= 0;
                    if (value < 0) continue;
                    view.node.scale = 1;
                    view.node.opacity = 255;
                    const frame = this.getFrameForValue(value);
                    const color = value >= 0 && value <= 4 ? cc.color(255, 255, 255) : undefined;
                    view.setDisplay(value, frame, color);
                    if (isBombIdleType(value)) view.setBombIdle(this.bombIdleInterval, this.bombIdleAnimDuration);
                    else view.stopBombIdle();

                    // Плавное появление/«падение» тайлов: если значение изменилось или была пустота, слегка масштабируем с ease-out
                    if (this.lastGridSnapshot) {
                        const prev = this.lastGridSnapshot[r][c];
                        if (prev !== value && value >= 0 && view.node && view.node.isValid) {
                            const n = view.node;
                            n.stopAllActions();
                            n.scale = 0.7;
                            n.runAction(cc.scaleTo(0.12, 1).easing(cc.easeBackOut()));
                        }
                    }
                }
            }
        }
        this.lastGridSnapshot = snapshot;
    }

    /**
     * Анимация исчезновения/взрыва для сжигаемых тайлов: лёгкое увеличение, затем масштаб вверх + затухание.
     * После завершения вызывается onComplete (обычно гравитация и дозаполнение).
     */
    playBurnAnimation(cells: Cell[], onComplete: () => void): void {
        if (!cells || cells.length === 0) {
            if (onComplete) onComplete();
            return;
        }
        const d = this.burnAnimDuration > 0 ? this.burnAnimDuration : 0.28;
        const t1 = d * 0.4;
        const t2 = d * 0.6;
        const key = (r: number, c: number) => `${r},${c}`;
        const seen = new Set<string>();
        for (const [r, c] of cells) {
            const k = key(r, c);
            if (seen.has(k)) continue;
            seen.add(k);
            const node = this.tileNodes[r] && this.tileNodes[r][c];
            const view = this.tileViews[r] && this.tileViews[r][c];
            if (!node || !node.isValid) continue;
            if (view && typeof view.stopBombIdle === 'function') view.stopBombIdle();
            node.stopAllActions();
            node.opacity = 255;
            node.runAction(cc.sequence(
                cc.spawn(
                    cc.scaleTo(t1, 1.35).easing(cc.easeBackOut()),
                    cc.delayTime(t1)
                ),
                cc.spawn(
                    cc.scaleTo(t2, 1.75),
                    cc.fadeOut(t2)
                ),
                cc.callFunc(() => {
                    if (node && node.isValid) {
                        node.scale = 1;
                        node.opacity = 255;
                    }
                })
            ));
        }
        this.scheduleOnce(() => {
            if (onComplete) onComplete();
        }, d);
    }

    /** Подсветить ячейки (или сбросить подсветку: cells=[], highlight=false — все в 255). */
    highlightCells(cells: Cell[], highlight: boolean): void {
        if (!highlight) {
            for (let r = 0; r < this.tileViews.length; r++)
                for (let c = 0; c < (this.tileViews[r] || []).length; c++) {
                    const view = this.tileViews[r][c];
                    if (view && view.node) view.node.opacity = 255;
                }
            return;
        }
        for (const [r, c] of cells) {
            const view = this.tileViews[r] && this.tileViews[r][c];
            if (view && view.node) view.node.opacity = 180;
        }
    }

    /** Пульс при тапе по одиночному тайлу (группа < 2) — подсказка, что ход не сделан */
    pulseTile(row: number, col: number): void {
        const view = this.tileViews[row] && this.tileViews[row][col];
        if (!view || !view.node) return;
        view.node.stopAllActions();
        const scale = 1.15;
        view.node.runAction(cc.sequence(
            cc.scaleTo(0.08, scale),
            cc.scaleTo(0.08, 1)
        ));
    }
}
