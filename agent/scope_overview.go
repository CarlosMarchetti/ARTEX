package agent

// taskScopeOverview keeps the configured company/domain/network boundaries in
// the planner context, including a company's rules and descriptive keywords.
func (t *ToolSet) taskScopeOverview() []map[string]any {
	if t.as == nil || t.taskID <= 0 {
		return nil
	}
	rows, err := t.as.ListTaskScope(t.taskID)
	if err != nil {
		return nil
	}
	result := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		entry := map[string]any{"kind": row.Kind, "source": row.Source}
		switch {
		case row.Domain != "":
			entry["value"] = row.Domain
		case row.Net != "":
			entry["value"] = row.Net
		case row.Value != "":
			entry["value"] = row.Value
		}
		if row.CompanyID != nil {
			entry["company_id"] = *row.CompanyID
			entry["company_name"] = row.CompanyName
			if t.cs != nil {
				if rules, err := t.cs.GetScope(*row.CompanyID); err == nil {
					companyScope := make([]map[string]any, 0, len(rules))
					keywords := []string{}
					for _, rule := range rules {
						value := rule.Value
						if rule.Domain != "" {
							value = rule.Domain
						}
						if rule.Net != "" {
							value = rule.Net
						}
						if rule.Raw != "" {
							value = rule.Raw
						}
						companyScope = append(companyScope, map[string]any{"kind": rule.Kind, "value": value})
						if rule.Kind == "keyword" {
							keywords = append(keywords, value)
						}
					}
					entry["company_scope"] = companyScope
					entry["company_keywords"] = keywords
				}
			}
		}
		result = append(result, entry)
	}
	return result
}
