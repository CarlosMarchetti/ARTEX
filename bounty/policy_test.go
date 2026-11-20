package bounty

import (
	"strings"
	"testing"
)

func TestPolicyValidation(t *testing.T) {
	valid := []string{"example.com", "*.example.com", "https://example.com/api/v1", "192.0.2.10", "192.0.2.0/24", "2001:db8::/32"}
	for _, entry := range valid {
		p := Policy{Program: "Laboratório", Authorized: true, InScope: []string{entry}}
		if err := p.Validate(); err != nil {
			t.Errorf("%s: %v", entry, err)
		}
	}
	invalid := []string{"*", "https://user:password@example.com", "file:///etc/passwd", "example.com;curl", "foo..example.com", "https://example.com#fragment", "https://example.com/path with spaces", "-bad.example.com", "not-a-domain"}
	for _, entry := range invalid {
		p := Policy{Program: "Laboratório", Authorized: true, InScope: []string{entry}}
		if p.Validate() == nil {
			t.Errorf("accepted %q", entry)
		}
	}
	p := Policy{Program: "Laboratório", InScope: []string{"example.com"}}
	if p.Validate() == nil {
		t.Fatal("missing authorization accepted")
	}
	p.Authorized = true
	p.OutOfScope = []string{"example.com"}
	if p.Validate() == nil {
		t.Fatal("contradictory scope accepted")
	}
}

func TestPolicySnapshotPreservesExclusions(t *testing.T) {
	p := Policy{Program: "Laboratório", Authorized: true, InScope: []string{"*.example.com"}, OutOfScope: []string{"payments.example.com"}, Restrictions: "Sem testes de autenticação"}
	description := p.Description("Teste controlado")
	for _, part := range []string{"payments.example.com", "Sem testes de autenticação", "Não amplie o escopo", "suspeitas", "Teste controlado"} {
		if !strings.Contains(description, part) {
			t.Errorf("missing %q", part)
		}
	}
}
