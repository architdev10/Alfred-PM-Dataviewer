import React, { useCallback } from 'react';

const CommentsContext = React.createContext();

const CommentsProvider = ({ children }) => {
  const [comments, setComments] = React.useState([]);

  const refreshComments = useCallback(async () => {
    // Fetch fresh comments from API
    const response = await fetch('/api/comments');
    const data = await response.json();
    setComments(data);
  }, []);

  const addComment = (comment) => {
    // Implementation of adding a comment
  };

  return (
    <CommentsContext.Provider value={{ comments, addComment, refreshComments }}>
      {children}
    </CommentsContext.Provider>
  );
};

export default CommentsProvider;

export const useCommentsContext = () => {
  const context = React.useContext(CommentsContext);
  if (context === undefined) {
    throw new Error('useCommentsContext must be used within a CommentsProvider');
  }
  return context;
}; 