export type Locale = 'zh' | 'en' | 'ja' | 'ko'

export interface Translations {
  [key: string]: string
}

export interface I18nOptions {
  defaultLocale?: Locale
  translations?: Record<Locale, Translations>
}

export class I18n {
  private readonly translations: Map<Locale, Translations> = new Map()
  private defaultLocale: Locale = 'zh'

  constructor(options: I18nOptions = {}) {
    this.defaultLocale = options.defaultLocale ?? 'zh'

    // Built-in translations
    this.translations.set('zh', {
      greeting: '你好！我是{name}，有什么我可以帮你的吗？',
      greeting_short: '你好！',
      thanks: '谢谢！',
      sorry: '抱歉...',
      goodbye: '再见～',
      thinking: '让我想想...',
      error: '出了点问题',
      not_understand: '我不太明白你的意思',
    })

    this.translations.set('en', {
      greeting: 'Hi! I am {name}. How can I help?',
      greeting_short: 'Hi!',
      thanks: 'Thanks!',
      sorry: 'Sorry...',
      goodbye: 'Bye!',
      thinking: 'Let me think...',
      error: 'Something went wrong',
      not_understand: "I don't understand",
    })

    this.translations.set('ja', {
      greeting: 'こんにちは！私は{name}です。何かお手伝いできることはありますか？',
      greeting_short: 'こんにちは！',
      thanks: 'ありがとう！',
      sorry: 'ごめんなさい...',
      goodbye: 'さようなら～',
      thinking: '考えてみます...',
      error: '問題が発生しました',
      not_understand: 'よくわかりません',
    })

    this.translations.set('ko', {
      greeting: '안녕하세요! 저는 {name}입니다. 무엇을 도와드릴까요?',
      greeting_short: '안녕하세요!',
      thanks: '감사합니다!',
      sorry: '죄송합니다...',
      goodbye: '안녕히 가세요~',
      thinking: '생각해 볼게요...',
      error: '문제가 발생했습니다',
      not_understand: '이해가 가지 않습니다',
    })

    // Load custom translations
    if (options.translations) {
      for (const [locale, trans] of Object.entries(options.translations)) {
        this.translations.set(locale as Locale, { ...this.translations.get(locale as Locale), ...trans })
      }
    }
  }

  t(key: string, params?: Record<string, string>, locale?: Locale): string {
    const lang = locale ?? this.defaultLocale
    const trans = this.translations.get(lang) ?? this.translations.get(this.defaultLocale)!

    let text = trans[key] ?? key

    // Replace params like {name}
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
      }
    }

    return text
  }

  setLocale(locale: Locale): void {
    this.defaultLocale = locale
  }

  getLocale(): Locale {
    return this.defaultLocale
  }

  listLocales(): Locale[] {
    return [...this.translations.keys()]
  }

  addTranslations(locale: Locale, translations: Translations): void {
    const existing = this.translations.get(locale) ?? {}
    this.translations.set(locale, { ...existing, ...translations })
  }
}

export function createI18n(options?: I18nOptions): I18n {
  return new I18n(options)
}

export const i18n = createI18n()