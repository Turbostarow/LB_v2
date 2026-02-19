/**
 * Leaderboard Renderer Module
 * Formats leaderboard data with stylized output and relative time
 */

import { encodeState } from './storage.js';

/**
 * Get relative time string (e.g., "2 days ago", "5 minutes ago")
 */
function getRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return diffSeconds === 1 ? '1 second ago' : `${diffSeconds} seconds ago`;
  } else if (diffMinutes < 60) {
    return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  } else if (diffDays < 7) {
    return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  } else if (diffWeeks < 4) {
    return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  } else if (diffMonths < 12) {
    return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  } else {
    return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
  }
}

/**
 * Get rank emoji based on rank name
 */
function getRankEmoji(rankName) {
  const rank = rankName.toLowerCase();
  
  const rankEmojis = {
    // Marvel Rivals
    'bronze': '🟫',
    'silver': '⚪',
    'gold': '🟡',
    'platinum': '🔵',
    'diamond': '💎',
    'grandmaster': '👑',
    'celestial': '✨',
    'eternity': '♾️',
    'one above all': '🌟',
    
    // Overwatch
    'master': '🎖️',
    'champion': '🏆',
    'top 500': '⭐',
    
    // Deadlock
    'initiate': '🔰',
    'seeker': '🔍',
    'alchemist': '⚗️',
    'arcanist': '🔮',
    'ritualist': '📿',
    'emissary': '💼',
    'archon': '👤',
    'oracle': '🧙',
    'phantom ascendant': '👻',
    'eternus': '♾️'
  };

  return rankEmojis[rank] || '🔹';
}

/**
 * Format rank display with tier
 */
function formatRank(rankObj) {
  if (!rankObj) return 'Unknown';
  return `${rankObj.rank} ${rankObj.tier}`;
}

/**
 * Render a single player entry for Marvel Rivals or Overwatch
 */
function renderMRorOWEntry(player, gameType) {
  const emoji = getRankEmoji(player.currentRank.rank);
  const peakEmoji = getRankEmoji(player.peakRank.rank);
  const relativeTime = getRelativeTime(player.lastUpdated);
  
  const currentRankDisplay = formatRank(player.currentRank);
  const peakRankDisplay = formatRank(player.peakRank);
  
  const valueLabel = gameType === 'OVERWATCH' ? 'SR' : 'RR';
  
  return `<@${player.userId}>  •  ${player.role}  •  ${emoji} ${currentRankDisplay} (${player.currentValue} ${valueLabel})  •  Peak: ${peakEmoji} ${peakRankDisplay} ${player.peakValue}  •  ${relativeTime}`;
}

/**
 * Render a single player entry for Deadlock
 */
function renderDeadlockEntry(player) {
  const emoji = getRankEmoji(player.currentRank.rank);
  const relativeTime = getRelativeTime(player.lastUpdated);
  
  const currentRankDisplay = formatRank(player.currentRank);
  
  return `<@${player.userId}>  •  ${player.heroName}  •  ${emoji} ${currentRankDisplay} (${player.currentValue} MMR)  •  ${relativeTime}`;
}

/**
 * Render complete leaderboard
 */
export function renderLeaderboard(gameName, players, lastProcessedMessageId, gameType, options = {}) {
  const {
    maxPlayers = 50
  } = options;

  const output = [];

  // Header
  output.push(`🏆 ${gameName.toUpperCase()} LEADERBOARD`);
  output.push('');

  // Check for empty leaderboard
  if (!players || players.length === 0) {
    output.push('No leaderboard data available.');
    output.push('');
    const prefix = gameType === 'MARVEL_RIVALS' ? 'LB_UPDATE_MR' : 
                   gameType === 'OVERWATCH' ? 'LB_UPDATE_OW' : 'LB_UPDATE_DL';
    output.push(`💡 Use \`${prefix}: @user ...\` to add entries.`);
  } else {
    // Render players
    const limitedPlayers = players.slice(0, maxPlayers);
    
    limitedPlayers.forEach((player) => {
      if (gameType === 'MARVEL_RIVALS' || gameType === 'OVERWATCH') {
        output.push(renderMRorOWEntry(player, gameType));
      } else if (gameType === 'DEADLOCK') {
        output.push(renderDeadlockEntry(player));
      }
    });
  }

  // Footer
  output.push('');
  output.push('━━━━━━━━━━━━━━━━━━');
  if (players && players.length > 0) {
    output.push(`📊 Total Players: ${players.length}`);
    if (players.length > maxPlayers) {
      output.push(`(Showing top ${maxPlayers})`);
    }
  }
  const now = new Date();
  output.push(`Last Updated: ${now.toUTCString()}`);
  output.push('');

  // Embed data section
  const dataSection = encodeState(lastProcessedMessageId, players, gameType);
  output.push(dataSection);

  return output.join('\n');
}

/**
 * Validate message fits Discord limits
 */
export function validateMessageLength(content) {
  const length = content.length;
  const MAX_LENGTH = 2000;
  
  if (length > MAX_LENGTH) {
    console.warn(`⚠️  Message exceeds Discord limit: ${length}/${MAX_LENGTH} characters`);
    return false;
  }
  
  return true;
}

/**
 * Truncate if needed
 */
export function truncateIfNeeded(gameName, players, lastProcessedMessageId, gameType, maxLength = 1900) {
  let rendered = renderLeaderboard(gameName, players, lastProcessedMessageId, gameType);
  
  if (rendered.length <= maxLength) {
    return { content: rendered, truncated: false };
  }

  // Try reducing player count
  let playerCount = Math.floor(players.length / 2);
  
  while (playerCount > 0) {
    rendered = renderLeaderboard(
      gameName, 
      players.slice(0, playerCount), 
      lastProcessedMessageId,
      gameType,
      { maxPlayers: playerCount }
    );
    
    if (rendered.length <= maxLength) {
      return { content: rendered, truncated: true, shownCount: playerCount };
    }
    
    playerCount = Math.floor(playerCount / 2);
  }

  rendered = renderLeaderboard(gameName, players.slice(0, 3), lastProcessedMessageId, gameType);
  return { content: rendered, truncated: true, shownCount: 3 };
}

export default {
  renderLeaderboard,
  validateMessageLength,
  truncateIfNeeded
};
