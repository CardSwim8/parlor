# Parlor

Party games for one shared screen (a tablet on the table, a laptop, a TV). Plain HTML, CSS and
JavaScript with no build step. It works offline once it has been opened online, and it can be
added to a home screen.

| Game | Folder | What it is |
|---|---|---|
| **Tumbleword** | [`tumbleword/`](tumbleword/) | Shake 16 letter dice and find words in the 4×4 grid before time runs out. After the round, it lists every word on the board with its path and definition. |
| **Cover Story** | [`cover-story/`](cover-story/) | 25 word cards and one-word clues. **Teams:** two rival teams, each with a spymaster, race to find their agents while avoiding the assassin. **Duet:** two players work together. Each has their own side of the key, and together they must find all 15 agents within 9 turns (adjustable), or the game goes to sudden death. Keys open on the players' phones from the board's 5-letter code. Duet codes start with D, and the phone asks which side you are. |
| **Triad** | [`triad/`](triad/) | 81 cards, each with a count, shape, shading and colour. Three cards make a triad when each of those is all the same or all different. Players take turns with a short clock (30 s by default) to find one; a find scores a point and the three cards are replaced. Turns hand over without stopping: the next player's clock starts straight away, and the clock only stops for Pause or the end of the game. If there's no triad on the table, three more are dealt. Picking when time runs out gets a 0.8 s grace to finish. Scores stay hidden until the deck runs out and no triad is left. |

The games run the table: boards, timers, keys, checking answers. **Scores are kept off-screen**, on
paper or however the group likes. The exception is Triad, which counts each player's triads (shown when the game ends) because
its turns already know who's playing.

### On the shelf

These games are finished and work if you open their folder, but they aren't on the hub or cached
for offline use. To bring one back, add its folder name to `GAMES` in `index.html` and its files to
`sw.js`.

| Game | Folder | What it is |
|---|---|---|
| Slide Rule | [`slide-rule/`](slide-rule/) | Robots slide until they hit something; find the fewest moves to the target. Generated boards and a shortest-route finder. |
| Eyeful | [`eyeful/`](eyeful/) | A new busy picture and a letter each round; write down everything you spot. Shows every match at the end. |
| Ringmaster | [`ringmaster/`](ringmaster/) | Call the commands that rearrange three animals on two podiums to match a goal card; the app acts the call out. |
| Petri Dash | [`petri-dash/`](petri-dash/) | Follow an escaped amoeba round a ring of dishes, through vents and mutations, and tap where it ends up. |
| No Echo | [`no-echo/`](no-echo/) | Cooperative one-word clues where matching clues cancel out. |

## Layout

```
index.html              hub: lists the games in GAMES and loads each one's card
manifest.webmanifest    home-screen app settings (one app for all games)
sw.js                   offline cache; lists the files of the hub's games
icons/                  app icons (Parlor, plus one per game)
shared/
  theme.css             design tokens (Parlor's neutral look) + shared components that only read tokens
  core.js               Parlor.* helpers: randomness (incl. seeded), storage, countdown timer,
                        player-name list, scoreboard buttons, HTML escaping, sound, screen wake, offline
  words/nouns.js        shared word list (Cover Story, No Echo)
  vendor/               third-party libraries
<game>/                 every game folder has the same core files:
  index.html              the game (markup + game styles)
  brand.css               the game's design tokens
  card.html, card.css     its card on the hub
  <game>.js               the game's script
tumbleword/             + dictionary files
slide-rule/             + solver.js (background worker)
eyeful/                 + objects.js (emoji + names)
```

## Design: shared language, separate brands

All the games use the same components (top bar, tabs, segmented controls, steppers, buttons,
fields, tiles, board surface, popovers), and every component is styled only through the tokens
in `shared/theme.css`. Each game's `brand.css` sets those tokens under `html.brand-<game>`, so
the same controls take on the game's own colours, type and corner shapes:

- **Parlor** (landing page): warm paper, a serif wordmark, neutral controls. It switches to a
  dark version when the device is in dark mode.
- **Tumbleword**: a toy-box dice tray. Navy felt, cream dice, amber, Futura, rounded corners.
- **Cover Story**: a spy's desk. Charcoal room, green leather blotter, manila case-file cards,
  rubber-stamp red, typewriter headings, square corners.
- **Triad**: a Bauhaus poster. Off-white paper, a black board, coral, teal and mustard, geometric
  lettering. The cards use circles, triangles and squares.
- On the shelf: Slide Rule (drafting table), Eyeful (kaleidoscope picture book), Ringmaster (big
  top at night), Petri Dash (lab after hours), No Echo (sticky notes on violet).

Each game packages its own hub card. The hub only holds the card shell (`.game` in `index.html`)
and the list of games; for each one it loads `brand.css` and `card.css` and drops in `card.html`,
with the `brand-<game>` class making the card preview the game's own look.

## Adding a game

1. Make a folder `<game>/` with a `brand.css` (copy one, then change the token values) and an
   `index.html` with `<html class="brand-<game>">`. Link `../shared/theme.css`, then `brand.css`,
   and load `../shared/core.js` before the game's own script.
2. Build the page from the shared pieces: `.app`, `.bar` with a `.home` link back to `../`,
   `.setup` / `.controls` / `.row`, `.seg`, `.tabs`, `.stepper`, `.primary`, `.ghost`,
   `.tile`, `.title-tiles`, `.surface`, `.display`, `.label`, `.names` (with `Parlor.nameList`).
   In the page's own styles, use tokens (`--surface`, `--tile`, `--accent`, `--team-a`, `--r-md`,
   `--font-display` and so on) rather than hex values or pixel radii, so the brand stays in one file.
3. Save state with `Parlor.store("<game>")` so keys don't collide between games. Leave scorekeeping
   to the players.
4. End the script with `Parlor.registerOffline("../")`.
5. Add `card.html` (an `<a class="game brand-<game>">` with an `.art` block, `h2.display`, `p`,
   `.meta` and `.play`) and `card.css` for its art. Add the folder name to `GAMES` in `index.html`,
   add its files to `FILES` in `sw.js`, and bump `CACHE`.

## Credits

Tumbleword's word list and definitions come from Wiktionary (CC BY-SA 4.0), extracted by
Wiktextract / kaikki.org. Gzip decoding uses fflate (MIT). Shelved games that show emoji draw them
with the device's own emoji font; no emoji artwork is bundled. Game names, word lists and artwork
are original. Parlor is not affiliated with any game publisher.
