import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Folder,
  Palette,
  Video,
  Share2,
  Target,
  Briefcase,
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Settings,
  Star,
  Heart,
  Zap,
  Sparkles,
  Music,
  Camera,
  Film,
  Mic,
  Radio,
  Tv,
  Monitor,
  Smartphone,
  Globe,
  Mail,
  MessageSquare,
  Send,
  Phone,
  Calendar,
  Clock,
  Bell,
  Search,
  Filter,
  Tag,
  Bookmark,
  Archive,
  Box,
  Package,
  ShoppingCart,
  CreditCard,
  DollarSign,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Award,
  Trophy,
  Gift,
  Coffee,
  Home,
  Map,
  Navigation,
  Plane,
  Car,
  Truck,
  Rocket,
  Lightbulb,
  Puzzle,
  Wrench,
  Hammer,
  Scissors,
  Pen,
  Pencil,
  Edit3,
  Type,
  Image,
  Layers,
  Grid,
  List,
  CheckSquare,
  XSquare,
  AlertCircle,
  Info,
  HelpCircle,
  Lock,
  Unlock,
  Key,
  Shield,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Repeat,
  Shuffle,
  Download,
  Upload,
  CloudDownload,
  CloudUpload,
  Wifi,
  WifiOff,
  Bluetooth,
  Battery,
  Cpu,
  HardDrive,
  Server,
  Database,
  Code,
  Terminal,
  GitBranch,
  Github,
  Gitlab,
  Link,
  ExternalLink,
  Printer,
  Paperclip,
  Clipboard,
  Copy,
  Move,
  RotateCw,
  RefreshCw,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  Sun,
  Moon,
  Cloud,
  CloudRain,
  Umbrella,
  Wind,
  Thermometer,
  Droplet,
  Leaf,
  Flower2,
  Trees,
  type LucideIcon,
} from 'lucide-react';

const ICONS: { name: string; icon: LucideIcon }[] = [
  { name: 'folder', icon: Folder },
  { name: 'palette', icon: Palette },
  { name: 'video', icon: Video },
  { name: 'share-2', icon: Share2 },
  { name: 'target', icon: Target },
  { name: 'briefcase', icon: Briefcase },
  { name: 'layout-dashboard', icon: LayoutDashboard },
  { name: 'Building2', icon: Building2 },
  { name: 'users', icon: Users },
  { name: 'file-text', icon: FileText },
  { name: 'settings', icon: Settings },
  { name: 'star', icon: Star },
  { name: 'heart', icon: Heart },
  { name: 'zap', icon: Zap },
  { name: 'sparkles', icon: Sparkles },
  { name: 'music', icon: Music },
  { name: 'camera', icon: Camera },
  { name: 'film', icon: Film },
  { name: 'mic', icon: Mic },
  { name: 'radio', icon: Radio },
  { name: 'tv', icon: Tv },
  { name: 'monitor', icon: Monitor },
  { name: 'smartphone', icon: Smartphone },
  { name: 'globe', icon: Globe },
  { name: 'mail', icon: Mail },
  { name: 'message-square', icon: MessageSquare },
  { name: 'send', icon: Send },
  { name: 'phone', icon: Phone },
  { name: 'calendar', icon: Calendar },
  { name: 'clock', icon: Clock },
  { name: 'bell', icon: Bell },
  { name: 'search', icon: Search },
  { name: 'filter', icon: Filter },
  { name: 'tag', icon: Tag },
  { name: 'bookmark', icon: Bookmark },
  { name: 'archive', icon: Archive },
  { name: 'box', icon: Box },
  { name: 'package', icon: Package },
  { name: 'shopping-cart', icon: ShoppingCart },
  { name: 'credit-card', icon: CreditCard },
  { name: 'dollar-sign', icon: DollarSign },
  { name: 'trending-up', icon: TrendingUp },
  { name: 'bar-chart-3', icon: BarChart3 },
  { name: 'pie-chart', icon: PieChart },
  { name: 'activity', icon: Activity },
  { name: 'award', icon: Award },
  { name: 'trophy', icon: Trophy },
  { name: 'gift', icon: Gift },
  { name: 'coffee', icon: Coffee },
  { name: 'home', icon: Home },
  { name: 'map', icon: Map },
  { name: 'navigation', icon: Navigation },
  { name: 'plane', icon: Plane },
  { name: 'car', icon: Car },
  { name: 'truck', icon: Truck },
  { name: 'rocket', icon: Rocket },
  { name: 'lightbulb', icon: Lightbulb },
  { name: 'puzzle', icon: Puzzle },
  { name: 'wrench', icon: Wrench },
  { name: 'hammer', icon: Hammer },
  { name: 'scissors', icon: Scissors },
  { name: 'pen', icon: Pen },
  { name: 'pencil', icon: Pencil },
  { name: 'edit-3', icon: Edit3 },
  { name: 'type', icon: Type },
  { name: 'image', icon: Image },
  { name: 'layers', icon: Layers },
  { name: 'grid', icon: Grid },
  { name: 'list', icon: List },
  { name: 'check-square', icon: CheckSquare },
  { name: 'x-square', icon: XSquare },
  { name: 'alert-circle', icon: AlertCircle },
  { name: 'info', icon: Info },
  { name: 'help-circle', icon: HelpCircle },
  { name: 'lock', icon: Lock },
  { name: 'unlock', icon: Unlock },
  { name: 'key', icon: Key },
  { name: 'shield', icon: Shield },
  { name: 'eye', icon: Eye },
  { name: 'eye-off', icon: EyeOff },
  { name: 'volume-2', icon: Volume2 },
  { name: 'volume-x', icon: VolumeX },
  { name: 'play', icon: Play },
  { name: 'pause', icon: Pause },
  { name: 'skip-forward', icon: SkipForward },
  { name: 'skip-back', icon: SkipBack },
  { name: 'repeat', icon: Repeat },
  { name: 'shuffle', icon: Shuffle },
  { name: 'download', icon: Download },
  { name: 'upload', icon: Upload },
  { name: 'cloud-download', icon: CloudDownload },
  { name: 'cloud-upload', icon: CloudUpload },
  { name: 'wifi', icon: Wifi },
  { name: 'wifi-off', icon: WifiOff },
  { name: 'bluetooth', icon: Bluetooth },
  { name: 'battery', icon: Battery },
  { name: 'cpu', icon: Cpu },
  { name: 'hard-drive', icon: HardDrive },
  { name: 'server', icon: Server },
  { name: 'database', icon: Database },
  { name: 'code', icon: Code },
  { name: 'terminal', icon: Terminal },
  { name: 'git-branch', icon: GitBranch },
  { name: 'github', icon: Github },
  { name: 'gitlab', icon: Gitlab },
  { name: 'link', icon: Link },
  { name: 'external-link', icon: ExternalLink },
  { name: 'printer', icon: Printer },
  { name: 'paperclip', icon: Paperclip },
  { name: 'clipboard', icon: Clipboard },
  { name: 'copy', icon: Copy },
  { name: 'move', icon: Move },
  { name: 'rotate-cw', icon: RotateCw },
  { name: 'refresh-cw', icon: RefreshCw },
  { name: 'maximize', icon: Maximize },
  { name: 'minimize', icon: Minimize },
  { name: 'zoom-in', icon: ZoomIn },
  { name: 'zoom-out', icon: ZoomOut },
  { name: 'sun', icon: Sun },
  { name: 'moon', icon: Moon },
  { name: 'cloud', icon: Cloud },
  { name: 'cloud-rain', icon: CloudRain },
  { name: 'umbrella', icon: Umbrella },
  { name: 'wind', icon: Wind },
  { name: 'thermometer', icon: Thermometer },
  { name: 'droplet', icon: Droplet },
  { name: 'leaf', icon: Leaf },
  { name: 'flower-2', icon: Flower2 },
  { name: 'trees', icon: Trees },
];

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  color?: string;
  disabled?: boolean;
}

export function IconPicker({ value, onChange, color = '#6366f1', disabled }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedIcon = ICONS.find((i) => i.name === value);
  const SelectedIconComponent = selectedIcon?.icon || Folder;

  const filteredIcons = ICONS.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          disabled={disabled}
        >
          <SelectedIconComponent className="h-4 w-4" style={{ color }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <Input
            placeholder="Buscar ícone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          <ScrollArea className="h-[240px]">
            <div className="grid grid-cols-8 gap-1">
              {filteredIcons.map(({ name, icon: Icon }) => (
                <Button
                  key={name}
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8',
                    value === name && 'bg-accent ring-1 ring-primary'
                  )}
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Utility function to get icon component by name
export function getIconByName(name: string): LucideIcon {
  const found = ICONS.find((i) => i.name === name);
  return found?.icon || Folder;
}
