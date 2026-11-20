package server

import (
	"net"
	"strings"

	"github.com/Autumn-27/artex/bounty"
)

// Convert explicit scope entries to the existing persisted asset gate. These
// rules gate asset insertion and task planning, not arbitrary shell networking.
func bountyScopeRules(policy *bounty.Policy) []taskInterceptRuleReq {
	rules := make([]taskInterceptRuleReq, 0, len(policy.InScope)+len(policy.OutOfScope))
	add := func(entries []string, action string) {
		for _, entry := range entries {
			pattern := strings.TrimSpace(entry)
			kind := "exact_domain"
			switch {
			case strings.HasPrefix(pattern, "*."):
				kind = "domain_suffix"
				pattern = strings.TrimPrefix(pattern, "*.")
			case strings.HasPrefix(pattern, "http://") || strings.HasPrefix(pattern, "https://"):
				kind = "exact_url"
			case net.ParseIP(pattern) != nil:
				kind = "exact_ip"
			case strings.Contains(pattern, "/"):
				kind = "cidr"
			}
			rules = append(rules, taskInterceptRuleReq{Enabled: true, Action: action, Kind: kind, Pattern: pattern, Note: "Escopo do programa: " + policy.Program})
		}
	}
	add(policy.InScope, "allow")
	add(policy.OutOfScope, "block")
	return rules
}
