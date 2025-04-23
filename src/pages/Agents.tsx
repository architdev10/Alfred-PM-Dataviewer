
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart } from "@/components/dashboard/AreaChart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { BrainCircuit, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

// Mock data
const agentData = [
  {
    id: "search-agent",
    name: "Search Agent",
    description: "Retrieves information from external knowledge sources",
    invocations: 3247,
    successRate: 94,
    avgResponseTime: "1.2s",
    color: "#8b5cf6",
    usageData: [
      { date: "Jan", value: 320 },
      { date: "Feb", value: 350 },
      { date: "Mar", value: 420 },
      { date: "Apr", value: 380 },
      { date: "May", value: 490 },
      { date: "Jun", value: 520 },
      { date: "Jul", value: 540 }
    ]
  },
  {
    id: "analysis-agent",
    name: "Analysis Agent",
    description: "Processes and analyzes complex data structures",
    invocations: 2158,
    successRate: 88,
    avgResponseTime: "2.3s",
    color: "#3b82f6",
    usageData: [
      { date: "Jan", value: 180 },
      { date: "Feb", value: 220 },
      { date: "Mar", value: 240 },
      { date: "Apr", value: 320 },
      { date: "May", value: 290 },
      { date: "Jun", value: 350 },
      { date: "Jul", value: 380 }
    ]
  },
  {
    id: "calculator",
    name: "Calculator",
    description: "Performs numerical calculations and mathematical operations",
    invocations: 1235,
    successRate: 99,
    avgResponseTime: "0.8s",
    color: "#14b8a6",
    usageData: [
      { date: "Jan", value: 140 },
      { date: "Feb", value: 165 },
      { date: "Mar", value: 150 },
      { date: "Apr", value: 180 },
      { date: "May", value: 190 },
      { date: "Jun", value: 210 },
      { date: "Jul", value: 200 }
    ]
  },
  {
    id: "calendar",
    name: "Calendar",
    description: "Manages scheduling and calendar events",
    invocations: 876,
    successRate: 92,
    avgResponseTime: "1.5s",
    color: "#f97316",
    usageData: [
      { date: "Jan", value: 80 },
      { date: "Feb", value: 95 },
      { date: "Mar", value: 110 },
      { date: "Apr", value: 120 },
      { date: "May", value: 150 },
      { date: "Jun", value: 140 },
      { date: "Jul", value: 180 }
    ]
  },
];

const getStatusClass = (rate: number) => {
  if (rate >= 95) return "text-success";
  if (rate >= 85) return "text-amber-500";
  return "text-destructive";
};

export default function Agents() {
  const [selectedAgent, setSelectedAgent] = useState(agentData[0]);
  
  return (
    <div className="h-full">
      <Header 
        title="Agent Performance" 
        description="Monitor and analyze agent activity"
      >
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-pulse-600" />
          <span className="text-sm font-medium">{agentData.length} Active Agents</span>
        </div>
      </Header>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {agentData.map((agent) => (
            <Card 
              key={agent.id} 
              className={cn(
                "cursor-pointer transition-all",
                selectedAgent.id === agent.id ? "ring-2 ring-pulse-500" : ""
              )}
              onClick={() => setSelectedAgent(agent)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <span
                    className="h-2 w-2 rounded-full mr-2"
                    style={{ backgroundColor: agent.color }}
                  />
                  {agent.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agent.invocations.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Total invocations</div>
                
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs">Success Rate</span>
                  <span className={cn("text-xs font-medium", getStatusClass(agent.successRate))}>
                    {agent.successRate}%
                  </span>
                </div>
                <Progress
                  value={agent.successRate}
                  className={`h-1 mt-1 ${agent.successRate >= 95 ? "[&>div]:bg-success" : agent.successRate >= 85 ? "[&>div]:bg-amber-500" : "[&>div]:bg-destructive"}`}
                />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <span
                    className="h-3 w-3 rounded-full mr-2"
                    style={{ backgroundColor: selectedAgent.color }}
                  />
                  {selectedAgent.name} Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="usage">
                  <TabsList className="mb-4">
                    <TabsTrigger value="usage">Usage</TabsTrigger>
                    <TabsTrigger value="performance">Response Time</TabsTrigger>
                    <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="usage">
                    <AreaChart
                      title=""
                      data={selectedAgent.usageData}
                      color={selectedAgent.color}
                    />
                  </TabsContent>
                  
                  <TabsContent value="performance">
                    <AreaChart
                      title=""
                      data={selectedAgent.usageData.map(d => ({ ...d, value: d.value * 0.01 }))}
                      color={selectedAgent.color}
                    />
                  </TabsContent>
                  
                  <TabsContent value="accuracy">
                    <AreaChart
                      title=""
                      data={selectedAgent.usageData.map(d => ({ ...d, value: Math.min(100, d.value * 0.2) }))}
                      color={selectedAgent.color}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center">
                  <Activity className="h-4 w-4 mr-2" />
                  Agent Details
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Description</h4>
                    <p>{selectedAgent.description}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">Performance Metrics</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-muted-foreground text-xs">Success Rate</div>
                        <div className={cn("font-medium", getStatusClass(selectedAgent.successRate))}>
                          {selectedAgent.successRate}%
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Response Time</div>
                        <div className="font-medium">{selectedAgent.avgResponseTime}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Recent Invocations</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{i+1}m ago</TableCell>
                        <TableCell>
                          <span className={cn(
                            "inline-block px-2 py-0.5 text-xs rounded-full",
                            i % 3 === 0 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                          )}>
                            {i % 3 === 0 ? "Failed" : "Success"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
