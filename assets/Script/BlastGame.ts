const { ccclass, property } = cc._decorator;
import { GameBoard } from './Game/GameBoard';
import { GameState } from './Game/GameState';
import { GameConfig } from './Game/GameConfig';
import { GameSettings } from './Game/GameSettings';
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

    /** Кнопка «РЕСТАРТ» в панели победы (ПОБЕДА!). Если одна кнопка в обеих панелях — можно указать её и там и там. */
    @property(cc.Node)
    winRestartBtn: cc.Node = null;

    /** Кнопка «РЕСТАРТ» в панели поражения (ПРОИГРАЛ!). */
    @property(cc.Node)
    loseRestartBtn: cc.Node = null;

    /** Кнопка «В меню» в панели победы. При клике загружается сцена меню. */
    @property(cc.Node)
    winMenuBtn: cc.Node = null;

    /** Кнопка «В меню» в панели поражения. При клике загружается сцена меню. */
    @property(cc.Node)
    loseMenuBtn: cc.Node = null;

    /** Имя сцены меню для перехода по кнопкам «В меню» (например MenuScene). */
    @property({ tooltip: 'Имя сцены меню для кнопок «В меню»' })
    menuSceneName: string = 'MenuScene';

    /** Фоновая музыка при игре. Поддерживаемые форматы: .mp3, .ogg, .wav (см. README_SETUP). Загрузите файл в проект и перетащите сюда AudioClip. */
    @property(cc.AudioClip)
    bgMusicClip: cc.AudioClip = null;

    /** Громкость фоновой музыки (0..1). По умолчанию 0.6. */
    @property({ range: [0, 1], step: 0.1, tooltip: 'Громкость фоновой музыки 0–1' })
    bgMusicVolume: number = 0.6;

    /** Звук при успешном сжигании группы тайлов (совпадение по цвету). */
    @property(cc.AudioClip)
    soundMatchClip: cc.AudioClip = null;
    /** Звук взрыва: один и тот же для бомб/ракет на поле и для бустера-бомбы. */
    @property(cc.AudioClip)
    soundExplosionClip: cc.AudioClip = null;
    /** Звук телепорта — только при использовании бустера «Телепорт» (обмен двух тайлов по кнопке). */
    @property(cc.AudioClip)
    soundTeleportClip: cc.AudioClip = null;
    /** Звук при показе меню победы. */
    @property(cc.AudioClip)
    soundWinClip: cc.AudioClip = null;
    /** Звук при показе меню поражения. */
    @property(cc.AudioClip)
    soundLoseClip: cc.AudioClip = null;
    /** Громкость звуковых эффектов (0..1). По умолчанию 1. */
    @property({ range: [0, 1], step: 0.1, tooltip: 'Громкость эффектов 0–1' })
    soundEffectsVolume: number = 1;

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
        this.registerRestartButtons();
        this.registerMenuButtons();
        this.playBackgroundMusic();
        // При первом запуске сцены (не при рестарте) один тайл иногда не реагирует — через небольшую задержку принудительно обновляем вид и разблокируем ввод.
        this.scheduleOnce(() => {
            if (this.boardView && this.board) {
                this.boardView.refresh();
                this.inputBlocked = false;
            }
        }, 0.2);
    }

    onDestroy(): void {
        if (cc.audioEngine) cc.audioEngine.stopMusic();
    }

    /** Запуск фоновой музыки (зацикленной). Учитывает настройки из Option (GameSettings). */
    private playBackgroundMusic(): void {
        if (!this.bgMusicClip || !cc.audioEngine) return;
        cc.audioEngine.playMusic(this.bgMusicClip, true);
        const vol = GameSettings.isMuted() ? 0 : Math.max(0, Math.min(1, GameSettings.getMusicVolume()));
        cc.audioEngine.setMusicVolume(vol);
    }

    /** Воспроизвести звуковой эффект (один раз). Учитывает настройки из Option (GameSettings). */
    private playSound(clip: cc.AudioClip | null): void {
        if (!clip || !cc.audioEngine) return;
        if (GameSettings.isMuted()) return;
        const vol = Math.max(0, Math.min(1, GameSettings.getSoundVolume() * this.soundEffectsVolume));
        cc.audioEngine.setEffectsVolume(vol);
        cc.audioEngine.playEffect(clip, false);
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

    /** Подключить кнопки РЕСТАРТ в панелях победы и поражения — перезапуск игры. */
    private registerRestartButtons(): void {
        const onRestart = (): void => {
            this.startNewGame();
        };
        const setup = (node: cc.Node): void => {
            if (!node || !node.isValid) return;
            if (node.getComponent(cc.Button) == null) node.addComponent(cc.Button);
            node.off(cc.Node.EventType.TOUCH_END, onRestart, this);
            node.on(cc.Node.EventType.TOUCH_END, onRestart, this);
        };
        setup(this.winRestartBtn);
        setup(this.loseRestartBtn);
    }

    /** Подключить кнопки «В меню» в панелях победы и поражения — переход на сцену меню. */
    private registerMenuButtons(): void {
        const goToMenu = (): void => {
            if (this.menuSceneName) cc.director.loadScene(this.menuSceneName);
        };
        const setup = (node: cc.Node): void => {
            if (!node || !node.isValid) return;
            if (node.getComponent(cc.Button) == null) node.addComponent(cc.Button);
            node.off(cc.Node.EventType.TOUCH_END, goToMenu, this);
            node.on(cc.Node.EventType.TOUCH_END, goToMenu, this);
        };
        setup(this.winMenuBtn);
        setup(this.loseMenuBtn);
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
            // После рестарта синхронизируем снапшот для анимаций, чтобы первый ход не выглядел как «перезагрузка» всей сцены
            this.boardView.syncSnapshotWithBoard();
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
        // UI «Бустер бомба»: уже активирован (счётчик списан при клике по кнопке), по клику по полю — сжигаем в радиусе R. Блокируем ввод до завершения анимации и refresh (как у ракет/бомб), чтобы тайлы не «залипали».
        if (this.boosterMode === 'bomb') {
            this.inputBlocked = true;
            const initial = this.board.getBombEffectCells(row, col, GameConfig.BOMB_RADIUS);
            const cells = this.board.getCellsWithChainReaction(initial);
            const count = this.board.burnCells(cells);
            this.state.addScore(count * GameConfig.scorePerTile);
            this.boosterMode = 'none';
            if (this.gameUI) this.gameUI.updateScore(this.state.score, GameConfig.TARGET_SCORE);
            this.playSound(this.soundExplosionClip);
            this.boardView.playBurnAnimation(cells, () => this.applyGravityAndRefill(), true);
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
            // Клик по «действующему» тайлу (бомба, ракета, очистить всё или группа 2+) — сбрасываем выбор телепорта и обрабатываем как обычный клик
            const isActionTile = (value >= GameConfig.TILE_ROCKET_H && value <= GameConfig.TILE_CLEAR_ALL) ||
                (value >= 0 && value <= 4 && this.board.getConnectedGroup(row, col).length >= GameConfig.MIN_GROUP_SIZE);
            if (isActionTile) {
                this.selectedForSwap = null;
                this.boosterMode = 'none';
                this.teleportSource = null;
                this.boardView.highlightCells([], false);
                this.boardView.refresh();
                // Не return — дальше обработается как клик по ракете/бомбе/обычной группе
            } else {
                this.board.swap(this.selectedForSwap[0], this.selectedForSwap[1], row, col);
                if (this.teleportSource === 'ui') this.playSound(this.soundTeleportClip);
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
        }

        // UI «Бустер телепорт»: первый клик по полю — выбор первой клетки (счётчик уже списан при клике по кнопке)
        if (this.boosterMode === 'teleport' && this.teleportSource === 'ui') {
            this.selectedForSwap = [row, col];
            this.boardView.highlightCells([[row, col]], true);
            return;
        }

        // --- Спецтайлы на поле (бустеры в игровом поле): работают отдельно от кнопок «Бустеры» ---
        // Телепорт-тайл на поле: теперь работает ТОЛЬКО если активен режим телепорта с кнопки.
        // Без нажатия кнопки клик по такому тайлу обрабатывается как обычный (не запускает обмен).
        if (this.board.isTeleport(value) && this.boosterMode === 'teleport' && this.teleportSource === 'ui') {
            this.selectedForSwap = [row, col];
            this.teleportSource = 'tile';
            this.boardView.highlightCells([[row, col]], true);
            return;
        }

        // Горизонтальная/вертикальная ракета: ТОЛЬКО очищение ряда или столбца; попавшие в ряд бомбы срабатывают по своей логике (цепная реакция)
        if (value === GameConfig.TILE_ROCKET_H || value === GameConfig.TILE_ROCKET_V) {
            this.inputBlocked = true;
            const initial = this.board.getSpecialEffectCells(row, col); // только строка или только столбец
            const cells = this.board.getCellsWithChainReaction(initial);
            const count = this.board.burnCells(cells);
            this.state.addScore(count * GameConfig.scorePerTile);
            this.state.useMove();
            if (this.gameUI) {
                this.gameUI.updateScore(this.state.score, GameConfig.TARGET_SCORE);
                this.gameUI.setMoves(this.state.movesLeft);
            }
            this.playSound(this.soundExplosionClip);
            this.boardView.playBurnAnimation(cells, () => this.applyGravityAndRefill(), true);
            return;
        }

        // Обычная бомба и бомба-макс: одна клетка — радиус R; группа прилегающих бомб (5–8) — объединение эффектов (ракета → ряд/столбец, бомба → радиус)
        if (value === GameConfig.TILE_BOMB || value === GameConfig.TILE_BOMB_MAX) {
            this.inputBlocked = true;
            const bombGroup = this.board.getConnectedBombGroup(row, col);
            const R = value === GameConfig.TILE_BOMB_MAX ? GameConfig.BOMB_MAX_RADIUS : GameConfig.BOMB_RADIUS;
            const initial = bombGroup.length >= 2
                ? this.board.getUnionEffectCellsForBombGroup(bombGroup)
                : this.board.getBombEffectCells(row, col, R);
            const cells = this.board.getCellsWithChainReaction(initial);
            const count = this.board.burnCells(cells);
            this.state.addScore(count * GameConfig.scorePerTile);
            this.state.useMove();
            if (this.gameUI) {
                this.gameUI.updateScore(this.state.score, GameConfig.TARGET_SCORE);
                this.gameUI.setMoves(this.state.movesLeft);
            }
            this.playSound(this.soundExplosionClip);
            this.boardView.playBurnAnimation(cells, () => this.applyGravityAndRefill(), true);
            return;
        }

        this.inputBlocked = true;

        // Очистить всё (TILE_CLEAR_ALL) — эффект с цепной реакцией
        if (value === GameConfig.TILE_CLEAR_ALL) {
            const initial = this.board.getSpecialEffectCells(row, col);
            const cells = this.board.getCellsWithChainReaction(initial);
            const count = this.board.burnCells(cells);
            this.state.addScore(count * GameConfig.scorePerTile);
            this.state.useMove();
            if (this.gameUI) {
                this.gameUI.updateScore(this.state.score, GameConfig.TARGET_SCORE);
                this.gameUI.setMoves(this.state.movesLeft);
            }
            this.boardView.playBurnAnimation(cells, () => this.applyGravityAndRefill());
            return;
        }

        // При клике сгорает вся связная группа того же цвета (прилегающие по горизонтали и вертикали)
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
        if (this.gameUI) {
            this.gameUI.updateScore(this.state.score, GameConfig.TARGET_SCORE);
            this.gameUI.setMoves(this.state.movesLeft);
        }
        this.playSound(this.soundMatchClip);
        this.boardView.playBurnAnimation(group, () => this.applyGravityAndRefill());
    }

    private applyGravityAndRefill(): void {
        this.board.applyGravity();
        this.board.refill();
        this.boardView.refresh();
        this.inputBlocked = false;
        this.selectedForSwap = null;
        this.boosterMode = 'none';
        this.teleportSource = null;
        this.checkWinLose();
        // Страховка: повторно разблокировать ввод после короткой задержки (на случай рассинхрона после анимации/взрыва).
        this.scheduleOnce(() => { this.inputBlocked = false; }, 0.05);
    }

    private checkWinLose(): void {
        if (this.state.result === 'win') {
            this.playSound(this.soundWinClip);
            if (this.gameUI) this.gameUI.showWin();
            return;
        }
        if (this.state.result === 'lose') {
            this.playSound(this.soundLoseClip);
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
