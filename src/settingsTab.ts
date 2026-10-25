import { App, PluginSettingTab, Setting } from "obsidian";
import type AutoCodeblockLanguageDetectorPlugin from "./main";
import { ALL_LANGUAGES, DEFAULT_SETTINGS, LanguageDefinition } from "./settings";

export class AutoCodeblockSettingTab extends PluginSettingTab {
  plugin: AutoCodeblockLanguageDetectorPlugin;

  constructor(app: App, plugin: AutoCodeblockLanguageDetectorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── Confidence threshold ──────────────────────────────────────────────
    new Setting(containerEl)
      .setName("Confidence threshold")
      .setDesc(
        "Minimum confidence score (0–1) required to label a code block. " +
        "Lower values detect more blocks but may be less accurate."
      )
      .addSlider((slider) => {
        const valueDisplay = createSpan({ text: this.plugin.settings.confidenceThreshold.toFixed(2) });
        slider
          .setLimits(0.05, 0.95, 0.05)
          .setValue(this.plugin.settings.confidenceThreshold)
          .onChange(async (value) => {
            valueDisplay.setText(value.toFixed(2));
            this.plugin.settings.confidenceThreshold = value;
            await this.plugin.saveSettings();
          });
        // Append numeric label after the slider
        slider.sliderEl.parentElement?.appendChild(valueDisplay);
        valueDisplay.addClass("acld-slider-value");
        return slider;
      });

    // ── Language lists ────────────────────────────────────────────────────
    new Setting(containerEl).setName("Language detection").setHeading();
    containerEl.createEl("p", {
      text: "Click a language chip to move it between lists. " +
            "Languages in the Disabled list will never be emitted.",
      cls: "setting-item-description",
    });

    const listsWrapper = containerEl.createDiv({ cls: "acld-lists-wrapper" });

    // -- Enabled list
    const enabledSection = listsWrapper.createDiv({ cls: "acld-list-section" });
    enabledSection.createEl("h4", { text: "✅ Enabled languages" });
    const enabledContainer = enabledSection.createDiv({ cls: "acld-chip-container" });

    // -- Disabled list
    const disabledSection = listsWrapper.createDiv({ cls: "acld-list-section acld-list-section--disabled" });
    disabledSection.createEl("h4", { text: "🚫 Disabled languages" });
    const disabledContainer = disabledSection.createDiv({ cls: "acld-chip-container" });

    // ── Reset button ──────────────────────────────────────────────────────
    new Setting(containerEl)
      .setName("Reset to defaults")
      .setDesc("Restore the default language list and confidence threshold.")
      .addButton((btn) =>
        btn
          .setButtonText("Reset")
          .setWarning()
          .onClick(async () => {
            this.plugin.settings.disabledLanguageIds = [...DEFAULT_SETTINGS.disabledLanguageIds];
            this.plugin.settings.confidenceThreshold = DEFAULT_SETTINGS.confidenceThreshold;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    // ── Render chips ──────────────────────────────────────────────────────
    this.renderChips(enabledContainer, disabledContainer);
  }

  private renderChips(
    enabledContainer: HTMLElement,
    disabledContainer: HTMLElement
  ): void {
    const disabledSet = new Set(this.plugin.settings.disabledLanguageIds);

    const sorted = [...ALL_LANGUAGES].sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    for (const lang of sorted) {
      const isDisabled = disabledSet.has(lang.id);
      const chip = this.createChip(lang, isDisabled);

      chip.addEventListener("click", async () => {
        if (disabledSet.has(lang.id)) {
          // Move to enabled
          this.plugin.settings.disabledLanguageIds =
            this.plugin.settings.disabledLanguageIds.filter((id) => id !== lang.id);
        } else {
          // Move to disabled
          // New array, not push: the list may still be DEFAULT_SETTINGS' own array.
          this.plugin.settings.disabledLanguageIds = [...this.plugin.settings.disabledLanguageIds, lang.id];
        }
        await this.plugin.saveSettings();
        this.display();
      });

      if (isDisabled) {
        disabledContainer.appendChild(chip);
      } else {
        enabledContainer.appendChild(chip);
      }
    }

    // Show placeholder when a list is empty
    if (enabledContainer.children.length === 0) {
      enabledContainer.createEl("span", {
        text: "No enabled languages — click a disabled chip to re-enable.",
        cls: "acld-chip-placeholder",
      });
    }
    if (disabledContainer.children.length === 0) {
      disabledContainer.createEl("span", {
        text: "No disabled languages — click an enabled chip to disable it.",
        cls: "acld-chip-placeholder",
      });
    }
  }

  private createChip(lang: LanguageDefinition, disabled: boolean): HTMLElement {
    const chip = createEl("button", {
      text: lang.label,
      cls: ["acld-chip", disabled ? "acld-chip--disabled" : "acld-chip--enabled"],
      attr: { title: `ID: ${lang.id} — click to ${disabled ? "enable" : "disable"}` },
    });
    return chip;
  }
}
