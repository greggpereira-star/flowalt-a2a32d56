import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWorkspaceMembers } from '@/hooks/useWorkspaceMembers';
import { startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addDays, format } from 'date-fns';
import type { Card } from '@/hooks/useCards';

export interface CapacityAllocation {
  userId: string;
  userName: string;
  date: Date;
  allocatedHours: number;
  capacityHours: number;
  utilizationPercent: number;
  cards: { id: string; title: string; hours: number }[];
}

export interface UserCapacitySummary {
  userId: string;
  userName: string;
  totalAllocated: number;
  totalCapacity: number;
  utilizationPercent: number;
  isOverloaded: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// Default hours per day
const DEFAULT_DAILY_HOURS = 8;
const DEFAULT_WEEKLY_HOURS = 40;

export const useCapacity = (cards: Card[], weekStart?: Date) => {
  const { currentWorkspace } = useWorkspace();
  const { data: members } = useWorkspaceMembers();

  const startDate = weekStart || startOfWeek(new Date(), { weekStartsOn: 1 });
  const endDate = endOfWeek(startDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Calculate daily allocations
  const dailyAllocations = useMemo((): CapacityAllocation[] => {
    if (!members) return [];

    const allocations: CapacityAllocation[] = [];

    members.forEach(member => {
      // Get member's cards
      const memberCards = cards.filter(c => 
        c.owner_id === member.user_id && 
        c.status !== 'delivered' && 
        c.status !== 'archived'
      );

      days.forEach(day => {
        // Cards active on this day (between created and due date)
        const activeCards = memberCards.filter(card => {
          const cardStart = new Date(card.created_at);
          const cardEnd = card.due_date ? new Date(card.due_date) : addDays(cardStart, 7);
          return day >= cardStart && day <= cardEnd;
        });

        // Calculate allocated hours for the day
        let allocatedHours = 0;
        const cardDetails: { id: string; title: string; hours: number }[] = [];

        activeCards.forEach(card => {
          const cardStart = new Date(card.created_at);
          const cardEnd = card.due_date ? new Date(card.due_date) : addDays(cardStart, 7);
          const totalDays = Math.max(1, Math.ceil((cardEnd.getTime() - cardStart.getTime()) / (1000 * 60 * 60 * 24)));
          
          // Distribute estimated hours across working days
          const estimatedHours = card.estimated_hours || 4;
          const hoursPerDay = estimatedHours / totalDays;
          
          allocatedHours += hoursPerDay;
          cardDetails.push({
            id: card.id,
            title: card.title,
            hours: hoursPerDay,
          });
        });

        const capacityHours = DEFAULT_DAILY_HOURS;
        const utilizationPercent = (allocatedHours / capacityHours) * 100;

        allocations.push({
          userId: member.user_id,
          userName: member.profile?.full_name || member.profile?.email || 'Unknown',
          date: day,
          allocatedHours: Math.round(allocatedHours * 10) / 10,
          capacityHours,
          utilizationPercent: Math.round(utilizationPercent),
          cards: cardDetails,
        });
      });
    });

    return allocations;
  }, [cards, members, days]);

  // Calculate weekly summaries per user
  const userSummaries = useMemo((): UserCapacitySummary[] => {
    if (!members) return [];

    return members.map(member => {
      const userAllocations = dailyAllocations.filter(a => a.userId === member.user_id);
      const totalAllocated = userAllocations.reduce((sum, a) => sum + a.allocatedHours, 0);
      const totalCapacity = DEFAULT_WEEKLY_HOURS;
      const utilizationPercent = (totalAllocated / totalCapacity) * 100;
      
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (utilizationPercent > 120) riskLevel = 'critical';
      else if (utilizationPercent > 100) riskLevel = 'high';
      else if (utilizationPercent > 80) riskLevel = 'medium';

      return {
        userId: member.user_id,
        userName: member.profile?.full_name || member.profile?.email || 'Unknown',
        totalAllocated: Math.round(totalAllocated * 10) / 10,
        totalCapacity,
        utilizationPercent: Math.round(utilizationPercent),
        isOverloaded: utilizationPercent > 100,
        riskLevel,
      };
    });
  }, [members, dailyAllocations]);

  // Get overloaded users
  const overloadedUsers = useMemo(() => {
    return userSummaries.filter(u => u.isOverloaded);
  }, [userSummaries]);

  // Get capacity risks (days where someone is over capacity)
  const capacityRisks = useMemo(() => {
    return dailyAllocations.filter(a => a.utilizationPercent > 100);
  }, [dailyAllocations]);

  // Get allocation for specific user and date
  const getAllocation = (userId: string, date: Date): CapacityAllocation | undefined => {
    return dailyAllocations.find(a => 
      a.userId === userId && isSameDay(a.date, date)
    );
  };

  // Get summary for specific user
  const getUserSummary = (userId: string): UserCapacitySummary | undefined => {
    return userSummaries.find(u => u.userId === userId);
  };

  return {
    dailyAllocations,
    userSummaries,
    overloadedUsers,
    capacityRisks,
    getAllocation,
    getUserSummary,
    weekStart: startDate,
    weekEnd: endDate,
  };
};

// Hook to check if assigning a card would cause overload
export const useCapacityCheck = () => {
  const checkAssignment = (
    userId: string,
    cards: Card[],
    newCardHours: number,
    dueDate: Date
  ): { wouldOverload: boolean; newUtilization: number } => {
    // Simple check - would need more sophisticated logic for real implementation
    const userCards = cards.filter(c => 
      c.owner_id === userId && 
      c.status !== 'delivered' && 
      c.status !== 'archived'
    );

    const currentHours = userCards.reduce((sum, c) => sum + (c.estimated_hours || 4), 0);
    const newTotal = currentHours + newCardHours;
    const weeklyCapacity = DEFAULT_WEEKLY_HOURS;
    const newUtilization = (newTotal / weeklyCapacity) * 100;

    return {
      wouldOverload: newUtilization > 100,
      newUtilization: Math.round(newUtilization),
    };
  };

  return { checkAssignment };
};
