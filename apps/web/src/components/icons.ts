import {
  Award,
  BadgeCheck,
  Boxes,
  Building2,
  ClipboardCheck,
  Cog,
  Factory,
  FlaskConical,
  Gauge,
  Headphones,
  Headset,
  Leaf,
  Microscope,
  Phone,
  Rocket,
  Scale,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  Award,
  BadgeCheck,
  Boxes,
  Building2,
  ClipboardCheck,
  Cog,
  Factory,
  FlaskConical,
  Gauge,
  Headphones,
  Headset,
  Leaf,
  Microscope,
  Phone,
  Rocket,
  Scale,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wrench,
};

export function getIcon(name?: string): LucideIcon {
  if (!name) return BadgeCheck;
  return MAP[name] ?? BadgeCheck;
}
