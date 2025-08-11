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
    totalDetected: number;
    pending: number;
    approved: number;
    rejected: number;
    topSkills: { skill: string; count: number }[];
    lastRun?: string;
  };
}

export function SkillDetectionStats({ stats }: SkillDetectionStatsProps) {
  const approvalRate = stats.totalDetected > 0 
    ? ((stats.approved / stats.totalDetected) * 100).toFixed(1)
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
            <div className="text-2xl font-bold">{stats.totalDetected}</div>
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
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
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
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
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
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
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

      {/* Top Skills */}
      {stats.topSkills?.length > 0 && (
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="text-lg">Top Detected Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.topSkills.map((item, index) => (
                <Badge 
                  key={item.skill}
                  variant={index === 0 ? "default" : "secondary"}
                  className="text-sm"
                >
                  {item.skill.replace(/_/g, ' ')}
                  <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                    {item.count}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Last Run */}
      {stats.lastRun && (
        <Card className="col-span-full">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last detection run: {new Date(stats.lastRun).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}