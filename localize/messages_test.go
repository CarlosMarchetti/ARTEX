package localize

import (
	"strings"
	"testing"
)

func TestBuiltInErrorTranslationPreservesArguments(t *testing.T) {
	if got := Message("未提供 API Key"); got != "Informe a chave de API" {
		t.Fatalf("got %q", got)
	}
	if got := Message("任务名称最多 200 个字符"); got != "O nome da tarefa deve ter no máximo 200 caracteres" {
		t.Fatalf("got %q", got)
	}
	const evidence = "GET https://example.com/api?x=%20 — HTTP 403"
	if got := Message(evidence); got != evidence {
		t.Fatalf("changed technical evidence: %q", got)
	}
	if got := Message("task not found"); !strings.Contains(got, "Tarefa") {
		t.Fatalf("got %q", got)
	}
}

func TestCatalogFormatArguments(t *testing.T) {
	once.Do(initialize)
	for source, translated := range catalog {
		count := len(formatArgument.FindAllString(source, -1))
		for index := 0; index < count; index++ {
			// Validate via the same numbered marker scheme as the translator.
			if !strings.Contains(translated, "__ARTEX_ARG_") {
				t.Errorf("format marker lost: %q", source)
				break
			}
		}
	}
}
