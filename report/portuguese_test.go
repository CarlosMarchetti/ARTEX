package report

import (
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/Autumn-27/artex/db"
)

func TestPortugueseExportPreservesTechnicalEvidence(t *testing.T) {
	const evidence = "GET /api/test?key=%20 HTTP/1.1\nX-Test: 原始证据"
	finding := &db.DBFinding{ID: 1, Name: "Validação de autorização", Severity: "high", Status: "pending", Evidence: evidence}
	report := SingleFindingMarkdown(finding, time.Unix(0, 0))
	for _, part := range []string{"ALTA", "Evidências", evidence, "Pendente"} {
		if !strings.Contains(report, part) {
			t.Errorf("missing %q", part)
		}
	}
	finding.Name = strings.Repeat("á", 150)
	if !utf8.ValidString(FindingFilename(finding)) {
		t.Fatal("UTF-8 filename truncated inside a rune")
	}
}
