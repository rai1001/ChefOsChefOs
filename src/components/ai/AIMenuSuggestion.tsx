import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sparkles, Loader2, Check } from "lucide-react";
import { getAISuggestion } from "@/hooks/useAIAssistant";
import ReactMarkdown from "react-markdown";

interface Props {
  eventName: string;
  pax: number;
  eventType?: string;
  onSelectMenu?: (menuName: string) => void;
}

export function AIMenuSuggestion({ eventName, pax, eventType, onSelectMenu }: Props) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetSuggestion = async () => {
    setIsLoading(true);
    setError(null);
    setSuggestion(null);

    try {
      const prompt = `Sugiere un menú para el siguiente evento:
- Nombre: ${eventName || "Sin nombre"}
- Número de comensales: ${pax || "No especificado"}
- Tipo: ${eventType || "General"}

Por favor, indica el menú más adecuado y explica brevemente por qué.`;

      const result = await getAISuggestion(prompt, "suggest_menu");
      setSuggestion(result);
    } catch (err) {
      console.error("AI suggestion error:", err);
      setError(err instanceof Error ? err.message : "Error al obtener sugerencia");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleGetSuggestion}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 text-primary" />
          )}
          Sugerir con IA
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Sugerencia de ChefOS AI
          </div>
          
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analizando evento...
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {suggestion && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{suggestion}</ReactMarkdown>
            </div>
          )}

          {!isLoading && !suggestion && !error && (
            <p className="text-sm text-muted-foreground">
              Haz clic para obtener una recomendación de menú basada en el evento.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
