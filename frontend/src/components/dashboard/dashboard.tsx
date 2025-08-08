'use client'

import { MainLayout } from '@/components/layout/main-layout'
import { StatsCards } from './stats-cards'
import { RecentAssignments } from './recent-assignments'
import { AgentWorkload } from './agent-workload'
import { AssignmentAccuracy } from './assignment-accuracy'

export function Dashboard() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of ticket assignment system performance
          </p>
        </div>

        <StatsCards />

        <div className="grid gap-6 lg:grid-cols-2">
          <RecentAssignments />
          <AgentWorkload />
        </div>

        <AssignmentAccuracy />
      </div>
    </MainLayout>
  )
}