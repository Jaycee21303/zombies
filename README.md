# Classic Zombies Prototype

HTML5 + Three.js recreation of the classic Call of Duty Zombies loop. Runs fully in-browser with no build step.

## Getting Started
1. Open `index.html` in a modern browser. (If the browser blocks pointer lock from file URLs, serve the folder locally with a static server such as `python -m http.server`.)
2. Click **Start Match** and accept the pointer lock prompt.

## Controls
- **WASD**: Move
- **Shift**: Sprint
- **Mouse**: Look
- **Left Mouse**: Fire
- **R**: Reload (or restart when downed)
- **E**: Rebuild barricade when near a window
- **F**: Buy door or wall weapon when in range
- **1/2/3**: Equip pistol / SMG / rifle

## Gameplay Notes
- Numbered rounds with short downtime between waves.
- Zombies spawn predictably from fixed windows, break down barricades, and get faster/stronger every round.
- Points are awarded per hit, bonus per kill, and for rebuilding barricades. Use points to open the door and buy wall weapons.
- Weapons carry ammo limits, reload time, and damage falloff at higher rounds.
- Player health shows red damage flashes; going down prompts a restart to round 1.

## Folder Structure
- `index.html` – Entry page, HUD, and UI styling.
- `src/main.js` – Core gameplay, map layout, round and enemy logic, weapons, barricades, and controls.

This project is a private prototype intended solely for personal, non-commercial use.
