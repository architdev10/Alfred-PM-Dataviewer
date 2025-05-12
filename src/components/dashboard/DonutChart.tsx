import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from "recharts";

interface DataItem {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  title: string;
  data: DataItem[];
  innerRadius?: number;
  outerRadius?: number;
  height?: number;
}

export function DonutChart({
  title,
  data,
  innerRadius = 60,
  outerRadius = 80,
  height = 300,
}: DonutChartProps) {
  const chartData = useMemo(() => {
    // Log the incoming data
    console.log(`DonutChart "${title}" received data:`, data);
    
    // Filter out any items with zero values as they can cause rendering issues
    const filteredData = data.filter(item => item.value > 0);
    
    // If all values are zero, create a placeholder item
    if (filteredData.length === 0) {
      console.log(`DonutChart "${title}" has no non-zero values, adding placeholder`);
      return [{ name: "No Data", value: 100, color: "#94a3b8" }];
    }
    
    return filteredData;
  }, [data, title]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={1}
              dataKey="value"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Legend layout="horizontal" verticalAlign="bottom" align="center" />
            <Tooltip 
              contentStyle={{ 
                background: 'white', 
                border: '1px solid #f0f0f0',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
