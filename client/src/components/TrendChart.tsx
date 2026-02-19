import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { HistoryPoint } from '../types';

interface Props {
  data: HistoryPoint[];
}

const RISK_COLORS: Record<string, string> = {
  Critical: '#7C3AED', High: '#EF4444', Medium: '#F59E0B', Low: '#10B981', Minimal: '#3B82F6',
};

export default function TrendChart({ data }: Props) {
  // Group by month
  const byMonth: Record<string, Record<string, number>> = {};
  data.forEach(d => {
    const month = d.date.slice(0, 7);
    if (!byMonth[month]) byMonth[month] = { Critical: 0, High: 0, Medium: 0, Low: 0, Minimal: 0 };
    const rl = d.riskLevel as string;
    if (rl in byMonth[month]) byMonth[month][rl]++;
  });

  const chartData = Object.entries(byMonth).map(([month, counts]) => ({ month, ...counts }));

  if (chartData.length === 0) {
    return <div className="text-gray-500 text-sm text-center py-8">No trend data available.</div>;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-300 mb-2">Risk Distribution Over Time</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
          <Tooltip contentStyle={{ background: '#1F2937', border: '1px solid #374151', fontSize: 11 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {Object.entries(RISK_COLORS).map(([level, color]) => (
            <Bar key={level} dataKey={level} stackId="a" fill={color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
