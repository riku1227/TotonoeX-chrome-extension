// ChromeのUI言語でメッセージを選択する。未対応の言語はmanifestの既定言語へ戻る。
export const t = (key: string): string => chrome.i18n.getMessage(key);
export const uiLocale = t('uiLocale');
