// DataViewer.tsx - Enhanced version with improved comment rendering
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ChevronLeft, MessageSquare, ThumbsUp, ThumbsDown, MessageCircle, Filter, ChevronDown, ChevronUp } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollContainer } from "@/components/ui/scroll-container";
import { toast } from "@/components/ui/use-toast";
import { formatStructuredResponse } from "@/lib/formatters";
import { Switch } from "@/components/ui/switch";

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
  sequence?: number;
}

// interface Message {
//   id: string;
//   role: 'user' | 'assistant' | 'system';
//   content: string;
//   timestamp?: string;
//   feedback?: 'good' | 'bad' | null;
//   comments?: string[];
//   sequence?: number;
// }

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

// const fetchMessages = async (userId: string, sessionId: string) => {
//   console.log(`Fetching messages for user ${userId}, session ${sessionId}`);
//   const response = await fetch(`${API_BASE_URL}/api/users/${userId}/sessions/${sessionId}`);
//   if (!response.ok) {
//     throw new Error(`Failed to fetch messages: ${response.status}`);
//   }
//   const data = await response.json();
//   console.log('Raw session data from API:', data);

//   // Ensure message IDs are correct
//   const processedMsgs = (data.messages || []).map((msg: any, index: number) => {
//     if (!msg.id || !msg.id.includes('_')) {
//       const correctId = `${userId}_${sessionId}_${index}`;
//       console.log(`Fixing message ID: ${msg.id} → ${correctId}`);
//       return { ...msg, id: correctId };
//     }
//     return msg;
//   });

//   return {
//     messages: processedMsgs,
//     projects: data.projects || [],
//     tasks: data.tasks || [],
//     emailThreadChain: data.email_thread_chain || [],
//     emailThreadId: data.email_thread_id || null
//   };
// };
const fetchMessages = async (userId: string, sessionId: string) => {
  console.log(`Fetching messages for user ${userId}, session ${sessionId}`);
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}/sessions/${sessionId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.status}`);
  }
  const data = await response.json();
  console.log('Raw session data from API:', data);

  // Ensure message IDs are correct and comments arrays exist
  const processedMsgs = (data.messages || []).map((msg: any, index: number) => {
    // Fix message ID if needed
    let correctId = msg.id;
    if (!correctId || !correctId.includes('_')) {
      correctId = `${userId}_${sessionId}_${index}`;
      console.log(`Fixing message ID: ${msg.id} → ${correctId}`);
    }
    
    // Ensure comments is an array
    let comments = msg.comments;
    if (!Array.isArray(comments)) {
      comments = [];
      console.log(`Initializing empty comments array for message ${correctId}`);
    }
    
    return {
      ...msg,
      id: correctId,
      comments: comments
    };
  });

  return {
    messages: processedMsgs,
    projects: data.projects || [],
    tasks: data.tasks || [],
    emailThreadChain: data.email_thread_chain || [],
    emailThreadId: data.email_thread_id || null
  };
};

const submitComment = async (messageId: string, comment: string) => {
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
  // API sync loading states - more granular loading states
  const [commentLoading, setCommentLoading] = useState<boolean>(false);
  const [rateLoading, setRateLoading] = useState<number | null>(null); // Track which message is being rated
  
  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<string>(new Date().toLocaleTimeString());
  
  // Filter states
  const [sessionFilter, setSessionFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest'>('oldest');
  const [filteredMessageCount, setFilteredMessageCount] = useState<number>(0);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  // Reset all filters to default values
  const resetFilters = () => {
    setSessionFilter('all');
    setRoleFilter('all');
    setFeedbackFilter('all');
    setSortOrder('oldest');
  };
  
  // Check if any filters are active
  const hasActiveFilters = () => {
    return sessionFilter !== 'all' || roleFilter !== 'all' || feedbackFilter !== 'all';
  };

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, []);
  
  // Auto-refresh useEffect
  useEffect(() => {
    // Skip if auto-refresh is disabled or no session is selected
    if (!autoRefreshEnabled || !selectedUser || !selectedSession) return;
    
    // Set up auto-refresh timer (every 30 seconds)
    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing messages...');
      refreshMessages();
      setLastRefreshTime(new Date().toLocaleTimeString());
    }, 30000); // 30 seconds
    
    // Clean up on unmount
    return () => clearInterval(refreshInterval);
  }, [autoRefreshEnabled, selectedUser, selectedSession]);

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
      try {
        toast({ 
          title: "Error", 
          description: "Failed to load users. Please check if the backend is running.", 
          variant: "destructive" 
        });
      } catch (e) {
        // Toast might not be available
      }
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
      try {
        toast({ 
          title: "Error", 
          description: "Failed to load sessions. Please check backend connection.", 
          variant: "destructive" 
        });
      } catch (e) {
        // Toast might not be available
      }
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
      const result = await fetchMessages(userId, sessionId);
      console.log('Received session data from API:', result);
      setMessages(result.messages || []);
      setProjects(result.projects || []);
      setTasks(result.tasks || []);
      setEmailThreadChain(result.emailThreadChain || []);
      setEmailThreadId(result.emailThreadId || null);
      setLastRefreshTime(new Date().toLocaleTimeString());
      
      // If messages array is empty, set a specific error message
      if (!result.messages || result.messages.length === 0) {
        setError('No messages found for this session.');
      }
    } catch (err) {
      console.error('Failed to fetch conversation:', err);
      setError('Failed to load conversation. Please check backend connection and try again.');
      try {
        toast({ 
          title: "Error", 
          description: "Failed to load conversation. Is the backend running?", 
          variant: "destructive" 
        });
      } catch (e) {
        // Toast might not be available
      }
    } finally {
      setLoading(false);
    }
  };

  // Refresh messages for current session
  // const refreshMessages = async () => {
  //   if (!selectedUser || !selectedSession) return;
    
  //   console.log('Refreshing messages for session:', selectedSession);
    
  //   try {
  //     const result = await fetchMessages(selectedUser, selectedSession);
  //     console.log('Refreshed session data:', result);
      
  //     // Process the messages to ensure all have proper comment arrays
  //     const processedMessages = (result.messages || []).map(msg => ({
  //       ...msg,
  //       comments: Array.isArray(msg.comments) ? msg.comments : []
  //     }));
      
  //     // Add this logging to debug comment issues
  //     console.log('Processed messages with comments:', 
  //       processedMessages.map(m => ({
  //         id: m.id, 
  //         commentCount: (m.comments || []).length,
  //         comments: m.comments
  //       }))
  //     );
      
  //     setMessages(processedMessages);
  //     setProjects(result.projects || []);
  //     setTasks(result.tasks || []);
  //     setEmailThreadChain(result.emailThreadChain || []);
  //     setEmailThreadId(result.emailThreadId || null);
      
  //     // Error handling
  //     if (!processedMessages || processedMessages.length === 0) {
  //       setError('No messages found for this session.');
  //     } else {
  //       setError(null);
  //     }
  //   } catch (err) {
  //     console.error('Failed to refresh messages:', err);
  //     setError('Failed to refresh conversation. Please check backend connection.');
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  const refreshMessages = async () => {
    if (!selectedUser || !selectedSession) return;
    
    console.log('Refreshing messages for session:', selectedSession);
    
    try {
      const result = await fetchMessages(selectedUser, selectedSession);
      console.log('Refreshed session data:', result);
      
      // Process the messages to ensure all have proper comment arrays
      const processedMessages = (result.messages || []).map(msg => {
        console.log(`Processing message ${msg.id}, comments:`, msg.comments);
        return {
          ...msg,
          comments: Array.isArray(msg.comments) ? [...msg.comments] : []
        };
      });
      
      // Explicitly log all messages with their comment arrays
      processedMessages.forEach(msg => {
        console.log(`Message ${msg.id} has ${(msg.comments || []).length} comments:`, 
                    JSON.stringify(msg.comments));
      });
      
      setMessages(processedMessages);
      setProjects(result.projects || []);
      setTasks(result.tasks || []);
      setEmailThreadChain(result.emailThreadChain || []);
      setEmailThreadId(result.emailThreadId || null);
      
      // Error handling
      if (!processedMessages || processedMessages.length === 0) {
        setError('No messages found for this session.');
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('Failed to refresh messages:', err);
      setError('Failed to refresh conversation. Please check backend connection.');
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
  // const addComment = async (messageIndex: number) => {
  //   if (!newComment.trim()) return;
  //   setCommentLoading(true);
    
  //   try {
  //     const msg = messages[messageIndex];
  //     console.log('Adding comment to message:', msg);
      
  //     // Extract user and session info from the message ID
  //     let messageId = msg.id;
      
  //     // If the ID doesn't contain underscores, construct it properly
  //     if (!messageId.includes('_') && selectedUser && selectedSession) {
  //       messageId = `${selectedUser}_${selectedSession}_${messageIndex}`;
  //       console.log('Constructed proper message ID:', messageId);
  //     }
      
  //     // Submit comment to backend
  //     await submitComment(messageId, newComment);
      
  //     // Update local state with new comment - ensure comments array exists
  //     const updatedMessages = [...messages];
  //     if (!Array.isArray(updatedMessages[messageIndex].comments)) {
  //       updatedMessages[messageIndex].comments = [];
  //     }
  //     updatedMessages[messageIndex].comments.push(newComment);
      
  //     setMessages(updatedMessages);
  //     setNewComment('');
      
  //     // Increase the delay before refreshing to ensure DB consistency
  //     setTimeout(() => {
  //       console.log('Refreshing messages after comment submission');
  //       refreshMessages();
  //     }, 800);
      
  //     // Toast notification
  //     try {
  //       toast({ 
  //         title: "Success", 
  //         description: "Comment added successfully" 
  //       });
  //     } catch (e) {
  //       // Toast might not be available
  //     }
  //   } catch (error) {
  //     console.error('Add comment error:', error);
  //     try {
  //       toast({ 
  //         title: "Error", 
  //         description: "Failed to save comment. Please try again.", 
  //         variant: "destructive" 
  //       });
  //     } catch (e) {
  //       // Toast might not be available
  //     }
  //   } finally {
  //     setCommentLoading(false);
  //   }
  // };
  // const addComment = async (messageIndex: number) => {
  //   if (!newComment.trim()) return;
  //   setCommentLoading(true);
    
  //   try {
  //     const msg = messages[messageIndex];
  //     console.log('Adding comment to message:', msg);
      
  //     // Extract user and session info from the message ID
  //     let messageId = msg.id;
      
  //     // If the ID doesn't contain underscores, construct it properly
  //     if (!messageId.includes('_') && selectedUser && selectedSession) {
  //       messageId = `${selectedUser}_${selectedSession}_${messageIndex}`;
  //       console.log('Constructed proper message ID:', messageId);
  //     }
      
  //     // Submit comment to backend
  //     await submitComment(messageId, newComment);
      
  //     // Update local state with new comment - ensure comments array exists
  //     const updatedMessages = [...messages];
  //     if (!Array.isArray(updatedMessages[messageIndex].comments)) {
  //       updatedMessages[messageIndex].comments = [];
  //     }
  //     updatedMessages[messageIndex].comments.push(newComment);
  //     setMessages(updatedMessages);
  //     setNewComment('');
  //     setCommentingOnIndex(null); // Close the comment input after submission
      
  //     console.log('Updated message with new comment:', updatedMessages[messageIndex]);
      
  //     // Add a more significant delay before refreshing to ensure DB consistency
  //     setTimeout(() => {
  //       console.log('Refreshing messages after comment submission');
  //       refreshMessages();
  //     }, 1000);
      
  //     try {
  //       toast({ 
  //         title: "Success", 
  //         description: "Comment added successfully" 
  //       });
  //     } catch (e) {
  //       // Toast might not be available
  //     }
  //   } catch (error) {
  //     console.error('Add comment error:', error);
  //     try {
  //       toast({ 
  //         title: "Error", 
  //         description: "Failed to save comment. Please try again.", 
  //         variant: "destructive" 
  //       });
  //     } catch (e) {
  //       // Toast might not be available
  //     }
  //   } finally {
  //     setCommentLoading(false);
  //   }
  // };
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
      
      try {
        toast({ 
          title: "Success", 
          description: "Comment added successfully" 
        });
      } catch (e) {
        // Toast might not be available
      }
    } catch (error) {
      console.error('Add comment error:', error);
      try {
        toast({ 
          title: "Error", 
          description: "Failed to save comment. Please try again.", 
          variant: "destructive" 
        });
      } catch (e) {
        // Toast might not be available
      }
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
      try {
        toast({ 
          title: "Success", 
          description: "Feedback updated successfully" 
        });
      } catch (e) {
        // Toast might not be available
      }
    } catch (error) {
      console.error('Rating update error:', error);
      try {
        toast({ 
          title: "Error", 
          description: "Failed to update rating. Please try again.", 
          variant: "destructive" 
        });
      } catch (e) {
        // Toast might not be available
      }
    } finally {
      setRateLoading(null);
    }
  };

  // // Render users view
  // if (view === 'users') {
  //   return (
  //     <Card className="h-full flex flex-col">
  //       <CardHeader className="border-b pb-3">
  //         <CardTitle>Users</CardTitle>
  //       </CardHeader>
  //       <CardContent className="flex-1 overflow-hidden">
  //         <ScrollContainer>
  //           {loading ? (
  //             <div className="flex justify-center items-center h-full">
  //               <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  //             </div>
  //           ) : error ? (
  //             <div className="text-center py-8 text-destructive">
  //               {error}
  //               <Button 
  //                 variant="outline" 
  //                 size="sm" 
  //                 className="mt-4" 
  //                 onClick={loadUsers}
  //               >
  //                 Retry
  //               </Button>
  //             </div>
  //           ) : users.length === 0 ? (
  //             <div className="text-center py-8 text-muted-foreground">
  //               No users found. Make sure the backend API is running.
  //             </div>
  //           ) : (
  //             <Table>
  //               <TableHeader>
  //                 <TableRow>
  //                   <TableHead>User ID</TableHead>
  //                   <TableHead className="text-right">Actions</TableHead>
  //                 </TableRow>
  //               </TableHeader>
  //               <TableBody>
  //                 {users.map((user) => (
  //                   <TableRow key={user.id}>
  //                     <TableCell>{user.id}</TableCell>
  //                     <TableCell className="text-right">
  //                       <Button 
  //                         variant="ghost" 
  //                         size="sm" 
  //                         onClick={() => selectUser(user.id)}
  //                       >
  //                         View Sessions
  //                       </Button>
  //                     </TableCell>
  //                   </TableRow>
  //                 ))}
  //               </TableBody>
  //             </Table>
  //           )}
  //         </ScrollContainer>
  //       </CardContent>
  //     </Card>
  //   );
  // }

  // // Render sessions view
  // if (view === 'sessions') {
  //   return (
  //     <Card className="h-full flex flex-col">
  //       <CardHeader className="border-b pb-3 flex flex-row items-center">
  //         <Button variant="ghost" size="icon" onClick={goBack} className="mr-2">
  //           <ChevronLeft className="h-4 w-4" />
  //         </Button>
  //         <CardTitle>Sessions for User {selectedUser}</CardTitle>
  //       </CardHeader>
  //       <CardContent className="flex-1 overflow-hidden">
  //         <ScrollContainer>
  //           {loading ? (
  //             <div className="flex justify-center items-center h-full">
  //               <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  //             </div>
  //           ) : error ? (
  //             <div className="text-center py-8 text-destructive">
  //               {error}
  //               <Button 
  //                 variant="outline" 
  //                 size="sm" 
  //                 className="mt-4" 
  //                 onClick={() => selectedUser && selectUser(selectedUser)}
  //               >
  //                 Retry
  //               </Button>
  //             </div>
  //           ) : sessions.length === 0 ? (
  //             <div className="text-center py-8 text-muted-foreground">
  //               No sessions found for this user
  //             </div>
  //           ) : (
  //             <Table>
  //               <TableHeader>
  //                 <TableRow>
  //                   <TableHead>Session ID</TableHead>
  //                   <TableHead>Messages</TableHead>
  //                   <TableHead>Created</TableHead>
  //                   <TableHead>Last Activity</TableHead>
  //                   <TableHead className="text-right">Actions</TableHead>
  //                 </TableRow>
  //               </TableHeader>
  //               <TableBody>
  //                 {sessions.map((session) => (
  //                   <TableRow key={session.id}>
  //                     <TableCell>{session.id}</TableCell>
  //                     <TableCell>{session.messageCount || 'Unknown'}</TableCell>
  //                     <TableCell>{session.createdAt || 'Unknown'}</TableCell>
  //                     <TableCell>{session.lastActivity || 'Unknown'}</TableCell>
  //                     <TableCell className="text-right">
  //                       <Button 
  //                         variant="ghost" 
  //                         size="sm" 
  //                         onClick={() => selectedUser && selectSession(selectedUser, session.id)}
  //                       >
  //                         View Conversation
  //                       </Button>
  //                     </TableCell>
  //                   </TableRow>
  //                 ))}
  //               </TableBody>
  //             </Table>
  //           )}
  //         </ScrollContainer>
  //       </CardContent>
  //     </Card>
  //   );
  // }

  // // Render conversation view
  // return (
  //   <Card className="h-full flex flex-col">
  //     <CardHeader className="border-b pb-3 flex flex-col space-y-4">
  //       <div className="flex flex-row items-center">
  //         <Button variant="ghost" size="icon" onClick={goBack} className="mr-2">
  //           <ChevronLeft className="h-4 w-4" />
  //         </Button>
  //         <CardTitle className="text-lg font-medium">
  //           Conversation for Session {selectedSession}
  //         </CardTitle>
  //         <Button 
  //           variant="outline" 
  //           size="sm" 
  //           className="ml-auto" 
  //           onClick={refreshMessages}
  //           disabled={loading}
  //         >
  //           {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
  //         </Button>
  //         <div className="flex items-center gap-2 ml-2">
  //           <Switch
  //             checked={autoRefreshEnabled}
  //             onCheckedChange={setAutoRefreshEnabled}
  //           />
  //           <span className="text-xs text-muted-foreground">
  //             Auto-refresh {autoRefreshEnabled ? "on" : "off"}
  //             {autoRefreshEnabled && lastRefreshTime && 
  //               ` (Last: ${lastRefreshTime})`}
  //           </span>
  //         </div>
  //       </div>
        
  //       {/* Filter Button */}
  //       <div className="flex items-center justify-between">
  //         <Button
  //           variant="outline"
  //           size="sm"
  //           className={`flex items-center gap-2 ${hasActiveFilters() ? 'bg-primary/10' : ''}`}
  //           onClick={() => setShowFilters(!showFilters)}
  //         >
  //           <Filter className="h-4 w-4" />
  //           <span>Filter</span>
  //           {hasActiveFilters() && (
  //             <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
  //               {Object.values([sessionFilter, roleFilter, feedbackFilter]).filter(f => f !== 'all').length}
  //             </Badge>
  //           )}
  //           {showFilters ? (
  //             <ChevronUp className="h-4 w-4" />
  //           ) : (
  //             <ChevronDown className="h-4 w-4" />
  //           )}
  //         </Button>
          
  //         {/* Filter Count Indicator */}
  //         <div className="text-xs text-muted-foreground">
  //           Showing {filteredMessageCount} message{filteredMessageCount !== 1 ? 's' : ''}
  //           {hasActiveFilters() && ' (filtered)'}
  //         </div>
  //       </div>
        
  //       {/* Collapsible Filter Panel */}
  //       {showFilters && (
  //         <div className="space-y-3 mt-3 p-3 border rounded-md bg-muted/30">
  //           <div className="flex flex-wrap gap-2">
  //             {/* Session Filter */}
  //             <div className="flex items-center space-x-2">
  //               <label className="text-sm font-medium">Session:</label>
  //               <select 
  //                 className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
  //                 value={sessionFilter}
  //                 onChange={(e) => setSessionFilter(e.target.value)}
  //               >
  //                 <option value="all">All Sessions</option>
  //                 {/* Only show sessions for the current user with better labels */}
  //                 {sessions.map(session => {
  //                   // Format date if available
  //                   const dateLabel = session.createdAt 
  //                     ? new Date(session.createdAt).toLocaleDateString() 
  //                     : '';
  //                   // Create a descriptive label
  //                   const label = `${session.id} ${dateLabel ? `(${dateLabel})` : ''}`;
  //                   return (
  //                     <option key={session.id} value={session.id}>{label}</option>
  //                   );
  //                 })}
  //               </select>
  //             </div>
              
  //             {/* Role Filter */}
  //             <div className="flex items-center space-x-2">
  //               <label className="text-sm font-medium">Role:</label>
  //               <select
  //                 className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
  //                 value={roleFilter}
  //                 onChange={(e) => setRoleFilter(e.target.value)}
  //               >
  //                 <option value="all">All Roles</option>
  //                 <option value="user">User</option>
  //                 <option value="assistant">Assistant</option>
  //                 <option value="system">System</option>
  //               </select>
  //             </div>
              
  //             {/* Feedback Filter */}
  //             <div className="flex items-center space-x-2">
  //               <label className="text-sm font-medium">Feedback:</label>
  //               <select
  //                 className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
  //                 value={feedbackFilter}
  //                 onChange={(e) => setFeedbackFilter(e.target.value)}
  //               >
  //                 <option value="all">All Feedback</option>
  //                 <option value="good">Good</option>
  //                 <option value="bad">Bad</option>
  //                 <option value="none">No Feedback</option>
  //               </select>
  //             </div>
              
  //             {/* Sort Order */}
  //             <div className="flex items-center space-x-2">
  //               <label className="text-sm font-medium">Sort:</label>
  //               <select
  //                 className="h-8 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background"
  //                 value={sortOrder}
  //                 onChange={(e) => setSortOrder(e.target.value as 'recent' | 'oldest')}
  //               >
  //                 <option value="recent">Recent First</option>
  //                 <option value="oldest">Oldest First</option>
  //               </select>
  //             </div>
              
  //             {/* Reset Button */}
  //             <Button 
  //               variant="outline" 
  //               size="sm" 
  //               onClick={resetFilters}
  //               className="ml-auto"
  //             >
  //               Reset Filters
  //             </Button>
  //           </div>
  //         </div>
  //       )}
  //     </CardHeader>
  //     <CardContent className="flex-1 overflow-hidden">
  //       <ScrollContainer>
  //         {loading ? (
  //           <div className="flex justify-center items-center h-full">
  //             <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  //             <span className="ml-2">Loading conversation data...</span>
  //           </div>
  //         ) : error ? (
  //           <div className="text-center py-8 text-destructive">
  //             <p>{error}</p>
  //             <Button 
  //               variant="outline" 
  //               size="sm" 
  //               className="mt-4" 
  //               onClick={() => selectedUser && selectedSession && selectSession(selectedUser, selectedSession)}
  //             >
  //               Retry
  //             </Button>
  //           </div>
  //         ) : (
  //           <div className="space-y-6" data-testid="message-container">
  //             {messages.length === 0 ? (
  //               <div className="text-center py-8 text-muted-foreground">
  //                 No messages found for this session. The session might be empty or there might be an issue with the data format.
  //               </div>
  //             ) : (
  //               // Apply filters and sorting
  //               (() => {
  //                 // First filter out system messages (unless specifically requested)
  //                 const filteredMessages = messages
  //                   .filter(message => roleFilter === 'system' ? true : message.role !== 'system')
  //                   // Apply session filter if not 'all' - using proper ID parsing
  //                   .filter(message => {
  //                     if (sessionFilter === 'all') return true;
  //                     // Extract session ID from message ID (format: userId_sessionId_index)
  //                     if (message.id && message.id.includes('_')) {
  //                       const parts = message.id.split('_');
  //                       return parts.length > 1 && parts[1] === sessionFilter;
  //                     }
  //                     return false;
  //                   })
  //                   // Apply role filter if not 'all'
  //                   .filter(message => roleFilter === 'all' || message.role === roleFilter)
  //                   // Apply feedback filter
  //                   .filter(message => {
  //                     if (feedbackFilter === 'all') return true;
  //                     if (feedbackFilter === 'none') return !message.feedback;
  //                     return message.feedback === feedbackFilter;
  //                   })
  //                   // Sort by timestamp (with fallback to sequence)
  //                   .sort((a, b) => {
  //                     // Parse timestamps to milliseconds
  //                     const parseTs = (msg) => {
  //                       const t = Date.parse(msg.timestamp);
  //                       return isNaN(t) ? (msg.sequence ?? 0) : t;
  //                     };
  //                     const aVal = parseTs(a);
  //                     const bVal = parseTs(b);
  //                     if (aVal !== bVal) {
  //                       return sortOrder === 'recent' ? bVal - aVal : aVal - bVal;
  //                     }
  //                     // Fallback to explicit sequence
  //                     return sortOrder === 'recent'
  //                       ? (b.sequence ?? 0) - (a.sequence ?? 0)
  //                       : (a.sequence ?? 0) - (b.sequence ?? 0);
  //                   });
                  
  //                 // Update the filtered message count for the indicator
  //                 if (filteredMessageCount !== filteredMessages.length) {
  //                   setFilteredMessageCount(filteredMessages.length);
  //                 }
                  
  //                 return filteredMessages;
  //               })()
  //                 .map((message, index) => {
  //                   const isUser = message.role === 'user';
  //                   const isAssistant = message.role === 'assistant';
                    
  //                   return (
  //                     <div key={index} className="space-y-2">
  //                       {/* Message bubble */}
  //                       <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
  //                         <div 
  //                           className={`rounded-lg p-4 max-w-[80%] ${
  //                             isUser ? 'bg-blue-500 text-white' : 'bg-muted'
  //                           }`}
  //                         >
  //                           <div className="text-sm whitespace-pre-wrap">{formatMessage(message.content)}</div>
  //                         </div>
  //                       </div>
                        
  //                       {/* Timestamp */}
  //                       <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
  //                         <div className="text-xs text-muted-foreground">
  //                           {message.timestamp ?? 'Unknown time'}
  //                         </div>
  //                       </div>
                        
  //                       {/* Feedback controls - only for assistant messages */}
  //                       {isAssistant && (
  //                         <div className="flex items-center space-x-4 ml-2 mt-1">
  //                           <div className="flex items-center space-x-2">
  //                             <Button 
  //                               variant="ghost" 
  //                               size="icon"
  //                               className={`h-8 w-8 ${message.feedback === 'good' ? 'text-green-500' : ''}`}
  //                               onClick={() => setFeedback(index, 'good')}
  //                               disabled={rateLoading === index}
  //                             >
  //                               <ThumbsUp className="h-4 w-4" />
  //                             </Button>
  //                             <Button 
  //                               variant="ghost" 
  //                               size="icon"
  //                               className={`h-8 w-8 ${message.feedback === 'bad' ? 'text-red-500' : ''}`}
  //                               onClick={() => setFeedback(index, 'bad')}
  //                               disabled={rateLoading === index}
  //                             >
  //                               <ThumbsDown className="h-4 w-4" />
  //                             </Button>
  //                           </div>
                            
  //                           <Button 
  //                             variant="ghost" 
  //                             size="sm"
  //                             className="flex items-center space-x-1"
  //                             onClick={() => setCommentingOnIndex(commentingOnIndex === index ? null : index)}
  //                           >
  //                             <MessageCircle className="h-4 w-4 mr-1" />
  //                             <span>
  //                               {message.comments && message.comments.length > 0 
  //                                 ? `Comments (${message.comments.length})` 
  //                                 : 'Add Comment'}
  //                             </span>
  //                           </Button>
  //                         </div>
  //                       )}
                        
  //                       {/* Comment section with improved headers */}
  //                       {isAssistant && commentingOnIndex === index && (
  //                         <div className="ml-8 space-y-2 max-w-[80%]">
  //                           {/* Existing comments with clearer header */}
  //                           {Array.isArray(message.comments) && message.comments.length > 0 && (
  //                             <div className="space-y-2">
  //                               <h4 className="text-sm font-medium text-muted-foreground border-b pb-1">
  //                                 Existing Comments ({message.comments.length})
  //                               </h4>
  //                               {message.comments.map((comment, commentIndex) => (
  //                                 <div key={commentIndex} className="bg-blue-100 border border-blue-200 rounded-md p-3 text-sm shadow-sm">
  //                                   {comment}
  //                                 </div>
  //                               ))}
  //                             </div>
  //                           )}
                            
  //                           {/* Comment form with better header */}
  //                           <div className="flex flex-col space-y-2 border-t pt-2 mt-2">
  //                             <h4 className="text-sm font-medium">Add New Comment</h4>
  //                             <Textarea 
  //                               placeholder="Enter your feedback here..."
  //                               value={newComment}
  //                               onChange={(e) => setNewComment(e.target.value)}
  //                               className="min-h-[80px] w-full"
  //                               onKeyDown={(e) => {
  //                                 if (e.key === 'Enter' && !e.shiftKey) {
  //                                   e.preventDefault();
  //                                   if (newComment.trim()) {
  //                                     addComment(index);
  //                                   }
  //                                 }
  //                               }}
  //                             />
  //                             <div className="flex justify-end space-x-2">
  //                               <Button
  //                                 variant="outline"
  //                                 size="sm"
  //                                 onClick={() => setCommentingOnIndex(null)}
  //                                 disabled={commentLoading}
  //                               >
  //                                 Cancel
  //                               </Button>
  //                               <Button 
  //                                 onClick={() => addComment(index)}
  //                                 disabled={commentLoading || !newComment.trim()}
  //                                 className="self-end"
  //                               >
  //                                 {commentLoading ? (
  //                                   <>
  //                                     <Loader2 className="h-4 w-4 animate-spin mr-2" />
  //                                     Saving...
  //                                   </>
  //                                 ) : (
  //                                   <>
  //                                     <MessageCircle className="h-4 w-4 mr-2" />
  //                                     Save Comment
  //                                   </>
  //                                 )}
  //                               </Button>
  //                             </div>
  //                           </div>
  //                         </div>
  //                       )}
  //                     </div>
  //                   );
  //                 })
  //             )}
  //           </div>
  //         )}
  //       </ScrollContainer>
  //     </CardContent>
  //   </Card>
  // );

  // Complete return/render section for DataViewer.tsx

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
        <div className="flex items-center gap-2 ml-2">
          <Switch
            checked={autoRefreshEnabled}
            onCheckedChange={setAutoRefreshEnabled}
          />
          <span className="text-xs text-muted-foreground">
            Auto-refresh {autoRefreshEnabled ? "on" : "off"}
            {autoRefreshEnabled && lastRefreshTime && 
              ` (Last: ${lastRefreshTime})`}
          </span>
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
                No messages found for this session. The session might be empty or there might be an issue with the data format.
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
                  // Sort by timestamp (with fallback to sequence)
                  .sort((a, b) => {
                    // Parse timestamps to milliseconds
                    const parseTs = (msg) => {
                      const t = Date.parse(msg.timestamp);
                      return isNaN(t) ? (msg.sequence ?? 0) : t;
                    };
                    const aVal = parseTs(a);
                    const bVal = parseTs(b);
                    if (aVal !== bVal) {
                      return sortOrder === 'recent' ? bVal - aVal : aVal - bVal;
                    }
                    // Fallback to explicit sequence
                    return sortOrder === 'recent'
                      ? (b.sequence ?? 0) - (a.sequence ?? 0)
                      : (a.sequence ?? 0) - (b.sequence ?? 0);
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
                      
                      {/* Comment section - MODIFIED: ALWAYS display existing comments */}
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
                      
                      {/* Comment section with improved headers (only when commenting) */}
                      {isAssistant && commentingOnIndex === index && (
                        <div className="ml-8 space-y-2 max-w-[80%]">
                          {/* Comment form with better header */}
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
  </Card>
);
}