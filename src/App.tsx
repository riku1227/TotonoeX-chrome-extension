import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react';
import { Page, Columns, Card, List, CheckRow, Notice, Button, Text, Section, Stack } from './kit';
import { t, uiLocale } from './i18n';

type Settings = {directCopy: boolean; imagesFirst: boolean; hidePremium: boolean; hideGrokExplain: boolean; hideImageEdit: boolean};
const defaults: Settings = {directCopy: true, imagesFirst: true, hidePremium: true, hideGrokExplain: true, hideImageEdit: true};
const normalize = (values: Partial<Settings>): Settings => ({
  directCopy: typeof values.directCopy === 'boolean' ? values.directCopy : true,
  imagesFirst: typeof values.imagesFirst === 'boolean' ? values.imagesFirst : true,
  hidePremium: typeof values.hidePremium === 'boolean' ? values.hidePremium : true,
  hideGrokExplain: typeof values.hideGrokExplain === 'boolean' ? values.hideGrokExplain : true,
  hideImageEdit: typeof values.hideImageEdit === 'boolean' ? values.hideImageEdit : true,
});

type Category = 'basic' | 'grok' | 'premium';
const categories: {id: Category; label: string}[] = [
  {id: 'basic', label: t('categoryBasic')},
  {id: 'grok', label: t('categoryGrok')},
  {id: 'premium', label: t('categoryPremium')},
];

export function App() {
  useLayoutEffect(() => { document.querySelector('.k-app')?.setAttribute('lang', uiLocale); }, []);
  const [settings, setSettings] = useState<Settings>(defaults);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setSettings(normalize(await chrome.storage.local.get(defaults)));
      setReady(true); setError('');
    } catch { setError(t('loadError')); }
  }

  useEffect(() => {
    void load();
    const listener = (changes, area) => {
      if (area !== 'local') return;
      setSettings(current => {
        const next = {...current};
        for (const key of Object.keys(defaults) as (keyof Settings)[]) {
          if (key in changes) next[key] = typeof changes[key].newValue === 'boolean' ? changes[key].newValue : true;
        }
        return next;
      });
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  async function change(key: keyof Settings, next: boolean) {
    if (saving) return;
    const previous = settings[key];
    setSaving(true); setError('');
    setSettings(current => ({...current, [key]: next}));
    try { await chrome.storage.local.set({[key]: next}); }
    catch { setSettings(current => ({...current, [key]: previous})); setError(t('saveError')); }
    finally { setSaving(false); }
  }

  const row = (key: keyof Settings) =>
    <CheckRow key={key} title={t(`${key}Title`)} meta={t(`${key}Description`)} checked={settings[key]} onChange={next => void change(key, next)} />;
  const rows: Record<Category, ReactNode[]> = {
    basic: [row('directCopy'), row('imagesFirst')],
    grok: [row('hideGrokExplain'), row('hideImageEdit')],
    premium: [row('hidePremium')],
  };

  return <Page title={t('appName')} theme="sora" archetype="card" shell="topbar">
      {error && <Notice tone="bad" action={!ready ? <Button size="s" onClick={load}>{t('retry')}</Button> : undefined}>{error}</Notice>}
      <Columns main={ready ? <fieldset disabled={saving} aria-busy={saving}>
          <Stack gap="l">{categories.map(({id, label}) =>
            <Section key={id} title={label}>
              <Card><List>{rows[id]}</List></Card>
            </Section>)}</Stack>
        </fieldset> : <Text dim>{t('loadingSettings')}</Text>} />
    </Page>;
}
