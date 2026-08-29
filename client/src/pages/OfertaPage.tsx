import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart2 } from 'lucide-react'

const EFFECTIVE_DATE = '1 сентября 2026 г.'
const SERVICE_NAME   = 'Sirius Track'
const CONTACT_EMAIL  = 'info@sirius-track.kz'
const COMPANY_NAME   = '[НАЗВАНИЕ КОМПАНИИ / ИП]'   // TODO: заполните после регистрации юрлица
const COMPANY_BIN    = '[БИН]'                       // TODO: заполните после регистрации
const COMPANY_ADDR   = '[ЮРИДИЧЕСКИЙ АДРЕС]'         // TODO: заполните после регистрации

export default function OfertaPage() {
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
          <p className="text-sm text-blue-600 font-medium uppercase tracking-wide mb-2">Публичная оферта</p>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Договор об использовании сервиса</h1>
          <p className="text-gray-500 text-sm">Дата вступления в силу: {EFFECTIVE_DATE}</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-[15px] leading-relaxed">

          {/* 1 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. Общие положения</h2>
            <p className="text-gray-700">
              Настоящий документ является публичной офертой {COMPANY_NAME} (далее — «Исполнитель») и содержит все
              существенные условия договора на предоставление доступа к программному обеспечению как услуге (SaaS)
              под наименованием «{SERVICE_NAME}».
            </p>
            <p className="text-gray-700 mt-3">
              Акцептом настоящей оферты является регистрация учётной записи в сервисе. С момента акцепта физическое
              или юридическое лицо (далее — «Пользователь») считается вступившим в договорные отношения с
              Исполнителем на условиях, изложенных ниже.
            </p>
            <p className="text-gray-700 mt-3">
              Сервис предназначен исключительно для бизнес-использования. Регистрируясь, вы подтверждаете, что
              действуете от имени организации или индивидуального предпринимателя.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. Предмет договора</h2>
            <p className="text-gray-700">
              Исполнитель предоставляет Пользователю доступ к веб-сервису {SERVICE_NAME} через интернет-браузер на
              условиях подписки. Сервис включает:
            </p>
            <ul className="list-disc ml-6 mt-3 space-y-1 text-gray-700">
              <li>управление лидами и воронкой продаж;</li>
              <li>аналитику и отчётность по продажам;</li>
              <li>управление командой менеджеров, лидорубов и клоузеров;</li>
              <li>учёт каналов привлечения и бюджетов;</li>
              <li>хранение данных о клиентах и сделках;</li>
              <li>иной функционал, описанный на сайте сервиса.</li>
            </ul>
            <p className="text-gray-700 mt-3">
              Исполнитель вправе обновлять, улучшать и изменять функциональность сервиса без предварительного
              уведомления, при условии что ключевые функции сохраняются.
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. Тарифы и оплата</h2>
            <p className="text-gray-700">
              Актуальные тарифы размещены на сайте сервиса. Доступен бесплатный пробный период продолжительностью
              14 (четырнадцать) календарных дней с момента регистрации.
            </p>
            <p className="text-gray-700 mt-3">
              После истечения пробного периода доступ к сервису возможен только при наличии активной подписки.
              Оплата производится авансом за выбранный период (месяц, квартал, год) в тенге (KZT) по реквизитам,
              выставленным Исполнителем.
            </p>
            <p className="text-gray-700 mt-3">
              Возврат средств за неиспользованный период подписки возможен при письменном обращении в течение
              5 (пяти) рабочих дней с момента оплаты. По истечении этого срока средства не возвращаются.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. Права и обязанности Пользователя</h2>
            <p className="text-gray-700 font-medium">Пользователь обязуется:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-gray-700">
              <li>предоставлять достоверные данные при регистрации;</li>
              <li>обеспечивать конфиденциальность учётных данных (логин/пароль);</li>
              <li>не передавать доступ к сервису третьим лицам, не входящим в состав его организации;</li>
              <li>не использовать сервис для хранения незаконного контента или данных, полученных без согласия субъектов;</li>
              <li>соблюдать законодательство Республики Казахстан при обработке персональных данных через сервис;</li>
              <li>своевременно оплачивать подписку.</li>
            </ul>
            <p className="text-gray-700 mt-3 font-medium">Пользователь вправе:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-gray-700">
              <li>добавлять неограниченное число пользователей в рамках оплаченного тарифа;</li>
              <li>экспортировать свои данные в любое время;</li>
              <li>обращаться в техническую поддержку по адресу {CONTACT_EMAIL};</li>
              <li>расторгнуть договор в любое время, уведомив Исполнителя.</li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. Права и обязанности Исполнителя</h2>
            <p className="text-gray-700 font-medium">Исполнитель обязуется:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-gray-700">
              <li>обеспечивать доступность сервиса не менее 99% времени в месяц (за исключением плановых работ);</li>
              <li>уведомлять Пользователя о плановых технических работах не менее чем за 24 часа;</li>
              <li>не передавать данные Пользователя третьим лицам без его согласия, за исключением случаев, предусмотренных законодательством РК;</li>
              <li>хранить резервные копии данных Пользователя;</li>
              <li>отвечать на запросы технической поддержки в течение 2 рабочих дней.</li>
            </ul>
            <p className="text-gray-700 mt-3 font-medium">Исполнитель вправе:</p>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-gray-700">
              <li>приостановить доступ к сервису при нарушении Пользователем условий настоящего договора;</li>
              <li>изменять тарифы, уведомив Пользователя не менее чем за 30 дней;</li>
              <li>использовать обезличенную агрегированную статистику для улучшения сервиса.</li>
            </ul>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. Конфиденциальность и данные</h2>
            <p className="text-gray-700">
              Все данные, размещённые Пользователем в сервисе (клиенты, сделки, сотрудники), являются
              собственностью Пользователя. Исполнитель выступает оператором персональных данных исключительно в
              интересах Пользователя и не вправе использовать их в иных целях.
            </p>
            <p className="text-gray-700 mt-3">
              Обработка персональных данных осуществляется в соответствии с Законом Республики Казахстан
              «О персональных данных и их защите» от 21 мая 2013 года № 94-V. Подробности — в{' '}
              <Link to="/privacy" className="text-blue-600 hover:underline">Политике конфиденциальности</Link>.
            </p>
            <p className="text-gray-700 mt-3">
              При расторжении договора Пользователь может запросить экспорт всех своих данных. Данные хранятся в
              системе в течение 30 дней после расторжения, после чего безвозвратно удаляются.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. Ограничение ответственности</h2>
            <p className="text-gray-700">
              Сервис предоставляется «как есть» (as is). Исполнитель не несёт ответственности за:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1 text-gray-700">
              <li>упущенную выгоду или косвенные убытки Пользователя;</li>
              <li>потерю данных, возникшую по вине Пользователя (случайное удаление, компрометация пароля);</li>
              <li>недоступность сервиса, вызванную обстоятельствами непреодолимой силы (форс-мажор);</li>
              <li>действия третьих лиц, получивших доступ с использованием учётных данных Пользователя.</li>
            </ul>
            <p className="text-gray-700 mt-3">
              Совокупная ответственность Исполнителя перед Пользователем по всем основаниям не может превышать
              суммы, фактически уплаченной за последние 3 (три) месяца подписки.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. Срок действия и расторжение</h2>
            <p className="text-gray-700">
              Договор вступает в силу с момента акцепта (регистрации) и действует бессрочно до его расторжения
              одной из сторон.
            </p>
            <p className="text-gray-700 mt-3">
              Пользователь вправе расторгнуть договор в любое время, направив уведомление на {CONTACT_EMAIL}.
              Исполнитель вправе расторгнуть договор в одностороннем порядке при систематическом нарушении
              Пользователем условий оферты, уведомив его за 5 рабочих дней.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">9. Применимое право и споры</h2>
            <p className="text-gray-700">
              Договор регулируется законодательством Республики Казахстан. Все споры решаются путём переговоров.
              При невозможности достижения соглашения спор передаётся в суд по месту нахождения Исполнителя.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">10. Изменение условий</h2>
            <p className="text-gray-700">
              Исполнитель вправе изменять условия настоящей оферты, уведомив Пользователя по электронной почте
              не менее чем за 15 (пятнадцать) дней до вступления изменений в силу. Продолжение использования
              сервиса после вступления изменений в силу означает акцепт новых условий.
            </p>
          </section>

          {/* Реквизиты */}
          <section className="border-t border-gray-100 pt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Реквизиты Исполнителя</h2>
            <div className="bg-gray-50 rounded-xl p-5 space-y-2 text-sm text-gray-700">
              <p><span className="font-medium">Наименование:</span> {COMPANY_NAME}</p>
              <p><span className="font-medium">БИН/ИИН:</span> {COMPANY_BIN}</p>
              <p><span className="font-medium">Юридический адрес:</span> {COMPANY_ADDR}</p>
              <p><span className="font-medium">Email:</span> {CONTACT_EMAIL}</p>
              <p className="text-xs text-gray-400 pt-2">
                * Поля в скобках заполняются после регистрации юридического лица
              </p>
            </div>
          </section>

        </div>

        {/* Подвал */}
        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <p>© {new Date().getFullYear()} {SERVICE_NAME}. Все права защищены.</p>
          <div className="flex gap-6">
            <Link to="/oferta" className="hover:text-gray-600 transition-colors font-medium text-gray-600">Оферта</Link>
            <Link to="/privacy" className="hover:text-gray-600 transition-colors">Политика конфиденциальности</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
