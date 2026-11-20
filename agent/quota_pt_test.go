package agent

import "testing"

func TestPortugueseQuotaErrors(t *testing.T) {
	for _, message := range []string{"saldo insuficiente", "cota diária esgotada", "cota gratuita esgotada"} {
		if !IsQuotaExhaustedMessage(message) {
			t.Errorf("missed %q", message)
		}
	}
	for _, message := range []string{"status 401: saldo insuficiente", "HTTP 503: cota diária esgotada", "rate_limit_error: aguarde para tentar novamente"} {
		if IsQuotaExhaustedMessage(message) {
			t.Errorf("misclassified %q", message)
		}
	}
}
