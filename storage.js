/**
 * Storage Module - Message-as-Database
 * Encodes and decodes player data within Discord webhook messages
 */

const DATA_VERSION = 'v1';
const DATA_START_MARKER = `[DATA:${DATA_VERSION}]`;
const DATA_END_MARKER = '[/DATA]';

/**
 * Encode player data into storage format
 */
function encodePlayerData(players, gameType) {
  return players.map(player => {
    if (gameType === 'MARVEL_RIVALS' || gameType === 'OVERWATCH') {
      return [
        player.userId,
        player.role || 'Unknown',
        `${player.currentRank.rank} ${player.currentRank.tier}`,
        player.currentValue,
        `${player.peakRank.rank} ${player.peakRank.tier}`,
        player.peakValue,
        player.lastUpdated
      ].join('|');
    } else if (gameType === 'DEADLOCK') {
      return [
        player.userId,
        player.heroName || 'Unknown',
        `${player.currentRank.rank} ${player.currentRank.tier}`,
        player.currentValue,
        player.lastUpdated
      ].join('|');
    }
  }).join('\n');
}

/**
 * Decode player data from storage format
 */
function decodePlayerData(dataString, gameType) {
  if (!dataString || !dataString.trim()) {
    return [];
  }

  return dataString
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const parts = line.split('|');
      
      if (gameType === 'MARVEL_RIVALS' || gameType === 'OVERWATCH') {
        if (parts.length < 7) {
          console.warn('Invalid data line:', line);
          return null;
        }

        const [rankName, tier] = parts[2].split(' ');
        const [peakRankName, peakTier] = parts[4].split(' ');

        return {
          userId: parts[0],
          role: parts[1],
          currentRank: { rank: rankName, tier: parseInt(tier, 10) },
          currentValue: parseInt(parts[3], 10),
          peakRank: { rank: peakRankName, tier: parseInt(peakTier, 10) },
          peakValue: parseInt(parts[5], 10),
          lastUpdated: parts[6]
        };
      } else if (gameType === 'DEADLOCK') {
        if (parts.length < 5) {
          console.warn('Invalid data line:', line);
          return null;
        }

        const [rankName, tier] = parts[2].split(' ');

        return {
          userId: parts[0],
          heroName: parts[1],
          currentRank: { rank: rankName, tier: parseInt(tier, 10) },
          currentValue: parseInt(parts[3], 10),
          lastUpdated: parts[4]
        };
      }
    })
    .filter(player => player !== null);
}

/**
 * Encode complete state
 */
export function encodeState(lastProcessedMessageId, players, gameType) {
  const lines = [
    DATA_START_MARKER,
    `GAME:${gameType}`,
    `LAST:${lastProcessedMessageId || 'none'}`,
    encodePlayerData(players, gameType),
    DATA_END_MARKER
  ];
  
  return lines.join('\n');
}

/**
 * Decode complete state from webhook message content
 */
export function decodeState(messageContent) {
  if (!messageContent) {
    return {
      gameType: null,
      lastProcessedMessageId: null,
      players: []
    };
  }

  const startIdx = messageContent.indexOf(DATA_START_MARKER);
  const endIdx = messageContent.indexOf(DATA_END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    return {
      gameType: null,
      lastProcessedMessageId: null,
      players: []
    };
  }

  const dataSection = messageContent.substring(
    startIdx + DATA_START_MARKER.length,
    endIdx
  ).trim();

  const lines = dataSection.split('\n');
  
  // Parse game type
  const gameMatch = lines[0]?.match(/^GAME:(.+)$/);
  const gameType = gameMatch ? gameMatch[1] : null;
  
  // Parse last processed message ID
  const lastMatch = lines[1]?.match(/^LAST:(.+)$/);
  const lastProcessedMessageId = lastMatch && lastMatch[1] !== 'none' ? lastMatch[1] : null;

  // Parse player data
  const playerDataString = lines.slice(2).join('\n');
  const players = decodePlayerData(playerDataString, gameType);

  return {
    gameType,
    lastProcessedMessageId,
    players
  };
}

/**
 * Update player in the players array
 */
export function upsertPlayer(players, newPlayerData) {
  const existingIndex = players.findIndex(p => p.userId === newPlayerData.userId);

  if (existingIndex >= 0) {
    // Check if new data is newer
    const existingDate = new Date(players[existingIndex].lastUpdated);
    const newDate = new Date(newPlayerData.lastUpdated);

    if (newDate < existingDate) {
      console.log(`Ignoring stale data for user ${newPlayerData.userId}`);
      return { players, updated: false };
    }

    // Update existing player
    players[existingIndex] = { ...newPlayerData };
    return { players, updated: true };
  } else {
    // Add new player
    players.push(newPlayerData);
    return { players, updated: true };
  }
}

export default {
  encodeState,
  decodeState,
  upsertPlayer
};
