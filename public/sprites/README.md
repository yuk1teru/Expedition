# Спрайти

Картинки для шару спрайтів (ROADMAP 19.1). Гра малює картинку замість кодового малюнка, якщо вона є **і** записана в `index.json`.

- Шлях: `sprites/<вид>/<id>.png`, наприклад `sprites/enemy/wolf.png`, `sprites/boss/enat.png`, `sprites/hero/warrior.png`.
- Види, розміри й список id — `src/data/sprites.ts`; промпти для генерації — `docs/ART_PROMPTS.md` (`npm run art-prompts`).
- `index.json` — масив шляхів, що існують: `["sprites/enemy/wolf.png"]`.
- Вигляд згори, PNG з прозорим фоном; ті, що повертаються (герой, вороги, боси), намальовані «обличчям праворуч».
