import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronLeft, MessageSquare, ThumbsUp, ThumbsDown, MessageCircle, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { toast } from "@/components/ui/use-toast"; // Import toast if available, or create your own notification system
import { formatStructuredResponse } from "@/lib/formatters";

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
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  feedback?: 'good' | 'bad' | null;
  comments?: string[];
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

const fetchSessions = async (userId) => {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/sessions`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.status}`);
  }
  return response.json();
};

const fetchMessages = async (userId, sessionId) => {
  console.log(`Fetching messages for user ${userId}, session ${sessionId}`);
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/sessions/${sessionId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.status}`);
  }
  const data = await response.json();
  console.log('Raw message data from API:', data);
  
  // Check if any message is missing the correct ID format
  const processedData = data.map((msg, index) => {
    // Ensure message has proper ID format (userId_sessionId_index)
    if (!msg.id || !msg.id.includes('_')) {
      const correctId = `${userId}_${sessionId}_${index}`;
      console.log(`Fixing message ID: ${msg.id} → ${correctId}`);
      return { ...msg, id: correctId };
    }
    return msg;
  });
  
  return processedData;
};

const submitComment = async (messageId, comment) => {
  console.log('Submitting comment for message ID:', messageId);
  
  // Use standardized message_id parameter
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

const updateFeedback = async (messageId, feedback) => {
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

export function DataViewer() {
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'users' | 'sessions' | 'conversation'>('users');
  const [newComment, setNewComment] = useState<string>('');
  const [commentingOnIndex, setCommentingOnIndex] = useState<number | null>(null);
  // API sync loading states - more granular loading states
  const [commentLoading, setCommentLoading] = useState<boolean>(false);
  const [rateLoading, setRateLoading] = useState<number | null>(null); // Track which message is being rated
  
  // Filter states
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('recent');
  const [filteredMessageCount, setFilteredMessageCount] = useState<number>(0);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
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

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);

  // Load users from API
  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users. Please try again.');
      // Use toast if available
      // toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
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
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setError('Failed to load sessions for this user. Please try again.');
      // toast({ title: "Error", description: "Failed to load sessions", variant: "destructive" });
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
    
    try {
      const data = await fetchMessages(userId, sessionId);
      console.log('Received messages from API:', data);
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch conversation:', err);
      setError('Failed to load conversation for this session. Please try again.');
      // toast({ title: "Error", description: "Failed to load conversation", variant: "destructive" });
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
      const data = await fetchMessages(selectedUser, selectedSession);
      console.log('Refreshed messages data:', data);
      
      // Also fetch interaction data which might have comments
      try {
        // This is an additional check to see if comments exist in the interactions endpoint
        const interactionsResponse = await fetch(`${API_BASE_URL}/api/interactions`);
        if (interactionsResponse.ok) {
          const interactions = await interactionsResponse.json();
          console.log('Cross-referencing with interactions data');
          
          // Create a map of interaction data by ID
          const interactionMap = {};
          interactions.forEach(interaction => {
            if (interaction.id) {
              interactionMap[interaction.id] = interaction;
            }
          });
          
          // Merge comments from interactions into our messages
          data.forEach((msg, index) => {
            const messageId = msg.id || `${selectedUser}_${selectedSession}_${index}`;
            const interaction = interactionMap[messageId];
            
            if (interaction && Array.isArray(interaction.comments) && interaction.comments.length > 0) {
              console.log(`Found ${interaction.comments.length} comments for message ${messageId} in interactions data`);
              // If we found comments in the interactions data, use them
              msg.comments = interaction.comments;
            }
          });
        }
      } catch (interactionError) {
        console.error('Error fetching interactions for comment cross-reference:', interactionError);
        // Non-fatal error, continue with the data we have
      }
      
      // Ensure comments arrays are properly initialized
      const processedData = data.map(msg => ({
        ...msg,
        comments: Array.isArray(msg.comments) ? msg.comments : []
      }));
      
      setMessages(processedData);
    } catch (err) {
      console.error('Failed to refresh messages:', err);
      // toast({ title: "Error", description: "Failed to refresh messages", variant: "destructive" });
    } finally {
      setLoading(false);
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
    // Try to extract convo field
    try {
      // If content is already an object
      if (typeof content === 'object' && content !== null) {
        // Check if it has a convo field
        if (content.convo) {
          // Use the structured formatter for the convo content
          return formatStructuredResponse(content.convo);
        }
      }
      
      // If content is a string, try to parse as JSON
      if (typeof content === 'string') {
        try {
          const jsonContent = JSON.parse(content);
          // Check if parsed JSON has convo field
          if (jsonContent && jsonContent.convo) {
            // Use the structured formatter for the convo content
            return formatStructuredResponse(jsonContent.convo);
          }
        } catch (e) {
          // Not valid JSON, use the structured formatter directly
          return formatStructuredResponse(content);
        }
      }
      
      // If we get here, either there's no convo field or we couldn't parse
      // In this case, return the original content with structured formatting if it's a string
      return typeof content === 'string' 
        ? formatStructuredResponse(content) 
        : formatStructuredResponse(JSON.stringify(content, null, 2));
    } catch (e) {
      // Failsafe - if anything goes wrong, return stringified content
      console.error('Error in formatMessage:', e);
      return typeof content === 'string' 
        ? formatStructuredResponse(content) 
        : formatStructuredResponse(JSON.stringify(content, null, 2));
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
      // Message IDs should be in format: userId_sessionId_messageIndex
      // This ensures consistency with how the backend stores comments
      let messageId = msg.id;
      
      // If the ID doesn't contain underscores, construct it properly
      if (!messageId.includes('_') && selectedUser && selectedSession) {
        messageId = `${selectedUser}_${selectedSession}_${messageIndex}`;
        console.log('Constructed proper message ID:', messageId);
      }
      
      // Submit comment to backend
      await submitComment(messageId, newComment);
      
      // Update local state with new comment
      const updatedMessages = [...messages];
      if (!Array.isArray(updatedMessages[messageIndex].comments)) {
        updatedMessages[messageIndex].comments = [];
      }
      updatedMessages[messageIndex].comments.push(newComment);
      
      setMessages(updatedMessages);
      setNewComment('');
      setCommentingOnIndex(null);
      
      // Add a longer delay before refreshing to ensure DB consistency
      setTimeout(() => {
        console.log('Refreshing messages after comment submission');
        refreshMessages();
      }, 1000);
      
      // toast({ title: "Success", description: "Comment added successfully" });
    } catch (error) {
      console.error('Add comment error:', error);
      // toast({ title: "Error", description: "Failed to save comment. Please try again.", variant: "destructive" });
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
    } catch (error) {
      console.error('Rating update error:', error);
      // toast({ title: "Error", description: "Failed to update rating. Please try again.", variant: "destructive" });
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
                No users found
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
                      <TableCell>{session.messageCount || 'Unknown'}</TableCell>
                      <TableCell>{session.createdAt || 'Unknown'}</TableCell>
                      <TableCell>{session.lastActivity || 'Unknown'}</TableCell>
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
          <Button 
            variant="outline" 
            size="sm" 
            className="ml-auto" 
            onClick={refreshMessages}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
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
          <div className="space-y-6" data-testid="message-container">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No messages found for this session
              </div>
            ) : (
              // Apply filters and sorting
              (() => {
                // First filter out system messages (unless specifically requested)
                const filteredMessages = messages
                  .filter(message => roleFilter === 'system' ? true : message.role !== 'system')
                  // Apply session filter if not 'all' - using proper ID parsing
                  .filter(message => {
                    if (sessionFilter === 'all') return true;
                    // Extract session ID from message ID (format: userId_sessionId_index)
                    if (message.id && message.id.includes('_')) {
                      const parts = message.id.split('_');
                      return parts.length > 1 && parts[1] === sessionFilter;
                    }
                    return false;
                  })
                  // Apply role filter if not 'all'
                  .filter(message => roleFilter === 'all' || message.role === roleFilter)
                  // Apply feedback filter
                  .filter(message => {
                    if (feedbackFilter === 'all') return true;
                    if (feedbackFilter === 'none') return !message.feedback;
                    return message.feedback === feedbackFilter;
                  })
                  // Sort by timestamp
                  .sort((a, b) => {
                    const aTime = new Date(a.timestamp || 0).getTime();
                    const bTime = new Date(b.timestamp || 0).getTime();
                    return sortOrder === 'recent' ? bTime - aTime : aTime - bTime;
                  });
                
                // Update the filtered message count for the indicator
                if (filteredMessageCount !== filteredMessages.length) {
                  setFilteredMessageCount(filteredMessages.length);
                }
                
                return filteredMessages;
              })()
                .map((message, index) => {
                  const isUser = message.role === 'user';
                  const isAssistant = message.role === 'assistant';
                  
                  return (
                    <div key={index} className="space-y-2">
                      {/* Message bubble */}
                      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div 
                          className={`rounded-lg p-4 max-w-[80%] ${
                            isUser ? 'bg-blue-500 text-white' : 'bg-muted'
                          }`}
                        >
                          <div className="text-sm whitespace-pre-wrap">{formatMessage(message.content)}</div>
                        </div>
                      </div>
                      
                      {/* Timestamp */}
                      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className="text-xs text-muted-foreground">
                          {message.timestamp ?? 'Unknown time'}
                        </div>
                      </div>
                      
                      {/* Feedback controls - only for assistant messages */}
                      {isAssistant && (
                        <div className="flex items-center space-x-4 ml-2 mt-1">
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
                              {message.comments && message.comments.length > 0 
                                ? `Comments (${message.comments.length})` 
                                : 'Add Comment'}
                            </span>
                          </Button>
                        </div>
                      )}
                      
                      {/* Comment input */}
                      {isAssistant && commentingOnIndex === index && (
                        <div className="ml-8 space-y-2 max-w-[80%]">
                          {/* Existing comments */}
                          {Array.isArray(message.comments) && message.comments.length > 0 && (
                            <div className="space-y-2">
                              {message.comments.map((comment, commentIndex) => (
                                <div key={commentIndex} className="bg-blue-100 border border-blue-200 rounded-md p-3 text-sm shadow-sm">
                                  {comment}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Comment form */}
                          <div className="flex flex-col space-y-2">
                            <Textarea 
                              placeholder="Add a comment..."
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
                                onClick={() => addComment(index)}
                                disabled={commentLoading || !newComment.trim()}
                                className="self-end"
                              >
                                {commentLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageCircle className="h-4 w-4 mr-2" />}
                                Send Comment
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
        </ScrollContainer>
      </CardContent>
    </Card>
  );
}
