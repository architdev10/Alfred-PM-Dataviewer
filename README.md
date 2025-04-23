# DataViewer

A powerful dashboard for analyzing and managing AI conversation history with comprehensive filtering, visualization, and analytics capabilities.

## Project Overview

DataViewer is an advanced analytics dashboard designed for monitoring and analyzing AI interactions stored in MongoDB. The platform provides a comprehensive view of conversation data with powerful filtering, visualization, and analytical tools to help you understand user-AI interactions.

The dashboard allows you to:
- View conversations in both flat and hierarchical formats
- Apply multiple filters to isolate specific interactions
- Analyze patterns in AI responses
- Add comments and feedback to specific interactions
- View structured data (emails, project plans) in formatted displays

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui component library
- **State Management**: React Context API
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Backend**: Python with Flask
- **Database**: MongoDB
- **API Communication**: Axios

## Project Structure

```
dataviewer/
├── app.py                # Flask backend server
├── db.py                 # Database connection and utilities
├── public/               # Static assets
└── src/
    ├── components/       # Reusable UI components
    │   ├── common/       # Shared components
    │   └── interactions/ # Conversation-specific components
    ├── lib/              # Utility functions and helpers
    ├── pages/            # Main application pages
    ├── context/          # React context providers
    ├── formatters/       # Data formatting utilities
    ├── App.tsx           # Main application component
    └── main.tsx          # Application entry point
```

## Core Features

### Conversation Management
- **Conversation Viewer**: View and filter conversation history
- **Multiple View Modes**: Toggle between hierarchical and flat conversation views
- **Pagination**: Navigate through large datasets efficiently
- **Search**: Find specific content within conversations

### Filtering System
- **Comprehensive Filter UI**: Filter dropdown with multiple categories
- **Session ID Filtering**: Filter by specific conversation sessions
- **Role Filtering**: Filter messages by user, assistant, or system roles
- **Feedback Status Filtering**: View messages with specific feedback ratings
- **Date Filtering**: Filter conversations by date range
- **Sort Order Controls**: Arrange messages by timestamp (newest/oldest)
- **Active Filter Indicators**: Visual badges showing number of active filters
- **Filter Reset**: One-click filter removal and reset functionality
- **Message Count Indicators**: Shows how many messages match current filters

### Content Formatting
- **Centralized Formatting System**: Unified display of structured data
- **Email Response Formatting**: Visual card design for email content
- **Project Plan Formatting**: Structured table view for project plans
- **Empty Function Response Handling**: Clean display for function responses

### User Interaction
- **Commenting System**: Add and view comments on specific messages
- **Comment Submission**: Enhanced interface with "Send Comment" button
- **Keyboard Shortcuts**: Enter key submission (Shift+Enter for new lines)
- **Visual Feedback**: Loading indicators during comment submission

### UI Improvements
- **Scroll Overflow Fixes**: Custom ScrollContainer component with smooth scrolling
- **Mobile Experience**: Improved touch handling and responsive design
- **Performance Optimizations**: Fixed overflow issues to prevent unnecessary scrolling

## Key Files and Functionality

### Frontend

- **src/pages/Interactions.tsx**
  - Main page for viewing and filtering conversation history
  - Controls the layout and header components
  - Integrates filter dropdown UI

- **src/components/interactions/DataViewer.tsx**
  - Core component for displaying and managing conversation data
  - Implements comprehensive filtering logic
  - Handles hierarchical and flat view modes
  - Manages comment submission and feedback functionality

- **src/components/interactions/ResponseCard.tsx**
  - Renders individual conversation messages
  - Contains specialized formatting for different message types
  - Integrates with the centralized formatting system

- **src/formatters/formatters.tsx**
  - Centralized formatting system for structured data
  - Handles email, project plan, and function response formatting
  - Provides consistent display across all conversation views

- **src/context/FilterContext.tsx**
  - Manages filter state across components
  - Provides filter-related utilities and state management

### Backend

- **app.py**
  - Flask API endpoints for data retrieval and manipulation
  - Handles MongoDB connection and queries
  - Manages comment and feedback functionality
  - Implements CORS for cross-origin requests

- **db.py**
  - Database utility functions
  - Connection management and data access patterns

## Installation and Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/dataviewer.git
cd dataviewer
```

2. **Install frontend dependencies**

```bash
npm install
```

3. **Install backend dependencies**

```bash
pip install -r requirements.txt
```

4. **Configure MongoDB**

Create a `.env` file with your MongoDB connection details:

```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=dataviewer_db
```

5. **Run the development servers**

Frontend:
```bash
npm run dev
```

Backend:
```bash
python app.py
```

6. **Access the application**

Open your browser and navigate to `http://localhost:3000`

## Dependencies

### Frontend

| Dependency | Version | Purpose |
|------------|---------|----------|
| React | ^18.2.0 | UI framework |
| TypeScript | ^5.0.2 | Type safety |
| Tailwind CSS | ^3.3.0 | Styling |
| shadcn/ui | Latest | UI component library |
| Lucide React | ^0.274.0 | Icon library |
| date-fns | ^2.30.0 | Date utilities |
| Axios | ^1.4.0 | API requests |

### Backend

| Dependency | Version | Purpose |
|------------|---------|----------|
| Flask | ^2.0.1 | Web framework |
| PyMongo | ^4.3.3 | MongoDB interaction |
| python-dotenv | ^0.21.0 | Environment management |
| Flask-CORS | ^3.0.10 | Cross-origin resource sharing |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/conversations` | GET | Get conversation history with optional filters |
| `/api/conversations/:id` | GET | Get a specific conversation |
| `/api/comments/:message_id` | POST | Add a comment to a message |
| `/api/feedback/:message_id` | POST | Add feedback to a message |

## Component Breakdown

### DataViewer Component

The DataViewer component is the heart of the application, responsible for:

- **State Management**: Maintaining filter states, selected conversations, and UI modes
- **Data Fetching**: Retrieving conversation data from the backend
- **Filtering Logic**: Applying multiple filter types to narrow down displayed data
- **View Modes**: Switching between hierarchical and flat conversation views
- **Comment Management**: Adding and displaying comments on messages
- **Feedback System**: Recording and displaying user feedback
- **Pagination**: Handling large datasets with efficient navigation
- **Scroll Management**: Custom scroll container with improved UX

### Formatting System

The formatting system provides specialized rendering for structured data:

- **Email Formatter**: Parses and formats function_response email data
- **Project Plan Formatter**: Creates structured tables for project tasks
- **Function Response Formatter**: Handles empty function responses
- **Fallback Formatting**: Maintains standard formatting when needed

```tsx
// Example of the formatting system structure:
export function formatStructuredResponse(content: string): JSX.Element {
  // Detect and format emails
  if (content.includes('<email>') || content.includes('function_response') && content.includes('email')) {
    return formatEmailResponse(content);
  }
  
  // Detect and format project plans
  if (content.includes('<project_plan>')) {
    return formatProjectPlanResponse(content);
  }
  
  // Detect and format function responses
  if (content.includes('function_response: status: success')) {
    return formatFunctionResponse(content);
  }
  
  // Default formatting
  return <div className="whitespace-pre-wrap">{content}</div>;
}
```

### Filtering System

The filtering system includes:

- **Filter Button UI**: Modern interface with badge showing active filter count
- **Collapsible Filter Panel**: Toggle interface for filter controls
- **Session Filtering**: Filter by specific conversation sessions with descriptive labels
- **Role Filtering**: Filter by user, assistant, or system roles
- **Feedback Filtering**: View messages with specific feedback ratings
- **Sort Order Controls**: Arrange messages chronologically
- **Filter Reset**: One-click filter clearing functionality

## Code Examples

### Filter Implementation

```tsx
// DataViewer.tsx (simplified filtering logic)
const filteredMessages = useMemo(() => {
  return messages.filter(message => {
    // Session filter
    if (selectedSession && extractSessionId(message.id) !== selectedSession) {
      return false;
    }
    
    // Role filter
    if (selectedRole && message.role !== selectedRole) {
      return false;
    }
    
    // Feedback filter
    if (selectedFeedback) {
      if (selectedFeedback === 'good' && message.feedback !== 'good') {
        return false;
      }
      if (selectedFeedback === 'bad' && message.feedback !== 'bad') {
        return false;
      }
      if (selectedFeedback === 'none' && (message.feedback === 'good' || message.feedback === 'bad')) {
        return false;
      }
    }
    
    // System message filter (only show when specifically requested)
    if (!showSystemMessages && message.role === 'system') {
      return false;
    }
    
    return true;
  });
}, [messages, selectedSession, selectedRole, selectedFeedback, showSystemMessages]);
```

### Comment Submission

```tsx
// DataViewer.tsx (simplified comment submission)
const handleCommentSubmit = async (messageId: string, comment: string) => {
  setSubmitting(true);
  
  try {
    await axios.post(`/api/comments/${messageId}`, { comment });
    
    // Update local state to show the new comment
    setComments(prev => ({
      ...prev,
      [messageId]: [...(prev[messageId] || []), comment]
    }));
    
    // Clear the input field
    setCommentInput('');
  } catch (error) {
    console.error('Error submitting comment:', error);
  } finally {
    setSubmitting(false);
  }
};
```

## Scroll Handling

The application includes a comprehensive solution for scroll overflow issues:

```tsx
// ScrollContainer.tsx
export const ScrollContainer = ({ children, className }: Props) => {
  return (
    <div 
      className={cn("h-fit overflow-y-auto overscroll-none", className)}
      style={{ 
        scrollBehavior: 'smooth',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {children}
    </div>
  );
};
```

## Future Scope

- **Analytics Dashboard**: Add charts and graphs for conversation statistics
- **Export Functionality**: Allow exporting filtered data in various formats
- **Custom Tags**: Enable users to create custom tags for messages
- **Collaboration Features**: Add multi-user annotation capabilities
- **AI Insights**: Implement automated analysis of conversation patterns
- **Advanced Filtering**: Add text search and semantic filtering options
- **Theme Customization**: Allow users to switch between light and dark modes
- **Bulk Operations**: Enable bulk editing and management of conversations

## Troubleshooting

### Common Issues

**MongoDB Connection Problems**
- Ensure MongoDB is running on the correct port
- Check connection string in `.env` file
- Verify network connectivity to MongoDB server

**Missing Display Data**
- Clear browser cache and reload
- Check browser console for any JavaScript errors
- Verify API endpoints are returning expected data

**Filter Not Working**
- Reset all filters and try again
- Check browser console for filter-related errors
- Verify that the filter state is being properly updated

**Scroll Issues**
- Ensure scroll-fix.css is properly imported
- Check for CSS conflicts in custom styling
- Verify that ScrollContainer is used consistently throughout the application

**Formatting Problems**
- Check that formatters.tsx is imported correctly
- Verify the structure of data being processed
- Look for console errors related to JSON parsing

## Performance Considerations

- **Virtualization**: For large datasets, consider implementing virtualized lists
- **Pagination**: Limit the number of conversations loaded at once
- **Caching**: Implement client-side caching for frequently accessed data
- **Debouncing**: Add debounce to filter operations that trigger frequent re-renders
- **Code Splitting**: Use dynamic imports for less frequently used components

---

For additional support or feature requests, please submit an issue on the project repository or contact the development team.
