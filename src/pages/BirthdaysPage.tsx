import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useBirthdays } from '@/hooks/useBirthdays';
import { usePageTracking } from '@/hooks/usePageTracking';
import { Cake, Calendar, Gift, PartyPopper, Clock, Users } from 'lucide-react';
import { format, getMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const MONTHS = [
  { value: 'all', label: 'Todos os meses' },
  { value: '0', label: 'Janeiro' },
  { value: '1', label: 'Fevereiro' },
  { value: '2', label: 'Março' },
  { value: '3', label: 'Abril' },
  { value: '4', label: 'Maio' },
  { value: '5', label: 'Junho' },
  { value: '6', label: 'Julho' },
  { value: '7', label: 'Agosto' },
  { value: '8', label: 'Setembro' },
  { value: '9', label: 'Outubro' },
  { value: '10', label: 'Novembro' },
  { value: '11', label: 'Dezembro' },
];

const BirthdaysPage: React.FC = () => {
  
  const currentMonth = getMonth(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth.toString());
  
  const monthFilter = selectedMonth === 'all' ? undefined : parseInt(selectedMonth);
  const { data: birthdays, isLoading } = useBirthdays(monthFilter);

  // Group birthdays by status
  const { todayBirthdays, upcomingBirthdays, laterBirthdays } = useMemo(() => {
    if (!birthdays) return { todayBirthdays: [], upcomingBirthdays: [], laterBirthdays: [] };
    
    return {
      todayBirthdays: birthdays.filter(b => b.is_today),
      upcomingBirthdays: birthdays.filter(b => !b.is_today && b.days_until <= 7),
      laterBirthdays: birthdays.filter(b => !b.is_today && b.days_until > 7),
    };
  }, [birthdays]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const getDaysLabel = (days: number) => {
    if (days === 0) return 'Hoje! 🎂';
    if (days === 1) return 'Amanhã';
    return `Faltam ${days} dias`;
  };

  const BirthdayCard = ({ member }: { member: typeof birthdays[0] }) => (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-lg border transition-colors",
      member.is_today 
        ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30" 
        : "bg-card hover:bg-muted/50"
    )}>
      <Avatar className={cn("h-12 w-12", member.is_today && "ring-2 ring-primary ring-offset-2")}>
        <AvatarImage src={member.avatar_url || undefined} />
        <AvatarFallback className={member.is_today ? "bg-primary text-primary-foreground" : ""}>
          {getInitials(member.full_name)}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{member.full_name}</p>
          {member.is_today && (
            <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
              <PartyPopper className="h-3 w-3 mr-1" />
              Aniversário!
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {format(new Date(member.birthday), "dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>
      
      <div className="text-right">
        <Badge variant={member.is_today ? "default" : "secondary"} className="whitespace-nowrap">
          <Clock className="h-3 w-3 mr-1" />
          {getDaysLabel(member.days_until)}
        </Badge>
      </div>
    </div>
  );

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Cake className="h-6 w-6 text-primary" />
              Aniversariantes
            </h1>
            <p className="text-muted-foreground">
              Acompanhe os aniversários da equipe
            </p>
          </div>
          
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(month => (
                <SelectItem key={month.value} value={month.value}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : !birthdays || birthdays.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Gift className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground text-center">
                {selectedMonth === 'all' 
                  ? 'Nenhum aniversário cadastrado ainda.' 
                  : `Nenhum aniversário em ${MONTHS.find(m => m.value === selectedMonth)?.label}.`}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Os membros precisam cadastrar suas datas de nascimento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Today's Birthdays */}
            {todayBirthdays.length > 0 && (
              <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <PartyPopper className="h-5 w-5 text-primary" />
                    Aniversariantes do Dia
                    <Badge variant="default" className="ml-2">
                      {todayBirthdays.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Não esqueça de parabenizar! 🎉
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {todayBirthdays.map(member => (
                    <BirthdayCard key={member.user_id} member={member} />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* This Week */}
            {upcomingBirthdays.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5" />
                    Esta Semana
                    <Badge variant="secondary" className="ml-2">
                      {upcomingBirthdays.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Próximos 7 dias
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {upcomingBirthdays.map(member => (
                    <BirthdayCard key={member.user_id} member={member} />
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Later */}
            {laterBirthdays.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="h-5 w-5" />
                    Próximos Aniversários
                    <Badge variant="outline" className="ml-2">
                      {laterBirthdays.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-3">
                      {laterBirthdays.map(member => (
                        <BirthdayCard key={member.user_id} member={member} />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {birthdays.length} aniversariante{birthdays.length !== 1 ? 's' : ''} 
                    {selectedMonth !== 'all' && ` em ${MONTHS.find(m => m.value === selectedMonth)?.label}`}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default BirthdaysPage;
