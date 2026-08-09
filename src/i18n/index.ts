import { createI18n } from '@mister-guiiug/dev-wpa-config/react/i18n';
import { messages } from './messages';

export const { I18nProvider, useI18n } = createI18n({
  messages,
  locales: ['fr', 'en'],
  fallbackLocale: 'fr',
  storageKey: 'carbook_locale',
});
