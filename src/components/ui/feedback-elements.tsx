import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { BadgeButton } from "@/components/ui/badge-button";
import { ThumbsUp, ThumbsDown, MessageSquare, CornerDownLeft } from "lucide-react";

interface CommentSectionProps {
  comments: string[];
  showComments: boolean;
  newComment: string;
  commentLoading: boolean;
  onCommentChange: (value: string) => void;
  onAddComment: () => void;
  className?: string;
}

export function CommentSection({
  comments,
  showComments,
  newComment,
  commentLoading,
  onCommentChange,
  onAddComment,
  className = ""
}: CommentSectionProps) {
  return (
    <div className={`mt-3 w-full space-y-3 ${className}`}>
      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map((comment, index) => (
            <div key={index} className="rounded-md bg-blue-100 border border-blue-200 p-3 text-sm shadow-sm mb-2">
              {comment}
            </div>
          ))}
        </div>
      )}
      
      <div className="flex space-x-2">
        <Textarea
          placeholder="Add a comment..."
          className="min-h-[60px] text-sm"
          value={newComment}
          onChange={(e) => onCommentChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onAddComment();
            }
          }}
          disabled={commentLoading}
        />
        <Button size="sm" onClick={onAddComment} className="h-auto" disabled={commentLoading}>
          {commentLoading ? (
            <span className="animate-pulse">...</span>
          ) : (
            <CornerDownLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

interface FeedbackControlsProps {
  rating: 'good' | 'bad' | null;
  rateLoading: boolean;
  commentCount: number;
  showComments: boolean;
  onToggleComments: () => void;
  onRate: (rating: 'good' | 'bad' | null) => void;
  className?: string;
}

export function FeedbackControls({
  rating,
  rateLoading,
  commentCount,
  showComments,
  onToggleComments,
  onRate,
  className = ""
}: FeedbackControlsProps) {
  return (
    <div className={`flex w-full items-center justify-between ${className}`}>
      <div className="flex items-center space-x-2">
        <BadgeButton 
          variant={rating === 'good' ? "success" : "outline"} 
          onClick={() => onRate(rating === 'good' ? null : 'good')}
          disabled={rateLoading}
        >
          {rateLoading ? (
            <span className="animate-pulse">Loading...</span>
          ) : (
            <>
              <ThumbsUp className="h-3 w-3 mr-1" /> Good
            </>
          )}
        </BadgeButton>
        <BadgeButton 
          variant={rating === 'bad' ? "destructive" : "outline"}
          onClick={() => onRate(rating === 'bad' ? null : 'bad')}
          disabled={rateLoading}
        >
          {rateLoading ? (
            <span className="animate-pulse">Loading...</span>
          ) : (
            <>
              <ThumbsDown className="h-3 w-3 mr-1" /> Bad
            </>
          )}
        </BadgeButton>
      </div>
      
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onToggleComments} 
        className="text-xs"
      >
        <MessageSquare className="h-3 w-3 mr-1" />
        {commentCount 
          ? `${commentCount} comment${commentCount > 1 ? 's' : ''}` 
          : 'Add comment'}
      </Button>
    </div>
  );
}

interface StatusMessageProps {
  error: string | null;
  success: string | null;
  className?: string;
}

export function StatusMessage({ error, success, className = "" }: StatusMessageProps) {
  if (!error && !success) return null;
  
  return (
    <>
      {error && (
        <div className={`w-full mb-2 p-2 bg-destructive/10 text-destructive text-sm rounded-md ${className}`}>
          {error}
        </div>
      )}
      {success && (
        <div className={`w-full mb-2 p-2 bg-green-100 text-green-800 text-sm rounded-md ${className}`}>
          {success}
        </div>
      )}
    </>
  );
}
