import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useAgentConnections,
  useCreateAgentConnection,
  useDeleteAgentConnection,
  useUpdateAgentConnection,
} from "@/hooks/useAgentConnections";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

const defaultScopes = ["read:events", "read:tasks", "read:inventory"];

export function AgentConnectionsSettings() {
  const { data: connections = [], isLoading } = useAgentConnections();
  const { data: featureFlags } = useFeatureFlags();
  const createConnection = useCreateAgentConnection();
  const updateConnection = useUpdateAgentConnection();
  const deleteConnection = useDeleteAgentConnection();

  const [agentName, setAgentName] = useState("clawtbot");
  const [agentId, setAgentId] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [scopes, setScopes] = useState(defaultScopes.join(","));

  const parsedScopes = useMemo(
    () =>
      scopes
        .split(",")
        .map((scope) => scope.trim())
        .filter(Boolean),
    [scopes],
  );

  const handleCreate = async () => {
    if (!agentId || !publicKey) return;
    await createConnection.mutateAsync({
      agent_name: agentName,
      agent_id: agentId,
      public_key: publicKey,
      allowed_scopes: parsedScopes.length > 0 ? parsedScopes : defaultScopes,
    });
    setAgentId("");
    setPublicKey("");
    setScopes(defaultScopes.join(","));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  const integrationEnabled = featureFlags?.clawtbot_integration ?? false;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Conexiones de Agentes
        </h2>
        <p className="text-sm text-muted-foreground">
          Firma Ed25519 con anti-replay y scopes por hotel.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-background p-4 space-y-3">
        {!integrationEnabled && (
          <p className="text-xs text-muted-foreground">
            La integración está desactivada por feature flag. Actívala en la pestaña de Features.
          </p>
        )}
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="agent-name">Nombre agente</Label>
            <Input
              id="agent-name"
              value={agentName}
              onChange={(event) => setAgentName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="agent-id">Agent ID</Label>
            <Input
              id="agent-id"
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
              placeholder="clawtbot-prod"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="agent-public-key">Public key (base64 raw Ed25519)</Label>
          <Input
            id="agent-public-key"
            value={publicKey}
            onChange={(event) => setPublicKey(event.target.value)}
            placeholder="MCowBQYDK2VwAyEA..."
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="agent-scopes">Scopes (comma-separated)</Label>
          <Input
            id="agent-scopes"
            value={scopes}
            onChange={(event) => setScopes(event.target.value)}
          />
        </div>
        <Button
          onClick={handleCreate}
          disabled={createConnection.isPending || !agentId || !publicKey || !integrationEnabled}
        >
          {createConnection.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Plus className="mr-2 h-4 w-4" />
          Añadir conexión
        </Button>
      </div>

      <div className="space-y-3">
        {connections.map((connection) => (
          <div
            key={connection.id}
            className="rounded-xl border border-border bg-background p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{connection.agent_name}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {connection.agent_id}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={connection.status === "active" ? "secondary" : "default"}
                  size="sm"
                  onClick={() =>
                    updateConnection.mutate({
                      id: connection.id,
                      status: connection.status === "active" ? "inactive" : "active",
                    })
                  }
                >
                  {connection.status === "active" ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => deleteConnection.mutate(connection.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {connection.allowed_scopes?.map((scope) => (
                <Badge key={scope} variant="outline" className="text-xs">
                  {scope}
                </Badge>
              ))}
            </div>
          </div>
        ))}

        {connections.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay conexiones de agentes configuradas todavía.
          </p>
        )}
      </div>
    </div>
  );
}
