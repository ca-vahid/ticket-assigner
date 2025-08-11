'use client'

import { useState } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PendingAssignmentsV2 } from './pending-assignments-v2'
import { AutoAssignmentQueue } from './auto-assignment-queue'
import { AssignmentHistory } from './assignment-history'

export function AssignmentsView() {
  const [activeTab, setActiveTab] = useState('pending')

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Assignments</h2>
          <p className="text-muted-foreground">
            Review and manage ticket assignments
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="pending">Pending Review</TabsTrigger>
            <TabsTrigger value="queue">Auto-Assign Queue</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            <PendingAssignmentsV2 />
          </TabsContent>

          <TabsContent value="queue" className="space-y-4">
            <AutoAssignmentQueue />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <AssignmentHistory />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}