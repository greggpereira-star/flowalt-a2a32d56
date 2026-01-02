import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NewYearBanner } from './NewYearBanner';
import { ChristmasBanner } from './ChristmasBanner';
import { EasterBanner } from './EasterBanner';
import { CarnivalBanner } from './CarnivalBanner';
import { FestaJuninaBanner } from './FestaJuninaBanner';
import { ValentinesBanner } from './ValentinesBanner';
import { HalloweenBanner } from './HalloweenBanner';
import { SeasonBanner } from './SeasonBanner';
import { NewYearModal } from './NewYearModal';
import { ChristmasModal } from './ChristmasModal';
import { EasterModal } from './EasterModal';
import { CarnivalModal } from './CarnivalModal';
import { FestaJuninaModal } from './FestaJuninaModal';
import { ValentinesModal } from './ValentinesModal';
import { HalloweenModal } from './HalloweenModal';
import { SeasonModal } from './SeasonModal';
import { SnowEffect } from './SnowEffect';
import { FireworksEffect } from './FireworksEffect';
import { CarnivalEffect } from './CarnivalEffect';
import { PartyPopper, TreePine, Egg, Snowflake, Sparkles, Heart, Ghost, Flame, Sun, Leaf, Cloud } from 'lucide-react';
import { SeasonType } from '@/lib/holidayUtils';

export const HolidayCelebrationDemo: React.FC = () => {
  // Holiday modals
  const [showNewYearModal, setShowNewYearModal] = useState(false);
  const [showChristmasModal, setShowChristmasModal] = useState(false);
  const [showEasterModal, setShowEasterModal] = useState(false);
  const [showCarnivalModal, setShowCarnivalModal] = useState(false);
  const [showFestaJuninaModal, setShowFestaJuninaModal] = useState(false);
  const [showValentinesModal, setShowValentinesModal] = useState(false);
  const [showHalloweenModal, setShowHalloweenModal] = useState(false);
  
  // Season modals
  const [showSpringModal, setShowSpringModal] = useState(false);
  const [showSummerModal, setShowSummerModal] = useState(false);
  const [showAutumnModal, setShowAutumnModal] = useState(false);
  const [showWinterModal, setShowWinterModal] = useState(false);
  
  // Effects
  const [showSnow, setShowSnow] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [showCarnivalConfetti, setShowCarnivalConfetti] = useState(false);

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🎉 Demo de Celebrações</h1>
        <p className="text-muted-foreground">
          Visualize todas as celebrações de feriados e estações implementadas
        </p>
      </div>

      {/* Effects Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Efeitos Visuais
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button 
            variant={showSnow ? "default" : "outline"}
            onClick={() => setShowSnow(!showSnow)}
          >
            <Snowflake className="w-4 h-4 mr-2" />
            {showSnow ? 'Parar Neve' : 'Ativar Neve'}
          </Button>
          <Button 
            variant={showFireworks ? "default" : "outline"}
            onClick={() => setShowFireworks(!showFireworks)}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {showFireworks ? 'Parar Fogos' : 'Ativar Fogos'}
          </Button>
          <Button 
            variant={showCarnivalConfetti ? "default" : "outline"}
            onClick={() => setShowCarnivalConfetti(!showCarnivalConfetti)}
          >
            <PartyPopper className="w-4 h-4 mr-2" />
            {showCarnivalConfetti ? 'Parar Confete' : 'Ativar Confete'}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="holidays" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="holidays">🎊 Feriados</TabsTrigger>
          <TabsTrigger value="seasons">🌸 Estações</TabsTrigger>
        </TabsList>

        <TabsContent value="holidays" className="space-y-6 mt-6">
          {/* Banners Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Banners Interativos</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Clique nos banners para ativar os easter eggs! 🎯
            </p>
            
            <div className="grid gap-4">
              <NewYearBanner />
              <ChristmasBanner />
              <EasterBanner />
              <CarnivalBanner />
              <FestaJuninaBanner />
              <ValentinesBanner />
              <HalloweenBanner />
            </div>
          </div>

          {/* Holiday Modals Section */}
          <Card>
            <CardHeader>
              <CardTitle>Modais de Feriados</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button 
                onClick={() => setShowNewYearModal(true)}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                <PartyPopper className="w-4 h-4 mr-2" />
                Ano Novo
              </Button>
              
              <Button 
                onClick={() => setShowChristmasModal(true)}
                className="bg-gradient-to-r from-green-600 to-red-600 hover:from-green-700 hover:to-red-700"
              >
                <TreePine className="w-4 h-4 mr-2" />
                Natal
              </Button>
              
              <Button 
                onClick={() => setShowEasterModal(true)}
                className="bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500"
              >
                <Egg className="w-4 h-4 mr-2" />
                Páscoa
              </Button>

              <Button 
                onClick={() => setShowCarnivalModal(true)}
                className="bg-gradient-to-r from-purple-500 via-yellow-400 to-green-500 hover:from-purple-600 hover:via-yellow-500 hover:to-green-600"
              >
                🎭 Carnaval
              </Button>

              <Button 
                onClick={() => setShowFestaJuninaModal(true)}
                className="bg-gradient-to-r from-orange-500 via-yellow-500 to-red-500 hover:from-orange-600 hover:via-yellow-600 hover:to-red-600"
              >
                <Flame className="w-4 h-4 mr-2" />
                Festa Junina
              </Button>

              <Button 
                onClick={() => setShowValentinesModal(true)}
                className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600"
              >
                <Heart className="w-4 h-4 mr-2" />
                Dia dos Namorados
              </Button>

              <Button 
                onClick={() => setShowHalloweenModal(true)}
                className="bg-gradient-to-r from-orange-500 via-purple-800 to-gray-900 hover:from-orange-600 hover:via-purple-900 hover:to-black"
              >
                <Ghost className="w-4 h-4 mr-2" />
                Halloween
              </Button>
            </CardContent>
          </Card>

          {/* Holiday Info */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">📅 Quando aparecem automaticamente?</h3>
              <ul className="text-sm text-muted-foreground space-y-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                <li>• <strong>Ano Novo:</strong> 31/12 a 02/01</li>
                <li>• <strong>Natal:</strong> 24-26/12</li>
                <li>• <strong>Páscoa:</strong> Data variável</li>
                <li>• <strong>Carnaval:</strong> 5 dias antes da Páscoa</li>
                <li>• <strong>Dia dos Namorados:</strong> 11-13/06</li>
                <li>• <strong>Festa Junina:</strong> 10-30/06</li>
                <li>• <strong>Halloween:</strong> 29-31/10</li>
              </ul>
              
              <h3 className="font-semibold mt-4 mb-2">🏆 Badges Desbloqueáveis</h3>
              <div className="flex gap-4 text-2xl flex-wrap">
                <span title="Ano Novo">🎆</span>
                <span title="Natal">🎄</span>
                <span title="Páscoa">🐰</span>
                <span title="Carnaval">🎭</span>
                <span title="Festa Junina">🌽</span>
                <span title="Dia dos Namorados">💕</span>
                <span title="Halloween">🎃</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seasons" className="space-y-6 mt-6">
          {/* Season Banners */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Banners das Estações</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Aparecem no início de cada estação (hemisfério sul - Brasil) 🇧🇷
            </p>
            
            <div className="grid gap-4">
              <SeasonBanner season="spring" />
              <SeasonBanner season="summer" />
              <SeasonBanner season="autumn" />
              <SeasonBanner season="winter" />
            </div>
          </div>

          {/* Season Modals Section */}
          <Card>
            <CardHeader>
              <CardTitle>Modais das Estações</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button 
                onClick={() => setShowSpringModal(true)}
                className="bg-gradient-to-r from-pink-400 to-green-400 hover:from-pink-500 hover:to-green-500"
              >
                🌸 Primavera
              </Button>
              
              <Button 
                onClick={() => setShowSummerModal(true)}
                className="bg-gradient-to-r from-yellow-400 to-sky-400 hover:from-yellow-500 hover:to-sky-500"
              >
                <Sun className="w-4 h-4 mr-2" />
                Verão
              </Button>
              
              <Button 
                onClick={() => setShowAutumnModal(true)}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                <Leaf className="w-4 h-4 mr-2" />
                Outono
              </Button>

              <Button 
                onClick={() => setShowWinterModal(true)}
                className="bg-gradient-to-r from-slate-400 to-cyan-300 hover:from-slate-500 hover:to-cyan-400"
              >
                <Cloud className="w-4 h-4 mr-2" />
                Inverno
              </Button>
            </CardContent>
          </Card>

          {/* Season Info */}
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <h3 className="font-semibold mb-2">📅 Início das Estações (Brasil)</h3>
              <ul className="text-sm text-muted-foreground space-y-1 grid grid-cols-2 gap-2">
                <li>• <strong>Verão:</strong> 21 de Dezembro</li>
                <li>• <strong>Outono:</strong> 21 de Março</li>
                <li>• <strong>Inverno:</strong> 21 de Junho</li>
                <li>• <strong>Primavera:</strong> 23 de Setembro</li>
              </ul>
              
              <h3 className="font-semibold mt-4 mb-2">🌍 Hemisfério Sul</h3>
              <p className="text-sm text-muted-foreground">
                As datas são baseadas no calendário brasileiro (hemisfério sul), 
                onde as estações são invertidas em relação ao hemisfério norte.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Holiday Modals */}
      <NewYearModal open={showNewYearModal} onOpenChange={setShowNewYearModal} />
      <ChristmasModal open={showChristmasModal} onOpenChange={setShowChristmasModal} />
      <EasterModal open={showEasterModal} onOpenChange={setShowEasterModal} />
      <CarnivalModal open={showCarnivalModal} onOpenChange={setShowCarnivalModal} />
      <FestaJuninaModal open={showFestaJuninaModal} onOpenChange={setShowFestaJuninaModal} />
      <ValentinesModal open={showValentinesModal} onOpenChange={setShowValentinesModal} />
      <HalloweenModal open={showHalloweenModal} onOpenChange={setShowHalloweenModal} />

      {/* Season Modals */}
      <SeasonModal season="spring" open={showSpringModal} onOpenChange={setShowSpringModal} />
      <SeasonModal season="summer" open={showSummerModal} onOpenChange={setShowSummerModal} />
      <SeasonModal season="autumn" open={showAutumnModal} onOpenChange={setShowAutumnModal} />
      <SeasonModal season="winter" open={showWinterModal} onOpenChange={setShowWinterModal} />

      {/* Effects */}
      {showSnow && <SnowEffect intensity={3} />}
      {showFireworks && <FireworksEffect duration={30} />}
      {showCarnivalConfetti && <CarnivalEffect intensity="medium" />}
    </div>
  );
};
