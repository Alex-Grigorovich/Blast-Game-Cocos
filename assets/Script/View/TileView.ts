const { ccclass, property } = cc._decorator;

/** Цвета для обычных тайлов: красный, зелёный, синий, жёлтый, сиреневый (если нет отдельных спрайтов) */
export const TILE_COLORS: cc.Color[] = [
    cc.color(255, 100, 100),   // 0 красный
    cc.color(100, 200, 100),   // 1 зелёный
    cc.color(100, 150, 255),   // 2 синий
    cc.color(255, 220, 100),   // 3 жёлтый
    cc.color(200, 150, 255),   // 4 сиреневый
];

export type TileClickCallback = (row: number, col: number) => void;

/** Значения тайлов-бомб, для которых воспроизводится idle-анимация (5–8: ракета Г/В, бомба, бомба-макс). */
export const BOMB_IDLE_VALUES = [5, 6, 7, 8];

@ccclass
export default class TileView extends cc.Component {
    @property(cc.Sprite)
    sprite: cc.Sprite = null;

    private _row: number = 0;
    private _col: number = 0;
    private _tileValue: number = -1; // -1 пусто, 0..4 цвет, 5..10 спецтайл
    private _onClick: TileClickCallback = null;
    private _idleScheduled: boolean = false;
    private _idleAnimDuration: number = 0.35;
    private _idleIntervalSec: number = 5;
    /** Колбэк для планировщика: масштабируем всегда узел с TileView (this.node), чтобы анимация была у всех типов бомб. */
    private _idleTick = (): void => {
        if (!this.node || !this.node.isValid) return;
        const half = this._idleAnimDuration / 2;
        this.node.runAction(cc.sequence(
            cc.scaleTo(half, 1.5),
            cc.scaleTo(half, 1)
        ));
    };

    init(row: number, col: number, tileValue: number, onClick: TileClickCallback): void {
        this._row = row;
        this._col = col;
        this._onClick = onClick;
        this._tileValue = tileValue;
    }

    /** Установить отображение: value 0..8, frame для спрайта, color для подкраски (если один спрайт на все цвета). */
    setDisplay(value: number, frame: cc.SpriteFrame | null, color?: cc.Color): void {
        this._tileValue = value;
        if (!this.sprite || !this.sprite.node) return;
        if (value < 0) {
            this.sprite.node.active = false;
            return;
        }
        this.sprite.node.active = true;
        if (frame) {
            this.sprite.spriteFrame = frame;
            this.sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        }
        if (color) this.sprite.node.color = color.clone();
    }

    /** Обратная совместимость: только цветовой индекс 0..4 (один спрайт + tint). */
    setColorIndex(index: number): void {
        this._tileValue = index;
        if (this.sprite && this.sprite.node) {
            if (index >= 0 && index < TILE_COLORS.length) {
                this.sprite.node.color = TILE_COLORS[index].clone();
                this.sprite.node.active = true;
            } else {
                this.sprite.node.active = false;
            }
        }
    }

    getRow(): number { return this._row; }
    getCol(): number { return this._col; }
    getTileValue(): number { return this._tileValue; }

    /** Запустить idle-анимацию для бомб: раз в intervalSec секунд тайл увеличивается в 1.5 раза и возвращается. animDurationSec — длительность одного «пульса». */
    setBombIdle(intervalSec: number, animDurationSec: number): void {
        this.stopBombIdle();
        if (!this.node || !this.node.isValid || intervalSec <= 0 || animDurationSec <= 0) return;
        this._idleAnimDuration = animDurationSec;
        this._idleIntervalSec = intervalSec;
        this._idleScheduled = true;
        this.schedule(this._idleTick, intervalSec, cc.macro.REPEAT_FOREVER, 0);
        this._idleTick();
    }

    /** Остановить idle-анимацию и сбросить масштаб. */
    stopBombIdle(): void {
        if (this._idleScheduled) {
            this.unschedule(this._idleTick);
            this._idleScheduled = false;
        }
        if (this.node && this.node.isValid) this.node.scale = 1;
    }

    onLoad(): void {
        this.node.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    onDestroy(): void {
        this.stopBombIdle();
        this.node.off(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    private onTouchEnd(): void {
        if (this._tileValue >= 0 && this._onClick) this._onClick(this._row, this._col);
    }
}
