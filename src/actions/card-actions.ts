'use server';

import pool from '@/lib/db';
import { revalidatePath } from 'next/cache';

export type KnowledgeCard = {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  wiki_url: string;
  domain: string;
  level: string;
};

export type CardStatus = 'known' | 'saved' | 'unknown';

// Mock user ID for MVP (In real app, get from Clerk `auth()`)
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

const MOCK_CARDS: KnowledgeCard[] = [
  {
    id: 'burg_method',
    title: 'Burg Method',
    summary: 'Maximum Entropy Spectral Estimation technique.',
    explanation: 'Minimizes the forward and backward prediction errors to estimate the power spectral density. High resolution for short data records.',
    wiki_url: 'https://en.wikipedia.org/wiki/Burg_method',
    domain: 'signal',
    level: 'understand'
  },
  {
    id: 'kalman_filter',
    title: 'Kalman Filter',
    summary: 'Optimal estimation algorithm for linear systems.',
    explanation: 'Uses a series of measurements observed over time (containing noise) to produce estimates of unknown variables.',
    wiki_url: 'https://en.wikipedia.org/wiki/Kalman_filter',
    domain: 'control',
    level: 'apply'
  },
  {
    id: 'shannon_entropy',
    title: 'Shannon Entropy',
    summary: 'Measure of information/uncertainty in a variable.',
    explanation: 'Quantifies the average level of "information", "surprise", or "uncertainty" inherent in the variable\'s possible outcomes.',
    wiki_url: 'https://en.wikipedia.org/wiki/Entropy_(information_theory)',
    domain: 'info',
    level: 'memorize'
  }
];

/**
 * Fetch the next card for the user.
 * Currently uses a random selection of cards effectively.
 * Future: Implement the Burg -> Wiener -> Kalman logic here.
 */
export async function getNextCard() {
  if (!process.env.DATABASE_URL) {
    return MOCK_CARDS[Math.floor(Math.random() * MOCK_CARDS.length)];
  }

  let client;
  try {
    client = await pool.connect();
    // Basic logic: Select a card that the user hasn't seen yet
    // If no such card, pick a random one
    const query = `
      SELECT kc.* 
      FROM knowledge_cards kc
      LEFT JOIN user_card_states ucs 
        ON kc.id = ucs.card_id AND ucs.user_id = $1
      WHERE ucs.card_id IS NULL
      ORDER BY Random()
      LIMIT 1;
    `;
    
    const res = await client.query(query, [DEMO_USER_ID]);
    
    if (res.rows.length > 0) {
      return res.rows[0] as KnowledgeCard;
    }

    // Fallback: If all cards seen, return a random one (review mode)
    const fallbackQuery = `SELECT * FROM knowledge_cards ORDER BY Random() LIMIT 1;`;
    const fallbackRes = await client.query(fallbackQuery);
    return fallbackRes.rows[0] as KnowledgeCard;

  } catch (error) {
    console.warn('Database connection failed or query error. Using Mock Data.', error);
    // Return random mock card
    return MOCK_CARDS[Math.floor(Math.random() * MOCK_CARDS.length)];
  } finally {
    // Only release if we actually connected, but pool.connect() might have thrown before returning client
    // If client is undefined (variable scope issue in try/catch block if not careful), but here client depends on await pool.connect()
    // We should safely release if client exists.
    try { client?.release(); } catch(e) {}
  }
}

/**
 * Save the user's state for a specific card.
 */
export async function saveCardState(cardId: string, status: CardStatus) {
  if (!process.env.DATABASE_URL) {
    return { success: true, warning: 'Mock mode: State not saved to DB' };
  }

  let client;
  try {
    client = await pool.connect();
    const query = `
      INSERT INTO user_card_states (user_id, card_id, status, last_seen)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, card_id) 
      DO UPDATE SET status = $3, last_seen = NOW();
    `;
    await client.query(query, [DEMO_USER_ID, cardId, status]);
    
    // Revalidate paths to refresh UI
    revalidatePath('/');
    revalidatePath('/saved');
    
    return { success: true };
  } catch (error) {
    console.error('Error in saveCardState:', error);
    // Return success in mock mode so UI updates
    return { success: true, warning: 'Mock mode: State not saved to DB' };
  } finally {
    try { client?.release(); } catch(e) {}
  }
}

/**
 * Get all cards marked as 'saved' or 'unknown' for the "My Unknowns" page.
 */
export async function getSavedCards() {
  if (!process.env.DATABASE_URL) {
    return MOCK_CARDS.map(c => ({...c, status: 'saved', last_seen: new Date() }));
  }

  let client;
  try {
    client = await pool.connect();
    const query = `
      SELECT kc.*, ucs.status, ucs.last_seen
      FROM knowledge_cards kc
      JOIN user_card_states ucs ON kc.id = ucs.card_id
      WHERE ucs.user_id = $1 AND ucs.status IN ('saved', 'unknown')
      ORDER BY ucs.last_seen DESC;
    `;
    const res = await client.query(query, [DEMO_USER_ID]);
    return res.rows;
  } catch (error) {
     console.error('Error in getSavedCards:', error);
    // Return some mock saved cards
    return MOCK_CARDS.map(c => ({...c, status: 'saved', last_seen: new Date() }));
  } finally {
    try { client?.release(); } catch(e) {}
  }
}

/**
 * Get simple statistics for the user.
 */
export async function getUserStats() {
  if (!process.env.DATABASE_URL) {
     return { known: 12, saved: 5, unknown: 3 }; // Mock stats
  }

  let client;
  try {
    client = await pool.connect();
    const query = `
      SELECT status, COUNT(*) as count
      FROM user_card_states
      WHERE user_id = $1
      GROUP BY status;
    `;
    const res = await client.query(query, [DEMO_USER_ID]);
    
    const stats = {
      known: 0,
      saved: 0,
      unknown: 0,
    };

    res.rows.forEach(row => {
      if (row.status === 'known') stats.known = parseInt(row.count);
      if (row.status === 'saved') stats.saved = parseInt(row.count);
      if (row.status === 'unknown') stats.unknown = parseInt(row.count);
    });

    return stats;
  } catch (error) {
    console.error('Error in getUserStats:', error);
    return { known: 12, saved: 5, unknown: 3 }; // Mock stats
  } finally {
    try { client?.release(); } catch(e) {}
  }
}
