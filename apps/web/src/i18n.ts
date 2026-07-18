export type Language = 'en' | 'uk';

const uk: Record<string, string> = {
  'RSS analysis through deterministic queues and semantic graphing.': 'Аналіз RSS за допомогою детермінованих черг і семантичних графів.',
  Articles: 'Статті', Feeds: 'Джерела', Graph: 'Граф', Settings: 'Налаштування', Digests: 'Дайджести', Telemetry: 'Телеметрія',
  'Queue Monitor': 'Монітор черг', Logout: 'Вийти', 'Log out': 'Вийти', 'Regeneration in progress': 'Триває перегенерація', of: 'з', articles: 'статей',
  Language: 'Мова', 'All rights reserved.': 'Усі права захищено.', 'Contact by email': 'Написати на email',
  'Sign in to your account': 'Увійдіть до облікового запису', 'Create a new account': 'Створіть новий обліковий запис', Login: 'Увійти', Registration: 'Реєстрація', Register: 'Зареєструватися',
  'Use verified credentials to open your news workspace.': 'Використайте підтверджені дані, щоб відкрити новинний простір.',
  'Register first, then confirm the DEV MODE email link.': 'Спочатку зареєструйтеся, потім підтвердьте email-посилання DEV MODE.',
  'Hold to show password': 'Утримуйте, щоб показати пароль', 'Please wait...': 'Зачекайте...', 'Create account': 'Створити акаунт', 'Use existing account': 'Увійти в існуючий акаунт',
  'Resend verification email': 'Надіслати лист підтвердження ще раз', 'Sending...': 'Надсилання...', 'Open verification link': 'Відкрити посилання підтвердження', 'Go to Login': 'Перейти до входу',
  Retry: 'Спробувати ще раз', Category: 'Категорія', 'All feeds': 'Усі джерела', 'All importance': 'Будь-яка важливість', Important: 'Важливі', Normal: 'Звичайні', Junk: 'Спам',
  'All states': 'Усі стани', Pending: 'Очікують', Processed: 'Оброблені', Filtered: 'Відфільтровані', 'All time': 'За весь час', Today: 'Сьогодні', 'Last 7 days': 'Останні 7 днів', 'Last 30 days': 'Останні 30 днів',
  'Loading articles...': 'Завантаження статей...', 'Open original': 'Відкрити оригінал', Categories: 'Категорії', Axes: 'Вісі', None: 'Немає', Related: 'Пов’язані', 'Mentioned in': 'Згадується в', 'Mentions over time': 'Згадування з часом',
  'RSS or Atom URL': 'URL RSS або Atom', 'Loading feeds...': 'Завантаження джерел...', 'Search graph': 'Пошук у графі', 'All nodes': 'Усі вузли', Entities: 'Сутності', 'Last day': 'Останній день', 'Last week': 'Останній тиждень', 'Last month': 'Останній місяць',
  'Core links': 'Основні зв’язки', 'All links': 'Усі зв’язки', 'Similar only': 'Лише схожі', 'Loading graph...': 'Завантаження графа...', Regeneration: 'Перегенерація', 'Categorization axes': 'Осі категоризації',
  'New category': 'Нова категорія', 'New axis': 'Нова вісь', 'Values, comma separated': 'Значення через кому', Save: 'Зберегти', Day: 'День', Week: 'Тиждень', Month: 'Місяць', 'All categories': 'Усі категорії', 'All entities': 'Усі сутності',
  'Loading digests...': 'Завантаження дайджестів...', 'Top entities': 'Провідні сутності', 'Top categories': 'Провідні категорії', 'Key articles': 'Ключові статті',
  'LLM calls': 'Виклики LLM', 'Input tokens': 'Вхідні токени', 'Output tokens': 'Вихідні токени', 'Total tokens': 'Усього токенів', Operation: 'Операція', Provider: 'Провайдер', Model: 'Модель', Calls: 'Виклики', Input: 'Вхід', Output: 'Вихід', Total: 'Усього'
};

export function translate(language: Language, value: string): string {
  return language === 'uk' ? uk[value] ?? value : value;
}
