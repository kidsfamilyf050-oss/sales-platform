import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart2 } from 'lucide-react'

const EFFECTIVE_DATE = '1 сентября 2026 г.'
const SERVICE_NAME   = 'Sirius Track'
const CONTACT_EMAIL  = 'info@sirius-track.kz'
const COMPANY_NAME   = 'ТОО «Sirius Track»'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Навигация */}
      <nav className="border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">{SERVICE_NAME}</span>
          </div>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> На главную
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Заголовок */}
        <div className="mb-10">
          <p className="text-sm text-blue-600 font-medium uppercase tracking-wide mb-2">Правовые документы</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Политика конфиденциальности</h1>
          <p className="text-gray-500 text-sm">Дата вступления в силу: {EFFECTIVE_DATE}</p>
        </div>

        {/* Вводный блок */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-8">
          <p className="text-blue-800 text-sm leading-relaxed">
            Мы серьёзно относимся к защите данных. Этот документ объясняет, какие данные мы собираем,
            зачем и как защищаем. Если у вас есть вопросы — пишите на{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline">{CONTACT_EMAIL}</a>.
          </p>
        </div>

        <div className="space-y-8 text-[15px] leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Кто мы</h2>
            <p className="text-gray-700">
              {COMPANY_NAME} (далее — «мы», «Оператор») управляет сервисом {SERVICE_NAME} —
              CRM-платформой для управления продажами, доступной по адресу в сети интернет.
              Мы являемся оператором персональных данных в соответствии с Законом Республики Казахстан
              «О персональных данных и их защите» от 21 мая 2013 года № 94-V (далее — Закон о ПД).
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Какие данные мы собираем</h2>

            <p className="text-gray-700 font-medium mb-2">2.1 Данные учётной записи</p>
            <ul className="list-disc ml-6 space-y-1 text-gray-700">
              <li>Имя и фамилия</li>
              <li>Адрес электронной почты</li>
              <li>Номер телефона (необязательно)</li>
              <li>Название компании</li>
              <li>Хэшированный пароль (мы не знаем ваш пароль в открытом виде)</li>
            </ul>

            <p className="text-gray-700 font-medium mt-4 mb-2">2.2 Рабочие данные (вносятся вами)</p>
            <ul className="list-disc ml-6 space-y-1 text-gray-700">
              <li>Данные ваших клиентов (имена, телефоны, суммы сделок)</li>
              <li>Данные ваших сотрудников, добавленных вами в систему</li>
              <li>История сделок, лидов, задач</li>
            </ul>
            <p className="text-gray-600 text-sm mt-2">
              Эти данные принадлежат вам. Мы обрабатываем их исключительно для предоставления вам сервиса.
            </p>

            <p className="text-gray-700 font-medium mt-4 mb-2">2.3 Технические данные</p>
            <ul className="list-disc ml-6 space-y-1 text-gray-700">
              <li>IP-адрес при входе в систему</li>
              <li>User-agent браузера</li>
              <li>Дата и время последнего входа</li>
              <li>Журналы активности (для безопасности)</li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Для чего мы используем данные</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border border-gray-200 font-medium text-gray-700">Цель</th>
                    <th className="text-left p-3 border border-gray-200 font-medium text-gray-700">Основание</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr>
                    <td className="p-3 border border-gray-200">Идентификация и вход в систему</td>
                    <td className="p-3 border border-gray-200">Исполнение договора</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 border border-gray-200">Отображение ваших данных в интерфейсе</td>
                    <td className="p-3 border border-gray-200">Исполнение договора</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-gray-200">Отправка системных уведомлений</td>
                    <td className="p-3 border border-gray-200">Исполнение договора</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 border border-gray-200">Восстановление пароля</td>
                    <td className="p-3 border border-gray-200">Исполнение договора</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-gray-200">Защита от несанкционированного доступа</td>
                    <td className="p-3 border border-gray-200">Законный интерес</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 border border-gray-200">Техническая поддержка</td>
                    <td className="p-3 border border-gray-200">Исполнение договора</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-gray-700 mt-3">
              Мы не используем ваши данные для рекламы, не продаём их и не передаём третьим лицам
              в маркетинговых целях.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Кому мы передаём данные</h2>
            <p className="text-gray-700">
              Мы можем передавать данные только следующим категориям получателей:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-2 text-gray-700">
              <li>
                <span className="font-medium">Инфраструктурные провайдеры</span> — облачный хостинг
                (Railway / обработчик БД). Данные хранятся на защищённых серверах. Провайдеры не имеют
                доступа к содержимому данных.
              </li>
              <li>
                <span className="font-medium">Почтовый провайдер</span> — для отправки системных писем
                (приглашения, сброс пароля). Передаётся только email-адрес.
              </li>
              <li>
                <span className="font-medium">Государственные органы</span> — исключительно по законному
                требованию в рамках законодательства РК.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Как мы защищаем данные</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              {[
                { icon: '🔐', title: 'Шифрование паролей', desc: 'Пароли хранятся в виде bcrypt-хэша. Мы никогда не знаем ваш пароль.' },
                { icon: '🔑', title: 'JWT-токены', desc: 'Сессии защищены токенами с ограниченным сроком действия (7 дней).' },
                { icon: '🛡️', title: 'HTTPS', desc: 'Все соединения шифруются по протоколу TLS.' },
                { icon: '🚫', title: 'Защита от перебора', desc: 'Блокировка входа после 10 неудачных попыток в течение 15 минут.' },
                { icon: '🔒', title: 'Изоляция данных', desc: 'Данные каждой компании строго изолированы — другие клиенты не имеют к ним доступа.' },
                { icon: '📋', title: 'Журнал действий', desc: 'Все административные действия записываются в журнал аудита.' },
              ].map(item => (
                <div key={item.title} className="bg-gray-50 rounded-xl p-4">
                  <p className="font-medium text-gray-900 mb-1">{item.icon} {item.title}</p>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Сроки хранения данных</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border border-gray-200 font-medium text-gray-700">Тип данных</th>
                    <th className="text-left p-3 border border-gray-200 font-medium text-gray-700">Срок хранения</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  <tr>
                    <td className="p-3 border border-gray-200">Данные учётной записи</td>
                    <td className="p-3 border border-gray-200">До удаления аккаунта + 30 дней</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 border border-gray-200">Данные лидов и сделок</td>
                    <td className="p-3 border border-gray-200">До расторжения договора + 30 дней</td>
                  </tr>
                  <tr>
                    <td className="p-3 border border-gray-200">Журналы безопасности (IP, user-agent)</td>
                    <td className="p-3 border border-gray-200">90 дней</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="p-3 border border-gray-200">Журналы аудита</td>
                    <td className="p-3 border border-gray-200">1 год</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Ваши права как субъекта данных</h2>
            <p className="text-gray-700 mb-3">
              В соответствии с Законом РК о персональных данных вы имеете право:
            </p>
            <ul className="list-disc ml-6 space-y-2 text-gray-700">
              <li><span className="font-medium">Доступ</span> — запросить, какие данные мы храним о вас.</li>
              <li><span className="font-medium">Исправление</span> — потребовать исправить неточные данные.</li>
              <li><span className="font-medium">Удаление</span> — потребовать удалить ваши данные (право на забвение).</li>
              <li><span className="font-medium">Экспорт</span> — получить ваши данные в машиночитаемом формате.</li>
              <li><span className="font-medium">Ограничение</span> — потребовать приостановить обработку ваших данных.</li>
              <li><span className="font-medium">Отзыв согласия</span> — в случаях, когда обработка основана на согласии.</li>
            </ul>
            <p className="text-gray-700 mt-3">
              Для реализации прав направьте запрос на{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">{CONTACT_EMAIL}</a>.
              Мы рассмотрим обращение в течение 15 рабочих дней.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Cookie и аналитика</h2>
            <p className="text-gray-700">
              Сервис использует только технически необходимые cookie для поддержания сессии пользователя.
              Мы не устанавливаем аналитических, рекламных или маркетинговых cookie. Сторонние трекеры
              не подключены.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Изменения политики</h2>
            <p className="text-gray-700">
              Мы можем обновлять настоящую политику. О существенных изменениях мы уведомим вас по
              электронной почте не менее чем за 15 дней. Актуальная версия всегда доступна по адресу
              /privacy на сайте сервиса.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Контакты</h2>
            <div className="bg-gray-50 rounded-xl p-5 space-y-2 text-sm text-gray-700">
              <p><span className="font-medium">Оператор персональных данных:</span> {COMPANY_NAME}</p>
              <p>
                <span className="font-medium">Email:</span>{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">{CONTACT_EMAIL}</a>
              </p>
              <p className="text-gray-500 text-xs pt-1">
                По вопросам защиты персональных данных вы также вправе обратиться в уполномоченный
                орган — Министерство цифрового развития, инноваций и аэрокосмической промышленности РК.
              </p>
            </div>
          </section>

        </div>

        {/* Подвал */}
        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} {SERVICE_NAME}. Все права защищены.</p>
          <div className="flex gap-6">
            <Link to="/oferta" className="hover:text-gray-600 transition-colors">Оферта</Link>
            <Link to="/privacy" className="hover:text-gray-600 transition-colors font-medium text-gray-600">Политика конфиденциальности</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
