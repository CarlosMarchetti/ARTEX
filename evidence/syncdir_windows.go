//go:build windows

package evidence

// Windows does not support File.Sync on directory handles. The body itself is
// flushed before its atomic rename; directory metadata durability is managed by
// the filesystem. Returning a directory access error would reject every binding.
func syncDirectory(string) error { return nil }
