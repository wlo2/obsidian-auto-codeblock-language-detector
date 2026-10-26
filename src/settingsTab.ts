import { App, PluginSettingTab, SettingDefinitionItem } from "obsidian";
import type AutoCodeblockLanguageDetectorPlugin from "./main";
import { ALL_LANGUAGES, DEFAULT_SETTINGS } from "./settings";

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
        name: "Confidence threshold",
        desc: "Minimum confidence score (0–1) required to label a code block. " +
          "Lower values detect more blocks but may be less accurate.",
        control: {
          type: "slider",
          key: "confidenceThreshold",
          min: 0.05,
          max: 0.95,
          step: 0.05,
          displayFormat: (value) => value.toFixed(2),
        },
      },
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
        desc: "Restore the default language list and confidence threshold.",
        action: async () => {
          // The whole row is clickable, so ask before throwing away the user's choices.
          if (!window.confirm("Reset the confidence threshold and language list to their defaults?")) {
            return;
          }

          this.plugin.settings.disabledLanguageIds = [...DEFAULT_SETTINGS.disabledLanguageIds];
          this.plugin.settings.confidenceThreshold = DEFAULT_SETTINGS.confidenceThreshold;
          await this.plugin.saveSettings();
          this.update();
        },
      },
    ];
  }

  getControlValue(key: string): unknown {
    if (key.startsWith(LANGUAGE_KEY_PREFIX)) {
      return !this.plugin.settings.disabledLanguageIds.includes(key.slice(LANGUAGE_KEY_PREFIX.length));
    }

    return super.getControlValue(key);
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (!key.startsWith(LANGUAGE_KEY_PREFIX)) {
      return super.setControlValue(key, value);
    }

    const id = key.slice(LANGUAGE_KEY_PREFIX.length);
    const others = this.plugin.settings.disabledLanguageIds.filter((disabledId) => disabledId !== id);
    // A new array, never a mutation: the list may still be DEFAULT_SETTINGS' own array.
    this.plugin.settings.disabledLanguageIds = value ? others : [...others, id];
    await this.plugin.saveSettings();
  }
}
