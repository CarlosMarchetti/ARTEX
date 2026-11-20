package db

import "testing"

func TestDomainSuffixScopeBoundary(t *testing.T) {
	rules := []AssetInterceptRule{{Enabled: true, Kind: "domain_suffix", Pattern: "example.com"}}
	for _, host := range []string{"app.example.com", "a.b.example.com", "APP.EXAMPLE.COM."} {
		if !EvaluateAssetGate(nil, rules, []string{host}, nil, nil).Allowed {
			t.Errorf("blocked %s", host)
		}
	}
	for _, host := range []string{"example.com", "evil-example.com", "app.example.com.evil.test", "example.com.evil.test"} {
		if EvaluateAssetGate(nil, rules, []string{host}, nil, nil).Allowed {
			t.Errorf("accepted outside wildcard: %s", host)
		}
	}
	blocks := []AssetInterceptRule{{Enabled: true, Kind: "exact_domain", Pattern: "payments.example.com"}}
	if EvaluateAssetGate(blocks, rules, []string{"payments.example.com"}, nil, nil).Allowed {
		t.Fatal("allow rule overrode exclusion")
	}
}
