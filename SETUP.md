# KapeKonek — Setup Guide (Claude Code in the VS Code terminal)

This guide takes you from an empty folder to Claude Code building KapeKonek Phase 1 so it matches the approved Claude Design screens.

---

## 1. What's in this kit

```
kapekonek/
├── CLAUDE.md                     rules Claude Code reads every session
├── SETUP.md                      this guide (accounts, tools, skills)
├── BUILD-GUIDE.md                step-by-step build, milestone by milestone
└── docs/
    ├── PRODUCT-SPEC.md           what to build (roles, data, API, pages, seeds)
    ├── PHASE-2-SPEC.md           the dashboard: farmer, Group Manager, Kaluppa
    ├── DESIGN.md                 how it looks (tokens, components, screen → route map)
    ├── design/
    │   ├── README.md
    │   └── screens/              the 20 approved screens from Claude Design (+ canvas.json)
    └── prompts/
        └── PHASE-1-PROMPT.md     the build prompt (milestones M0–M7)
```

The canvas these screens came from: https://claude.ai/artifact/4KyhXQ9d8BtaDgg61uLz3h

## 2. Install these first

| Tool | Why | Check |
|---|---|---|
| Node.js 22 LTS | runs both apps | `node -v` |
| Git | version control | `git --version` |
| VS Code | editor + terminal | — |
| Python 3.10+ | graphify skill | `python --version` |
| uv | browser-use skill | `uv --version` (install from docs.astral.sh/uv) |
| A Claude subscription (Pro/Max) or Anthropic Console account | Claude Code login | — |

## 3. Create these accounts (free tiers are enough)

| Service | What to copy into `backend/.env` / `frontend/.env` |
|---|---|
| **MongoDB Atlas** | Create an M0 cluster and a database user. Under Network Access, allow `0.0.0.0/0` (needed for Render). Copy the connection string, adding `/kapekonek` before the `?`, into `MONGO_URI`. |
| **Aiven for Valkey** | Free plan. Copy host, port and password into `VALKEY_HOST`, `VALKEY_PORT`, `VALKEY_PASSWORD`, and keep `VALKEY_TLS=true`. |
| **Cloudinary** | Cloud name, API key, API secret. `CLOUDINARY_ROOT_FOLDER=kapekonek`. |
| **Brevo** | API key and a **verified sender** email for `EMAIL_FROM`. Optional during development: use `MAIL_TRANSPORT=log` and emails are written to `backend/storage/mail/`. |
| **Mapbox** | Two tokens. (1) A **public** token (`pk.…`) for `VITE_MAPBOX_TOKEN`, restricted to your local and Vercel URLs in the Mapbox dashboard; it shows the maps. (2) A **separate** token for `MAPBOX_ACCESS_TOKEN` in `backend/.env`, with no URL restriction and never shared with the frontend; the backend uses it for road distance (delivery fee) and address lookups. Mapbox's free tier is enough for development. |
| **Kaluppa orders inbox** | An email address for `KALUPPA_ORDERS_EMAIL`, which receives a notice for every new order. |

Generate the two JWT secrets with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 4. Make the project folder

1. Create a folder named `kapekonek` and copy everything from this kit into it.
2. Unzip `AgriCentral-main.zip` and copy its `backend` and `frontend` folders into `kapekonek/_reference/`, so you have `kapekonek/_reference/backend/` and `kapekonek/_reference/frontend/`. Delete any `node_modules` inside them.

Your folder should look like:
```
kapekonek/
├── CLAUDE.md
├── SETUP.md
├── docs/…
└── _reference/
    ├── backend/
    └── frontend/
```

## 5. Install Claude Code and open it in the VS Code terminal

1. Open the `kapekonek` folder in VS Code (**File › Open Folder**).
2. Open the terminal: **Terminal › New Terminal** (or <kbd>Ctrl</kbd>+<kbd>`</kbd>).
3. Install Claude Code (native installer, updates itself):
   - **macOS / Linux / WSL**
     ```bash
     curl -fsSL https://claude.ai/install.sh | bash
     ```
   - **Windows PowerShell**
     ```powershell
     irm https://claude.ai/install.ps1 | iex
     ```
   Then open a **new** terminal and check: `claude --version`.
   On native Windows, install Git for Windows too so Claude Code can use Bash.
4. Start it inside the project:
   ```bash
   claude
   ```
   Log in when asked. Claude Code automatically reads `CLAUDE.md`.

> Prefer a panel instead of the terminal? Install the **Claude Code** extension from the VS Code Extensions view. It uses the same project, `CLAUDE.md` and skills. Everything below works in both.

## 6. Install the skills

Run the `/plugin` lines **inside Claude Code**, and the others in a **regular terminal** in the `kapekonek` folder (open a second terminal tab with the **+** button).

**Inside Claude Code**
```
/plugin install superpowers@claude-plugins-official
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
/plugin marketplace add lackeyjb/playwright-skill
/plugin install playwright-skill@playwright-skill
```

**In a terminal (project folder)**
```bash
# impeccable (frontend design polish)
npx -y skills add pbakaus/impeccable --agent claude-code

# taste (design review)
npx -y skills add leonxlnx/taste-skill --skill design-taste-frontend --agent claude-code

# browser-use (browser automation)
uv tool install browser-use
browser-use skill install

# graphify (codebase knowledge graph)
pip install graphifyy
graphify install
```

**playwright-skill one-time setup**

macOS / Linux / Git Bash:
```bash
cd ~/.claude/plugins/marketplaces/playwright-skill/skills/playwright-skill && npm run setup && cd -
```
Windows PowerShell (5.1 doesn't support `&&`, so run the lines one at a time):
```powershell
Push-Location "$HOME\.claude\plugins\marketplaces\playwright-skill\skills\playwright-skill"
npm run setup
Pop-Location
```
If that folder doesn't exist, find it with:
```powershell
Get-ChildItem "$HOME\.claude\plugins" -Recurse -Filter package.json -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like "*playwright-skill*" } | Select-Object -ExpandProperty DirectoryName
```

Restart Claude Code (`/exit`, then `claude`). Type `/` and you should see commands such as `/impeccable`, `/ponytail` and `/graphify`.

> Skill install commands change over time. If one fails, open that skill's GitHub page (obra/superpowers, DietrichGebert/ponytail, pbakaus/impeccable, Leonxlnx/taste-skill, browser-use/browser-use, lackeyjb/playwright-skill, safishamsi/graphify) and use its current README command.

## 7. Start the build

> **Done with steps 1–6? Follow `BUILD-GUIDE.md` from here.** It has the full step-by-step, with the exact message to send for every milestone. The short version follows.


Paste this as your **first message** to Claude Code:

```
Read CLAUDE.md, docs/PRODUCT-SPEC.md, docs/DESIGN.md and docs/prompts/PHASE-1-PROMPT.md.
The approved UI is in docs/design/screens/ (exported from Claude Design). Every page must
match its screen exactly: layout, spacing, sizes, colors, copy and states.
Use superpowers to write the plan to docs/plans/phase-1.md, show me a summary of the plan,
then start Milestone 0. Stop after M0 so I can fill in the .env files.
```

What happens next:
1. Claude writes the plan and scaffolds the project (M0). It asks your permission before running commands. Approve the installs.
2. When it stops, copy `backend/.env.example` → `backend/.env` and `frontend/.env.example` → `frontend/.env`, then fill in the values from step 3.
3. Tell it: `Env is ready. Continue with M1.`

### Keep each milestone fresh

Long sessions drift. After each milestone is committed, run `/clear` and send:
```
Continue KapeKonek Phase 1 from docs/plans/phase-1.md. Start Milestone M<N>.
Re-read CLAUDE.md and the relevant screens in docs/design/screens/ first.
```

## 8. Getting the design copied exactly

The screens are already in the repo, so Claude Code works from the real design source:

- Each `docs/design/screens/<Name>.dc.html` contains the exact pixel values (inline styles), the copy, the sample data and the interactions. `docs/DESIGN.md` §1 tells Claude how to read them, and §5 maps each screen to a route.
- The build prompt makes Claude compare its pages with Playwright screenshots after every milestone.

**To check or fix a single page**, point Claude at the screen file with `@`:
```
Compare the /products page with @docs/design/screens/Products.dc.html at 1440px and 390px.
List every difference (spacing, font sizes, colors, borders, copy, states), then fix them.
```

**For even tighter matching (optional):** if your canvas lets you export screens as images, save them as `docs/design/png/<Name>.png` (e.g. `Main.png`, `Products.png`) and say:
```
Use the PNGs in docs/design/png/ as the visual reference. Screenshot each page with Playwright
at the same width and fix anything that doesn't match.
```

**If you change the design later:** edit the canvas, re-download the changed `.dc.html` files into `docs/design/screens/` (or ask Claude in claude.ai to export them for you), then tell Claude Code: `The design for <Screen> changed. Update the page to match the new file.`

## 9. Run the app yourself

```bash
npm run setup                          # install both apps
cd backend
npm run migrate:fresh -- --seed        # reset + seed the database
cd ..
npm run dev                            # backend + frontend
```

Open the frontend URL Vite prints (usually http://localhost:5173).

Seed logins use password **`KapeKonek@123`** and Gmail addresses. Set `SEED_EMAIL_BASE=yourname@gmail.com` in `backend/.env` to make them `yourname+<handle>@gmail.com` (all mail reaches you). Otherwise they're `kapekonek.<handle>@gmail.com`, and emails to them are only logged. You can also sign in with the username.

| Handle (username) | Lands on |
|---|---|
| `buyer` | storefront `/` |
| `buyer.unverified` | verify-email page |
| `kaluppa` | Kaluppa dashboard |
| `manager.santacruz` | Group Manager dashboard |
| `farmer.approved` / `farmer.pending` / `farmer.new` / `farmer.nomail` | farmer dashboard (see PHASE-2-SPEC §8) |

To move test orders through their statuses before the Kaluppa screens exist, ask Claude Code: `Show me curl commands to log in as Kaluppa and move order KK-… to reserved, processing, out_for_delivery (with a rider) and sold.`

## 10. Deploying (when Phase 1 is done)

- **Backend → Render** (Web Service):
  - root directory `backend`; build `npm ci`; start `npm start`; health check path `/api/health`;
  - set every backend env var, with `NODE_ENV=production` and `CLIENT_URL=https://<your-vercel-app>`;
  - the email worker and the expiry scheduler run inside this one service.
- **Frontend → Vercel**: root directory `frontend`; set `VITE_API_URL`, `VITE_SOCKET_URL` (the Render URL) and `VITE_MAPBOX_TOKEN`.
- **Cookies across domains**: production cookies are `Secure; SameSite=None`. Some browsers (Safari) limit third-party cookies, so for the most reliable logins, put both on one domain later (e.g. `kapekonek.com` and `api.kapekonek.com`).
- **Render free tier** sleeps when idle. The first request wakes it, and the scheduler resumes on boot. Atlas Network Access must allow Render's outbound IPs (or `0.0.0.0/0`).

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| `claude` not found | Open a new terminal; see https://code.claude.com/docs/en/troubleshoot-install |
| Valkey connection errors | Check `VALKEY_TLS=true` for Aiven (`false` for a local `valkey/valkey` Docker container) |
| Emails not arriving | Use `MAIL_TRANSPORT=log` to confirm the queue works, then check the Brevo sender is verified |
| Map is blank | `VITE_MAPBOX_TOKEN` missing, or not allowed for this URL in Mapbox |
| Delivery fees look rough / `distanceSource: fallback` | `MAPBOX_ACCESS_TOKEN` missing or invalid in `backend/.env`; the app is using the straight-line fallback |
| Logged out after refresh in production | Cookie domain/SameSite issue; see Deploying |
| Page doesn't look like the design | Run the "Compare … with @docs/design/screens/…" prompt in §8 |

## Claude Code docs

- Overview and install: https://code.claude.com/docs/en/overview
- VS Code: https://code.claude.com/docs/en/vs-code
- CLAUDE.md and memory: https://code.claude.com/docs/en/memory
