package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/Autumn-27/norma/llm"
	"github.com/Autumn-27/norma/transcript"
)

// TestToolConnection verifies the selected transport can return a structured
// tool call. The function is deliberately never executed: no shell or network
// tools are exposed to the model during this compatibility check.
func TestToolConnection(ctx context.Context, c Config) (time.Duration, string, error) {
	provider, err := c.NewProvider()
	if err != nil {
		return 0, "", err
	}
	ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	ctx = transcript.WithSessionID(ctx, "tooltest-"+transcript.NewSessionID())
	request := llm.CompletionRequest{
		System:    []string{"Teste de compatibilidade do ARTEX. Chame artex_connection_check com status igual a ok. Não escreva explicações e não execute outras ações."},
		Messages:  []llm.Message{llm.UserText("Chame a ferramenta de teste agora.")},
		Tools:     []llm.ToolSchema{{Name: "artex_connection_check", Description: "Verifica compatibilidade; não executa comandos.", InputSchema: map[string]any{"type": "object", "properties": map[string]any{"status": map[string]any{"type": "string", "enum": []string{"ok"}}}, "required": []string{"status"}, "additionalProperties": false}}},
		MaxTokens: 1024,
	}
	start := time.Now()
	var message llm.Message
	if c.Stream {
		var accumulator llm.Accumulator
		for event, streamErr := range provider.Stream(ctx, request) {
			if streamErr != nil {
				return time.Since(start), "", streamErr
			}
			accumulator.Add(event)
		}
		message = accumulator.Message()
	} else {
		message, _, _, err = provider.Complete(ctx, request)
		if err != nil {
			return time.Since(start), "", err
		}
	}
	for _, call := range message.ToolUses() {
		var arguments struct {
			Status string `json:"status"`
		}
		if call.Name == "artex_connection_check" && json.Unmarshal(call.Input, &arguments) == nil && arguments.Status == "ok" {
			return time.Since(start), "Chamada de ferramenta válida. Nenhum comando foi executado.", nil
		}
	}
	return time.Since(start), "", fmt.Errorf("O modelo não retornou uma chamada de ferramenta válida neste teste. Verifique o modelo, o limite de saída e o formato da API antes de executar tarefas")
}
