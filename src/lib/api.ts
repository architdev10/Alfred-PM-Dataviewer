/**
 * API utilities for handling comments and ratings
 */

// Base API URL
export const API_BASE_URL = 'http://localhost:3002';

// API endpoints
export const ENDPOINTS = {
  COMMENTS: `${API_BASE_URL}/api/comments`,
  USERS: `${API_BASE_URL}/api/users`,
  MESSAGE: (id: string) => `${API_BASE_URL}/api/message/${id}`,
  USER_SESSIONS: (userId: string) => `${API_BASE_URL}/api/users/${userId}/sessions`,
  SESSION_CHAT: (userId: string, sessionId: string) => 
    `${API_BASE_URL}/api/users/${userId}/sessions/${sessionId}`,
};

// Types
export interface ApiErrorResponse {
  error: string;
}

export interface ApiSuccessResponse {
  success: boolean;
  [key: string]: any;
}

export interface MessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  feedback?: 'good' | 'bad' | null;
  comments?: string[];
}

/**
 * Add a comment to a message
 */
export async function postComment(messageId: string, comment: string): Promise<ApiSuccessResponse> {
  console.log(`API: Posting comment to message ID: ${messageId}`);
  
  // Use standardized message_id parameter
  const response = await fetch(ENDPOINTS.COMMENTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_id: messageId, comment })
  });

  if (!response.ok) {
    const errorData = await response.json() as ApiErrorResponse;
    throw new Error(errorData.error || `Failed to add comment (${response.status})`);
  }

  const result = await response.json() as ApiSuccessResponse;
  console.log('API: Comment posted successfully', result);
  return result;
}

/**
 * Update the rating for a message
 */
export async function postRating(messageId: string, rating: 'good' | 'bad' | null): Promise<ApiSuccessResponse> {
  const response = await fetch(ENDPOINTS.COMMENTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_id: messageId, rating })
  });

  if (!response.ok) {
    const errorData = await response.json() as ApiErrorResponse;
    throw new Error(errorData.error || `Failed to update rating (${response.status})`);
  }

  return await response.json() as ApiSuccessResponse;
}

/**
 * Get message data by ID
 */
export async function getMessage(messageId: string): Promise<MessageData> {
  try {
    console.log(`API: Fetching message data for ID: ${messageId}`);
    const response = await fetch(ENDPOINTS.MESSAGE(messageId));
    if (!response.ok) {
      const text = await response.text();
      console.error(`API: Failed to fetch message data (${response.status}): ${text}`);
      throw new Error(`Failed to fetch message data (${response.status})`);
    }
    const data = await response.json() as MessageData;
    console.log(`API: Retrieved message data for ${data.id}:`, data);
    return data;
  } catch (error) {
    console.error('API: Error in getMessage():', error);
    throw error;
  }
}

/**
 * Get user sessions
 */
export async function getUserSessions(userId: string): Promise<any[]> {
  const response = await fetch(ENDPOINTS.USER_SESSIONS(userId));
  
  if (!response.ok) {
    throw new Error(`Failed to fetch user sessions (${response.status})`);
  }
  
  return await response.json();
}

/**
 * Get session chat messages
 */
export async function getSessionChat(userId: string, sessionId: string): Promise<MessageData[]> {
  console.log(`API: Fetching session chat for user ${userId}, session ${sessionId}`);
  
  const response = await fetch(ENDPOINTS.SESSION_CHAT(userId, sessionId));
  
  if (!response.ok) {
    throw new Error(`Failed to fetch session chat (${response.status})`);
  }
  
  const data = await response.json() as MessageData[];
  
  // Ensure all messages have properly formatted IDs
  const processedData = data.map((msg, index) => {
    if (!msg.id || !msg.id.includes('_')) {
      const correctId = `${userId}_${sessionId}_${index}`;
      console.log(`API: Fixing message ID format: ${msg.id || 'undefined'} → ${correctId}`);
      return { ...msg, id: correctId };
    }
    return msg;
  });
  
  // Also try to fetch interactions data to cross-reference comments
  try {
    const interactionsResponse = await fetch(`${API_BASE_URL}/api/interactions`);
    if (interactionsResponse.ok) {
      const interactions = await interactionsResponse.json();
      console.log('API: Cross-referencing with interactions data');
      
      // Create a map of interaction data by ID
      const interactionMap = {};
      interactions.forEach(interaction => {
        if (interaction.id) {
          interactionMap[interaction.id] = interaction;
        }
      });
      
      // Merge comments from interactions into our messages
      processedData.forEach((msg, index) => {
        const messageId = msg.id || `${userId}_${sessionId}_${index}`;
        const interaction = interactionMap[messageId];
        
        if (interaction && Array.isArray(interaction.comments) && interaction.comments.length > 0) {
          console.log(`API: Found ${interaction.comments.length} comments for message ${messageId} in interactions data`);
          // If we found comments in the interactions data, use them
          msg.comments = interaction.comments;
        }
      });
    }
  } catch (error) {
    console.error('API: Error cross-referencing with interactions:', error);
    // Non-fatal error, continue with the data we have
  }
  
  console.log(`API: Returning ${processedData.length} messages with comments`);
  return processedData;
}

/**
 * Format message content to extract convo field from JSON
 */
export function formatMessage(content: any): string {
  try {
    // If content is already an object
    if (typeof content === 'object' && content !== null) {
      // Check if it has a convo field
      if (content.convo) {
        return content.convo;
      }
    }
    
    // If content is a string, try to parse as JSON
    if (typeof content === 'string') {
      try {
        const jsonContent = JSON.parse(content);
        // Check if parsed JSON has convo field
        if (jsonContent && jsonContent.convo) {
          return jsonContent.convo;
        }
      } catch (e) {
        // Not valid JSON, return the string as is
        return content;
      }
    }
    
    // If we get here, either there's no convo field or we couldn't parse
    // In this case, return the original content
    return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  } catch (e) {
    // Failsafe - if anything goes wrong, return stringified content
    console.error('Error in formatMessage:', e);
    return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  }
}
