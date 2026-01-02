import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NewYearBanner } from './NewYearBanner';
import { ChristmasBanner } from './ChristmasBanner';
import { EasterBanner } from './EasterBanner';
import { NewYearModal } from './NewYearModal';
import { ChristmasModal } from './ChristmasModal';
import { EasterModal } from './EasterModal';
import { SnowEffect } from './SnowEffect';
import { FireworksEffect } from './FireworksEffect';
import { AuroraBorealisEffect } from './AuroraBorealisEffect';
import { SpringEffect } from './SpringEffect';
import { PartyPopper, TreePine, Egg, Snowflake, Sparkles, Sun, Gift, Flower2 } from 'lucide-react';

export const HolidayCelebrationDemo: React.FC = () => {
  const [showNewYearModal, setShowNewYearModal] = useState(false);
  const [showChristmasModal, setShowChristmasModal] = useState(false);
  const [showEasterModal, setShowEasterModal] = useState(false);
  const [showSnow, setShowSnow] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);
  const [showAurora, setShowAurora] = useState(false);
  const [showSpring, setShowSpring] = useState(false);

  return (
    <div className="p-6 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">🎉 Demo de Celebrações</h1>
        <p className="text-muted-foreground">
          Visualize todas as celebrações de feriados implementadas
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
            className={showSnow ? "bg-gradient-to-r from-green-600 to-red-600" : ""}
          >
            <Gift className="w-4 h-4 mr-2" />
            {showSnow ? 'Parar Neve + Presentes' : 'Neve de Natal'}
          </Button>
          <Button 
            variant={showFireworks ? "default" : "outline"}
            onClick={() => setShowFireworks(!showFireworks)}
            className={showFireworks ? "bg-gradient-to-r from-yellow-500 to-orange-500" : ""}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {showFireworks ? 'Parar Fogos' : 'Fogos de Artifício'}
          </Button>
          <Button 
            variant={showAurora ? "default" : "outline"}
            onClick={() => setShowAurora(!showAurora)}
            className={showAurora ? "bg-gradient-to-r from-blue-600 to-purple-600" : ""}
          >
            <Sun className="w-4 h-4 mr-2" />
            {showAurora ? 'Parar Aurora' : 'Aurora Boreal'}
          </Button>
          <Button 
            variant={showSpring ? "default" : "outline"}
            onClick={() => setShowSpring(!showSpring)}
            className={showSpring ? "bg-gradient-to-r from-pink-400 to-purple-400" : ""}
          >
            <Flower2 className="w-4 h-4 mr-2" />
            {showSpring ? 'Parar Primavera' : 'Pétalas + Borboletas'}
          </Button>
        </CardContent>
      </Card>

      {/* Banners Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Banners Interativos</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Clique nos banners para ativar os easter eggs! 🎯
        </p>
        
        <NewYearBanner />
        <ChristmasBanner />
        <EasterBanner />
      </div>

      {/* Modals Section */}
      <Card>
        <CardHeader>
          <CardTitle>Modais de Celebração</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button 
            onClick={() => setShowNewYearModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <PartyPopper className="w-4 h-4 mr-2" />
            Modal Ano Novo
          </Button>
          
          <Button 
            onClick={() => setShowChristmasModal(true)}
            className="bg-gradient-to-r from-green-600 to-red-600 hover:from-green-700 hover:to-red-700"
          >
            <TreePine className="w-4 h-4 mr-2" />
            Modal Natal
          </Button>
          
          <Button 
            onClick={() => setShowEasterModal(true)}
            className="bg-gradient-to-r from-pink-400 to-purple-400 hover:from-pink-500 hover:to-purple-500"
          >
            <Egg className="w-4 h-4 mr-2" />
            Modal Páscoa
          </Button>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">📅 Quando aparecem automaticamente?</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Ano Novo:</strong> 31 de dezembro e 1-2 de janeiro</li>
            <li>• <strong>Natal:</strong> 24-26 de dezembro</li>
            <li>• <strong>Páscoa:</strong> Dia anterior, dia da Páscoa e dia seguinte (data variável)</li>
          </ul>
          
          <h3 className="font-semibold mt-4 mb-2">✨ Efeitos Visuais por Feriado</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• <strong>Natal:</strong> Cristais de gelo azulados + Presentes coloridos caindo</li>
            <li>• <strong>Ano Novo:</strong> Fogos de artifício + Aurora boreal</li>
            <li>• <strong>Páscoa:</strong> Pétalas de flor + Borboletas voando</li>
          </ul>
          
          <h3 className="font-semibold mt-4 mb-2">🏆 Badges Desbloqueáveis</h3>
          <div className="flex gap-4 text-2xl">
            <span title="Ano Novo">🎆</span>
            <span title="Natal">🎄</span>
            <span title="Páscoa">🐰</span>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <NewYearModal open={showNewYearModal} onOpenChange={setShowNewYearModal} />
      <ChristmasModal open={showChristmasModal} onOpenChange={setShowChristmasModal} />
      <EasterModal open={showEasterModal} onOpenChange={setShowEasterModal} />

      {/* Effects */}
      {showSnow && <SnowEffect intensity={3} />}
      {showFireworks && <FireworksEffect duration={30} />}
      {showAurora && <AuroraBorealisEffect intensity={2} />}
      {showSpring && <SpringEffect intensity={3} />}
    </div>
  );
};
