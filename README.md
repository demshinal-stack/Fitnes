# Jaylle fitness — дневник тренировок

PWA на React + TypeScript (Vite). Данные хранятся локально в браузере (localStorage), один пользователь.

- `npm run dev` — разработка
- `npm test` — тесты логики плана (`src/lib/plan.test.ts`)
- `npm run build` — PWA в `dist/` (подтягивает анимации из `/mnt/project-files/exercise-animations`)
- `npm run artifact` — версия для публикации на claude.ai в `dist-artifact/`

Где что лежит:
- `src/data/machines.ts` — тренажёры зала, упражнения, формулы подбора настроек по росту, инструкции
- `src/lib/plan.ts` — расписание, прогрессия (по умолчанию 3 × 15, вес +1 шаг раз в две недели, без разгрузок), перерасчёт по факту
- `src/components/ExerciseAnimation.tsx` — точка подключения SVG-анимаций (`public/animations/<id>.svg`)


Публикация: каждый пуш в `main` собирает приложение и выкладывает его на GitHub Pages (`.github/workflows/pages.yml`).
