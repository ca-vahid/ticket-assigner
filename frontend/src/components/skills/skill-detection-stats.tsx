import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Brain
} from 'lucide-react';

interface SkillDetectionStatsProps {
  stats: {
    detectedSkills?: {
      total?: number;
      pending?: number;
      approved?: number;
      rejected?: number;
    };
    pendingByMethod?: Record<string, number>;
    enabledMethods?: string[];
    recentActivity?: any[];
  };
}

export function SkillDetectionStats({ stats }: SkillDetectionStatsProps) {
  if (!stats?.detectedSkills) {
    return null;
  }

  const { total = 0, pending = 0, approved = 0, rejected = 0 } = stats.detectedSkills;
  const approvalRate = total > 0 
    ? ((approved / total) * 100).toFixed(1)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Total Detected */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Detected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">{total}</div>
            <Brain className="h-8 w-8 text-purple-500 opacity-20" />
          </div>
        </CardContent>
      </Card>

      {/* Pending Review */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pending Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-orange-600">{pending}</div>
            <AlertCircle className="h-8 w-8 text-orange-500 opacity-20" />
          </div>
        </CardContent>
      </Card>

      {/* Approved */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Approved
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-green-600">{approved}</div>
            <CheckCircle className="h-8 w-8 text-green-500 opacity-20" />
          </div>
        </CardContent>
      </Card>

      {/* Rejected */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Rejected
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-red-600">{rejected}</div>
            <XCircle className="h-8 w-8 text-red-500 opacity-20" />
          </div>
        </CardContent>
      </Card>

      {/* Approval Rate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Approval Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">{approvalRate}%</div>
            <TrendingUp className="h-8 w-8 text-blue-500 opacity-20" />
          </div>
        </CardContent>
      </Card>

      {/* Pending By Method */}
      {stats.pendingByMethod && Object.keys(stats.pendingByMethod).length > 0 && (
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="text-lg">Pending Skills by Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.pendingByMethod).map(([method, count]) => (
                <Badge 
                  key={method}
                  variant="outline"
                  className="text-sm"
                >
                  {method.replace(/_/g, ' ')}
                  <span className="ml-2 px-1.5 py-0.5 bg-orange-100 rounded text-xs">
                    {count}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}