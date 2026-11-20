// Package localize translates built-in error messages without rewriting stored
// findings, technical evidence, API identifiers, or user-provided content.
package localize

import (
	_ "embed"
	"encoding/json"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
)

//go:embed messages.json
var catalogJSON []byte
var once sync.Once
var catalog map[string]string
var patterns []messagePattern

type messagePattern struct {
	matcher    *regexp.Regexp
	translated string
}

var formatArgument = regexp.MustCompile(`%(?:\[\d+\])?[+#0 -]*\d*(?:\.\d+)?[sdvqfxtTw]`)

func initialize() {
	_ = json.Unmarshal(catalogJSON, &catalog)
	keys := make([]string, 0, len(catalog))
	for key := range catalog {
		keys = append(keys, key)
	}
	sort.Slice(keys, func(i, j int) bool {
		if len(keys[i]) == len(keys[j]) {
			return keys[i] < keys[j]
		}
		return len(keys[i]) > len(keys[j])
	})
	for _, source := range keys {
		indices := formatArgument.FindAllStringIndex(source, -1)
		if len(indices) == 0 {
			continue
		}
		var pattern strings.Builder
		pattern.WriteString("(?s)^")
		position := 0
		for _, index := range indices {
			pattern.WriteString(regexp.QuoteMeta(source[position:index[0]]))
			pattern.WriteString("(.*?)")
			position = index[1]
		}
		pattern.WriteString(regexp.QuoteMeta(source[position:]))
		pattern.WriteString("$")
		compiled, err := regexp.Compile(pattern.String())
		if err == nil {
			patterns = append(patterns, messagePattern{compiled, catalog[source]})
		}
	}
}

func Message(source string) string {
	once.Do(initialize)
	if translated, ok := catalog[source]; ok && !formatArgument.MatchString(source) {
		return translated
	}
	for _, pattern := range patterns {
		parts := pattern.matcher.FindStringSubmatch(source)
		if parts == nil {
			continue
		}
		translated := pattern.translated
		for index, value := range parts[1:] {
			translated = strings.ReplaceAll(translated, "__ARTEX_ARG_"+strconv.Itoa(index)+"__", value)
		}
		return translated
	}
	return source
}
