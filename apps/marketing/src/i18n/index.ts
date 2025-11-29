import en from './translations/en.json';
import ar from './translations/ar.json';

export const translations = { en, ar } as const;
export type Locale = keyof typeof translations;
export type TranslationKey = keyof typeof en;

export const locales: Locale[] = ['en', 'ar'];
export const defaultLocale: Locale = 'en';

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key] ?? translations.en[key] ?? key;
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, segment] = url.pathname.split('/');
  return segment === 'ar' ? 'ar' : 'en';
}

export function getDir(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export function getLocalizedPath(path: string, locale: Locale): string {
  // Remove leading slash and any existing locale prefix
  const cleanPath = path.replace(/^\/?(ar\/)?/, '');

  if (locale === 'en') {
    return cleanPath ? `/${cleanPath}` : '/';
  }

  return cleanPath ? `/ar/${cleanPath}` : '/ar';
}

export function getAlternateLocale(locale: Locale): Locale {
  return locale === 'en' ? 'ar' : 'en';
}
