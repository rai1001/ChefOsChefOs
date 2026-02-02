import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Users, MapPin, UtensilsCrossed, FileText, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Event, Hall } from "@/lib/types";

const hallColors: Record<Hall, string> = {
  ROSALIA: "bg-rose-100 text-rose-700 border-rose-200",
  PONDAL: "bg-blue-100 text-blue-700 border-blue-200",
  CASTELAO: "bg-amber-100 text-amber-700 border-amber-200",
  CURROS: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CUNQUEIRO: "bg-purple-100 text-purple-700 border-purple-200",
  HALL: "bg-slate-100 text-slate-700 border-slate-200",
  RESTAURANTE: "bg-orange-100 text-orange-700 border-orange-200",
  BAR: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

const typeLabels: Record<string, string> = {
  boda: "Boda",
  banquete: "Banquete",
  conferencia: "Conferencia",
  reunion: "Reunión",
  catering: "Catering",
  otro: "Otro",
};

interface EventCardProps {
  event: Event;
  compact?: boolean;
  delay?: number;
  onViewDetails?: () => void;
  onAttachMenu?: () => void;
}

export function EventCard({ 
  event, 
  compact = false, 
  delay = 0,
  onViewDetails,
  onAttachMenu 
}: EventCardProps) {
  const eventDate = parseISO(event.event_date);
  
  if (compact) {
    return (
      <div 
        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors animate-fade-in"
        style={{ animationDelay: `${delay}ms` }}
      >
        <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary">
          <span className="text-lg font-bold leading-none">{format(eventDate, "d")}</span>
          <span className="text-[10px] uppercase">{format(eventDate, "MMM", { locale: es })}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{event.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className={cn("text-[10px] px-1.5", hallColors[event.hall])}>
              {event.hall}
            </Badge>
            {event.attendees && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {event.attendees}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div 
      className="rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:shadow-md animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-primary/10 text-primary">
            <span className="text-xl font-bold leading-none">{format(eventDate, "d")}</span>
            <span className="text-[10px] uppercase font-medium">{format(eventDate, "MMM", { locale: es })}</span>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">
              {event.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={cn("text-xs", hallColors[event.hall])}>
                <MapPin className="h-3 w-3 mr-1" />
                {event.hall}
              </Badge>
              {event.event_type && (
                <Badge variant="secondary" className="text-xs">
                  {typeLabels[event.event_type] || event.event_type}
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        {event.attendees && (
          <div className="text-right">
            <div className="flex items-center gap-1 text-lg font-semibold text-foreground">
              <Users className="h-4 w-4 text-muted-foreground" />
              {event.attendees}
            </div>
            <span className="text-xs text-muted-foreground">personas</span>
          </div>
        )}
      </div>

      {/* Menu info */}
      {event.menu_name && (
        <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-accent/30">
          <UtensilsCrossed className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{event.menu_name}</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        {!event.menu_name && onAttachMenu && (
          <Button variant="outline" size="sm" className="text-xs h-8" onClick={onAttachMenu}>
            <UtensilsCrossed className="h-3 w-3 mr-1" />
            Adjuntar menú
          </Button>
        )}
        <Button variant="outline" size="sm" className="text-xs h-8" onClick={onViewDetails}>
          <FileText className="h-3 w-3 mr-1" />
          Hoja producción
        </Button>
      </div>
    </div>
  );
}
