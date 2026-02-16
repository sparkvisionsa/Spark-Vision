"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AdminAnalyticsPayload = {
  overview: {
    registeredUsers: number;
    guests: number;
    peakUsageByHour: Array<{ hour: number; count: number }>;
  };
  engagement: {
    retentionRate: number;
  };
  conversion: {
    conversionRate: number;
  };
  downloads: {
    totalDownloads: number;
  };
  featureUsage: Array<{ actionType: string; count: number }>;
  generatedAt: string;
};

type AdminAnalyticsChartsProps = {
  analytics: AdminAnalyticsPayload;
};

export function AdminAnalyticsCharts({ analytics }: AdminAnalyticsChartsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Feature Usage</CardTitle>
          <CardDescription>Top tracked actions</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.featureUsage.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="actionType" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#0ea5e9" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Peak Usage By Hour</CardTitle>
          <CardDescription>0-23h activity volume</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.overview.peakUsageByHour}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered vs Guests</CardTitle>
          <CardDescription>User distribution</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: "Registered", value: analytics.overview.registeredUsers },
                  { name: "Guests", value: analytics.overview.guests },
                ]}
                dataKey="value"
                outerRadius={90}
                fill="#0284c7"
                label
              />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retention & Conversion</CardTitle>
          <CardDescription>Guest-to-user and returning behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Retention rate</span>
            <Badge variant="secondary">{analytics.engagement.retentionRate.toFixed(1)}%</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Conversion rate</span>
            <Badge variant="secondary">{analytics.conversion.conversionRate.toFixed(1)}%</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Total downloads</span>
            <Badge variant="secondary">{analytics.downloads.totalDownloads}</Badge>
          </div>
          <div className="text-xs text-slate-500">
            Generated at {new Date(analytics.generatedAt).toLocaleString()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
