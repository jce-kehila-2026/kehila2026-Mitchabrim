import React, { useMemo } from "react";
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, PieChart, Pie, Cell } from "recharts";
import SectionCard from "./SectionCard.jsx";

export const CHART_COLORS = ["#8B0000", "#D4A574", "#5F9EA0", "#4682B4", "#9ACD32", "#FF8C00", "#9932CC"];

export function getVolunteerChartData(volunteers) {
  if (!volunteers) return { barData: [], pieData: [] };
  // Bar: Volunteers by Group
  const groupCount = {};
  volunteers.forEach((item) => {
    const key = item.group || "ללא קבוצה";
    groupCount[key] = (groupCount[key] || 0) + 1;
  });
  const barData = Object.entries(groupCount)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Pie: Volunteers by Status
  const statusCount = {};
  volunteers.forEach((item) => {
    const key = item.status || "ללא סטטוס";
    statusCount[key] = (statusCount[key] || 0) + 1;
  });
  const pieData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

  return { barData, pieData };
}

export default function VolunteerCharts({ data, height = 260 }) {
  const { barData, pieData } = useMemo(() => getVolunteerChartData(data), [data]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20, marginBottom: 20 }}>
      <SectionCard title="📊 מתנדבים לפי קבוצה">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#D4A574" name="מספר מתנדבים" />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="🧩 התפלגות לפי סטטוס">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={Math.min(80, height * 0.3)}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}
