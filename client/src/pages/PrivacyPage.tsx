import { Link } from 'react-router-dom'
import { ArrowLeft, BarChart2 } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100 sticky top-0 bg-white/90 backdrop-blur z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">SalesPlatform</span>
          </div>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> На главную
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Политика конфиденциальности</h1>
        <p className="text-sm text-gray-400 mb-10">Дата вступления в силу: 1 января 2025 года</p>

        <div className="max-w-none space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">1. Общие положения</h2>
            <p>
              Настоящая Политика конфиденциальности (далее — «Политика») описывает, какие персональные данные
              собирает SalesPlatform (далее — «Оператор»), как они используются, хранятся и защищаются.
              Политика распространяется на всех пользователей сервиса SalesPlatform.
            </p>
            <p className="mt-3">
              Используя Сервис, вы выражаете согласие с условиями настоящей Политики.
              Если вы не согласны с её условиями, пожалуйста, прекратите использование Сервиса.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">2. Какие данные мы собираем</h2>
            <p className="font-medium text-gray-800 mb-2">Данные, которые вы предоставляете напрямую:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Имя и фамилия</li>
              <li>Адрес электронной почты</li>
              <li>Номер телефона (при указании)</li>
              <li>Название компании</li>
              <li>Данные об отделе продаж (планы, результаты, показатели)</li>
            </ul>
            <p className="font-medium text-gray-800 mb-2 mt-4">Данные, собираемые автоматически:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>IP-адрес и тип браузера</li>
              <li>Страницы Сервиса, которые вы посещаете</li>
              <li>Время и дата действий в Сервисе</li>
              <li>Технические данные устройства</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">3. Как мы используем данные</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Предоставление и улучшение функциональности Сервиса.</li>
              <li>Аутентификация пользователей и защита аккаунтов.</li>
              <li>Обработка платежей и выставление счетов.</li>
              <li>Отправка уведомлений, связанных с работой Сервиса.</li>
              <li>Техническая поддержка и ответы на запросы.</li>
              <li>Анализ использования для улучшения продукта (в обезличенном виде).</li>
            </ul>
            <p className="mt-3">
              Мы не используем ваши данные для продажи рекламы и не передаём их
              рекламным сетям.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">4. Хранение и защита данных</h2>
            <p>
              Данные хранятся на защищённых серверах с применением современных методов шифрования
              (TLS/HTTPS для передачи, шифрование на уровне базы данных для хранения).
              Мы проводим регулярное резервное копирование.
            </p>
            <p className="mt-3">
              Срок хранения данных — в течение всего срока действия договора и 1 год после его расторжения,
              если иное не предусмотрено законодательством Республики Казахстан.
            </p>
            <p className="mt-3">
              После истечения срока хранения данные удаляются или обезличиваются.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">5. Передача данных третьим лицам</h2>
            <p>Мы не продаём и не передаём ваши персональные данные третьим лицам, за исключением:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>
                <strong>Поставщики инфраструктуры</strong> — облачные провайдеры для хранения данных
                и обеспечения работы Сервиса (только в объёме, необходимом для оказания услуг).
              </li>
              <li>
                <strong>Платёжные системы</strong> — при обработке оплаты (данные карт нам не передаются).
              </li>
              <li>
                <strong>Требования законодательства</strong> — если это обязательно по закону или
                по запросу уполномоченных органов Республики Казахстан.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">6. Ваши права</h2>
            <p>Вы вправе в любой момент:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Запросить доступ к своим персональным данным.</li>
              <li>Исправить неточные или неполные данные.</li>
              <li>Запросить удаление своих данных (в разумных пределах, установленных законом).</li>
              <li>Экспортировать данные, внесённые в Сервис.</li>
              <li>Отозвать согласие на обработку данных, прекратив использование Сервиса.</li>
            </ul>
            <p className="mt-3">
              Для реализации прав направьте запрос на адрес: <strong>support@salesplatform.kz</strong>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">7. Cookies</h2>
            <p>
              Сервис использует cookies — небольшие текстовые файлы, сохраняемые в вашем браузере.
              Cookies применяются для:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-3">
              <li>Поддержания сессии авторизации (обязательные cookies).</li>
              <li>Сохранения пользовательских настроек (язык интерфейса и др.).</li>
            </ul>
            <p className="mt-3">
              Мы не используем рекламные или трекинговые cookies. Вы можете отключить cookies
              в настройках браузера, однако это может нарушить работу Сервиса.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">8. Дети</h2>
            <p>
              Сервис предназначен для использования лицами, достигшими 18 лет.
              Мы не собираем намеренно персональные данные лиц, не достигших этого возраста.
              Если вам стало известно о предоставлении несовершеннолетним своих данных, просим
              незамедлительно уведомить нас.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">9. Изменения в Политике</h2>
            <p>
              Оператор вправе периодически обновлять настоящую Политику. О существенных изменениях
              мы уведомим вас по электронной почте или через интерфейс Сервиса. Продолжение
              использования Сервиса после уведомления означает ваше согласие с обновлённой Политикой.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">10. Контакты</h2>
            <p>По вопросам, связанным с обработкой персональных данных, обращайтесь:</p>
            <ul className="list-none mt-3 space-y-1">
              <li><strong>Email:</strong> support@salesplatform.kz</li>
              <li><strong>Сайт:</strong> salesplatform.kz</li>
            </ul>
          </section>

        </div>
      </main>

      <footer className="border-t border-gray-100 py-6 px-6 mt-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-gray-400 flex-wrap gap-3">
          <span>© {new Date().getFullYear()} SalesPlatform. Все права защищены.</span>
          <div className="flex items-center gap-4">
            <Link to="/" className="hover:text-gray-700 transition-colors">На главную</Link>
            <Link to="/oferta" className="hover:text-gray-700 transition-colors">Оферта</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
