# 🎮 Multi-Game Discord Leaderboard System

Production-grade leaderboard system for **Marvel Rivals**, **Overwatch**, and **Deadlock** with stateless message-based storage.

## 🌟 Features

- **3 Games Supported**: Marvel Rivals, Overwatch, Deadlock
- **No Database**: Uses Discord messages for storage
- **Auto-Sync**: Updates every 15 minutes via GitHub Actions
- **Relative Time**: Shows "2 days ago" instead of static dates
- **Stylized Output**: Clean, professional formatting
- **Game-Specific Ranking**: Each game has its own ranking system and tiers

---

## 📝 Message Formats

### Marvel Rivals
```
LB_UPDATE_MR: @PlayerName role Rank_current current_value rank_peak peak_value date
```

**Example:**
```
LB_UPDATE_MR: @Turbo Duelist Diamond 2 2450 Master 1 2610 2026-02-14
```

**Ranks** (3 tiers each: 3 → 2 → 1):
- Bronze → Silver → Gold → Platinum → Diamond → Grandmaster → Celestial → Eternity → One Above All

**Sorting**: rank_current → current_value (lower better) → rank_peak → peak_value → date

---

### Overwatch
```
LB_UPDATE_OW: @PlayerName role Rank_current current_value rank_peak peak_value date
```

**Example:**
```
LB_UPDATE_OW: @Alpha Tank Diamond 3 3200 Master 2 3400 2026-02-14
```

**Ranks** (5 tiers: 5 → 4 → 3 → 2 → 1, Top 500: 500 → 1):
- Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster → Champion → Top 500

**Sorting**: rank_current → current_value (lower better) → rank_peak → peak_value → date

---

### Deadlock
```
LB_UPDATE_DL: @PlayerName hero_name Rank_current current_value date
```

**Example:**
```
LB_UPDATE_DL: @Player2 Haze Archon 4 1200 2026-02-14
```

**Ranks** (6 tiers: 1 → 2 → 3 → 4 → 5 → 6):
- Initiate → Seeker → Alchemist → Arcanist → Ritualist → Emissary → Archon → Oracle → Phantom Ascendant → Eternus

**Sorting**: rank_current → current_value (lower better) → date

---

## 🎨 Output Format

```
@Turbo  •  Duelist  •  💎 Diamond 2 (2450 RR)  •  Peak: 👑 Master 1 2610  •  2 days ago
@Alpha  •  Tank  •  💎 Diamond 3 (3200 SR)  •  Peak: 🎖️ Master 2 3400  •  5 hours ago
@Player2  •  Haze  •  👤 Archon 4 (1200 MMR)  •  13 minutes ago
```

---

## 🚀 Setup Guide

### 1. Install Node.js (WSL/Linux)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should be v18+
```

### 2. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
npm install
```

### 3. Create Discord Bot

1. Go to https://discord.com/developers/applications
2. Create New Application → Add Bot
3. Enable **"Message Content Intent"** ✅
4. Copy bot token
5. Invite bot with permissions: Read Messages, Read Message History

### 4. Create Channels & Webhooks

For each game, create:

**Marvel Rivals:**
- Channel: `#marvel-rivals-leaderboard`
- Webhook: Right-click channel → Edit → Integrations → Webhooks → New Webhook
- Get Channel ID: Right-click channel → Copy Channel ID (Developer Mode must be ON)

**Overwatch:**
- Channel: `#overwatch-leaderboard`
- Webhook + Channel ID

**Deadlock:**
- Channel: `#deadlock-leaderboard`
- Webhook + Channel ID

### 5. Configure .env

```bash
cp .env.example .env
nano .env
```

Fill in your values:
```env
DISCORD_BOT_TOKEN=your_bot_token_here

GAME_MARVEL_RIVALS_CHANNEL_ID=1111111111
GAME_MARVEL_RIVALS_WEBHOOK_URL=https://discord.com/api/webhooks/...
# GAME_MARVEL_RIVALS_MESSAGE_ID= (leave blank)

GAME_OVERWATCH_CHANNEL_ID=2222222222
GAME_OVERWATCH_WEBHOOK_URL=https://discord.com/api/webhooks/...
# GAME_OVERWATCH_MESSAGE_ID= (leave blank)

GAME_DEADLOCK_CHANNEL_ID=3333333333
GAME_DEADLOCK_WEBHOOK_URL=https://discord.com/api/webhooks/...
# GAME_DEADLOCK_MESSAGE_ID= (leave blank)
```

### 6. Test Locally

Post test messages in each channel:

**#marvel-rivals-leaderboard:**
```
LB_UPDATE_MR: @YourName Duelist Diamond 2 2450 Master 1 2610 2026-02-18
```

**#overwatch-leaderboard:**
```
LB_UPDATE_OW: @YourName Tank Platinum 3 3100 Diamond 2 3300 2026-02-18
```

**#deadlock-leaderboard:**
```
LB_UPDATE_DL: @YourName Haze Archon 4 1200 2026-02-18
```

Run sync:
```bash
npm run sync
```

You should see:
```
✓ Created new message: 123456789
💡 Add to .env: GAME_MARVEL_RIVALS_MESSAGE_ID=123456789
```

Add the message IDs to .env:
```bash
nano .env
```

```env
GAME_MARVEL_RIVALS_MESSAGE_ID=123456789
GAME_OVERWATCH_MESSAGE_ID=987654321
GAME_DEADLOCK_MESSAGE_ID=555555555
```

Test again - should now say "Updated" instead of "Created".

### 7. Push to GitHub

```bash
git add .
git commit -m "Add multi-game leaderboard system"
git push origin main
```

### 8. Add GitHub Secrets

Go to: Repository → Settings → Secrets and variables → Actions

Add these **10 secrets**:

1. `DISCORD_BOT_TOKEN` - Your bot token

**Marvel Rivals:**
2. `GAME_MARVEL_RIVALS_CHANNEL_ID`
3. `GAME_MARVEL_RIVALS_WEBHOOK_URL`
4. `GAME_MARVEL_RIVALS_MESSAGE_ID`

**Overwatch:**
5. `GAME_OVERWATCH_CHANNEL_ID`
6. `GAME_OVERWATCH_WEBHOOK_URL`
7. `GAME_OVERWATCH_MESSAGE_ID`

**Deadlock:**
8. `GAME_DEADLOCK_CHANNEL_ID`
9. `GAME_DEADLOCK_WEBHOOK_URL`
10. `GAME_DEADLOCK_MESSAGE_ID`

### 9. Enable GitHub Actions

1. Go to Actions tab
2. Enable workflows
3. Click "Multi-Game Leaderboard Sync"
4. Run workflow manually to test

---

## 🎯 Usage

Users post updates in the appropriate channels:

**Marvel Rivals:**
```
LB_UPDATE_MR: @Player Vanguard Grandmaster 1 3200 Celestial 2 3500 2026-02-18
```

**Overwatch:**
```
LB_UPDATE_OW: @Player Support Master 1 3800 Grandmaster 5 4000 2026-02-18
```

**Deadlock:**
```
LB_UPDATE_DL: @Player Infernus Oracle 2 2100 2026-02-18
```

Leaderboards auto-update within 15 minutes!

---

## 📊 Leaderboard Example

```
🏆 MARVEL RIVALS LEADERBOARD

@Turbo  •  Duelist  •  💎 Diamond 2 (2450 RR)  •  Peak: 👑 Master 1 2610  •  2 hours ago
@Alpha  •  Vanguard  •  🔵 Platinum 1 (2100 RR)  •  Peak: 💎 Diamond 3 2300  •  1 day ago
@Beta  •  Strategist  •  🟡 Gold 2 (1800 RR)  •  Peak: 🔵 Platinum 2 1950  •  3 days ago

━━━━━━━━━━━━━━━━━━
📊 Total Players: 3
Last Updated: Thu, 18 Feb 2026 18:00:00 GMT
```

---

## ⚙️ Configuration

### Commands

```bash
npm install        # Install dependencies
npm run sync       # Run sync manually
npm run dev        # Development mode (auto-reload)
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_BOT_TOKEN` | Discord bot token | Yes |
| `GAME_*_CHANNEL_ID` | Discord channel ID per game | Yes |
| `GAME_*_WEBHOOK_URL` | Webhook URL per game | Yes |
| `GAME_*_MESSAGE_ID` | Leaderboard message ID | After first sync |
| `DISCORD_RATE_LIMIT_DELAY` | Delay between API calls (ms) | No (default: 1000) |
| `MAX_MESSAGES_PER_SYNC` | Max messages to fetch | No (default: 100) |

---

## 🔧 Troubleshooting

### "Missing access to channel"
**Solution:** Add bot to channel permissions with Read Messages enabled

### "Message Content Intent not enabled"
**Solution:** Enable in Discord Developer Portal → Bot → Privileged Gateway Intents

### "Invalid webhook URL"
**Solution:** Verify format: `https://discord.com/api/webhooks/ID/TOKEN`

### Parse errors
**Solution:** Check message format matches exactly (see examples above)

---

## 📚 Architecture

- **Stateless**: No database required
- **Message-as-Database**: Webhook messages store all data
- **Auto-Sync**: GitHub Actions runs every 15 minutes
- **Scalable**: Each game operates independently

---

## 🎮 Game-Specific Details

### Marvel Rivals
- **Value Label**: RR (Rank Rating)
- **Tiers**: 3, 2, 1 (1 is best in rank)
- **Emojis**: 🟫 Bronze, ⚪ Silver, 🟡 Gold, 🔵 Platinum, 💎 Diamond, 👑 Grandmaster, ✨ Celestial, ♾️ Eternity, 🌟 One Above All

### Overwatch
- **Value Label**: SR (Skill Rating)
- **Tiers**: 5, 4, 3, 2, 1 (1 is best in rank)
- **Special**: Top 500 shows number instead of tier
- **Emojis**: Same as MR plus 🎖️ Master, 🏆 Champion, ⭐ Top 500

### Deadlock
- **Value Label**: MMR
- **Tiers**: 1-6 (6 is best in rank)
- **No Peak Rank**: Only tracks current rank
- **Emojis**: 🔰 Initiate, 🔍 Seeker, ⚗️ Alchemist, 🔮 Arcanist, 📿 Ritualist, 💼 Emissary, 👤 Archon, 🧙 Oracle, 👻 Phantom Ascendant, ♾️ Eternus

---

**Built for competitive gaming communities** 🎮

No databases, no complexity—just pure Discord! 🚀
