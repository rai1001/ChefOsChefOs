import { Star, Clock, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface MenuItemCardProps {
  name: string;
  description: string;
  price: number;
  category: string;
  prepTime: string;
  isPopular?: boolean;
  isSpicy?: boolean;
  imageUrl?: string;
  delay?: number;
}

export function MenuItemCard({
  name,
  description,
  price,
  category,
  prepTime,
  isPopular = false,
  isSpicy = false,
  imageUrl,
  delay = 0,
}: MenuItemCardProps) {
  return (
    <div 
      className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Image placeholder */}
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-secondary to-muted">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-4xl text-muted-foreground/30">
              {name.charAt(0)}
            </span>
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute left-3 top-3 flex gap-2">
          {isPopular && (
            <Badge className="bg-primary text-primary-foreground gap-1">
              <Star className="h-3 w-3 fill-current" />
              Popular
            </Badge>
          )}
          {isSpicy && (
            <Badge variant="destructive" className="gap-1">
              <Flame className="h-3 w-3" />
              Picante
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge variant="secondary" className="mb-2 text-xs">
              {category}
            </Badge>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {name}
            </h3>
          </div>
          <span className="font-display text-xl font-bold text-primary">
            ${price}
          </span>
        </div>
        
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>

        <div className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{prepTime}</span>
        </div>
      </div>
    </div>
  );
}
