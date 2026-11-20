package report

func severityLabel(value string) string {
	labels := map[string]string{"critical": "Crítica", "high": "Alta", "medium": "Média", "low": "Baixa", "info": "Informativa", "": "Informativa"}
	if label, ok := labels[value]; ok {
		return label
	}
	return value
}

func findingStatusLabel(value string) string {
	labels := map[string]string{"pending": "Pendente", "": "Pendente", "in_progress": "Em análise", "confirmed": "Confirmado", "resolved": "Tratado", "fixed": "Corrigido", "false_positive": "Falso positivo", "ignored": "Ignorado", "duplicate": "Duplicado", "risk_accepted": "Risco aceito"}
	if label, ok := labels[value]; ok {
		return label
	}
	return value
}
