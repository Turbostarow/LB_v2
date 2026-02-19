import dotenv from 'dotenv';
import DiscordIntegration from './discord.js';
import { parseMultipleUpdates, sortPlayers } from './parser.js';
import { decodeState, upsertPlayer } from './storage.js';
import { renderLeaderboard, validateMessageLength, truncateIfNeeded } from './renderer.js';

dotenv.config();

/**
 * Main Sync Script for Multi-Game Leaderboards
 */

class LeaderboardSync {
  constructor() {
    this.discord = null;
    this.games = [];
    this.persistentMessageIds = new Map();
  }

  async initialize() {
    console.log('🚀 Initializing Multi-Game Leaderboard Sync...\n');

    this.validateEnvironment();

    this.discord = new DiscordIntegration(process.env.DISCORD_BOT_TOKEN);
    await this.discord.connect();

    this.loadGameConfigurations();

    console.log('✓ Initialization complete\n');
  }

  validateEnvironment() {
    const required = ['DISCORD_BOT_TOKEN'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  loadGameConfigurations() {
    console.log('📋 Loading game configurations...');

    const gameTypes = {
      'MARVEL_RIVALS': 'Marvel Rivals',
      'OVERWATCH': 'Overwatch',
      'DEADLOCK': 'Deadlock'
    };

    for (const [gameKey, gameName] of Object.entries(gameTypes)) {
      const channelId = process.env[`GAME_${gameKey}_CHANNEL_ID`];
      const webhookUrl = process.env[`GAME_${gameKey}_WEBHOOK_URL`];
      const messageId = process.env[`GAME_${gameKey}_MESSAGE_ID`];

      if (!channelId || !webhookUrl) {
        console.warn(`⚠️  Incomplete configuration for ${gameName}, skipping`);
        continue;
      }

      this.games.push({
        type: gameKey,
        name: gameName,
        channelId,
        webhookUrl,
        persistentMessageId: messageId || null
      });

      console.log(`  ✓ ${gameName}: Channel ${channelId}`);
    }

    if (this.games.length === 0) {
      throw new Error('No valid game configurations found');
    }

    console.log(`\n✓ Loaded ${this.games.length} game(s)\n`);
  }

  async syncGame(game) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎮 Syncing ${game.name}...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Fetch current state
    console.log(`📥 Fetching current leaderboard state...`);
    let currentState = { gameType: null, lastProcessedMessageId: null, players: [] };
    let persistentMessageId = game.persistentMessageId;

    if (persistentMessageId) {
      const messageContent = await this.discord.fetchWebhookMessage(
        game.webhookUrl,
        persistentMessageId
      );

      if (messageContent) {
        currentState = decodeState(messageContent);
        console.log(`   Found ${currentState.players.length} existing players`);
        console.log(`   Last processed: ${currentState.lastProcessedMessageId || 'none'}`);
      } else {
        console.log(`   Message not found, starting fresh`);
        persistentMessageId = null;
      }
    } else {
      console.log(`   No persistent message ID, starting fresh`);
    }

    // Fetch new messages
    console.log(`\n📨 Fetching new messages...`);
    const maxMessages = parseInt(process.env.MAX_MESSAGES_PER_SYNC || '100', 10);
    const messages = await this.discord.fetchMessages(
      game.channelId,
      currentState.lastProcessedMessageId,
      maxMessages
    );

    if (messages.length === 0) {
      console.log('   No new messages');
      return { processed: 0, updated: 0, failed: 0, skipped: 0 };
    }

    // Parse messages
    console.log(`\n🔍 Parsing messages...`);
    const parseResults = parseMultipleUpdates(messages, game.type);
    
    console.log(`   Successful: ${parseResults.successful.length}`);
    console.log(`   Failed: ${parseResults.failed.length}`);
    console.log(`   Skipped: ${parseResults.skipped}\n`);

    // Process updates
    let players = [...currentState.players];
    let updatedCount = 0;
    let lastMessageId = currentState.lastProcessedMessageId;

    for (const update of parseResults.successful) {
      try {
        const result = upsertPlayer(players, update.data);
        players = result.players;

        if (result.updated) {
          updatedCount++;
          console.log(`   ✓ Updated ${update.data.userId}`);
        } else {
          console.log(`   ⊘ Skipped older data for ${update.data.userId}`);
        }

        lastMessageId = update.messageId;
      } catch (error) {
        console.error(`   ✗ Error processing update:`, error.message);
      }
    }

    // Sort players
    const sortedPlayers = sortPlayers(players, game.type);

    // Render leaderboard
    console.log(`\n📊 Rendering leaderboard...`);
    
    let content = renderLeaderboard(game.name, sortedPlayers, lastMessageId, game.type);
    
    if (!validateMessageLength(content)) {
      console.warn('⚠️  Message too long, truncating...');
      const truncated = truncateIfNeeded(game.name, sortedPlayers, lastMessageId, game.type);
      content = truncated.content;
      if (truncated.truncated) {
        console.warn(`⚠️  Showing ${truncated.shownCount} of ${sortedPlayers.length} players`);
      }
    }

    // Update webhook
    const result = await this.discord.upsertLeaderboardMessage(
      game.webhookUrl,
      persistentMessageId,
      content
    );

    if (result.action === 'created') {
      console.log(`✓ Created new message: ${result.messageId}`);
      console.log(`💡 Add to .env: GAME_${game.type}_MESSAGE_ID=${result.messageId}`);
      this.persistentMessageIds.set(game.type, result.messageId);
    } else {
      console.log(`✓ Updated leaderboard`);
    }

    return {
      processed: messages.length,
      updated: updatedCount,
      failed: parseResults.failed.length,
      skipped: parseResults.skipped,
      totalPlayers: sortedPlayers.length
    };
  }

  async syncAll() {
    const results = {
      totalProcessed: 0,
      totalUpdated: 0,
      totalFailed: 0,
      totalSkipped: 0,
      games: []
    };

    for (const game of this.games) {
      try {
        const gameResults = await this.syncGame(game);
        
        results.totalProcessed += gameResults.processed;
        results.totalUpdated += gameResults.updated;
        results.totalFailed += gameResults.failed;
        results.totalSkipped += gameResults.skipped;
        
        results.games.push({
          name: game.name,
          ...gameResults
        });
      } catch (error) {
        console.error(`\n❌ Error syncing ${game.name}:`, error.message);
        results.games.push({
          name: game.name,
          error: error.message
        });
      }
    }

    return results;
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    if (this.discord) {
      await this.discord.disconnect();
    }

    console.log('✓ Cleanup complete');
  }

  printSummary(results) {
    console.log('\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 SYNC SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total Messages: ${results.totalProcessed}`);
    console.log(`Total Updates: ${results.totalUpdated}`);
    console.log(`Total Failed: ${results.totalFailed}`);
    console.log(`Total Skipped: ${results.totalSkipped}`);
    console.log('');
    
    results.games.forEach(game => {
      if (game.error) {
        console.log(`❌ ${game.name}: ${game.error}`);
      } else {
        console.log(`✓ ${game.name}: ${game.updated} updates, ${game.totalPlayers} players`);
      }
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (this.persistentMessageIds.size > 0) {
      console.log('💡 New messages created. Add to .env or GitHub Secrets:');
      for (const [gameType, messageId] of this.persistentMessageIds.entries()) {
        console.log(`   GAME_${gameType}_MESSAGE_ID=${messageId}`);
      }
      console.log('');
    }
  }
}

async function main() {
  const sync = new LeaderboardSync();

  try {
    await sync.initialize();
    const results = await sync.syncAll();
    sync.printSummary(results);
    
    await sync.cleanup();
    
    const hasErrors = results.games.some(g => g.error);
    process.exit(hasErrors ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    
    await sync.cleanup();
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default LeaderboardSync;
