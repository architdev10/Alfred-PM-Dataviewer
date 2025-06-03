// DataViewer.tsx - Enhanced version with improved message handling and debugging
import { useState, useEffect, useMemo } from "react"; // MODIFIED: Added useMemo
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronLeft, MessageSquare, ThumbsUp, ThumbsDown, MessageCircle, Filter, ChevronDown, ChevronUp, Bug } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { toast } from "@/components/ui/use-toast";
import { formatStructuredResponse } from "@/lib/formatters";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Types
interface User {
  id: string;
}

interface Session {
  id: string;
  messageCount?: number;
  createdAt?: string;
  lastActivity?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'unknown';
  content: string;
  text?: string;      // Added for backwards compatibility
  message?: string;   // Added for backwards compatibility
  data?: {
    content?: string;
    text?: string;
    message?: string;
    [key: string]: any;
  };
  timestamp?: string;
  feedback?: 'good' | 'bad' | null;
  comments?: string[];
  sequence?: number;
}

// API service functions
const API_BASE_URL = 'http://127.0.0.1:3002';

const fetchUsers = async () => {
  const response = await fetch(`${API_BASE_URL}/api/users`);
  if (!response.ok) {
    throw new Error(`Failed to fetch users: ${response.status}`);
  }
  return response.json();
};

const fetchSessions = async (userId: string) => {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/sessions`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.status}`);
  }
  return response.json();
};

const fetchSingleMessage = async (messageId: string) => {
  try {
    console.log(`Fetching single message with ID ${messageId}`);
    const response = await fetch(`${API_BASE_URL}/api/message/${messageId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch message: ${response.status}`);
    }
    const data = await response.json();
    console.log('Single message API response:', data);
    return data;
  } catch (error) {
    console.error('Error fetching single message:', error);
    throw error;
  }
};

const fetchMessages = async (userId: string, sessionId: string) => {
  console.log(`Fetching messages for user ${userId}, session ${sessionId}`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/sessions/${sessionId}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API returned ${response.status}: ${errorText}`);
      throw new Error(`Failed to fetch messages: ${response.status}`);
    }

    const data = await response.json();
    console.log('Raw session data from API:', data);

    // Determine the structure of the data and extract messages
    let messagesArray = [];

    // Handle the case where messages are in the messages array
    if (data.messages && Array.isArray(data.messages)) {
      console.log('Found messages array with', data.messages.length, 'items');
      messagesArray = data.messages;
    }
    // Handle the case where messages are in chat_history 
    else if (data.chat_history && Array.isArray(data.chat_history)) {
      console.log('Found chat_history array with', data.chat_history.length, 'items');
      messagesArray = extractMessagesFromChatHistory(data.chat_history);
    }
    // Check for chat_history in a specific session object
    else if (data.sessions && Array.isArray(data.sessions)) {
      const session = data.sessions.find(s => s.session_id === sessionId);
      if (session && session.chat_history && Array.isArray(session.chat_history)) {
        console.log('Found chat_history in specific session with', session.chat_history.length, 'items');
        messagesArray = extractMessagesFromChatHistory(session.chat_history);
      }
    }
    // Look for messages in other possible locations
    else {
      // Try to find messages in other common locations
      if (data.data && data.data.messages && Array.isArray(data.data.messages)) {
        messagesArray = data.data.messages;
        console.log('Found messages in data.messages');
      } else if (data.conversation && Array.isArray(data.conversation.messages)) {
        messagesArray = data.conversation.messages;
        console.log('Found messages in conversation.messages');
      } else if (data.content && Array.isArray(data.content)) {
        messagesArray = data.content;
        console.log('Using content array as messages');
      } else if (data.results && Array.isArray(data.results)) {
        messagesArray = data.results;
        console.log('Using results array as messages');
      } else if (Array.isArray(data)) {
        // The response itself might be an array of messages
        messagesArray = data;
        console.log('API response is an array, treating as messages');
      } else {
        // Last resort: try to find any array property that might contain messages
        for (const key of Object.keys(data)) {
          if (Array.isArray(data[key]) && data[key].length > 0) {
            if (data[key][0].role || data[key][0].content) {
              messagesArray = data[key];
              console.log(`Found potential messages array in ${key}`);
              break;
            }
          }
        }
      }
    }

    // If still no messages array, create an empty one
    if (!Array.isArray(messagesArray)) {
      console.warn('No messages array found in response, creating empty array');
      messagesArray = [];
    }

    console.log('Extracted messages array (output of extractMessagesFromChatHistory or other paths):', messagesArray);

    // Process each message to ensure it has the required fields
    // This loop will now be more conservative and trust fields from extraction.
    const processedMsgs = messagesArray.map((msg, index) => {
      // ID: Trust the ID from msg if it exists and is a string.
      // extractMessagesFromChatHistory now generates robust IDs.
      let finalId = (typeof msg.id === 'string' && msg.id) || 
                    (typeof msg.message_id === 'string' && msg.message_id);

      if (!finalId) { // Fallback if ID is still missing after extraction.
        finalId = `${userId}_${sessionId}_fallback_${index}`;
        console.warn(`Message at index ${index} in session ${sessionId} was missing a valid ID after extraction. Generated fallback ID: ${finalId}`, msg);
      }

      // Comments: Ensure it's an array. extractMessagesFromChatHistory should handle this.
      const finalComments = Array.isArray(msg.comments) ? msg.comments : [];
      
      // Content: Ensure it exists. extractMessagesFromChatHistory already handles finding content.
      const finalContent = msg.content || "No content available (fetchMessages fallback)";
      if (msg.content !== finalContent && msg.content === undefined) { // Log only if content was actually missing
          console.warn(`Content for message ID ${finalId} was missing. Used fallback.`);
      }

      // Role: Ensure it's valid. extractMessagesFromChatHistory already handles role.
      let finalRole: Message['role'] = 'unknown';
      if (msg.role && ['user', 'assistant', 'system', 'unknown'].includes(msg.role)) {
        finalRole = msg.role;
      } else if (msg.role) { // If role exists but is not one of the valid ones
        console.warn(`Message ID ${finalId} had an unrecognized role '${msg.role}'. Defaulting to 'unknown'.`);
      } else { // if msg.role is undefined or null
        console.warn(`Message ID ${finalId} was missing a role. Defaulting to 'unknown'.`);
      }
      
      return {
        ...msg, // Spread original msg first to retain all its properties
        id: finalId,
        content: finalContent,
        comments: finalComments,
        role: finalRole,
        sequence: msg.sequence !== undefined ? msg.sequence : index, // Ensure sequence for sorting
      };
    });

    // Extract other relevant data from the session
    const projects = data.projects || [];
    const tasks = data.tasks || [];
    const emailThreadChain = data.email_thread_chain || [];
    const emailThreadId = data.email_thread_id || null;

    return {
      messages: processedMsgs,
      projects,
      tasks,
      emailThreadChain,
      emailThreadId
    };
  } catch (error) {
    console.error('Error in fetchMessages:', error);
    throw error;
  }
};

// Helper function to extract messages from chat_history format
const extractMessagesFromChatHistory = (chatHistory: any[]) => {
  if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
    return [];
  }

  // Log the first item to understand the structure
  console.log('Extracting from chatHistory. First item (exchange/message group):', JSON.stringify(chatHistory[0]).substring(0, 250));

  // Check if this is a flat message array with role and content
  const isFlatFormat = chatHistory.some(item =>
    item && typeof item === 'object' &&
    (item.role === 'user' || item.role === 'assistant' || item.role === 'system')
  );

  if (isFlatFormat) {
    console.log('Detected flat message format, processing directly');
    return chatHistory.map((item, index) => {
      if (!item || typeof item !== 'object') {
        return {
          id: `chat_history_${index}`,
          role: 'unknown',
          content: String(item || "No content available"),
          sequence: index,
          comments: []
        };
      }

      return {
        id: item.id || item.message_id || `chat_history_${index}`,
        role: item.role || 'unknown',
        content: item.content || item.text || item.message || "No content available",
        timestamp: item.timestamp || item.time || new Date().toISOString(),
        sequence: item.sequence || index,
        comments: Array.isArray(item.comments) ? item.comments : []
      };
    });
  }

  // Check if this is a MongoDB-style object with numbered keys
  const isMongoNumberedFormat = chatHistory.length > 0 &&
    typeof chatHistory[0] === 'object' &&
    Object.keys(chatHistory[0]).some(key => !isNaN(parseInt(key)));

  if (isMongoNumberedFormat) {
    console.log('Detected MongoDB numbered chat history format, extracting nested messages');
    const extractedMessages = [];

    // Iterate through each chat history entry
    chatHistory.forEach((entry, entryIndex) => {
      // Extract nested messages from numbered keys
      Object.keys(entry).forEach(key => {
        if (!isNaN(parseInt(key))) {
          const item = entry[key];
          if (item && typeof item === 'object') {
            // Determine the role
            let role: 'user' | 'assistant' | 'system' | 'unknown' = 'unknown';

            if (item.role) {
              if (['user', 'assistant', 'system'].includes(item.role)) {
                role = item.role as any;
              } else if (typeof item.role === 'string') {
                if (item.role.includes('user') || item.role.includes('human')) {
                  role = 'user';
                } else if (item.role.includes('assistant') || item.role.includes('ai')) {
                  role = 'assistant';
                } else if (item.role.includes('system')) {
                  role = 'system';
                }
              }
            }

            // Extract content from various fields
            let content = null;
            if (item.content !== undefined) content = item.content;
            else if (item.text !== undefined) content = item.text;
            else if (item.message !== undefined) content = item.message;
            else if (typeof item === 'string') content = item;

            // Create message with proper structure
            if (content !== null) {
              extractedMessages.push({
                id: `chat_history_${entryIndex}_${key}`,
                role,
                content,
                timestamp: item.timestamp || item.created_at || item.time,
                sequence: parseInt(key),
                comments: Array.isArray(item.comments) ? item.comments : []
              });
            }
          }
        }
      });
    });

    console.log(`Extracted ${extractedMessages.length} messages from MongoDB format`);
    return extractedMessages;
  }

  // Handle exchange-based format (messages grouped in exchanges)
  const isExchangeFormat = chatHistory.some(item =>
    item && typeof item === 'object' && Array.isArray(item.messages)
  );

  if (isExchangeFormat) {
    console.log('Detected exchange-based format. Processing each exchange and its nested messages.');
    const extractedMessages: Message[] = [];

    chatHistory.forEach((exchange, exchangeIndex) => {
      if (exchange && typeof exchange === 'object' && Array.isArray(exchange.messages)) {
        const exchangeId = exchange.message_id || exchange.id; // ID of the exchange/group
        const exchangeTimestamp = exchange.timestamp;
        console.log(`Processing Exchange ${exchangeIndex}: ID='${exchangeId}', Timestamp='${exchangeTimestamp}', Number of messages=${exchange.messages.length}`);

        exchange.messages.forEach((message: any, messageIndex: number) => {
          if (message && typeof message === 'object') {
            let role: 'user' | 'assistant' | 'system' | 'unknown' = 'unknown';

            if (message.role) {
              if (['user', 'assistant', 'system'].includes(message.role)) {
                role = message.role as any;
              } else if (typeof message.role === 'string') {
                const lowerRole = message.role.toLowerCase();
                if (lowerRole.includes('user') || lowerRole.includes('human')) {
                  role = 'user';
                } else if (lowerRole.includes('assistant') || lowerRole.includes('ai')) {
                  role = 'assistant';
                } else if (lowerRole.includes('system')) {
                  role = 'system';
                }
              }
            }

            // Generate a unique ID for the individual message:
            // Prefer message's own ID, then construct from exchange ID + index, then fallback.
            let finalMessageId = message.id || message.message_id;
            if (!finalMessageId) {
              if (exchangeId) {
                finalMessageId = `${exchangeId}_m_${messageIndex}`;
              } else {
                finalMessageId = `exchange_${exchangeIndex}_m_${messageIndex}`;
              }
            }

            // Determine timestamp: Prefer message's own, then exchange's, then fallback.
            const finalTimestamp = message.timestamp || exchangeTimestamp || new Date().toISOString();
            
            // Determine sequence for sorting
            const baseSequence = exchange.sequence !== undefined ? exchange.sequence : exchangeIndex * 1000;
            const finalSequence = baseSequence + messageIndex;

            extractedMessages.push({
              ...message, // Spread other potential properties from the original message object
              id: finalMessageId,
              role,
              content: message.content || message.text || message.message || "No content available",
              timestamp: finalTimestamp,
              sequence: finalSequence,
              comments: Array.isArray(message.comments) ? message.comments : []
            });
          } else {
            console.warn(`Message at index ${messageIndex} in Exchange ${exchangeIndex} (ID: ${exchangeId}) is not a valid object:`, message);
          }
        });
      } else {
        console.warn(`Exchange at index ${exchangeIndex} is not in the expected format (missing 'messages' array or not an object). Exchange data:`, exchange);
      }
    });

    console.log(`Extracted ${extractedMessages.length} messages from exchange format.`);
    return extractedMessages;
  }

  // Default fallback - try to extract what we can from each item
  console.log('Using default extraction for unrecognized format');
  return chatHistory.map((item, index) => {
    if (!item || typeof item !== 'object') {
      return {
        id: `item_${index}`,
        role: 'unknown',
        content: String(item || "No content available"),
        sequence: index,
        comments: []
      };
    }

    // Determine the role
    let role: 'user' | 'assistant' | 'system' | 'unknown' = 'unknown';

    if (item.role) {
      if (['user', 'assistant', 'system'].includes(item.role)) {
        role = item.role as any;
      } else if (typeof item.role === 'string') {
        if (item.role.includes('user') || item.role.includes('human')) {
          role = 'user';
        } else if (item.role.includes('assistant') || item.role.includes('ai')) {
          role = 'assistant';
        } else if (item.role.includes('system')) {
          role = 'system';
        }
      }
    } else if (item.sender) {
      if (item.sender === 'user' || item.sender === 'client' || item.sender === 'human') {
        role = 'user';
      } else if (item.sender === 'assistant' || item.sender === 'ai' || item.sender === 'bot') {
        role = 'assistant';
      } else if (item.sender === 'system') {
        role = 'system';
      }
    }

    // Extract content from various possible fields
    const content = item.content || item.text || item.message || item.value || "No content available";

    return {
      id: item.id || item.message_id || `item_${index}`,
      role,
      content,
      timestamp: item.timestamp || item.time || item.created_at || new Date().toISOString(),
      sequence: item.sequence || index,
      comments: Array.isArray(item.comments) ? item.comments : []
    };
  });
};

const submitComment = async (messageId: string, comment: string) => {
  console.log('Submitting comment for message ID:', messageId);

  const response = await fetch(`${API_BASE_URL}/api/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_id: messageId, comment })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to save comment');
  }

  return response.json();
};

const updateFeedback = async (messageId: string, feedback: 'good' | 'bad' | null) => {
  const response = await fetch(`${API_BASE_URL}/api/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_id: messageId, rating: feedback })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to update feedback');
  }

  return response.json();
};

// Format timestamps in a user-friendly way
const formatTimestamp = (timestamp: string) => {
  try {
    const date = new Date(timestamp);

    // Check if the date is valid
    if (isNaN(date.getTime())) {
      // Try to handle Unix timestamp in milliseconds or seconds
      if (/^\d+$/.test(timestamp)) {
        const timestampNum = parseInt(timestamp);
        // If seconds (10 digits), convert to milliseconds
        if (timestampNum < 10000000000) {
          date.setTime(timestampNum * 1000);
        } else {
          date.setTime(timestampNum);
        }
      }

      // If still invalid, return the original
      if (isNaN(date.getTime())) {
        return timestamp;
      }
    }

    // Format the date
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return timestamp;
  }
};

export function DataViewer() {
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [emailThreadChain, setEmailThreadChain] = useState<any[]>([]);
  const [emailThreadId, setEmailThreadId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'users' | 'sessions' | 'conversation'>('users');
  const [newComment, setNewComment] = useState<string>('');
  const [commentingOnIndex, setCommentingOnIndex] = useState<number | null>(null);
  const [commentLoading, setCommentLoading] = useState<boolean>(false);
  const [rateLoading, setRateLoading] = useState<number | null>(null);

  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<string | null>(null);

  // Filter states
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [filteredMessageCount, setFilteredMessageCount] = useState<number>(0);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [expandedCommentSections, setExpandedCommentSections] = useState<Set<number>>(new Set());

  // Debug state
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [showDebugDialog, setShowDebugDialog] = useState<boolean>(false);
  const [debugMessage, setDebugMessage] = useState<any>(null);

  // ADDED useMemo for processedMessages and useEffect for filteredMessageCount
  const processedMessages = useMemo(() => {
    const filtered = messages
      // Apply role filter
      .filter(message => roleFilter === 'all' || message.role === roleFilter)
      // Apply session filter
      .filter(message => {
        if (sessionFilter === 'all') return true;
        // Extract session ID from message ID
        if (message.id && message.id.includes('_')) {
          const parts = message.id.split('_');
          return parts.length > 1 && parts[1] === sessionFilter;
        }
        return false;
      })
      // Apply feedback filter
      .filter(message => {
        if (feedbackFilter === 'all') return true;
        if (feedbackFilter === 'none') return !message.feedback;
        return message.feedback === feedbackFilter;
      })
      // Sort by timestamp with fallback to sequence
      .sort((a, b) => {
        // Parse timestamps to milliseconds
        const parseTs = (msg: Message) => {
          if (!msg.timestamp) return msg.sequence ?? 0;
          const t = Date.parse(msg.timestamp);
          return isNaN(t) ? (msg.sequence ?? 0) : t;
        };
        const aVal = parseTs(a);
        const bVal = parseTs(b);
        return sortOrder === 'recent' ? bVal - aVal : aVal - bVal;
      });
    return filtered;
  }, [messages, roleFilter, sessionFilter, feedbackFilter, sortOrder]);

  useEffect(() => {
    setFilteredMessageCount(processedMessages.length);
  }, [processedMessages]);

  // Reset all filters to default values
  const resetFilters = () => {
    setSessionFilter('all');
    setRoleFilter('all');
    setFeedbackFilter('all');
    setSortOrder('recent');
  };

  // Check if any filters are active
  const hasActiveFilters = () => {
    return sessionFilter !== 'all' || roleFilter !== 'all' || feedbackFilter !== 'all';
  };

  // Initialize data loading when component mounts
  useEffect(() => {
    // Load initial users data
    loadUsers();

    // Set up auto-refresh
    if (autoRefreshEnabled) {
      const intervalId = setInterval(() => {
        if (selectedUser && selectedSession) {
          refreshMessages();
          setLastRefreshTime(new Date().toLocaleTimeString());
        }
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(intervalId);
    }
  }, [autoRefreshEnabled, selectedUser, selectedSession]);

  // Load users from API
  const loadUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users. Please try again.');
      toast({
        title: "Error",
        description: "Failed to load users. Please check if the backend is running.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Select a user and load their sessions
  const selectUser = async (userId: string) => {
    setSelectedUser(userId);
    setSelectedSession(null);
    setView('sessions');
    setLoading(true);
    setError(null);

    try {
      const data = await fetchSessions(userId);
      setSessions(data);
    } catch (err: any) {
      console.error('Failed to fetch sessions:', err);
      setError('Failed to load sessions for this user. Please try again.');
      toast({
        title: "Error",
        description: "Failed to load sessions. Please check backend connection.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Select a session and load its messages
  const selectSession = async (userId: string, sessionId: string) => {
    setSelectedSession(sessionId);
    setView('conversation');
    setLoading(true);
    setError(null);
    console.log(`Selecting session ${sessionId} for user ${userId}`);

    try {
      const result = await fetchMessages(userId, sessionId);
      console.log('Data returned by fetchMessages to selectSession:', JSON.stringify(result, null, 2));
      
      // Log the processed messages array right before setting state
      console.log('Processed messages before setting state in selectSession (result.messages):', JSON.stringify(result.messages, null, 2));

      // Update state with the processed messages
      setMessages(result.messages);
      setProjects(result.projects || []);
      setTasks(result.tasks || []);
      setEmailThreadChain(result.emailThreadChain || []);
      setEmailThreadId(result.emailThreadId || null);
      setLastRefreshTime(new Date().toLocaleTimeString());
      setFilteredMessageCount(result.messages.length);

      // If messages array is empty, set a specific error message
      if (!result.messages || result.messages.length === 0) {
        setError('No messages found for this session. The session might be empty or have a different data structure.');
      } else {
        setError(null);
      }
    } catch (err: any) {
      console.error('Failed to fetch conversation:', err);
      setError('Failed to load conversation. Please check backend connection and try again.');
      toast({
        title: "Error",
        description: "Failed to load conversation. Is the backend running?",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Refresh messages for current session
  const refreshMessages = async () => {
    if (!selectedUser || !selectedSession) return;

    console.log('Refreshing messages for session:', selectedSession);
    setLoading(true);

    try {
      const result = await fetchMessages(selectedUser, selectedSession);
      console.log('Refreshed session data:', result);

      // Update the UI with the processed messages
      setMessages(result.messages);
      setProjects(result.projects || []);
      setTasks(result.tasks || []);
      setEmailThreadChain(result.emailThreadChain || []);
      setEmailThreadId(result.emailThreadId || null);
      setFilteredMessageCount(result.messages.length);

      // Error handling
      if (!result.messages || result.messages.length === 0) {
        setError('No messages found for this session.');
      } else {
        setError(null);
      }

      // Success toast
      toast({
        title: "Success",
        description: "Conversation data refreshed successfully"
      });
    } catch (err: any) {
      console.error('Failed to refresh messages:', err);
      setError('Failed to refresh conversation. Please check backend connection.');
      toast({
        title: "Error",
        description: "Failed to refresh conversation data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setLastRefreshTime(new Date().toLocaleTimeString());
    }
  };

  // Go back to previous view
  const goBack = () => {
    if (view === 'conversation') {
      setView('sessions');
      setSelectedSession(null);
    } else if (view === 'sessions') {
      setView('users');
      setSelectedUser(null);
    }
  };

  // Format message content with code highlighting, line breaks, etc.
  const formatMessage = (content: any) => {
    // Handle undefined or null content
    if (content === undefined || content === null) {
      return "No content available";
    }

    try {
      // If the content is an object, try to extract the most meaningful part
      if (typeof content === 'object') {
        // Log the content structure for debugging
        console.log('Formatting object content:', JSON.stringify(content).substring(0, 100) + '...');

        // Check for common fields that might contain the actual message
        if (content.convo) {
          return formatStructuredResponse(content.convo);
        }
        if (content.text || content.message || content.content) {
          return formatStructuredResponse(content.text || content.message || content.content);
        }
        if (content.data && typeof content.data === 'object') {
          if (content.data.content || content.data.text || content.data.message) {
            return formatStructuredResponse(content.data.content || content.data.text || content.data.message);
          }
        }

        // Try parsing the object as plain text
        const textValue = Object.values(content).find(v => typeof v === 'string');
        if (textValue) {
          console.log('Found text value in object:', textValue.substring(0, 50) + '...');
          return formatStructuredResponse(textValue);
        }

        // If no specific field found, stringify the object
        return formatStructuredResponse(JSON.stringify(content, null, 2));
      }

      // If content is a string, try to parse as JSON first
      if (typeof content === 'string') {
        try {
          // Try to parse as JSON
          const jsonContent = JSON.parse(content);

          // Check for structured content
          if (jsonContent && (jsonContent.convo || jsonContent.text || jsonContent.message || jsonContent.content)) {
            return formatStructuredResponse(jsonContent.convo || jsonContent.text || jsonContent.message || jsonContent.content);
          }
          // If no specific fields found but parsing succeeded, return the stringified pretty JSON
          return formatStructuredResponse(JSON.stringify(jsonContent, null, 2));
        } catch (e) {
          // Not valid JSON, use the string directly
          return formatStructuredResponse(content);
        }
      }

      // Fallback for other types
      return formatStructuredResponse(String(content));
    } catch (e) {
      // Final failsafe - if anything goes wrong, return a safe string
      console.error('Error in formatMessage:', e);
      return "Error formatting message content";
    }
  };

  // Add a comment to a message
  const addComment = async (messageIndex: number) => {
    if (!newComment.trim()) return;
    setCommentLoading(true);

    try {
      const msg = messages[messageIndex];
      console.log('Adding comment to message:', msg);

      // Extract user and session info from the message ID
      let messageId = msg.id;

      // If the ID doesn't contain underscores, construct it properly
      if (!messageId.includes('_') && selectedUser && selectedSession) {
        messageId = `${selectedUser}_${selectedSession}_${messageIndex}`;
        console.log('Constructed proper message ID:', messageId);
      }

      // Submit comment to backend
      await submitComment(messageId, newComment);

      // Update local state with new comment - ensure comments array exists
      const updatedMessages = [...messages];
      if (!Array.isArray(updatedMessages[messageIndex].comments)) {
        updatedMessages[messageIndex].comments = [];
      }
      updatedMessages[messageIndex].comments.push(newComment);
      setMessages(updatedMessages);

      // After optimistic update, fetch the actual message to ensure comment is present
      try {
        const updatedMessage = await fetchSingleMessage(messageId);
        if (updatedMessage && Array.isArray(updatedMessage.comments)) {
          // Only update the comments array, keep everything else the same
          updatedMessages[messageIndex] = {
            ...updatedMessages[messageIndex],
            comments: updatedMessage.comments
          };
          setMessages(updatedMessages);
        }
      } catch (fetchError) {
        console.error('Error fetching updated message:', fetchError);
        // Continue with optimistic update if fetch fails
      }

      setNewComment('');

      // Regular refresh with slightly longer delay 
      setTimeout(() => {
        console.log('Refreshing messages after comment submission');
        refreshMessages();
      }, 1000);

      toast({
        title: "Success",
        description: "Comment added successfully"
      });
    } catch (error) {
      console.error('Add comment error:', error);
      toast({
        title: "Error",
        description: "Failed to save comment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setCommentLoading(false);
    }
  };

  // Set feedback for a message
  const setFeedback = async (messageIndex: number, feedback: 'good' | 'bad' | null) => {
    setRateLoading(messageIndex);

    try {
      const msg = messages[messageIndex];
      const newRating = msg.feedback === feedback ? null : feedback;

      // Send feedback to backend
      await updateFeedback(msg.id, newRating);

      // Update local state with new feedback
      const updatedMessages = messages.map((message, index) => {
        if (index === messageIndex) {
          return {
            ...message,
            feedback: newRating
          };
        }
        return message;
      });

      setMessages(updatedMessages);
      toast({
        title: "Success",
        description: "Feedback updated successfully"
      });
    } catch (error) {
      console.error('Rating update error:', error);
      toast({
        title: "Error",
        description: "Failed to update rating. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRateLoading(null);
    }
  };

  // Render users view
  if (view === 'users') {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="border-b pb-3">
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollContainer>
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                {error}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={loadUsers}
                >
                  Retry
                </Button>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No users found. Make sure the backend API is running.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.id}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => selectUser(user.id)}
                        >
                          View Sessions
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollContainer>
        </CardContent>
      </Card>
    );
  }

  // Render sessions view
  if (view === 'sessions') {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="border-b pb-3 flex flex-row items-center">
          <Button variant="ghost" size="icon" onClick={goBack} className="mr-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle>Sessions for User {selectedUser}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <ScrollContainer>
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                {error}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => selectedUser && selectUser(selectedUser)}
                >
                  Retry
                </Button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sessions found for this user
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>{session.id}</TableCell>
                      <TableCell>{session.messageCount ?? 'Unknown'}</TableCell>
                      <TableCell>{session.createdAt ?? 'Unknown'}</TableCell>
                      <TableCell>{session.lastActivity ?? 'Unknown'}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => selectedUser && selectSession(selectedUser, session.id)}
                        >
                          View Conversation
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollContainer>
        </CardContent>
      </Card>
    );
  }

  // Render conversation view
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b pb-3 flex flex-col space-y-4">
        <div className="flex flex-row items-center">
          <Button variant="ghost" size="icon" onClick={goBack} className="mr-2">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-lg font-medium">
            Conversation for Session {selectedSession}
          </CardTitle>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshMessages}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
            </Button>

            <Button
              variant={debugMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setDebugMode(!debugMode)}
            >
              <Bug className="h-4 w-4 mr-1" />
              {debugMode ? "Hide Debug" : "Debug Mode"}
            </Button>

            <div className="flex items-center gap-2">
              <Switch
                checked={autoRefreshEnabled}
                onCheckedChange={setAutoRefreshEnabled}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Auto-refresh {autoRefreshEnabled ? "on" : "off"}
                {autoRefreshEnabled && lastRefreshTime && ` (Last: ${lastRefreshTime})`}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Button */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className={`flex items-center gap-2 ${hasActiveFilters() ? 'bg-primary/10' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            <span>Filter</span>
            {hasActiveFilters() && (
              <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                {Object.values([sessionFilter, roleFilter, feedbackFilter]).filter(f => f !== 'all').length}
              </Badge>
            )}
            {showFilters ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {/* Filter Count Indicator */}
          <div className="text-xs text-muted-foreground">
            Showing {filteredMessageCount} message{filteredMessageCount !== 1 ? 's' : ''}
            {hasActiveFilters() && ' (filtered)'}
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="space-y-3 mt-3 p-3 border rounded-md bg-muted/30">
            <div className="flex flex-wrap gap-2">
              {/* Session Filter */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Session:</label>
                <select
                  className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                  value={sessionFilter}
                  onChange={(e) => setSessionFilter(e.target.value)}
                >
                  <option value="all">All Sessions</option>
                  {/* Only show sessions for the current user with better labels */}
                  {sessions.map(session => {
                    // Format date if available
                    const dateLabel = session.createdAt
                      ? new Date(session.createdAt).toLocaleDateString()
                      : '';
                    // Create a descriptive label
                    const label = `${session.id} ${dateLabel ? `(${dateLabel})` : ''}`;
                    return (
                      <option key={session.id} value={session.id}>{label}</option>
                    );
                  })}
                </select>
              </div>

              {/* Role Filter */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Role:</label>
                <select
                  className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="user">User</option>
                  <option value="assistant">Assistant</option>
                  <option value="system">System</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              {/* Feedback Filter */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Feedback:</label>
                <select
                  className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                  value={feedbackFilter}
                  onChange={(e) => setFeedbackFilter(e.target.value)}
                >
                  <option value="all">All Feedback</option>
                  <option value="good">Good</option>
                  <option value="bad">Bad</option>
                  <option value="none">No Feedback</option>
                </select>
              </div>

              {/* Sort Order */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Sort:</label>
                <select
                  className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'recent' | 'oldest')}
                >
                  <option value="recent">Recent First</option>
                  <option value="oldest">Oldest First</option>
                </select>
              </div>

              {/* Reset Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={resetFilters}
                className="ml-auto"
              >
                Reset Filters
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollContainer>
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2">Loading conversation data...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <p>{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => selectedUser && selectedSession && selectSession(selectedUser, selectedSession)}
              >
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-6" data-testid="message-container">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No messages found for this session. The session might be empty or not properly formatted.
                </div>
              ) : (
                // MODIFIED: Apply filters and sorting using processedMessages
                processedMessages.map((message, index) => {
                  const isUser = message.role === 'user';
                  const isAssistant = message.role === 'assistant';
                  const isSystem = message.role === 'system';
                  const messageContent = message.content || message.text || message.message || 'No content available';

                  // Debug log for each message
                  if (debugMode) {
                    console.log(`Rendering message ${index}:`, {
                      id: message.id,
                      role: message.role,
                      contentType: typeof messageContent,
                      contentPreview: typeof messageContent === 'string'
                        ? messageContent.substring(0, 50) + '...'
                        : 'non-string content',
                      timestamp: message.timestamp,
                      feedback: message.feedback,
                      comments: message.comments
                    });
                  }

                  return (
                    <div key={index} className="space-y-2">
                      {/* Message bubble */}
                      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {/* User avatar/icon */}
                        {!isUser && (
                          <Avatar className="h-8 w-8 mr-2">
                            <AvatarFallback>
                              {isAssistant ? 'AI' : isSystem ? 'SYS' : 'UNK'}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div
                          className={`rounded-lg p-4 max-w-[80%] ${isUser ? 'bg-blue-500 text-white' : isSystem ? 'bg-gray-100 text-gray-800' : 'bg-muted'}`}
                        >
                          {/* Role indicator */}
                          <div className="text-xs mb-1 opacity-70 flex justify-between">
                            <span>{isUser ? 'User' : isAssistant ? 'Assistant' : isSystem ? 'System' : 'Unknown'}</span>

                            {/* Debug button */}
                            {debugMode && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 ml-2 text-xs"
                                onClick={() => {
                                  setDebugMessage(message);
                                  setShowDebugDialog(true);
                                }}
                              >
                                <Bug className="h-3 w-3" />
                              </Button>
                            )}
                          </div>

                          {/* Message content */}
                          <div className="text-sm whitespace-pre-wrap break-words overflow-auto max-h-[500px]">
                            {formatMessage(messageContent)}
                          </div>
                        </div>

                        {/* User avatar at end if user message */}
                        {isUser && (
                          <Avatar className="h-8 w-8 ml-2">
                            <AvatarFallback>
                              USR
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} ml-10 mr-10`}>
                        <div className="text-xs text-muted-foreground">
                          {message.timestamp ? formatTimestamp(message.timestamp) : 'Unknown time'}
                        </div>
                      </div>

                      {/* Feedback controls - only for assistant messages */}
                      {isAssistant && (
                        <div className="flex items-center space-x-4 ml-10 mt-1">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${message.feedback === 'good' ? 'text-green-500' : ''}`}
                              onClick={() => setFeedback(index, 'good')}
                              disabled={rateLoading === index}
                            >
                              <ThumbsUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 ${message.feedback === 'bad' ? 'text-red-500' : ''}`}
                              onClick={() => setFeedback(index, 'bad')}
                              disabled={rateLoading === index}
                            >
                              <ThumbsDown className="h-4 w-4" />
                            </Button>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center space-x-1"
                            onClick={() => setCommentingOnIndex(commentingOnIndex === index ? null : index)}
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            <span>
                              {Array.isArray(message.comments) && message.comments.length > 0
                                ? `Comments (${message.comments.length})`
                                : 'Add Comment'}
                            </span>
                          </Button>
                        </div>
                      )}

                      {/* Comments display */}
                      {isAssistant && Array.isArray(message.comments) && message.comments.length > 0 && (
                        <div className="ml-8 space-y-2 max-w-[80%]">
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
                              Comments ({message.comments.length})
                            </h4>
                            {message.comments.map((comment, commentIndex) => (
                              <div key={commentIndex} className="bg-blue-100 border border-blue-200 rounded-md p-3 text-sm shadow-sm break-words overflow-wrap-anywhere">
                                {comment}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Comment form */}
                      {isAssistant && commentingOnIndex === index && (
                        <div className="ml-8 space-y-2 max-w-[80%]">
                          <div className="flex flex-col space-y-2 border-t pt-2 mt-2">
                            <h4 className="text-sm font-medium">Add New Comment</h4>
                            <Textarea
                              placeholder="Enter your feedback here..."
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              className="min-h-[80px] w-full"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  if (newComment.trim()) {
                                    addComment(index);
                                  }
                                }
                              }}
                            />
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCommentingOnIndex(null)}
                                disabled={commentLoading}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => addComment(index)}
                                disabled={commentLoading || !newComment.trim()}
                                className="self-end"
                              >
                                {commentLoading ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <MessageCircle className="h-4 w-4 mr-2" />
                                    Save Comment
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </ScrollContainer>
      </CardContent>

      {/* Debug dialog */}
      {showDebugDialog && debugMessage && (
        <Dialog open={showDebugDialog} onOpenChange={setShowDebugDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <Bug className="h-4 w-4 mr-2" />
                Message Debug Info
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Message Properties</h3>
                  <div className="bg-muted p-3 rounded text-xs space-y-1">
                    <div><strong>ID:</strong> {debugMessage.id || 'undefined'}</div>
                    <div><strong>Role:</strong> {debugMessage.role || 'undefined'}</div>
                    <div><strong>Timestamp:</strong> {debugMessage.timestamp || 'undefined'}</div>
                    <div><strong>Sequence:</strong> {debugMessage.sequence !== undefined ? debugMessage.sequence : 'undefined'}</div>
                    <div><strong>Feedback:</strong> {debugMessage.feedback || 'none'}</div>
                    <div><strong>Comments:</strong> {Array.isArray(debugMessage.comments) ? debugMessage.comments.length : 'undefined'}</div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Full Object</h3>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-[400px]">
                    {JSON.stringify(debugMessage, null, 2)}
                  </pre>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <h3 className="text-sm font-medium mb-2">Content</h3>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-[200px]">
                    {typeof debugMessage.content === 'string'
                      ? debugMessage.content
                      : JSON.stringify(debugMessage.content, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            <div className="border-t pt-4 flex justify-end">
              <Button onClick={() => setShowDebugDialog(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}