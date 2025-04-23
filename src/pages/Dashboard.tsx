
import { useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { StatCard } from "@/components/ui/stat-card";
import { AreaChart } from "@/components/dashboard/AreaChart";
import { DonutChart } from "@/components/dashboard/DonutChart";
import { MessageSquare, Users, ThumbsUp, ThumbsDown } from "lucide-react";

// Mock data
const INTERACTIONS_DATA = [
  { date: "Jan", value: 120 },
  { date: "Feb", value: 150 },
  { date: "Mar", value: 180 },
  { date: "Apr", value: 220 },
  { date: "May", value: 300 },
  { date: "Jun", value: 250 },
  { date: "Jul", value: 280 }
];

const RESPONSE_RATING_DATA = [
  { name: "Good", value: 75, color: "#22c55e" },
  { name: "Bad", value: 15, color: "#ef4444" },
  { name: "Neutral", value: 10, color: "#94a3b8" }
];

const AGENT_USAGE_DATA = [
  { name: "Search Agent", value: 40, color: "#8b5cf6" },
  { name: "Analysis Agent", value: 30, color: "#3b82f6" },
  { name: "Calculator", value: 15, color: "#14b8a6" },
  { name: "Calendar", value: 15, color: "#f97316" }
];

export default function Dashboard() {
  return (
    <div className="h-full">
      <Header 
        title="Analytics Dashboard" 
        description="Overview of your AI interactions and insights"
      />
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="Total Interactions"
            value=""
            description="Last 30 days"
            icon={<MessageSquare className="h-4 w-4" />}
            trend={{ value: 12, positive: true }}
          />
          <StatCard
            title="Active Users"
            value="1,203"
            description="Last 30 days"
            icon={<Users className="h-4 w-4" />}
            trend={{ value: 8, positive: true }}
          />
          <StatCard
            title="Positive Responses"
            value="75%"
            description="Rating proportion"
            icon={<ThumbsUp className="h-4 w-4" />}
            trend={{ value: 2, positive: true }}
          />
          <StatCard
            title="Negative Responses"
            value="15%"
            description="Rating proportion"
            icon={<ThumbsDown className="h-4 w-4" />}
            trend={{ value: 3, positive: false }}
          />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <AreaChart
              title="Interactions Over Time"
              data={INTERACTIONS_DATA}
              description="Total number of user-AI interactions"
              color="#8b5cf6"
            />
          </div>
          <div>
            <DonutChart
              title="Response Ratings"
              data={RESPONSE_RATING_DATA}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <DonutChart
              title="Agent Usage Distribution"
              data={AGENT_USAGE_DATA}
            />
          </div>
          <div>
            <AreaChart
              title="Agent Invocations"
              data={useMemo(() => INTERACTIONS_DATA.map(item => ({
                date: item.date,
                value: Math.floor(item.value * 0.7)
              })), [])}
              description="Number of agent invocations"
              color="#3b82f6"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
