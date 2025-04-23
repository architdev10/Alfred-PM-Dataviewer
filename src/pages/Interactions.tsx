import React from "react";
import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { ResponseCard } from "@/components/interactions/ResponseCard";
import { DataViewer } from "@/components/interactions/DataViewer";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue, 
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Filter, SortAsc, SortDesc, Loader2, List, Grid, ChevronDown, Check, CalendarIcon, User, MessageSquare, ThumbsUp, ThumbsDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Define the interaction type
interface Interaction {
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
}

// Fallback mock data in case API fails
const mockInteractions = [
  {
    id: "1",
    userPrompt: "Can you explain how quantum computing works?",
    aiResponse: "Quantum computing leverages the principles of quantum mechanics to process information. Unlike classical computers that use bits (0 or 1), quantum computers use quantum bits or qubits that can exist in multiple states simultaneously due to superposition. This allows quantum computers to perform certain calculations exponentially faster than classical computers.",
    timestamp: "Today at 14:32",
    agents: ["Search Agent", "Analysis Agent"],
    rating: "good" as const,
    comments: ["This explanation was clear and concise"],
    user: {
      name: "Alex Johnson",
      avatar: ""
    }
  },
  {
    id: "2",
    userPrompt: "Write a marketing email for our new product launch",
    aiResponse: "Subject: Introducing [Product] - The Revolution Is Here!\n\nDear [Customer],\n\nWe're thrilled to announce the launch of our groundbreaking new product, designed to transform the way you [benefit]. After months of development and testing, we're confident this will exceed your expectations.",
    timestamp: "Today at 12:15",
    agents: ["Creative Agent", "Marketing Assistant"],
    rating: "good" as const,
    comments: [],
    user: {
      name: "Sarah Miller",
      avatar: ""
    }
  },
];

export default function Interactions() {
  // Basic state
  const [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<"flat" | "hierarchical">("flat");
  const itemsPerPage = 5;
  
  // Filter dropdown state
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Advanced filter states
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [userFilter, setUserFilter] = useState<string>("all");
  const [feedbackFilter, setFeedbackFilter] = useState<string>("all");
  const [hasCommentsFilter, setHasCommentsFilter] = useState<boolean | null>(null);
  
  // Track active filters for badge display
  const getActiveFilterCount = () => {
    let count = 0;
    if (dateFilter) count++;
    if (userFilter !== "all") count++;
    if (feedbackFilter !== "all") count++;
    if (hasCommentsFilter !== null) count++;
    return count;
  };
  
  // Reset all filters
  const resetFilters = () => {
    setDateFilter(undefined);
    setUserFilter("all");
    setFeedbackFilter("all");
    setHasCommentsFilter(null);
  };
  
  useEffect(() => {
    const fetchInteractions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Using the Flask API endpoint
        const response = await fetch('http://127.0.0.1:3002/api/interactions');
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        setInteractions(data);
        setTotalPages(Math.ceil(data.length / itemsPerPage));
      } catch (err) {
        console.error('Failed to fetch interactions:', err);
        setError('Failed to load interactions. Using mock data instead.');
        setInteractions(mockInteractions);
      } finally {
        setLoading(false);
      }
    };
    
    fetchInteractions();
  }, []);
  
  // Apply all filters to interactions
  const filteredInteractions = interactions.filter(interaction => {
    // Legacy filter (from dropdown)
    if (filter !== 'all') {
      if (filter === 'good' && interaction.rating !== 'good') return false;
      if (filter === 'bad' && interaction.rating !== 'bad') return false;
      if (filter === 'unrated' && interaction.rating !== null) return false;
    }
    
    // Date filter
    if (dateFilter) {
      const interactionDate = new Date(interaction.timestamp);
      const filterDate = new Date(dateFilter);
      
      // Compare year, month, and day only
      if (
        interactionDate.getFullYear() !== filterDate.getFullYear() ||
        interactionDate.getMonth() !== filterDate.getMonth() ||
        interactionDate.getDate() !== filterDate.getDate()
      ) {
        return false;
      }
    }
    
    // User filter
    if (userFilter !== 'all' && interaction.user?.name !== userFilter) {
      return false;
    }
    
    // No role filter - removed as requested
    
    // Feedback filter
    if (feedbackFilter !== 'all') {
      if (feedbackFilter === 'good' && interaction.rating !== 'good') return false;
      if (feedbackFilter === 'bad' && interaction.rating !== 'bad') return false;
      if (feedbackFilter === 'none' && interaction.rating !== null) return false;
    }
    
    // Has comments filter
    if (hasCommentsFilter !== null) {
      const hasComments = interaction.comments && interaction.comments.length > 0;
      if (hasCommentsFilter && !hasComments) return false;
      if (!hasCommentsFilter && hasComments) return false;
    }
    
    return true;
  });
  
  // Sort interactions based on selected sort order
  const sortedInteractions = [...filteredInteractions].sort((a, b) => {
    if (sortOrder === 'newest') {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    } else {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    }
  });
  
  // Paginate interactions
  const paginatedInteractions = sortedInteractions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  return (
    <div className="h-full">
      <Header 
        title="User Interactions" 
        description="View and analyze conversation history from MongoDB"
      >
        <div className="flex items-center gap-2">
          {viewMode === "flat" && (
            <>
              <Popover open={showFilterDropdown} onOpenChange={setShowFilterDropdown}>
                <PopoverTrigger asChild>
                  <Button 
                    ref={filterButtonRef}
                    variant="outline" 
                    size="sm" 
                    className={cn("h-9 gap-1", getActiveFilterCount() > 0 ? "bg-primary/10" : "")}
                  >
                    <Filter className="h-4 w-4" /> 
                    <span>Filter</span>
                    {getActiveFilterCount() > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 px-1 text-xs">
                        {getActiveFilterCount()}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search filters..." />
                    <CommandList>
                      <CommandEmpty>No results found.</CommandEmpty>
                      
                      {/* Date filter */}
                      <CommandGroup heading="Date">
                        <div className="p-3">
                          <Calendar
                            mode="single"
                            selected={dateFilter}
                            onSelect={setDateFilter}
                            className="rounded-md border shadow"
                          />
                          {dateFilter && (
                            <div className="mt-2 flex justify-between">
                              <span className="text-sm text-muted-foreground">
                                Filtered by: {format(dateFilter, "PPP")}
                              </span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setDateFilter(undefined)}
                                className="h-auto p-1"
                              >
                                Clear
                              </Button>
                            </div>
                          )}
                        </div>
                      </CommandGroup>
                      
                      <CommandSeparator />
                      
                      {/* User filter */}
                      <CommandGroup heading="User">
                        <CommandItem 
                          onSelect={() => setUserFilter("all")} 
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <User className="mr-2 h-4 w-4" />
                            <span>All Users</span>
                          </div>
                          {userFilter === "all" && <Check className="h-4 w-4" />}
                        </CommandItem>
                        {/* Dynamically generated from unique users */}
                        {Array.from(new Set(interactions.map(i => i.user?.name).filter(Boolean)))
                          .map(username => (
                            <CommandItem 
                              key={username} 
                              onSelect={() => setUserFilter(username || "all")}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center">
                                <User className="mr-2 h-4 w-4" />
                                <span>{username}</span>
                              </div>
                              {userFilter === username && <Check className="h-4 w-4" />}
                            </CommandItem>
                          ))
                        }
                      </CommandGroup>
                      
                      <CommandSeparator />
                      
                      {/* Sort Order */}
                      <CommandGroup heading="Sort Order">
                        <CommandItem 
                          onSelect={() => setSortOrder("newest")} 
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <SortDesc className="mr-2 h-4 w-4" />
                            <span>Latest First</span>
                          </div>
                          {sortOrder === "newest" && <Check className="h-4 w-4" />}
                        </CommandItem>
                        <CommandItem 
                          onSelect={() => setSortOrder("oldest")} 
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <SortAsc className="mr-2 h-4 w-4" />
                            <span>Oldest First</span>
                          </div>
                          {sortOrder === "oldest" && <Check className="h-4 w-4" />}
                        </CommandItem>
                      </CommandGroup>
                      
                      <CommandSeparator />
                      
                      {/* Feedback filter */}
                      <CommandGroup heading="Feedback">
                        <CommandItem 
                          onSelect={() => setFeedbackFilter("all")} 
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <span>All Feedback</span>
                          </div>
                          {feedbackFilter === "all" && <Check className="h-4 w-4" />}
                        </CommandItem>
                        <CommandItem 
                          onSelect={() => setFeedbackFilter("good")} 
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <ThumbsUp className="mr-2 h-4 w-4 text-green-500" />
                            <span>Good Feedback</span>
                          </div>
                          {feedbackFilter === "good" && <Check className="h-4 w-4" />}
                        </CommandItem>
                        <CommandItem 
                          onSelect={() => setFeedbackFilter("bad")} 
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <ThumbsDown className="mr-2 h-4 w-4 text-red-500" />
                            <span>Bad Feedback</span>
                          </div>
                          {feedbackFilter === "bad" && <Check className="h-4 w-4" />}
                        </CommandItem>
                        <CommandItem 
                          onSelect={() => setFeedbackFilter("none")} 
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <span>No Feedback</span>
                          </div>
                          {feedbackFilter === "none" && <Check className="h-4 w-4" />}
                        </CommandItem>
                      </CommandGroup>
                      
                      <CommandSeparator />
                      
                      {/* Has comments filter */}
                      <CommandGroup heading="Comments">
                        <CommandItem 
                          onSelect={() => setHasCommentsFilter(null)} 
                          className="flex items-center justify-between"
                        >
                          <span>All Interactions</span>
                          {hasCommentsFilter === null && <Check className="h-4 w-4" />}
                        </CommandItem>
                        <CommandItem 
                          onSelect={() => setHasCommentsFilter(true)} 
                          className="flex items-center justify-between"
                        >
                          <span>Has Comments</span>
                          {hasCommentsFilter === true && <Check className="h-4 w-4" />}
                        </CommandItem>
                        <CommandItem 
                          onSelect={() => setHasCommentsFilter(false)} 
                          className="flex items-center justify-between"
                        >
                          <span>No Comments</span>
                          {hasCommentsFilter === false && <Check className="h-4 w-4" />}
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                    
                    <div className="border-t p-2 flex justify-between">
                      <div className="text-xs text-muted-foreground pt-2">
                        {getActiveFilterCount()} active filters
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={resetFilters}
                      >
                        Reset Filters
                      </Button>
                    </div>
                  </Command>
                </PopoverContent>
              </Popover>

            </>
          )}
          <div className="border rounded-md overflow-hidden">
            <Button 
              variant={viewMode === "flat" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("flat")}
            >
              <Grid className="h-4 w-4 mr-1" /> Flat View
            </Button>
            <Button 
              variant={viewMode === "hierarchical" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => setViewMode("hierarchical")}
            >
              <List className="h-4 w-4 mr-1" /> Hierarchical View
            </Button>
          </div>
        </div>
      </Header>
      
      <div className="flex-1 overflow-hidden flex flex-col" ref={containerRef}>
        {viewMode === "flat" ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <Card className="border-dashed">
                <CardContent className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {dateFilter && (
                      <Badge variant="secondary" className="px-2 py-1">
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {format(dateFilter, "MMM d, yyyy")}
                        <button 
                          className="ml-1 text-muted-foreground hover:text-foreground" 
                          onClick={() => setDateFilter(undefined)}
                        >
                          ×
                        </button>
                      </Badge>
                    )}
                    
                    {userFilter !== "all" && (
                      <Badge variant="secondary" className="px-2 py-1">
                        <User className="mr-1 h-3 w-3" />
                        {userFilter}
                        <button 
                          className="ml-1 text-muted-foreground hover:text-foreground" 
                          onClick={() => setUserFilter("all")}
                        >
                          ×
                        </button>
                      </Badge>
                    )}
                    
                    {feedbackFilter !== "all" && (
                      <Badge variant="secondary" className="px-2 py-1">
                        {feedbackFilter === "good" ? (
                          <ThumbsUp className="mr-1 h-3 w-3 text-green-500" />
                        ) : feedbackFilter === "bad" ? (
                          <ThumbsDown className="mr-1 h-3 w-3 text-red-500" />
                        ) : (
                          <span className="mr-1">No feedback</span>
                        )}
                        {feedbackFilter}
                        <button 
                          className="ml-1 text-muted-foreground hover:text-foreground" 
                          onClick={() => setFeedbackFilter("all")}
                        >
                          ×
                        </button>
                      </Badge>
                    )}
                    
                    <Badge variant="secondary" className="px-2 py-1">
                      {sortOrder === "newest" ? (
                        <>
                          <SortDesc className="mr-1 h-3 w-3" />
                          Latest First
                        </>
                      ) : (
                        <>
                          <SortAsc className="mr-1 h-3 w-3" />
                          Oldest First
                        </>
                      )}
                    </Badge>
                    
                    {hasCommentsFilter !== null && (
                      <Badge variant="secondary" className="px-2 py-1">
                        {hasCommentsFilter ? "Has comments" : "No comments"}
                        <button 
                          className="ml-1 text-muted-foreground hover:text-foreground" 
                          onClick={() => setHasCommentsFilter(null)}
                        >
                          ×
                        </button>
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{paginatedInteractions.length}</span> of <span className="font-medium">{filteredInteractions.length}</span> interactions
              </div>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading interactions from MongoDB...</span>
              </div>
            ) : error ? (
              <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
                {error}
              </div>
            ) : paginatedInteractions.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                No interactions found. Try changing your filter criteria.
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedInteractions.map((interaction) => (
                  <ResponseCard
                    key={interaction.id}
                    id={interaction.id}
                    userPrompt={interaction.userPrompt}
                    aiResponse={interaction.aiResponse}
                    timestamp={interaction.timestamp}
                    agents={interaction.agents}
                    rating={interaction.rating}
                    comments={interaction.comments}
                    user={interaction.user}
                  />
                ))}
              </div>
            )}
            
            {totalPages > 1 && (
              <div className="mt-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) setCurrentPage(currentPage - 1);
                        }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                      const pageNum = i + 1;
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink 
                            href="#" 
                            isActive={pageNum === currentPage}
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(pageNum);
                            }}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    {totalPages > 5 && <PaginationItem><PaginationEllipsis /></PaginationItem>}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                        }}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        ) : (
          <DataViewer />
        )}
      </div>
    </div>
  );
}
