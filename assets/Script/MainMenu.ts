const { ccclass, property } = cc._decorator;

/**
 * Главное меню: 3 кнопки — PLAY, OPTIONS, QUIT.
 * Вешается на Canvas сцены меню. В инспекторе привязываются узлы кнопок.
 */
@ccclass
export default class MainMenu extends cc.Component {
    /** Кнопка «PLAY» — переход на сцену игры */
    @property(cc.Node)
    playBtn: cc.Node = null;

    /** Кнопка «OPTIONS» — настройки (пока можно заглушка) */
    @property(cc.Node)
    optionsBtn: cc.Node = null;

    /** Кнопка «QUIT» — выход из игры */
    @property(cc.Node)
    quitBtn: cc.Node = null;

    /** Имя сцены с игрой (без расширения). Должно совпадать с именем .fire в assets/Scene/ */
    @property({ tooltip: 'Имя сцены игры для перехода по PLAY' })
    gameSceneName: string = 'GameScene';

    /** Имя сцены настроек для перехода по OPTIONS. */
    @property({ tooltip: 'Имя сцены настроек для перехода по OPTIONS' })
    optionSceneName: string = 'Option';

    onLoad(): void {
        this.registerButton(this.playBtn, this.onPlay);
        this.registerButton(this.optionsBtn, this.onOptions);
        this.registerButton(this.quitBtn, this.onQuit);
    }

    private registerButton(node: cc.Node, handler: () => void): void {
        if (!node || !handler) return;
        if (!node.getComponent(cc.Button)) node.addComponent(cc.Button);
        node.on(cc.Node.EventType.TOUCH_END, handler, this);
    }

    private onPlay(): void {
        if (!this.gameSceneName) return;
        cc.director.loadScene(this.gameSceneName);
    }

    private onOptions(): void {
        if (this.optionSceneName) cc.director.loadScene(this.optionSceneName);
    }

    private onQuit(): void {
        if (cc.sys.isBrowser) {
            (window as any).close ? (window as any).close() : cc.log('Quit (в браузере закрытие недоступно)');
        } else {
            cc.game.end();
        }
    }
}
