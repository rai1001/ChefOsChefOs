import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const AI_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface UseAIAssistantOptions {
  type?: "chat" | "suggest_menu";
}

async function getFunctionAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error("Debes iniciar sesión para usar el asistente de IA");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  if (SUPABASE_PUBLISHABLE_KEY) {
    headers.apikey = SUPABASE_PUBLISHABLE_KEY;
  }

  return headers;
}

export function useAIAssistant(options: UseAIAssistantOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      setError(null);
      const userMsg: Message = { role: "user", content: userMessage };
      const allMessages = [...messagesRef.current, userMsg];
      setMessages(allMessages);
      messagesRef.current = allMessages;
      setIsLoading(true);

      let assistantContent = "";

      const updateAssistant = (chunk: string) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            const next = prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantContent } : m
            );
            messagesRef.current = next;
            return next;
          }
          const next = [...prev, { role: "assistant", content: assistantContent }];
          messagesRef.current = next;
          return next;
        });
      };

      try {
        const headers = await getFunctionAuthHeaders();

        const response = await fetch(AI_FUNCTION_URL, {
          method: "POST",
          headers,
          body: JSON.stringify({
            messages: allMessages,
            type: options.type || "chat",
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Error ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) updateAssistant(content);
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        // Final flush
        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) updateAssistant(content);
            } catch {
              /* ignore */
            }
          }
        }
      } catch (err) {
        console.error("AI Assistant error:", err);
        setError(err instanceof Error ? err.message : "Error desconocido");
        // Remove the user message if we couldn't get a response
        setMessages((prev) => {
          const next = [...prev];
          const idx = next.lastIndexOf(userMsg);
          if (idx !== -1) {
            next.splice(idx, 1);
          } else if (next[next.length - 1]?.role === "user") {
            next.pop();
          }
          messagesRef.current = next;
          return next;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [options.type]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}

// Simple one-shot suggestion (non-streaming)
export async function getAISuggestion(
  prompt: string,
  type: "suggest_menu" | "chat" = "chat"
): Promise<string> {
  const headers = await getFunctionAuthHeaders();

  const response = await fetch(AI_FUNCTION_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      type,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}`);
  }

  if (!response.body) {
    throw new Error("No response body");
  }

  // Collect the full response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let textBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") break;

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) fullContent += content;
      } catch {
        /* ignore */
      }
    }
  }

  return fullContent;
}
