const { ccclass, property } = cc._decorator;
import { GameSettings } from './Game/GameSettings';

/**
 * Сцена настроек (Option): громкость музыки, громкость звуков, чекбокс «выключить звук», кнопка возврата в меню.
 * Повесить на Canvas сцены Option. В инспекторе привязать узлы слайдеров, чекбокса и кнопки.
 */
@ccclass
export default class Options extends cc.Component {
    /** Узел со компонентом Slider — громкость музыки (progress 0..1). */
    @property(cc.Node)
    musicSliderNode: cc.Node = null;

    /** Узел со компонентом Slider — громкость звуковых эффектов (progress 0..1). */
    @property(cc.Node)
    soundSliderNode: cc.Node = null;

    /** Узел с компонентом Toggle — выключить музыку и звуки. */
    @property(cc.Node)
    muteToggleNode: cc.Node = null;

    /** Кнопка «Назад» / «В меню» — переход на сцену меню. */
    @property(cc.Node)
    backBtn: cc.Node = null;

    @property({ tooltip: 'Имя сцены меню для возврата' })
    menuSceneName: string = 'MenuScene';

    onLoad(): void {
        this.loadAndApplySettings();
        this.registerSlider(this.musicSliderNode, (progress: number) => {
            GameSettings.setMusicVolume(progress);
        });
        this.registerSlider(this.soundSliderNode, (progress: number) => {
            GameSettings.setSoundVolume(progress);
        });
        this.registerMuteToggle(this.muteToggleNode);
        this.registerButton(this.backBtn, () => this.goBack());
    }

    private loadAndApplySettings(): void {
        const musicVol = GameSettings.getMusicVolume();
        const soundVol = GameSettings.getSoundVolume();
        const muted = GameSettings.isMuted();

        const musicSlider = this.musicSliderNode && this.musicSliderNode.getComponent(cc.Slider);
        if (musicSlider) musicSlider.progress = musicVol;

        const soundSlider = this.soundSliderNode && this.soundSliderNode.getComponent(cc.Slider);
        if (soundSlider) soundSlider.progress = soundVol;

        const toggle = this.muteToggleNode && this.muteToggleNode.getComponent(cc.Toggle);
        if (toggle) toggle.isChecked = muted;
    }

    private registerSlider(node: cc.Node, onSlide: (progress: number) => void): void {
        if (!node || !onSlide) return;
        const slider = node.getComponent(cc.Slider);
        if (!slider) return;
        node.on('slide', () => onSlide(slider.progress), this);
    }

    private registerMuteToggle(node: cc.Node): void {
        if (!node) return;
        const toggle = node.getComponent(cc.Toggle);
        if (!toggle) return;
        node.on('toggle', () => GameSettings.setMuted(toggle.isChecked), this);
    }

    private registerButton(node: cc.Node, handler: () => void): void {
        if (!node || !handler) return;
        if (!node.getComponent(cc.Button)) node.addComponent(cc.Button);
        node.on(cc.Node.EventType.TOUCH_END, handler, this);
    }

    private goBack(): void {
        if (this.menuSceneName) cc.director.loadScene(this.menuSceneName);
    }
}
