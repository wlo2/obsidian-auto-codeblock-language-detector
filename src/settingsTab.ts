import { App, Modal, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import type AutoCodeblockLanguageDetectorPlugin from "./main";
import { ALL_LANGUAGES, DEFAULT_SETTINGS, isLanguageEnabled, setLanguageEnabled } from "./settings";

// Each language toggle uses the key "language:<id>". It is stored inverted, in
// disabledLanguageIds, so settings saved by older versions keep working.
const LANGUAGE_KEY_PREFIX = "language:";

export class AutoCodeblockSettingTab extends PluginSettingTab {
  plugin: AutoCodeblockLanguageDetectorPlugin;

  constructor(app: App, plugin: AutoCodeblockLanguageDetectorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const languages = [...ALL_LANGUAGES].sort((a, b) => a.label.localeCompare(b.label));

    return [
      {
        type: "group",
        heading: "Languages",
        search: {
          placeholder: "Filter languages",
          // Aliases hold the short codes ("ts", "js"), as in Obsidian's main settings search.
          match: (definition, query) =>
            [definition.name, ...(definition.aliases ?? [])].some((text) => text.toLowerCase().includes(query.toLowerCase())),
        },
        items: languages.map((language) => ({
          name: language.label,
          aliases: [language.id],
          control: { type: "toggle", key: `${LANGUAGE_KEY_PREFIX}${language.id}` },
        })),
      },
      {
        name: "Reset to defaults",
        desc: "Restore the default language list.",
        // The whole row is clickable, so ask before throwing away the user's choices.
        action: () => {
          new ConfirmModal(this.app, "Reset the language list to its defaults?", () => {
            void this.resetToDefaults();
          }).open();
        },
      },
    ];
  }

  private async resetToDefaults(): Promise<void> {
    this.plugin.settings.disabledLanguageIds = [...DEFAULT_SETTINGS.disabledLanguageIds];
    await this.plugin.saveSettings();
    this.update();
  }

  getControlValue(key: string): unknown {
    if (key.startsWith(LANGUAGE_KEY_PREFIX)) {
      return isLanguageEnabled(this.plugin.settings.disabledLanguageIds, key.slice(LANGUAGE_KEY_PREFIX.length));
    }

    return super.getControlValue(key);
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (!key.startsWith(LANGUAGE_KEY_PREFIX)) {
      return super.setControlValue(key, value);
    }

    this.plugin.settings.disabledLanguageIds = setLanguageEnabled(
      this.plugin.settings.disabledLanguageIds, key.slice(LANGUAGE_KEY_PREFIX.length), value === true
    );
    await this.plugin.saveSettings();
  }
}

/** Obsidian's own dialog for a yes/no question, instead of the browser's blocking confirm(). */
class ConfirmModal extends Modal {
  constructor(app: App, private readonly message: string, private readonly onConfirm: () => void) {
    super(app);
  }

  onOpen(): void {
    this.setContent(this.message);
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
      .addButton((button) =>
        button.setButtonText("Reset").setDestructive().setCta().onClick(() => {
          this.close();
          this.onConfirm();
        })
      );
  }
}
