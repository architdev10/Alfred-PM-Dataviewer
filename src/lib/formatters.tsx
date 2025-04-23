import { Mail, CheckCircle2, CalendarClock, ClipboardList, User2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Helper function to infer function names from context
const inferFunctionsFromContext = (response: string): string[] => {
  const functions: string[] = [];
  
  // Check for email-related operations
  if (response.toLowerCase().includes('mail')) {
    functions.push('send_email');
  }
  
  // Check for specific function patterns in the response
  if (response.includes('send')) {
    functions.push('send_message');
  }
  
  // Add more context-specific function inference rules here
  if (response.includes('project') || response.includes('task')) {
    functions.push('create_task');
    functions.push('assign_task');
  }
  
  return functions;
};

// Basic message formatting
export const formatMessage = (content: string) => {
  if (!content) return '';
  
  // Handle simple string content
  if (typeof content === 'string') {
    return content;
  }
  
  // If it's an object, stringify it
  return JSON.stringify(content, null, 2);
};

// Function to format structured responses in a more readable way
export const formatStructuredResponse = (response: string) => {
  if (!response) return '';
  
  // Check if the response contains a project plan
  if (response.includes('<project_plan>') && response.includes('</project_plan>')) {
    try {
      // Extract the project plan content
      const planMatch = response.match(/<project_plan>([\s\S]*?)<\/project_plan>/i);
      if (!planMatch || !planMatch[1]) return formatMessage(response);
      
      const planContent = planMatch[1].trim();
      
      // Extract project ID and name
      const projectIdMatch = planContent.match(/projectID:\s*([\w_]+)/i);
      const projectNameMatch = planContent.match(/projectName:\s*([^\n]+)/i);
      
      const projectId = projectIdMatch ? projectIdMatch[1].trim() : 'Unknown';
      const projectName = projectNameMatch ? projectNameMatch[1].trim() : 'Unknown Project';
      
      // Extract the table content
      const tableMatch = planContent.match(/\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)\|\s*\n\s*\|\s*---\s*\|\s*---\s*\|\s*---\s*\|\s*---\s*\|\s*---\s*\|(([^<]+))/i);
      
      if (!tableMatch) return formatMessage(response);
      
      // Parse the table rows
      const tableContent = tableMatch[6].trim();
      const rows = tableContent.split('\n').map(row => {
        const cells = row.split('|').map(cell => cell.trim()).filter(cell => cell);
        return cells.length === 5 ? cells : null;
      }).filter(Boolean);
      
      // Create a formatted project plan component
      return (
        <div className="border rounded-md p-3 mb-3 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-5 w-5 text-primary" />
            <span className="font-medium text-base">{projectName}</span>
            <Badge variant="outline" className="ml-auto">
              Project ID: {projectId}
            </Badge>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dependencies</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{row[0]}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <User2 className="h-3 w-3" />
                      {row[1]}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {row[2]}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row[3].toLowerCase().includes('not') ? 'outline' : 'secondary'}>
                      {row[3]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{row[4]}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    } catch (e) {
      console.error('Error formatting project plan:', e);
      return formatMessage(response);
    }
  }
  
  // Check if the response contains empty function responses
  if (response.includes('function_response: status: success') && !response.includes('emails:')) {
    try {
      // Count how many function responses there are
      const matches = response.match(/function_response: status: success/g);
      const count = matches ? matches.length : 0;
      
      // Try to extract function names from the response
      let functionNames: string[] = [];
      
      // For the "send" command, we can infer it's related to sending emails
      if (response.toLowerCase().includes('mail') || response.match(/send/i)) {
        functionNames.push('send_email');
      }
      
      // Look for function names in the response text
      const functionPatterns = [
        // Try to match function names in various formats
        /function ([a-zA-Z0-9_]+) executed/gi,
        /([a-zA-Z0-9_]+)\(\) called/gi,
        /called ([a-zA-Z0-9_]+) function/gi,
        /executed ([a-zA-Z0-9_]+)/gi,
      ];
      
      // Apply each pattern and collect results
      functionPatterns.forEach(pattern => {
        const matches = [...response.matchAll(pattern)];
        if (matches.length > 0) {
          functionNames.push(...matches.map(match => match[1]));
        }
      });
      
      // If we still don't have function names, analyze the user prompt
      if (functionNames.length === 0) {
        // Based on the context of the conversation
        if (response.includes('function_response: status: success')) {
          // Extract the function name from the context
          const contextFunctions = inferFunctionsFromContext(response);
          if (contextFunctions.length > 0) {
            functionNames.push(...contextFunctions);
          }
        }
      }
      
      // Remove duplicates and ensure we have at least some function names
      functionNames = [...new Set(functionNames)];
      
      // If we still don't have function names, provide generic ones based on count
      if (functionNames.length === 0) {
        for (let i = 0; i < count; i++) {
          functionNames.push(`operation_${i+1}`);
        }
      }
      
      if (count > 0) {
        return (
          <div>
            <div className="mb-3">
              <Badge variant="outline" className="mb-2">
                <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                {count} Function{count !== 1 ? 's' : ''} Executed Successfully
              </Badge>
            </div>
            <div className="border rounded-md p-3 mb-3 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">All operations completed successfully</span>
              </div>
              
              <div className="mt-2">
                <p className="text-sm font-medium mb-1">Functions executed:</p>
                <div className="flex flex-wrap gap-1">
                  {functionNames.map((name, index) => (
                    <Badge key={index} variant="secondary" className="text-xs px-2 py-1">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }
    } catch (e) {
      console.error('Error formatting function response:', e);
      return formatMessage(response);
    }
  }
  
  // Check if the response contains email function responses
  if (response.includes('function_response: status: success emails:')) {
    try {
      // Split the response by function_response
      const parts = response.split('function_response: status: success emails:');
      
      // If there's only one part, return the original response
      if (parts.length <= 1) return formatMessage(response);
      
      // Format each email section
      const formattedEmails = parts.slice(1).map((part, index) => {
        try {
          // Extract the JSON-like structure
          const emailMatch = part.match(/\[\{.*?\}\]/s);
          if (!emailMatch) return null;
          
          // Parse the email data - handle the single quotes
          const emailText = emailMatch[0].replace(/'/g, '"');
          const emailData = JSON.parse(emailText);
          
          if (!emailData || !emailData.length) return null;
          
          const email = emailData[0];
          
          return (
            <div key={index} className="border rounded-md p-3 mb-3 bg-white">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-primary" />
                <span className="font-medium">Email Sent</span>
                <Badge variant="outline" className="ml-auto">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                  Success
                </Badge>
              </div>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">To:</span> {email.recipient}
                </div>
                <div>
                  <span className="font-medium">Subject:</span> {email.subject}
                </div>
                <Separator className="my-2" />
                <div className="whitespace-pre-line">{email.body}</div>
                
                {email.task_id && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Task ID: {email.task_id} | Project ID: {email.project_id}
                  </div>
                )}
              </div>
            </div>
          );
        } catch (e) {
          console.error('Error parsing email part:', e);
          return <div key={index}>{formatMessage(part)}</div>;
        }
      });
      
      // Filter out null values and return the formatted emails
      const validEmails = formattedEmails.filter(Boolean);
      if (validEmails.length === 0) return formatMessage(response);
      
      return (
        <div>
          <div className="mb-3">
            <Badge variant="outline" className="mb-2">
              <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
              {validEmails.length} Emails Sent Successfully
            </Badge>
          </div>
          {validEmails}
        </div>
      );
    } catch (e) {
      console.error('Error formatting email response:', e);
      return formatMessage(response);
    }
  }
  
  // If not a structured response, use the regular formatter
  return formatMessage(response);
};
