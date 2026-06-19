/// <reference types="vite/client" />

declare interface Window {
  i18n: {
    load: (locale: string) => Promise<void>
    t: (key: string, params?: Record<string, string>) => string
    locale: () => string
    setLocale: (locale: string) => void
  }
  t: (key: string, params?: Record<string, string>) => string
  DESKTOP_PLATFORM: string
  HANA_VERSION: string
  HANA_DEV: boolean
}
