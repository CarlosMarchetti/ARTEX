package server

import (
	"github.com/Autumn-27/artex/bounty"
	"github.com/Autumn-27/artex/db"
	"testing"
)

func TestBountyRulesEnforceAssetExclusions(t *testing.T) {
	policy := &bounty.Policy{Program: "Laboratório", Authorized: true, InScope: []string{"*.example.com"}, OutOfScope: []string{"billing.example.com"}}
	inputs, err := buildTaskInterceptRules(bountyScopeRules(policy))
	if err != nil {
		t.Fatal(err)
	}
	var block, allow []db.AssetInterceptRule
	for _, input := range inputs {
		rule := db.AssetInterceptRule{Enabled: input.Enabled, Action: input.Action, Kind: input.Kind, Pattern: input.Pattern}
		if rule.Action == "block" {
			block = append(block, rule)
		} else {
			allow = append(allow, rule)
		}
	}
	for _, tc := range []struct {
		host string
		want bool
	}{{"app.example.com", true}, {"billing.example.com", false}, {"app.example.com.evil.test", false}, {"evil-example.com", false}, {"example.com", false}} {
		if got := db.EvaluateAssetGate(block, allow, []string{tc.host}, nil, nil); got.Allowed != tc.want {
			t.Errorf("host=%s allowed=%v want=%v", tc.host, got.Allowed, tc.want)
		}
	}
}
