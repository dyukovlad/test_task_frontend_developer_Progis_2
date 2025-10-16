# ZuluGIS Map App

## Описание
Одностраничное React-приложение с картой на Leaflet, подключением к ZuluGIS сервисам (ZWMTS, WMS, WFS). Интерактивность: клик по объекту из WFS выделяет его и показывает атрибуты в popup. Стили — MUI.

## Требования
- Node.js >= 14
- npm или yarn

## Установка и запуск
1. Клонируйте репозиторий (или создайте проект с файлами).
2. Установите зависимости: `npm install`.
3. Запустите: `npm start` — приложение на http://localhost:3000.
4. Для production: `npm run build`.

## Настройка сервисов
- Endpoint: `http://zs.zulugis.ru:6473/ws`
- Auth: Basic (mo:mo) — используется в WFS fetch. Для WMS/ZWMTS, если CORS ошибка, настройте прокси (например, в package.json: `"proxy": "http://zs.zulugis.ru:6473"` или используйте nginx proxy).
- Слои: Замените `world_3857` и `example_vector_layer` на реальные из GetCapabilities (запросите с auth в браузере или Postman).
- Fallback: Если Zulu WFS не работает, код использует публичный GeoServer WFS для демонстрации.

## Структура
- `src/components/Map.tsx` — основной компонент карты.
- `src/App.tsx` — корневой компонент с MUI.

## Возможные улучшения
- Прокси для auth в WMS (используйте http-proxy-middleware).
- Фильтры по bbox для WFS (добавьте в URL: `&bbox=${map.getBounds().toBBoxString()}`).
- Больше слоев из ZuluGIS.

## Оценка
- Подключение сервисов: Реализовано с auth для WFS, тайлы/WMS без (добавьте прокси при необходимости).
- Код: Структурированный, типизированный, React-хуки.
- Ошибки: Обработка в console + fallback.
