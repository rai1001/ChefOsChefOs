import { 
  ChefHat, 
  Package, 
  ClipboardCheck, 
  UserPlus,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActivityType = "order" | "inventory" | "staff" | "alert" | "complete";

interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  time: string;
}

interface RecentActivityProps {
  activities: Activity[];
}

const activityIcons = {
  order: { icon: ClipboardCheck, color: "bg-info/10 text-info" },
  inventory: { icon: Package, color: "bg-warning/10 text-warning" },
  staff: { icon: UserPlus, color: "bg-primary/10 text-primary" },
  alert: { icon: AlertCircle, color: "bg-destructive/10 text-destructive" },
  complete: { icon: CheckCircle, color: "bg-success/10 text-success" },
};

export function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="font-display text-lg font-semibold text-foreground">
        Actividad Reciente
      </h3>
      
      <div className="mt-4 space-y-4">
        {activities.map((activity, index) => {
          const config = activityIcons[activity.type];
          const Icon = config.icon;
          
          return (
            <div 
              key={activity.id}
              className="flex items-start gap-3 animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                config.color
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{activity.message}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
