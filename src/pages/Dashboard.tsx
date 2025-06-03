import { useEffect, useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/ui/stat-card";
import { AreaChart } from "@/components/dashboard/AreaChart";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { MessageSquare, Users, ThumbsUp, ThumbsDown, BarChart3, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// API Endpoint
const API_BASE_URL = 'http://127.0.0.1:3002';

// Time period options
const TIME_PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

export default function Dashboard() {
  // State for analytics data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState('monthly');
  
  // Analytics metrics
  const [satisfactionRatio, setSatisfactionRatio] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [totalInteractions, setTotalInteractions] = useState(0);
  const [responseRate, setResponseRate] = useState(0);
  const [feedbackTrends, setFeedbackTrends] = useState<any[]>([]);
  const [commentActivity, setCommentActivity] = useState<any[]>([]);
  const [responseQuality, setResponseQuality] = useState<any[]>([]);
  const [userRatios, setUserRatios] = useState<any[]>([]);
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [commentMessages, setCommentMessages] = useState<any[]>([]);
  const [statsData, setStatsData] = useState<any>(null);
  
  // Mock response quality data (would come from API)
  const [ratingDistribution, setRatingDistribution] = useState([
    { name: "Good", value: 75, color: "#22c55e" },
    { name: "Bad", value: 15, color: "#ef4444" },
    { name: "No Rating", value: 10, color: "#94a3b8" }
  ]);

  // Fetch analytics data
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch overall satisfaction statistics
      const statsResponse = await fetch(`${API_BASE_URL}/api/stats`);
      if (!statsResponse.ok) throw new Error('Failed to fetch overall stats');
      const statsData = await statsResponse.json();
      
      // Set metrics from stats API
      setStatsData(statsData);
      setActiveUsers(statsData.activeUsers || 0);
      
      // Ensure totalInteractions is a valid number
      const interactions = typeof statsData.totalInteractions === 'number' 
        ? statsData.totalInteractions 
        : parseInt(statsData.totalInteractions) || 0;
      
      setTotalInteractions(interactions);
      setResponseRate(statsData.responseRate);
      setTotalComments(statsData.commentsCount);
      
      // Fetch ratings distribution
      const ratingsResponse = await fetch(`${API_BASE_URL}/api/ratings`);
      if (!ratingsResponse.ok) throw new Error('Failed to fetch ratings');
      const ratingsData = await ratingsResponse.json();
      
      // Debug the ratings data
      console.log("Ratings data received:", ratingsData);
      
      // Calculate satisfaction ratio
      const totalRatings = ratingsData.good + ratingsData.bad + ratingsData.neutral;
      const satRatio = totalRatings > 0 ? (ratingsData.good / totalRatings) * 100 : 0;
      setSatisfactionRatio(Math.round(satRatio));
      
      // Set rating distribution for donut chart
      const newRatingDistribution = [
        { name: "Good", value: ratingsData.good, color: "#22c55e" },
        { name: "Bad", value: ratingsData.bad, color: "#ef4444" },
        { name: "No Rating", value: ratingsData.neutral, color: "#94a3b8" }
      ];
      console.log("Setting rating distribution:", newRatingDistribution);
      setRatingDistribution(newRatingDistribution);
      
      // Set likes and dislikes
      setLikes(ratingsData.good);
      setDislikes(ratingsData.bad);
      
      // Fetch interactions to get comments data
      const interactionsResponse = await fetch(`${API_BASE_URL}/api/interactions`);
      if (!interactionsResponse.ok) throw new Error('Failed to fetch interactions');
      const interactionsData = await interactionsResponse.json();
      
      // Filter interactions with comments
      const messagesWithComments = interactionsData.filter(interaction => 
        interaction.comments && interaction.comments.length > 0
      );
      
      // Set messages with comments for dropdown
      setCommentMessages(messagesWithComments.map(msg => ({
        id: msg.id,
        text: msg.aiResponse ? 
          (msg.aiResponse.substring(0, 50) + (msg.aiResponse.length > 50 ? '...' : '')) : 
          'No response text',
        comments: msg.comments ? msg.comments.length : 0
      })));
      
      // Fetch feedback trends data
      const trendsResponse = await fetch(`${API_BASE_URL}/api/interactions-over-time?period=${timePeriod}`);
      if (trendsResponse.ok) {
        const trendsData = await trendsResponse.json();
        setFeedbackTrends(trendsData);
      }
      
      // Fetch comment activity data
      const commentActivityResponse = await fetch(`${API_BASE_URL}/api/comment-activity?period=${timePeriod}`);
      if (commentActivityResponse.ok) {
        const commentActivityData = await commentActivityResponse.json();
        setCommentActivity(commentActivityData);
      }
      
      // Fetch user ratios data
      const userRatiosResponse = await fetch(`${API_BASE_URL}/api/user-ratios`);
      if (userRatiosResponse.ok) {
        const userRatiosData = await userRatiosResponse.json();
        setUserRatios(userRatiosData);
      }
      
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchAnalytics();
  }, [timePeriod]); // Refetch when time period changes
  
  const refreshData = () => {
    console.log("Manually refreshing dashboard data");
    // Reset all state values to force a complete refresh
    setActiveUsers(0);
    setTotalInteractions(0);
    setResponseRate(0);
    setTotalComments(0);
    setLikes(0);
    setDislikes(0);
    
    // Set loading and trigger a fresh data fetch
    setLoading(true);
    fetchAnalytics();
  };

  return (
    <div className="h-full">
      <Header 
        title="Feedback Analytics Dashboard" 
        description="Insights on user feedback and AI response quality"
      >
        <div className="flex gap-2">
          <Select 
            value={timePeriod} 
            onValueChange={setTimePeriod}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              {TIME_PERIODS.map(period => (
                <SelectItem key={period.value} value={period.value}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={refreshData}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>
      </Header>
      
      <div className="p-6">
        {/* Key Metrics Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <StatCard
            title="Total Interactions"
            value={totalInteractions.toLocaleString()}
            description={`${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)} interactions`}
            icon={<MessageSquare className="h-4 w-4" />}
            trend={{ 
              value: loading ? 0 : (statsData?.trends?.totalInteractions || 0), 
              positive: loading ? true : (statsData?.trends?.totalInteractions || 0) >= 0 
            }}
          />
          
          {/* Removed Total Feedback Count as requested */}
          
          <StatCard
            title="Response Rate"
            value={loading ? "" : `${responseRate}%`}
            description="Messages with feedback"
            icon={<BarChart3 className="h-4 w-4" />}
            trend={{ 
              value: loading ? 0 : (statsData?.trends?.responseRate || 0), 
              positive: loading ? false : (statsData?.trends?.responseRate || 0) >= 0 
            }}
          />
          
          <StatCard
            title="Active Users"
            value={activeUsers.toString()}
            description="Users providing feedback"
            icon={<Users className="h-4 w-4" />}
            trend={{ 
              value: loading ? 0 : (statsData?.trends?.activeUsers || 0), 
              positive: loading ? true : (statsData?.trends?.activeUsers || 0) >= 0 
            }}
          />
          
          <div className="relative">
            <StatCard
              title="Total Comments"
              value={totalComments.toString()}
              description="User feedback comments"
              icon={<MessageCircle className="h-4 w-4" />}
              trend={{ 
                value: loading ? 0 : (statsData?.trends?.commentsCount || 0), 
                positive: loading ? true : (statsData?.trends?.commentsCount || 0) >= 0 
              }}
            />
            {commentMessages.length > 0 && (
              <div className="absolute top-full left-0 w-full mt-1 z-10">
                <Select onValueChange={(value) => window.location.href = `/interactions?message=${value}`}>
                  <SelectTrigger className="w-full bg-white dark:bg-slate-900 text-xs">
                    <SelectValue placeholder="View conversations with comments" />
                  </SelectTrigger>
                  <SelectContent>
                    {commentMessages.map((msg) => (
                      <SelectItem key={msg.id} value={msg.id}>
                        <div className="flex justify-between items-center w-full">
                          <span className="truncate mr-2">{msg.text}</span>
                          <span className="bg-primary/10 text-primary text-xs rounded-full px-2">
                            {msg.comments} {msg.comments === 1 ? 'comment' : 'comments'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <StatCard
            title="Total Likes"
            value={likes.toString()}
            description="Positive ratings"
            icon={<ThumbsUp className="h-4 w-4" />}
            trend={{ 
              value: loading ? 0 : (statsData?.trends?.ratingsCount || 0), 
              positive: loading ? true : (statsData?.trends?.ratingsCount || 0) >= 0 
            }}
          />
          
          <StatCard
            title="Total Dislikes"
            value={dislikes.toString()}
            description="Negative ratings"
            icon={<ThumbsDown className="h-4 w-4" />}
            trend={{ 
              value: 0, 
              positive: false 
            }}
          />
        </div>
        
        {/* Chart Tabs */}
        <Tabs defaultValue="feedback-trends" className="mb-6">
          <TabsList className="mb-4">
            <TabsTrigger value="feedback-trends">Feedback Trends</TabsTrigger>
            <TabsTrigger value="comment-activity">Comment Activity</TabsTrigger>
            {/* <TabsTrigger value="response-quality">Response Quality</TabsTrigger> */}
          </TabsList>
          
          <TabsContent value="feedback-trends">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {loading ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Feedback Trends Over Time</CardTitle>
                      <Skeleton className="h-4 w-48" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-64 w-full" />
                    </CardContent>
                  </Card>
                ) : (
                  <AreaChart
                    title="Feedback Trends Over Time"
                    data={feedbackTrends}
                    description={`${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)} feedback activity`}
                    color="#8b5cf6"
                  />
                )}
              </div>
              <div>
                {loading ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Rating Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-64 w-full rounded-full" />
                    </CardContent>
                  </Card>
                ) : (
                  <DonutChart
                    title="Rating Distribution"
                    data={ratingDistribution}
                  />
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="comment-activity">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {loading ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Comment Activity Over Time</CardTitle>
                      <Skeleton className="h-4 w-48" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-64 w-full" />
                    </CardContent>
                  </Card>
                ) : (
                  <AreaChart
                    title="Comment Activity Over Time"
                    data={commentActivity}
                    description={`${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)} comment frequency`}
                    color="#3b82f6"
                  />
                )}
              </div>
              <div>
                {loading ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium">Comment-to-Message Ratio by User</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-64 w-full rounded-full" />
                    </CardContent>
                  </Card>
                ) : (
                  <DonutChart
                    title="Comment-to-Message Ratio by User"
                    data={userRatios}
                  />
                )}
              </div>
            </div>
          </TabsContent>
          
          {/* Response Quality section commented out as requested */}
          {/* <TabsContent value="response-quality">
            <div className="grid grid-cols-1 gap-6">
              {loading ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Response Quality Over Time</CardTitle>
                    <Skeleton className="h-4 w-48" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-64 w-full" />
                  </CardContent>
                </Card>
              ) : (
                <AreaChart
                  title="Response Quality Over Time"
                  data={responseQuality}
                  description={`${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)} quality score based on ratings`}
                  color="#22c55e"
                  height={400}
                />
              )}
            </div>
          </TabsContent> */}
        </Tabs>
        
        {/* Additional Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Feedback Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Most Active User</span>
                  <span className="text-sm">{loading ? <Skeleton className="h-4 w-24 inline-block" /> : "User A (45 comments)"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Average Comments Per User</span>
                  <span className="text-sm">{loading ? <Skeleton className="h-4 w-24 inline-block" /> : "12.3"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Highest Rated Session</span>
                  <span className="text-sm">{loading ? <Skeleton className="h-4 w-24 inline-block" /> : "Session #A42F (98%)"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Most Commented Message</span>
                  <span className="text-sm">{loading ? <Skeleton className="h-4 w-24 inline-block" /> : "ID: 5f3e9 (8 comments)"}</span>
                </div>
              </div>
            </CardContent>
          </Card>           */}
          {/* <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Response Time Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <AreaChart
                  title=""
                  data={[
                    { date: "Mon", value: 1.2 },
                    { date: "Tue", value: 1.5 },
                    { date: "Wed", value: 1.8 },
                    { date: "Thu", value: 1.3 },
                    { date: "Fri", value: 1.6 },
                    { date: "Sat", value: 2.0 },
                    { date: "Sun", value: 1.7 }
                  ]}
                  description="Average response time in seconds"
                  color="#f97316"
                  height={240}
                />
              )}
            </CardContent>
          </Card> */}
        </div>
      </div>
    </div>
  );
}
