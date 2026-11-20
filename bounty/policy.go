// Package bounty validates the explicit engagement policy captured by the guided
// task form. It is not a network sandbox; network isolation must be provided by
// the deployment when arbitrary shell tools are enabled.
package bounty

import (
	"encoding/json"
	"fmt"
	"net"
	"net/url"
	"strings"
)

type Policy struct {
	Program      string   `json:"program"`
	InScope      []string `json:"in_scope"`
	OutOfScope   []string `json:"out_of_scope"`
	Restrictions string   `json:"restrictions"`
	Authorized   bool     `json:"authorized"`
}

func (p Policy) Validate() error {
	if !p.Authorized {
		return fmt.Errorf("Confirme que os ativos estão autorizados pelo programa")
	}
	if len(strings.TrimSpace(p.Program)) == 0 || len(p.Program) > 200 {
		return fmt.Errorf("Informe um programa com até 200 caracteres")
	}
	if len(p.InScope) == 0 || len(p.InScope) > 100 || len(p.OutOfScope) > 100 {
		return fmt.Errorf("Informe entre 1 e 100 ativos permitidos e no máximo 100 exclusões")
	}
	if len(p.Restrictions) > 10000 {
		return fmt.Errorf("As restrições devem ter no máximo 10.000 caracteres")
	}
	for _, list := range [][]string{p.InScope, p.OutOfScope} {
		for _, entry := range list {
			if !validScopeEntry(entry) {
				return fmt.Errorf("Ativo de escopo inválido: %q. Use domínio, *.domínio, URL HTTP(S), IP ou CIDR", entry)
			}
		}
	}
	for _, allowed := range p.InScope {
		for _, denied := range p.OutOfScope {
			if strings.EqualFold(strings.TrimSpace(allowed), strings.TrimSpace(denied)) {
				return fmt.Errorf("O ativo %q aparece como permitido e excluído", allowed)
			}
		}
	}
	return nil
}

func validScopeEntry(raw string) bool {
	v := strings.TrimSpace(raw)
	if v == "" || len(v) > 2048 || strings.ContainsAny(v, "\n\r\t ") {
		return false
	}
	if strings.Contains(v, "://") {
		u, err := url.Parse(v)
		return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.User == nil && u.Hostname() != "" && u.Fragment == "" && validHost(u.Hostname())
	}
	if _, _, err := net.ParseCIDR(v); err == nil {
		return true
	}
	if net.ParseIP(v) != nil {
		return true
	}
	v = strings.TrimPrefix(v, "*.")
	return validHost(v)
}

func validHost(v string) bool {
	if net.ParseIP(v) != nil {
		return true
	}
	if len(v) > 253 || !strings.Contains(v, ".") {
		return false
	}
	for _, label := range strings.Split(strings.TrimSuffix(v, "."), ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, r := range label {
			if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-') {
				return false
			}
		}
	}
	return true
}

// Description is an immutable task snapshot. Exclusions and restrictions remain
// visible to planners and workers instead of living only in browser storage.
func (p Policy) Description(context string) string {
	encoded, _ := json.MarshalIndent(p, "", "  ")
	return "Programa de bug bounty: " + strings.TrimSpace(p.Program) + "\n\n" +
		"POLÍTICA DO TESTE (as exclusões prevalecem sobre permissões):\n```json\n" + string(encoded) + "\n```\n\n" +
		"Atue apenas no escopo explicitamente autorizado. Não amplie o escopo a partir de ativos descobertos. " +
		"Não realize negação de serviço, força bruta, engenharia social, persistência ou alterações/exclusões de dados. " +
		"Interrompa e solicite orientação antes de qualquer ação que possa alterar dados ou afetar terceiros. " +
		"Registre suspeitas separadamente de achados reproduzidos; guarde evidências mínimas, sem coletar dados desnecessários. " +
		"Use português do Brasil nas explicações e nos relatórios. Preserve URLs, comandos e evidências técnicas literalmente.\n\nContexto adicional:\n" + context
}
