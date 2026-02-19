/**
 * Message Parser Module
 * Parses Discord messages for Marvel Rivals, Overwatch, and Deadlock
 */

// Rank definitions for each game
const MARVEL_RIVALS_RANKS = [
  'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 
  'Grandmaster', 'Celestial', 'Eternity', 'One Above All'
];

const OVERWATCH_RANKS = [
  'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 
  'Master', 'Grandmaster', 'Champion', 'Top 500'
];

const DEADLOCK_RANKS = [
  'Initiate', 'Seeker', 'Alchemist', 'Arcanist', 'Ritualist',
  'Emissary', 'Archon', 'Oracle', 'Phantom Ascendant', 'Eternus'
];

/**
 * Extract Discord user ID from mention format
 */
function extractUserId(mention) {
  const match = mention.match(/<@!?(\d+)>/);
  return match ? match[1] : null;
}

/**
 * Parse flexible date formats
 */
function parseDate(dateString) {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Sanitize input
 */
function sanitize(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[<>'"`;()]/g, '').trim().substring(0, 200);
}

/**
 * Get rank numeric value for sorting (lower = better)
 * Format: "Diamond 2" -> {rank: 'Diamond', tier: 2}
 */
function parseRankWithTier(rankString, validRanks, maxTier) {
  const parts = rankString.trim().split(/\s+/);
  
  // Try to match rank name (could be multi-word like "One Above All" or "Phantom Ascendant")
  let rankName = null;
  let tier = null;
  
  // Check for multi-word ranks first
  for (let i = parts.length; i > 0; i--) {
    const candidate = parts.slice(0, i).join(' ');
    if (validRanks.some(r => r.toLowerCase() === candidate.toLowerCase())) {
      rankName = validRanks.find(r => r.toLowerCase() === candidate.toLowerCase());
      if (parts[i]) {
        tier = parseInt(parts[i], 10);
      }
      break;
    }
  }
  
  if (!rankName) return null;
  
  // Validate tier
  if (tier && (tier < 1 || tier > maxTier)) {
    tier = null;
  }
  
  return { rank: rankName, tier: tier || 1 };
}

/**
 * Get numeric rank value for sorting (lower number = better rank)
 */
function getRankSortValue(rankObj, validRanks, maxTier) {
  if (!rankObj) return 999999;
  
  const rankIndex = validRanks.findIndex(r => r.toLowerCase() === rankObj.rank.toLowerCase());
  if (rankIndex === -1) return 999999;
  
  // Formula: (rankIndex * maxTier) + (maxTier - tier + 1)
  // Example for Diamond 2 in Marvel Rivals (maxTier=3):
  // (4 * 3) + (3 - 2 + 1) = 12 + 2 = 14
  // Diamond 1 would be: (4 * 3) + (3 - 1 + 1) = 12 + 3 = 15
  // Lower tier number = better = higher sort value (but still worse than higher ranks)
  return (rankIndex * maxTier) + (maxTier - rankObj.tier + 1);
}

/**
 * Parse Marvel Rivals update
 * Format: LB_UPDATE_MR: @PlayerName role Rank_current current_value rank_peak peak_value date
 * Example: LB_UPDATE_MR: @Turbo Duelist Diamond 2 2450 Master 1 2610 2026-02-14
 */
export function parseMarvelRivals(messageContent) {
  if (!messageContent?.trim().startsWith('LB_UPDATE_MR:')) {
    return null;
  }

  const content = messageContent.trim().substring('LB_UPDATE_MR:'.length).trim();
  const parts = content.split(/\s+/);

  if (parts.length < 7) {
    console.warn('Invalid MR format: insufficient fields');
    return null;
  }

  const mention = parts[0];
  const userId = extractUserId(mention);
  if (!userId) {
    console.warn('Invalid MR format: invalid mention');
    return null;
  }

  const role = sanitize(parts[1]);
  
  // Find where current rank ends (look for number after rank)
  let currentRankEnd = 2;
  let currentRankParts = [parts[2]];
  
  // Handle multi-word ranks
  while (currentRankEnd < parts.length && isNaN(parseInt(parts[currentRankEnd], 10))) {
    currentRankParts.push(parts[currentRankEnd]);
    currentRankEnd++;
  }
  
  if (currentRankEnd >= parts.length) {
    console.warn('Invalid MR format: missing current value');
    return null;
  }
  
  const currentRankString = currentRankParts.join(' ');
  const currentRank = parseRankWithTier(currentRankString, MARVEL_RIVALS_RANKS, 3);
  if (!currentRank) {
    console.warn('Invalid MR format: invalid current rank');
    return null;
  }
  
  const currentValue = parseInt(parts[currentRankEnd], 10);
  if (isNaN(currentValue) || currentValue < 0) {
    console.warn('Invalid MR format: invalid current value');
    return null;
  }
  
  // Parse peak rank
  let peakRankStart = currentRankEnd + 1;
  let peakRankParts = [parts[peakRankStart]];
  let peakRankEnd = peakRankStart + 1;
  
  while (peakRankEnd < parts.length && isNaN(parseInt(parts[peakRankEnd], 10))) {
    peakRankParts.push(parts[peakRankEnd]);
    peakRankEnd++;
  }
  
  if (peakRankEnd >= parts.length) {
    console.warn('Invalid MR format: missing peak value');
    return null;
  }
  
  const peakRankString = peakRankParts.join(' ');
  const peakRank = parseRankWithTier(peakRankString, MARVEL_RIVALS_RANKS, 3);
  if (!peakRank) {
    console.warn('Invalid MR format: invalid peak rank');
    return null;
  }
  
  const peakValue = parseInt(parts[peakRankEnd], 10);
  if (isNaN(peakValue) || peakValue < 0) {
    console.warn('Invalid MR format: invalid peak value');
    return null;
  }
  
  // Everything else is the date
  const dateString = parts.slice(peakRankEnd + 1).join(' ');
  const parsedDate = parseDate(dateString);
  if (!parsedDate) {
    console.warn('Invalid MR format: invalid date');
    return null;
  }

  return {
    game: 'MARVEL_RIVALS',
    userId,
    role,
    currentRank,
    currentValue,
    peakRank,
    peakValue,
    lastUpdated: parsedDate,
    rawMention: mention
  };
}

/**
 * Parse Overwatch update
 * Format: LB_UPDATE_OW: @PlayerName role Rank_current (value) rank_peak value date
 * Example: LB_UPDATE_OW: @Alpha Tank Diamond 3 3200 Master 2 3400 2026-02-14
 */
export function parseOverwatch(messageContent) {
  if (!messageContent?.trim().startsWith('LB_UPDATE_OW:')) {
    return null;
  }

  const content = messageContent.trim().substring('LB_UPDATE_OW:'.length).trim();
  const parts = content.split(/\s+/);

  if (parts.length < 7) {
    console.warn('Invalid OW format: insufficient fields');
    return null;
  }

  const mention = parts[0];
  const userId = extractUserId(mention);
  if (!userId) {
    console.warn('Invalid OW format: invalid mention');
    return null;
  }

  const role = sanitize(parts[1]);
  
  // Parse current rank
  let currentRankEnd = 2;
  let currentRankParts = [parts[2]];
  
  while (currentRankEnd < parts.length && isNaN(parseInt(parts[currentRankEnd], 10))) {
    currentRankParts.push(parts[currentRankEnd]);
    currentRankEnd++;
  }
  
  if (currentRankEnd >= parts.length) {
    console.warn('Invalid OW format: missing current value');
    return null;
  }
  
  const currentRankString = currentRankParts.join(' ');
  const currentRank = parseRankWithTier(currentRankString, OVERWATCH_RANKS, 5);
  if (!currentRank) {
    console.warn('Invalid OW format: invalid current rank');
    return null;
  }
  
  const currentValue = parseInt(parts[currentRankEnd], 10);
  if (isNaN(currentValue) || currentValue < 0) {
    console.warn('Invalid OW format: invalid current value');
    return null;
  }
  
  // Parse peak rank
  let peakRankStart = currentRankEnd + 1;
  let peakRankParts = [parts[peakRankStart]];
  let peakRankEnd = peakRankStart + 1;
  
  while (peakRankEnd < parts.length && isNaN(parseInt(parts[peakRankEnd], 10))) {
    peakRankParts.push(parts[peakRankEnd]);
    peakRankEnd++;
  }
  
  if (peakRankEnd >= parts.length) {
    console.warn('Invalid OW format: missing peak value');
    return null;
  }
  
  const peakRankString = peakRankParts.join(' ');
  const peakRank = parseRankWithTier(peakRankString, OVERWATCH_RANKS, 5);
  if (!peakRank) {
    console.warn('Invalid OW format: invalid peak rank');
    return null;
  }
  
  const peakValue = parseInt(parts[peakRankEnd], 10);
  if (isNaN(peakValue) || peakValue < 0) {
    console.warn('Invalid OW format: invalid peak value');
    return null;
  }
  
  const dateString = parts.slice(peakRankEnd + 1).join(' ');
  const parsedDate = parseDate(dateString);
  if (!parsedDate) {
    console.warn('Invalid OW format: invalid date');
    return null;
  }

  return {
    game: 'OVERWATCH',
    userId,
    role,
    currentRank,
    currentValue,
    peakRank,
    peakValue,
    lastUpdated: parsedDate,
    rawMention: mention
  };
}

/**
 * Parse Deadlock update
 * Format: LB_UPDATE_DL: @PlayerName hero_name Rank_current current_value date
 * Example: LB_UPDATE_DL: @Player Haze Archon 4 1200 2026-02-14
 */
export function parseDeadlock(messageContent) {
  if (!messageContent?.trim().startsWith('LB_UPDATE_DL:')) {
    return null;
  }

  const content = messageContent.trim().substring('LB_UPDATE_DL:'.length).trim();
  const parts = content.split(/\s+/);

  if (parts.length < 5) {
    console.warn('Invalid DL format: insufficient fields');
    return null;
  }

  const mention = parts[0];
  const userId = extractUserId(mention);
  if (!userId) {
    console.warn('Invalid DL format: invalid mention');
    return null;
  }

  const heroName = sanitize(parts[1]);
  
  // Parse current rank
  let currentRankEnd = 2;
  let currentRankParts = [parts[2]];
  
  while (currentRankEnd < parts.length && isNaN(parseInt(parts[currentRankEnd], 10))) {
    currentRankParts.push(parts[currentRankEnd]);
    currentRankEnd++;
  }
  
  if (currentRankEnd >= parts.length) {
    console.warn('Invalid DL format: missing current value');
    return null;
  }
  
  const currentRankString = currentRankParts.join(' ');
  const currentRank = parseRankWithTier(currentRankString, DEADLOCK_RANKS, 6);
  if (!currentRank) {
    console.warn('Invalid DL format: invalid current rank');
    return null;
  }
  
  const currentValue = parseInt(parts[currentRankEnd], 10);
  if (isNaN(currentValue) || currentValue < 0) {
    console.warn('Invalid DL format: invalid current value');
    return null;
  }
  
  const dateString = parts.slice(currentRankEnd + 1).join(' ');
  const parsedDate = parseDate(dateString);
  if (!parsedDate) {
    console.warn('Invalid DL format: invalid date');
    return null;
  }

  return {
    game: 'DEADLOCK',
    userId,
    heroName,
    currentRank,
    currentValue,
    lastUpdated: parsedDate,
    rawMention: mention
  };
}

/**
 * Detect game type and parse accordingly
 */
export function parseMessage(messageContent) {
  if (!messageContent) return null;
  
  if (messageContent.includes('LB_UPDATE_MR:')) {
    return parseMarvelRivals(messageContent);
  } else if (messageContent.includes('LB_UPDATE_OW:')) {
    return parseOverwatch(messageContent);
  } else if (messageContent.includes('LB_UPDATE_DL:')) {
    return parseDeadlock(messageContent);
  }
  
  return null;
}

/**
 * Batch parse messages
 */
export function parseMultipleUpdates(messages, gameType) {
  const results = {
    successful: [],
    failed: [],
    skipped: 0
  };

  for (const message of messages) {
    const parsed = parseMessage(message.content);
    
    if (!parsed) {
      results.skipped++;
      continue;
    }
    
    // Filter by game type if specified
    if (gameType && parsed.game !== gameType) {
      results.skipped++;
      continue;
    }
    
    if (parsed) {
      results.successful.push({
        messageId: message.id,
        timestamp: message.createdTimestamp,
        author: message.author,
        data: parsed
      });
    } else {
      results.failed.push({
        messageId: message.id,
        content: message.content,
        reason: 'parse_error'
      });
    }
  }

  return results;
}

/**
 * Sort players by game-specific rules
 */
export function sortPlayers(players, gameType) {
  if (!players || players.length === 0) return [];
  
  return [...players].sort((a, b) => {
    if (gameType === 'MARVEL_RIVALS' || gameType === 'OVERWATCH') {
      // Compare current rank
      const maxTier = gameType === 'MARVEL_RIVALS' ? 3 : 5;
      const validRanks = gameType === 'MARVEL_RIVALS' ? MARVEL_RIVALS_RANKS : OVERWATCH_RANKS;
      
      const aRankValue = getRankSortValue(a.currentRank, validRanks, maxTier);
      const bRankValue = getRankSortValue(b.currentRank, validRanks, maxTier);
      
      if (aRankValue !== bRankValue) {
        return bRankValue - aRankValue; // Higher rank value = better rank
      }
      
      // Tiebreaker 1: Lower current value is better
      if (a.currentValue !== b.currentValue) {
        return a.currentValue - b.currentValue;
      }
      
      // Tiebreaker 2: Peak rank
      const aPeakValue = getRankSortValue(a.peakRank, validRanks, maxTier);
      const bPeakValue = getRankSortValue(b.peakRank, validRanks, maxTier);
      
      if (aPeakValue !== bPeakValue) {
        return bPeakValue - aPeakValue;
      }
      
      // Tiebreaker 3: Peak value (lower better)
      if (a.peakValue !== b.peakValue) {
        return a.peakValue - b.peakValue;
      }
      
      // Tiebreaker 4: Most recent date
      return new Date(b.lastUpdated) - new Date(a.lastUpdated);
    } else if (gameType === 'DEADLOCK') {
      // Compare current rank
      const aRankValue = getRankSortValue(a.currentRank, DEADLOCK_RANKS, 6);
      const bRankValue = getRankSortValue(b.currentRank, DEADLOCK_RANKS, 6);
      
      if (aRankValue !== bRankValue) {
        return bRankValue - aRankValue;
      }
      
      // Tiebreaker 1: Lower current value is better
      if (a.currentValue !== b.currentValue) {
        return a.currentValue - b.currentValue;
      }
      
      // Tiebreaker 2: Most recent date
      return new Date(b.lastUpdated) - new Date(a.lastUpdated);
    }
    
    return 0;
  });
}

export default {
  parseMessage,
  parseMarvelRivals,
  parseOverwatch,
  parseDeadlock,
  parseMultipleUpdates,
  sortPlayers
};
