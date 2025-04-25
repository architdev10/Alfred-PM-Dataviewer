import { useState, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { CommentSection, FeedbackControls, StatusMessage } from "@/components/ui/feedback-elements";
import { postComment, postRating, getMessage } from "@/lib/api";
import { formatStructuredResponse } from "@/lib/formatters";

interface ResponseCardProps {
  id: string;
  userPrompt: string;
  aiResponse: string;
  timestamp: string;
  agents?: string[];
  rating?: 'good' | 'bad' | null;
  comments?: string[];
  user?: {
    name: string;
    avatar?: string;
  };
  className?: string;
}

export function ResponseCard({
  id,
  userPrompt,
  aiResponse,
  timestamp,
  agents = [],
  rating = null,
  comments = [],
  user,
  className
}: ResponseCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [localRating, setLocalRating] = useState<'good' | 'bad' | null>(rating);
  const [localComments, setLocalComments] = useState<string[]>(comments || []);
  const [commentLoading, setCommentLoading] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Sync local state with props only when props change
  useEffect(() => {
    setLocalRating(rating);
  }, [rating]);

  useEffect(() => {
    setLocalComments(comments || []);
  }, [comments]);
  
  const handleAddComment = async () => {
    const commentText = newComment.trim();
    if (!commentText) return;
    
    // Clear previous messages
    setError(null);
    setSuccessMessage(null);
    setCommentLoading(true);
    
    try {
      // Use shared API utility
      await postComment(id, commentText);
      
      // Only update local state after confirmed backend success
      setLocalComments(prev => [...prev, commentText]);
      setNewComment("");
      setSuccessMessage("Comment added successfully");
      
      // Fetch latest data to ensure sync with backend
      refreshData();
    } catch (error) {
      console.error('Add comment error:', error);
      setError(error instanceof Error ? error.message : 'Failed to add comment');
    } finally {
      setCommentLoading(false);
    }
  };
  
  // Function to refresh data from backend
  const refreshData = async () => {
    try {
      const data = await getMessage(id);
      // Update local state with fresh data
      setLocalComments(data.comments || []);
      setLocalRating(data.feedback || null);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  const handleRate = async (newRating: 'good' | 'bad' | null) => {
    // Clear previous messages
    setError(null);
    setSuccessMessage(null);
    setRateLoading(true);
    
    try {
      // Store current rating before updating
      const currentRating = localRating;
      
      // Optimistic UI update
      setLocalRating(newRating);
      
      // Use shared API utility
      await postRating(id, newRating);
      
      // Verify success response
      console.log('Rating updated successfully');
      setSuccessMessage("Rating updated successfully");
    } catch (error) {
      console.error('Rating update error:', error);
      // Revert to previous state on error
      setLocalRating(localRating);
      setError(error instanceof Error ? error.message : 'Failed to update rating');
    } finally {
      setRateLoading(false);
    }
  };

  return (
    <Card className={cn("mb-4", className)}>
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {user && (
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
            )}
            <div className="text-sm font-medium">{user?.name || "User"}</div>
          </div>
          <div className="text-xs text-muted-foreground">{timestamp}</div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4">
        <div className="space-y-4">
          <div>
            <p className="font-medium text-muted-foreground text-xs mb-1">User Prompt:</p>
            <div className="bg-muted p-3 rounded-md text-sm">{userPrompt}</div>
          </div>
          
          <div>
            <p className="font-medium text-muted-foreground text-xs mb-1">AI Response:</p>
            <div className="bg-primary/10 p-3 rounded-md text-sm whitespace-pre-line">
              {formatStructuredResponse(aiResponse)}
            </div>
          </div>
        </div>
        
        {agents.length > 0 && (
          <div className="mt-4">
            <p className="font-medium text-muted-foreground text-xs mb-1">Agents Invoked:</p>
            <div className="flex flex-wrap gap-1">
              {agents.map((agent) => (
                <span key={agent} className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs">
                  {agent}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col items-start border-t pt-3">
        {/* Error and success messages */}
        <StatusMessage error={error} success={successMessage} />
        
        {/* Feedback controls */}
        <FeedbackControls
          rating={localRating}
          rateLoading={rateLoading}
          commentCount={localComments.length}
          showComments={showComments}
          onToggleComments={() => setShowComments(!showComments)}
          onRate={handleRate}
        />
        
        {showComments && (
          <CommentSection
            comments={localComments}
            showComments={showComments}
            newComment={newComment}
            commentLoading={commentLoading}
            onCommentChange={setNewComment}
            onAddComment={handleAddComment}
            className="mt-3"
          />
        )}
      </CardFooter>
    </Card>
  );
}
