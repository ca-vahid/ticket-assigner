import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  CheckCircle, 
  Clock, 
  XCircle,
  TrendingUp,
  Users,
  Target,
  Zap
} from 'lucide-react';

interface SkillDetectionStatsProps {
  stats: {
    detectedSkills: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
    };
    agentsProcessed?: number;
    lastRunAt?: string;
    averageConfidence?: number;
  };
  isRefreshing?: boolean;
}

export function SkillDetectionStatsV2({ stats, isRefreshing = false }: SkillDetectionStatsProps) {
  // Provide default values if stats or detectedSkills is undefined
  const detectedSkills = stats?.detectedSkills || {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  };

  const getPercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const approvalRate = detectedSkills.total > 0 
    ? getPercentage(detectedSkills.approved, detectedSkills.approved + detectedSkills.rejected)
    : 0;

  return (
    <div className={`grid grid-cols-6 gap-3 mb-4 ${isRefreshing ? 'opacity-50' : ''}`}>
      {/* Total Skills */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 font-medium">Total Detected</p>
              <p className="text-2xl font-bold text-blue-800">{detectedSkills.total}</p>
            </div>
            <Brain className="h-8 w-8 text-blue-500 opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Pending */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-orange-600 font-medium">Pending Review</p>
              <p className="text-2xl font-bold text-orange-800">{detectedSkills.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-orange-500 opacity-50" />
          </div>
          {detectedSkills.pending > 0 && (
            <Badge className="mt-1 text-xs bg-orange-600">
              {getPercentage(detectedSkills.pending, detectedSkills.total)}% of total
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Approved */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-green-600 font-medium">Approved</p>
              <p className="text-2xl font-bold text-green-800">{detectedSkills.approved}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500 opacity-50" />
          </div>
          {detectedSkills.approved > 0 && (
            <Badge className="mt-1 text-xs bg-green-600">
              {getPercentage(detectedSkills.approved, detectedSkills.total)}% of total
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Rejected */}
      <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-red-600 font-medium">Rejected</p>
              <p className="text-2xl font-bold text-red-800">{detectedSkills.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500 opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Approval Rate */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-purple-600 font-medium">Approval Rate</p>
              <p className="text-2xl font-bold text-purple-800">{approvalRate}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500 opacity-50" />
          </div>
        </CardContent>
      </Card>

      {/* Agents Processed */}
      {stats?.agentsProcessed !== undefined && (
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-600 font-medium">Agents</p>
                <p className="text-2xl font-bold text-indigo-800">{stats?.agentsProcessed || 0}</p>
              </div>
              <Users className="h-8 w-8 text-indigo-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}