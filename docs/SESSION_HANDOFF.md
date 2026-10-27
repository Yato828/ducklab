# DUCKLAB — точка продолжения

Дата: 2026-10-27 (Europe/Minsk).

**Работа остановлена по просьбе пользователя, чтобы закоммитить и отправить текущий промежуточный результат в https://github.com/Yato828/ducklab.git. Это WIP, не законченный релиз.**

## Что читать сначала

1. `docs/REVISION_BRIEF.md` — полный последний запрос пользователя, главный источник требований. Он отменяет противоречащие пункты предыдущих брифов.
2. `docs/REVISION_PLAN.md` — план новой переработки.
3. Этот файл — фактическое состояние и следующий шаг.
4. `docs/GAME_BRIEF.md` и `docs/BUILD_BRIEF.md` — предыдущие требования, только исторический контекст.

Пользователь просит продолжать существующий проект, а не начинать заново. Не возвращаться к маркетплейсу, GPU training, AI Studio или multiplayer. Старые модули сохранены в `archive/platform/` и не входят в активную сборку.

## Что было до текущей переработки

Рабочая статическая игра React/Vite: оригинальная модель Microduck, MuJoCo WASM, ONNX Runtime Web, свободная площадка, короткая трасса с пятью воротами, секундомер по simulation time, localStorage PB, PNG/X sharing, Wallet Standard и проверка SPL balance для цветов. Светлый интерфейс. Исходные 87 файлов закреплены SHA-256 в `assets/microduck/manifest.json`.

Старый вариант прошёл 36 тестов, 3 браузерных сценария, сборку и отдельную production-проверку кошелька с явными fixtures. Это **исторические результаты**, а не подтверждение текущего WIP. Старые скриншоты в `tests/artifacts/` тоже относятся к светлой версии.

## Уже написано в новой версии

### Физическая трасса

`packages/game-core/src/course.js` заменён на `chaos-lab-v2`:

- Шесть комнат на маршруте примерно 12 метров: настоящий slalom, football, push box, sit platform, controlled roll, final corridor/left turn/finish.
- Общая геометрия для MuJoCo и Three.js, реальные стены/препятствия.
- Четыре закрытых выхода — mocap bodies `lock_football`, `lock_box`, `lock_sit`, `lock_roll`.
- Ball radius .04 m, mass .018 kg; cube half extent .045 m, mass .025 kg. Настройка mass/friction применяется только через `withCourse()`, оригинальные robot assets не изменены.
- Assistance: reset ball +10 s, reset cube +10 s, rescue robot к началу текущей комнаты +30 s.

`packages/game-core/src/trial.js`:

- Порядок шести этапов и финиш.
- Гол: пересечение линии реальной позицией мяча, внутри размеров ворот, после зарегистрированного контакта робота с мячом во время kick policy.
- Куб: физическая позиция всего куба в target плюс удержание и ограничение скорости.
- Сидение: реальная позиция, высота корпуса, ориентация и малая скорость, удержание 35 ticks.
- Перекат: внутри зоны, фактический наклон во время roll policy, затем устойчивое возвращение в upright.
- Таймер + отдельные штрафы/assist history, splits, completed flags, HUD event.
- PB ключ включает courseId и configId.

### Общий движок для будущего replay

Новый `packages/simulation-core/src/engine.js` извлекает реальные controller conventions в `PhysicsEngine`:

- Оригинальные 61D observations → 14 actions, 50 Hz, 4 × 5 ms MuJoCo steps.
- Walk, sit/stand, both kicks, roll, groundpick, recovery.
- Atomic actions, explicit object resets/rescue, gate opening from checked objective state.
- Sparse input log: команды (квантизированы до .001), действия, помощь, индекс simulation step.
- 45,000 ticks / 15 минут, до 20,000 events.
- `getRun()` доступен только после настоящего завершения.

Новый `packages/simulation-core/node/runtime.mjs` загружает тот же MuJoCo WASM и ONNX Runtime Web WASM под Node. Никакой подмены физики/native policy backend.

`packages/game-core/src/version.js` пока содержит **`development-v2`**. Это временный configId, не криптографическая фиксация. Не принимать его как production ranked configuration! Скрипт `scripts/pin-gameplay.mjs` ещё НЕ написан, хотя упомянут в комментарии файла.

### Фактически выполненная новая проверка

`node scripts/drive-course.mjs` успешно завершил весь новый физический маршрут:

- Simulation time **190.30 s = 03:10.30**.
- Все 6 checkpoints и все физические задачи завершены.
- Splits: 26.14, 73.68, 103.56, 124.98, 142.74, 183.20 s.
- Football actual goal 54.92 s; box settled 87.92 s; roll success 134.18 s.
- Assistance / penalties: 0.
- Во время полного прохождения скрипт отправляет только controller velocities/actions. Не телепортирует робота, мяч или куб.
- Сохранены input log, physical trace, final state и trial snapshot в `tests/artifacts/chaos-course.json` (~400 KB).
- Это автоматический headless reference run, **не измерение времени первого живого игрока** и не browser acceptance test.
- Первый запуск обнаружил ошибку только test helper: после реального finish двигатель правильно замер, а helper ждал следующую точку. В `go()` добавлена остановка при `trial.status === 'finished'`; повторный запуск прошёл.

`scripts/tune-challenges.mjs` — вспомогательные изолированные эксперименты с положением робота перед kick. В них есть прямой initial placement и установка stage для теста одной задачи; это НЕ ranked-run input и НЕ путь в gameplay. При full-course тесте эти упрощения не используются.

## ВАЖНО: что пока НЕ подключено / НЕ работает целиком

**Начать продолжение именно с подключения общего движка к browser worker.**

1. `packages/simulation-core/src/physics.worker.js` всё ещё старый, со своей копией controller loop. Он импортирует новую course/trial, но НЕ передаёт physical objective state и НЕ использует `PhysicsEngine`. Поэтому браузерная Time Trial сейчас не может правильно завершить новые задачи/открыть gates.
2. `packages/simulation-core/src/renderer.js` и `courseRenderer.js` всё ещё старые: маленький overview, светлая палитра, старый finish marking, отсутствие locked gate meshes и puzzle floor marks. Видимость props ограничена abs(x)<5 — исправить для новой длины.
3. `apps/web/src/pages/Playground.tsx`, controls, HUD и results всё ещё предыдущие. `R` сейчас restart; нужно `R` sit/stand, Q/E kicks, F roll и другая понятная кнопка restart. Добавить contextual action buttons для touch, assisted resets со штрафами, objective progress, YOUR BEST / WORLD BEST, submit state.
4. `packages/simulation-core/src/index.ts` ещё не расширен API `assist`/`getRun`.
5. Тёмный дизайн, новый hero SMALL DUCK. BIG CHAOS., Token page, Leaderboard page, новое меню — НЕ реализованы.
6. PostgreSQL leaderboard API / verification worker / schema / input validation / rate limits / status polling — НЕ реализованы. `apps/leaderboard/src` и `test` пока пустые папки, в git не попадут.
7. Авторитетный replay и сравнение browser vs Node численной детерминированности — НЕ реализованы / НЕ проверены. Никаких verified world records пока нет.
8. Roller assets и политики есть, но предыдущий активный движок никогда не поддерживал roller switching. Нужно изучить pinned upstream implementation, добавить безопасно только в Free Playground, если реально удаётся воспроизвести; не заявлять готовность без проверки.
9. README, SETUP, ARCHITECTURE, DEPLOYMENT и старые acceptance tests ещё описывают предыдущую игру. В README/TESTING добавлено предупреждение WIP, остальное требует обновления после реализации.

## Проверки именно этого snapshot

- `node scripts/drive-course.mjs`: **PASS**, реальный полный маршрут 190.30 simulation seconds.
- `npm run typecheck`: **FAIL**. Две TS18048 в `packages/game-core/test/trial.test.ts:6`: `trial.elapsed` possibly undefined после изменения JS class inference. Нужны явные defaults/annotations и обновление тестов.
- `npm test`: **FAIL**. Первый блок: 13 passed / 4 failed, старые ожидания о пяти воротах/координатах/завершении. Из-за `&&` блок physics tests в этом запуске не выполнялся. Не маскировать ошибки: обновить tests под новые mandatory physical conditions и hostile bypass cases.
- `npm run build`: после текущих изменений не запускался.
- Новый браузерный e2e: не запускался.
- Никаких серверов в этой сессии не запускали. На момент сохранения обнаружен PID 91713 на 127.0.0.1:5173, но он не был запущен текущей сессией — не останавливать чужой процесс автоматически.

## Последовательность продолжения

1. Сверить этот handoff с деревом файлов; пользователь мог изменить код после snapshot.
2. Подключить `PhysicsEngine` к существующему browser worker, сохранить request/reply API и renderer lifecycle. События должны применяться строго между ticks; command/action/reset logs имеют тот же порядок в браузере и replay.
3. Добавить `assist`, `getRun`, расширенные TrialState/diagnostics и визуальные gate states. Без движения объектов по frontend animation.
4. Переписать автоматические тесты на state-based objectives, order, failure conditions, explicit penalties, pause/restart, persisted config-specific PB. Сохранить старые geometry/policy regression tests.
5. Сделать config hash по исходникам gameplay/engine/observation, course/XML/mesh/policy assets и точным runtime versions. Browser log и verifier должны ссылаться на него. Исключить generated version.js из собственного hash; автоматически проверять drift.
6. Bounded replay validator: protocol/version, sorted steps, finite/clamped commands, permitted actions/reset kinds, size/event/tick limits. Никогда не принимать client time/flags. Replay до собственного finish и compute official ticks + penalties.
7. Node + PostgreSQL leaderboard: только минимальный сервис, persistent jobs + scores, isolated verification worker с timeout/memory bounds, limited concurrency, IP abuse protection и global queue cap, top 10/world best/version/status. Без wallet подписи использовать nickname, не выдавать чужой wallet address за подтверждённую identity.
8. Проверить exact replay в Node и numerical tolerance browser-vs-Node на реальном WASM. Только successful authoritative runs допускаются в WORLD BEST; если разные платформы расходятся — честно provisional status, не фальшивый античит.
9. Dark UI/environment, fullscreen/resize/camera, progress/room signage, goal sound по пользовательскому взаимодействию, result export и leaderboard flow.
10. Token configuration: project/ticker/real official X/Telegram/Pump.fun/Dexscreener URLs. Никаких выдуманных ссылок/contract/market stats. При пустом mint — COMING SOON. Wallet code `components/Wallet.tsx` + `packages/solana/src/balance.ts` переиспользовать.
11. Полный браузерный прогон, мобильные/планшетные layouts, реальные penalties, tests API abuse/persistence/restart, сборка, обновить docs с фактическими результатами.

## Окружение и ограничения

- Workspace `/Users/yato/duck`; Node 26.8.1 доступен, npm dependencies установлены.
- Google Chrome установлен; Playwright uses channel `chrome`.
- PostgreSQL 18 установлен в `/opt/homebrew/opt/postgresql@18`. Старый временный cluster `/private/tmp/ducklab-test-postgres` был остановлен раньше; можно создать отдельный test cluster/DB, не трогать чужую БД.
- Network / local listening / Chrome / writes to .git требуют sandbox escalation при необходимости. User явно авторизовал commit + push в указанный репозиторий.
- Не запускать новых subagents без явной авторизации пользователя или применимых AGENTS/skill instructions. Старые backend_marketplace/dsl_training_ai/simulation agents не участвуют.
- Рабочая копия изначально не была git repository; remote оказался пустым. Этот checkpoint создаёт main и первый commit; ничего не force-push и не переписывать чужую историю.
- `.env` отсутствует; `.env.example` содержит только публичные шаблонные значения. Cache `.upstream`, node_modules, dist, local DB/runtime files исключены. Scan известных форматов credentials не обнаружил совпадений.
- Коммерческая авторизация геометрии по-прежнему не предоставлена. Pinned RL README указывает CC BY-SA-NC на hardware design, software/policies Apache-2.0. Сохранить attribution и не заявлять права на коммерческое размещение.
- Реальный QUACK mint, project socials, production DB/hosting не предоставлены. Не запускать token/mainnet transactions, не придумывать конфигурацию.
