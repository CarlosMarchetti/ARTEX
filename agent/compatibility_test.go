package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestToolConnectionNonStreaming(t *testing.T) {
	for _, valid := range []bool{true, false} {
		t.Run(fmt.Sprint(valid), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/v1/chat/completions" {
					t.Errorf("path=%s", r.URL.Path)
				}
				var body map[string]any
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					t.Fatal(err)
				}
				if body["stream"] != false {
					t.Errorf("expected non-streaming request")
				}
				tools := body["tools"].([]any)
				if len(tools) != 1 {
					t.Errorf("unexpected tools: %v", tools)
				}
				w.Header().Set("Content-Type", "application/json")
				if valid {
					fmt.Fprint(w, `{"id":"test","choices":[{"index":0,"message":{"role":"assistant","tool_calls":[{"id":"check","type":"function","function":{"name":"artex_connection_check","arguments":"{\"status\":\"ok\"}"}}]},"finish_reason":"tool_calls"}]}`)
				} else {
					fmt.Fprint(w, `{"id":"test","choices":[{"index":0,"message":{"role":"assistant","content":"OK"},"finish_reason":"stop"}]}`)
				}
			}))
			defer server.Close()
			cfg := ConfigFrom("openai", "test-model", server.URL+"/v1", "test-key", "")
			cfg.Stream = false
			_, reply, err := TestToolConnection(context.Background(), cfg)
			if valid && (err != nil || !strings.Contains(reply, "válida")) {
				t.Fatalf("reply=%q err=%v", reply, err)
			}
			if !valid && err == nil {
				t.Fatal("plain text incorrectly passed tool compatibility")
			}
		})
	}
}
